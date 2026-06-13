/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Track } from './Track';
export type AlbumDetail = {
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
     * Deprecated: use albumPath instead. Will be removed in v2.
     * @deprecated
     */
    directoryPath: string;
    /**
     * Album directory path relative to the library root. Canonical field - use this in all consumers.
     */
    albumPath: string;
    /**
     * True when cover art is available via GET /albums/{albumId}/cover
     */
    hasCoverArt: boolean;
    /**
     * Ordered list of tracks in this album
     */
    tracks: Array<Track>;
};

