package org.javafreedom.kbeatz.tagger.service

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.io.bytestring.ByteString
import kotlinx.io.files.Path
import org.javafreedom.kbeatz.sources.ImageResult
import org.javafreedom.kbeatz.sources.Label
import org.javafreedom.kbeatz.sources.MetadataSource
import org.javafreedom.kbeatz.sources.Release
import org.javafreedom.kbeatz.sources.ReleaseArtist
import org.javafreedom.kbeatz.tagger.codec.flac.FlacMetadataBlock
import org.javafreedom.kbeatz.tagger.codec.flac.FlacReader
import org.javafreedom.kbeatz.tagger.codec.flac.FlacWriter
import org.javafreedom.kbeatz.tagger.codec.flac.VorbisCommentFields
import org.javafreedom.kbeatz.tagger.idfile.IdFileReader
import org.javafreedom.kbeatz.tagger.idfile.SourceConfig
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertIs

class DefaultTaggerServiceTest {

    private val metadataSource = mockk<MetadataSource>()
    private val idReader = IdFileReader(SourceConfig())

    private val md5Zeros = ByteString(ByteArray(16))
    private val streamInfo = FlacMetadataBlock.StreamInfo(4096, 4096, 0, 0, 44100, 2, 16, 0L, md5Zeros)

    private fun minimalFlacBytes(): ByteArray = FlacWriter().write(
        listOf(streamInfo, FlacMetadataBlock.VorbisComment("test", emptyList())),
        ByteArray(0),
    )

    private val release = Release(
        sourceId = "12345",
        sourceName = "discogs",
        title = "Kind of Blue",
        artists = listOf(ReleaseArtist("1", "Miles Davis")),
        extraArtists = listOf(
            ReleaseArtist("2", "Bill Evans", role = "Composed By"),
            ReleaseArtist("3", "Miles Davis", role = "Conductor"),
        ),
        year = 1959,
        released = null,
        labels = listOf(Label("Columbia", "CL 1355")),
        genres = listOf("Jazz"),
        styles = emptyList(),
        country = "US",
        notes = null,
        tracklist = emptyList(),
        images = emptyList(),
        masterUrl = null,
        resourceUrl = "https://api.discogs.com/releases/12345",
        barcode = "074646154328",
    )

    @Test
    fun `should return Skipped when no id file present`(@TempDir tempDir: java.nio.file.Path) = runTest {
        val service = DefaultTaggerService(idReader, metadataSource)
        val result = service.tagAlbum(Path(tempDir.toString()))
        assertIs<TagResult.Skipped>(result)
        assertContains(result.reason, "no id file")
    }

    @Test
    fun `should return Skipped when id file has no discogs_id`(@TempDir tempDir: java.nio.file.Path) = runTest {
        // IniIdFileParser returns null for INI files without discogs_id,
        // so the reader sees no parseable id file → "no id file found"
        Files.writeString(tempDir.resolve("id.txt"), "[source]\namg_id=99\n")
        val service = DefaultTaggerService(idReader, metadataSource)
        val result = service.tagAlbum(Path(tempDir.toString()))
        assertIs<TagResult.Skipped>(result)
        assertContains(result.reason, "no id file found")
    }

    @Test
    fun `should return Skipped when release not found on source`(@TempDir tempDir: java.nio.file.Path) = runTest {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=99999\n")
        coEvery { metadataSource.fetchRelease("99999") } returns null
        coEvery { metadataSource.name } returns "discogs"
        val service = DefaultTaggerService(idReader, metadataSource)
        val result = service.tagAlbum(Path(tempDir.toString()))
        assertIs<TagResult.Skipped>(result)
        assertContains(result.reason, "99999")
    }

    @Test
    fun `should tag all flac files and return Tagged with file count`(@TempDir tempDir: java.nio.file.Path) = runTest {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        Files.write(tempDir.resolve("02-track.flac"), minimalFlacBytes())
        coEvery { metadataSource.fetchRelease("12345") } returns release

        val service = DefaultTaggerService(idReader, metadataSource)
        val result = service.tagAlbum(Path(tempDir.toString()))

        assertIs<TagResult.Tagged>(result)
        assertEquals("12345", result.discogsId)
        assertEquals(2, result.filesWritten)
    }

    @Test
    fun `should write all mapped release fields to vorbis comment`(@TempDir tempDir: java.nio.file.Path) = runTest {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        val flacPath = tempDir.resolve("01-track.flac")
        Files.write(flacPath, minimalFlacBytes())
        coEvery { metadataSource.fetchRelease("12345") } returns release

        val service = DefaultTaggerService(idReader, metadataSource)
        service.tagAlbum(Path(tempDir.toString()))

        val tags = FlacReader().parse(Files.readAllBytes(flacPath))
            .blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals("Kind of Blue", tags.get(VorbisCommentFields.ALBUM))
        assertEquals("Miles Davis", tags.get(VorbisCommentFields.ALBUMARTIST))
        assertEquals("1959", tags.get(VorbisCommentFields.DATE))
        assertEquals("Jazz", tags.get(VorbisCommentFields.GENRE))
        assertEquals("Columbia", tags.get(VorbisCommentFields.LABEL))
        assertEquals("CL 1355", tags.get(VorbisCommentFields.CATALOGNUMBER))
        assertEquals("12345", tags.get(VorbisCommentFields.DISCOGS_ID))
        assertEquals("https://api.discogs.com/releases/12345", tags.get(VorbisCommentFields.DISCOGS_RELEASE_URL))
        assertEquals("074646154328", tags.get(VorbisCommentFields.BARCODE))
    }

    @Test
    fun `should extract classical roles from extraArtists`(@TempDir tempDir: java.nio.file.Path) = runTest {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        coEvery { metadataSource.fetchRelease("12345") } returns release

        val service = DefaultTaggerService(idReader, metadataSource)
        service.tagAlbum(Path(tempDir.toString()))

        val tags = FlacReader().parse(Files.readAllBytes(tempDir.resolve("01-track.flac")))
            .blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals("Bill Evans", tags.get(VorbisCommentFields.COMPOSER))
        assertEquals("Miles Davis", tags.get(VorbisCommentFields.CONDUCTOR))
    }

    @Test
    fun `should not overwrite existing MUSICBRAINZ tags`(@TempDir tempDir: java.nio.file.Path) = runTest {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        val existingFlac = FlacWriter().write(
            listOf(
                streamInfo,
                FlacMetadataBlock.VorbisComment(
                    "test",
                    listOf("MUSICBRAINZ_ALBUMID=some-mb-id", "TITLE=Old Title"),
                ),
            ),
            ByteArray(0),
        )
        Files.write(tempDir.resolve("01-track.flac"), existingFlac)
        coEvery { metadataSource.fetchRelease("12345") } returns release

        val service = DefaultTaggerService(idReader, metadataSource)
        service.tagAlbum(Path(tempDir.toString()))

        val tags = FlacReader().parse(Files.readAllBytes(tempDir.resolve("01-track.flac")))
            .blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals("some-mb-id", tags.get(VorbisCommentFields.MUSICBRAINZ_ALBUMID))
        assertEquals("Kind of Blue", tags.get(VorbisCommentFields.ALBUM))
    }

    @Test
    fun `should return Failed when exception is thrown`(@TempDir tempDir: java.nio.file.Path) = runTest {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        Files.write(tempDir.resolve("01-track.flac"), ByteArray(0))  // corrupt FLAC
        coEvery { metadataSource.fetchRelease("12345") } returns release

        val service = DefaultTaggerService(idReader, metadataSource)
        val result = service.tagAlbum(Path(tempDir.toString()))
        assertIs<TagResult.Failed>(result)
    }

    @Test
    fun `should return Tagged with zero files when album has no flac files`(@TempDir tempDir: java.nio.file.Path) = runTest {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        coEvery { metadataSource.fetchRelease("12345") } returns release

        val service = DefaultTaggerService(idReader, metadataSource)
        val result = service.tagAlbum(Path(tempDir.toString()))
        assertIs<TagResult.Tagged>(result)
        assertEquals(0, result.filesWritten)
    }

    @Test
    fun `should prefer released year over year field when both present`(@TempDir tempDir: java.nio.file.Path) = runTest {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        val releaseWithDate = release.copy(
            year = 1959,
            released = kotlinx.datetime.LocalDate(1959, 8, 17),
        )
        coEvery { metadataSource.fetchRelease("12345") } returns releaseWithDate

        val service = DefaultTaggerService(idReader, metadataSource)
        service.tagAlbum(Path(tempDir.toString()))

        val tags = FlacReader().parse(Files.readAllBytes(tempDir.resolve("01-track.flac")))
            .blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals("1959", tags.get(VorbisCommentFields.DATE))
    }

    @Test
    fun `should map Orchestra extra artist to ENSEMBLE tag`(@TempDir tempDir: java.nio.file.Path) = runTest {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        val classicalRelease = release.copy(
            extraArtists = listOf(ReleaseArtist("5", "Berlin Philharmonic", role = "Orchestra")),
        )
        coEvery { metadataSource.fetchRelease("12345") } returns classicalRelease

        val service = DefaultTaggerService(idReader, metadataSource)
        service.tagAlbum(Path(tempDir.toString()))

        val tags = FlacReader().parse(Files.readAllBytes(tempDir.resolve("01-track.flac")))
            .blocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().first()
        assertEquals("Berlin Philharmonic", tags.get(VorbisCommentFields.ENSEMBLE))
    }

    @Test
    fun `should embed cover art in PICTURE block when downloadImages is true`(@TempDir tempDir: java.nio.file.Path) = runTest {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        Files.write(tempDir.resolve("01-track.flac"), minimalFlacBytes())
        val imageBytes = ByteString(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte()))
        coEvery { metadataSource.fetchRelease("12345") } returns release
        coEvery { metadataSource.fetchImage("12345", 0) } returns ImageResult(imageBytes, "image/jpeg")

        val service = DefaultTaggerService(idReader, metadataSource)
        service.tagAlbum(Path(tempDir.toString()), downloadImages = true)

        val blocks = FlacReader().parse(Files.readAllBytes(tempDir.resolve("01-track.flac"))).blocks
        val picture = blocks.filterIsInstance<FlacMetadataBlock.Picture>().firstOrNull()
        assertEquals(FlacMetadataBlock.Picture.TYPE_FRONT_COVER, picture?.pictureType)
        assertEquals("image/jpeg", picture?.mimeType)
        assertEquals(imageBytes, picture?.data)
    }

    @Test
    fun `should not call fetchImage when downloadImages is false`(@TempDir tempDir: java.nio.file.Path) = runTest {
        Files.writeString(tempDir.resolve("id.txt"), "[source]\ndiscogs_id=12345\n")
        coEvery { metadataSource.fetchRelease("12345") } returns release

        val service = DefaultTaggerService(idReader, metadataSource)
        service.tagAlbum(Path(tempDir.toString()), downloadImages = false)

        coVerify(exactly = 0) { metadataSource.fetchImage(any(), any()) }
    }
}
