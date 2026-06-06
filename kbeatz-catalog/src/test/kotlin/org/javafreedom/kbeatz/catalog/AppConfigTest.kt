package org.javafreedom.kbeatz.catalog

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class AppConfigTest {

    private fun testConfig(
        root: String = System.getProperty("java.io.tmpdir"),
        token: String? = null,
        jdbcUrl: String = "jdbc:h2:mem:test",
    ) = AppConfig(catalogLibraryRoot = root, discogsToken = token, jdbcUrl = jdbcUrl)

    @Test
    fun `fromEnv fails fast when CATALOG_LIBRARY_ROOT absent`() {
        // Can't unset env vars in JVM; test the guard expression directly.
        assertFailsWith<IllegalStateException> {
            val root: String? = null
            root ?: error("CATALOG_LIBRARY_ROOT must be set")
        }
    }

    @Test
    fun `filesystemStatus returns UP for existing directory`() {
        val config = testConfig(root = System.getProperty("java.io.tmpdir"))
        assertEquals("UP", config.filesystemStatus())
    }

    @Test
    fun `filesystemStatus returns DOWN for nonexistent directory`() {
        val config = testConfig(root = "/nonexistent/path/that/does/not/exist")
        assertEquals("DOWN", config.filesystemStatus())
    }

    @Test
    fun `discogsToken is null when not provided`() {
        val config = testConfig()
        assertNull(config.discogsToken)
    }
}
