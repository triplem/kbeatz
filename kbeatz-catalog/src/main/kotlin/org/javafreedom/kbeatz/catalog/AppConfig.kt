package org.javafreedom.kbeatz.catalog

import io.github.oshai.kotlinlogging.KotlinLogging

private val log = KotlinLogging.logger {}

data class AppConfig(
    val catalogLibraryRoot: String,
    val discogsToken: String?,
) {
    companion object {
        fun fromEnv(): AppConfig {
            val root = System.getenv("CATALOG_LIBRARY_ROOT")
                ?: error("CATALOG_LIBRARY_ROOT must be set")
            val token = System.getenv("DISCOGS_TOKEN")
            if (token == null) {
                log.warn { "DISCOGS_TOKEN not set — Discogs sync will be unavailable" }
            }
            return AppConfig(catalogLibraryRoot = root, discogsToken = token)
        }
    }

    fun filesystemStatus(): String =
        if (java.io.File(catalogLibraryRoot).exists()) "UP" else "DOWN"
}
