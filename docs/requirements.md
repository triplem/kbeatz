# kbeatz — Requirements Document

**Version**: 1.0  
**Date**: 2026-06-05  
**Status**: Draft — pending approval  
**Source**: RequirementsAgent elicitation (8 questions, 2 challenge cycles)

---

## 1. Problem Statement

The user manages a personal FLAC music collection of ~2 000 albums (growing) on a dedicated Linux machine. The existing tool, **discogstagger** (Python CLI), can batch-tag albums from Discogs but provides no browsing, no UI, and no manual tag editing. The user must switch between discogstagger, a file manager, and a music player to accomplish basic collection management tasks. kbeatz replaces this fragmented workflow with a single self-hosted web application.

**Pain points discogstagger does not solve:**
- Cannot browse or search the collection visually
- Cannot edit individual tags without re-running the full tagging pipeline
- No cover art display or collection overview
- CLI-only — not usable from other devices on the local network

---

## 2. Stakeholders

| Role | Who | Notes |
|---|---|---|
| Primary user | triplem (sole user) | Uses from desktop + other LAN devices |
| Operator | triplem | Self-hosted on the collection machine |
| External system | Discogs API | Metadata source; personal access token auth |
| External system | MusicBrainz API | Secondary metadata source (v2) |

---

## 3. Context & Constraints

| Constraint | Detail |
|---|---|
| Collection size | ~2 000 albums, growing |
| Collection machine OS | Linux |
| Container runtime | Podman (preferred); compose file must be compatible with `podman-compose` |
| Deployment | Self-hosted; accessed over local area network |
| Discogs ID availability | User already has the Discogs release ID when tagging (looks it up in Discogs manually and adds to their collection) |
| Existing id files | ~70 % of albums (est. ~1 400) have `id.txt` / `local_ids.txt`; ~600 are untagged |
| Team | Single developer |

---

## 4. Functional Requirements

Requirements are listed in priority order. **P0** = must have for v1 switch; **P1** = important but not the switching trigger; **P2** = future phases.

### P0 — Browse the collection

**FR-01** The system shall display all albums in the collection as a visual grid.  
Each album card shows: cover art (placeholder if absent), album title, primary artist or composer, release year, and genre.

**FR-02** The user shall be able to filter the album grid by artist, composer, genre, and year (range). Filters update the visible results immediately (client-side, no round-trip).

**FR-03** The user shall be able to perform a free-text search across album title, artist, composer, and label. Results update immediately as the user types.

**FR-04** The album grid shall load within 3–5 seconds on first access (v1 acceptable). The p95 target for initial grid load is < 1 second once the metadata cache is warm (long-term requirement).

**FR-05** Filter and search operations on a loaded grid shall complete in < 200 ms p95 (client-side).

### P0 — In-place tag editing

**FR-06** The user shall be able to open an album detail view showing all Vorbis Comment tags for that album.

**FR-07** The user shall be able to edit any individual tag field in place (click → edit → save). Changes are written to **all FLAC files that belong to the album** for album-level tags (ALBUM, ALBUMARTIST, DATE, GENRE, LABEL, CATALOGNUMBER, COMPOSER, CONDUCTOR, ENSEMBLE). Track-level tags (TITLE, TRACKNUMBER, ARTIST on VA albums) update only the individual file.

**FR-08** A save operation writes changes to disk immediately using the atomic write strategy (temp file + rename). No "pending changes" queue in v1.

### P0 — Discogs sync

**FR-09** Given an album directory containing a `metadata.yml` (or `id.txt` / `local_ids.txt`) file with a `discogs_id`, the system shall fetch the corresponding Discogs release and write all standard Vorbis Comment tags to every FLAC file in that album directory.

**FR-10** Discogs sync applies automatically without a preview/diff step (user trusts Discogs data). If the result is wrong, the user corrects it via manual editing (FR-07) or by providing a different `discogs_id`.

**FR-11** Cover art: the primary Discogs image is embedded as `METADATA_BLOCK_PICTURE` type 3 in every FLAC file **and** saved as `folder.jpg` in the album directory.

**FR-12** Sync shall respect the Discogs API rate limit (60 req/min) and the image download quota (1 000 images/day). The daily image counter persists across service restarts in a JSON file.

**FR-13** Image download is **opt-in** for the CLI tagger (`--download-images` flag, default: off). Most albums in the existing collection already have `folder.jpg` from discogstagger; re-downloading would consume quota unnecessarily. The UI sync panel shall offer an explicit "also update cover art" checkbox, also defaulting to unchecked.

### P0 — Library scan

**FR-19** The system shall scan all FLAC files under the configured library root and build (or refresh) the metadata index. Scan is triggered: (a) automatically at service startup, (b) on demand via `POST /api/v1/library/scan` from the UI. Scan progress is available at `GET /api/v1/library/scan/status`.

**FR-20** A multi-file album tag write shall be preceded by writing a `.kbeatz-write.lock` manifest in the album directory listing all target file paths. On startup, any orphaned lock file triggers a repair scan for that directory. Individual file writes remain atomic (temp file + rename).

### P1 — Identity file migration

**FR-14** The CLI tool (`kbeatz-tagger migrate-ids`) shall convert INI-style `id.txt` / `local_ids.txt` files to YAML `metadata.yml`. The original files are deleted after successful conversion unless `--keep-original` is specified.

**FR-15** `kbeatz-tagger tag` shall accept both INI and YAML id files. File type is detected by extension (`.yml`/`.yaml` → YAML; all other → INI).

### P1 — Classical music display

**FR-16** When `COMPOSER` is set on an album, the UI shall display the composer as the primary attribution and conductor / ensemble as secondary. Sort order is user-configurable (default: COMPOSER for classical, ALBUMARTIST otherwise).

**FR-17** The user shall be able to change the primary sort key from a Settings panel. The preference persists in localStorage.

### P1 — Cover art browsing

**FR-18** `GET /api/v1/albums/{albumId}/cover` returns the front cover image. Resolution order: embedded `METADATA_BLOCK_PICTURE` type 3 → `folder.jpg` → HTTP 404.

### P2 — Future phases (out of scope for v1)

| Feature | Notes |
|---|---|
| Discogs release search | Find the right Discogs release for an untagged album |
| Discogs Collection API | Add releases to the user's Discogs collection via API |
| Preview/diff before sync | Show field-by-field diff; apply selectively |
| Similar albums / artists | Discovery / recommendation feature |
| MusicBrainz sync | Secondary metadata source |
| Mobile-optimised UI | Desktop-first for v1; tablet-usable as stretch goal |
| Server-side search index | Client-side filter is sufficient for v1 at 2 000 albums |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | Initial album grid load: p95 < 3 s (v1); p95 < 1 s (long-term with warm cache) |
| NFR-02 | Performance | Filter / search on loaded data: p95 < 200 ms (client-side) |
| NFR-03 | Performance | Single-album tag write: p95 < 500 ms for files ≤ 200 MB. Larger files (24-bit/96 kHz) are subject to the in-memory audio load limitation noted in ADR-001; streaming write is a v2 improvement. |
| NFR-04 | Performance | Discogs metadata fetch (single album): p95 < 3 s (network-dependent) |
| NFR-05 | Availability | No formal SLA; personal tool. Service restart < 30 s. |
| NFR-06 | Security | No authentication in v1 (trusted LAN). `DISCOGS_TOKEN` via environment variable only; never in source or logs. Path traversal guard on all filesystem operations. |
| NFR-07 | Security | v2: Keycloak JWT/OIDC authentication. |
| NFR-08 | Data safety | FLAC writes are atomic (temp file + rename). No file is ever left in a corrupt state. |
| NFR-09 | Deployment | Deployable with `podman-compose up`. Single `compose.yml` works with both Podman and Docker. |
| NFR-10 | Browsers | Latest Firefox and Chromium on Linux. Safari (tablet) as stretch goal. |
| NFR-11 | Library size | System must remain responsive at 10 000 albums (indexing strategy must support future growth). |
| NFR-12 | Payload size | Album listing API response shall not exceed 500 KB (after gzip compression) at 10 000 albums. Above 5 000 albums (configurable threshold), the listing endpoint switches to server-side pagination with a pre-built in-memory search index. |
| NFR-13 | Write consistency | A multi-file album write interrupted mid-operation shall be detectable and recoverable on next startup via the `.kbeatz-write.lock` manifest (see FR-20). No album shall be permanently left in a partially-written state. |

---

## 6. Domain Model

### Album (logical)

An album is defined by the tuple `(ALBUMARTIST, ALBUM, DATE)` across FLAC files sharing those tag values. For compilations (`ALBUMARTIST = "Various Artists"`), the key is `(ALBUM, DATE)`.

An album maps to one filesystem directory (the **album root**), with optional immediate `disc1/`, `disc2/` subdirectories for multi-disc releases. The album root directory and all its immediate disc subdirectories are treated as a single album unit for all sync, tag-write, and cover-art operations.

**Disambiguation rules (in precedence order):**
1. Directory path is the primary grouping boundary — FLAC files in different directories are never merged into the same album, even if their tags match.
2. `DISCNUMBER` distinguishes discs within the same album root.
3. If `DATE` is absent, the album is grouped without it; two releases of the same album title in the same directory are treated as one album.
4. `metadata.yml` in the album root applies to all FLAC files in the root and all disc subdirectories.

### Key entities

| Entity | Attributes | Notes |
|---|---|---|
| **Album** | albumArtist, album, date, genre, label, catno, composer, conductor, ensemble, discogsId, coverArt | Logical grouping |
| **Track** | title, trackNumber, discNumber, trackTotal, discTotal, artist, duration | Per-file |
| **IdFile** | sources: Map<fieldName, value> | `metadata.yml` per album directory |
| **FlacFile** | path, metadataBlocks, audioFrames | Physical file; parsed by kbeatz-tagger (codec/flac/) |
| **DiscogsRelease** | id, title, artists, extraArtists, year, labels, genres, styles, tracklist, images | Cached from Discogs API |

### Tag field mapping (Discogs → Vorbis Comment)

| Discogs field | Vorbis Comment tag |
|---|---|
| artists[0].name | ALBUMARTIST |
| title | ALBUM |
| year | DATE |
| genres[0] | GENRE |
| styles | STYLE / GROUPING |
| labels[0].name | LABEL |
| labels[0].catno | CATALOGNUMBER |
| identifiers[barcode] | BARCODE |
| extraArtists[role=Composed By] | COMPOSER |
| extraArtists[role=Conductor] | CONDUCTOR |
| extraArtists[role=Orchestra] | ENSEMBLE |
| tracklist[i].title | TITLE (per track) |
| tracklist[i].position | TRACKNUMBER (per track) |

---

## 7. Integrations

### Discogs API
- Base URL: `https://api.discogs.com/`
- Auth: `Authorization: Discogs token=$DISCOGS_TOKEN` (Personal Access Token)
- Rate limits: 60 req/min metadata; 1 000 images/day
- Endpoints used: `GET /releases/{id}`, image downloads
- Future: `GET /users/{username}/collection`, `POST /users/{username}/collection/folders/{folderId}/releases/{releaseId}`

### Local filesystem
- Library root: configured via `catalog.library.root` in `application.conf`
- All path parameters validated to resolve within the configured root (path traversal guard)
- FLAC files read/written using kbeatz-tagger (codec/flac/) (RFC 9639 implementation)

### kbeatz-sources (library)
- Consumed in-process by `kbeatz-catalog` and `kbeatz-tagger` as a compile-time dependency
- `MetadataSource` port interface; `DiscogsMetadataSource` implementation in `discogs/` sub-package
- No inter-service HTTP calls; no deployment unit of its own

---

## 8. Acceptance Criteria

| ID | Criterion | How to verify |
|---|---|---|
| AC-01 | Album grid displays all albums in the configured library root | Count albums in UI vs `find /music -name "*.flac" -printf "%h\n" \| sort -u \| wc -l` |
| AC-02 | Typing "Beethoven" in the search box returns only albums with COMPOSER or ALBUMARTIST containing "Beethoven" | Manual test + inspect filtered results |
| AC-03 | Filter by genre "Jazz" returns only albums with GENRE=Jazz | Manual test |
| AC-04 | Filter + search results update without page reload | Observe — no network request on keystroke |
| AC-05 | Clicking an album tag field, editing, and saving updates the tag in the FLAC file on disk | `metaflac --list file.flac` before and after |
| AC-06 | Album-level tag edit propagates to all tracks in the album | Inspect all FLAC files in directory with metaflac |
| AC-07 | Discogs sync with a valid `metadata.yml` writes correct tags to all FLAC files | `metaflac --list` after sync; compare with Discogs website |
| AC-08 | Front cover is embedded in every FLAC file after sync AND `folder.jpg` exists in the directory | `metaflac --list` for PICTURE block; `ls folder.jpg` |
| AC-09 | `kbeatz-tagger migrate-ids /path --recursive` converts all `id.txt` files to `metadata.yml` | Diff before/after; verify YAML is valid and INI files removed |
| AC-10 | `kbeatz-tagger tag /path/to/album` tags a single album without UI interaction | Run CLI; verify FLAC tags updated |
| AC-11 | A FLAC write interrupted mid-operation leaves the original file intact | Kill process during write; verify original file unchanged |
| AC-12 | Service is deployable with `podman-compose up` from a clean checkout | Run on fresh Linux VM with Podman |
| AC-13 | `GET /health` returns 200 on both services when running | `curl http://localhost:8080/api/v1/health` |
| AC-14 | Initial album grid loads in under 5 seconds on the LAN from a cold start | Browser DevTools Network tab; measure DOMContentLoaded |
| AC-15 | `POST /api/v1/library/scan` triggers a rescan; newly added album directory appears in grid | Add directory after first scan, trigger rescan, verify album appears |
| AC-16 | A write process killed mid-album leaves `.kbeatz-write.lock`; on next startup the album is repaired | Kill -9 during write; restart service; verify all FLAC tags are consistent |
| AC-17 | During a library scan the UI displays a progress indicator (e.g. "Scanning: 342 / 2 000 albums") | Trigger `POST /api/v1/library/scan`; observe UI polling `GET /api/v1/library/scan/status` |
| AC-18 | When `COMPOSER` is set on an album, the album card shows the composer as primary attribution (not ALBUMARTIST) | Browse grid for a classical album; verify composer is displayed prominently |
| AC-19 | A path parameter containing `..` (e.g. `../../../etc/passwd`) returns HTTP 400 | Send `GET /api/v1/albums/../../../etc/passwd`; expect 400 |
| AC-20 | When the Discogs image quota is exhausted, the sync panel shows a message with the expected reset time (UTC midnight) | Exhaust quota in test; trigger sync with `downloadImages=true`; verify 429 response and UI message |

---

## 9. Assumptions

| ID | Assumption | Impact if wrong |
|---|---|---|
| A-01 | ~70 % of albums (~1 400) have existing `id.txt` / `local_ids.txt` files | Migration scope changes; does not affect architecture |
| A-02 | One directory = one album (possibly with disc subdirectories) | Album grouping logic must be revisited if multi-album directories exist |
| A-03 | The Discogs release ID is always known before tagging (user looked it up manually) | "Release search" feature moves to v1 if this is often not the case |
| A-04 | 2 000 albums fit comfortably in memory as JSON summaries (~500 KB) for client-side filter | If collection grows to 50 000+, server-side search index is needed sooner |
| A-05 | FLAC files in a directory share the same ALBUM and ALBUMARTIST tags | Edge case: directories with mixed albums would break the grouping model |
| A-06 | Single user; no concurrent edit conflicts to handle | Must be revisited if multiple household members edit simultaneously |

---

## 10. Open Questions

| ID | Question | Default if not answered |
|---|---|---|
| ~~OQ-01~~ | ~~podman-compose availability~~ | **Resolved**: `podman-compose` is installed and is a hard deployment requirement. |
| ~~OQ-02~~ | ~~Default ports~~ | **Resolved**: 8080 (kbeatz-catalog). kbeatz-sources is a library — no HTTP port. |
| ~~OQ-03~~ | ~~kbeatz-tagger distribution~~ | **Resolved**: Both fat JAR (for CLI use on the collection machine) and container image (for compose context) are produced as build artefacts. |
| ~~OQ-04~~ | ~~Database choice~~ | **Resolved**: SQLite for v1 (zero-ops, single file, sufficient for 10 000 albums). PostgreSQL is the documented v2 migration target. Exposed ORM + Liquibase migrations apply to both. |

---

## 11. Out of Scope (v1)

- Discogs release search / "find the right release" wizard
- Discogs Collection API write (add release to user's collection)
- MusicBrainz metadata sync
- Audio playback
- Preview/diff before Discogs sync
- Mobile-optimised layout
- Multi-user / authentication (v1 assumes trusted LAN)
- Automatic library monitoring (filesystem watcher)
- Similar albums / artist recommendation

---

*Document generated by RequirementsAgent. Challenge cycle completed internally (8 requirements challenged, 6 defaults proposed and noted as assumptions).*
