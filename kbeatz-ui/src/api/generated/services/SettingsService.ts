/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LayoutPreview } from '../models/LayoutPreview';
import type { LayoutSettings } from '../models/LayoutSettings';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SettingsService {
    /**
     * Get the active directory-layout template and supported tokens
     * Returns the directory-structure template currently configured by the operator
     * (HOCON `catalog.layout.directoryTemplate` / `CATALOG_LAYOUT_DIRECTORY_TEMPLATE`)
     * and the full set of metadata tokens it may reference. The template is read-only
     * from the UI: it is operator configuration, not a stored value. Use this to show
     * the active layout and its supported tokens before previewing or running a relayout.
     *
     * @returns LayoutSettings The active layout template and the supported tokens
     * @throws ApiError
     */
    public static getLayoutSettings(): CancelablePromise<LayoutSettings> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/settings/layout',
        });
    }
    /**
     * Preview the planned target directory for one album
     * Computes the directory the album would be placed in under the active template,
     * without writing anything to disk. Returns the album's current directory and the
     * planned directory side by side. When the planner rejects the album because the
     * rendered path would escape the library root (traversal guard), plannedDirectory
     * is null, withinLibraryRoot is false, and message explains why. This endpoint is a
     * pure read-only preview and stores nothing (it is distinct from the change-plan store).
     *
     * @returns LayoutPreview The current and planned directory for the album
     * @throws ApiError
     */
    public static getLayoutPreview({
        albumId,
    }: {
        /**
         * Album UUID
         */
        albumId: string,
    }): CancelablePromise<LayoutPreview> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/settings/layout/preview/{albumId}',
            path: {
                'albumId': albumId,
            },
            errors: {
                400: `Validation error`,
                404: `Resource not found`,
            },
        });
    }
}
