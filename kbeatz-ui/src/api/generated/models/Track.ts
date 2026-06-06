/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Track = {
    /**
     * Internal track identifier
     */
    id: string;
    /**
     * Parent album identifier
     */
    albumId: string;
    /**
     * TITLE tag
     */
    title?: string;
    /**
     * TRACKNUMBER tag (may be '1', 'A1', or '1/12')
     */
    trackNumber?: string;
    /**
     * DISCNUMBER tag
     */
    discNumber?: string;
    /**
     * ARTIST tag (per-track; falls back to albumArtist when absent)
     */
    artist?: string;
    /**
     * COMPOSER tag (per-track override)
     */
    composer?: string;
    /**
     * CONDUCTOR tag (per-track override)
     */
    conductor?: string;
    /**
     * ENSEMBLE tag (per-track override)
     */
    ensemble?: string;
    /**
     * Track duration in seconds
     */
    durationSeconds?: number;
    /**
     * Relative path to FLAC file within the album directory
     */
    path: string;
};

