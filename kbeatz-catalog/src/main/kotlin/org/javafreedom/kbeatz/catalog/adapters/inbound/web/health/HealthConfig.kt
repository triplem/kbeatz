package org.javafreedom.kbeatz.catalog.adapters.inbound.web.health

import java.nio.file.Path

/**
 * Health-check dependencies: a DB connectivity probe, a repair-readiness probe,
 * and the library filesystem root.
 *
 * Extracted as a value holder so [org.javafreedom.kbeatz.catalog.plugins.configureRouting]
 * does not exceed Detekt's LongParameterList threshold.
 *
 * @param dbProbe suspending function returning true when the database is reachable.
 * @param repairReadyProbe function returning true when the startup write-lock repair
 *   has completed and the service is ready to accept traffic.
 * @param libraryRoot filesystem path to the music library root.
 */
data class HealthConfig(
    val dbProbe: suspend () -> Boolean,
    val repairReadyProbe: () -> Boolean,
    val libraryRoot: Path,
)
