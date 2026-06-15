package org.javafreedom.kbeatz.catalog.application.service

import io.mockk.mockk
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository

/**
 * Unit tests for [LibraryScanService.isPathOutsideRoot].
 *
 * The function is `internal` so it can be tested directly without reflection.
 * All boundary cases from issue #710 are covered:
 * - `".."` - the directory itself is the parent
 * - `"../disc2/track.flac"` - starts with `../`
 * - `"sub/../../other/track.flac"` - contains `/../` mid-path
 * - `"disc1/track.flac"` - normal relative path, must return false
 * - `""` - empty string, must return false
 */
class LibraryScanServicePathTest {

    private val svc = LibraryScanService(
        libraryRoot = Path.of("/music"),
        walker = mockk(),
        albumRepository = mockk<AlbumRepository>(),
        trackRepository = mockk<TrackRepository>(),
    )

    @Test
    fun `relativePath of just two dots is outside root`() {
        assertTrue(svc.isPathOutsideRoot(".."), "\"..\" must be detected as outside root")
    }

    @Test
    fun `relativePath starting with parent traversal is outside root`() {
        assertTrue(
            svc.isPathOutsideRoot("../disc2/track.flac"),
            "\"../disc2/track.flac\" must be detected as outside root",
        )
    }

    @Test
    fun `relativePath containing mid-path parent traversal is outside root`() {
        assertTrue(
            svc.isPathOutsideRoot("sub/../../other/track.flac"),
            "\"sub/../../other/track.flac\" must be detected as outside root",
        )
    }

    @Test
    fun `normal relative path is not outside root`() {
        assertFalse(
            svc.isPathOutsideRoot("disc1/track.flac"),
            "\"disc1/track.flac\" must not be detected as outside root",
        )
    }

    @Test
    fun `empty string is not outside root`() {
        assertFalse(
            svc.isPathOutsideRoot(""),
            "empty string must not be detected as outside root",
        )
    }

    @Test
    fun `single filename with no separator is not outside root`() {
        assertFalse(
            svc.isPathOutsideRoot("track.flac"),
            "\"track.flac\" must not be detected as outside root",
        )
    }

    @Test
    fun `deeply nested path is not outside root`() {
        assertFalse(
            svc.isPathOutsideRoot("disc1/side-a/01 - So What.flac"),
            "deep path without traversal must not be detected as outside root",
        )
    }

    @Test
    fun `path ending with two dots is not treated as traversal`() {
        // A file or directory legitimately named ".." at the end would be unusual
        // but the function only checks `== ".."`, `startsWith("../")`, or `contains("/../")`
        // so "subdir/.." is NOT caught. This documents the current behaviour.
        // (Java's Path.relativize never produces "subdir/.." - it normalises first.)
        assertFalse(
            svc.isPathOutsideRoot("subdir/.."),
            "\"subdir/..\" does not match any traversal pattern in the current implementation",
        )
    }
}
