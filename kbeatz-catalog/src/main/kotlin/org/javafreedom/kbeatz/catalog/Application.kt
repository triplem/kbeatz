package org.javafreedom.kbeatz.catalog

import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.util.AttributeKey
import org.javafreedom.kbeatz.catalog.plugins.configureLogging
import org.javafreedom.kbeatz.catalog.plugins.configureRouting
import org.javafreedom.kbeatz.catalog.plugins.configureSerialization
import org.javafreedom.kbeatz.catalog.plugins.configureStatusPages

val AppConfigKey = AttributeKey<AppConfig>("AppConfig")

fun main() {
    embeddedServer(CIO, port = 8080, host = "0.0.0.0", module = Application::module).start(wait = true)
}

fun Application.module() {
    val config = AppConfig.fromEnv()
    attributes.put(AppConfigKey, config)
    configureLogging()
    configureSerialization()
    configureStatusPages()
    configureRouting()
}
