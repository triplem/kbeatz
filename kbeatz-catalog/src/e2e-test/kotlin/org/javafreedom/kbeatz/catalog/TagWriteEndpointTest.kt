package org.javafreedom.kbeatz.catalog

import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation as ServerContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.uuid.Uuid
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums.syncRoutes
import org.javafreedom.kbeatz.catalog.adapters.inbound.web.albums.tagRoutes
import org.javafreedom.kbeatz.catalog.api.models.AlbumDetail
import org.javafreedom.kbeatz.catalog.api.models.AlbumTagFieldUpdate
import org.javafreedom.kbeatz.catalog.api.models.BulkUpdateTagsRequest
import org.javafreedom.kbeatz.catalog.api.models.ErrorResponse
import org.javafreedom.kbeatz.catalog.api.models.TrackTagFieldUpdate
import org.javafreedom.kbeatz.catalog.api.models.UpdateTagFieldRequest
import org.javafreedom.kbeatz.catalog.application.service.AlbumService
import org.javafreedom.kbeatz.catalog.application.service.TagWriteService
import org.javafreedom.kbeatz.catalog.domain.model.Album
import org.javafreedom.kbeatz.catalog.domain.model.SyncPreview
import org.javafreedom.kbeatz.catalog.domain.model.SyncResult
import org.javafreedom.kbeatz.catalog.domain.model.Track
import org.javafreedom.kbeatz.catalog.domain.model.WRITE_LOCK_FILENAME
import org.javafreedom.kbeatz.catalog.domain.port.SyncProvider
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.DbFactory
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.ExposedAlbumRepository
import org.javafreedom.kbeatz.catalog.infrastructure.persistence.ExposedTrackRepository
import org.javafreedom.kbeatz.catalog.plugins.configureStatusPages
import org.javafreedom.kbeatz.common.BusinessValidationException

/**
 * Wire-level E2E tests for mutating album endpoints.
 *
 * Covers the HTTP-to-service boundary for:
 * - PATCH /albums/{albumId}                     (single album-level field write)
 * - PATCH /albums/{albumId}/tags                (bulk tag write)
 * - PATCH /albums/{albumId}/tracks/{trackId}    (single track-level field write)
 * - POST  /albums/{albumId}/sync                (Discogs sync trigger)
 *
 * ## Test setup
 *
 * Each partial-wiring test uses a unique in-memory H2 database (Liquibase-migrated)
 * and real service instances to exercise routing registration, JSON deserialization, and
 * status-code mapping at the wire level. A temporary directory serves as the library root
 * and contains a minimal valid FLAC file so the TagWriteService can exercise its file-I/O path.
 *
 * 404 tests use the full application module (application { module() }) so they also cover
 * the actual route-registration path used in production.
 *
 * ## POST /sync
 *
 * For the 422 (no source ID) and 503 (provider unavailable) cases, a stub [SyncProvider]
 * is injected via partial wiring to avoid needing a real Discogs token or network access.
 */
@Suppress("TooManyFunctions")
class TagWriteEndpointTest {

    private lateinit var libraryRoot: Path
    private lateinit var albumDir: Path
    private lateinit var dataSource: AutoCloseable

    private lateinit var albumRepository: ExposedAlbumRepository
    private lateinit var trackRepository: ExposedTrackRepository
    private lateinit var albumService: AlbumService
    private lateinit var tagWriteService: TagWriteService

    private val albumId: Uuid = Uuid.random()
    private val trackId: Uuid = Uuid.random()

    private val testJson = Json { ignoreUnknownKeys = true }

    @BeforeTest
    fun setUp() {
        libraryRoot = Files.createTempDirectory("tag-e2e-root")
        albumDir = Files.createTempDirectory(libraryRoot, "kind-of-blue")
        copyMinimalFlac(albumDir.resolve("01-so-what.flac"))

        // Each test gets its own in-memory H2 database to avoid cross-test contamination.
        dataSource = DbFactory.init(
            "jdbc:h2:mem:tag_e2e_${Uuid.random()};DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        )
        albumRepository = ExposedAlbumRepository()
        trackRepository = ExposedTrackRepository()
        albumService = AlbumService(albumRepository, trackRepository)
        tagWriteService = TagWriteService(albumRepository, trackRepository, libraryRoot)

        // Seed the in-memory DB with one album and one track.
        runBlocking {
            albumRepository.save(buildAlbum())
            trackRepository.saveAll(listOf(buildTrack()))
        }
    }

    @AfterTest
    fun tearDown() {
        Files.deleteIfExists(albumDir.resolve(WRITE_LOCK_FILENAME))
        libraryRoot.toFile().deleteRecursively()
        dataSource.close()
    }

    // ------------------------------------------------------------------
    // PATCH /albums/{albumId}  -  single album-level field write
    // ------------------------------------------------------------------

    @Test
    fun `PATCH album single field returns 200 with updated genre in response`() = testApplication {
        install(ServerContentNegotiation) { json(testJson) }
        application { configureStatusPages() }
        routing { tagRoutes(albumService, tagWriteService, libraryRoot) }

        val client = createClient { install(ContentNegotiation) { json(testJson) } }

        val response = client.patch("/albums/$albumId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "GENRE", value = "Jazz"))
        }

        assertEquals(HttpStatusCode.OK, response.status)
        val detail = response.body<AlbumDetail>()
        assertEquals(albumId.toString(), detail.id)
        assertEquals("Jazz", detail.genre)
        assertNotNull(detail.tracks)
    }

    @Test
    fun `PATCH album single field returns 404 for unknown albumId`() = testApplication {
        application { module() }
        val client = createClient { install(ContentNegotiation) { json(testJson) } }

        val unknownId = Uuid.random()
        val response = client.patch("/api/v1/albums/$unknownId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "GENRE", value = "Jazz"))
        }

        assertEquals(HttpStatusCode.NotFound, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", error.code)
    }

    @Test
    fun `PATCH album single field returns 409 when write-lock file is already held`() = testApplication {
        install(ServerContentNegotiation) { json(testJson) }
        application { configureStatusPages() }
        routing { tagRoutes(albumService, tagWriteService, libraryRoot) }

        // Simulate the CLI holding the write-lock file.
        Files.writeString(albumDir.resolve(WRITE_LOCK_FILENAME), "cli-write-in-progress")

        val client = createClient { install(ContentNegotiation) { json(testJson) } }

        val response = client.patch("/albums/$albumId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "GENRE", value = "Jazz"))
        }

        // The single-field handler does not catch ConflictException itself;
        // StatusPages maps it to 409 with code WRITE_IN_PROGRESS.
        assertEquals(HttpStatusCode.Conflict, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("WRITE_IN_PROGRESS", error.code)
    }

    // ------------------------------------------------------------------
    // PATCH /albums/{albumId}/tags  -  bulk tag write
    // ------------------------------------------------------------------

    @Test
    fun `PATCH album bulk tags returns 200 with all updated fields in response`() = testApplication {
        install(ServerContentNegotiation) { json(testJson) }
        application { configureStatusPages() }
        routing { tagRoutes(albumService, tagWriteService, libraryRoot) }

        val client = createClient { install(ContentNegotiation) { json(testJson) } }

        val response = client.patch("/albums/$albumId/tags") {
            contentType(ContentType.Application.Json)
            setBody(
                BulkUpdateTagsRequest(
                    albumFields = listOf(
                        AlbumTagFieldUpdate(field = "GENRE", value = "Electronic"),
                        AlbumTagFieldUpdate(field = "DATE", value = "2024"),
                    ),
                    trackFields = listOf(
                        TrackTagFieldUpdate(trackId = trackId.toString(), field = "TITLE", value = "So What"),
                    ),
                ),
            )
        }

        assertEquals(HttpStatusCode.OK, response.status)
        val detail = response.body<AlbumDetail>()
        assertEquals(albumId.toString(), detail.id)
        assertEquals("Electronic", detail.genre)
        assertEquals("2024", detail.date)
    }

    @Test
    fun `PATCH album bulk tags returns 404 for unknown albumId`() = testApplication {
        application { module() }
        val client = createClient { install(ContentNegotiation) { json(testJson) } }

        val unknownId = Uuid.random()
        val response = client.patch("/api/v1/albums/$unknownId/tags") {
            contentType(ContentType.Application.Json)
            setBody(
                BulkUpdateTagsRequest(
                    albumFields = listOf(AlbumTagFieldUpdate(field = "GENRE", value = "Jazz")),
                    trackFields = emptyList(),
                ),
            )
        }

        assertEquals(HttpStatusCode.NotFound, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", error.code)
    }

    @Test
    fun `PATCH album bulk tags returns 409 when write-lock file is already held`() = testApplication {
        install(ServerContentNegotiation) { json(testJson) }
        application { configureStatusPages() }
        routing { tagRoutes(albumService, tagWriteService, libraryRoot) }

        Files.writeString(albumDir.resolve(WRITE_LOCK_FILENAME), "cli-write-in-progress")

        val client = createClient { install(ContentNegotiation) { json(testJson) } }

        val response = client.patch("/albums/$albumId/tags") {
            contentType(ContentType.Application.Json)
            setBody(
                BulkUpdateTagsRequest(
                    albumFields = listOf(AlbumTagFieldUpdate(field = "GENRE", value = "Jazz")),
                    trackFields = emptyList(),
                ),
            )
        }

        // handleBulkPatch catches ConflictException directly and returns 409 WRITE_CONFLICT.
        assertEquals(HttpStatusCode.Conflict, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("WRITE_CONFLICT", error.code)
    }

    // ------------------------------------------------------------------
    // PATCH /albums/{albumId}/tracks/{trackId}  -  track-level field write
    // ------------------------------------------------------------------

    @Test
    fun `PATCH track single field returns 200 with updated title in response`() = testApplication {
        install(ServerContentNegotiation) { json(testJson) }
        application { configureStatusPages() }
        routing { tagRoutes(albumService, tagWriteService, libraryRoot) }

        val client = createClient { install(ContentNegotiation) { json(testJson) } }

        val response = client.patch("/albums/$albumId/tracks/$trackId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "TITLE", value = "Freddie Freeloader"))
        }

        assertEquals(HttpStatusCode.OK, response.status)
        val detail = response.body<AlbumDetail>()
        assertEquals(albumId.toString(), detail.id)
        val updatedTrack = detail.tracks.firstOrNull { it.id == trackId.toString() }
        assertNotNull(updatedTrack, "Updated track must appear in the AlbumDetail response")
        assertEquals("Freddie Freeloader", updatedTrack.title)
    }

    @Test
    fun `PATCH track single field returns 404 for unknown albumId`() = testApplication {
        application { module() }
        val client = createClient { install(ContentNegotiation) { json(testJson) } }

        val unknownId = Uuid.random()
        val aTrackId = Uuid.random()
        val response = client.patch("/api/v1/albums/$unknownId/tracks/$aTrackId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateTagFieldRequest(field = "TITLE", value = "Title"))
        }

        assertEquals(HttpStatusCode.NotFound, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", error.code)
    }

    // ------------------------------------------------------------------
    // POST /albums/{albumId}/sync  -  Discogs sync trigger
    // ------------------------------------------------------------------

    @Test
    fun `POST sync returns 404 for unknown albumId`() = testApplication {
        application { module() }
        val client = createClient { install(ContentNegotiation) { json(testJson) } }

        val unknownId = Uuid.random()
        val response = client.post("/api/v1/albums/$unknownId/sync") {
            contentType(ContentType.Application.Json)
            setBody("{}")
        }

        assertEquals(HttpStatusCode.NotFound, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("RESOURCE_NOT_FOUND", error.code)
    }

    @Test
    fun `POST sync returns 422 NO_SOURCE_ID when album has no discogsId`() = testApplication {
        install(ServerContentNegotiation) { json(testJson) }
        application { configureStatusPages() }
        val syncProvider = stubSyncProvider { _, _ ->
            throw BusinessValidationException("Album '$albumId' has no Discogs ID set - cannot sync")
        }
        routing { syncRoutes(syncProvider, libraryRoot) }

        val client = createClient { install(ContentNegotiation) { json(testJson) } }

        val response = client.post("/albums/$albumId/sync") {
            contentType(ContentType.Application.Json)
            setBody("{}")
        }

        assertEquals(HttpStatusCode.UnprocessableEntity, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("NO_SOURCE_ID", error.code)
    }

    @Test
    fun `POST sync returns 503 SYNC_FAILED when provider throws an unexpected error`() = testApplication {
        install(ServerContentNegotiation) { json(testJson) }
        application { configureStatusPages() }
        val syncProvider = stubSyncProvider { _, _ ->
            error("Discogs sync unavailable - DISCOGS_TOKEN is not configured")
        }
        routing { syncRoutes(syncProvider, libraryRoot) }

        val client = createClient { install(ContentNegotiation) { json(testJson) } }

        val response = client.post("/albums/$albumId/sync") {
            contentType(ContentType.Application.Json)
            setBody("{}")
        }

        assertEquals(HttpStatusCode.ServiceUnavailable, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("SYNC_FAILED", error.code)
    }

    @Test
    fun `POST sync returns 400 INVALID_ALBUM_ID for a malformed UUID`() = testApplication {
        application { module() }
        val client = createClient { install(ContentNegotiation) { json(testJson) } }

        val response = client.post("/api/v1/albums/not-a-uuid/sync") {
            contentType(ContentType.Application.Json)
            setBody("{}")
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        val error = response.body<ErrorResponse>()
        assertEquals("INVALID_ALBUM_ID", error.code)
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private fun buildAlbum(): Album = Album(
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
        directoryPath = albumDir.toString(),
        extraTags = null,
        images = null,
    )

    private fun buildTrack(): Track = Track(
        id = trackId,
        albumId = albumId,
        title = "So What",
        trackNumber = "1",
        discNumber = null,
        trackTotal = null,
        discTotal = null,
        artist = null,
        composer = null,
        conductor = null,
        ensemble = null,
        durationSeconds = 565,
        path = "01-so-what.flac",
        images = null,
        extraTags = null,
    )

    private fun copyMinimalFlac(dest: Path) {
        val stream = javaClass.getResourceAsStream("/minimal.flac")
        if (stream != null) {
            stream.use { Files.copy(it, dest) }
        } else {
            Files.write(dest, buildMinimalFlac())
        }
    }

    @Suppress("MagicNumber") // FLAC StreamInfo bit-field layout per RFC 9639 §9.2
    private fun buildMinimalFlac(): ByteArray {
        val marker = byteArrayOf(0x66, 0x4C, 0x61, 0x43)
        val streamInfoPayload = ByteArray(34) { 0 }.also {
            it[0] = 0x10; it[1] = 0x00
            it[2] = 0x10; it[3] = 0x00
            it[10] = 0xAC.toByte()
            it[11] = 0x44.toByte()
            it[12] = 0x01.toByte()
            it[13] = 0xF0.toByte()
            it[16] = 0xAC.toByte(); it[17] = 0x44.toByte()
        }
        val len0 = ((34 shr 16) and 0xFF).toByte()
        val len1 = ((34 shr 8) and 0xFF).toByte()
        val len2 = (34 and 0xFF).toByte()
        val vendorBytes = "kbeatz".toByteArray(Charsets.UTF_8)
        val vcPayload = buildVorbisCommentPayload(vendorBytes)
        val vcHeaderByte = (0x80 or 4).toByte()
        val siHeaderByte = 0.toByte()
        val vcLen0 = ((vcPayload.size shr 16) and 0xFF).toByte()
        val vcLen1 = ((vcPayload.size shr 8) and 0xFF).toByte()
        val vcLen2 = (vcPayload.size and 0xFF).toByte()
        val vcHeader = byteArrayOf(vcHeaderByte, vcLen0, vcLen1, vcLen2)
        return marker + byteArrayOf(siHeaderByte, len0, len1, len2) + streamInfoPayload + vcHeader + vcPayload
    }

    @Suppress("MagicNumber")
    private fun buildVorbisCommentPayload(vendorBytes: ByteArray): ByteArray {
        val result = ByteArray(4 + vendorBytes.size + 4)
        result[0] = (vendorBytes.size and 0xFF).toByte()
        result[1] = ((vendorBytes.size shr 8) and 0xFF).toByte()
        result[2] = ((vendorBytes.size shr 16) and 0xFF).toByte()
        result[3] = ((vendorBytes.size shr 24) and 0xFF).toByte()
        vendorBytes.copyInto(result, 4)
        result[4 + vendorBytes.size] = 0
        result[5 + vendorBytes.size] = 0
        result[6 + vendorBytes.size] = 0
        result[7 + vendorBytes.size] = 0
        return result
    }
}

/**
 * Creates a minimal [SyncProvider] backed by the given suspend lambda.
 * Used in partial-wiring tests to inject controlled provider behaviour without a real Discogs token.
 */
private fun stubSyncProvider(block: suspend (Uuid, Boolean) -> SyncResult): SyncProvider =
    object : SyncProvider {
        override val name = "test-stub"
        override suspend fun preview(albumId: Uuid): SyncPreview =
            error("stubSyncProvider does not implement preview")
        override suspend fun sync(albumId: Uuid, downloadImages: Boolean): SyncResult =
            block(albumId, downloadImages)
    }
