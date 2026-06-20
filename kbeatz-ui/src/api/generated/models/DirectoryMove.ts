/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A planned directory relocation for one release. No move is performed by this value.
 */
export type DirectoryMove = {
    /**
     * The release being moved.
     */
    albumId: string;
    /**
     * The current absolute directory path.
     */
    fromPath: string;
    /**
     * The planned absolute target directory path.
     */
    toPath: string;
    /**
     * Additional merged source directories that also relocate.
     */
    mergedFromPaths: Array<string>;
};

