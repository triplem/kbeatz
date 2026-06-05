package org.javafreedom.kbeatz.tagger.idfile

import com.charleskorn.kaml.Yaml
import com.charleskorn.kaml.YamlConfiguration
import kotlinx.io.buffered
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import kotlinx.io.readByteArray
import kotlinx.serialization.Serializable

/**
 * Represents an album's source ID file.
 *
 * Supported read formats:
 *   - INI-style `id.txt` / `local_ids.txt`  (e.g. `[source]\ndiscogs_id=12345678`)
 *   - YAML `metadata.yml`  (e.g. `sources:\n  discogs_id: "12345678"`)
 *
 * Write format: YAML (`metadata.yml`).
 */
data class IdFile(
    val sources: Map<String, String>,   // tag-field-name → value, e.g. "discogs_id" → "12345678"
)

data class SourceConfig(
    val mappings: Map<String, String> = mapOf(
        "discogs" to "discogs_id",
        "amg" to "amg_id",
        "local" to "discogs_id",
    ),
    val idFileNames: List<String> = listOf("id.txt", "local_ids.txt", "metadata.yml"),
)

/**
 * Reads album identity files in both INI and YAML formats.
 * Dispatches by file extension: `.yml` / `.yaml` → YAML parser; everything else → INI parser.
 */
class IdFileReader(private val config: SourceConfig = SourceConfig()) {

    fun read(directory: Path): IdFile? {
        val file = config.idFileNames
            .map { Path(directory, it) }
            .firstOrNull { SystemFileSystem.exists(it) }
            ?: return null
        return readFile(file)
    }

    private fun readFile(file: Path): IdFile {
        val text = SystemFileSystem.source(file).buffered().use { it.readByteArray().decodeToString() }
        return when {
            file.name.endsWith(".yml") || file.name.endsWith(".yaml") -> parseYaml(text)
            else -> IdFile(parseIni(text))
        }
    }

    fun discogsId(idFile: IdFile): String? =
        idFile.sources[config.mappings["discogs"] ?: "discogs_id"]
}

// ---------------------------------------------------------------------------
// YAML parsing (metadata.yml)
// ---------------------------------------------------------------------------

@Serializable
private data class MetadataYaml(
    val sources: Map<String, String> = emptyMap(),
)

private val yamlParser = Yaml(configuration = YamlConfiguration(strictMode = false))

private fun parseYaml(text: String): IdFile =
    IdFile(yamlParser.decodeFromString(MetadataYaml.serializer(), text).sources)

// ---------------------------------------------------------------------------
// INI parsing (id.txt / local_ids.txt)
// ---------------------------------------------------------------------------

/**
 * Minimal INI parser: reads `key=value` lines, ignores `[section]` headers and `#` comments.
 * Sufficient for discogstagger id files — no multi-line values, no unicode escapes needed.
 */
private fun parseIni(text: String): Map<String, String> =
    text.lines()
        .filterNot { line ->
            line.trimStart().let { it.startsWith("[") || it.startsWith("#") || it.isBlank() }
        }
        .mapNotNull { line ->
            val eq = line.indexOf('=').takeIf { it > 0 } ?: return@mapNotNull null
            line.substring(0, eq).trim() to line.substring(eq + 1).trim()
        }
        .filter { (_, v) -> v.isNotEmpty() }
        .toMap()
