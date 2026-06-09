package org.javafreedom.kbeatz.cli.command

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.ProgramResult
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
        help = "Download and embed cover art. Default off - preserves the Discogs image quota.",
    ).flag()

    override fun run() {
        // Use extended SourceConfig: metadata.yml first (canonical), then INI variants
        val sourceConfig = SourceConfig(
            idFileNames = USABLE_ID_FILE_NAMES,
        )
        val idReader = IdFileReader(sourceConfig)
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
        // noIdFileDirs collects directories with no usable id file so they can be summarised
        // at the end. Each entry also produces TagOutcome.ERROR so it is counted in `errors`
        // and feeds into resolveExitCode. The two counters are intentionally linked.
        val noIdFileDirs = mutableListOf<Pair<Path, String>>()

        targets.forEachIndexed { idx, dir ->
            if (libraryRoot != null) {
                echo("Tagging [${idx + 1}/$total]: $dir")
                logger.info { "tagging idx=${idx + 1} total=$total dir=$dir" }
            }
            val outcome = tagAlbum(dir, idReader, lazyService, noIdFileDirs)
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
        if (noIdFileDirs.isNotEmpty()) {
            echo("${noIdFileDirs.size} album(s) skipped - no usable id file:", err = true)
            noIdFileDirs.forEach { (dir, reason) ->
                echo("  $dir ($reason)", err = true)
            }
            logger.warn { "no-id-file-skipped count=${noIdFileDirs.size}" }
        }
        resolveExitCode(isBatchMode = libraryRoot != null, tagged = tagged, errors = errors)
    }

    /**
     * Resolves and throws the appropriate [ProgramResult] exit code when the run is not fully
     * successful. Batch mode distinguishes a partial failure (exit 3) from a total failure
     * (exit 1). Single-target mode uses exit 1 for any error.
     *
     * This function only throws when the exit code is non-zero; a clean run returns normally
     * (Clikt then exits with 0).
     */
    internal fun resolveExitCode(isBatchMode: Boolean, tagged: Int, errors: Int) {
        if (errors == 0) return
        val code = when {
            isBatchMode && tagged > 0 -> ExitCodes.PARTIAL_FAILURE
            else -> ExitCodes.FAILURE
        }
        throw ProgramResult(code)
    }

    private fun tagAlbum(
        dir: Path,
        idReader: IdFileReader,
        lazyService: Lazy<TaggerService>,
        noIdFileDirs: MutableList<Pair<Path, String>>,
    ): TagOutcome {
        val idFileStatus = detectIdFileStatus(dir)
        return when (idFileStatus) {
            IdFileStatus.MbIdOnly -> {
                val msg = "Unsupported id file $MB_ID_FILE in $dir (MusicBrainz support is not yet available)"
                echo(msg, err = true)
                logger.warn { "SKIP  dir=$dir reason=mb_id.txt only - MusicBrainz not yet supported" }
                noIdFileDirs.add(dir to "unsupported: $MB_ID_FILE")
                TagOutcome.ERROR
            }
            IdFileStatus.Missing -> {
                val msg = "No id file found in $dir (expected metadata.yml, id.txt, discogs_id.txt, or multiple_id.txt)"
                echo(msg, err = true)
                logger.warn { "SKIP  dir=$dir reason=no id file found" }
                noIdFileDirs.add(dir to "no id file")
                TagOutcome.ERROR
            }
            IdFileStatus.Present -> tagWithIdFile(dir, idReader, lazyService)
        }
    }

    private fun tagWithIdFile(
        dir: Path,
        idReader: IdFileReader,
        lazyService: Lazy<TaggerService>,
    ): TagOutcome {
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
                echo("DRY   $dir -> discogs_id=$discogsId")
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
                    echo("ERROR  $dir - ${result.cause.message ?: "unknown error"}", err = true)
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
            // Include directories that have an id file (any format including mb_id.txt) OR
            // that are leaf directories (no subdirectories) so that albums with no id file
            // at all receive an actionable error message rather than being silently omitted.
            walkDirectories(root, scanDepth)
                .filter { hasAnyIdFile(it) || isLeafDirectory(it) }
                .toList()
        } else {
            albumDirs.filter { SystemFileSystem.metadataOrNull(it)?.isDirectory == true }
        }
    }

    /**
     * Returns true if the directory contains any recognised id file, including unsupported
     * formats such as [MB_ID_FILE]. This ensures that directories with only mb_id.txt are
     * included in the scan so they receive an actionable error message.
     */
    private fun hasAnyIdFile(dir: Path): Boolean =
        (USABLE_ID_FILE_NAMES + MB_ID_FILE)
            .any { SystemFileSystem.exists(Path(dir, it)) }

    /**
     * Returns true if the directory has no subdirectories - i.e., it is a leaf node.
     * Leaf directories are included even when they contain no id files so that albums
     * with FLAC files but a missing id file receive an error rather than a silent skip.
     *
     * Known limitation: an intermediate directory (e.g. an empty Artist/ directory) that
     * contains no subdirectories at scan time is also treated as a leaf and will be
     * reported as "no id file". This is an edge case in partial or empty library trees.
     *
     * If listing the directory fails due to a permissions error, the directory is treated
     * as a leaf (conservative: it will be included and reported via an error message).
     */
    private fun isLeafDirectory(dir: Path): Boolean =
        runCatching { SystemFileSystem.list(dir) }
            .onFailure { logger.warn(it) { "cannot list dir=$dir - treating as leaf" } }
            .getOrElse { emptyList() }
            .none { SystemFileSystem.metadataOrNull(it)?.isDirectory == true }
}

/**
 * Describes the id-file state of a directory as seen by the tag command.
 */
internal enum class IdFileStatus {
    /** A usable Discogs id file was found (metadata.yml, id.txt, discogs_id.txt, or multiple_id.txt). */
    Present,

    /** Only mb_id.txt is present; MusicBrainz support is not available in v1. */
    MbIdOnly,

    /** No recognised id file exists in the directory. */
    Missing,
}

/**
 * Detects the id-file status for a directory without reading file contents.
 *
 * Checks for usable Discogs formats first, then falls back to detecting the unsupported
 * mb_id.txt, and finally reports Missing.
 */
internal fun detectIdFileStatus(dir: Path): IdFileStatus =
    when {
        USABLE_ID_FILE_NAMES.any { SystemFileSystem.exists(Path(dir, it)) } -> IdFileStatus.Present
        SystemFileSystem.exists(Path(dir, MB_ID_FILE)) -> IdFileStatus.MbIdOnly
        else -> IdFileStatus.Missing
    }

// Matches the documented 3-level library layout: <Genre>/<AlbumArtist>/<AlbumTitle>
private const val DEFAULT_LIBRARY_SCAN_DEPTH = 3

// Sentinel value used by --recursive flag
private const val INT_MAX_DEPTH = Int.MAX_VALUE

/** MusicBrainz id file - detected but not processed in v1. */
internal const val MB_ID_FILE = "mb_id.txt"

/**
 * All id-file formats that the tagger can actually process, in priority order.
 * metadata.yml is checked first (canonical format), followed by INI variants.
 */
internal val USABLE_ID_FILE_NAMES = listOf(
    "metadata.yml",
    "id.txt",
    "local_ids.txt",
    "discogs_id.txt",
    "multiple_id.txt",
)

private enum class TagOutcome { TAGGED, SKIPPED, ERROR }

private fun String.toKtxPath(): Path = Path(this).also {
    require(SystemFileSystem.exists(it)) { "Path does not exist: $this" }
}
