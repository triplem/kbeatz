package org.javafreedom.kbeatz.catalog.application.service

import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlinx.io.bytestring.ByteString
import org.javafreedom.kbeatz.tagger.codec.flac.FlacMetadataBlock
import org.javafreedom.kbeatz.tagger.codec.flac.FlacWriter

/**
 * Unit tests for [LibraryWalker].
 *
 * Each test writes minimal valid FLAC files to a temporary directory,
 * runs the walker, and asserts the expected [AlbumGroup]s are returned.
 */
class LibraryWalkerTest {

    private val walker = LibraryWalker()
    private val md5Zeros = ByteString(ByteArray(16))

    private val streamInfo = FlacMetadataBlock.StreamInfo(
        minBlockSize = 4096, maxBlockSize = 4096,
        minFrameSize = 0, maxFrameSize = 0,
        sampleRate = 44100, channels = 2, bitsPerSample = 16,
        totalSamples = 0L, md5 = md5Zeros,
    )

    /** Build minimal valid FLAC bytes with the given Vorbis Comment tags. */
    private fun flacBytes(vararg comments: String): ByteArray {
        val vc = FlacMetadataBlock.VorbisComment(vendor = "test", comments = comments.toList())
        return FlacWriter().write(listOf(streamInfo, vc), ByteArray(0))
    }

    /** Write [content] to [dir]/[name] and return the path. */
    private fun writeFile(dir: Path, name: String, content: ByteArray): Path =
        dir.resolve(name).also { Files.write(it, content) }

    /** Create a temp directory, run [block] with it, delete it after. */
    private fun withTempDir(block: (Path) -> Unit) {
        val tmp = Files.createTempDirectory("walker-test")
        try {
            block(tmp)
        } finally {
            tmp.toFile().deleteRecursively()
        }
    }

    @Test
    fun `walk groups all FLAC files in one directory into one AlbumGroup`() = withTempDir { root ->
        val albumDir = Files.createDirectories(root.resolve("jazz/miles-davis/kind-of-blue"))
        writeFile(albumDir, "01 - So What.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959", "TITLE=So What"
        ))
        writeFile(albumDir, "02 - Freddie Freeloader.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959", "TITLE=Freddie Freeloader"
        ))

        val groups = walker.walk(root)

        assertEquals(1, groups.size)
        assertEquals("Miles Davis", groups[0].albumArtist)
        assertEquals("Kind of Blue", groups[0].albumTitle)
        assertEquals("1959", groups[0].date)
        assertEquals(2, groups[0].flacPaths.size)
    }

    @Test
    fun `walk merges disc1 and disc2 subdirectories into a single AlbumGroup`() = withTempDir { root ->
        val albumDir = Files.createDirectories(root.resolve("rock/beatles/white-album"))
        val disc1 = Files.createDirectories(albumDir.resolve("disc1"))
        val disc2 = Files.createDirectories(albumDir.resolve("disc2"))

        writeFile(disc1, "01 - Back in the USSR.flac", flacBytes(
            "ALBUMARTIST=The Beatles", "ALBUM=The Beatles", "DATE=1968", "DISCNUMBER=1"
        ))
        writeFile(disc2, "01 - Revolution 1.flac", flacBytes(
            "ALBUMARTIST=The Beatles", "ALBUM=The Beatles", "DATE=1968", "DISCNUMBER=2"
        ))

        val groups = walker.walk(root)

        assertEquals(1, groups.size, "disc1 and disc2 should merge into one group")
        assertEquals("The Beatles", groups[0].albumArtist)
        assertEquals(2, groups[0].flacPaths.size)
        assertEquals(albumDir, groups[0].rootPath)
    }

    @Test
    fun `walk returns two AlbumGroups for two unrelated album directories`() = withTempDir { root ->
        val dir1 = Files.createDirectories(root.resolve("jazz/miles-davis/kind-of-blue"))
        val dir2 = Files.createDirectories(root.resolve("jazz/coltrane/a-love-supreme"))

        writeFile(dir1, "01 - So What.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959"
        ))
        writeFile(dir2, "01 - Acknowledgement.flac", flacBytes(
            "ALBUMARTIST=John Coltrane", "ALBUM=A Love Supreme", "DATE=1964"
        ))

        val groups = walker.walk(root)

        assertEquals(2, groups.size)
        val artists = groups.map { it.albumArtist }.toSet()
        assertTrue("Miles Davis" in artists)
        assertTrue("John Coltrane" in artists)
    }

    @Test
    fun `walk groups correctly when DATE tag is absent`() = withTempDir { root ->
        val albumDir = Files.createDirectories(root.resolve("classical/bach/goldberg"))
        writeFile(albumDir, "01 - Aria.flac", flacBytes(
            "ALBUMARTIST=Glenn Gould", "ALBUM=Goldberg Variations"
            // No DATE tag
        ))
        writeFile(albumDir, "02 - Variation 1.flac", flacBytes(
            "ALBUMARTIST=Glenn Gould", "ALBUM=Goldberg Variations"
        ))

        val groups = walker.walk(root)

        assertEquals(1, groups.size)
        assertEquals("Glenn Gould", groups[0].albumArtist)
        assertEquals("Goldberg Variations", groups[0].albumTitle)
        assertEquals(null, groups[0].date, "DATE should be null when tag is absent")
        assertEquals(2, groups[0].flacPaths.size)
    }

    @Test
    fun `walk includes only FLAC files and ignores other file types`() = withTempDir { root ->
        val albumDir = Files.createDirectories(root.resolve("jazz/miles-davis/bitches-brew"))
        writeFile(albumDir, "01 - Pharaoh's Dance.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Bitches Brew", "DATE=1970"
        ))
        // Non-FLAC files that should be ignored
        Files.write(albumDir.resolve("cover.jpg"), "fake image".toByteArray())
        Files.write(albumDir.resolve("liner-notes.pdf"), "fake pdf".toByteArray())
        Files.write(albumDir.resolve("album.m3u"), "#EXTM3U\n".toByteArray())

        val groups = walker.walk(root)

        assertEquals(1, groups.size)
        assertEquals(1, groups[0].flacPaths.size, "Only the .flac file should be included")
        assertTrue(groups[0].flacPaths[0].fileName.toString().endsWith(".flac"))
    }

    @Test
    fun `walk throws when library root does not exist`() {
        val nonExistent = Path.of("/nonexistent/path/that/does/not/exist")

        assertFailsWith<IllegalArgumentException> {
            walker.walk(nonExistent)
        }
    }

    @Test
    fun `walk handles empty library root with no FLAC files`() = withTempDir { root ->
        Files.createDirectories(root.resolve("empty-dir"))

        val groups = walker.walk(root)

        assertTrue(groups.isEmpty())
    }

    @Test
    fun `walk skips unreadable FLAC files and continues`() = withTempDir { root ->
        val albumDir = Files.createDirectories(root.resolve("jazz/miles-davis/sketches"))
        // Write a corrupt file (not a valid FLAC)
        Files.write(albumDir.resolve("corrupt.flac"), "not a flac file".toByteArray())
        // Write a valid FLAC
        writeFile(albumDir, "01 - Concierto de Aranjuez.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Sketches of Spain", "DATE=1960"
        ))

        val groups = walker.walk(root)

        // Valid file should still be grouped; corrupt file skipped
        assertEquals(1, groups.size)
        assertEquals(1, groups[0].flacPaths.size)
    }
}
