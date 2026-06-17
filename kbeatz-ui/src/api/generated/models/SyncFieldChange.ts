/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A single field comparison between the current album value and the value Discogs would write.
 */
export type SyncFieldChange = {
    /**
     * Vorbis Comment field name (uppercase)
     */
    field: string;
    /**
     * Current value stored in the album index (empty string if not set)
     */
    currentValue: string;
    /**
     * Value that Discogs sync would write
     */
    proposedValue: string;
};

