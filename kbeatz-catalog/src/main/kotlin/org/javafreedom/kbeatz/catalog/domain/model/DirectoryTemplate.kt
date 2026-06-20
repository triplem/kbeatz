package org.javafreedom.kbeatz.catalog.domain.model

import org.javafreedom.kbeatz.common.BusinessValidationException

/**
 * A validated, configurable directory-structure template.
 *
 * The template uses metadata tokens of the form `${'$'}{TOKEN}` (e.g.
 * `${'$'}{ALBUMARTIST}/${'$'}{ALBUM} (${'$'}{DATE})`). The literal `/` in the template
 * is the path-segment separator and is preserved by callers; only token VALUES are
 * sanitised by the [DirectoryLayoutPlanner].
 *
 * This is a pure value object: it performs no filesystem I/O. It validates the raw
 * template at construction time and rejects unknown tokens and empty templates.
 *
 * @property raw The raw template string as supplied by configuration.
 */
@JvmInline
value class DirectoryTemplate(val raw: String) {

    init {
        if (raw.isBlank()) {
            throw BusinessValidationException("Directory template must not be blank")
        }
        val unknown = tokensIn(raw).filterNot { it in SUPPORTED_TOKENS }
        if (unknown.isNotEmpty()) {
            throw BusinessValidationException(
                "Directory template contains unknown tokens: ${unknown.sorted().joinToString(", ")}. " +
                    "Supported tokens: ${SUPPORTED_TOKENS.sorted().joinToString(", ")}"
            )
        }
    }

    /**
     * Renders the template by substituting each `${'$'}{TOKEN}` occurrence with its value
     * from [tokens]. A supported token that is absent from [tokens] renders as an empty
     * string. Any leftover sanitisation (collapsing `" ()"`, empty segments, etc.) is the
     * responsibility of the [DirectoryLayoutPlanner].
     *
     * @param tokens Map of token name to substitution value.
     * @return The rendered string with all token placeholders replaced.
     */
    fun render(tokens: Map<String, String>): String =
        TOKEN_REGEX.replace(raw) { match ->
            val name = match.groupValues[1]
            tokens[name].orEmpty()
        }

    companion object {
        /**
         * Token names supported in templates, derived from [Album] metadata fields.
         */
        val SUPPORTED_TOKENS: Set<String> = setOf(
            "ALBUMARTIST",
            "ALBUM",
            "DATE",
            "YEAR",
            "GENRE",
            "LABEL",
            "CATALOGNUMBER",
            "COMPOSER",
            "CONDUCTOR",
            "ENSEMBLE",
            "COUNTRY",
            "MEDIAFORMAT",
        )

        private val TOKEN_REGEX = Regex("""\$\{([A-Z]+)}""")

        private fun tokensIn(template: String): Set<String> =
            TOKEN_REGEX.findAll(template).map { it.groupValues[1] }.toSet()
    }
}
