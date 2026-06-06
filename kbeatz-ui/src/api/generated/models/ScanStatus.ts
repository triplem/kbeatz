/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ScanStatus = {
    state: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    /**
     * Albums processed so far
     */
    scannedAlbums?: number;
    /**
     * Total albums found (null while discovery is still in progress)
     */
    totalAlbums?: number;
    startedAt?: string;
    completedAt?: string;
    /**
     * Set when state=FAILED
     */
    errorMessage?: string;
};

