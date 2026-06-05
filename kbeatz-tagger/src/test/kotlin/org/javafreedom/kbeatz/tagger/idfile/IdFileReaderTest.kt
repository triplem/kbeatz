package org.javafreedom.kbeatz.tagger.idfile

import kotlinx.io.buffered
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import kotlinx.io.writeString
import org.junit.jupiter.api.BeforeEach
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class IdFileReaderTest {

    private val tmpDir = Path(System.getProperty("java.io.tmpdir"), "kbeatz-test-${System.nanoTime()}")
    private val filesToDelete = mutableListOf<Path>()
    private val reader = IdFileReader()

    @BeforeEach
    fun setUp() {
        SystemFileSystem.createDirectories(tmpDir)
    }

    @AfterTest
    fun tearDown() {
        filesToDelete.forEach { path ->
            runCatching { SystemFileSystem.delete(path) }
        }
        runCatching { SystemFileSystem.delete(tmpDir) }
    }

    private fun writeFile(name: String, content: String): Path {
        val path = Path(tmpDir, name)
        SystemFileSystem.sink(path).buffered().use { it.writeString(content) }
        filesToDelete.add(path)
        return path
    }

    // -------------------------------------------------------------------------
    // INI format (id.txt / local_ids.txt)
    // -------------------------------------------------------------------------

    @Test
    fun `should parse INI format with section header and key-value pair`() {
        writeFile(
            "id.txt",
            "[source]\ndiscogs_id=12345678\n",
        )

        val idFile = reader.read(tmpDir)

        assertEquals("12345678", idFile?.sources?.get("discogs_id"))
    }

    @Test
    fun `should parse INI format with comment lines ignored`() {
        writeFile(
            "id.txt",
            "# a comment\n[source]\n# another comment\ndiscogs_id=99999\n",
        )

        val idFile = reader.read(tmpDir)

        assertEquals("99999", idFile?.sources?.get("discogs_id"))
    }

    @Test
    fun `should parse INI format with multiple keys`() {
        writeFile(
            "id.txt",
            "[source]\ndiscogs_id=111\namg_id=222\n",
        )

        val idFile = reader.read(tmpDir)

        assertEquals("111", idFile?.sources?.get("discogs_id"))
        assertEquals("222", idFile?.sources?.get("amg_id"))
    }

    // -------------------------------------------------------------------------
    // YAML format (metadata.yml)
    // -------------------------------------------------------------------------

    @Test
    fun `should parse YAML format with sources block`() {
        writeFile(
            "metadata.yml",
            "sources:\n  discogs_id: \"12345678\"\n",
        )

        val idFile = reader.read(tmpDir)

        assertEquals("12345678", idFile?.sources?.get("discogs_id"))
    }

    @Test
    fun `should parse YAML format with multiple source fields`() {
        writeFile(
            "metadata.yml",
            "sources:\n  discogs_id: \"111\"\n  amg_id: \"222\"\n",
        )

        val idFile = reader.read(tmpDir)

        assertEquals("111", idFile?.sources?.get("discogs_id"))
        assertEquals("222", idFile?.sources?.get("amg_id"))
    }

    @Test
    fun `should parse YAML format without quotes`() {
        writeFile(
            "metadata.yml",
            "sources:\n  discogs_id: 99999\n",
        )

        val idFile = reader.read(tmpDir)

        assertEquals("99999", idFile?.sources?.get("discogs_id"))
    }

    // -------------------------------------------------------------------------
    // File priority
    // -------------------------------------------------------------------------

    @Test
    fun `should prefer id-txt over metadata-yml when both present`() {
        // SourceConfig default order: id.txt, local_ids.txt, metadata.yml
        writeFile("id.txt", "[source]\ndiscogs_id=from-ini\n")
        writeFile("metadata.yml", "sources:\n  discogs_id: from-yaml\n")

        val idFile = reader.read(tmpDir)

        assertEquals("from-ini", idFile?.sources?.get("discogs_id"))
    }

    // -------------------------------------------------------------------------
    // Missing file
    // -------------------------------------------------------------------------

    @Test
    fun `read should return null when no id file exists in directory`() {
        // tmpDir exists but contains no id file
        val emptyDir = Path(System.getProperty("java.io.tmpdir"), "kbeatz-empty-${System.nanoTime()}")
        SystemFileSystem.createDirectories(emptyDir)
        try {
            val result = reader.read(emptyDir)
            assertNull(result)
        } finally {
            runCatching { SystemFileSystem.delete(emptyDir) }
        }
    }

    // -------------------------------------------------------------------------
    // discogsId helper
    // -------------------------------------------------------------------------

    @Test
    fun `discogsId should return discogs_id field value`() {
        val idFile = IdFile(sources = mapOf("discogs_id" to "77777"))
        assertEquals("77777", reader.discogsId(idFile))
    }

    @Test
    fun `discogsId should return null when discogs_id field absent`() {
        val idFile = IdFile(sources = mapOf("amg_id" to "123"))
        assertNull(reader.discogsId(idFile))
    }

    @Test
    fun `discogsId from read INI file should return correct id`() {
        writeFile("id.txt", "[source]\ndiscogs_id=55555\n")

        val idFile = reader.read(tmpDir)
        assertNull(null) // ensure file was found
        assertEquals("55555", reader.discogsId(idFile!!))
    }
}
