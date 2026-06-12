/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HealthResponse } from '../models/HealthResponse';
import type { LivenessResponse } from '../models/LivenessResponse';
import type { ReadinessResponse } from '../models/ReadinessResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HealthService {
    /**
     * Combined health probe (deprecated)
     * Deprecated since Kubernetes v1.16. Retained for backwards compatibility.
     * Use /livez and /readyz instead for Kubernetes deployments.
     *
     * @returns HealthResponse Service is healthy
     * @throws ApiError
     */
    public static healthCheck(): CancelablePromise<HealthResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/healthz',
            errors: {
                503: `Service is unhealthy`,
            },
        });
    }
    /**
     * Liveness probe
     * Returns 200 whenever the process is running, regardless of database state.
     * This endpoint performs no I/O and is guaranteed to respond within 100 ms.
     * Use as a Kubernetes livenessProbe target. Supports the --livez-grace-period
     * startup grace window when combined with a Kubernetes startupProbe.
     * Note: K8s-idiomatic path names (/livez, /readyz) are used instead of
     * /health/live and /health/ready per implementation decision for issue #293.
     *
     * @returns LivenessResponse Process is alive
     * @throws ApiError
     */
    public static livenessProbe(): CancelablePromise<LivenessResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/livez',
        });
    }
    /**
     * Readiness probe
     * Returns 200 when the database connection is available.
     * Returns 503 with an ErrorResponse body when the database is unreachable.
     * The probe uses a short circuit-break (single lightweight query) and is
     * guaranteed to respond within 100 ms.
     * Use as a Kubernetes readinessProbe target. Pair with --shutdown-delay-duration
     * for graceful shutdown.
     * Note: K8s-idiomatic path names (/livez, /readyz) are used instead of
     * /health/live and /health/ready per implementation decision for issue #293.
     *
     * @returns ReadinessResponse Service is ready to accept traffic
     * @throws ApiError
     */
    public static readinessProbe(): CancelablePromise<ReadinessResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/readyz',
            errors: {
                503: `Service is not ready - database is unreachable`,
            },
        });
    }
}
