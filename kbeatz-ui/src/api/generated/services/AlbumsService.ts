/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Album } from '../models/Album';
import type { AlbumPage } from '../models/AlbumPage';
import type { SyncRequest } from '../models/SyncRequest';
import type { UpdateAlbumTagsRequest } from '../models/UpdateAlbumTagsRequest';
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
         * Filter by exact genre
         */
        genre?: string,
        /**
         * Filter albums released on or after this year
         */
        yearFrom?: number,
        /**
         * Filter albums released on or before this year
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
     * Get album detail
     * Returns a single album with all Vorbis Comment tag fields.
     * @returns Album Album detail
     * @throws ApiError
     */
    public static getAlbum({
        albumId,
    }: {
        /**
         * Album UUID
         */
        albumId: string,
    }): CancelablePromise<Album> {
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
     * Update album tags
     * Writes updated tag values to FLAC files in the album directory.
     * Album-level fields (ALBUM, ALBUMARTIST, DATE, GENRE, LABEL, CATALOGNUMBER,
     * COMPOSER, CONDUCTOR, ENSEMBLE) are written to all files. Track-level fields
     * (TITLE, TRACKNUMBER) require a track-scoped endpoint (future).
     * Writes are atomic per file (temp + rename). A .kbeatz-write.lock manifest
     * is created before the first write and removed on completion (FR-20).
     *
     * @returns Album Tags updated; returns the refreshed album
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
        requestBody: UpdateAlbumTagsRequest,
    }): CancelablePromise<Album> {
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
