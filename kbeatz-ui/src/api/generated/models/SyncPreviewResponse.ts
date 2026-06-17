/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SyncFieldChange } from './SyncFieldChange';
/**
 * Result of a sync preview request. Contains the full list of field changes that would
 * be applied if the user confirms the sync. Fields where the current and proposed values
 * are identical are excluded.
 *
 */
export type SyncPreviewResponse = {
    /**
     * Album UUID
     */
    albumId: string;
    /**
     * Fields that would change (only fields where currentValue != proposedValue)
     */
    proposedChanges: Array<SyncFieldChange>;
};

