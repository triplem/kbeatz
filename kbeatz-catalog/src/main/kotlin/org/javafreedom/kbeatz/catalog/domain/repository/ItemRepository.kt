package org.javafreedom.kbeatz.catalog.domain.repository

import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.Item

interface ItemRepository {
    suspend fun findById(id: Uuid): Item?
    suspend fun findAllByOwner(ownerId: Uuid, page: Int, size: Int): List<Item>
    suspend fun countByOwner(ownerId: Uuid): Long
    suspend fun save(item: Item): Item
}
