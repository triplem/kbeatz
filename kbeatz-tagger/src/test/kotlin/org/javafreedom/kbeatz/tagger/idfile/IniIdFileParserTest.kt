package org.javafreedom.kbeatz.tagger.idfile

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class IniIdFileParserTest {

    private val parser = IniIdFileParser()

    // -------------------------------------------------------------------------
    // Happy-path parsing
    // -------------------------------------------------------------------------

    @Test
    fun `should parse discogs_id from source section`() {
        val result = parser.parse("[source]\ndiscogs_id = 1234567")
        assertNotNull(result)
        assertEquals("1234567", result.sources["discogs_id"])
    }

    @Test
    fun `should parse multiple keys from source section`() {
        val result = parser.parse("[source]\ndiscogs_id=111\namg_id=222\n")
        assertNotNull(result)
        assertEquals("111", result.sources["discogs_id"])
        assertEquals("222", result.sources["amg_id"])
    }

    @Test
    fun `should trim whitespace around key and value`() {
        val result = parser.parse("[source]\n  discogs_id  =  9999  \n")
        assertNotNull(result)
        assertEquals("9999", result.sources["discogs_id"])
    }

    // -------------------------------------------------------------------------
    // Comment handling
    // -------------------------------------------------------------------------

    @Test
    fun `should ignore hash comment lines`() {
        val input = "# a comment\n[source]\n# another comment\ndiscogs_id=99999\n"
        val result = parser.parse(input)
        assertNotNull(result)
        assertEquals("99999", result.sources["discogs_id"])
    }

    @Test
    fun `should ignore semicolon comment lines`() {
        val input = "; a comment\n[source]\n; another comment\ndiscogs_id=77777\n"
        val result = parser.parse(input)
        assertNotNull(result)
        assertEquals("77777", result.sources["discogs_id"])
    }

    @Test
    fun `should ignore blank lines`() {
        val input = "\n[source]\n\ndiscogs_id=55555\n\n"
        val result = parser.parse(input)
        assertNotNull(result)
        assertEquals("55555", result.sources["discogs_id"])
    }

    // -------------------------------------------------------------------------
    // Section filtering
    // -------------------------------------------------------------------------

    @Test
    fun `should read only source section when multiple sections present`() {
        val input = "[other]\ndiscogs_id=WRONG\n[source]\ndiscogs_id=CORRECT\n"
        val result = parser.parse(input)
        assertNotNull(result)
        assertEquals("CORRECT", result.sources["discogs_id"])
    }

    @Test
    fun `should not include keys from other sections`() {
        val input = "[meta]\nartist=Ignored\n[source]\ndiscogs_id=12345\n"
        val result = parser.parse(input)
        assertNotNull(result)
        assertEquals(mapOf("discogs_id" to "12345"), result.sources)
    }

    @Test
    fun `should be case insensitive for section name`() {
        val input = "[Source]\ndiscogs_id=88888\n"
        val result = parser.parse(input)
        assertNotNull(result)
        assertEquals("88888", result.sources["discogs_id"])
    }

    // -------------------------------------------------------------------------
    // Null-return cases
    // -------------------------------------------------------------------------

    @Test
    fun `should return null when source section has no discogs_id key`() {
        val result = parser.parse("[source]\namg_id=99\n")
        assertNull(result)
    }

    @Test
    fun `should return null when source section is absent`() {
        val result = parser.parse("[other]\ndiscogs_id=1234\n")
        assertNull(result)
    }

    @Test
    fun `should return null for empty input`() {
        val result = parser.parse("")
        assertNull(result)
    }

    @Test
    fun `should return null when discogs_id value is blank`() {
        val result = parser.parse("[source]\ndiscogs_id=\n")
        assertNull(result)
    }

    // -------------------------------------------------------------------------
    // Malformed lines
    // -------------------------------------------------------------------------

    @Test
    fun `should skip malformed lines without equals sign`() {
        val input = "[source]\nthis is not valid\ndiscogs_id=123\n"
        val result = parser.parse(input)
        assertNotNull(result)
        assertEquals("123", result.sources["discogs_id"])
    }

    @Test
    fun `should skip lines where key part is empty`() {
        val input = "[source]\n=nokey\ndiscogs_id=456\n"
        val result = parser.parse(input)
        assertNotNull(result)
        assertEquals("456", result.sources["discogs_id"])
    }
}
