package org.javafreedom.kbeatz.tagger.idfile

import kotlinx.io.buffered
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import kotlinx.io.writeString
import org.junit.jupiter.api.BeforeEach
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
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

    /**
     * Copies named fixture files from the test classpath (fixtures/ resource directory) into a
     * fresh temp directory and returns that directory as a [Path] for use with [IdFileReader.read].
     *
     * The indirection through a temp directory is required because [IdFileReader] resolves
     * id.txt / local_ids.txt / metadata.yml by scanning a real filesystem directory.
     */
    private fun fixtureDir(vararg fileNames: String): Path {
        val dir = Path(System.getProperty("java.io.tmpdir"), "kbeatz-fixture-${System.nanoTime()}")
        SystemFileSystem.createDirectories(dir)
        fileNames.forEach { name ->
            val url = checkNotNull(this::class.java.classLoader.getResource("fixtures/$name")) {
                "Fixture not found on classpath: fixtures/$name"
            }
            val fileContent = java.io.File(url.toURI()).readText(Charsets.UTF_8)
            val dest = Path(dir, name)
            SystemFileSystem.sink(dest).buffered().use { it.writeString(fileContent) }
            filesToDelete.add(dest)
        }
        filesToDelete.add(dir)
        return dir
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

    // -------------------------------------------------------------------------
    // Real fixture files -- id.txt (discogs_id.txt from discogstagger test suite)
    // Expected values documented in src/test/resources/fixtures/README.md
    // -------------------------------------------------------------------------

    @Test
    fun `should parse real id-txt fixture with discogs_id 4712`() {
        val dir = fixtureDir("id.txt")

        val idFile = reader.read(dir)

        assertNotNull(idFile, "id.txt fixture must be found and parsed")
        assertEquals("4712", idFile.sources["discogs_id"])
        assertEquals("discogs", idFile.sources["name"])
    }

    @Test
    fun `discogsId helper should extract 4712 from real id-txt fixture`() {
        val dir = fixtureDir("id.txt")

        val idFile = reader.read(dir)

        assertNotNull(idFile)
        assertEquals("4712", reader.discogsId(idFile))
    }

    // -------------------------------------------------------------------------
    // Real fixture files -- local_ids.txt (multiple_id.txt from discogstagger)
    // -------------------------------------------------------------------------

    @Test
    fun `should parse real local-ids-txt fixture with discogs_id 4713 and amg_id 4711`() {
        // local_ids.txt has both amg_id and discogs_id; discogs_id is the primary key
        val config = SourceConfig(idFileNames = listOf("local_ids.txt"))
        val localReader = IdFileReader(config)
        val dir = fixtureDir("local_ids.txt")

        val idFile = localReader.read(dir)

        assertNotNull(idFile, "local_ids.txt fixture must be found and parsed")
        assertEquals("4713", idFile.sources["discogs_id"])
        assertEquals("4711", idFile.sources["amg_id"])
    }

    // -------------------------------------------------------------------------
    // Real fixture files -- metadata.yml (YAML format with UTF-8 characters)
    // -------------------------------------------------------------------------

    @Test
    fun `should parse real metadata-yml fixture and return discogs_id 3083`() {
        val config = SourceConfig(idFileNames = listOf("metadata.yml"))
        val yamlReader = IdFileReader(config)
        val dir = fixtureDir("metadata.yml")

        val idFile = yamlReader.read(dir)

        assertNotNull(idFile, "metadata.yml fixture must be found and parsed")
        assertEquals("3083", idFile.sources["discogs_id"])
    }

    @Test
    fun `should decode UTF-8 umlaut correctly from real metadata-yml fixture`() {
        val config = SourceConfig(idFileNames = listOf("metadata.yml"))
        val yamlReader = IdFileReader(config)
        val dir = fixtureDir("metadata.yml")

        val idFile = yamlReader.read(dir)

        assertNotNull(idFile)
        // artist field contains "Kruder & Dorfmeister" with u-umlaut (U+00FC)
        assertEquals("Krüder & Dorfmeister", idFile.sources["artist"])
    }

    // -------------------------------------------------------------------------
    // Malformed id.txt -- missing discogs_id field
    // -------------------------------------------------------------------------

    @Test
    fun `should return null for malformed id-txt fixture missing discogs_id`() {
        // malformed-id.txt has a [source] section but no discogs_id key
        val config = SourceConfig(idFileNames = listOf("malformed-id.txt"))
        val malformedReader = IdFileReader(config)
        val dir = fixtureDir("malformed-id.txt")

        val idFile = malformedReader.read(dir)

        assertNull(idFile, "Parser must return null when discogs_id is absent from [source]")
    }
}
