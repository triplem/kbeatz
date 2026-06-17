/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A single album-level Vorbis Comment field update.
 */
export type AlbumTagFieldUpdate = {
    /**
     * Vorbis Comment field name (case-insensitive). Allowed: ALBUM, ALBUMARTIST, DATE, GENRE, LABEL, CATALOGNUMBER, COMPOSER, CONDUCTOR, ENSEMBLE.
     */
    field: string;
    /**
     * New field value (max 4096 characters)
     */
    value: string;
};

