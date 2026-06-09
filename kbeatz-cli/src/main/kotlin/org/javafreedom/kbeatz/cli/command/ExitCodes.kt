package org.javafreedom.kbeatz.cli.command

/**
 * Exit code constants for kbeatz-tagger CLI commands.
 *
 * Batch scripts should check these codes to distinguish a hard failure
 * (command could not run) from a partial failure (some albums failed but
 * others succeeded) and decide whether to retry or abort.
 *
 * | Code | Meaning                                                               |
 * |------|-----------------------------------------------------------------------|
 * | 0    | All operations succeeded.                                             |
 * | 1    | Hard failure: command could not start, single-target failed, or no   |
 * |      | operations succeeded in batch mode.                                   |
 * | 2    | Invalid arguments (Clikt default for usage errors).                   |
 * | 3    | Partial batch failure: at least one operation succeeded and at least  |
 * |      | one failed. Applies only to --library / --recursive batch modes.      |
 */
object ExitCodes {
    /** All operations completed successfully. */
    const val SUCCESS = 0

    /**
     * Hard failure: the command could not run, or a single-target invocation failed,
     * or all albums in a batch failed (no successes).
     */
    const val FAILURE = 1

    /**
     * Invalid arguments - this is the Clikt default for [UsageError] and is not thrown
     * explicitly by command code; it is documented here for script authors who need to
     * distinguish a bad invocation from a runtime failure.
     */
    const val INVALID_ARGS = 2

    /**
     * Partial batch failure: at least one operation succeeded and at least one failed.
     * Only emitted in batch modes (--library for tag, --recursive for migrate-ids).
     */
    const val PARTIAL_FAILURE = 3
}
