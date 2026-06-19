package org.javafreedom.kbeatz.sources.discogs

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject

/**
 * Loads Discogs JSON fixture files from `src/test/resources/discogs/`.
 *
 * Each fixture file has the envelope structure:
 * ```json
 * { "resp": { "status": true, "release": { "id": 12345, ... } } }
 * ```
 *
 * The inner `release` object matches [DiscogsRelease]. Integer `id` fields in the JSON
 * are correctly typed now that the model uses [Int] for `id` fields.
 * Extra unknown fields (e.g. `anv`, `resource_url`, `tracks` per artist) are dropped
 * via `ignoreUnknownKeys = true`.
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
     * Returns the inner release JSON as a [String]. Suitable for use as a Ktor
     * mock-engine response body.
     *
     * The caller's HttpClient must be configured with `ignoreUnknownKeys = true` to
     * handle the extra Discogs fields present in the fixture.
     */
    internal fun rawReleaseJson(filename: String): String {
        val rawJson = readResource("/discogs/$filename")
        val releaseElement = extractReleaseObject(rawJson)
        return json.encodeToString(JsonElement.serializer(), releaseElement)
    }

    private fun readResource(path: String): String {
        val stream = requireNotNull(
            DiscogsFixtureLoader::class.java.getResourceAsStream(path)
        ) { "Fixture not found on classpath: $path" }
        return stream.bufferedReader().readText()
    }

    private fun parseEnvelope(rawJson: String): DiscogsRelease {
        val releaseElement = extractReleaseObject(rawJson)
        return json.decodeFromJsonElement(DiscogsRelease.serializer(), releaseElement)
    }

    private fun extractReleaseObject(rawJson: String): JsonElement =
        json.parseToJsonElement(rawJson)
            .jsonObject["resp"]!!
            .jsonObject["release"]!!
}
