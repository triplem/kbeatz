package org.javafreedom.kbeatz.common

sealed class DomainException(message: String) : RuntimeException(message)

class ResourceNotFoundException(resource: String, id: String) : DomainException("$resource '$id' not found")
class BusinessValidationException(message: String) : DomainException(message)
class ConflictException(message: String) : DomainException(message)

/**
 * Thrown when a Discogs image download is attempted but the daily quota (1 000/day) is exhausted.
 *
 * @param resetAt UTC timestamp (ISO 8601) of when the quota will reset (midnight UTC).
 */
class ImageQuotaExhaustedException(val resetAt: String) : DomainException(
    "Discogs daily image quota exhausted. Quota resets at $resetAt"
)
