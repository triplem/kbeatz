package org.javafreedom.kbeatz.catalog.infrastructure.persistence

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.javafreedom.kbeatz.catalog.domain.model.ImageDescriptor
import org.javafreedom.kbeatz.catalog.domain.model.ImageSource

/**
 * Serialises/deserialises [ImageDescriptor] lists, [Map]<String, String> extra-tag maps,
 * and merged-directory path lists to/from the JSON TEXT columns stored in `albums.images`,
 * `albums.extra_tags`, `albums.merged_directories`, `tracks.images`, and `tracks.extra_tags`.
 *
 * Serialisation is performed only at the persistence boundary; domain model classes
 * are free of JSON annotations.
 */
internal object JsonSerde {

    private val json = Json { ignoreUnknownKeys = true }

    // ─── ImageDescriptor ────────────────────────────────────────────────────────

    fun encodeImages(images: List<ImageDescriptor>?): String? {
        if (images.isNullOrEmpty()) return null
        val array = buildJsonArray {
            images.forEach { img ->
                add(buildJsonObject {
                    put("pictureType", img.pictureType)
                    put("source", img.source.name.lowercase())
                    put("path", img.path)
                    put("mimeType", img.mimeType)
                    put("description", img.description)
                })
            }
        }
        return json.encodeToString(array)
    }

    fun decodeImages(raw: String?): List<ImageDescriptor>? {
        if (raw.isNullOrBlank()) return null
        return json.parseToJsonElement(raw).jsonArray.mapNotNull { element ->
            runCatching { parseImageDescriptor(element.jsonObject) }.getOrNull()
        }.ifEmpty { null }
    }

    private fun parseImageDescriptor(obj: JsonObject): ImageDescriptor {
        val sourceStr = obj["source"]?.jsonPrimitive?.content?.uppercase() ?: "FILE"
        return ImageDescriptor(
            pictureType = obj["pictureType"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0,
            source = runCatching { ImageSource.valueOf(sourceStr) }.getOrDefault(ImageSource.FILE),
            path = obj["path"]?.jsonPrimitive?.content.orEmpty(),
            mimeType = obj["mimeType"]?.jsonPrimitive?.content.orEmpty(),
            description = obj["description"]?.jsonPrimitive?.content.orEmpty(),
        )
    }

    // ─── ExtraTags ──────────────────────────────────────────────────────────────

    fun encodeExtraTags(tags: Map<String, String>?): String? {
        if (tags.isNullOrEmpty()) return null
        val obj = buildJsonObject { tags.forEach { (k, v) -> put(k, v) } }
        return json.encodeToString(obj)
    }

    fun decodeExtraTags(raw: String?): Map<String, String>? {
        if (raw.isNullOrBlank()) return null
        return json.parseToJsonElement(raw).jsonObject
            .mapValues { (_, v) -> v.jsonPrimitive.content }
            .ifEmpty { null }
    }

    // ─── MergedDirectories ──────────────────────────────────────────────────────

    /**
     * Encodes a list of merged directory paths as a JSON array string.
     * Returns null when the list is empty (single-directory albums have no merged dirs).
     */
    fun encodeMergedDirectories(dirs: List<String>): String? {
        if (dirs.isEmpty()) return null
        val array = buildJsonArray { dirs.forEach { add(JsonPrimitive(it)) } }
        return json.encodeToString(array)
    }

    /**
     * Decodes a JSON array string into a list of merged directory paths.
     * Returns an empty list when [raw] is null or blank (the common case for single-directory albums).
     */
    fun decodeMergedDirectories(raw: String?): List<String> {
        if (raw.isNullOrBlank()) return emptyList()
        return json.parseToJsonElement(raw).jsonArray
            .mapNotNull { it.jsonPrimitive.content.takeIf { s -> s.isNotBlank() } }
    }
}
