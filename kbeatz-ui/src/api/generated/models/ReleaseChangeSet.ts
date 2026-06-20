/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DirectoryMove } from './DirectoryMove';
import type { PlanConflict } from './PlanConflict';
import type { TagChange } from './TagChange';
/**
 * The complete set of planned changes for a single release.
 */
export type ReleaseChangeSet = {
    /**
     * The release this change set describes.
     */
    albumId: string;
    /**
     * The planned move, or null when the directory already matches the template.
     */
    directoryMove?: DirectoryMove | null;
    /**
     * The per-field tag diffs. Empty for a pure relayout.
     */
    tagChanges: Array<TagChange>;
    /**
     * Any conflicts detected for this release during planning.
     */
    conflicts: Array<PlanConflict>;
    /**
     * True when this release has at least one conflict.
     */
    hasConflicts: boolean;
};

