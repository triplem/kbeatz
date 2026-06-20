package org.javafreedom.kbeatz.catalog.domain.service

import org.javafreedom.kbeatz.catalog.domain.model.TagChange

/**
 * Pure, deterministic calculator for tag-field differences.
 *
 * Compares a [current] tag map against a [proposed] tag map and emits one [TagChange]
 * for every field whose value differs, including:
 * - additions (field absent from [current], present in [proposed]),
 * - removals (field present in [current], absent from [proposed], proposed value null),
 * - value changes (field present in both with differing values).
 *
 * Fields with equal values in both maps produce no change. Output is sorted by field
 * name for deterministic ordering. This object performs no I/O.
 */
object TagDiffCalculator {

    /**
     * Computes the per-field diff between [current] and [proposed].
     *
     * @param current The current tag values, keyed by Vorbis field name.
     * @param proposed The proposed tag values, keyed by Vorbis field name.
     * @param targetPath Identifies the file or scope the changes apply to.
     * @return The differing fields as [TagChange] entries, sorted by field name.
     */
    fun diff(
        current: Map<String, String>,
        proposed: Map<String, String>,
        targetPath: String,
    ): List<TagChange> =
        (current.keys + proposed.keys)
            .asSequence()
            .distinct()
            .sorted()
            .mapNotNull { field ->
                val currentValue = current[field]
                val proposedValue = proposed[field]
                if (currentValue == proposedValue) {
                    null
                } else {
                    TagChange(
                        targetPath = targetPath,
                        field = field,
                        currentValue = currentValue,
                        proposedValue = proposedValue,
                    )
                }
            }
            .toList()
}
