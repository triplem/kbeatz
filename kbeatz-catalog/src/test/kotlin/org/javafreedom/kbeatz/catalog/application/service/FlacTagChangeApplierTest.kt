package org.javafreedom.kbeatz.catalog.application.service

import io.mockk.coEvery
import io.mockk.mockk
import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.uuid.Uuid
import kotlinx.coroutines.test.runTest
import kotlinx.io.files.Path as KtPath
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.TagChange
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.infrastructure.tag.FlacTagWriter
import org.javafreedom.kbeatz.common.ResourceNotFoundException
import org.javafreedom.kbeatz.tagger.codec.flac.FlacFile

/**
 * Unit tests for [FlacTagChangeApplier], which applies change-plan tag changes through the single
 * shared FLAC tag-write path (story #817).
 */
class FlacTagChangeApplierTest {

    private val libraryRoot: Path = Files.createTempDirectory("applier-root")
    private val albumDir: Path = Files.createTempDirectory(libraryRoot, "album")
    private val albumId = Uuid.random()
    private val albumRepository: AlbumRepository = mockk()
    private val applier = FlacTagChangeApplier(albumRepository, FlacTagWriter(libraryRoot))

    @AfterTest
    fun cleanUp() {
        libraryRoot.toFile().deleteRecursively()
    }

    private fun album() = Album(
        id = albumId,
        albumArtist = "Miles Davis",
        album = "Kind of Blue",
        date = null,
        genre = null,
        label = null,
        catalogNumber = null,
        composer = null,
        conductor = null,
        ensemble = null,
        discogsId = null,
        directoryPath = albumDir.toString(),
        extraTags = null,
        images = null,
    )

    private fun copyFixture(dest: Path) {
        val resource = checkNotNull(
            FlacTagChangeApplierTest::class.java.classLoader.getResource("with-tags.flac"),
        ) { "with-tags.flac fixture not found in test resources" }
        Files.copy(Path.of(resource.toURI()), dest)
    }

    private fun tagValue(flac: Path, field: String): String? =
        FlacFile.read(KtPath(flac.toString())).vorbisComment
            ?.comments
            ?.firstOrNull { it.substringBefore('=').equals(field, ignoreCase = true) }
            ?.substringAfter('=')

    @Test
    fun `apply writes proposed values to the album FLAC files`() = runTest {
        val flac = albumDir.resolve("01.flac")
        copyFixture(flac)
        coEvery { albumRepository.findById(albumId) } returns album()

        applier.apply(
            albumId,
            listOf(
                TagChange(albumId.toString(), "GENRE", currentValue = null, proposedValue = "Modal Jazz"),
                TagChange(albumId.toString(), "LABEL", currentValue = "Old", proposedValue = "Columbia"),
            ),
        )

        assertEquals("Modal Jazz", tagValue(flac, "GENRE"))
        assertEquals("Columbia", tagValue(flac, "LABEL"))
    }

    @Test
    fun `apply throws ResourceNotFoundException when the album is missing`() = runTest {
        coEvery { albumRepository.findById(albumId) } returns null

        assertFailsWith<ResourceNotFoundException> {
            applier.apply(
                albumId,
                listOf(TagChange(albumId.toString(), "GENRE", null, "Jazz")),
            )
        }
    }

    @Test
    fun `apply is a no-op when there are no changes`() = runTest {
        // findById is never stubbed: an empty change set must short-circuit before any lookup.
        applier.apply(albumId, emptyList())
    }

    @Test
    fun `apply skips fields whose proposed value is null (removal)`() = runTest {
        val flac = albumDir.resolve("01.flac")
        copyFixture(flac)
        coEvery { albumRepository.findById(albumId) } returns album()
        val before = tagValue(flac, "TITLE")

        applier.apply(
            albumId,
            listOf(TagChange(albumId.toString(), "TITLE", currentValue = "Kind of Blue", proposedValue = null)),
        )

        // A null proposal is skipped, so the existing value is left untouched.
        assertEquals(before, tagValue(flac, "TITLE"))
    }
}
