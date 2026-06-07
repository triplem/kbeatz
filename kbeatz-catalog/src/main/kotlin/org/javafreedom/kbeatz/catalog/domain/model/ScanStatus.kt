package org.javafreedom.kbeatz.catalog.domain.model

import kotlinx.datetime.Instant

/**
 * Represents the current state of a library scan.
 *
 * State transitions: IDLE → RUNNING → COMPLETE | FAILED.
 */
enum class ScanState {
    IDLE,
    RUNNING,
    COMPLETE,
    FAILED,
}

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
 */
data class ScanStatus(
    val state: ScanState,
    val scannedAlbums: Long,
    val totalAlbums: Long,
    val startedAt: Instant?,
    val completedAt: Instant?,
    val errorMessage: String?,
) {
    companion object {
        val IDLE = ScanStatus(ScanState.IDLE, 0L, 0L, null, null, null)
    }
}
