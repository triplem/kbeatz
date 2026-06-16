package org.javafreedom.kbeatz.catalog.domain.model

import kotlin.time.Instant

/**
 * Represents the current state of a library scan.
 *
 * State transitions: IDLE -> RUNNING -> COMPLETE | FAILED.
 */
enum class ScanState {
    IDLE,
    RUNNING,
    COMPLETE,
    FAILED,
}

/**
 * A per-album scan error with a sanitised reason and an actionable suggestion.
 *
 * @property albumDir Album directory path relative to the library root (no absolute paths).
 * @property reason Human-readable error reason without stack traces or class names.
 * @property suggestion Actionable suggestion for the user.
 */
data class ScanErrorEntry(
    val albumDir: String,
    val reason: String,
    val suggestion: String,
)

/**
 * A snapshot of library scan progress.
 *
 * @property state Current scan state.
 * @property scannedAlbums Number of albums successfully indexed so far.
 * @property totalAlbums Estimated total albums discovered at scan start; 0 when [state] is [ScanState.IDLE].
 * @property startedAt Timestamp when the scan transitioned to [ScanState.RUNNING]; null when [ScanState.IDLE].
 * @property completedAt Timestamp when the scan transitioned to [ScanState.COMPLETE] or [ScanState.FAILED];
 *   null while running or when [ScanState.IDLE].
 * @property errorMessage Non-null when [state] is [ScanState.FAILED].
 * @property errors Per-album scan errors (up to [MAX_REPORTED_ERRORS] entries).
 * @property totalErrors Total number of per-album errors including those beyond the cap.
 */
data class ScanStatus(
    val state: ScanState,
    val scannedAlbums: Long,
    val totalAlbums: Long,
    val startedAt: Instant?,
    val completedAt: Instant?,
    val errorMessage: String?,
    val errors: List<ScanErrorEntry> = emptyList(),
    val totalErrors: Int = 0,
) {
    companion object {
        val IDLE = ScanStatus(ScanState.IDLE, 0L, 0L, null, null, null)

        /** Maximum number of per-album error entries surfaced in the API response. */
        const val MAX_REPORTED_ERRORS: Int = 50
    }
}
