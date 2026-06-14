package org.javafreedom.kbeatz.catalog.application.service

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.javafreedom.kbeatz.catalog.domain.model.AlbumGroup
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository
import org.javafreedom.kbeatz.catalog.domain.repository.TrackRepository

/**
 * Unit tests for [LibraryScanService.repairOnStartup].
 *
 * Uses a real temp filesystem for lock file creation and a mock walker/repository.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RepairOnStartupTest {

    private val walker: LibraryWalker = mockk()
    private val albumRepository: AlbumRepository = mockk()
    private val trackRepository: TrackRepository = mockk()

    @Suppress("MagicNumber") // default 60s timeout for the test helper
    private fun withTempLibrary(
        repairTimeoutSeconds: Long = 60L,
        block: suspend (Path, LibraryScanService) -> Unit,
    ) {
        val root = Files.createTempDirectory("repair-test")
        try {
            val svc = LibraryScanService(
                libraryRoot = root,
                walker = walker,
                albumRepository = albumRepository,
                trackRepository = trackRepository,
                scanDispatcher = UnconfinedTestDispatcher(),
                repairTimeoutSeconds = repairTimeoutSeconds,
            )
            runTest { block(root, svc) }
        } finally {
            root.toFile().deleteRecursively()
        }
    }

    // Stub for track-saving path: findByDirectoryPath returns null so track logic is skipped.
    private fun stubNoTracks() {
        coEvery { albumRepository.findByDirectoryPath(any()) } returns null
    }

    private fun albumGroup(dir: Path, artist: String = "Bach", album: String = "BWV 998") =
        AlbumGroup(
            rootPath = dir,
            sourceDirs = listOf(dir),
            flacPaths = listOf(dir.resolve("01.flac")),
            albumArtist = artist,
            albumTitle = album,
            date = null,
        )

    @Test
    fun `repairOnStartup does nothing when no lock files exist`() = withTempLibrary { root, svc ->
        // No lock files — walker should never be called
        svc.repairOnStartup()

        coVerify(exactly = 0) { albumRepository.saveAll(any()) }
    }

    @Test
    fun `repairOnStartup re-indexes and deletes lock file`() = withTempLibrary { root, svc ->
        val albumDir = Files.createDirectories(root.resolve("classical/bach/bwv998"))
        val lockFile = albumDir.resolve(WRITE_LOCK_FILENAME)
        Files.writeString(lockFile, "dummy content")

        every { walker.walk(albumDir) } returns listOf(albumGroup(albumDir))
        coEvery { albumRepository.saveAll(any()) } returns Unit
        stubNoTracks()

        svc.repairOnStartup()

        // Lock file should be deleted
        assertTrue(!Files.exists(lockFile), "Lock file should be deleted after repair")

        // Repository should have been called to re-index
        coVerify(exactly = 1) {
            albumRepository.saveAll(match { albums ->
                albums.any { it.albumArtist == "Bach" }
            })
        }
    }

    @Test
    fun `repairOnStartup handles multiple lock files in different directories`() =
        withTempLibrary { root, svc ->
            val dir1 = Files.createDirectories(root.resolve("classical/bach/bwv998"))
            val dir2 = Files.createDirectories(root.resolve("jazz/miles/blue"))
            val lock1 = dir1.resolve(WRITE_LOCK_FILENAME)
            val lock2 = dir2.resolve(WRITE_LOCK_FILENAME)
            Files.writeString(lock1, "")
            Files.writeString(lock2, "")

            every { walker.walk(dir1) } returns listOf(albumGroup(dir1, "Bach", "BWV 998"))
            every { walker.walk(dir2) } returns listOf(albumGroup(dir2, "Miles Davis", "Kind of Blue"))
            coEvery { albumRepository.saveAll(any()) } returns Unit
            stubNoTracks()

            svc.repairOnStartup()

            assertTrue(!Files.exists(lock1), "Lock 1 should be deleted")
            assertTrue(!Files.exists(lock2), "Lock 2 should be deleted")
            coVerify(exactly = 2) { albumRepository.saveAll(any()) }
        }

    @Test
    fun `isRepairComplete returns false before repairOnStartup is called`() =
        withTempLibrary { _, svc ->
            assertFalse(svc.isRepairComplete(), "Repair should not be complete before repairOnStartup runs")
        }

    @Test
    fun `isRepairComplete returns true after repairOnStartup when no lock files exist`() =
        withTempLibrary { _, svc ->
            svc.repairOnStartup()
            assertTrue(svc.isRepairComplete(), "Repair should be marked complete after repairOnStartup")
        }

    @Test
    fun `isRepairComplete returns true after repairOnStartup even when a directory repair fails`() =
        withTempLibrary { root, svc ->
            val dir = Files.createDirectories(root.resolve("broken-album"))
            Files.writeString(dir.resolve(WRITE_LOCK_FILENAME), "")
            every { walker.walk(dir) } throws RuntimeException("Read error")

            svc.repairOnStartup()

            assertTrue(svc.isRepairComplete(), "Repair complete flag must be set even after partial failure")
        }

    @Test
    fun `repairOnStartup marks repair complete after timeout when saveAll is slow`() =
        withTempLibrary(repairTimeoutSeconds = 1L) { root, svc ->
            val dir = Files.createDirectories(root.resolve("slow-album"))
            Files.writeString(dir.resolve(WRITE_LOCK_FILENAME), "")

            // Walker returns an album group quickly; saveAll is artificially slow
            every { walker.walk(dir) } returns listOf(albumGroup(dir))
            coEvery { albumRepository.saveAll(any()) } coAnswers {
                @Suppress("MagicNumber") // 5000ms delay to exceed the 1-second timeout
                delay(5_000L)
            }
            stubNoTracks()

            svc.repairOnStartup()

            // Repair must be marked complete even after the timeout fires
            assertTrue(svc.isRepairComplete(), "isRepairComplete must be true after timeout")
        }

    @Test
    fun `repairOnStartup retains lock file when walker throws and continues with other dirs`() =
        withTempLibrary { root, svc ->
            val dir1 = Files.createDirectories(root.resolve("album1"))
            val dir2 = Files.createDirectories(root.resolve("album2"))
            val lock1 = dir1.resolve(WRITE_LOCK_FILENAME)
            val lock2 = dir2.resolve(WRITE_LOCK_FILENAME)
            Files.writeString(lock1, "")
            Files.writeString(lock2, "")

            every { walker.walk(dir1) } throws RuntimeException("Read error")
            every { walker.walk(dir2) } returns listOf(albumGroup(dir2, "Coltrane", "A Love Supreme"))
            coEvery { albumRepository.saveAll(any()) } returns Unit
            stubNoTracks()

            svc.repairOnStartup()

            // dir1 lock retained (repair failed), dir2 lock deleted (repair succeeded)
            assertTrue(Files.exists(lock1), "Failed repair lock should be retained")
            assertTrue(!Files.exists(lock2), "Successful repair lock should be deleted")
        }
}
