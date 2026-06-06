package org.javafreedom.kbeatz.catalog.domain.model

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
 * @property errorMessage Non-null when [state] is [ScanState.FAILED].
 */
data class ScanStatus(
    val state: ScanState,
    val scannedAlbums: Long,
    val totalAlbums: Long,
    val errorMessage: String?,
) {
    companion object {
        val IDLE = ScanStatus(ScanState.IDLE, 0L, 0L, null)
    }
}
