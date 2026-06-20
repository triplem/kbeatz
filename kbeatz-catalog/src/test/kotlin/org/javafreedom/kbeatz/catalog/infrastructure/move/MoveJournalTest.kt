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

    private fun roundTrip(journal: MoveJournal, dir: Path): MoveJournal? {
        val file = dir.resolve("journal.txt")
        Files.writeString(file, journal.encode())
        return MoveJournal.readFrom(file)
    }

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

        assertEquals(journal, roundTrip(journal, dir))
    }

    @Test
    fun `encode then readFrom round-trips paths containing a tab`(@TempDir dir: Path) {
        val journal = MoveJournal(
            albumId = albumId,
            fromPath = "/srv/music/in\tcoming/kob",
            toPath = "/srv/music/Miles\tDavis/Kind of Blue",
            mergedFromPaths = listOf("/srv/music/merge\ta", "/srv/music/merge\tb"),
            mergedToPaths = listOf("/srv/music/target\ta"),
            phase = MovePhase.PLANNED,
        )

        assertEquals(journal, roundTrip(journal, dir))
    }

    @Test
    fun `encode then readFrom round-trips paths containing a newline`(@TempDir dir: Path) {
        val journal = MoveJournal(
            albumId = albumId,
            fromPath = "/srv/music/in\ncoming/kob",
            toPath = "/srv/music/Miles\nDavis/Kind of Blue",
            mergedFromPaths = listOf("/srv/music/merge\na"),
            mergedToPaths = listOf("/srv/music/target\na", "/srv/music/target\nb"),
            phase = MovePhase.MOVED,
        )

        assertEquals(journal, roundTrip(journal, dir))
    }

    @Test
    fun `readFrom returns null for a missing file`(@TempDir dir: Path) {
        assertNull(MoveJournal.readFrom(dir.resolve("does-not-exist")))
    }

    @Test
    fun `readFrom returns null for a corrupt file`(@TempDir dir: Path) {
        val file = dir.resolve("corrupt.txt")
        Files.writeString(file, "this is not json {{{")
        assertNull(MoveJournal.readFrom(file))
    }

    @Test
    fun `readFrom returns null when required fields are absent`(@TempDir dir: Path) {
        val file = dir.resolve("partial.txt")
        Files.writeString(file, """{"fromPath":"/a","toPath":"/b"}""")
        assertNull(MoveJournal.readFrom(file))
    }

    @Test
    fun `readFrom returns null for an unparseable album id`(@TempDir dir: Path) {
        val file = dir.resolve("bad-id.txt")
        Files.writeString(
            file,
            """{"albumId":"not-a-uuid","fromPath":"/a","toPath":"/b","phase":"MOVED"}""",
        )
        assertNull(MoveJournal.readFrom(file))
    }

    @Test
    fun `readFrom returns null for an unknown phase`(@TempDir dir: Path) {
        val file = dir.resolve("bad-phase.txt")
        Files.writeString(
            file,
            """{"albumId":"$albumId","fromPath":"/a","toPath":"/b","phase":"WAT"}""",
        )
        assertNull(MoveJournal.readFrom(file))
    }

    @Test
    fun `readFrom defaults merged path lists to empty when absent`(@TempDir dir: Path) {
        val file = dir.resolve("minimal.txt")
        Files.writeString(
            file,
            """{"albumId":"$albumId","fromPath":"/a","toPath":"/b","phase":"PLANNED"}""",
        )
        val journal = MoveJournal.readFrom(file)
        assertEquals(emptyList(), journal?.mergedFromPaths)
        assertEquals(emptyList(), journal?.mergedToPaths)
    }

    @Test
    fun `encode then readFrom round-trips empty merged path lists`(@TempDir dir: Path) {
        val journal = MoveJournal(
            albumId = albumId,
            fromPath = "/a",
            toPath = "/b",
            mergedFromPaths = emptyList(),
            mergedToPaths = emptyList(),
            phase = MovePhase.PLANNED,
        )

        assertEquals(journal, roundTrip(journal, dir))
    }
}
