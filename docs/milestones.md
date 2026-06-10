# kbeatz: Milestone Plan

**Version**: 1.1  
**Date**: 2026-06-09  
**Status**: Epics approved; challenge-all review complete (2026-06-09); 33 findings logged as sub-issues on each epic

---

## Guiding principles

Milestones are ordered by: hard dependencies first, then business priority (P0 before P1), then risk (high-risk epics early so failures surface quickly).

---

## M1: Foundation (prerequisite for all user-visible work)

**Goal:** A deployable skeleton with a complete album index. No UI yet, but the catalog API returns real data and the CI pipeline is green.

| Epic | Issue | Complexity | Priority |
|---|---|---|---|
| Platform Foundation & Deployment | #13 | M | - |
| Library Scan & Album Indexing | #14 | L | P0 |

**Exit criteria:**
- `podman-compose up` starts both services
- `GET /api/v1/albums` returns all albums from a 2 000-album library within 60 s of startup
- `GET /api/v1/albums` returns all albums from a 10 000-album library (NFR-11; see #370)
- `POST /api/v1/library/scan` triggers a rescan; new albums appear in subsequent API response
- `GET /api/v1/health/ready` returns 503 during startup repair and 200 when ready (see #366)
- CI pipeline green (build + tests + Detekt + Kover ≥ 80 %)
- Dockerfiles run as non-root; base images pinned by digest (see #367)
- Nginx SPA container sends security headers (see #368)

**Challenge-all additions:** #366 (readiness endpoint), #367 (Dockerfile hardening), #368 (Nginx security headers), #369 (H2 AUTO_SERVER ADR), #370 (NFR-11 10k criterion), #371 (cache invalidation), #372 (repair timeout), #373 (VA grouping), #374 (scanner parallelism), #375 (write-lock reference), #398 (performance tests)

**Risk:** Album grouping algorithm and H2 schema are new domain logic - highest design risk in the whole project. Placing this in M1 surfaces any modelling errors before UI work begins. H2 AUTO_SERVER=TRUE security implications must be resolved in ADR-007 (#369) before implementation.

---

## M2: Browsable collection (first user-visible milestone)

**Goal:** The user can open a browser, see all albums in a visual grid, filter and search client-side, and view cover art.

| Epic | Issue | Complexity | Priority |
|---|---|---|---|
| Album Browsing & Search | #15 | L | P0 |

**Exit criteria:**
- Album grid renders within 5 s on cold start with virtual scrolling active (see #376)
- Filter by genre, artist, composer, year updates instantly (no network round-trip)
- Free-text search across title/artist/composer/label works client-side
- Classical albums display composer as primary attribution
- `GET /api/v1/albums/{albumId}/cover` resolves embedded PICTURE → `folder.jpg` → 404
- Cover art endpoint rejects paths outside CATALOG_LIBRARY_ROOT with HTTP 400 (see #378)
- Album grid meets WCAG AA (keyboard navigation, contrast, screen-reader labels) (see #377)
- Error state shown when catalog API is unreachable (see #379)
- Empty library and malformed metadata edge cases handled gracefully (see #380)

**Challenge-all additions:** #376 (virtual scrolling), #377 (accessibility), #378 (traversal guard), #379 (error state), #380 (edge cases)

**Risk:** Client-side filter performance at 2 000 albums - validate early with realistic fixture data. Virtual scrolling must be included from the start (#376); retrofitting it after the grid is built is significantly more complex.

---

## M3: Core editing workflow (v1 switch trigger)

**Goal:** The user can sync album tags from Discogs and fix mistakes in-place - the complete replacement for the discogstagger + file-manager workflow.

| Epic | Issue | Complexity | Priority |
|---|---|---|---|
| In-Place Tag Editing | #16 | M | P0 |
| Discogs Metadata Sync | #17 | L | P0 |

**Exit criteria** (all P0 acceptance criteria from requirements AC-05 through AC-11, AC-16, AC-20):
- Click-to-edit any tag; album-level changes propagate to all tracks; scope is clearly communicated in the UI (see #381)
- Atomic writes: original file never left corrupt
- `.kbeatz-write.lock` repair works for both tag edits and Discogs sync writes
- Concurrent edit to the same album returns HTTP 409 (see #385)
- Local tag edits are written back to `.kbeatz/metadata.json` (Option A - see #392)
- Discogs sync writes correct tags; image download opt-in; quota enforcement works; quota file access is race-free (see #386)
- Sync warns user before overwriting locally edited tags (see #392)
- Path traversal guard active (from M1, verified end-to-end)
- Tag editing and sync UI meet WCAG AA (see #383, #389)
- Write-lock lifecycle documented in a single developer reference (see #375)

**Challenge-all additions (epic #16):** #381 (scope communication), #382 (loading state), #383 (accessibility), #384 (error state), #385 (concurrent edit locking)
**Challenge-all additions (epic #17):** #386 (quota race), #387 (NFR-04 criterion), #388 (sync button state), #389 (accessibility), #390 (rate-limit logging), #391 (API error tests), #392 (overwrite warning + metadata.json write-back)

**Note:** #16 and #17 can be developed in parallel once M2 is merged. #16 does not depend on #17. However, the decision in #392 (local edits write back to metadata.json) affects the tag-write service story (#69) in #16 - resolve #392 before starting #69.

**Risk:** Atomic write + lock manifest interaction across two epics (#16 and #17) - integration test covering a sync-killed-mid-write scenario is mandatory before M3 ships. Read the write-lock developer reference (#375) before implementing either epic.

---

## M4: CLI tagger (P1 feature, parallelisable)

**Goal:** The user can tag albums from the terminal and batch-migrate all ~1 400 INI id files to `metadata.yml` in one command.

| Epic | Issue | Complexity | Priority |
|---|---|---|---|
| CLI Tagger & ID-File Migration | #18 | M | P1 |

**Prerequisite:** issues #2 and #7 (kbeatz-sources library blockers) resolved - these are already open and are independent of the catalog HTTP service. M4 work can begin once #2 and #7 are closed, even while M3 is still in progress.

**Exit criteria:**
- `kbeatz-tagger tag /path` tags a single album from any recognised id file (metadata.yml, id.txt, discogs_id.txt, multiple_id.txt; mb_id.txt detected and rejected with a clear message) (see #394)
- `kbeatz-tagger migrate-ids /music --recursive` converts all INI files; originals deleted by default
- Exit codes: 0 success, 1 hard fail, 2 invalid args, 3 partial batch fail (see #393)
- Batch mode reports all albums with no usable id file as a summary list at the end of the run (see #394)
- Fat JAR builds via `./gradlew :kbeatz-cli:shadowJar`

**Challenge-all additions:** #393 (exit codes), #394 (id-file formats and missing-file reporting)

---

## Dependency graph

```
#13 (Platform)
  └── #14 (Scan & Index)
        └── #15 (Browse & Search)
              └── #16 (Tag Editing)      ← M3, parallel with #17
        └── #17 (Discogs Sync)           ← M3, parallel with #16

#2, #7 (library blockers)
  └── #18 (CLI Tagger)                  ← M4, can start once #2+#7 done
```

---

## M5: Post-v1 improvements

**Goal:** Architecture cleanup, configuration hardening, and UI/docs polish after the v1 switch.

| Epic | Issue | Complexity | Priority |
|---|---|---|---|
| Discogs Sync Pipeline Architecture | #358 | M | tech-debt |
| Application Configuration Management | #359 | S | tech-debt |
| UI Date Localization | #360 | S | enhancement |
| Documentation Infrastructure & Polish | #361 | S | docs |
| Build, Release & CI Pipeline Hardening | #362 | S | tech-debt |
| Album Image Management | #94 | M | P1 |
| Library Layout Reorganisation | #93 | M | post-v1 |
| MusicBrainz Metadata Sync | #96 | L | P2 |

**Exit criteria:**
- Discogs sync pipeline has clean source/tagger boundary; MusicBrainz path is unblocked
- FLAC file count vs track count mismatch aborts the album write with a structured error (see #396)
- `.kbeatz/` retention policy documented (Option A: keep all, overwrite on same-ID re-sync) (see #395)
- All runtime config accessible via application.conf with env-var overrides
- Dates in the UI are locale-formatted
- i18n developer guide available for adding new translation keys (see #397)
- GH Pages serves docs at root with quality report links

**Challenge-all additions (epic #358):** #395 (.kbeatz/ retention), #396 (FLAC/track mismatch)
**Challenge-all additions (epic #360):** #397 (i18n developer guide)

---

## Summary table

| Milestone | Epics | Total complexity | Delivers |
|---|---|---|---|
| M1 | #13, #14 | M + L | Deployable foundation + album index |
| M2 | #15 | L | Visual collection browsing |
| M3 | #16, #17 | M + L | Tag editing + Discogs sync - v1 switch trigger |
| M4 | #18 | M | CLI tagger + id-file migration |
| M5 | #358, #359, #360, #361, #362, #94, #93, #96 | M+S+S+S+S+M+M+L | Architecture cleanup + post-v1 features |
