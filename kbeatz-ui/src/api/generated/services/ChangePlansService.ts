/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApplyChangePlanResult } from '../models/ApplyChangePlanResult';
import type { ChangePlan } from '../models/ChangePlan';
import type { CreateChangePlanRequest } from '../models/CreateChangePlanRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ChangePlansService {
    /**
     * Compute a dry-run change plan for one or many releases
     * Computes a consolidated dry-run ChangePlan for the requested releases under a
     * single operation. No disk writes occur: only read-only filesystem checks are used
     * to detect conflicts. Conflicts (target exists, lock held, source missing, path
     * traversal) are returned as data inside the plan, not as request failures. The
     * returned plan is stored and can be retrieved by id for a later apply step.
     *
     * @returns ChangePlan Plan computed and stored. The Location header points to the stored plan.
     * @throws ApiError
     */
    public static createChangePlan({
        requestBody,
    }: {
        requestBody: CreateChangePlanRequest,
    }): CancelablePromise<ChangePlan> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/change-plans',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error`,
                422: `The requested operation is not available via this generic endpoint. RELAYOUT and DISCOGS_SYNC are supported; RETAG carries no proposed field values here and is performed through PATCH /albums/{albumId}/tags instead.`,
            },
        });
    }
    /**
     * Retrieve a previously computed change plan by id
     * Returns the stored dry-run ChangePlan identified by planId, for review or apply.
     * @returns ChangePlan The stored change plan
     * @throws ApiError
     */
    public static getChangePlan({
        planId,
    }: {
        /**
         * Change plan UUID
         */
        planId: string,
    }): CancelablePromise<ChangePlan> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/change-plans/{planId}',
            path: {
                'planId': planId,
            },
            errors: {
                400: `Validation error`,
                404: `Resource not found`,
            },
        });
    }
    /**
     * Apply a previously computed change plan by id
     * Applies the stored dry-run ChangePlan identified by planId. This call is the user's
     * confirmation: no directory is moved and no tag is written until this endpoint is invoked.
     * Each release is applied as an atomic, lock-protected, crash-recoverable unit; a single
     * release failure does not abort the batch. Releases that carry conflicts are skipped.
     * Re-applying the same plan is a safe idempotent no-op: an already-moved release reconciles
     * to APPLIED without error. Per-release problems are reported inside the 200 result body
     * (per release: APPLIED, SKIPPED or FAILED), never as an error status code.
     *
     * @returns ApplyChangePlanResult The plan was processed. Per-release outcomes are in the body.
     * @throws ApiError
     */
    public static applyChangePlan({
        planId,
    }: {
        /**
         * Change plan UUID
         */
        planId: string,
    }): CancelablePromise<ApplyChangePlanResult> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/change-plans/{planId}/apply',
            path: {
                'planId': planId,
            },
            errors: {
                400: `Validation error`,
                404: `Resource not found`,
            },
        });
    }
}
