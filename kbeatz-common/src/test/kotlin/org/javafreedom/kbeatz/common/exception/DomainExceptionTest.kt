package org.javafreedom.kbeatz.common.exception

import org.javafreedom.kbeatz.common.BusinessValidationException
import org.javafreedom.kbeatz.common.ConflictException
import org.javafreedom.kbeatz.common.DomainException
import org.javafreedom.kbeatz.common.ResourceNotFoundException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class DomainExceptionTest {

    @Test
    fun `ResourceNotFoundException message should include resource and id`() {
        val ex = ResourceNotFoundException("Album", "abc-123")

        assertEquals("Album 'abc-123' not found", ex.message)
    }

    @Test
    fun `ResourceNotFoundException should be a DomainException`() {
        val ex = ResourceNotFoundException("Track", "xyz")

        assertIs<DomainException>(ex)
    }

    @Test
    fun `ResourceNotFoundException should be a RuntimeException`() {
        val ex = ResourceNotFoundException("Track", "xyz")

        assertIs<RuntimeException>(ex)
    }

    @Test
    fun `BusinessValidationException should carry provided message`() {
        val ex = BusinessValidationException("Title must not be blank")

        assertEquals("Title must not be blank", ex.message)
    }

    @Test
    fun `BusinessValidationException should be a DomainException`() {
        val ex = BusinessValidationException("invalid input")

        assertIs<DomainException>(ex)
    }

    @Test
    fun `ConflictException should carry provided message`() {
        val ex = ConflictException("Release already exists")

        assertEquals("Release already exists", ex.message)
    }

    @Test
    fun `ConflictException should be a DomainException`() {
        val ex = ConflictException("duplicate")

        assertIs<DomainException>(ex)
    }

    @Test
    fun `DomainException sealed subclasses should be exhaustively testable`() {
        val exceptions: List<DomainException> = listOf(
            ResourceNotFoundException("R", "1"),
            BusinessValidationException("bad"),
            ConflictException("dup"),
        )

        assertTrue(exceptions.all { it is DomainException })
        assertEquals(3, exceptions.size)
    }
}
