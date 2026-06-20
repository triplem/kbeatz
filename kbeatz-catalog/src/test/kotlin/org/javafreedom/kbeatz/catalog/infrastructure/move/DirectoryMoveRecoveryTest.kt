package org.javafreedom.kbeatz.catalog.infrastructure.move

import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import kotlinx.coroutines.test.runTest
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.junit.jupiter.api.io.TempDir

/**
 * Unit tests for [DirectoryMoveRecovery] (crash recovery, issue #814 AC-E8).
 *
 * Simulates a journal left behind by a killed process and asserts the recovery rolls the move
 * either forward (DB updated to the target) or back (source intact, DB unchanged), with the
 * journal removed and the operation idempotent.
 */
class DirectoryMoveRecoveryTest {

    private val albumId = Uuid.random()

    private fun album(directoryPath: String, mergedDirectories: List<String> = emptyList()) = Album(
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
        directoryPath = directoryPath,
        extraTags = null,
        images = null,
        mergedDirectories = mergedDirectories,
    )

    private fun writeJournal(dataDir: Path, journal: MoveJournal): Path {
        Files.createDirectories(dataDir)
        val file = dataDir.resolve("${journal.albumId}$MOVE_JOURNAL_FILENAME")
        Files.writeString(file, journal.encode())
        return file
    }

    private fun writeFile(dir: Path, name: String) {
        Files.createDirectories(dir)
        Files.writeString(dir.resolve(name), "bytes")
    }

    @Test
    fun `recovery does nothing when no journals exist`(@TempDir root: Path) = runTest {
        val repo = MutableAlbumRepository(album(root.resolve("kob").toString()))
        DirectoryMoveRecovery(repo, root.resolve(".data")).recoverInterruptedMoves()
        assertEquals(0, repo.saveCount)
    }

    @Test
    fun `recovery rolls forward when files at target but DB not updated`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/kob")
        val to = root.resolve("sorted/kob")
        writeFile(to, "01.flac") // files already at target; source gone (never created)
        val dataDir = root.resolve(".data")
        val repo = MutableAlbumRepository(album(from.toString()))
        val journalFile = writeJournal(
            dataDir,
            MoveJournal(albumId, from.toString(), to.toString(), emptyList(), emptyList(), MovePhase.MOVED),
        )

        DirectoryMoveRecovery(repo, dataDir).recoverInterruptedMoves()

        assertEquals(to.toString(), repo.find(albumId)?.directoryPath, "DB must be rolled forward to target")
        assertFalse(Files.exists(journalFile), "journal must be removed after roll-forward")
    }

    @Test
    fun `recovery roll forward updates mergedDirectories to target locations`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/kob")
        val to = root.resolve("sorted/kob")
        val mergedTo = to.resolve("kob-backup")
        writeFile(to, "01.flac")
        writeFile(mergedTo, "01.flac")
        val dataDir = root.resolve(".data")
        val mergedFrom = root.resolve("incoming/kob-backup").toString()
        val repo = MutableAlbumRepository(album(from.toString(), listOf(mergedFrom)))
        writeJournal(
            dataDir,
            MoveJournal(
                albumId,
                from.toString(),
                to.toString(),
                listOf(mergedFrom),
                listOf(mergedTo.toString()),
                MovePhase.MOVED,
            ),
        )

        DirectoryMoveRecovery(repo, dataDir).recoverInterruptedMoves()

        assertEquals(listOf(mergedTo.toString()), repo.find(albumId)?.mergedDirectories)
    }

    @Test
    fun `recovery rolls back when source still present and target partial`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/kob")
        val to = root.resolve("sorted/kob")
        writeFile(from, "01.flac") // source intact -> move never safely completed
        writeFile(to, "partial.flac") // a partial copy left behind
        val dataDir = root.resolve(".data")
        val repo = MutableAlbumRepository(album(from.toString()))
        val journalFile = writeJournal(
            dataDir,
            MoveJournal(albumId, from.toString(), to.toString(), emptyList(), emptyList(), MovePhase.PLANNED),
        )

        DirectoryMoveRecovery(repo, dataDir).recoverInterruptedMoves()

        assertTrue(Files.isRegularFile(from.resolve("01.flac")), "source must remain intact on roll-back")
        assertFalse(Files.exists(to), "partial target must be cleaned up on roll-back")
        assertEquals(from.toString(), repo.find(albumId)?.directoryPath, "DB must be unchanged on roll-back")
        assertEquals(0, repo.saveCount, "no DB write on roll-back")
        assertFalse(Files.exists(journalFile), "journal must be removed after roll-back")
    }

    @Test
    fun `recovery removes the source write lock on roll back`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/kob")
        val to = root.resolve("sorted/kob")
        writeFile(from, "01.flac")
        Files.writeString(
            from.resolve(org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME),
            "directory-move-in-progress",
        )
        val dataDir = root.resolve(".data")
        val repo = MutableAlbumRepository(album(from.toString()))
        writeJournal(
            dataDir,
            MoveJournal(albumId, from.toString(), to.toString(), emptyList(), emptyList(), MovePhase.PLANNED),
        )

        DirectoryMoveRecovery(repo, dataDir).recoverInterruptedMoves()

        assertFalse(
            Files.exists(from.resolve(org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME)),
            "stale source write-lock must be cleared on roll-back",
        )
    }

    @Test
    fun `recovery is idempotent when run twice`(@TempDir root: Path) = runTest {
        val from = root.resolve("incoming/kob")
        val to = root.resolve("sorted/kob")
        writeFile(to, "01.flac")
        val dataDir = root.resolve(".data")
        val repo = MutableAlbumRepository(album(from.toString()))
        writeJournal(
            dataDir,
            MoveJournal(albumId, from.toString(), to.toString(), emptyList(), emptyList(), MovePhase.MOVED),
        )
        val recovery = DirectoryMoveRecovery(repo, dataDir)

        recovery.recoverInterruptedMoves()
        recovery.recoverInterruptedMoves()

        assertEquals(to.toString(), repo.find(albumId)?.directoryPath)
        assertEquals(1, repo.saveCount, "second run must not save again")
    }

    @Test
    fun `recovery deletes a corrupt journal without throwing`(@TempDir root: Path) = runTest {
        val dataDir = root.resolve(".data")
        Files.createDirectories(dataDir)
        val corrupt = dataDir.resolve("$albumId$MOVE_JOURNAL_FILENAME")
        Files.writeString(corrupt, "not-a-valid-journal")
        val repo = MutableAlbumRepository(album(root.resolve("kob").toString()))

        DirectoryMoveRecovery(repo, dataDir).recoverInterruptedMoves()

        assertFalse(Files.exists(corrupt), "corrupt journal must be removed")
        assertEquals(0, repo.saveCount)
    }
}
