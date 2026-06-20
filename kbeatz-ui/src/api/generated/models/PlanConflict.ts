/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A condition that prevents or warns about applying part of a plan, surfaced as data.
 */
export type PlanConflict = {
    /**
     * The category of conflict.
     */
    type: 'TARGET_EXISTS' | 'PATH_TRAVERSAL' | 'SOURCE_MISSING' | 'LOCK_HELD';
    /**
     * The release the conflict relates to.
     */
    albumId: string;
    /**
     * The on-disk path involved, when applicable.
     */
    path?: string | null;
    /**
     * A human-readable explanation without secrets or stack traces.
     */
    message: string;
};

