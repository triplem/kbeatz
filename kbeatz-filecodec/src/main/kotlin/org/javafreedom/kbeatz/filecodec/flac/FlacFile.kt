package org.javafreedom.kbeatz.filecodec.flac

import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import kotlinx.io.readByteArray
import kotlinx.io.write

/**
 * High-level façade for reading and updating FLAC metadata on disk.
 *
 * Typical usage:
 * ```
 * val flac = FlacFile.read(Path("/music/album/track.flac"))
 * val updated = flac.updateVorbisComment { editor ->
 *     editor.set(VorbisCommentFields.ALBUM, "Kind of Blue")
 *         .set(VorbisCommentFields.ARTIST, "Miles Davis")
 * }
 * updated.writeTo(Path("/music/album/track.flac"))
 * ```
 */
class FlacFile private constructor(
    val metadataBlocks: List<FlacMetadataBlock>,
    val audioFrames: ByteArray,
) {

    companion object {
        fun read(path: Path): FlacFile {
            val data = SystemFileSystem.source(path).buffered().use { it.readByteArray() }
            val result = FlacReader().parse(data)
            return FlacFile(result.blocks, result.audioFrames)
        }
    }

    val vorbisComment: FlacMetadataBlock.VorbisComment?
        get() = metadataBlocks.filterIsInstance<FlacMetadataBlock.VorbisComment>().firstOrNull()

    val picture: FlacMetadataBlock.Picture?
        get() = metadataBlocks.filterIsInstance<FlacMetadataBlock.Picture>().firstOrNull()

    /** Returns a new [FlacFile] with the Vorbis Comment block replaced by [newComment]. */
    fun withVorbisComment(newComment: FlacMetadataBlock.VorbisComment): FlacFile {
        val updated = metadataBlocks
            .map { if (it is FlacMetadataBlock.VorbisComment) newComment else it }
            .let { blocks ->
                if (blocks.none { it is FlacMetadataBlock.VorbisComment }) blocks + newComment else blocks
            }
        return FlacFile(updated, audioFrames)
    }

    /** Returns a new [FlacFile] with a Vorbis Comment modified by [transform]. */
    fun updateVorbisComment(transform: (VorbisCommentEditor) -> VorbisCommentEditor): FlacFile {
        val current = vorbisComment ?: FlacMetadataBlock.VorbisComment("kbeatz", emptyList())
        val editor = VorbisCommentEditor(current.vendor, current.comments.toMutableList())
        return withVorbisComment(transform(editor).build())
    }

    /**
     * Writes this FLAC file to [path] atomically: serialises to a `.tmp` sibling first,
     * then moves it into place. The original file is never left in a corrupt state.
     */
    fun writeTo(path: Path) {
        val parent = checkNotNull(path.parent) { "FLAC path must have a parent directory: $path" }
        val tmp = Path(parent, "${path.name}.tmp")
        val bytes = FlacWriter().write(metadataBlocks, audioFrames)
        SystemFileSystem.sink(tmp).buffered().use { sink -> sink.write(bytes) }
        SystemFileSystem.atomicMove(tmp, path)
    }
}

/** Fluent builder for modifying Vorbis Comment fields. */
class VorbisCommentEditor(
    private val vendor: String,
    private val comments: MutableList<String>,
) {
    /** Replaces all values for [key] with [value]. */
    fun set(key: String, value: String): VorbisCommentEditor {
        val upper = key.uppercase()
        comments.removeAll { it.uppercase().startsWith("$upper=") }
        comments += "$upper=$value"
        return this
    }

    /** Adds [value] for [key] without removing existing values (e.g. multiple ARTIST tags). */
    fun add(key: String, value: String): VorbisCommentEditor {
        comments += "${key.uppercase()}=$value"
        return this
    }

    /** Removes all values for [key]. */
    fun remove(key: String): VorbisCommentEditor {
        val upper = key.uppercase()
        comments.removeAll { it.uppercase().startsWith("$upper=") }
        return this
    }

    fun build(): FlacMetadataBlock.VorbisComment =
        FlacMetadataBlock.VorbisComment(vendor, comments.toList())
}
