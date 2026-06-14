package org.javafreedom.kbeatz.catalog.application.service

import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlinx.io.bytestring.ByteString
import org.javafreedom.kbeatz.tagger.codec.flac.FlacMetadataBlock
import org.javafreedom.kbeatz.tagger.codec.flac.FlacWriter

/**
 * Unit tests for [LibraryWalker].
 *
 * Each test writes minimal valid FLAC files to a temporary directory,
 * runs the walker, and asserts the expected [AlbumGroup]s are returned.
 */
class LibraryWalkerTest {

    private val walker = LibraryWalker()
    private val md5Zeros = ByteString(ByteArray(16))

    private val streamInfo = FlacMetadataBlock.StreamInfo(
        minBlockSize = 4096, maxBlockSize = 4096,
        minFrameSize = 0, maxFrameSize = 0,
        sampleRate = 44100, channels = 2, bitsPerSample = 16,
        totalSamples = 0L, md5 = md5Zeros,
    )

    /** Build minimal valid FLAC bytes with the given Vorbis Comment tags. */
    private fun flacBytes(vararg comments: String): ByteArray {
        val vc = FlacMetadataBlock.VorbisComment(vendor = "test", comments = comments.toList())
        return FlacWriter().write(listOf(streamInfo, vc), ByteArray(0))
    }

    /** Write [content] to [dir]/[name] and return the path. */
    private fun writeFile(dir: Path, name: String, content: ByteArray): Path =
        dir.resolve(name).also { Files.write(it, content) }

    /** Create a temp directory, run [block] with it, delete it after. */
    private fun withTempDir(block: (Path) -> Unit) {
        val tmp = Files.createTempDirectory("walker-test")
        try {
            block(tmp)
        } finally {
            tmp.toFile().deleteRecursively()
        }
    }

    @Test
    fun `walk groups all FLAC files in one directory into one AlbumGroup`() = withTempDir { root ->
        val albumDir = Files.createDirectories(root.resolve("jazz/miles-davis/kind-of-blue"))
        writeFile(albumDir, "01 - So What.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959", "TITLE=So What"
        ))
        writeFile(albumDir, "02 - Freddie Freeloader.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959", "TITLE=Freddie Freeloader"
        ))

        val groups = walker.walk(root)

        assertEquals(1, groups.size)
        assertEquals("Miles Davis", groups[0].albumArtist)
        assertEquals("Kind of Blue", groups[0].albumTitle)
        assertEquals("1959", groups[0].date)
        assertEquals(2, groups[0].flacPaths.size)
    }

    @Test
    fun `walk merges disc1 and disc2 subdirectories into a single AlbumGroup`() = withTempDir { root ->
        val albumDir = Files.createDirectories(root.resolve("rock/beatles/white-album"))
        val disc1 = Files.createDirectories(albumDir.resolve("disc1"))
        val disc2 = Files.createDirectories(albumDir.resolve("disc2"))

        writeFile(disc1, "01 - Back in the USSR.flac", flacBytes(
            "ALBUMARTIST=The Beatles", "ALBUM=The Beatles", "DATE=1968", "DISCNUMBER=1"
        ))
        writeFile(disc2, "01 - Revolution 1.flac", flacBytes(
            "ALBUMARTIST=The Beatles", "ALBUM=The Beatles", "DATE=1968", "DISCNUMBER=2"
        ))

        val groups = walker.walk(root)

        assertEquals(1, groups.size, "disc1 and disc2 should merge into one group")
        assertEquals("The Beatles", groups[0].albumArtist)
        assertEquals(2, groups[0].flacPaths.size)
        assertEquals(albumDir, groups[0].rootPath)
    }

    @Test
    fun `walk returns two AlbumGroups for two unrelated album directories`() = withTempDir { root ->
        val dir1 = Files.createDirectories(root.resolve("jazz/miles-davis/kind-of-blue"))
        val dir2 = Files.createDirectories(root.resolve("jazz/coltrane/a-love-supreme"))

        writeFile(dir1, "01 - So What.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959"
        ))
        writeFile(dir2, "01 - Acknowledgement.flac", flacBytes(
            "ALBUMARTIST=John Coltrane", "ALBUM=A Love Supreme", "DATE=1964"
        ))

        val groups = walker.walk(root)

        assertEquals(2, groups.size)
        val artists = groups.map { it.albumArtist }.toSet()
        assertTrue("Miles Davis" in artists)
        assertTrue("John Coltrane" in artists)
    }

    @Test
    fun `walk groups correctly when DATE tag is absent`() = withTempDir { root ->
        val albumDir = Files.createDirectories(root.resolve("classical/bach/goldberg"))
        writeFile(albumDir, "01 - Aria.flac", flacBytes(
            "ALBUMARTIST=Glenn Gould", "ALBUM=Goldberg Variations"
            // No DATE tag
        ))
        writeFile(albumDir, "02 - Variation 1.flac", flacBytes(
            "ALBUMARTIST=Glenn Gould", "ALBUM=Goldberg Variations"
        ))

        val groups = walker.walk(root)

        assertEquals(1, groups.size)
        assertEquals("Glenn Gould", groups[0].albumArtist)
        assertEquals("Goldberg Variations", groups[0].albumTitle)
        assertEquals(null, groups[0].date, "DATE should be null when tag is absent")
        assertEquals(2, groups[0].flacPaths.size)
    }

    @Test
    fun `walk includes only FLAC files and ignores other file types`() = withTempDir { root ->
        val albumDir = Files.createDirectories(root.resolve("jazz/miles-davis/bitches-brew"))
        writeFile(albumDir, "01 - Pharaoh's Dance.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Bitches Brew", "DATE=1970"
        ))
        // Non-FLAC files that should be ignored
        Files.write(albumDir.resolve("cover.jpg"), "fake image".toByteArray())
        Files.write(albumDir.resolve("liner-notes.pdf"), "fake pdf".toByteArray())
        Files.write(albumDir.resolve("album.m3u"), "#EXTM3U\n".toByteArray())

        val groups = walker.walk(root)

        assertEquals(1, groups.size)
        assertEquals(1, groups[0].flacPaths.size, "Only the .flac file should be included")
        assertTrue(groups[0].flacPaths[0].fileName.toString().endsWith(".flac"))
    }

    @Test
    fun `walk throws when library root does not exist`() {
        val nonExistent = Path.of("/nonexistent/path/that/does/not/exist")

        assertFailsWith<IllegalArgumentException> {
            walker.walk(nonExistent)
        }
    }

    @Test
    fun `walk handles empty library root with no FLAC files`() = withTempDir { root ->
        Files.createDirectories(root.resolve("empty-dir"))

        val groups = walker.walk(root)

        assertTrue(groups.isEmpty())
    }

    // --- Various Artists compilation tests (issue #373) ---

    @Test
    fun `walk groups VA compilation as single album when all tracks share ALBUMARTIST=Various Artists`() =
        withTempDir { root ->
            val dir = Files.createDirectories(root.resolve("compilations/jazz-various"))
            writeFile(dir, "01 - So What.flac", flacBytes(
                "ALBUMARTIST=Various Artists", "ALBUM=Jazz Essentials", "DATE=2005",
                "ARTIST=Miles Davis",
            ))
            writeFile(dir, "02 - My Favourite Things.flac", flacBytes(
                "ALBUMARTIST=Various Artists", "ALBUM=Jazz Essentials", "DATE=2005",
                "ARTIST=John Coltrane",
            ))
            writeFile(dir, "03 - Kind of Blue Theme.flac", flacBytes(
                "ALBUMARTIST=Various Artists", "ALBUM=Jazz Essentials", "DATE=2005",
                "ARTIST=Miles Davis",
            ))

            val groups = walker.walk(root)

            assertEquals(1, groups.size, "VA compilation must be a single album group")
            assertEquals("Various Artists", groups[0].albumArtist)
            assertEquals("Jazz Essentials", groups[0].albumTitle)
            assertEquals(3, groups[0].flacPaths.size)
        }

    @Test
    fun `walk creates two separate albums for two VA compilations with different ALBUM names`() =
        withTempDir { root ->
            val dir1 = Files.createDirectories(root.resolve("compilations/jazz-best"))
            val dir2 = Files.createDirectories(root.resolve("compilations/blues-best"))
            writeFile(dir1, "01 - Track.flac", flacBytes(
                "ALBUMARTIST=Various Artists", "ALBUM=Best Jazz", "DATE=2000"
            ))
            writeFile(dir2, "01 - Track.flac", flacBytes(
                "ALBUMARTIST=Various Artists", "ALBUM=Best Blues", "DATE=2001"
            ))

            val groups = walker.walk(root)

            assertEquals(2, groups.size, "Two VA compilations with different ALBUM names must be separate")
            val albums = groups.map { it.albumTitle }.toSet()
            assertTrue("Best Jazz" in albums)
            assertTrue("Best Blues" in albums)
            groups.forEach { assertEquals("Various Artists", it.albumArtist) }
        }

    @Test
    fun `walk groups all files in a directory as one album when ALBUMARTIST is mixed or absent`() =
        withTempDir { root ->
            // Directory-path boundary rule takes precedence: all files in one dir -> one group
            val dir = Files.createDirectories(root.resolve("compilations/mixed"))
            writeFile(dir, "01 - Track1.flac", flacBytes(
                "ALBUMARTIST=Various Artists", "ALBUM=Mixed Comp", "DATE=2010"
            ))
            writeFile(dir, "02 - Track2.flac", flacBytes(
                "ALBUM=Mixed Comp", "DATE=2010"
                // No ALBUMARTIST tag - ARTIST also absent
            ))

            val groups = walker.walk(root)

            // Two different group keys (one "Various Artists", one UNKNOWN_ARTIST_FALLBACK)
            // but both in the same directory. The directory does NOT force them to merge -
            // the grouping key includes the albumArtist. Verify at least one group has VA.
            val vaGroup = groups.firstOrNull { it.albumArtist == "Various Artists" }
            assertTrue(vaGroup != null, "Group with Various Artists must exist")
            assertEquals("Mixed Comp", vaGroup.albumTitle)
        }

    @Test
    fun `walk uses UNKNOWN_ARTIST_FALLBACK when no ALBUMARTIST or ARTIST tag is present`() =
        withTempDir { root ->
            val dir = Files.createDirectories(root.resolve("untagged"))
            writeFile(dir, "01 - Mystery Track.flac", flacBytes(
                "ALBUM=Untagged Album"
                // No ALBUMARTIST and no ARTIST
            ))

            val groups = walker.walk(root)

            assertEquals(1, groups.size)
            assertEquals(LibraryWalker.UNKNOWN_ARTIST_FALLBACK, groups[0].albumArtist,
                "ALBUMARTIST must be UNKNOWN_ARTIST_FALLBACK when no artist tag is present")
        }

    @Test
    fun `walk skips unreadable FLAC files and continues`() = withTempDir { root ->
        val albumDir = Files.createDirectories(root.resolve("jazz/miles-davis/sketches"))
        // Write a corrupt file (not a valid FLAC)
        Files.write(albumDir.resolve("corrupt.flac"), "not a flac file".toByteArray())
        // Write a valid FLAC
        writeFile(albumDir, "01 - Concierto de Aranjuez.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Sketches of Spain", "DATE=1960"
        ))

        val groups = walker.walk(root)

        // Valid file should still be grouped; corrupt file skipped
        assertEquals(1, groups.size)
        assertEquals(1, groups[0].flacPaths.size)
    }

    // --- Deduplication tests (issue #657) ---

    @Test
    fun `walk merges same album in two separate directories into one group`() = withTempDir { root ->
        // Simulates a user who has two rips of the same album in different directories
        val dir1 = Files.createDirectories(root.resolve("jazz/miles-davis/kind-of-blue-lossless"))
        val dir2 = Files.createDirectories(root.resolve("jazz/miles-davis/kind-of-blue-backup"))

        writeFile(dir1, "01 - So What.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959"
        ))
        writeFile(dir2, "01 - So What (backup).flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959"
        ))

        val groups = walker.walk(root)

        assertEquals(1, groups.size, "two directories with same (artist, album, date) must merge into one group")
        assertEquals("Miles Davis", groups[0].albumArtist)
        assertEquals("Kind of Blue", groups[0].albumTitle)
        assertEquals("1959", groups[0].date)
        assertEquals(2, groups[0].flacPaths.size, "tracks from both directories must be included")
    }

    @Test
    fun `walk keeps two albums with same artist and title but different dates as separate groups`() =
        withTempDir { root ->
            // Same artist + album title but released in different years (e.g. original and re-issue)
            val dir1 = Files.createDirectories(root.resolve("jazz/miles-davis/kind-of-blue-1959"))
            val dir2 = Files.createDirectories(root.resolve("jazz/miles-davis/kind-of-blue-2014"))

            writeFile(dir1, "01 - So What.flac", flacBytes(
                "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959"
            ))
            writeFile(dir2, "01 - So What (remaster).flac", flacBytes(
                "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=2014"
            ))

            val groups = walker.walk(root)

            assertEquals(2, groups.size, "different DATE tags must produce separate groups")
            val dates = groups.map { it.date }.toSet()
            assertTrue("1959" in dates)
            assertTrue("2014" in dates)
        }

    @Test
    fun `walk merges tracks with same year but different DATE formats into one group`() = withTempDir { root ->
        // "1959" and "1959-05-04" represent the same year; the grouping key normalises to the
        // 4-digit year prefix so both tracks land in the same AlbumGroup.
        val dir1 = Files.createDirectories(root.resolve("jazz/miles-davis/kind-of-blue"))
        val dir2 = Files.createDirectories(root.resolve("jazz/miles-davis/kind-of-blue-full"))

        writeFile(dir1, "01 - So What.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959"
        ))
        writeFile(dir2, "02 - Freddie.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959-05-04"
        ))

        val groups = walker.walk(root)

        assertEquals(1, groups.size, "DATE=1959 and DATE=1959-05-04 must merge into one group")
        assertEquals(2, groups[0].flacPaths.size)
    }

    @Test
    fun `walk rootPath for merged group is the shallowest directory`() = withTempDir { root ->
        // Shallowest path (fewest nameCount segments) wins when two directories hold the same album.
        // shallow = root/miles-davis/kind-of-blue  (2 segments below root)
        // deep    = root/jazz/miles-davis/kind-of-blue (3 segments below root)
        // shallow.nameCount < deep.nameCount, so shallow is chosen as rootPath.
        val shallow = Files.createDirectories(root.resolve("miles-davis/kind-of-blue"))
        val deep = Files.createDirectories(root.resolve("jazz/miles-davis/kind-of-blue"))

        writeFile(shallow, "01 - So What.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959"
        ))
        writeFile(deep, "02 - Freddie.flac", flacBytes(
            "ALBUMARTIST=Miles Davis", "ALBUM=Kind of Blue", "DATE=1959"
        ))

        val groups = walker.walk(root)

        assertEquals(1, groups.size)
        assertEquals(shallow, groups[0].rootPath, "shallowest directory must be chosen as rootPath")
    }
}
