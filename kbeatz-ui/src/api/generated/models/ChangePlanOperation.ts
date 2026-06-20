/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The kind of bulk operation a change plan describes. RELAYOUT moves release
 * directories to match the configured template. RETAG applies manual tag values.
 * DISCOGS_SYNC applies tag values sourced from a Discogs release.
 *
 */
export type ChangePlanOperation = 'RELAYOUT' | 'RETAG' | 'DISCOGS_SYNC';
