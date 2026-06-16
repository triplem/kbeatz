package org.javafreedom.kbeatz.sources.discogs

/**
 * Thrown when the Discogs API returns an HTTP error status that prevents the response body
 * from being deserialized into a domain object.
 *
 * @param statusCode The HTTP status code returned by Discogs.
 * @param releaseId The Discogs release ID that was requested.
 * @param message A human-readable description of the error.
 */
sealed class DiscogsHttpException(
    val statusCode: Int,
    val releaseId: String,
    message: String,
) : RuntimeException(message)

/**
 * Thrown when the Discogs API returns HTTP 429 Too Many Requests, indicating that the
 * client-side token bucket did not prevent all requests and the server-side rate limit
 * was reached.
 *
 * Callers should wait at least [retryAfterMs] milliseconds before retrying.
 *
 * @param releaseId The Discogs release ID that was requested.
 * @param retryAfterMs Milliseconds to wait before retrying, derived from the Retry-After
 *   response header (or a conservative default when the header is absent).
 */
class DiscogsRateLimitException(
    releaseId: String,
    val retryAfterMs: Long,
) : DiscogsHttpException(
    statusCode = 429,
    releaseId = releaseId,
    message = "Discogs rate limit exceeded for release $releaseId - retry after ${retryAfterMs}ms",
)

/**
 * Thrown when the Discogs API returns HTTP 404 Not Found, meaning no release exists
 * for the given [releaseId].
 *
 * @param releaseId The Discogs release ID that was not found.
 */
class DiscogsReleaseNotFoundException(
    releaseId: String,
) : DiscogsHttpException(
    statusCode = 404,
    releaseId = releaseId,
    message = "Discogs release not found: $releaseId",
)

/**
 * Thrown when the Discogs API returns an unexpected HTTP status code (e.g. 5xx server errors
 * or any other non-success status not handled by a more specific exception).
 *
 * @param statusCode The HTTP status code returned by Discogs.
 * @param releaseId The Discogs release ID that was requested.
 */
class DiscogsServerException(
    statusCode: Int,
    releaseId: String,
) : DiscogsHttpException(
    statusCode = statusCode,
    releaseId = releaseId,
    message = "Discogs API returned unexpected status $statusCode for release $releaseId",
)
