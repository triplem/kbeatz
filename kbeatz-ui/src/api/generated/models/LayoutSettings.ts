/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The active directory-structure template and the metadata tokens it may reference.
 * The template is operator configuration and is read-only from the UI.
 *
 */
export type LayoutSettings = {
    /**
     * The active directory-structure template. Tokens use the ${TOKEN} syntax (for example
     * ALBUMARTIST/ALBUM (DATE) where each segment is a ${TOKEN}); the literal '/' is the
     * path-segment separator.
     *
     */
    directoryTemplate: string;
    /**
     * All metadata token names the template may reference (uppercase, without the ${} wrapper).
     */
    supportedTokens: Array<string>;
};

