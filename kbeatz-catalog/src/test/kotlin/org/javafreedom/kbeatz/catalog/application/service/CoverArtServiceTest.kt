package org.javafreedom.kbeatz.catalog.application.service

import io.mockk.coEvery
import io.mockk.mockk
import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.uuid.Uuid
import kotlinx.coroutines.test.runTest
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.ImageDescriptor
import org.javafreedom.kbeatz.catalog.domain.model.ImageSource
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.common.ResourceNotFoundException
import org.javafreedom.kbeatz.tagger.codec.flac.FlacMetadataBlock

class CoverArtServiceTest {

    private val repository: AlbumRepository = mockk()
    private val tempDir: Path = Files.createTempDirectory("kbeatz-cover-art-test")

    private val service = CoverArtService(repository, tempDir)

    private fun album(
        id: Uuid = Uuid.random(),
        directoryPath: String = tempDir.toString(),
        images: List<ImageDescriptor>? = null,
    ) = Album(
        id = id,
        albumArtist = "Miles Davis",
        album = "Kind of Blue",
        date = "1959",
        genre = "Jazz",
        label = "Columbia",
        catalogNumber = "CL 1355",
        composer = null,
        conductor = null,
        ensemble = null,
        discogsId = null,
        directoryPath = directoryPath,
        extraTags = null,
        images = images,
    )

    @Test
    fun `getCoverArt throws ResourceNotFoundException when album does not exist`() = runTest {
        val id = Uuid.random()
        coEvery { repository.findById(id) } returns null

        assertFailsWith<ResourceNotFoundException> {
            service.getCoverArt(id)
        }
    }

    @Test
    fun `getCoverArt returns null when no cover art exists`() = runTest {
        val id = Uuid.random()
        coEvery { repository.findById(id) } returns album(id = id, images = null)

        val result = service.getCoverArt(id)

        assertNull(result)
    }

    @Test
    fun `getCoverArt returns folder_jpg when present and no embedded picture`() = runTest {
        val id = Uuid.random()
        val folderJpg = Files.createFile(tempDir.resolve("folder.jpg"))
        val jpegBytes = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte())
        Files.write(folderJpg, jpegBytes)

        coEvery { repository.findById(id) } returns album(id = id, images = null)

        val result = service.getCoverArt(id)

        assertNotNull(result)
        assertEquals("image/jpeg", result.mimeType)
        assert(result.bytes.contentEquals(jpegBytes))

        Files.deleteIfExists(folderJpg)
    }

    @Test
    fun `getCoverArt returns null when images list is empty`() = runTest {
        val id = Uuid.random()
        coEvery { repository.findById(id) } returns album(id = id, images = emptyList())

        val result = service.getCoverArt(id)

        // No folder.jpg, no embedded picture → null
        assertNull(result)
    }

    @Test
    fun `getCoverArt returns null when embedded track file does not exist`() = runTest {
        val id = Uuid.random()
        val imageDescriptor = ImageDescriptor(
            pictureType = FlacMetadataBlock.Picture.TYPE_FRONT_COVER,
            source = ImageSource.EMBEDDED,
            path = "nonexistent-track.flac",
            mimeType = "image/jpeg",
            description = "",
        )
        coEvery { repository.findById(id) } returns album(id = id, images = listOf(imageDescriptor))

        val result = service.getCoverArt(id)

        // Track doesn't exist on disk → falls through to null (no folder.jpg either)
        assertNull(result)
    }

    @Test
    fun `getCoverArt throws SecurityException when album directory is outside library root`() = runTest {
        val id = Uuid.random()
        val outsideDir = "/tmp/../../etc/passwd"
        coEvery { repository.findById(id) } returns album(id = id, directoryPath = outsideDir)

        assertFailsWith<SecurityException> {
            service.getCoverArt(id)
        }
    }

    @Test
    fun `getCoverArt skips non-front-cover ImageDescriptor sources`() = runTest {
        val id = Uuid.random()
        // Back cover (type 4) should not be served as the front cover
        val imageDescriptor = ImageDescriptor(
            pictureType = FlacMetadataBlock.Picture.TYPE_BACK_COVER,
            source = ImageSource.EMBEDDED,
            path = "01-track.flac",
            mimeType = "image/jpeg",
            description = "",
        )
        coEvery { repository.findById(id) } returns album(id = id, images = listOf(imageDescriptor))

        val result = service.getCoverArt(id)

        // No front cover, no folder.jpg → null
        assertNull(result)
    }

    @Test
    fun `getCoverArt skips FILE source ImageDescriptor`() = runTest {
        val id = Uuid.random()
        val imageDescriptor = ImageDescriptor(
            pictureType = FlacMetadataBlock.Picture.TYPE_FRONT_COVER,
            source = ImageSource.FILE,
            path = "folder.jpg",
            mimeType = "image/jpeg",
            description = "",
        )
        // No actual folder.jpg on disk (in its unresolved path)
        coEvery { repository.findById(id) } returns album(id = id, images = listOf(imageDescriptor))

        val result = service.getCoverArt(id)

        assertNull(result)
    }

    @Test
    fun `CoverArtService constructs without exception when library root does not exist`() {
        val nonExistentRoot = tempDir.resolve("does-not-exist")
        // Must not throw — startup resilience requirement (#128)
        CoverArtService(repository, nonExistentRoot)
    }

    @Test
    fun `getCoverArt returns null when library root does not exist and album dir is within it`() = runTest {
        val nonExistentRoot = tempDir.resolve("no-library")
        val missingService = CoverArtService(repository, nonExistentRoot)
        val id = Uuid.random()
        val albumDir = nonExistentRoot.resolve("Jazz/Kind of Blue")
        coEvery { repository.findById(id) } returns album(id = id, directoryPath = albumDir.toString())

        val result = missingService.getCoverArt(id)

        assertNull(result)
    }
}
