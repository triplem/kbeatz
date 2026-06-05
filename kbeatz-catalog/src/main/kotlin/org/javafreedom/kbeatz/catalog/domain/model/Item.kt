package org.javafreedom.kbeatz.catalog.domain.model

import kotlin.uuid.Uuid
import kotlinx.datetime.Instant

data class Item(
    val id: Uuid,
    val ownerId: Uuid,
    val name: String,
    val description: String?,
    val createdAt: Instant,
)
