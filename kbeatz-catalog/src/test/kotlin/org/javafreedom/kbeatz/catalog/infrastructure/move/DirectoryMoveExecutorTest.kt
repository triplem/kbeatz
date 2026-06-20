package org.javafreedom.kbeatz.catalog.infrastructure.move

import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.coroutines.test.runTest
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryMove
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.common.ConflictException
import org.javafreedom.kbeatz.common.PathTraversalException
import org.javafreedom.kbeatz.common.ResourceNotFoundException
import org.junit.jupiter.api.io.TempDir

/**
 * Unit tests for [DirectoryMoveExecutor].
 *
 * Uses a real temp filesystem (@TempDir) and an in-memory [MutableAlbumRepository] fake so the
 * end-to-end move (journal + atomic rename + DB update) is exercised against the real filesystem.
 */
class DirectoryMoveExecutorTest {

    private val albumId = Uuid.random()

    private fun executor(repo: MutableAlbumRepository, libraryRoot: Path, dataDir: Path) =
        DirectoryMoveExecutor(repo, libraryRoot, dataDir)

    private fun album(directoryPath: String, mergedDirectories: List<String> = emptyList()) = Album(
        id = albumId,
        albumArtist = "Miles Davis",
        album = "Kind of Blue",
        date = "1959",
        genre = "Jazz",
        label = null,
        catalogNumber = null,
        composer = null,
        conductor = null,
        ensemble = null,
        discogsId = null,
        directoryPath = directoryPath,
        extraTags = null,
        images = null,
        mergedDirectories = mergedDirectories,
    )

    private fun writeFlac(dir: Path, name: String): Path {
        Files.createDirectories(dir)
        val file = dir.resolve(name)
        Files.writeString(file, "flac-bytes-$name")
        return file
    }

    @Test
    fun `execute moves directory and updates album directoryPath`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/kob")
        val to = root.resolve("Miles Davis/Kind of Blue (1959)")
        writeFlac(from, "01.flac")
        val repo = MutableAlbumRepository(album(from.toString()))

        executor(repo, root, root.resolve(".data")).execute(
            DirectoryMove(albumId, from.toString(), to.toString()),
        )

        assertFalse(Files.exists(from), "source must be gone after move")
        assertTrue(Files.exists(to.resolve("01.flac")), "target must contain the moved file")
        assertEquals(to.toString(), repo.find(albumId)?.directoryPath)
    }

    @Test
    fun `execute keeps track files resolvable via target and relative path`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/kob")
        val to = root.resolve("sorted/kob")
        writeFlac(from, "01 So What.flac")
        val repo = MutableAlbumRepository(album(from.toString()))

        executor(repo, root, root.resolve(".data")).execute(
            DirectoryMove(albumId, from.toString(), to.toString()),
        )

        // Track.path is relative ("01 So What.flac"); it must resolve under the new directoryPath.
        val resolved = Path.of(repo.find(albumId)!!.directoryPath).resolve("01 So What.flac")
        assertTrue(Files.isRegularFile(resolved), "relative track path must resolve under target")
    }

    @Test
    fun `execute moves multi-disc subdirectories with the root`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/box")
        val to = root.resolve("sorted/box")
        writeFlac(from.resolve("disc1"), "01.flac")
        writeFlac(from.resolve("disc2"), "01.flac")
        val repo = MutableAlbumRepository(album(from.toString()))

        executor(repo, root, root.resolve(".data")).execute(
            DirectoryMove(albumId, from.toString(), to.toString()),
        )

        assertTrue(Files.isRegularFile(to.resolve("disc1/01.flac")), "disc1 must move with the root")
        assertTrue(Files.isRegularFile(to.resolve("disc2/01.flac")), "disc2 must move with the root")
        assertFalse(Files.exists(from), "source root must be gone")
    }

    @Test
    fun `execute relocates merged directories and updates mergedDirectories`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/kob")
        val merged = root.resolve("incoming/kob-backup")
        val to = root.resolve("sorted/kob")
        writeFlac(from, "01.flac")
        writeFlac(merged, "01.flac")
        val repo = MutableAlbumRepository(album(from.toString(), listOf(merged.toString())))

        executor(repo, root, root.resolve(".data")).execute(
            DirectoryMove(albumId, from.toString(), to.toString(), listOf(merged.toString())),
        )

        val expectedMergedTarget = to.resolve("kob-backup")
        assertTrue(Files.isRegularFile(expectedMergedTarget.resolve("01.flac")), "merged content must be relocated")
        assertFalse(Files.exists(merged), "merged source must be gone (no orphaned content)")
        assertEquals(listOf(expectedMergedTarget.toString()), repo.find(albumId)?.mergedDirectories)
    }

    @Test
    fun `execute is a no-op when fromPath equals toPath`(@TempDir root: Path) = runTest {
        val dir = root.resolve("kob")
        writeFlac(dir, "01.flac")
        val repo = MutableAlbumRepository(album(dir.toString()))

        executor(repo, root, root.resolve(".data")).execute(
            DirectoryMove(albumId, dir.toString(), dir.toString()),
        )

        assertEquals(0, repo.saveCount, "no DB update for a no-op move")
        assertTrue(Files.isRegularFile(dir.resolve("01.flac")))
    }

    @Test
    fun `execute rejects move when target already exists and leaves source untouched`(@TempDir root: Path) =
        runTest {
            val from = root.resolve("incoming/kob")
            val to = root.resolve("sorted/kob")
            writeFlac(from, "01.flac")
            writeFlac(to, "existing.flac")
            val repo = MutableAlbumRepository(album(from.toString()))

            assertFailsWith<ConflictException> {
                executor(repo, root, root.resolve(".data")).execute(
                    DirectoryMove(albumId, from.toString(), to.toString()),
                )
            }
            assertTrue(Files.isRegularFile(from.resolve("01.flac")), "source must be untouched on conflict")
            assertEquals(from.toString(), repo.find(albumId)?.directoryPath)
        }

    @Test
    fun `execute rejects move when source holds a write lock and leaves source untouched`(@TempDir root: Path) =
        runTest {
            val from = root.resolve("incoming/kob")
            val to = root.resolve("sorted/kob")
            writeFlac(from, "01.flac")
            Files.writeString(from.resolve(WRITE_LOCK_FILENAME), "other-writer")
            val repo = MutableAlbumRepository(album(from.toString()))

            assertFailsWith<ConflictException> {
                executor(repo, root, root.resolve(".data")).execute(
                    DirectoryMove(albumId, from.toString(), to.toString()),
                )
            }
            assertTrue(Files.isRegularFile(from.resolve("01.flac")), "source must be untouched when locked")
            assertFalse(Files.exists(to), "target must not be created when source is locked")
        }

    @Test
    fun `execute rejects move when source does not exist`(@TempDir root: Path) = runTest {
        val from = root.resolve("missing")
        val to = root.resolve("sorted/kob")
        val repo = MutableAlbumRepository(album(from.toString()))

        assertFailsWith<ResourceNotFoundException> {
            executor(repo, root, root.resolve(".data")).execute(
                DirectoryMove(albumId, from.toString(), to.toString()),
            )
        }
    }

    @Test
    fun `execute rejects target outside the library root`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/kob")
        writeFlac(from, "01.flac")
        val outside = root.resolve("..").resolve("escape").normalize()
        val repo = MutableAlbumRepository(album(from.toString()))

        assertFailsWith<PathTraversalException> {
            executor(repo, root, root.resolve(".data")).execute(
                DirectoryMove(albumId, from.toString(), outside.toString()),
            )
        }
    }

    @Test
    fun `execute removes the move journal on success`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/kob")
        val to = root.resolve("sorted/kob")
        val dataDir = root.resolve(".data")
        writeFlac(from, "01.flac")
        val repo = MutableAlbumRepository(album(from.toString()))

        executor(repo, root, dataDir).execute(DirectoryMove(albumId, from.toString(), to.toString()))

        val remaining = Files.list(dataDir).use { stream -> stream.toList() }
        assertTrue(
            remaining.none { it.fileName.toString().endsWith(MOVE_JOURNAL_FILENAME) },
            "no journal must remain after a successful move",
        )
    }

    @Test
    fun `execute is idempotent when the move was already applied`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/kob")
        val to = root.resolve("sorted/kob")
        // Simulate a previous fully-applied move: source gone, target present, DB already updated.
        writeFlac(to, "01.flac")
        val repo = MutableAlbumRepository(album(to.toString()))

        executor(repo, root, root.resolve(".data")).execute(
            DirectoryMove(albumId, from.toString(), to.toString()),
        )

        assertEquals(to.toString(), repo.find(albumId)?.directoryPath)
        assertEquals(0, repo.saveCount, "DB already correct - no redundant save")
    }

    @Test
    fun `copyVerifySwap copies the whole tree then removes the source`(@TempDir root: Path) {
        val from = root.resolve("incoming/box")
        val to = root.resolve("sorted/box")
        writeFlac(from.resolve("disc1"), "01.flac")
        writeFlac(from, "cover.jpg")
        val repo = MutableAlbumRepository(album(from.toString()))
        Files.createDirectories(to.parent)

        executor(repo, root, root.resolve(".data")).copyVerifySwap(from, to)

        assertTrue(Files.isRegularFile(to.resolve("disc1/01.flac")), "nested file must be copied")
        assertTrue(Files.isRegularFile(to.resolve("cover.jpg")), "top-level file must be copied")
        assertFalse(Files.exists(from), "source must be removed after a verified copy")
    }

    @Test
    fun `execute reconciles DB when files already moved but directoryPath stale`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/kob")
        val to = root.resolve("sorted/kob")
        writeFlac(to, "01.flac")
        // DB still points at the old path even though the files are already at the target.
        val repo = MutableAlbumRepository(album(from.toString()))

        executor(repo, root, root.resolve(".data")).execute(
            DirectoryMove(albumId, from.toString(), to.toString()),
        )

        assertEquals(to.toString(), repo.find(albumId)?.directoryPath, "stale DB path must be reconciled")
    }
}
