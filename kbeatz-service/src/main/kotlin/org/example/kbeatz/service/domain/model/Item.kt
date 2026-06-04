package org.example.kbeatz.service.domain.model

import kotlin.uuid.Uuid
import kotlinx.datetime.Instant

data class Item(
    val id: Uuid,
    val ownerId: Uuid,
    val name: String,
    val description: String?,
    val createdAt: Instant,
)
