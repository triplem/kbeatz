package org.javafreedom.kbeatz.catalog.domain.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import org.javafreedom.kbeatz.common.BusinessValidationException

class DirectoryTemplateTest {

    @Test
    fun `should substitute supported tokens when rendering`() {
        val template = DirectoryTemplate("\${ALBUMARTIST}/\${ALBUM} (\${DATE})")
        val rendered = template.render(
            mapOf(
                "ALBUMARTIST" to "Miles Davis",
                "ALBUM" to "Kind of Blue",
                "DATE" to "1959",
            )
        )
        assertEquals("Miles Davis/Kind of Blue (1959)", rendered)
    }

    @Test
    fun `should render supported but missing token as empty string`() {
        val template = DirectoryTemplate("\${ALBUMARTIST}/\${ALBUM} (\${DATE})")
        val rendered = template.render(
            mapOf(
                "ALBUMARTIST" to "Bill Evans",
                "ALBUM" to "Waltz for Debby",
            )
        )
        assertEquals("Bill Evans/Waltz for Debby ()", rendered)
    }

    @Test
    fun `should render multi-segment template with several tokens`() {
        val template = DirectoryTemplate("\${GENRE}/\${LABEL}/\${ALBUM}")
        val rendered = template.render(
            mapOf(
                "GENRE" to "Jazz",
                "LABEL" to "Blue Note",
                "ALBUM" to "Cool Struttin'",
            )
        )
        assertEquals("Jazz/Blue Note/Cool Struttin'", rendered)
    }

    @Test
    fun `should throw BusinessValidationException when template contains unknown token`() {
        assertFailsWith<BusinessValidationException> {
            DirectoryTemplate("\${ALBUMARTIST}/\${BOGUS}")
        }
    }

    @Test
    fun `should throw BusinessValidationException when template is blank`() {
        assertFailsWith<BusinessValidationException> {
            DirectoryTemplate("   ")
        }
    }

    @Test
    fun `should expose all album-derived supported tokens`() {
        val expected = setOf(
            "ALBUMARTIST", "ALBUM", "DATE", "YEAR", "GENRE", "LABEL",
            "CATALOGNUMBER", "COMPOSER", "CONDUCTOR", "ENSEMBLE", "COUNTRY", "MEDIAFORMAT",
        )
        assertEquals(expected, DirectoryTemplate.SUPPORTED_TOKENS)
    }
}
