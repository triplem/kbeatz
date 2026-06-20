/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The outcome of applying a single release within a change plan. APPLIED: the change was
 * written to disk (or reconciled as an idempotent no-op). SKIPPED: the release had conflicts
 * and was left untouched. FAILED: applying the release raised an error; the atomic executor
 * guarantees the release is not left half-applied.
 *
 */
export type ReleaseApplyOutcome = 'APPLIED' | 'SKIPPED' | 'FAILED';
