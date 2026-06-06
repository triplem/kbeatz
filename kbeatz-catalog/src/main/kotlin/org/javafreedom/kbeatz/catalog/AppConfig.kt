package org.javafreedom.kbeatz.catalog

import io.github.oshai.kotlinlogging.KotlinLogging

private val log = KotlinLogging.logger {}

data class AppConfig(
    val catalogLibraryRoot: String,
    val discogsToken: String?,
    val jdbcUrl: String,
) {
    companion object {
        private const val DEFAULT_JDBC_URL =
            "jdbc:h2:file:./data/kbeatz;DB_CLOSE_DELAY=-1;MODE=PostgreSQL"

        fun fromEnv(): AppConfig {
            val root = System.getenv("CATALOG_LIBRARY_ROOT")
                ?: error("CATALOG_LIBRARY_ROOT must be set")
            val token = System.getenv("DISCOGS_TOKEN")
            if (token == null) {
                log.warn { "DISCOGS_TOKEN not set — Discogs sync will be unavailable" }
            }
            val jdbcUrl = System.getenv("CATALOG_JDBC_URL") ?: DEFAULT_JDBC_URL
            return AppConfig(catalogLibraryRoot = root, discogsToken = token, jdbcUrl = jdbcUrl)
        }
    }

    fun filesystemStatus(): String =
        if (java.io.File(catalogLibraryRoot).exists()) "UP" else "DOWN"
}
