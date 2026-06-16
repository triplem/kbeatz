package org.javafreedom.kbeatz.catalog.util

private const val LOG_VALUE_MAX_LENGTH = 200

internal fun String.sanitizeForLog(): String =
    this.replace(Regex("[\r\n\t]"), " ").take(LOG_VALUE_MAX_LENGTH)
