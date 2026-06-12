package org.javafreedom.kbeatz.catalog.application.service

import io.github.oshai.kotlinlogging.KotlinLogging
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.BasicFileAttributes
import java.time.Instant
import kotlin.uuid.Uuid
import kotlinx.io.files.Path as KtPath
import org.javafreedom.kbeatz.catalog.domain.model.ImageDescriptor
import org.javafreedom.kbeatz.catalog.domain.model.ImageSource
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.common.ResourceNotFoundException
import org.javafreedom.kbeatz.tagger.codec.flac.FlacFile
import org.javafreedom.kbeatz.tagger.codec.flac.FlacMetadataBlock

private val log = KotlinLogging.logger {}

/**
 * Resolves cover art for an album.
 *
 * Resolution order:
 * 1. Embedded METADATA_BLOCK_PICTURE type 3 (front cover) in any FLAC file.
 * 2. `folder.jpg` in the album directory.
 * 3. Not found → null.
 *
 * Path traversal guard: the album directory is validated against [libraryRoot]
 * using `normalize()` + `startsWith()`. Unlike `toRealPath()`, this does NOT
 * require the path to exist at construction time, making the service resilient
 * to a missing library root at startup (e.g. a not-yet-mounted volume).
 */
class CoverArtService(
    private val repository: AlbumRepository,
    private val libraryRoot: Path,
) {
    private val normalizedRoot: Path = libraryRoot.normalize()

    init {
        if (!Files.isDirectory(libraryRoot)) {
            log.warn {
                "CATALOG_LIBRARY_ROOT does not exist or is not a directory: $libraryRoot" +
                    " — cover art will return 404 until the directory is created"
            }
        }
    }

    /**
     * Returns the cover art for the album identified by [albumId], or null if none is found.
     *
     * @throws ResourceNotFoundException when no album with [albumId] exists.
     * @throws SecurityException when the album's directory path escapes [libraryRoot].
     */
    suspend fun getCoverArt(albumId: Uuid): CoverArtResult? {
        val album = repository.findById(albumId)
            ?: throw ResourceNotFoundException("Album", albumId.toString())

        val albumDir = Path.of(album.directoryPath)
        validateWithinLibraryRoot(albumDir)

        return resolveEmbeddedPicture(album.images, albumDir)
            ?: resolveFolderJpg(albumDir, albumId)
    }

    private fun resolveFolderJpg(albumDir: Path, albumId: Uuid): CoverArtResult? {
        val folderJpg = albumDir.resolve("folder.jpg")
        return if (Files.isRegularFile(folderJpg)) {
            log.debug { "Serving folder.jpg for album $albumId" }
            val lastModified = readLastModified(folderJpg)
            CoverArtResult(bytes = Files.readAllBytes(folderJpg), mimeType = "image/jpeg", lastModified = lastModified)
        } else {
            log.debug { "No cover art found for album $albumId" }
            null
        }
    }

    private fun readLastModified(path: Path): Instant? =
        try {
            Files.readAttributes(path, BasicFileAttributes::class.java).lastModifiedTime().toInstant()
        } catch (_: Exception) {
            null
        }

    private fun resolveEmbeddedPicture(
        images: List<ImageDescriptor>?,
        albumDir: Path,
    ): CoverArtResult? =
        images
            ?.firstOrNull {
                it.pictureType == FlacMetadataBlock.Picture.TYPE_FRONT_COVER &&
                    it.source == ImageSource.EMBEDDED
            }
            ?.let { descriptor ->
                val trackPath = albumDir.resolve(descriptor.path)
                if (Files.isRegularFile(trackPath)) {
                    readEmbeddedPicture(trackPath, descriptor.mimeType)
                } else {
                    log.warn { "Embedded picture track not found: $trackPath" }
                    null
                }
            }

    @Suppress("TooGenericExceptionCaught") // any codec failure falls through gracefully
    private fun readEmbeddedPicture(trackPath: Path, fallbackMime: String): CoverArtResult? =
        try {
            val flac = FlacFile.read(KtPath(trackPath.toString()))
            flac.metadataBlocks
                .filterIsInstance<FlacMetadataBlock.Picture>()
                .firstOrNull { it.pictureType == FlacMetadataBlock.Picture.TYPE_FRONT_COVER }
                ?.let { pic ->
                    log.debug { "Serving embedded PICTURE from: $trackPath" }
                    val lastModified = readLastModified(trackPath)
                    CoverArtResult(
                        bytes = pic.data.toByteArray(),
                        mimeType = pic.mimeType.ifBlank { fallbackMime },
                        lastModified = lastModified,
                    )
                }
        } catch (ex: Exception) {
            log.warn(ex) { "Failed to read PICTURE block from: $trackPath" }
            null
        }

    private fun validateWithinLibraryRoot(albumDir: Path) {
        val normalized = albumDir.normalize()
        if (!normalized.startsWith(normalizedRoot)) {
            log.warn { "Path traversal attempt: albumDir=$albumDir libraryRoot=$normalizedRoot" }
            throw SecurityException("Album directory is outside the library root")
        }
    }
}

/** Resolved cover art bytes with MIME type and optional last-modified timestamp. */
data class CoverArtResult(
    val bytes: ByteArray,
    val mimeType: String,
    /** Last-modified time of the source file, used for conditional HTTP caching. */
    val lastModified: Instant? = null,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is CoverArtResult) return false
        return mimeType == other.mimeType && lastModified == other.lastModified && bytes.contentEquals(other.bytes)
    }

    override fun hashCode(): Int {
        val mimeHash = mimeType.hashCode()
        val lastModHash = lastModified?.hashCode() ?: 0
        return 31 * (31 * mimeHash + lastModHash) + bytes.contentHashCode()
    }
}
