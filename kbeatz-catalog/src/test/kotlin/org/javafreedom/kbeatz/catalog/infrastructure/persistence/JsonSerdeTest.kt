package org.javafreedom.kbeatz.catalog.infrastructure.persistence

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import org.javafreedom.kbeatz.catalog.domain.model.ImageDescriptor
import org.javafreedom.kbeatz.catalog.domain.model.ImageSource

class JsonSerdeTest {

    @Test
    fun `encodeImages and decodeImages round-trip a single image`() {
        val images = listOf(
            ImageDescriptor(
                pictureType = 3,
                source = ImageSource.FILE,
                path = "folder.jpg",
                mimeType = "image/jpeg",
                description = "Front cover",
            ),
        )
        val encoded = JsonSerde.encodeImages(images)
        assertNotNull(encoded)
        val decoded = JsonSerde.decodeImages(encoded)
        assertNotNull(decoded)
        assertEquals(1, decoded.size)
        assertEquals(3, decoded[0].pictureType)
        assertEquals(ImageSource.FILE, decoded[0].source)
        assertEquals("folder.jpg", decoded[0].path)
        assertEquals("image/jpeg", decoded[0].mimeType)
        assertEquals("Front cover", decoded[0].description)
    }

    @Test
    fun `encodeImages and decodeImages round-trip embedded image`() {
        val images = listOf(
            ImageDescriptor(
                pictureType = 3,
                source = ImageSource.EMBEDDED,
                path = "01 - Track.flac",
                mimeType = "image/png",
                description = "",
            ),
        )
        val encoded = JsonSerde.encodeImages(images)
        assertNotNull(encoded)
        val decoded = JsonSerde.decodeImages(encoded)
        assertNotNull(decoded)
        assertEquals(ImageSource.EMBEDDED, decoded[0].source)
    }

    @Test
    fun `encodeImages returns null for null input`() {
        assertNull(JsonSerde.encodeImages(null))
    }

    @Test
    fun `encodeImages returns null for empty list`() {
        assertNull(JsonSerde.encodeImages(emptyList()))
    }

    @Test
    fun `decodeImages returns null for null input`() {
        assertNull(JsonSerde.decodeImages(null))
    }

    @Test
    fun `decodeImages returns null for blank input`() {
        assertNull(JsonSerde.decodeImages(""))
        assertNull(JsonSerde.decodeImages("  "))
    }

    @Test
    fun `encodeExtraTags and decodeExtraTags round-trip a map`() {
        val tags = mapOf("BARCODE" to "012345678", "STYLE" to "Modal Jazz")
        val encoded = JsonSerde.encodeExtraTags(tags)
        assertNotNull(encoded)
        val decoded = JsonSerde.decodeExtraTags(encoded)
        assertNotNull(decoded)
        assertEquals("012345678", decoded["BARCODE"])
        assertEquals("Modal Jazz", decoded["STYLE"])
    }

    @Test
    fun `encodeExtraTags returns null for null input`() {
        assertNull(JsonSerde.encodeExtraTags(null))
    }

    @Test
    fun `encodeExtraTags returns null for empty map`() {
        assertNull(JsonSerde.encodeExtraTags(emptyMap()))
    }

    @Test
    fun `decodeExtraTags returns null for null input`() {
        assertNull(JsonSerde.decodeExtraTags(null))
    }

    @Test
    fun `decodeExtraTags returns null for blank input`() {
        assertNull(JsonSerde.decodeExtraTags(""))
    }
}
