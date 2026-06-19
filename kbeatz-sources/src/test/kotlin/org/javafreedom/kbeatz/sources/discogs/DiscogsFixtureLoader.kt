package org.javafreedom.kbeatz.sources.discogs

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Loads Discogs JSON fixture files from `src/test/resources/discogs/`.
 *
 * Each fixture file has the envelope structure:
 * ```json
 * { "resp": { "status": true, "release": { "id": 12345, ... } } }
 * ```
 *
 * The inner `release` object matches [DiscogsRelease] except:
 * - `"id"` fields are integers in JSON but Kotlin models declare them as [String].
 * - Extra unknown fields (e.g. `anv`, `resource_url`, `tracks` per artist) may be present.
 *
 * Integer-to-String coercion is performed by recursively traversing the parsed JSON tree
 * and converting any field named `"id"` from an integer [JsonPrimitive] to a string
 * [JsonPrimitive]. Unknown keys are dropped via `ignoreUnknownKeys = true`.
 */
object DiscogsFixtureLoader {

    private val json = Json { ignoreUnknownKeys = true }

    private val fixtureNames = listOf(
        "112146.json",
        "13748.json",
        "1448190.json",
        "2454735.json",
        "282923.json",
        "288308.json",
        "3083.json",
        "513904.json",
        "543030.json",
    )

    /**
     * Returns all fixtures as a list of (filename, parsed [DiscogsRelease]) pairs.
     *
     * The list preserves the order declared in [fixtureNames].
     */
    fun loadAll(): List<Pair<String, DiscogsRelease>> =
        fixtureNames.map { name -> name to load(name) }

    /**
     * Loads a single fixture file by name and returns the extracted [DiscogsRelease].
     *
     * @param filename The bare filename (e.g. `"2454735.json"`) inside `discogs/`.
     */
    fun load(filename: String): DiscogsRelease {
        val rawJson = readResource("/discogs/$filename")
        return parseEnvelope(rawJson)
    }

    /**
     * Returns the inner release JSON as a [String] with all `"id"` integer fields
     * converted to quoted strings. Suitable for use as a Ktor mock-engine response body.
     *
     * The caller's HttpClient must be configured with `ignoreUnknownKeys = true` to
     * handle the extra Discogs fields present in the fixture.
     */
    fun rawReleaseJson(filename: String): String {
        val rawJson = readResource("/discogs/$filename")
        val releaseElement = extractReleaseObject(rawJson)
        val patched = coerceIds(releaseElement)
        return json.encodeToString(JsonElement.serializer(), patched)
    }

    private fun readResource(path: String): String {
        val stream = requireNotNull(
            DiscogsFixtureLoader::class.java.getResourceAsStream(path)
        ) { "Fixture not found on classpath: $path" }
        return stream.bufferedReader().readText()
    }

    private fun parseEnvelope(rawJson: String): DiscogsRelease {
        val releaseElement = extractReleaseObject(rawJson)
        val patched = coerceIds(releaseElement)
        return json.decodeFromJsonElement(DiscogsRelease.serializer(), patched)
    }

    private fun extractReleaseObject(rawJson: String): JsonElement =
        json.parseToJsonElement(rawJson)
            .jsonObject["resp"]!!
            .jsonObject["release"]!!

    /**
     * Recursively traverses the JSON tree and converts any field named `"id"` from an
     * integer [JsonPrimitive] to a string [JsonPrimitive].
     *
     * Discogs API returns integer ids for releases, artists, labels, etc., while the
     * Kotlin model uses [String] for interoperability across sources.
     */
    private fun coerceIds(element: JsonElement): JsonElement =
        when (element) {
            is JsonObject -> JsonObject(
                element.entries.associate { (key, value) ->
                    key to when {
                        key == "id" && value is JsonPrimitive && !value.isString ->
                            JsonPrimitive(value.jsonPrimitive.content)
                        else -> coerceIds(value)
                    }
                }
            )
            is JsonArray -> JsonArray(element.map { coerceIds(it) })
            else -> element
        }
}
