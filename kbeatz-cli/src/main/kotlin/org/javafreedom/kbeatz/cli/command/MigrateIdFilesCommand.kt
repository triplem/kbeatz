package org.javafreedom.kbeatz.cli.command

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.arguments.argument
import com.github.ajalt.clikt.parameters.arguments.convert
import com.github.ajalt.clikt.parameters.options.flag
import com.github.ajalt.clikt.parameters.options.option
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.io.buffered
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import kotlinx.io.writeString
import org.javafreedom.kbeatz.cli.util.walkDirectories
import org.javafreedom.kbeatz.tagger.idfile.IdFile
import org.javafreedom.kbeatz.tagger.idfile.IdFileReader
import org.javafreedom.kbeatz.tagger.idfile.SourceConfig

/**
 * Migrates INI-style id.txt / local_ids.txt files to YAML (metadata.yml).
 *
 * Usage:
 *   kbeatz-tagger migrate-ids /music --recursive --dry-run
 */
class MigrateIdFilesCommand : CliktCommand(
    name = "migrate-ids",
) {
    override fun help(context: Context) =
        "Convert INI-style id.txt / local_ids.txt files to YAML metadata.yml."

    private val logger = KotlinLogging.logger {}

    private val rootDir: Path by argument(
        name = "ROOT_DIR",
        help = "Root directory to scan for id files.",
    ).convert {
        Path(it).also { p -> require(SystemFileSystem.exists(p)) { "Path does not exist: $it" } }
    }

    private val recursive: Boolean by option(
        "--recursive", "-r",
        help = "Recurse into subdirectories. Default scans up to 3 levels deep (<Genre>/<Artist>/<Album>).",
    ).flag()

    private val dryRun: Boolean by option(
        "--dry-run", "-n",
        help = "Print what would be migrated without writing any files.",
    ).flag()

    private val keepOriginal: Boolean by option(
        "--keep-original",
        help = "Keep the original id.txt / local_ids.txt after migration.",
    ).flag()

    override fun run() {
        val idReader = IdFileReader(SourceConfig())
        val depth = if (recursive) Int.MAX_VALUE else DEFAULT_LIBRARY_SCAN_DEPTH
        var migrated = 0
        var skipped = 0
        var errors = 0

        walkDirectories(rootDir, depth).forEach { dir ->
            val outcome = migrateDirectory(dir, idReader)
            when (outcome) {
                MigrateOutcome.MIGRATED -> migrated++
                MigrateOutcome.SKIPPED -> skipped++
                MigrateOutcome.ERROR -> errors++
                MigrateOutcome.NO_ID_FILE -> { /* nothing to count */ }
            }
        }

        echo("Migrated $migrated files, $skipped skipped, $errors errors")
        logger.info { "migrate-ids complete: migrated=$migrated skipped=$skipped errors=$errors" }
        resolveExitCode(migrated = migrated, errors = errors)
    }

    /**
     * Resolves and throws the appropriate [ProgramResult] exit code when the run is not fully
     * successful. Distinguishes a partial failure (exit 3, some succeeded) from a total failure
     * (exit 1, none succeeded or unreadable directory).
     *
     * This function only throws when the exit code is non-zero; a clean run returns normally
     * (Clikt then exits with 0).
     */
    internal fun resolveExitCode(migrated: Int, errors: Int) {
        if (errors == 0) return
        val code = when {
            migrated > 0 -> ExitCodes.PARTIAL_FAILURE
            else -> ExitCodes.FAILURE
        }
        throw ProgramResult(code)
    }

    private fun migrateDirectory(dir: Path, idReader: IdFileReader): MigrateOutcome {
        val hasLegacy = LEGACY_NAMES.any { SystemFileSystem.exists(Path(dir, it)) }
        return when {
            !hasLegacy -> MigrateOutcome.NO_ID_FILE
            SystemFileSystem.exists(Path(dir, "metadata.yml")) -> {
                echo("SKIP  $dir - metadata.yml already exists")
                logger.info { "SKIP  dir=$dir reason=metadata.yml already exists" }
                MigrateOutcome.SKIPPED
            }
            else -> migrateWithIdFile(dir, idReader)
        }
    }

    private fun migrateWithIdFile(dir: Path, idReader: IdFileReader): MigrateOutcome =
        runCatching { idReader.read(dir) }
            .getOrElse { e ->
                echo("ERROR $dir - ${e.message ?: "unknown error"}", err = true)
                logger.error(e) { "ERROR dir=$dir" }
                return MigrateOutcome.ERROR
            }
            ?.let { idFile -> performMigration(dir, idFile, Path(dir, "metadata.yml")) }
            ?: run {
                echo("SKIP  $dir - no parseable id file found")
                logger.info { "SKIP  dir=$dir reason=no parseable id file found" }
                MigrateOutcome.SKIPPED
            }

    private fun performMigration(dir: Path, idFile: IdFile, target: Path): MigrateOutcome {
        val yamlContent = buildYaml(idFile.sources)
        return if (dryRun) {
            echo("DRY   $target:\n$yamlContent")
            MigrateOutcome.MIGRATED
        } else {
            SystemFileSystem.sink(target).buffered().use { it.writeString(yamlContent) }
            echo("WROTE $target")
            logger.info { "WROTE path=$target" }
            if (!keepOriginal) deleteOriginalIdFiles(dir)
            MigrateOutcome.MIGRATED
        }
    }

    private fun deleteOriginalIdFiles(dir: Path) {
        LEGACY_NAMES
            .map { Path(dir, it) }
            .filter { SystemFileSystem.exists(it) }
            .forEach { path ->
                SystemFileSystem.delete(path)
                echo("DEL   $path")
                logger.info { "DEL   path=$path" }
            }
    }

    private fun buildYaml(sources: Map<String, String>): String =
        buildString {
            appendLine("sources:")
            sources.forEach { (key, value) -> appendLine("  $key: \"$value\"") }
        }
}

private val LEGACY_NAMES = listOf("id.txt", "local_ids.txt")

// Matches the documented 3-level library layout: <Genre>/<AlbumArtist>/<AlbumTitle>
private const val DEFAULT_LIBRARY_SCAN_DEPTH = 3

private enum class MigrateOutcome { MIGRATED, SKIPPED, ERROR, NO_ID_FILE }
