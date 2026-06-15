/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AlbumTagFieldUpdate } from './AlbumTagFieldUpdate';
import type { TrackTagFieldUpdate } from './TrackTagFieldUpdate';
/**
 * Bulk tag update request. Album-level fields are applied first (all within one Mutex
 * acquisition), then track-level fields are applied in order. Both lists may be empty.
 *
 */
export type BulkUpdateTagsRequest = {
    /**
     * Album-level tag field updates (applied to all FLAC files in the album directory).
     */
    albumFields: Array<AlbumTagFieldUpdate>;
    /**
     * Track-level tag field updates (one per track field change).
     */
    trackFields: Array<TrackTagFieldUpdate>;
};

