package org.javafreedom.kbeatz.catalog.infrastructure.move

import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.uuid.Uuid
import org.junit.jupiter.api.io.TempDir

/** Unit tests for [MoveJournal] encode/parse round-trip and malformed-input handling. */
class MoveJournalTest {

    private val albumId = Uuid.random()

    @Test
    fun `encode then readFrom round-trips all fields`(@TempDir dir: Path) {
        val journal = MoveJournal(
            albumId = albumId,
            fromPath = "/srv/music/incoming/kob",
            toPath = "/srv/music/Miles Davis/Kind of Blue (1959)",
            mergedFromPaths = listOf("/srv/music/incoming/kob backup", "/srv/music/incoming/kob alt"),
            mergedToPaths = listOf("/srv/music/Miles Davis/Kind of Blue (1959)/kob backup"),
            phase = MovePhase.MOVED,
        )
        val file = dir.resolve("journal.txt")
        Files.writeString(file, journal.encode())

        assertEquals(journal, MoveJournal.readFrom(file))
    }

    @Test
    fun `readFrom returns null for a missing file`(@TempDir dir: Path) {
        assertNull(MoveJournal.readFrom(dir.resolve("does-not-exist")))
    }

    @Test
    fun `readFrom returns null when required fields are absent`(@TempDir dir: Path) {
        val file = dir.resolve("partial.txt")
        Files.writeString(file, "fromPath=/a\ntoPath=/b\n")
        assertNull(MoveJournal.readFrom(file))
    }

    @Test
    fun `readFrom returns null for an unparseable album id`(@TempDir dir: Path) {
        val file = dir.resolve("bad-id.txt")
        Files.writeString(file, "albumId=not-a-uuid\nfromPath=/a\ntoPath=/b\nphase=MOVED\n")
        assertNull(MoveJournal.readFrom(file))
    }

    @Test
    fun `readFrom returns null for an unknown phase`(@TempDir dir: Path) {
        val file = dir.resolve("bad-phase.txt")
        Files.writeString(file, "albumId=$albumId\nfromPath=/a\ntoPath=/b\nphase=WAT\n")
        assertNull(MoveJournal.readFrom(file))
    }

    @Test
    fun `readFrom defaults merged path lists to empty when absent`(@TempDir dir: Path) {
        val file = dir.resolve("minimal.txt")
        Files.writeString(file, "albumId=$albumId\nfromPath=/a\ntoPath=/b\nphase=PLANNED\n")
        val journal = MoveJournal.readFrom(file)
        assertEquals(emptyList(), journal?.mergedFromPaths)
        assertEquals(emptyList(), journal?.mergedToPaths)
    }
}
