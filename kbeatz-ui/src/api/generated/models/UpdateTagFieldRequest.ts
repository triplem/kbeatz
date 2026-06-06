/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Single-field tag update. The field name is case-insensitive (normalised to uppercase).
 * Album-level allowed fields: ALBUM, ALBUMARTIST, DATE, GENRE, LABEL, CATALOGNUMBER, COMPOSER, CONDUCTOR, ENSEMBLE.
 * Track-level allowed fields: TITLE, TRACKNUMBER, ARTIST.
 *
 */
export type UpdateTagFieldRequest = {
    /**
     * Vorbis Comment field name (case-insensitive)
     */
    field: string;
    /**
     * New field value
     */
    value: string;
};

