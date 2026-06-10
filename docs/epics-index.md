# kbeatz: Epics Index

**Date**: 2026-06-10  
**Status**: M1-M4 epics approved; M5 epics approved (except #362 pending); challenge-all review complete (2026-06-09) - 33 findings logged as sub-issues; two new epics added (#472 docs, #473 Phase 3)

---

| # | Epic | Milestone | Complexity | Priority | Status |
|---|---|---|---|---|---|
| [#13](https://github.com/triplem/kbeatz/issues/13) | Platform Foundation & Deployment | M1 | M | - | approved |
| [#14](https://github.com/triplem/kbeatz/issues/14) | Library Scan & Album Indexing | M1 | L | P0 | approved |
| [#15](https://github.com/triplem/kbeatz/issues/15) | Album Browsing & Search | M2 | L | P0 | approved |
| [#16](https://github.com/triplem/kbeatz/issues/16) | In-Place Tag Editing | M3 | M | P0 | approved |
| [#17](https://github.com/triplem/kbeatz/issues/17) | Discogs Metadata Sync | M3 | L | P0 | approved |
| [#18](https://github.com/triplem/kbeatz/issues/18) | CLI Tagger & ID-File Migration | M4 | M | P1 | approved |
| [#358](https://github.com/triplem/kbeatz/issues/358) | Discogs Sync Pipeline Architecture | M5 | M | tech-debt | approved |
| [#359](https://github.com/triplem/kbeatz/issues/359) | Application Configuration Management | M5 | S | tech-debt | approved |
| [#360](https://github.com/triplem/kbeatz/issues/360) | UI Internationalisation | M5 | S | enhancement | approved |
| [#361](https://github.com/triplem/kbeatz/issues/361) | Documentation Infrastructure & Polish | M5 | S | docs | approved |
| [#362](https://github.com/triplem/kbeatz/issues/362) | Build, Release & CI Pipeline Hardening | M5 | S | tech-debt | pending-approval |
| [#472](https://github.com/triplem/kbeatz/issues/472) | Documentation Corrections | M5 | XS | docs | approved |
| [#473](https://github.com/triplem/kbeatz/issues/473) | Phase 3: Multi-Collection and Multi-Library Support | Phase 3 | XL | enhancement | pending-approval |

---

## Challenge-all findings (2026-06-09)

Overall verdict: **REVISE** - no blockers; all findings are specification gaps resolved as sub-issues.

### #13 - Platform Foundation & Deployment

| Issue | Finding | Persona |
|---|---|---|
| [#366](https://github.com/triplem/kbeatz/issues/366) | Add readiness vs liveness distinction to health endpoint | Operations |
| [#367](https://github.com/triplem/kbeatz/issues/367) | Add non-root user and pin base image digest in Dockerfiles | DevOps / Security |
| [#368](https://github.com/triplem/kbeatz/issues/368) | Add Nginx security headers to SPA container | DevOps |

### #14 - Library Scan & Album Indexing

| Issue | Finding | Persona |
|---|---|---|
| [#369](https://github.com/triplem/kbeatz/issues/369) | Document H2 AUTO_SERVER=TRUE security implications in ADR-007 | Security / Architect |
| [#370](https://github.com/triplem/kbeatz/issues/370) | Add 10k-album acceptance criterion for NFR-11 | Requirements / Performance |
| [#371](https://github.com/triplem/kbeatz/issues/371) | Specify in-memory album list cache invalidation strategy | Architect |
| [#372](https://github.com/triplem/kbeatz/issues/372) | Add timeout to startup write-lock repair scan | Operations / User |
| [#373](https://github.com/triplem/kbeatz/issues/373) | Add VA compilation album grouping acceptance criterion | QA |
| [#374](https://github.com/triplem/kbeatz/issues/374) | Specify FLAC scanner concurrency model | Performance |
| [#375](https://github.com/triplem/kbeatz/issues/375) | Developer reference for write-lock lifecycle | Technical Writer (cross-cutting) |
| [#398](https://github.com/triplem/kbeatz/issues/398) | Automated performance tests for P0 targets | Performance (cross-cutting) |

### #15 - Album Browsing & Search

| Issue | Finding | Persona |
|---|---|---|
| [#376](https://github.com/triplem/kbeatz/issues/376) | Add virtual scrolling to album grid for large collections | Performance |
| [#377](https://github.com/triplem/kbeatz/issues/377) | Add WCAG AA accessibility requirements to album browsing | UX/Accessibility |
| [#378](https://github.com/triplem/kbeatz/issues/378) | Restate path traversal guard for cover art endpoint | Security |
| [#379](https://github.com/triplem/kbeatz/issues/379) | Specify error state when catalog API is unreachable | User (cross-cutting) |
| [#380](https://github.com/triplem/kbeatz/issues/380) | Add edge-case acceptance criteria (empty library, malformed metadata) | QA |

### #16 - In-Place Tag Editing

| Issue | Finding | Persona |
|---|---|---|
| [#381](https://github.com/triplem/kbeatz/issues/381) | Communicate album-level edit scope and click-to-edit discoverability | UX/Accessibility |
| [#382](https://github.com/triplem/kbeatz/issues/382) | Add loading state and disable fields during tag write | User |
| [#383](https://github.com/triplem/kbeatz/issues/383) | Add WCAG AA accessibility requirements to tag editing view | UX/Accessibility |
| [#384](https://github.com/triplem/kbeatz/issues/384) | Specify error state for write timeout or service unavailable | User (cross-cutting) |
| [#385](https://github.com/triplem/kbeatz/issues/385) | Add concurrent edit scenario: locking and acceptance criterion | QA / Architect |

### #17 - Discogs Metadata Sync

| Issue | Finding | Persona |
|---|---|---|
| [#386](https://github.com/triplem/kbeatz/issues/386) | Fix image quota JSON concurrent access between catalog and CLI | Architect |
| [#387](https://github.com/triplem/kbeatz/issues/387) | Add NFR-04 Discogs fetch latency acceptance criterion | Requirements |
| [#388](https://github.com/triplem/kbeatz/issues/388) | Add loading and disabled state to Sync button during sync | UX/Accessibility |
| [#389](https://github.com/triplem/kbeatz/issues/389) | Add WCAG AA accessibility requirements to Discogs sync panel | UX/Accessibility |
| [#390](https://github.com/triplem/kbeatz/issues/390) | Add structured WARN logging for Discogs rate-limit waits | Operations |
| [#391](https://github.com/triplem/kbeatz/issues/391) | Add test cases for Discogs API timeout and malformed response | QA |
| [#392](https://github.com/triplem/kbeatz/issues/392) | Warn user when sync would overwrite locally edited tags; write edits back to metadata.json (Option A decided) | User / Architect |

### #18 - CLI Tagger & ID-File Migration

| Issue | Finding | Persona |
|---|---|---|
| [#393](https://github.com/triplem/kbeatz/issues/393) | Specify exit codes (0 success, 1 hard fail, 2 invalid args, 3 partial batch fail) | User / Requirements |
| [#394](https://github.com/triplem/kbeatz/issues/394) | Acceptance criteria for all id-file formats and batch reporting of missing id files | QA |

### #358 - Discogs Sync Pipeline Architecture

| Issue | Finding | Persona |
|---|---|---|
| [#395](https://github.com/triplem/kbeatz/issues/395) | Define .kbeatz/ retention policy (Option A decided: keep all, overwrite on same-ID re-sync) | Operations |
| [#396](https://github.com/triplem/kbeatz/issues/396) | Add acceptance criterion for FLAC file count vs track count mismatch | QA |

### #360 - UI Internationalisation

| Issue | Finding | Persona |
|---|---|---|
| [#397](https://github.com/triplem/kbeatz/issues/397) | Add developer guide for i18n conventions in kbeatz-ui | Technical Writer |

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

Existing ADRs (ADR-001 through ADR-006) cover FLAC implementation, Kotlin File API, CLI framework, image handling, module structure, and database choice - no rework needed.
