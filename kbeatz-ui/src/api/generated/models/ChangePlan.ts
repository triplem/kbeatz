/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChangePlanOperation } from './ChangePlanOperation';
import type { ReleaseChangeSet } from './ReleaseChangeSet';
/**
 * A consolidated dry-run plan describing every directory move and tag change for one
 * or many releases under a single operation. Producing a plan performs zero disk writes.
 *
 */
export type ChangePlan = {
    /**
     * Unique identifier for this plan instance.
     */
    id: string;
    operation: ChangePlanOperation;
    /**
     * The per-release change sets, one entry per requested release.
     */
    releases: Array<ReleaseChangeSet>;
    /**
     * When the plan was assembled.
     */
    createdAt: string;
    /**
     * The total number of directory moves across all releases.
     */
    totalMoves: number;
    /**
     * The total number of tag changes across all releases.
     */
    totalTagChanges: number;
    /**
     * The total number of conflicts across all releases.
     */
    totalConflicts: number;
    /**
     * True when any release in the plan has at least one conflict.
     */
    hasConflicts: boolean;
};

