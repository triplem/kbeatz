package org.javafreedom.kbeatz.catalog

import io.github.oshai.kotlinlogging.KotlinLogging

private val log = KotlinLogging.logger {}

data class AppConfig(
    val catalogLibraryRoot: String,
    val discogsToken: String?,
    val jdbcUrl: String,
    val dataDir: String,
) {
    companion object {
        private const val DEFAULT_JDBC_URL =
            "jdbc:h2:file:./data/kbeatz;DB_CLOSE_DELAY=-1;MODE=PostgreSQL"
        private const val DEFAULT_DATA_DIR = "./data"

        fun fromEnv(env: (String) -> String? = System::getenv): AppConfig {
            val root = env("CATALOG_LIBRARY_ROOT")
                ?: error("CATALOG_LIBRARY_ROOT must be set")
            val token = env("DISCOGS_TOKEN")
            if (token == null) {
                log.warn { "DISCOGS_TOKEN not set - Discogs sync will be unavailable" }
            }
            val jdbcUrl = env("CATALOG_JDBC_URL") ?: DEFAULT_JDBC_URL
            val dataDir = env("DATA_DIR") ?: DEFAULT_DATA_DIR
            return AppConfig(
                catalogLibraryRoot = root,
                discogsToken = token,
                jdbcUrl = jdbcUrl,
                dataDir = dataDir,
            )
        }
    }

    fun filesystemStatus(): String =
        if (java.io.File(catalogLibraryRoot).exists()) "UP" else "DOWN"
}
