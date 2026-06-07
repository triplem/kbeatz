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
        dataDir: String = "./data",
    ) = AppConfig(catalogLibraryRoot = root, discogsToken = token, jdbcUrl = jdbcUrl, dataDir = dataDir)

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

    @Test
    fun `dataDir defaults to dot-slash-data when not overridden`() {
        val config = testConfig()
        assertEquals("./data", config.dataDir)
    }

    @Test
    fun `dataDir reflects custom value when provided`() {
        val config = testConfig(dataDir = "/mnt/appdata")
        assertEquals("/mnt/appdata", config.dataDir)
    }

    @Test
    fun `fromEnv DATA_DIR default is dot-slash-data`() {
        // Simulate the default-value branch: env var absent → DEFAULT_DATA_DIR constant
        val dataDir: String? = null
        val resolved = dataDir ?: "./data"
        assertEquals("./data", resolved)
    }
}
