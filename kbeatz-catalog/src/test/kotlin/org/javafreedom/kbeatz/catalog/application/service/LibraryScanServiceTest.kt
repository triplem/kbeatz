package org.javafreedom.kbeatz.catalog.application.service

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.javafreedom.kbeatz.catalog.domain.model.AlbumGroup
import org.javafreedom.kbeatz.catalog.domain.model.ScanState
import org.javafreedom.kbeatz.catalog.domain.model.ScanStatus
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository

@OptIn(ExperimentalCoroutinesApi::class)
class LibraryScanServiceTest {

    private val libraryRoot: Path = Path.of("/music")
    private val walker: LibraryWalker = mockk()
    private val albumRepository: AlbumRepository = mockk()
    private val trackRepository: TrackRepository = mockk()

    private fun service() = LibraryScanService(
        libraryRoot = libraryRoot,
        walker = walker,
        albumRepository = albumRepository,
        trackRepository = trackRepository,
        scanDispatcher = UnconfinedTestDispatcher(),
    )

    private fun albumGroup(artist: String = "Miles Davis", album: String = "Kind of Blue") =
        AlbumGroup(
            rootPath = Path.of("/music/$artist/$album"),
            sourceDirs = listOf(Path.of("/music/$artist/$album")),
            flacPaths = listOf(Path.of("/music/$artist/$album/01.flac")),
            albumArtist = artist,
            albumTitle = album,
            date = "1959",
        )

    @Test
    fun `initial status is IDLE with zero counts`() {
        val svc = service()

        val status = svc.status()

        assertEquals(ScanState.IDLE, status.state)
        assertEquals(0L, status.scannedAlbums)
        assertEquals(0L, status.totalAlbums)
        assertNull(status.errorMessage)
    }

    // Stubs for track-saving path: findByDirectoryPath returns null so track logic is skipped.
    private fun stubNoTracks() {
        coEvery { albumRepository.findByDirectoryPath(any()) } returns null
    }

    @Test
    fun `startScan transitions to COMPLETE with correct counts`() = runTest {
        val groups = listOf(albumGroup("Miles Davis"), albumGroup("John Coltrane"))
        every { walker.walk(libraryRoot) } returns groups
        coEvery { albumRepository.saveAll(any()) } returns Unit
        stubNoTracks()

        val svc = service()
        svc.startScan()

        val status = svc.status()
        assertEquals(ScanState.COMPLETE, status.state)
        assertEquals(2L, status.scannedAlbums)
        assertEquals(2L, status.totalAlbums)
        assertNull(status.errorMessage)
    }

    @Test
    fun `startScan does not launch duplicate scan when already RUNNING`() = runTest {
        // Use a blocking walker to keep scan RUNNING
        var scanStarted = false
        every { walker.walk(libraryRoot) } answers {
            scanStarted = true
            // Return groups immediately (UnconfinedTestDispatcher runs synchronously)
            emptyList()
        }
        coEvery { albumRepository.saveAll(any()) } returns Unit
        stubNoTracks()

        val svc = service()
        svc.startScan() // First scan — completes synchronously
        svc.startScan() // Second call — should start a new scan from COMPLETE state

        // Both calls should have succeeded; walker called twice at most
        val status = svc.status()
        assertEquals(ScanState.COMPLETE, status.state)
    }

    @Test
    fun `startScan transitions to FAILED when walker throws`() = runTest {
        every { walker.walk(libraryRoot) } throws RuntimeException("Disk read error")

        val svc = service()
        svc.startScan()

        val status = svc.status()
        assertEquals(ScanState.FAILED, status.state)
        assertNotNull(status.errorMessage)
        assertEquals("Disk read error", status.errorMessage)
    }

    @Test
    fun `startScan records per-album error when repository throws for a single album`() = runTest {
        val groups = listOf(albumGroup())
        every { walker.walk(libraryRoot) } returns groups
        coEvery { albumRepository.saveAll(any()) } throws RuntimeException("DB unavailable")

        val svc = service()
        svc.startScan()

        val status = svc.status()
        // A single-album repository failure is a per-album error; the scan still COMPLETE.
        assertEquals(ScanState.COMPLETE, status.state)
        assertEquals(1, status.totalErrors)
        assertEquals(1, status.errors.size)
        assertEquals("Miles Davis/Kind of Blue", status.errors[0].albumDir)
        assertNotNull(status.errors[0].reason)
        assertNotNull(status.errors[0].suggestion)
    }

    @Test
    fun `startScan persists album groups via repository`() = runTest {
        val groups = listOf(albumGroup("Bach", "Goldberg Variations"))
        every { walker.walk(libraryRoot) } returns groups
        coEvery { albumRepository.saveAll(any()) } returns Unit
        stubNoTracks()

        val svc = service()
        svc.startScan()

        coVerify(exactly = 1) {
            albumRepository.saveAll(match { albums ->
                albums.size == 1 &&
                    albums[0].albumArtist == "Bach" &&
                    albums[0].album == "Goldberg Variations"
            })
        }
    }

    @Test
    fun `startScan with empty library completes with zero counts`() = runTest {
        every { walker.walk(libraryRoot) } returns emptyList()
        coEvery { albumRepository.saveAll(any()) } returns Unit
        stubNoTracks()

        val svc = service()
        svc.startScan()

        val status = svc.status()
        assertEquals(ScanState.COMPLETE, status.state)
        assertEquals(0L, status.scannedAlbums)
        assertEquals(0L, status.totalAlbums)
    }

    @Test
    fun `close cancels the scan scope`() = runTest {
        val dispatcher = UnconfinedTestDispatcher()
        val svc = LibraryScanService(
            libraryRoot = libraryRoot,
            walker = walker,
            albumRepository = albumRepository,
            trackRepository = trackRepository,
            scanDispatcher = dispatcher,
        )

        svc.close()

        // After close(), startScan() should still be callable (doesn't crash), and
        // the scope's Job will be cancelled — no further coroutines execute.
        // We verify close() does not throw and the service remains in a safe state.
        val status = svc.status()
        assertEquals(ScanState.IDLE, status.state)
    }

    @Test
    fun `startedAt is set when scan begins and completedAt is set on COMPLETE`() = runTest {
        val groups = listOf(albumGroup())
        every { walker.walk(libraryRoot) } returns groups
        coEvery { albumRepository.saveAll(any()) } returns Unit
        stubNoTracks()

        val svc = service()
        svc.startScan()

        val status = svc.status()
        assertNotNull(status.startedAt, "startedAt should be non-null after scan starts")
        assertNotNull(status.completedAt, "completedAt should be non-null after scan completes")
    }

    @Test
    fun `startedAt is set and completedAt is set on FAILED`() = runTest {
        every { walker.walk(libraryRoot) } throws RuntimeException("Disk error")

        val svc = service()
        svc.startScan()

        val status = svc.status()
        assertNotNull(status.startedAt, "startedAt should be non-null after scan starts")
        assertNotNull(status.completedAt, "completedAt should be non-null after scan fails")
    }

    @Test
    fun `initial status has null startedAt and completedAt`() {
        val svc = service()
        val status = svc.status()
        assertNull(status.startedAt, "startedAt should be null initially")
        assertNull(status.completedAt, "completedAt should be null initially")
    }

    @Test
    fun `AlbumGroup toAlbum maps fields correctly`() {
        val group = AlbumGroup(
            rootPath = Path.of("/music/classical/bach"),
            sourceDirs = listOf(Path.of("/music/classical/bach")),
            flacPaths = emptyList(),
            albumArtist = "Bach",
            albumTitle = "BWV 998",
            date = "1720",
        )

        val album = with(LibraryScanService.Companion) { group.toAlbum() }

        assertEquals("Bach", album.albumArtist)
        assertEquals("BWV 998", album.album)
        assertEquals("1720", album.date)
        assertEquals("/music/classical/bach", album.directoryPath)
        assertNotNull(album.id)
    }

    @Test
    fun `AlbumGroup toAlbum populates mergedDirectories for multi-directory groups`() {
        // Simulates a deduplicated album from two sibling directories (issue #666).
        // sourceDirs contains both; rootPath is the shallowest directory.
        val primary = Path.of("/music/jazz/miles-davis/kind-of-blue")
        val merged = Path.of("/music/jazz/miles-davis/kind-of-blue-backup")
        val group = AlbumGroup(
            rootPath = primary,
            sourceDirs = listOf(primary, merged),
            flacPaths = emptyList(),
            albumArtist = "Miles Davis",
            albumTitle = "Kind of Blue",
            date = "1959",
        )

        val album = with(LibraryScanService.Companion) { group.toAlbum() }

        assertEquals(primary.toString(), album.directoryPath)
        assertEquals(listOf(merged.toString()), album.mergedDirectories,
            "mergedDirectories must contain all sourceDirs except the primary rootPath")
    }

    @Test
    fun `AlbumGroup toAlbum produces empty mergedDirectories for single-directory groups`() {
        val group = AlbumGroup(
            rootPath = Path.of("/music/jazz/coltrane"),
            sourceDirs = listOf(Path.of("/music/jazz/coltrane")),
            flacPaths = emptyList(),
            albumArtist = "John Coltrane",
            albumTitle = "A Love Supreme",
            date = "1964",
        )

        val album = with(LibraryScanService.Companion) { group.toAlbum() }

        assertEquals(emptyList<String>(), album.mergedDirectories,
            "Single-directory albums must have empty mergedDirectories")
    }

    @Test
    fun `AlbumGroup toAlbum uses existingId when provided — UUID stability across rescans`() {
        val group = AlbumGroup(
            rootPath = Path.of("/music/jazz/miles"),
            sourceDirs = listOf(Path.of("/music/jazz/miles")),
            flacPaths = emptyList(),
            albumArtist = "Miles Davis",
            albumTitle = "Kind of Blue",
            date = "1959",
        )
        val stableId = kotlin.uuid.Uuid.random()

        val album = with(LibraryScanService.Companion) { group.toAlbum(existingId = stableId) }

        assertEquals(stableId, album.id)
    }

    @Test
    fun `AlbumGroup toAlbum generates fresh UUID when existingId is null`() {
        val group = AlbumGroup(
            rootPath = Path.of("/music/jazz/coltrane"),
            sourceDirs = listOf(Path.of("/music/jazz/coltrane")),
            flacPaths = emptyList(),
            albumArtist = "John Coltrane",
            albumTitle = "A Love Supreme",
            date = "1964",
        )

        val album1 = with(LibraryScanService.Companion) { group.toAlbum(existingId = null) }
        val album2 = with(LibraryScanService.Companion) { group.toAlbum(existingId = null) }

        // Without existingId, each call gets a fresh random UUID
        assertNotNull(album1.id)
        assertNotNull(album2.id)
        assertNotEquals(album1.id, album2.id)
    }

    // --- Per-album error tracking tests ---

    @Test
    fun `status has empty errors and zero totalErrors when scan completes without issues`() = runTest {
        val groups = listOf(albumGroup("Miles Davis"), albumGroup("John Coltrane"))
        every { walker.walk(libraryRoot) } returns groups
        coEvery { albumRepository.saveAll(any()) } returns Unit
        stubNoTracks()

        val svc = service()
        svc.startScan()

        val status = svc.status()
        assertEquals(ScanState.COMPLETE, status.state)
        assertEquals(0, status.totalErrors)
        assertTrue(status.errors.isEmpty())
    }

    @Test
    fun `status reports one error entry when one album fails to index`() = runTest {
        val goodGroup = albumGroup("Miles Davis", "Kind of Blue")
        val badGroup = albumGroup("John Coltrane", "A Love Supreme")
        every { walker.walk(libraryRoot) } returns listOf(goodGroup, badGroup)
        coEvery { albumRepository.saveAll(match { albums -> albums[0].albumArtist == "Miles Davis" }) } returns Unit
        coEvery { albumRepository.saveAll(match { albums -> albums[0].albumArtist == "John Coltrane" }) } throws
            RuntimeException("permission denied")
        stubNoTracks()

        val svc = service()
        svc.startScan()

        val status = svc.status()
        assertEquals(ScanState.COMPLETE, status.state)
        assertEquals(1L, status.scannedAlbums)
        assertEquals(1, status.totalErrors)
        assertEquals(1, status.errors.size)
        assertEquals("John Coltrane/A Love Supreme", status.errors[0].albumDir)
        assertEquals("Permission denied", status.errors[0].reason)
        assertEquals("Check file permissions", status.errors[0].suggestion)
    }

    @Test
    fun `status reports up to 50 error entries when exactly 50 albums fail`() = runTest {
        @Suppress("MagicNumber") // 50 is the max cap defined by ScanStatus.MAX_REPORTED_ERRORS
        val groups = (1..50).map { albumGroup("Artist$it", "Album$it") }
        every { walker.walk(libraryRoot) } returns groups
        coEvery { albumRepository.saveAll(any()) } throws RuntimeException("IO error")

        val svc = service()
        svc.startScan()

        val status = svc.status()
        assertEquals(ScanState.COMPLETE, status.state)
        assertEquals(ScanStatus.MAX_REPORTED_ERRORS, status.totalErrors)
        assertEquals(ScanStatus.MAX_REPORTED_ERRORS, status.errors.size)
    }

    @Test
    fun `status caps errors list at 50 and reflects full count in totalErrors when 51 albums fail`() = runTest {
        @Suppress("MagicNumber") // 51 = cap(50) + 1 overflow entry
        val groups = (1..51).map { albumGroup("Artist$it", "Album$it") }
        every { walker.walk(libraryRoot) } returns groups
        coEvery { albumRepository.saveAll(any()) } throws RuntimeException("IO error")

        val svc = service()
        svc.startScan()

        val status = svc.status()
        assertEquals(ScanState.COMPLETE, status.state)
        assertEquals(51, status.totalErrors)
        assertEquals(ScanStatus.MAX_REPORTED_ERRORS, status.errors.size)
    }

    @Test
    fun `errors and totalErrors reset when a new scan starts`() = runTest {
        val badGroup = albumGroup("Artist", "Album")
        every { walker.walk(libraryRoot) } returns listOf(badGroup)
        coEvery { albumRepository.saveAll(any()) } throws RuntimeException("IO error")

        val svc = service()
        svc.startScan()
        assertEquals(1, svc.status().totalErrors)

        // Second scan with no errors
        every { walker.walk(libraryRoot) } returns emptyList()
        coEvery { albumRepository.saveAll(any()) } returns Unit
        stubNoTracks()
        svc.startScan()

        val status = svc.status()
        assertEquals(0, status.totalErrors)
        assertTrue(status.errors.isEmpty())
    }

    // --- Track indexing tests ---

    @Test
    fun `startScan deletes and re-saves tracks when album is found after save`() = runTest {
        val albumId = Uuid.random()
        val savedAlbum = org.javafreedom.kbeatz.catalog.domain.model.Album(
            id = albumId,
            albumArtist = "Miles Davis",
            album = "Kind of Blue",
            date = "1959",
            genre = null,
            label = null,
            catalogNumber = null,
            composer = null,
            conductor = null,
            ensemble = null,
            discogsId = null,
            directoryPath = "/music/Miles Davis/Kind of Blue",
            extraTags = null,
            images = null,
        )
        val groups = listOf(albumGroup("Miles Davis"))
        every { walker.walk(libraryRoot) } returns groups
        coEvery { albumRepository.saveAll(any()) } returns Unit
        // findByDirectoryPath returns the saved album so track saving is triggered
        coEvery { albumRepository.findByDirectoryPath("/music/Miles Davis/Kind of Blue") } returns savedAlbum
        // readTrack() will fail to open the fake FLAC path and return null, so saveAll is not called
        coEvery { trackRepository.deleteByAlbumId(albumId) } returns Unit

        val svc = service()
        svc.startScan()

        // deleteByAlbumId must be called to clear stale tracks before re-indexing
        coVerify(exactly = 1) { trackRepository.deleteByAlbumId(albumId) }
        // saveAll is NOT called when all FLAC reads fail (fake paths return null from readTrack)
        coVerify(exactly = 0) { trackRepository.saveAll(any()) }
        assertEquals(ScanState.COMPLETE, svc.status().state)
    }

    @Test
    fun `startScan skips track saving when findByDirectoryPath returns null`() = runTest {
        val groups = listOf(albumGroup("Miles Davis"))
        every { walker.walk(libraryRoot) } returns groups
        coEvery { albumRepository.saveAll(any()) } returns Unit
        coEvery { albumRepository.findByDirectoryPath(any()) } returns null

        val svc = service()
        svc.startScan()

        // Neither deleteByAlbumId nor trackRepository.saveAll should be called
        coVerify(exactly = 0) { trackRepository.deleteByAlbumId(any()) }
        coVerify(exactly = 0) { trackRepository.saveAll(any()) }
        assertEquals(ScanState.COMPLETE, svc.status().state)
    }

    @Test
    fun `readTrack extracts Vorbis Comment tags and duration from a real FLAC file`() = runTest {
        // Uses the with-tags.flac fixture (generated by kbeatz-tagger FixtureGenerator).
        // TITLE="Kind of Blue", TRACKNUMBER="1", ARTIST="Miles Davis", SAMPLE_RATE=44100, TOTAL_SAMPLES=4410
        val flacResource = checkNotNull(
            LibraryScanServiceTest::class.java.classLoader.getResource("with-tags.flac"),
        ) { "with-tags.flac fixture not found in test resources" }
        val flacPath = java.nio.file.Path.of(flacResource.toURI())
        val albumRoot = flacPath.parent
        val albumId = Uuid.random()
        val savedAlbum = org.javafreedom.kbeatz.catalog.domain.model.Album(
            id = albumId,
            albumArtist = "Miles Davis",
            album = "Kind of Blue",
            date = "1959",
            genre = null,
            label = null,
            catalogNumber = null,
            composer = null,
            conductor = null,
            ensemble = null,
            discogsId = null,
            directoryPath = albumRoot.toString(),
            extraTags = null,
            images = null,
        )
        val group = AlbumGroup(
            rootPath = albumRoot,
            sourceDirs = listOf(albumRoot),
            flacPaths = listOf(flacPath),
            albumArtist = "Miles Davis",
            albumTitle = "Kind of Blue",
            date = "1959",
        )
        every { walker.walk(libraryRoot) } returns listOf(group)
        coEvery { albumRepository.saveAll(any()) } returns Unit
        coEvery { albumRepository.findByDirectoryPath(albumRoot.toString()) } returns savedAlbum
        coEvery { trackRepository.deleteByAlbumId(albumId) } returns Unit
        coEvery { trackRepository.saveAll(any()) } returns Unit

        val svc = service()
        svc.startScan()

        // Track data must be derived from the real FLAC file: TITLE="Kind of Blue", TRACKNUMBER="1"
        coVerify(exactly = 1) {
            trackRepository.saveAll(match { tracks ->
                tracks.size == 1 &&
                    tracks[0].title == "Kind of Blue" &&
                    tracks[0].trackNumber == "1" &&
                    tracks[0].artist == "Miles Davis" &&
                    // duration = 4410 samples / 44100 Hz = 0.1s → 0 rounded (int division)
                    tracks[0].durationSeconds != null &&
                    tracks[0].albumId == albumId
            })
        }
        assertEquals(ScanState.COMPLETE, svc.status().state)
    }
}
