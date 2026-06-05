package org.javafreedom.kbeatz.cli.command

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.parameters.arguments.argument
import com.github.ajalt.clikt.parameters.options.flag
import com.github.ajalt.clikt.parameters.options.option
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import kotlinx.io.writeString
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

        walkDirectories(rootDir, depth).forEach { dir ->
            val idFile = idReader.read(dir) ?: return@forEach
            val yamlContent = buildYaml(idFile.sources)
            val target = Path(dir, "metadata.yml")
            if (dryRun) {
                echo("DRY   $target:\n$yamlContent")
            } else {
                SystemFileSystem.sink(target).buffered().use { it.writeString(yamlContent) }
                echo("WROTE $target")
                if (!keepOriginal) {
                    listOf("id.txt", "local_ids.txt")
                        .map { Path(dir, it) }
                        .filter { SystemFileSystem.exists(it) }
                        .forEach { path -> SystemFileSystem.delete(path); echo("DEL   $path") }
                }
            }
        }
    }

    private fun buildYaml(sources: Map<String, String>): String =
        buildString {
            appendLine("sources:")
            sources.forEach { (key, value) -> appendLine("  $key: \"$value\"") }
        }
}

// Matches the documented 3-level library layout: <Genre>/<AlbumArtist>/<AlbumTitle>
private const val DEFAULT_LIBRARY_SCAN_DEPTH = 3

private fun walkDirectories(root: Path, maxDepth: Int): Sequence<Path> = sequence {
    if (maxDepth <= 0) return@sequence
    val children = runCatching { SystemFileSystem.list(root) }.getOrElse { emptyList() }
    for (child in children) {
        if (SystemFileSystem.metadataOrNull(child)?.isDirectory == true) {
            yield(child)
            yieldAll(walkDirectories(child, maxDepth - 1))
        }
    }
}
