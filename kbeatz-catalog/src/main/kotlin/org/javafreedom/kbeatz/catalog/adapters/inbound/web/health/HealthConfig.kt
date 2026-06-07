package org.javafreedom.kbeatz.catalog.adapters.inbound.web.health

import java.nio.file.Path

/**
 * Health-check dependencies: a DB connectivity probe and the library filesystem root.
 *
 * Extracted as a value holder so [org.javafreedom.kbeatz.catalog.plugins.configureRouting]
 * does not exceed Detekt's LongParameterList threshold.
 */
data class HealthConfig(
    val dbProbe: suspend () -> Boolean,
    val libraryRoot: Path,
)
