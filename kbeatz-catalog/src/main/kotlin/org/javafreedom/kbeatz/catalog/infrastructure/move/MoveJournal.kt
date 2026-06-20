package org.javafreedom.kbeatz.catalog.infrastructure.move

import java.nio.file.Files
import java.nio.file.Path
import kotlin.uuid.Uuid

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
 * The on-disk format is a small, line-oriented `key=value` text file. Paths are stored verbatim;
 * the merged source/target lists are tab-separated so individual paths may contain spaces.
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
    /** Serialises this journal to its line-oriented `key=value` text form. */
    fun encode(): String = buildString {
        appendLine("$KEY_ALBUM_ID=$albumId")
        appendLine("$KEY_FROM=$fromPath")
        appendLine("$KEY_TO=$toPath")
        appendLine("$KEY_MERGED_FROM=${mergedFromPaths.joinToString(FIELD_SEPARATOR)}")
        appendLine("$KEY_MERGED_TO=${mergedToPaths.joinToString(FIELD_SEPARATOR)}")
        appendLine("$KEY_PHASE=${phase.name}")
    }

    companion object {
        private const val KEY_ALBUM_ID = "albumId"
        private const val KEY_FROM = "fromPath"
        private const val KEY_TO = "toPath"
        private const val KEY_MERGED_FROM = "mergedFromPaths"
        private const val KEY_MERGED_TO = "mergedToPaths"
        private const val KEY_PHASE = "phase"
        private const val FIELD_SEPARATOR = "\t"
        private const val KV_LIMIT = 2

        /**
         * Reads and parses a journal file. Returns null when the file is missing, empty, or
         * malformed so a corrupt journal never aborts startup (it is logged and skipped by the
         * caller instead).
         */
        fun readFrom(file: Path): MoveJournal? {
            if (!Files.isRegularFile(file)) return null
            return buildJournal(parseFields(Files.readAllLines(file)))
        }

        // ReturnCount(3): three guarded early-null returns keep the parser flat and readable;
        // collapsing them into one boolean trips ComplexCondition instead. Two small guards is clearer.
        @Suppress("ReturnCount")
        private fun buildJournal(fields: Map<String, String>): MoveJournal? {
            val albumId = parseUuid(fields[KEY_ALBUM_ID])
            val phase = MovePhase.entries.firstOrNull { it.name == fields[KEY_PHASE] }
            val from = fields[KEY_FROM]
            val to = fields[KEY_TO]
            if (albumId == null || phase == null) return null
            if (from == null || to == null) return null
            return MoveJournal(
                albumId = albumId,
                fromPath = from,
                toPath = to,
                mergedFromPaths = splitList(fields[KEY_MERGED_FROM]),
                mergedToPaths = splitList(fields[KEY_MERGED_TO]),
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

        private fun parseFields(lines: List<String>): Map<String, String> =
            lines.mapNotNull { line ->
                val parts = line.split("=", limit = KV_LIMIT)
                if (parts.size == KV_LIMIT) parts[0] to parts[1] else null
            }.toMap()

        private fun splitList(raw: String?): List<String> =
            raw?.takeIf { it.isNotEmpty() }?.split(FIELD_SEPARATOR) ?: emptyList()
    }
}
