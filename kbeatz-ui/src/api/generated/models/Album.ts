/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Album = {
    /**
     * Internal album identifier
     */
    id: string;
    /**
     * ALBUMARTIST tag
     */
    albumArtist: string;
    /**
     * ALBUM tag
     */
    album: string;
    /**
     * DATE tag (year or ISO date)
     */
    date?: string;
    /**
     * GENRE tag
     */
    genre?: string;
    /**
     * LABEL tag
     */
    label?: string;
    /**
     * CATALOGNUMBER tag
     */
    catalogNumber?: string;
    /**
     * COMPOSER tag; when set the UI shows this as primary attribution
     */
    composer?: string;
    /**
     * CONDUCTOR tag
     */
    conductor?: string;
    /**
     * ENSEMBLE tag
     */
    ensemble?: string;
    /**
     * Discogs release ID from metadata.yml
     */
    discogsId?: string;
    /**
     * Canonical path to the album directory, relative to the library root
     */
    albumPath: string;
    /**
     * True when cover art is available via GET /albums/{albumId}/cover
     */
    hasCoverArt: boolean;
    /**
     * Number of tracks in this album (aggregated from tracks table)
     */
    trackCount?: number;
    /**
     * Sum of all track durations in seconds (aggregated from tracks table)
     */
    totalDurationSeconds?: number;
};

