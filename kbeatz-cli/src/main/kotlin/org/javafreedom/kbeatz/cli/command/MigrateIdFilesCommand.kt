package org.javafreedom.kbeatz.cli.command

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.parameters.arguments.argument
import com.github.ajalt.clikt.parameters.arguments.convert
import com.github.ajalt.clikt.parameters.options.flag
import com.github.ajalt.clikt.parameters.options.option
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
    help = "Convert INI-style id.txt / local_ids.txt files to YAML metadata.yml.",
) {
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
    }

    private fun migrateDirectory(dir: Path, idReader: IdFileReader): MigrateOutcome {
        val hasLegacy = LEGACY_NAMES.any { SystemFileSystem.exists(Path(dir, it)) }
        return when {
            !hasLegacy -> MigrateOutcome.NO_ID_FILE
            SystemFileSystem.exists(Path(dir, "metadata.yml")) -> {
                echo("SKIP  $dir — metadata.yml already exists", err = true)
                MigrateOutcome.SKIPPED
            }
            else -> migrateWithIdFile(dir, idReader)
        }
    }

    private fun migrateWithIdFile(dir: Path, idReader: IdFileReader): MigrateOutcome {
        val idFile = runCatching { idReader.read(dir) }.getOrElse { e ->
            echo("ERROR $dir — ${e.message ?: e.javaClass.simpleName}", err = true)
            return MigrateOutcome.ERROR
        }
        return if (idFile == null) {
            echo("SKIP  $dir — no parseable id file found", err = true)
            MigrateOutcome.SKIPPED
        } else {
            performMigration(dir, idFile, Path(dir, "metadata.yml"))
        }
    }

    private fun performMigration(dir: Path, idFile: IdFile, target: Path): MigrateOutcome {
        val yamlContent = buildYaml(idFile.sources)
        return if (dryRun) {
            echo("DRY   $target:\n$yamlContent")
            MigrateOutcome.MIGRATED
        } else {
            SystemFileSystem.sink(target).buffered().use { it.writeString(yamlContent) }
            echo("WROTE $target")
            if (!keepOriginal) deleteOriginalIdFiles(dir)
            MigrateOutcome.MIGRATED
        }
    }

    private fun deleteOriginalIdFiles(dir: Path) {
        LEGACY_NAMES
            .map { Path(dir, it) }
            .filter { SystemFileSystem.exists(it) }
            .forEach { path -> SystemFileSystem.delete(path); echo("DEL   $path") }
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
