import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HealthService {
    /**
     * Liveness and readiness probe
     * @returns HealthResponse Service is healthy
     * @throws ApiError
     */
    static healthCheck() {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/health',
            errors: {
                503: `Service is unhealthy`,
            },
        });
    }
}
