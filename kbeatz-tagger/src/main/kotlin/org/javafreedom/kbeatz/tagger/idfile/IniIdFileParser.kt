package org.javafreedom.kbeatz.tagger.idfile

/**
 * Parses INI-style id.txt and local_ids.txt files used by discogstagger.
 *
 * Format rules:
 *   - Section headers are `[section-name]` lines — only the `[source]` section is used.
 *   - Key-value pairs are `key=value` lines (leading/trailing whitespace trimmed).
 *   - Comment lines start with `#` or `;` and are ignored.
 *   - Blank lines are ignored.
 *   - Key matching is case-insensitive.
 *
 * Returns `null` when:
 *   - The `[source]` section is absent.
 *   - The `[source]` section contains no `discogs_id` key (or the value is blank).
 */
class IniIdFileParser {

    /**
     * Parses [text] and returns an [IdFile] whose `sources` map contains every
     * key-value pair from the `[source]` section, or `null` when `discogs_id` is absent.
     */
    fun parse(text: String): IdFile? {
        val sources = parseSourceSection(text)
        return if (sources.keys.any { it.equals("discogs_id", ignoreCase = true) }) {
            IdFile(sources)
        } else {
            null
        }
    }

    private fun parseSourceSection(text: String): Map<String, String> {
        var inSourceSection = false
        val result = mutableMapOf<String, String>()
        text.lines().forEach { raw ->
            val line = raw.trim()
            when {
                isCommentOrBlank(line) -> { /* skip */ }
                isSectionHeader(line) -> inSourceSection = isSectionHeader(line, "source")
                inSourceSection -> parseKeyValue(line)?.let { (key, value) -> result[key] = value }
            }
        }
        return result
    }

    private fun isCommentOrBlank(line: String): Boolean =
        line.isBlank() || line.startsWith("#") || line.startsWith(";")

    private fun isSectionHeader(line: String): Boolean = line.startsWith("[")

    private fun isSectionHeader(line: String, name: String): Boolean =
        line.removePrefix("[").substringBefore("]").trim().equals(name, ignoreCase = true)

    private fun parseKeyValue(line: String): Pair<String, String>? {
        val eqIdx = line.indexOf('=').takeIf { it > 0 }
        return eqIdx?.let { idx ->
            val key = line.substring(0, idx).trim()
            val value = line.substring(idx + 1).trim()
            if (key.isNotEmpty() && value.isNotEmpty()) key to value else null
        }
    }
}
