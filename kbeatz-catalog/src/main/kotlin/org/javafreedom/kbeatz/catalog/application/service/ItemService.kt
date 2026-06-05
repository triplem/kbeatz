package org.javafreedom.kbeatz.catalog.application.service

import kotlin.uuid.Uuid
import kotlinx.datetime.Clock
import org.javafreedom.kbeatz.common.ResourceNotFoundException
import org.javafreedom.kbeatz.catalog.domain.model.Item
import org.javafreedom.kbeatz.catalog.domain.repository.ItemRepository

class ItemService(private val repository: ItemRepository) {

    suspend fun getItem(id: Uuid): Item =
        repository.findById(id) ?: throw ResourceNotFoundException("Item", id.toString())

    suspend fun listItems(ownerId: Uuid, page: Int, size: Int): Pair<List<Item>, Long> {
        val items = repository.findAllByOwner(ownerId, page, size)
        val total = repository.countByOwner(ownerId)
        return items to total
    }

    suspend fun createItem(ownerId: Uuid, name: String, description: String?): Item {
        val item = Item(
            id = Uuid.random(),
            ownerId = ownerId,
            name = name,
            description = description,
            createdAt = Clock.System.now(),
        )
        return repository.save(item)
    }
}
