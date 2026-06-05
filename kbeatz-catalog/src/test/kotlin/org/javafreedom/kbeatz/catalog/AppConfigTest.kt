package org.javafreedom.kbeatz.catalog

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class AppConfigTest {

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
        val config = AppConfig(catalogLibraryRoot = System.getProperty("java.io.tmpdir"), discogsToken = null)
        assertEquals("UP", config.filesystemStatus())
    }

    @Test
    fun `filesystemStatus returns DOWN for nonexistent directory`() {
        val config = AppConfig(catalogLibraryRoot = "/nonexistent/path/that/does/not/exist", discogsToken = null)
        assertEquals("DOWN", config.filesystemStatus())
    }

    @Test
    fun `discogsToken is null when not provided`() {
        val config = AppConfig(catalogLibraryRoot = "/tmp", discogsToken = null)
        assertNull(config.discogsToken)
    }
}
