package org.javafreedom.kbeatz.catalog.infrastructure.move

import java.nio.file.Files
import java.nio.file.Path
import kotlin.uuid.Uuid
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/** Filename of the move journal sentinel written before a directory move begins. */
const val MOVE_JOURNAL_FILENAME = ".kbeatz-move.journal"

/**
 * Lifecycle phase recorded in a [MoveJournal].
 *
 * - [PLANNED]: the journal was written but no filesystem move has started yet.
 *   Recovery rolls BACK (source is intact; clean any partial target).
 * - [MOVED]: the on-disk move completed but the DB update may not have committed.
 *   Recovery rolls FORWARD (complete the DB update).
 */
enum class MovePhase { PLANNED, MOVED }

/**
 * A crash-recovery journal describing a single in-flight directory move.
 *
 * The journal is written to a stable location (the catalog data directory, NOT inside the
 * directory being moved) before any file is touched, so a process kill at any point leaves a
 * record from which the move can be deterministically completed or rolled back on next startup.
 *
 * The on-disk format is a small JSON object. JSON string escaping makes the encoding robust for
 * ANY path value, including paths that contain tabs or newlines, so the round-trip never corrupts.
 *
 * @property albumId The album whose directory is moving.
 * @property fromPath The absolute source directory.
 * @property toPath The absolute target directory.
 * @property mergedFromPaths Absolute merged source directories that also relocate (may be empty).
 * @property mergedToPaths Absolute merged target directories, positionally matching [mergedFromPaths].
 * @property phase The lifecycle phase the move had reached when the journal was last written.
 */
data class MoveJournal(
    val albumId: Uuid,
    val fromPath: String,
    val toPath: String,
    val mergedFromPaths: List<String>,
    val mergedToPaths: List<String>,
    val phase: MovePhase,
) {
    /** Serialises this journal to its JSON object form. JSON escaping makes any path safe. */
    fun encode(): String {
        val obj = buildJsonObject {
            put(KEY_ALBUM_ID, albumId.toString())
            put(KEY_FROM, fromPath)
            put(KEY_TO, toPath)
            put(KEY_MERGED_FROM, encodeList(mergedFromPaths))
            put(KEY_MERGED_TO, encodeList(mergedToPaths))
            put(KEY_PHASE, phase.name)
        }
        return json.encodeToString(obj)
    }

    companion object {
        private const val KEY_ALBUM_ID = "albumId"
        private const val KEY_FROM = "fromPath"
        private const val KEY_TO = "toPath"
        private const val KEY_MERGED_FROM = "mergedFromPaths"
        private const val KEY_MERGED_TO = "mergedToPaths"
        private const val KEY_PHASE = "phase"

        private val json = Json { ignoreUnknownKeys = true }

        /**
         * Reads and parses a journal file. Returns null when the file is missing, empty, or
         * malformed so a corrupt journal never aborts startup (it is logged and skipped by the
         * caller instead).
         */
        fun readFrom(file: Path): MoveJournal? =
            file.takeIf { Files.isRegularFile(it) }
                ?.let { parseObject(Files.readString(it)) }
                ?.let { buildJournal(it) }

        @Suppress("SwallowedException") // a malformed/empty file is treated as absent (null), not an error
        private fun parseObject(raw: String): JsonObject? =
            try {
                json.parseToJsonElement(raw).jsonObject
            } catch (_: IllegalArgumentException) {
                null
            }

        // ReturnCount(3): three guarded early-null returns keep the parser flat and readable;
        // collapsing them into one boolean trips ComplexCondition instead. Two small guards is clearer.
        @Suppress("ReturnCount")
        private fun buildJournal(obj: JsonObject): MoveJournal? {
            val albumId = parseUuid(stringField(obj, KEY_ALBUM_ID))
            val phase = MovePhase.entries.firstOrNull { it.name == stringField(obj, KEY_PHASE) }
            val from = stringField(obj, KEY_FROM)
            val to = stringField(obj, KEY_TO)
            if (albumId == null || phase == null) return null
            if (from == null || to == null) return null
            return MoveJournal(
                albumId = albumId,
                fromPath = from,
                toPath = to,
                mergedFromPaths = decodeList(obj[KEY_MERGED_FROM]),
                mergedToPaths = decodeList(obj[KEY_MERGED_TO]),
                phase = phase,
            )
        }

        @Suppress("SwallowedException") // a malformed id is treated as a missing field (null), not an error
        private fun parseUuid(raw: String?): Uuid? =
            if (raw == null) {
                null
            } else {
                try {
                    Uuid.parse(raw)
                } catch (_: IllegalArgumentException) {
                    null
                }
            }

        private fun encodeList(paths: List<String>): JsonArray =
            buildJsonArray { paths.forEach { add(JsonPrimitive(it)) } }

        private fun decodeList(element: JsonElement?): List<String> =
            (element as? JsonArray)?.map { it.jsonPrimitive.content } ?: emptyList()

        private fun stringField(obj: JsonObject, key: String): String? =
            (obj[key] as? JsonPrimitive)?.content
    }
}
