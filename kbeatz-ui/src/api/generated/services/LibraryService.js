import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class LibraryService {
    /**
     * Trigger a library scan
     * Scans all FLAC files under the configured library root and rebuilds
     * the metadata index. Returns immediately; poll /library/scan/status
     * for progress.
     *
     * @returns ScanStatus Scan accepted and started
     * @throws ApiError
     */
    static triggerLibraryScan() {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/library/scan',
        });
    }
    /**
     * Get library scan status
     * Returns the status of the most recent (or in-progress) library scan.
     * @returns ScanStatus Current scan status
     * @throws ApiError
     */
    static getLibraryScanStatus() {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/library/scan/status',
        });
    }
}
