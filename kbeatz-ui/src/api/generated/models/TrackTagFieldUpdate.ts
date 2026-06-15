/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A single track-level Vorbis Comment field update.
 */
export type TrackTagFieldUpdate = {
    /**
     * Track UUID
     */
    trackId: string;
    /**
     * Vorbis Comment field name (case-insensitive). Allowed: TITLE, TRACKNUMBER, ARTIST.
     */
    field: string;
    /**
     * New field value
     */
    value: string;
};

