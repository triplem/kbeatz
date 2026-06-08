# kbeatz: Milestone Plan

**Version**: 1.0  
**Date**: 2026-06-06  
**Status**: Draft - epics approved, stories pending decomposition

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
- `POST /api/v1/library/scan` triggers a rescan; new albums appear in subsequent API response
- CI pipeline green (build + tests + Detekt + Kover ≥ 80 %)

**Risk:** Album grouping algorithm and H2 schema are new domain logic - highest design risk in the whole project. Placing this in M1 surfaces any modelling errors before UI work begins.

---

## M2: Browsable collection (first user-visible milestone)

**Goal:** The user can open a browser, see all albums in a visual grid, filter and search client-side, and view cover art.

| Epic | Issue | Complexity | Priority |
|---|---|---|---|
| Album Browsing & Search | #15 | L | P0 |

**Exit criteria:**
- Album grid renders within 5 s on cold start
- Filter by genre, artist, composer, year updates instantly (no network round-trip)
- Free-text search across title/artist/composer/label works client-side
- Classical albums display composer as primary attribution
- `GET /api/v1/albums/{albumId}/cover` resolves embedded PICTURE → `folder.jpg` → 404

**Risk:** Client-side filter performance at 2 000 albums - validate early with realistic fixture data.

---

## M3: Core editing workflow (v1 switch trigger)

**Goal:** The user can sync album tags from Discogs and fix mistakes in-place - the complete replacement for the discogstagger + file-manager workflow.

| Epic | Issue | Complexity | Priority |
|---|---|---|---|
| In-Place Tag Editing | #16 | M | P0 |
| Discogs Metadata Sync | #17 | L | P0 |

**Exit criteria** (all P0 acceptance criteria from requirements AC-05 through AC-11, AC-16, AC-20):
- Click-to-edit any tag; album-level changes propagate to all tracks
- Atomic writes: original file never left corrupt
- `.kbeatz-write.lock` repair works for both tag edits and Discogs sync writes
- Discogs sync writes correct tags; image download opt-in; quota enforcement works
- Path traversal guard active (from M1, verified end-to-end)

**Note:** #16 and #17 can be developed in parallel once M2 is merged. #16 does not depend on #17.

**Risk:** Atomic write + lock manifest interaction across two epics (#16 and #17) - integration test covering a sync-killed-mid-write scenario is mandatory before M3 ships.

---

## M4: CLI tagger (P1 feature, parallelisable)

**Goal:** The user can tag albums from the terminal and batch-migrate all ~1 400 INI id files to `metadata.yml` in one command.

| Epic | Issue | Complexity | Priority |
|---|---|---|---|
| CLI Tagger & ID-File Migration | #18 | M | P1 |

**Prerequisite:** issues #2 and #7 (kbeatz-sources library blockers) resolved - these are already open and are independent of the catalog HTTP service. M4 work can begin once #2 and #7 are closed, even while M3 is still in progress.

**Exit criteria:**
- `kbeatz-tagger tag /path` tags a single album from `metadata.yml` or `id.txt`
- `kbeatz-tagger migrate-ids /music --recursive` converts all INI files; originals deleted by default
- Fat JAR builds via `./gradlew :kbeatz-cli:shadowJar`

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

## Summary table

| Milestone | Epics | Total complexity | Delivers |
|---|---|---|---|
| M1 | #13, #14 | M + L | Deployable foundation + album index |
| M2 | #15 | L | Visual collection browsing |
| M3 | #16, #17 | M + L | Tag editing + Discogs sync - v1 switch trigger |
| M4 | #18 | M | CLI tagger + id-file migration |
