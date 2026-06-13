/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ScanErrorEntry } from './ScanErrorEntry';
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
    /**
     * Per-album scan errors (up to 50 entries). Present when one or more albums could not be scanned.
     */
    errors?: Array<ScanErrorEntry>;
    /**
     * Total number of per-album errors including those beyond the 50-item cap in errors
     */
    totalErrors?: number;
};

