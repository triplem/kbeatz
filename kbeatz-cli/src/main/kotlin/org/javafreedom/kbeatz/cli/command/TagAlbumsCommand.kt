package org.javafreedom.kbeatz.cli.command

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.UsageError
import com.github.ajalt.clikt.parameters.arguments.argument
import com.github.ajalt.clikt.parameters.arguments.convert
import com.github.ajalt.clikt.parameters.arguments.multiple
import com.github.ajalt.clikt.parameters.options.convert
import com.github.ajalt.clikt.parameters.options.flag
import com.github.ajalt.clikt.parameters.options.option
import kotlinx.coroutines.runBlocking
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import org.javafreedom.kbeatz.cli.util.walkDirectories
import org.javafreedom.kbeatz.sources.discogs.DiscogsMetadataSource
import org.javafreedom.kbeatz.tagger.idfile.IdFileReader
import org.javafreedom.kbeatz.tagger.idfile.SourceConfig
import org.javafreedom.kbeatz.tagger.service.DefaultTaggerService
import org.javafreedom.kbeatz.tagger.service.TagResult
import org.javafreedom.kbeatz.tagger.service.TaggerService

/**
 * Tags one or more album directories from Discogs metadata.
 *
 * Usage:
 *   kbeatz-tagger tag /music/Artist/Album1 /music/Artist/Album2
 *   kbeatz-tagger tag --library /music --recursive
 */
class TagAlbumsCommand(
    private val taggerServiceOverride: TaggerService? = null,
) : CliktCommand(
    name = "tag",
    help = "Fetch Discogs metadata and write FLAC tags for the given album directories.",
) {
    private val albumDirs: List<Path> by argument(
        name = "ALBUM_DIR",
        help = "Album directories to tag. Ignored when --library is given.",
    ).convert { it.toKtxPath() }.multiple()

    private val libraryRoot: Path? by option(
        "--library", "-l",
        help = "Root of the music library. Scans up to 3 levels deep (<Genre>/<Artist>/<Album>).",
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
        help = "Download and embed cover art. Default off — preserves the Discogs image quota.",
    ).flag()

    override fun run() {
        val idReader = IdFileReader(SourceConfig())
        val targets = resolveTargets()
        if (targets.isEmpty()) {
            echo("No album directories found.", err = true)
            return
        }
        targets.forEach { dir -> tagAlbum(dir, idReader) }
    }

    private fun tagAlbum(dir: Path, idReader: IdFileReader) {
        val idFile = idReader.read(dir)
        if (idFile == null) {
            echo("SKIP  $dir — no id.txt / local_ids.txt / metadata.yml found", err = true)
            return
        }
        val discogsId = idReader.discogsId(idFile)
        if (discogsId == null) {
            echo("SKIP  $dir — no discogs_id in id file", err = true)
            return
        }
        if (dryRun) {
            echo("DRY   $dir → discogs_id=$discogsId")
        } else {
            val service = taggerServiceOverride ?: buildService(idReader)
            runBlocking {
                when (val result = service.tagAlbum(dir, downloadImages)) {
                    is TagResult.Tagged -> echo("TAGGED $dir — ${result.filesWritten} FLAC files written")
                    is TagResult.Skipped -> echo("SKIP   $dir — ${result.reason}", err = true)
                    is TagResult.Failed -> echo("ERROR  $dir — ${result.cause.message}", err = true)
                }
            }
        }
    }

    private fun buildService(idReader: IdFileReader): TaggerService {
        val token = System.getenv("DISCOGS_TOKEN")
            ?: throw UsageError("DISCOGS_TOKEN environment variable must be set for tagging")
        return DefaultTaggerService(idReader, DiscogsMetadataSource(token))
    }

    private fun resolveTargets(): List<Path> {
        val root = libraryRoot
        return if (root != null) {
            walkDirectories(root, if (recursive) Int.MAX_VALUE else DEFAULT_LIBRARY_SCAN_DEPTH)
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

// Matches the documented 3-level library layout: <Genre>/<AlbumArtist>/<AlbumTitle>
private const val DEFAULT_LIBRARY_SCAN_DEPTH = 3

private fun String.toKtxPath(): Path = Path(this).also {
    require(SystemFileSystem.exists(it)) { "Path does not exist: $this" }
}
