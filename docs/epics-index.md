# kbeatz — Epics Index

**Date**: 2026-06-06  
**Status**: all epics approved

---

| # | Epic | Milestone | Complexity | Priority | Status |
|---|---|---|---|---|---|
| [#13](https://github.com/triplem/kbeatz/issues/13) | Platform Foundation & Deployment | M1 | M | — | approved |
| [#14](https://github.com/triplem/kbeatz/issues/14) | Library Scan & Album Indexing | M1 | L | P0 | approved |
| [#15](https://github.com/triplem/kbeatz/issues/15) | Album Browsing & Search | M2 | L | P0 | approved |
| [#16](https://github.com/triplem/kbeatz/issues/16) | In-Place Tag Editing | M3 | M | P0 | approved |
| [#17](https://github.com/triplem/kbeatz/issues/17) | Discogs Metadata Sync | M3 | L | P0 | approved |
| [#18](https://github.com/triplem/kbeatz/issues/18) | CLI Tagger & ID-File Migration | M4 | M | P1 | approved |

---

## Requirements coverage

| Requirement | Epic(s) |
|---|---|
| FR-01–FR-05 (Browse) | #15 |
| FR-06–FR-08 (Tag editing) | #16 |
| FR-09 (Discogs sync) | #17, #18 |
| FR-10–FR-13 (Discogs details, rate limit, images) | #17 |
| FR-14–FR-15 (ID-file migration) | #18 |
| FR-16–FR-17 (Classical display, sort) | #15 |
| FR-18 (Cover art endpoint) | #15 |
| FR-19–FR-20 (Library scan, lock manifest) | #14 |
| NFR-01–02 (Performance: grid, filter) | #15 |
| NFR-03 (Tag write latency) | #16 |
| NFR-04 (Discogs fetch latency) | #17 |
| NFR-05 (Availability) | #13 |
| NFR-06 (Security: path traversal, token) | #13, #17 |
| NFR-08 (Atomic writes) | #16, #17 |
| NFR-09 (Podman deployment) | #13 |
| NFR-10 (Browser targets) | #15 |
| NFR-11–12 (Scale: 10k albums, payload) | #14 |
| NFR-13 (Write consistency / lock manifest) | #14, #16, #17 |

---

## ADR triggers identified

| ADR topic | Epic | Status |
|---|---|---|
| H2 album index schema (denormalised vs normalised, multi-disc representation) | #14 | to be created before #14 stories |
| Discogs rate-limiting strategy (token bucket vs sliding window) | #17 | to be created before #17 stories |

Existing ADRs (ADR-001 through ADR-006) cover FLAC implementation, Kotlin File API, CLI framework, image handling, module structure, and database choice — no rework needed.
