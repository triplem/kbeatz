# kbeatz: Album Detail View/Edit Redesign Requirements

**Version**: 1.0
**Date**: 2026-06-18
**Status**: Draft - pending approval
**Scope**: `kbeatz-ui` (React SPA) only. No backend API changes unless explicitly noted.
**Source**: RequirementsAgent elicitation from Discogs screenshots (12 images) at
`/home/triplem/Pictures/Screenshots/`; existing `album-detail.tsx` and `album-hero-header.tsx`
reviewed; existing `AlbumDetail` OpenAPI schema and Track schema reviewed.
**Relates to**: `docs/requirements-ui-rework.md` (UI-FR-06 is the parent requirement this document
refines); master `docs/requirements.md` (FR-06, FR-07, FR-08 cover tag editing behaviour which
this document does not change).

---

## 1. Problem Statement

The current album detail page is always in editable mode: clicking any field opens an inline
text input. This is functional but makes the page visually noisy - every value has hover
affordances and edit icons even when the user just wants to read the release details.

The reference design (Discogs release detail page, screenshots of the "Lang Lang - Piano Book"
release) shows a clean read-only view that presents all metadata and the full tracklist in a
compact, scannable layout, with a separate edit flow accessed via a dedicated button. Track
composer credits appear as a "Composed By - Name" sub-line beneath each track title, making
classical albums much more readable without cluttering the view with a separate column.

This document specifies the two modes:
- **View mode**: clean, read-only, Discogs-inspired. Default for all users landing on a detail
  route.
- **Edit mode**: the existing inline editable fields, reached by pressing an "Edit" button. All
  current editing semantics (dirty-commit, batch save, navigation guard, confirm dialog) are
  preserved unchanged.

**Who benefits**: triplem (sole user). The benefit is a calmer, more readable detail view for
browsing classical albums where composer credits matter more than the ability to edit every field
at a glance.

---

## 2. Stakeholders

| Role | Who | Notes |
|---|---|---|
| Primary user / Product Owner | triplem | Sole user; sole decision-maker on scope |
| Developer | triplem | Builds and maintains the SPA |

---

## 3. Constraints

| Constraint | Detail |
|---|---|
| Stack | React 19, TypeScript strict, MUI, react-router-dom 7, TanStack Query 5, i18next (en/de) |
| API | No changes to `kbeatz-catalog/api/openapi.yaml` or the generated client (see out-of-scope) |
| Editing behaviour | All current tag editing semantics, save flow, and navigation guard are unchanged (FR-06/07/08) |
| Quality gates | `npm run build` passes; ESLint clean; Vitest line+branch coverage >= 80% on changed code; WCAG 2.1 AA |
| Data model | `AlbumDetail` fields available: albumArtist, album, date, genre, label, catalogNumber, composer, conductor, ensemble, country, mediaFormat, discogsId, hasCoverArt, tracks. `Track` fields available: title, trackNumber, discNumber, artist, composer, conductor, ensemble, durationSeconds |

---

## 4. Functional Requirements

Priority: **P0** = required for acceptance; **P1** = important; **P2** = nice to have.

### 4.1 View Mode (read-only)

| ID | Requirement | Priority |
|---|---|---|
| AD-FR-01 | The album detail page shall render in **view mode** by default. View mode is read-only: no inline input fields, no hover affordances, no edit icons. | P0 |
| AD-FR-02 | View mode shall display a **hero header** visually inspired by the Discogs release detail layout: a small cover art thumbnail on the left (hidden when `hasCoverArt` is false), and to the right a large heading showing `albumArtist - album` on one line (artist in bold), followed by compact metadata rows for: Label + catalog number, Media format (Format), Country, Release date, Genre. Each metadata row is omitted when its value is absent. | P0 |
| AD-FR-03 | View mode shall display a **tracklist section** below the hero. Each row shows: track number (left, narrow), track title (expands), and duration (right, fixed width). | P0 |
| AD-FR-04 | When a track has a `composer` tag, a **"Composed By - [Composer Name]"** sub-line shall be rendered below the track title in smaller, secondary-coloured text. When the track has no composer, no sub-line is shown. This applies to all tracks, not just those where composer differs from album artist. | P0 |
| AD-FR-05 | A **"Credits" section** shall be rendered below the tracklist, showing the album-level contributor fields as label-value rows: Composer, Conductor, Ensemble. Rows are omitted when the value is absent or empty. If all three are absent the section is not rendered. | P0 |
| AD-FR-19 | The Credits section shall be marked up as a labelled `<section>` element with an accessible heading at the `h2` level (or `aria-labelledby` pointing to a visible heading element), so it is reachable via heading and landmark navigation in screen readers. | P0 |
| AD-FR-06 | An **"Edit" button** (or icon + label) shall be visible in view mode, positioned near the hero header or page title. Pressing it switches the page to edit mode. | P0 |
| AD-FR-07 | The tracklist section heading shall include a **"Hide credits" / "Show credits" toggle** (matching Discogs "Mitwirkende ausblenden") that collapses and restores the "Composed By" sub-lines under each track title. Default state is shown (credits visible). | P1 |
| AD-FR-08 | Multi-disc albums shall continue to render a **"Disc N" header row** between disc groups in the tracklist (existing behaviour, preserved in view mode). | P0 |

### 4.2 Edit Mode

| ID | Requirement | Priority |
|---|---|---|
| AD-FR-09 | Pressing the Edit button in view mode shall switch the page to **edit mode**, replacing the read-only hero and tracklist with the current `AlbumDetail` editable layout: editable album-level fields (ALBUM_FIELDS), editable track rows, Save button, dirty count, and batch-save error display. | P0 |
| AD-FR-10 | Edit mode shall display a **"Cancel" (or "Back to view") button** that returns to view mode. If there are unsaved dirty fields, pressing Cancel shall display the existing `NavigationGuardDialog` invoked from in-component state (not via the React Router blocker, which only fires on route changes). On guard confirmation, dirty state is discarded and view mode is restored. The router blocker continues to handle actual navigations (Back button, link clicks) independently. | P0 |
| AD-FR-11 | All existing **field-level** editing semantics are preserved: blur cancels an individual field edit and restores the original value; Enter/Tab commits the value as a pending dirty change; no network request is made on commit. The session-level Cancel button (AD-FR-10) is additive and operates independently - it cancels the entire dirty session, not a single field edit. Batch save via ConfirmWriteDialog, navigation guard blocking route changes when dirty, and per-album and per-track field edits are all unchanged. | P0 |
| AD-FR-12 | The Discogs sync panel (when `discogsId` is set) shall be accessible in **both** view mode and edit mode. In view mode it can be rendered as a collapsed/expandable section. In edit mode it remains where it is today. | P1 |

### 4.3 Layout and Navigation

| ID | Requirement | Priority |
|---|---|---|
| AD-FR-13 | The view/edit toggle state shall be **local to the page** (not in the URL). Navigating back and then forward, or reloading the page, shall return to view mode. | P0 |
| AD-FR-14 | The **Back button** (navigate to album grid) shall continue to work in both modes. In edit mode with dirty fields, the existing navigation guard intercepts it. | P0 |
| AD-FR-15 | The layout shall be **fully responsive** (inherits from UI-FR-13): hero/tracklist reflow to single-column on phone-width viewports; touch targets remain >= 44x44 px. | P0 |

### 4.4 Accessibility

| ID | Requirement | Priority |
|---|---|---|
| AD-FR-16 | The "Composed By" sub-line under each track shall be associated with its track title via accessible markup (e.g., `aria-describedby` or rendering both in the same `<li>` / table cell). Screen readers shall announce both the title and the composer on the same track element. | P0 |
| AD-FR-17 | The hide/show credits toggle (AD-FR-07) shall use `aria-expanded` to communicate its state. | P1 |
| AD-FR-18 | Switching between view mode and edit mode shall manage keyboard focus explicitly: entering edit mode moves focus to the **Cancel button**; returning to view mode moves focus to the **Edit button**. This restores orientation for keyboard and screen-reader users after the mode swap. | P0 |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement | Measurement |
|---|---|---|---|
| AD-NFR-01 | No API change | No modifications to `kbeatz-catalog/api/openapi.yaml` or the generated TypeScript client. | Automated check: `git diff --name-only` on API path in CI |
| AD-NFR-02 | Performance | View mode renders with no additional API calls beyond the existing `GET /api/v1/albums/{id}` request that already fires on page load. | Review component: no new `useQuery` calls in view-mode path |
| AD-NFR-03 | Quality gates | `npm run build` (strict) passes with zero errors; ESLint clean; Vitest coverage >= 80% for changed files; i18n locale-parity test passes for all new strings. | CI gates |
| AD-NFR-04 | Accessibility | WCAG 2.1 AA: all interactive elements keyboard-reachable with visible focus; "Composed By" association correct for screen readers; mode switch focus-managed per AD-FR-18. | axe scan + manual keyboard pass |
| AD-NFR-05 | Edit semantics intact | The exact save flow, dirty-count display, confirm dialog, and navigation guard are identical to the current implementation. Zero behaviour regression. | Existing Vitest suite passes unchanged |
| AD-NFR-06 | Animation | View/edit mode transitions shall respect `prefers-reduced-motion`: when the user has requested reduced motion, the transition between view and edit mode is instant (no slide or fade). | Test with `prefers-reduced-motion: reduce` media query; verify no CSS transition plays |

---

## 6. Data Mapping

Fields currently available in `AlbumDetail` and their mapping to view-mode sections:

| API field | View-mode section | Notes |
|---|---|---|
| `albumArtist` | Hero heading | First part of "Artist - Album" heading |
| `album` | Hero heading | Second part of "Artist - Album" heading |
| `label` + `catalogNumber` | Hero metadata row | Joined as "Label - Catalog#" |
| `mediaFormat` | Hero metadata row "Format" | |
| `country` | Hero metadata row "Country" | |
| `date` | Hero metadata row "Released" | Formatted via existing `formatDate()` |
| `genre` | Hero metadata row "Genre" | Comma-separated chips (existing CommaSeparatedChips) |
| `hasCoverArt` | Hero cover art | Thumbnail shown when true |
| `composer` (album) | Credits section | "Composer" row |
| `conductor` (album) | Credits section | "Conductor" row |
| `ensemble` (album) | Credits section | "Ensemble" row |
| `tracks[].title` | Tracklist row | Primary text |
| `tracks[].trackNumber` | Tracklist row (position col) | |
| `tracks[].composer` | Tracklist "Composed By" sub-line | Shown when non-null |
| `tracks[].durationSeconds` | Tracklist duration col | Formatted via existing `formatTrackDuration()` |
| `tracks[].discNumber` | Disc group header | Existing multi-disc grouping |

### Required new i18n keys

The following string keys must exist in both `en.json` and `de.json` before this feature is considered complete (underpins AD-AC-13):

| Key path | English value | German value |
|---|---|---|
| `albumDetail.editButton` | `Edit` | `Bearbeiten` |
| `albumDetail.cancelButton` | `Cancel` | `Abbrechen` |
| `albumDetail.creditsTitle` | `Credits` | `Mitwirkende` |
| `albumDetail.creditsSection` | `Album credits` | `Album-Mitwirkende` |
| `albumDetail.composedByPrefix` | `Composed By` | `Komponiert von` |
| `albumDetail.showCredits` | `Show credits` | `Mitwirkende anzeigen` |
| `albumDetail.hideCredits` | `Hide credits` | `Mitwirkende ausblenden` |

Additional keys may be needed during implementation; this list is the minimum required for AD-AC-13 to be verified deterministically.

### Fields out of scope (not in current API)

The Discogs reference page shows additional sections that have no equivalent in the current
`AlbumDetail` schema. These are explicitly **out of scope** for this redesign:

| Discogs section | Reason deferred |
|---|---|
| Style (Stil) as separate field | API has no `style` field distinct from `genre`; adding it requires a backend story |
| Notes / Anmerkungen (free text) | API has no notes field; deferred to a future backend story |
| Barcode / identifiers | API has no barcode field; deferred to a future backend story |
| Companies / labels as a list | API has a single `label` string, not a structured list; deferred |
| Format checkboxes (CD-ROM, Mini, etc.) | API has a free-text `mediaFormat` field, not structured; deferred |

These deferred sections may be added in a future epic when the catalog API exposes the data.

---

## 7. Assumptions

| ID | Assumption | Risk if Wrong |
|---|---|---|
| A-01 | The view/edit toggle is in-page state (not a separate route). The URL does not encode the mode. | If the user wants deep-linkable edit mode, the URL must encode `?edit=1`; low-risk change. |
| A-02 | "Composed By" sub-line uses `tracks[].composer` for all tracks. When `tracks[].composer` is null/undefined, no sub-line is rendered. | If the user wants the album-level composer shown as fallback per track, a mapping step is added to the view-mode tracklist. |
| A-03 | No new API endpoint or schema change is required. All data rendered in view mode is already returned by `GET /api/v1/albums/{id}`. | If a section requires new data, it is deferred out of scope. |
| A-04 | The existing `AlbumHeroHeader` component is refactored/replaced to match the Discogs header styling. It does not need to remain backwards-compatible (it is only used in `AlbumDetail`). | Low risk. |
| A-05 | The Credits section (AD-FR-05) is album-level only. Per-track conductor/ensemble overrides visible in the track data model are not surfaced in this section. | If per-track credits are needed, tracklist rows must be extended. |
| A-06 | The view/edit mode split shall be implemented as **two separate presentational components** (`AlbumDetailView`, `AlbumDetailEdit`) composed inside the existing `AlbumDetail` wrapper, which owns the `isEditMode` toggle and the shared album query. Edit-mode state (`dirtyFields`, `dirtyTrackFields`, `isSaving`, etc.) lives exclusively inside `AlbumDetailEdit` and is reset on unmount when the user cancels back to view mode. This preserves SRP: the wrapper orchestrates data and mode; the view and edit children render only. | If a single-component approach is chosen instead, the cognitive load of `AlbumDetail` grows further. The two-component split is the required approach. |

---

## 8. Out of Scope

- Any change to `kbeatz-catalog/api/openapi.yaml` or the generated TypeScript client.
- Discogs-specific fields: notes, barcodes, format checkboxes, companies list, style as a
  separate tag (all require new API fields).
- Per-track conductor and ensemble in the tracklist.
- Index / sub-track indentation (the "↳" prefix on Discogs sub-tracks). kbeatz does not model
  index tracks in the current API; this would require changes to the Track schema.
- A new route for edit mode (inline toggle only).
- Any change to Discogs sync functionality.
- Any change to how dirty fields, batch save, or the confirmation dialog work.

---

## 9. Acceptance Criteria

| ID | Criterion | How to verify |
|---|---|---|
| AD-AC-01 | Opening an album detail URL renders view mode by default (no inline inputs, no edit icons) | Load any album detail; inspect DOM for input elements; none found |
| AD-AC-02 | Hero header shows: cover art thumbnail (when present), "Artist - Album Title" heading, and metadata rows for label, format, country, date, genre | Manual visual check; supplemented by component tests asserting `data-testid` presence for each metadata row |
| AD-AC-03 | Each track row in view mode shows track number, title, and duration | Manual visual check; supplemented by component tests asserting row structure and `data-testid` attributes |
| AD-AC-04 | Tracks with a composer tag show a "Composed By - Name" sub-line below the title; tracks without composer show no sub-line | Test with classical album data (some tracks with, some without composer) |
| AD-AC-05 | A Credits section appears below the tracklist showing album-level Composer/Conductor/Ensemble; absent fields are omitted | Test with album that has conductor and ensemble; test with album missing all three (section hidden) |
| AD-AC-06 | Pressing the Edit button switches to edit mode; all existing editable fields are visible and behave identically to the current implementation | Click Edit; edit a field; press Enter (commit); click Save; confirm write; verify tag updated |
| AD-AC-07 | In edit mode, pressing Cancel with no dirty fields returns immediately to view mode | Click Edit; click Cancel immediately |
| AD-AC-08 | In edit mode, pressing Cancel with unsaved dirty fields shows the navigation guard dialog; confirming the dialog returns to view mode and discards dirty state | Click Edit; edit a field; click Cancel; confirm discard |
| AD-AC-09 | In edit mode, the Back button with dirty fields still triggers the navigation guard | Click Edit; edit a field; press Back; confirm guard fires |
| AD-AC-10 | The hide/show credits toggle collapses and restores the "Composed By" sub-lines | Click toggle; verify sub-lines hidden; click again; verify restored |
| AD-AC-11 | The layout is responsive: hero and tracklist stack vertically on phone-width viewports (< 600px); no horizontal scroll | Resize to 375px width; verify layout |
| AD-AC-12 | `npm run build` (TypeScript strict) passes; ESLint clean; Vitest coverage >= 80% on changed files | CI gates |
| AD-AC-13 | All new user-facing strings exist in both `en.json` and `de.json`; the locale-parity test passes | `npm run test` |
| AD-AC-14 | axe WCAG 2.1 AA scan reports no violations on the view mode and edit mode pages in both light and dark themes | Automated axe run |
| AD-AC-15 | After pressing Edit, keyboard focus lands on the Cancel button | Tab-trace after clicking Edit; assert Cancel button is `document.activeElement` |
| AD-AC-16 | After confirming cancel from edit mode, keyboard focus lands on the Edit button | Edit a field; click Cancel; confirm guard; assert Edit button is `document.activeElement` |
| AD-AC-17 | With `prefers-reduced-motion: reduce`, the view/edit mode transition is instant (no CSS transition plays) | Set media query in test; switch modes; assert transition-duration is 0 or unset |
| AD-AC-18 | A multi-disc album in view mode renders a "Disc N" separator row between disc groups in the tracklist | Render a mock album with two disc groups; assert separator rows appear at correct positions |
| AD-AC-19 | An album with zero tracks renders an empty-state message (not a blank tracklist area) in view mode | Render a mock album with an empty tracks array; assert non-empty message text is visible |

---

## 10. Open Questions

| ID | Question | Resolution |
|---|---|---|
| OQ-01 | Should "Composed By" show the album-level `composer` as a fallback on tracks that have no per-track composer? | **Proposed default (A-02):** No - show only the track-level `composer`. If the album has one composer for everything, they all share the same per-track value anyway. Escalate if the user wants fallback. |
| OQ-02 | Should the Discogs sync panel be shown in view mode as a collapsed section, or only visible after switching to edit mode? | **Proposed default (AD-FR-12 P1):** Show as a collapsible section in view mode (same page, below Credits), so the user can trigger a sync without switching to edit mode. Acceptable to defer to a later story. |

---

## 11. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Refactoring AlbumHeroHeader to match Discogs style breaks existing hero tests | Medium | Low | Update tests alongside the component in the same PR |
| R-02 | The "Composed By" sub-line increases tracklist row height significantly on dense classical albums | Low | Low | Limit sub-line to one line (text-overflow: ellipsis) and use secondary typography scale; confirm with visual review |
| R-03 | Edit mode cancel with dirty fields may confuse users if the guard dialog language is not clear | Low | Low | Reuse existing nav-guard dialog which already has clear wording |

---

## 12. Top Risks Summary

1. **No API change constraint**: Several visually appealing Discogs sections (notes, barcodes,
   style) cannot be rendered because the API does not expose those fields. This makes the kbeatz
   view mode less rich than the full Discogs page. Mitigation: explicitly scope them out and
   track as future backend stories.
2. **Edit mode regression**: The edit mode reuses all existing editing components. Any structural
   refactor of `AlbumDetail` must not change saving behaviour, dirty tracking, or guard logic.
   Mitigation: the existing Vitest test suite covers these flows; the requirement is that all
   existing tests continue to pass unchanged.
3. **Test coverage**: Adding a view/edit mode toggle and a new Credits section adds new code paths.
   The Vitest coverage gate must be maintained at >= 80% for changed files.

---

*Document generated by RequirementsAgent. Architect review (ACCEPT with revisions) incorporated:
component split mandate (A-06), Cancel guard precision (AD-FR-10), focus management targets
(AD-FR-18 + AD-AC-15/16), prefers-reduced-motion NFR (AD-NFR-06 + AD-AC-17). Challenge-all
review (REVISE) incorporated: AD-FR-02 layout prescription softened, AD-FR-11 field-level vs
session-level cancel clarified, AD-FR-19 accessible Credits heading added, i18n keys table added
to Section 6, AD-AC-02/03 marked manual + supplemented by component tests, AD-AC-18/19 added
for multi-disc and empty-tracklist edge cases. Pending product-owner approval.*
