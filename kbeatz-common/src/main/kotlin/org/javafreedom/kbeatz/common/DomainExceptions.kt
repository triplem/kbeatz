package org.javafreedom.kbeatz.common

sealed class DomainException(message: String) : RuntimeException(message)

class ResourceNotFoundException(resource: String, id: String) : DomainException("$resource '$id' not found")
class BusinessValidationException(message: String) : DomainException(message)
class ConflictException(message: String) : DomainException(message)
