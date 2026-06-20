/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ReleaseApplyOutcome } from './ReleaseApplyOutcome';
/**
 * The result of applying one release within a change plan.
 */
export type ReleaseApplyResult = {
    /**
     * The release this result describes.
     */
    albumId: string;
    outcome: ReleaseApplyOutcome;
    /**
     * A human-readable explanation for a SKIPPED or FAILED outcome (no PII or secrets).
     */
    message?: string | null;
};

