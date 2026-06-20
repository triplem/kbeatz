/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChangePlanOperation } from './ChangePlanOperation';
/**
 * Request to compute a dry-run change plan for one or many releases.
 */
export type CreateChangePlanRequest = {
    operation: ChangePlanOperation;
    /**
     * The releases to include in the plan. Must contain at least one album UUID.
     */
    albumIds: Array<string>;
};

