/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Album } from '../models/Album';
import type { AlbumDetail } from '../models/AlbumDetail';
import type { AlbumPage } from '../models/AlbumPage';
import type { BulkUpdateTagsRequest } from '../models/BulkUpdateTagsRequest';
import type { SyncRequest } from '../models/SyncRequest';
import type { UpdateTagFieldRequest } from '../models/UpdateTagFieldRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AlbumsService {
    /**
     * List all albums
     * Returns a paginated list of albums in the collection.
     * Client-side filtering (FR-02/03) operates on the full in-memory result set
     * at ≤ 5 000 albums. Above the threshold the endpoint switches to server-side
     * pagination and the search/filter params are evaluated server-side (NFR-12).
     *
     * @returns AlbumPage Paginated list of albums
     * @throws ApiError
     */
    public static listAlbums({
        page,
        size = 20,
        albumArtist,
        composer,
        genre,
        yearFrom,
        yearTo,
        q,
    }: {
        /**
         * Zero-based page number
         */
        page?: number,
        /**
         * Page size (max 100)
         */
        size?: number,
        /**
         * Filter by album artist (case-insensitive contains)
         */
        albumArtist?: string,
        /**
         * Filter by composer (case-insensitive contains)
         */
        composer?: string,
        /**
         * Filter by exact genre (case-insensitive)
         */
        genre?: string,
        /**
         * Deprecated: the year range filter has been removed from the UI and will be removed from the API in a future version. Filter albums released on or after this year (inclusive)
         * @deprecated
         */
        yearFrom?: number,
        /**
         * Deprecated: the year range filter has been removed from the UI and will be removed from the API in a future version. Filter albums released on or before this year (inclusive)
         * @deprecated
         */
        yearTo?: number,
        /**
         * Free-text search across title, albumArtist, composer, label
         */
        q?: string,
    }): CancelablePromise<AlbumPage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/albums',
            query: {
                'page': page,
                'size': size,
                'albumArtist': albumArtist,
                'composer': composer,
                'genre': genre,
                'yearFrom': yearFrom,
                'yearTo': yearTo,
                'q': q,
            },
        });
    }
    /**
     * Get album detail with tracks
     * Returns a single album with all Vorbis Comment tag fields and a list of tracks.
     * @returns AlbumDetail Album detail
     * @throws ApiError
     */
    public static getAlbum({
        albumId,
    }: {
        /**
         * Album UUID
         */
        albumId: string,
    }): CancelablePromise<AlbumDetail> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/albums/{albumId}',
            path: {
                'albumId': albumId,
            },
            errors: {
                404: `Resource not found`,
            },
        });
    }
    /**
     * Update album-level tags
     * Writes updated tag values to FLAC files in the album directory.
     * Album-level fields (ALBUM, ALBUMARTIST, DATE, GENRE, LABEL, CATALOGNUMBER,
     * COMPOSER, CONDUCTOR, ENSEMBLE) are written to all files.
     * Writes are atomic per file (temp + rename). A .kbeatz-write.lock manifest
     * is created before the first write and removed on completion (FR-20).
     * Field names are case-insensitive (normalised to uppercase before validation).
     *
     * @returns AlbumDetail Tag updated; returns the refreshed album detail
     * @throws ApiError
     */
    public static updateAlbumTags({
        albumId,
        requestBody,
    }: {
        /**
         * Album UUID
         */
        albumId: string,
        requestBody: UpdateTagFieldRequest,
    }): CancelablePromise<AlbumDetail> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/albums/{albumId}',
            path: {
                'albumId': albumId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error`,
                404: `Resource not found`,
            },
        });
    }
    /**
     * Bulk update album and track tags in one request
     * Writes multiple album-level and track-level tag fields to FLAC files in a single
     * request. Album-level fields are written first (acquiring the per-album Mutex once),
     * then track-level fields are written in order.
     * This replaces N sequential PATCH requests with a single round-trip.
     * Album-level allowed fields: ALBUM, ALBUMARTIST, DATE, GENRE, LABEL, CATALOGNUMBER,
     * COMPOSER, CONDUCTOR, ENSEMBLE.
     * Track-level allowed fields: TITLE, TRACKNUMBER, ARTIST.
     * Field names are case-insensitive (normalised to uppercase before validation).
     *
     * @returns AlbumDetail All tags updated; returns the refreshed album detail
     * @throws ApiError
     */
    public static bulkUpdateAlbumTags({
        albumId,
        requestBody,
    }: {
        /**
         * Album UUID
         */
        albumId: string,
        requestBody: BulkUpdateTagsRequest,
    }): CancelablePromise<AlbumDetail> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/albums/{albumId}/tags',
            path: {
                'albumId': albumId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error`,
                404: `Resource not found`,
                409: `Write lock conflict - CLI is concurrently writing to the album directory. Retry after a short delay.`,
            },
        });
    }
    /**
     * Update track-level tags
     * Writes updated tag values to the single FLAC file for the specified track.
     * Track-level allowed fields: TITLE, TRACKNUMBER, ARTIST.
     * Field names are case-insensitive (normalised to uppercase before validation).
     * Write is atomic (temp + rename). No write-lock manifest for single-file writes.
     *
     * @returns AlbumDetail Tag updated; returns the refreshed album detail
     * @throws ApiError
     */
    public static updateTrackTags({
        albumId,
        trackId,
        requestBody,
    }: {
        /**
         * Album UUID
         */
        albumId: string,
        /**
         * Track UUID
         */
        trackId: string,
        requestBody: UpdateTagFieldRequest,
    }): CancelablePromise<AlbumDetail> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/albums/{albumId}/tracks/{trackId}',
            path: {
                'albumId': albumId,
                'trackId': trackId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error`,
                404: `Resource not found`,
            },
        });
    }
    /**
     * Get album cover art
     * Returns the front cover image.
     * Resolution order: embedded METADATA_BLOCK_PICTURE type 3 → folder.jpg → 404.
     *
     * @returns binary Cover image (JPEG or PNG)
     * @throws ApiError
     */
    public static getAlbumCover({
        albumId,
    }: {
        /**
         * Album UUID
         */
        albumId: string,
    }): CancelablePromise<Blob> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/albums/{albumId}/cover',
            path: {
                'albumId': albumId,
            },
            errors: {
                304: `Not Modified - browser or proxy cache is still valid.
                This response is emitted by the HTTP client or intermediary cache based
                on the Last-Modified and Cache-Control headers; the server always returns 200.
                `,
                400: `Validation error`,
                404: `Resource not found`,
            },
        });
    }
    /**
     * Sync album tags from Discogs
     * Fetches the Discogs release identified by the album's discogsId and writes
     * all standard Vorbis Comment tags to every FLAC file in the album directory.
     * Requires a metadata.yml (or id.txt) with a discogs_id in the album directory.
     * Images are only downloaded when downloadImages=true (default false) to
     * preserve the 1 000/day Discogs image quota.
     *
     * @returns Album Sync completed; returns the updated album
     * @throws ApiError
     */
    public static syncAlbumFromDiscogs({
        albumId,
        requestBody,
    }: {
        /**
         * Album UUID
         */
        albumId: string,
        requestBody?: SyncRequest,
    }): CancelablePromise<Album> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/albums/{albumId}/sync',
            path: {
                'albumId': albumId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error`,
                404: `Resource not found`,
                429: `Discogs rate limit or image quota exhausted`,
            },
        });
    }
}
