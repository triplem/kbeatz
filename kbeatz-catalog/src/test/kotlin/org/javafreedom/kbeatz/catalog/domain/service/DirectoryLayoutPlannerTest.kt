package org.javafreedom.kbeatz.catalog.domain.service

import java.nio.file.Paths
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.uuid.Uuid
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.DirectoryTemplate

class DirectoryLayoutPlannerTest {

    private val libraryRoot = "/srv/music"

    private fun album(
        albumArtist: String = "Miles Davis",
        album: String = "Kind of Blue",
        date: String? = "1959",
        genre: String? = "Jazz",
        label: String? = "Columbia",
    ) = Album(
        id = Uuid.random(),
        albumArtist = albumArtist,
        album = album,
        date = date,
        genre = genre,
        label = label,
        catalogNumber = null,
        composer = null,
        conductor = null,
        ensemble = null,
        discogsId = null,
        directoryPath = "/srv/music/incoming",
        extraTags = null,
        images = null,
    )

    private fun planner(raw: String = "\${ALBUMARTIST}/\${ALBUM} (\${DATE})") =
        DirectoryLayoutPlanner(DirectoryTemplate(raw))

    @Test
    fun `should resolve relative and absolute path when template substitutes basic tokens`() {
        val result = planner().planTargetDirectory(album(), libraryRoot)

        assertEquals("Miles Davis/Kind of Blue (1959)", result.relativePath)
        assertEquals(
            Paths.get("/srv/music/Miles Davis/Kind of Blue (1959)").toString(),
            result.absolutePath,
        )
    }

    @Test
    fun `should drop dangling empty parens when optional date token is missing`() {
        val result = planner().planTargetDirectory(album(date = null), libraryRoot)

        assertEquals("Miles Davis/Kind of Blue", result.relativePath)
    }

    @Test
    fun `should derive year from full date when YEAR token is used`() {
        val result = planner("\${ALBUMARTIST}/\${ALBUM} (\${YEAR})")
            .planTargetDirectory(album(date = "2021-05-04"), libraryRoot)

        assertEquals("Miles Davis/Kind of Blue (2021)", result.relativePath)
    }

    @Test
    fun `should leave YEAR blank when date is not numeric`() {
        val result = planner("\${ALBUM} (\${YEAR})")
            .planTargetDirectory(album(date = "unknown"), libraryRoot)

        assertEquals("Kind of Blue", result.relativePath)
    }

    @Test
    fun `should sanitise illegal characters in token value into a single safe segment`() {
        val result = planner("\${ALBUMARTIST}/\${ALBUM}")
            .planTargetDirectory(album(albumArtist = "AC/DC", album = "Live?"), libraryRoot)

        assertEquals("AC_DC/Live_", result.relativePath)
        assertTrue(!result.relativePath.contains("AC/DC"), "slash in token value must be neutralised")
    }

    @Test
    fun `should neutralise traversal sequence in token value and stay inside library root`() {
        val result = planner("\${ALBUMARTIST}/\${ALBUM}")
            .planTargetDirectory(album(albumArtist = "../../etc", album = "passwd"), libraryRoot)

        val rootPath = Paths.get(libraryRoot).normalize()
        assertTrue(
            Paths.get(result.absolutePath).startsWith(rootPath),
            "resolved path ${result.absolutePath} escaped $rootPath",
        )
        assertTrue(
            !result.relativePath.split('/').contains(".."),
            "no path segment may be a bare traversal token",
        )
    }

    @Test
    fun `should neutralise absolute path in token value and stay inside library root`() {
        val result = planner("\${ALBUM}")
            .planTargetDirectory(album(album = "/etc/passwd"), libraryRoot)

        val rootPath = Paths.get(libraryRoot).normalize()
        assertTrue(
            Paths.get(result.absolutePath).startsWith(rootPath),
            "resolved path ${result.absolutePath} escaped $rootPath",
        )
    }

    @Test
    fun `should resolve multi-segment template with several tokens`() {
        val result = planner("\${GENRE}/\${LABEL}/\${ALBUMARTIST} - \${ALBUM}")
            .planTargetDirectory(album(), libraryRoot)

        assertEquals("Jazz/Columbia/Miles Davis - Kind of Blue", result.relativePath)
    }

    @Test
    fun `should reject unknown token at template construction`() {
        assertFailsWith<org.javafreedom.kbeatz.common.BusinessValidationException> {
            planner("\${ALBUM}/\${UNKNOWN}")
        }
    }
}
