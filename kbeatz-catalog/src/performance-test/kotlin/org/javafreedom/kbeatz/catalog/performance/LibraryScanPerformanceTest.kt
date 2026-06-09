package org.javafreedom.kbeatz.catalog.performance

import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.createDirectories
import kotlin.io.path.writeBytes
import kotlin.test.Test
import kotlin.test.assertTrue
import org.javafreedom.kbeatz.catalog.application.service.LibraryWalker

/**
 * Performance test for [LibraryWalker]: verifies the 2 000-album scan target from NFR (Epic #14).
 *
 * These tests are intentionally slow (they create thousands of real files) and must not run on
 * every PR. A dedicated `performanceTest` Gradle task keeps them opt-in.
 *
 * ## Performance targets (Epic #14)
 * - 2 000 albums scanned in <= 60 seconds
 */
class LibraryScanPerformanceTest {

    companion object {
        private const val PERF_ALBUM_COUNT = 2_000
        private const val SCAN_TIMEOUT_MS = 60_000L
        // Used to spread 2000 albums across 200 artist directories (10 albums each)
        private const val ARTIST_MODULUS = 200

        /**
         * Builds a minimal FLAC file containing the fLaC stream marker, a STREAMINFO metadata
         * block (all zeroes - not playable), and a VorbisComment block with ALBUMARTIST, ALBUM,
         * and DATE tags.
         *
         * This is the minimum structure that [LibraryWalker] needs to read tags from a FLAC file.
         */
        @Suppress("MagicNumber") // FLAC binary format constants per RFC 9639 section 9
        private fun buildMinimalFlac(
            albumArtist: String = "Perf Artist",
            album: String = "Perf Album",
            date: String = "2000",
        ): ByteArray {
            val vendorStr = "perf".toByteArray(Charsets.UTF_8)
            val comments = listOf(
                "ALBUMARTIST=$albumArtist",
                "ALBUM=$album",
                "DATE=$date",
            ).map { it.toByteArray(Charsets.UTF_8) }

            val vcBody = buildVorbisCommentBody(vendorStr, comments)

            // StreamInfo block: block type 0, last-metadata=false, length=34
            val streamInfoHeader = byteArrayOf(
                0x00,              // block type 0 (STREAMINFO), last-metadata = false
                0x00, 0x00, 0x22, // length = 34
            )
            val streamInfoData = ByteArray(34) // zeroed - not playable but structurally valid

            // VorbisComment block: block type 4, last-metadata=true
            val vcHeader = byteArrayOf(
                (0x04 or 0x80).toByte(),                   // block type 4, last-metadata = true
                ((vcBody.size shr 16) and 0xFF).toByte(),  // length high byte
                ((vcBody.size shr 8) and 0xFF).toByte(),   // length mid byte
                (vcBody.size and 0xFF).toByte(),            // length low byte
            )

            return byteArrayOf(0x66, 0x4C, 0x61, 0x43) + // "fLaC"
                streamInfoHeader + streamInfoData +
                vcHeader + vcBody
        }

        @Suppress("MagicNumber") // bit-shift amounts are part of the 32-bit LE encoding
        private fun buildVorbisCommentBody(
            vendor: ByteArray,
            comments: List<ByteArray>,
        ): ByteArray {
            val buf = mutableListOf<Byte>()
            fun writeU32LE(v: Int) {
                buf.add((v and 0xFF).toByte())
                buf.add(((v shr 8) and 0xFF).toByte())
                buf.add(((v shr 16) and 0xFF).toByte())
                buf.add(((v shr 24) and 0xFF).toByte())
            }
            writeU32LE(vendor.size)
            vendor.forEach { buf.add(it) }
            writeU32LE(comments.size)
            comments.forEach { c ->
                writeU32LE(c.size)
                c.forEach { buf.add(it) }
            }
            return buf.toByteArray()
        }
    }

    /**
     * Creates [PERF_ALBUM_COUNT] album directories each containing one minimal FLAC file, then
     * asserts that [LibraryWalker.walk] completes within [SCAN_TIMEOUT_MS] milliseconds.
     */
    @Suppress("FunctionNaming") // backtick test name is idiomatic Kotlin; plain name would be less readable
    @Test
    fun `library walk of 2000 albums completes within 60 seconds`() {
        val root = Files.createTempDirectory("kbeatz-perf-2k")
        try {
            populate(root, PERF_ALBUM_COUNT)

            val walker = LibraryWalker()
            val startMs = System.currentTimeMillis()
            val groups = walker.walk(root)
            val elapsedMs = System.currentTimeMillis() - startMs

            assertTrue(
                groups.size >= PERF_ALBUM_COUNT,
                "Expected >= $PERF_ALBUM_COUNT album groups, got ${groups.size}",
            )
            assertTrue(
                elapsedMs <= SCAN_TIMEOUT_MS,
                "Walk of $PERF_ALBUM_COUNT albums took ${elapsedMs}ms (target: ${SCAN_TIMEOUT_MS}ms)",
            )
        } finally {
            root.toFile().deleteRecursively()
        }
    }

    /**
     * Populates [root] with [albumCount] album directories.
     * Albums are spread across [ARTIST_MODULUS] artist directories (approximately 10 albums each).
     * Each directory contains one "track-01.flac" with ALBUMARTIST, ALBUM, and DATE tags.
     */
    private fun populate(root: Path, albumCount: Int) {
        for (i in 1..albumCount) {
            val artist = "Artist ${i % ARTIST_MODULUS}"
            val album = "Album $i"
            val flac = buildMinimalFlac(albumArtist = artist, album = album, date = "2000")
            val albumDir = root.resolve("$artist/$album").createDirectories()
            albumDir.resolve("track-01.flac").writeBytes(flac)
        }
    }
}
