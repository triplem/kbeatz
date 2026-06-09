package org.javafreedom.kbeatz.catalog

import com.typesafe.config.ConfigFactory
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class AppConfigTest {

    private fun testConfig(
        root: String = System.getProperty("java.io.tmpdir"),
        token: String? = null,
        jdbcUrl: String = "jdbc:h2:mem:test",
        dbUser: String = "sa",
        dbPassword: String = "",
        dataDir: String = "./data",
    ) = AppConfig(
        catalogLibraryRoot = root,
        discogsToken = token,
        jdbcUrl = jdbcUrl,
        dbUser = dbUser,
        dbPassword = dbPassword,
        dataDir = dataDir,
        repairTimeoutSeconds = 60L,
        scanParallelism = 4,
        discogsRateLimitPerMinute = 60,
        discogsImageDailyQuota = 1000,
    )

    // --- fromEnv() tests using injected env provider ---

    @Test
    fun `fromEnv fails fast when CATALOG_LIBRARY_ROOT absent`() {
        val env = mapOf<String, String>()
        assertFailsWith<IllegalStateException> {
            AppConfig.fromEnv { key -> env[key] }
        }
    }

    @Test
    fun `fromEnv reads DATA_DIR default when env var is absent`() {
        val env = mapOf("CATALOG_LIBRARY_ROOT" to System.getProperty("java.io.tmpdir"))
        val config = AppConfig.fromEnv { key -> env[key] }
        assertEquals("./data", config.dataDir)
    }

    @Test
    fun `fromEnv reads CATALOG_DATA_DIR from environment when set`() {
        val env = mapOf(
            "CATALOG_LIBRARY_ROOT" to System.getProperty("java.io.tmpdir"),
            "CATALOG_DATA_DIR" to "/mnt/appdata",
        )
        val config = AppConfig.fromEnv { key -> env[key] }
        assertEquals("/mnt/appdata", config.dataDir)
    }

    @Test
    fun `fromEnv reads DATA_DIR from environment when set`() {
        val env = mapOf(
            "CATALOG_LIBRARY_ROOT" to System.getProperty("java.io.tmpdir"),
            "DATA_DIR" to "/mnt/appdata",
        )
        val config = AppConfig.fromEnv { key -> env[key] }
        assertEquals("/mnt/appdata", config.dataDir)
    }

    @Test
    fun `fromEnv reads DISCOGS_TOKEN as null when absent`() {
        val env = mapOf("CATALOG_LIBRARY_ROOT" to System.getProperty("java.io.tmpdir"))
        val config = AppConfig.fromEnv { key -> env[key] }
        assertNull(config.discogsToken)
    }

    @Test
    fun `fromEnv reads DISCOGS_TOKEN when set`() {
        val env = mapOf(
            "CATALOG_LIBRARY_ROOT" to System.getProperty("java.io.tmpdir"),
            "DISCOGS_TOKEN" to "test-token",
        )
        val config = AppConfig.fromEnv { key -> env[key] }
        assertEquals("test-token", config.discogsToken)
    }

    @Test
    fun `fromEnv uses default JDBC URL when CATALOG_JDBC_URL is absent`() {
        val env = mapOf("CATALOG_LIBRARY_ROOT" to System.getProperty("java.io.tmpdir"))
        val config = AppConfig.fromEnv { key -> env[key] }
        assertEquals("jdbc:h2:file:./data/kbeatz;DB_CLOSE_DELAY=-1;MODE=PostgreSQL", config.jdbcUrl)
    }

    @Test
    fun `fromEnv reads CATALOG_JDBC_URL when set`() {
        val env = mapOf(
            "CATALOG_LIBRARY_ROOT" to System.getProperty("java.io.tmpdir"),
            "CATALOG_JDBC_URL" to "jdbc:postgresql://localhost:5432/kbeatz",
        )
        val config = AppConfig.fromEnv { key -> env[key] }
        assertEquals("jdbc:postgresql://localhost:5432/kbeatz", config.jdbcUrl)
    }

    @Test
    fun `fromEnv reads CATALOG_DB_USER when set`() {
        val env = mapOf(
            "CATALOG_LIBRARY_ROOT" to System.getProperty("java.io.tmpdir"),
            "CATALOG_DB_USER" to "kbeatz_user",
        )
        val config = AppConfig.fromEnv { key -> env[key] }
        assertEquals("kbeatz_user", config.dbUser)
    }

    @Test
    fun `fromEnv reads CATALOG_DB_PASSWORD when set`() {
        val env = mapOf(
            "CATALOG_LIBRARY_ROOT" to System.getProperty("java.io.tmpdir"),
            "CATALOG_DB_PASSWORD" to "s3cr3t",
        )
        val config = AppConfig.fromEnv { key -> env[key] }
        assertEquals("s3cr3t", config.dbPassword)
    }

    // --- fromConf() tests using inline HOCON ---

    @Test
    fun `fromConf reads defaults from inline HOCON`() {
        val hocon = ConfigFactory.parseString(
            """
            catalog {
              jdbcUrl = "jdbc:h2:mem:test"
              dbUser = "sa"
              dbPassword = ""
              libraryRoot = "${System.getProperty("java.io.tmpdir")}"
              dataDir = "./data"
              repair { timeoutSeconds = 60 }
              scan { parallelism = 4 }
              discogs { token = "", rateLimitPerMinute = 60, imageDailyQuota = 1000 }
            }
            """.trimIndent()
        )
        val config = AppConfig.fromConf(hocon)
        assertEquals("./data", config.dataDir)
        assertEquals("sa", config.dbUser)
        assertNull(config.discogsToken)
    }

    @Test
    fun `fromConf fails fast when libraryRoot is blank`() {
        val hocon = ConfigFactory.parseString(
            """
            catalog {
              jdbcUrl = "jdbc:h2:mem:test"
              dbUser = "sa"
              dbPassword = ""
              libraryRoot = ""
              dataDir = "./data"
              repair { timeoutSeconds = 60 }
              scan { parallelism = 4 }
              discogs { token = "", rateLimitPerMinute = 60, imageDailyQuota = 1000 }
            }
            """.trimIndent()
        )
        assertFailsWith<IllegalStateException> {
            AppConfig.fromConf(hocon)
        }
    }

    @Test
    fun `fromConf reads discogs token when non-empty`() {
        val hocon = ConfigFactory.parseString(
            """
            catalog {
              jdbcUrl = "jdbc:h2:mem:test"
              dbUser = "sa"
              dbPassword = ""
              libraryRoot = "${System.getProperty("java.io.tmpdir")}"
              dataDir = "./data"
              repair { timeoutSeconds = 60 }
              scan { parallelism = 4 }
              discogs { token = "my-token", rateLimitPerMinute = 60, imageDailyQuota = 1000 }
            }
            """.trimIndent()
        )
        val config = AppConfig.fromConf(hocon)
        assertEquals("my-token", config.discogsToken)
    }

    @Test
    fun `fromConf reads rate limit and image quota`() {
        val hocon = ConfigFactory.parseString(
            """
            catalog {
              jdbcUrl = "jdbc:h2:mem:test"
              dbUser = "sa"
              dbPassword = ""
              libraryRoot = "${System.getProperty("java.io.tmpdir")}"
              dataDir = "./data"
              repair { timeoutSeconds = 30 }
              scan { parallelism = 1 }
              discogs { token = "", rateLimitPerMinute = 30, imageDailyQuota = 500 }
            }
            """.trimIndent()
        )
        val config = AppConfig.fromConf(hocon)
        assertEquals(30L, config.repairTimeoutSeconds)
        assertEquals(1, config.scanParallelism)
        assertEquals(30, config.discogsRateLimitPerMinute)
        assertEquals(500, config.discogsImageDailyQuota)
    }

    // --- AppConfig instance method tests ---

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
    fun `discogs token does not appear in toString`() {
        val config = testConfig(token = "super-secret-token-12345")
        val str = config.toString()
        assert(!str.contains("super-secret-token-12345")) {
            "Discogs token must not appear in toString output"
        }
    }
}
