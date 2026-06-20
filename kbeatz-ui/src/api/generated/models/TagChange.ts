/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A single proposed tag-field change for a target file or scope.
 */
export type TagChange = {
    /**
     * Identifies the file or scope the change applies to.
     */
    targetPath: string;
    /**
     * The Vorbis Comment field name.
     */
    field: string;
    /**
     * The current value, or null when the field is absent.
     */
    currentValue?: string | null;
    /**
     * The proposed value, or null when the field is removed.
     */
    proposedValue?: string | null;
};

