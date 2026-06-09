package org.javafreedom.kbeatz.catalog

import com.typesafe.config.Config
import com.typesafe.config.ConfigFactory
import io.github.oshai.kotlinlogging.KotlinLogging

private val log = KotlinLogging.logger {}

data class AppConfig(
    val catalogLibraryRoot: String,
    val discogsToken: String?,
    val jdbcUrl: String,
    val dbUser: String,
    val dbPassword: String,
    val dataDir: String,
    val repairTimeoutSeconds: Long,
    val discogsRateLimitPerMinute: Int,
    val discogsImageDailyQuota: Int,
) {
    companion object {
        private const val DEFAULT_JDBC_URL =
            "jdbc:h2:file:./data/kbeatz;DB_CLOSE_DELAY=-1;MODE=PostgreSQL"
        private const val DEFAULT_DATA_DIR = "./data"
        @Suppress("MagicNumber") // default repair scan timeout in seconds per issue #372 ops spec
        private const val DEFAULT_REPAIR_TIMEOUT_SECONDS = 60L
        @Suppress("MagicNumber") // default rate-limit matching Discogs API cap
        private const val DEFAULT_RATE_LIMIT = 60
        @Suppress("MagicNumber") // default daily image-download quota
        private const val DEFAULT_IMAGE_QUOTA = 1000

        /**
         * Builds [AppConfig] from HOCON using Typesafe Config.
         *
         * The resolution order (highest priority wins):
         *  1. System properties (`-Dcatalog.jdbcUrl=...`)
         *  2. Environment variables resolved via `${?CATALOG_JDBC_URL}` substitutions in the conf file
         *  3. `local.conf` (gitignored developer override, optional)
         *  4. `application.conf` (shipped defaults)
         *
         * Pass a custom [Config] in tests to avoid touching the filesystem or real env vars.
         */
        fun fromConf(config: Config = ConfigFactory.load()): AppConfig {
            val root = config.getString("catalog.libraryRoot")
            if (root.isBlank()) {
                error("catalog.libraryRoot (CATALOG_LIBRARY_ROOT) must be set")
            }
            val rawToken = config.getString("catalog.discogs.token")
            val token = rawToken.ifBlank {
                log.warn { "DISCOGS_TOKEN not set - Discogs sync will be unavailable" }
                null
            }
            val jdbcUrl = config.getString("catalog.jdbcUrl").ifBlank { DEFAULT_JDBC_URL }
            val dbUser = config.getString("catalog.dbUser")
            val dbPassword = config.getString("catalog.dbPassword")
            val dataDir = config.getString("catalog.dataDir").ifBlank { DEFAULT_DATA_DIR }
            val repairTimeout = config.getLong("catalog.repair.timeoutSeconds")
            val rateLimit = config.getInt("catalog.discogs.rateLimitPerMinute")
            val imageQuota = config.getInt("catalog.discogs.imageDailyQuota")
            return AppConfig(
                catalogLibraryRoot = root,
                discogsToken = token,
                jdbcUrl = jdbcUrl,
                dbUser = dbUser,
                dbPassword = dbPassword,
                dataDir = dataDir,
                repairTimeoutSeconds = repairTimeout,
                discogsRateLimitPerMinute = rateLimit,
                discogsImageDailyQuota = imageQuota,
            )
        }

        /**
         * Legacy factory that reads directly from environment variables.
         *
         * Kept for unit tests that do not want to spin up a full HOCON config.
         */
        fun fromEnv(env: (String) -> String? = System::getenv): AppConfig {
            val root = env("CATALOG_LIBRARY_ROOT")
                ?: error("CATALOG_LIBRARY_ROOT must be set")
            val token = env("DISCOGS_TOKEN")
            if (token == null) {
                log.warn { "DISCOGS_TOKEN not set - Discogs sync will be unavailable" }
            }
            val jdbcUrl = env("CATALOG_JDBC_URL") ?: DEFAULT_JDBC_URL
            val dbUser = env("CATALOG_DB_USER") ?: "sa"
            val dbPassword = env("CATALOG_DB_PASSWORD").orEmpty()
            val dataDir = env("CATALOG_DATA_DIR") ?: env("DATA_DIR") ?: DEFAULT_DATA_DIR
            return AppConfig(
                catalogLibraryRoot = root,
                discogsToken = token,
                jdbcUrl = jdbcUrl,
                dbUser = dbUser,
                dbPassword = dbPassword,
                dataDir = dataDir,
                repairTimeoutSeconds = DEFAULT_REPAIR_TIMEOUT_SECONDS,
                discogsRateLimitPerMinute = DEFAULT_RATE_LIMIT,
                discogsImageDailyQuota = DEFAULT_IMAGE_QUOTA,
            )
        }
    }

    fun filesystemStatus(): String =
        if (java.io.File(catalogLibraryRoot).exists()) "UP" else "DOWN"

    /**
     * Masks [discogsToken] and [dbPassword] so secrets never appear in log output.
     * A Discogs token in any log line would violate the NFR-09 secret-hygiene requirement.
     */
    override fun toString(): String =
        "AppConfig(catalogLibraryRoot=$catalogLibraryRoot, " +
            "jdbcUrl=$jdbcUrl, dbUser=$dbUser, dbPassword=****, " +
            "dataDir=$dataDir, repairTimeoutSeconds=$repairTimeoutSeconds, " +
            "discogsToken=${if (discogsToken != null) "****" else "null"}, " +
            "discogsRateLimitPerMinute=$discogsRateLimitPerMinute, " +
            "discogsImageDailyQuota=$discogsImageDailyQuota)"
}
