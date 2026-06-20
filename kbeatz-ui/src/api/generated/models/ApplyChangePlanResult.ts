/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ReleaseApplyResult } from './ReleaseApplyResult';
/**
 * The aggregate result of applying a change plan. Reports a per-release outcome and the
 * counts of applied, skipped, and failed releases.
 *
 */
export type ApplyChangePlanResult = {
    /**
     * The id of the plan that was applied.
     */
    planId: string;
    /**
     * The per-release apply results, one entry per release in the plan.
     */
    releases: Array<ReleaseApplyResult>;
    /**
     * The number of releases applied successfully.
     */
    appliedCount: number;
    /**
     * The number of releases skipped because of conflicts.
     */
    skippedCount: number;
    /**
     * The number of releases that failed to apply.
     */
    failedCount: number;
};

