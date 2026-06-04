package org.example.kbeatz.service.domain.repository

import kotlin.uuid.Uuid
import org.example.kbeatz.service.domain.model.Item

interface ItemRepository {
    suspend fun findById(id: Uuid): Item?
    suspend fun findAllByOwner(ownerId: Uuid, page: Int, size: Int): List<Item>
    suspend fun countByOwner(ownerId: Uuid): Long
    suspend fun save(item: Item): Item
}
