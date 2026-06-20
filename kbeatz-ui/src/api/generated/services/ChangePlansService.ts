/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
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
                422: `The requested operation is not available in this iteration (RETAG and DISCOGS_SYNC dry runs ship later)`,
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
}
