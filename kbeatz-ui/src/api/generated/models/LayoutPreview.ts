/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A read-only preview of where one album would be placed under the active template.
 * plannedDirectory is null and message is set when the planner rejects the album
 * (its rendered path would escape the library root).
 *
 */
export type LayoutPreview = {
    /**
     * The album the preview was computed for.
     */
    albumId: string;
    /**
     * The album's current directory path, relative to the library root.
     */
    currentDirectory: string;
    /**
     * The planned directory path relative to the library root, or null when the planner rejects the album.
     */
    plannedDirectory?: string | null;
    /**
     * True when the planned directory stays inside the library root; false when the traversal guard rejects it.
     */
    withinLibraryRoot: boolean;
    /**
     * A human-readable explanation when the album is rejected; null on a successful preview.
     */
    message?: string | null;
};

