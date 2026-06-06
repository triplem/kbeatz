package org.javafreedom.kbeatz.catalog.application.service

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertTrue
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.javafreedom.kbeatz.catalog.domain.model.AlbumGroup
import org.javafreedom.kbeatz.catalog.domain.repository.AlbumRepository

/**
 * Unit tests for [LibraryScanService.repairOnStartup].
 *
 * Uses a real temp filesystem for lock file creation and a mock walker/repository.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RepairOnStartupTest {

    private val walker: LibraryWalker = mockk()
    private val albumRepository: AlbumRepository = mockk()

    private fun withTempLibrary(block: suspend (Path, LibraryScanService) -> Unit) {
        val root = Files.createTempDirectory("repair-test")
        try {
            val svc = LibraryScanService(
                libraryRoot = root,
                walker = walker,
                albumRepository = albumRepository,
                scanDispatcher = UnconfinedTestDispatcher(),
            )
            runTest { block(root, svc) }
        } finally {
            root.toFile().deleteRecursively()
        }
    }

    private fun albumGroup(dir: Path, artist: String = "Bach", album: String = "BWV 998") =
        AlbumGroup(
            rootPath = dir,
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
        val lockFile = albumDir.resolve(LibraryScanService.LOCK_FILE_NAME)
        Files.writeString(lockFile, "dummy content")

        every { walker.walk(albumDir) } returns listOf(albumGroup(albumDir))
        coEvery { albumRepository.saveAll(any()) } returns Unit

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
            val lock1 = dir1.resolve(LibraryScanService.LOCK_FILE_NAME)
            val lock2 = dir2.resolve(LibraryScanService.LOCK_FILE_NAME)
            Files.writeString(lock1, "")
            Files.writeString(lock2, "")

            every { walker.walk(dir1) } returns listOf(albumGroup(dir1, "Bach", "BWV 998"))
            every { walker.walk(dir2) } returns listOf(albumGroup(dir2, "Miles Davis", "Kind of Blue"))
            coEvery { albumRepository.saveAll(any()) } returns Unit

            svc.repairOnStartup()

            assertTrue(!Files.exists(lock1), "Lock 1 should be deleted")
            assertTrue(!Files.exists(lock2), "Lock 2 should be deleted")
            coVerify(exactly = 2) { albumRepository.saveAll(any()) }
        }

    @Test
    fun `repairOnStartup retains lock file when walker throws and continues with other dirs`() =
        withTempLibrary { root, svc ->
            val dir1 = Files.createDirectories(root.resolve("album1"))
            val dir2 = Files.createDirectories(root.resolve("album2"))
            val lock1 = dir1.resolve(LibraryScanService.LOCK_FILE_NAME)
            val lock2 = dir2.resolve(LibraryScanService.LOCK_FILE_NAME)
            Files.writeString(lock1, "")
            Files.writeString(lock2, "")

            every { walker.walk(dir1) } throws RuntimeException("Read error")
            every { walker.walk(dir2) } returns listOf(albumGroup(dir2, "Coltrane", "A Love Supreme"))
            coEvery { albumRepository.saveAll(any()) } returns Unit

            svc.repairOnStartup()

            // dir1 lock retained (repair failed), dir2 lock deleted (repair succeeded)
            assertTrue(Files.exists(lock1), "Failed repair lock should be retained")
            assertTrue(!Files.exists(lock2), "Successful repair lock should be deleted")
        }
}
