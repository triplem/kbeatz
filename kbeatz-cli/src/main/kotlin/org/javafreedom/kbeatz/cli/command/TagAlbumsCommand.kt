package org.javafreedom.kbeatz.cli.command

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.parameters.arguments.argument
import com.github.ajalt.clikt.parameters.arguments.convert
import com.github.ajalt.clikt.parameters.arguments.multiple
import com.github.ajalt.clikt.parameters.options.convert
import com.github.ajalt.clikt.parameters.options.flag
import com.github.ajalt.clikt.parameters.options.option
import kotlinx.io.buffered
import kotlinx.io.files.FileMetadata
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import org.javafreedom.kbeatz.tagger.idfile.IdFileReader
import org.javafreedom.kbeatz.tagger.idfile.SourceConfig

/**
 * Tags one or more album directories from Discogs metadata.
 *
 * Usage:
 *   kbeatz-tagger tag /music/Artist/Album1 /music/Artist/Album2
 *   kbeatz-tagger tag --library /music --recursive
 */
class TagAlbumsCommand : CliktCommand(
    name = "tag",
    help = "Fetch Discogs metadata and write FLAC tags for the given album directories.",
) {
    private val albumDirs: List<Path> by argument(
        name = "ALBUM_DIR",
        help = "Album directories to tag. Ignored when --library is given.",
    ).convert { it.toKtxPath() }.multiple()

    private val libraryRoot: Path? by option(
        "--library", "-l",
        help = "Root of the music library. Scans for album directories.",
    ).convert { it.toKtxPath() }

    private val recursive: Boolean by option(
        "--recursive", "-r",
        help = "Recursively scan --library for album directories containing id files.",
    ).flag()

    private val dryRun: Boolean by option(
        "--dry-run", "-n",
        help = "Print what would be tagged without writing any files.",
    ).flag()

    private val downloadImages: Boolean by option(
        "--download-images",
        help = "Download and embed cover art. Default off — preserves the Discogs 1 000/day image quota.",
    ).flag()

    override fun run() {
        val idReader = IdFileReader(SourceConfig())
        val targets = resolveTargets()
        if (targets.isEmpty()) {
            echo("No album directories found.", err = true)
            return
        }
        for (dir in targets) {
            val idFile = idReader.read(dir)
            if (idFile == null) {
                echo("SKIP  $dir — no id.txt / local_ids.txt / metadata.yml found", err = true)
                continue
            }
            val discogsId = idReader.discogsId(idFile)
            if (discogsId == null) {
                echo("SKIP  $dir — no discogs_id in id file", err = true)
                continue
            }
            if (dryRun) {
                echo("DRY   $dir → discogs_id=$discogsId")
            } else {
                // TODO(#TBD): inject TaggerService and delegate
                echo("TODO  $dir → discogs_id=$discogsId (tagging not yet implemented)")
            }
        }
    }

    private fun resolveTargets(): List<Path> {
        val root = libraryRoot
        return if (root != null) {
            walkDirectories(root, if (recursive) Int.MAX_VALUE else 1)
                .filter { hasIdFile(it) }
                .toList()
        } else {
            albumDirs.filter { SystemFileSystem.metadataOrNull(it)?.isDirectory == true }
        }
    }

    private fun hasIdFile(dir: Path): Boolean =
        listOf("id.txt", "local_ids.txt", "metadata.yml")
            .any { SystemFileSystem.exists(Path(dir, it)) }
}

private fun String.toKtxPath(): Path = Path(this).also {
    require(SystemFileSystem.exists(it)) { "Path does not exist: $this" }
}

private fun walkDirectories(root: Path, maxDepth: Int): Sequence<Path> = sequence {
    if (maxDepth <= 0) return@sequence
    val children = runCatching { SystemFileSystem.list(root) }.getOrElse { emptyList() }
    for (child in children) {
        val meta: FileMetadata = SystemFileSystem.metadataOrNull(child) ?: continue
        if (meta.isDirectory) {
            yield(child)
            yieldAll(walkDirectories(child, maxDepth - 1))
        }
    }
}
