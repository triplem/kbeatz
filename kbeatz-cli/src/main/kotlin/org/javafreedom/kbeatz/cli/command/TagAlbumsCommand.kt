package org.javafreedom.kbeatz.cli.command

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.UsageError
import com.github.ajalt.clikt.parameters.arguments.argument
import com.github.ajalt.clikt.parameters.arguments.convert
import com.github.ajalt.clikt.parameters.arguments.multiple
import com.github.ajalt.clikt.parameters.options.convert
import com.github.ajalt.clikt.parameters.options.default
import com.github.ajalt.clikt.parameters.options.flag
import com.github.ajalt.clikt.parameters.options.option
import com.github.ajalt.clikt.parameters.types.int
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.runBlocking
import kotlinx.io.buffered
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import kotlinx.io.writeString
import org.javafreedom.kbeatz.cli.util.walkDirectories
import org.javafreedom.kbeatz.sources.discogs.DiscogsMetadataSource
import org.javafreedom.kbeatz.tagger.idfile.IdFile
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
 *   kbeatz-tagger tag --library /music --depth 3
 */
class TagAlbumsCommand(
    private val taggerServiceOverride: TaggerService? = null,
) : CliktCommand(
    name = "tag",
    help = "Fetch Discogs metadata and write FLAC tags for the given album directories.",
) {
    private val logger = KotlinLogging.logger {}

    private val albumDirs: List<Path> by argument(
        name = "ALBUM_DIR",
        help = "Album directories to tag. Ignored when --library is given.",
    ).convert { it.toKtxPath() }.multiple()

    private val libraryRoot: Path? by option(
        "--library", "-l",
        help = "Root of the music library. Walk up to --depth levels to find album directories.",
    ).convert { it.toKtxPath() }

    private val depth: Int by option(
        "--depth",
        help = "Maximum directory depth to scan under --library. Defaults to 3 (<Genre>/<Artist>/<Album>).",
    ).int().default(DEFAULT_LIBRARY_SCAN_DEPTH)

    private val recursive: Boolean by option(
        "--recursive", "-r",
        help = "Recursively scan --library without depth limit. Equivalent to --depth $INT_MAX_DEPTH.",
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
            echo("No album directories found.")
            logger.info { "tag: no album directories found" }
            return
        }
        val total = targets.size
        // Lazy: DISCOGS_TOKEN only required if tagging actually runs (not for skip/dry-run paths)
        val lazyService: Lazy<TaggerService> = lazy { taggerServiceOverride ?: buildService(idReader) }
        var tagged = 0
        var skipped = 0
        var errors = 0
        targets.forEachIndexed { idx, dir ->
            if (libraryRoot != null) {
                echo("Tagging [${idx + 1}/$total]: $dir")
                logger.info { "tagging idx=${idx + 1} total=$total dir=$dir" }
            }
            val outcome = tagAlbum(dir, idReader, lazyService)
            when (outcome) {
                TagOutcome.TAGGED -> tagged++
                TagOutcome.SKIPPED -> skipped++
                TagOutcome.ERROR -> errors++
            }
        }
        if (libraryRoot != null) {
            echo("Tagged $tagged albums, $skipped skipped, $errors errors")
            logger.info { "tag complete: tagged=$tagged skipped=$skipped errors=$errors" }
        }
    }

    private fun tagAlbum(dir: Path, idReader: IdFileReader, lazyService: Lazy<TaggerService>): TagOutcome {
        val idFile = idReader.read(dir)
        if (idFile == null) {
            echo("SKIP  $dir - no id file found")
            logger.info { "SKIP  dir=$dir reason=no id file found" }
            return TagOutcome.SKIPPED
        }
        val discogsId = idReader.discogsId(idFile)
        return when {
            discogsId == null -> {
                echo("SKIP  $dir - no discogs_id in id file")
                logger.info { "SKIP  dir=$dir reason=no discogs_id in id file" }
                TagOutcome.SKIPPED
            }
            dryRun -> {
                echo("DRY   $dir → discogs_id=$discogsId")
                TagOutcome.TAGGED
            }
            else -> tagWithService(dir, idFile, lazyService)
        }
    }

    private fun tagWithService(dir: Path, idFile: IdFile, lazyService: Lazy<TaggerService>): TagOutcome =
        runBlocking {
            when (val result = lazyService.value.tagAlbum(dir, downloadImages)) {
                is TagResult.Tagged -> {
                    echo("TAGGED $dir - ${result.filesWritten} FLAC files written")
                    logger.info { "TAGGED dir=$dir filesWritten=${result.filesWritten}" }
                    writeMetadataYmlIfLegacy(dir, idFile)
                    TagOutcome.TAGGED
                }
                is TagResult.Skipped -> {
                    echo("SKIP   $dir - ${result.reason}")
                    logger.info { "SKIP   dir=$dir reason=${result.reason}" }
                    TagOutcome.SKIPPED
                }
                is TagResult.Failed -> {
                    echo("ERROR  $dir")
                    logger.error(result.cause) { "ERROR  dir=$dir" }
                    TagOutcome.ERROR
                }
            }
        }

    /**
     * Writes metadata.yml when the source was a legacy INI file (id.txt or local_ids.txt),
     * normalising the directory for future runs.
     */
    private fun writeMetadataYmlIfLegacy(dir: Path, idFile: IdFile) {
        val legacyNames = listOf("id.txt", "local_ids.txt")
        val hasLegacy = legacyNames.any { SystemFileSystem.exists(Path(dir, it)) }
        if (hasLegacy && !SystemFileSystem.exists(Path(dir, "metadata.yml"))) {
            val yaml = buildYaml(idFile.sources)
            SystemFileSystem.sink(Path(dir, "metadata.yml")).buffered().use { it.writeString(yaml) }
            echo("WROTE $dir/metadata.yml")
            logger.info { "WROTE path=$dir/metadata.yml" }
        }
    }

    private fun buildYaml(sources: Map<String, String>): String =
        buildString {
            appendLine("sources:")
            sources.forEach { (key, value) -> appendLine("  $key: \"$value\"") }
        }

    private fun buildService(idReader: IdFileReader): TaggerService {
        val token = System.getenv("DISCOGS_TOKEN")
            ?: throw UsageError("DISCOGS_TOKEN environment variable must be set for tagging")
        return DefaultTaggerService(idReader, DiscogsMetadataSource(token))
    }

    private fun resolveTargets(): List<Path> {
        val root = libraryRoot
        return if (root != null) {
            val scanDepth = if (recursive) Int.MAX_VALUE else depth
            walkDirectories(root, scanDepth)
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

// Sentinel value used by --recursive flag
private const val INT_MAX_DEPTH = Int.MAX_VALUE

private enum class TagOutcome { TAGGED, SKIPPED, ERROR }

private fun String.toKtxPath(): Path = Path(this).also {
    require(SystemFileSystem.exists(it)) { "Path does not exist: $this" }
}
