# kbeatz: UI Rework Requirements

**Version**: 1.0
**Date**: 2026-06-17
**Status**: Draft - pending approval
**Scope**: `kbeatz-ui` (React SPA) only. No backend or API changes.
**Source**: RequirementsAgent elicitation (4 decisions confirmed with the product owner)
**Relates to**: master product requirements `docs/requirements.md`; supersedes the styling half of ADR-010

---

## 1. Problem Statement

`kbeatz-ui` works but looks unfinished. ADR-010 notes the app shipped with almost no
stylesheet of its own, relying on browser defaults and a handful of CSS Module files added
since. There is no cohesive visual language, no in-app theme control, and the navigation is a
flat single-view layout that will not scale as features grow (the configurable-directory epic
#811 already adds a settings area and a change-plan preview workflow).

The product owner wants the whole UI reworked to look clean and modern, built on Material
Design, with both a light and a dark theme the user can switch between.

**Pain points the current UI does not solve:**
- No consistent, modern visual design; inconsistent spacing, typography, and elevation.
- No user-controllable theme. ADR-010 ships dark-only, driven solely by the OS setting.
- Flat information architecture: no app bar, no navigation structure, no dedicated settings area.
- No first-class responsive behaviour; the layout is desktop-default only.

---

## 2. Stakeholders

| Role | Who | Notes |
|---|---|---|
| Primary user | triplem (sole user) | Uses from desktop and other LAN devices, now including phone/tablet |
| Operator | triplem | Self-hosted; cares about bundle size and load time on the LAN |
| Designer/Developer | Single developer | Builds and maintains the SPA; values low framework churn but accepted MUI |

---

## 3. Context and Constraints

| Constraint | Detail |
|---|---|
| Stack | React 19, TypeScript (strict), Vite 6, react-router-dom 7, TanStack Query 5, i18next (en/de) |
| Existing styling | CSS Modules + `src/styles/tokens.css` design tokens (ADR-010) |
| Chosen library | **MUI (Material UI), Material 3 theming** - confirmed by product owner |
| Server state | TanStack Query stays as the single server-state library (ADR-010, unchanged) |
| API | Catalog OpenAPI client (`src/api/generated/`) unchanged; this is a UI-only rework |
| Brand palette | violet `#7C5CFF`, pink `#FF5A8F`, teal `#2EC4B6`, amber `#FFB627` (ADR-010) |
| Quality gates | `npm run build` (strict) passes; ESLint clean; Vitest coverage >= 80%; WCAG 2.1 AA |
| Team | Single developer; migration must stay reviewable |

### Confirmed decisions (this elicitation)

| # | Decision | Choice |
|---|---|---|
| D1 | Material Design implementation | Adopt the **MUI** component library (supersedes ADR-010 styling) |
| D2 | Theme selection | **User-toggleable** light/dark, persisted in localStorage, first load follows OS `prefers-color-scheme` |
| D3 | Rework scope | **Visual rebuild + navigation/IA restructure**; no brand-new product features |
| D4 | Responsive target | **Fully responsive including phone** |
| D5 | Migration sequence | **Incremental, screen by screen**; app shippable at every step |

---

## 4. Functional Requirements

Priority: **P0** = required for the rework to be considered done; **P1** = important; **P2** = nice to have.

### P0: Foundation

**UI-FR-01** The application shall adopt MUI as its component library and Material 3 as its
design system. A single MUI theme is the source of truth for palette, typography, spacing,
shape, and elevation. ADR-010's CSS-Modules-only styling decision is superseded by a new ADR;
remaining CSS Modules are migrated as each screen is reworked.

**UI-FR-02** The MUI theme shall map the existing brand palette onto Material roles:
violet as `primary`, pink as `secondary`/destructive, teal as `success`, amber as `warning`.
Typography follows the Material type scale; spacing follows an 8px grid; elevation and state
layers follow Material 3. The brand identity is preserved, not replaced by default MUI blue.

**UI-FR-03** The UI shall offer a light theme and a dark theme that the user can switch via a
visible control in the app bar. On first load the theme follows the OS `prefers-color-scheme`;
once the user makes a choice it is persisted in `localStorage` and applied on every subsequent
load. The persisted theme must be applied before first paint so there is no flash of the wrong
theme.

**UI-FR-04** The application shell shall provide a responsive Material navigation structure:
a top App Bar plus a navigation drawer that is permanent (or a rail) on desktop and a temporary
overlay drawer on phone. The information architecture is reorganised into clear destinations:
**Albums** (browse/search/filter), **Library** (scan trigger, progress, errors), and
**Settings** (sort preference, language, theme). The theme toggle and language control live in
a consistent, discoverable place (app bar and/or Settings).

### P0: Feature parity migration (incremental)

**UI-FR-05** The album grid shall be rebuilt on MUI: responsive card grid, cover art, search
box, and the filter panel. Large collections must remain performant (virtualised or paginated
rendering); the grid must not regress the master-doc grid-load target.

**UI-FR-06** The album detail view and in-place tag editing shall be rebuilt on MUI, preserving:
album-level and track-level editable fields, the confirm-write dialog, the unsaved-changes
navigation guard, and the "Other tags" read-only section. Editing behaviour and save semantics
are unchanged from the master requirements (FR-06, FR-07, FR-08).

**UI-FR-07** The Discogs sync panel shall be rebuilt on MUI, preserving the sync action, the
"also update cover art" opt-in, the overwrite confirmation, and quota-exhaustion messaging.

**UI-FR-08** The library scan UI (trigger button, progress indicator, per-album error list)
shall be rebuilt using MUI feedback components (buttons, linear/circular progress, alerts,
snackbars), preserving status polling and the dismissible scan banner.

**UI-FR-09** Internationalisation shall be preserved end to end. The existing en/de locales and
the language toggle remain; every new or migrated string is localised; the locale-parity test
must continue to pass. No hard-coded user-facing strings.

**UI-FR-10** Feature parity is mandatory: after each screen migration, all existing
functionality and user flows behave as before. The rework introduces no new product features
(per D3); it changes presentation, theming, navigation, and responsiveness only.

**UI-FR-11** Migration shall be incremental and shippable: the MUI `ThemeProvider`, theme, and
app shell are introduced first; feature areas are then migrated one at a time. A mixed-styling
interim (some screens MUI, some legacy) is acceptable between steps, but any merged screen is
fully migrated, with no half-converted screen merged.

### P0: Routing and navigation behaviour

**UI-FR-17** Navigation shall use `react-router` routes with deep-linkable, bookmarkable URLs
for each destination (at least Albums, album detail, Library, Settings). Browser back/forward
must work, and the unsaved-changes navigation guard (UI-FR-06) must intercept route changes,
back/forward, and external navigation, not just in-component state. No flow may lose the guard
as a side effect of the new routing structure.

**UI-FR-18** A superseding ADR (amending ADR-010's styling decision; retaining its TanStack
Query decision) shall be written and merged **before** MUI is introduced into the main branch.
The ADR records the MUI choice, the styling-engine decision (OQ-01), and the theming/navigation
patterns. This is a deliverable, not an assumption.

### P0: Cross-cutting

**UI-FR-12** The reworked UI shall meet WCAG 2.1 AA: keyboard operability for all interactive
elements, visible focus indicators, sufficient colour contrast in **both** themes, correct
roles/labels (leveraging MUI accessibility), and respect for `prefers-reduced-motion` on Material
transitions.

**UI-FR-13** The UI shall be fully responsive across phone, tablet, and desktop widths using
Material breakpoints: the grid reflows column count, navigation collapses to an overlay drawer on
phone, dialogs adapt, and touch targets are at least 44x44 px. No horizontal scrolling at
supported widths.

### P1

**UI-FR-14** The new MUI foundation shall be the base for not-yet-built UI (e.g. epic #811's
directory-structure settings panel and change-plan preview). Those stories build on this theme
and shell rather than the legacy CSS Modules approach.

**UI-FR-15** Provide a small set of shared MUI-based primitives (page layout, section header,
confirm dialog, empty/loading/error states) so screens are visually consistent and future
screens are quick to build.

### P2

**UI-FR-16** Optional polish: subtle Material motion/transitions on navigation and list updates,
and skeleton loaders for the album grid and detail while data loads.

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| UI-NFR-01 | Performance (bundle) | MUI must be tree-shaken and routes code-split. Initial JS payload budget: <= 250 KB gzipped for the app shell + first route. The budget is enforced by an automated CI check (e.g. `size-limit`/bundle-size gate), not a manual report; a regression over budget fails the build. |
| UI-NFR-09 | Theming (no-flash mechanism) | Because this is a client-rendered SPA, the persisted/OS theme must be resolved by a small blocking inline script in `index.html` that sets the theme before the application bundle executes. No theme-dependent UI renders before that resolution. |
| UI-NFR-10 | Interim style isolation | During incremental migration, MUI (emotion) styles and remaining legacy CSS Modules must not collide. Global CSS resets are introduced via MUI `CssBaseline` only; no un-scoped global selectors are added, so a migrated screen is unaffected by legacy styles and vice versa. |
| UI-NFR-02 | Performance (runtime) | Album grid load and filter/search keep the master-doc targets (grid p95 < 3 s v1; filter/search < 200 ms client-side). Theme toggle applies in < 100 ms with no full reload. |
| UI-NFR-03 | Accessibility | WCAG 2.1 AA in both light and dark themes, verified by automated checks (axe) plus a manual keyboard/screen-reader pass per screen. |
| UI-NFR-04 | Browsers | Latest Firefox and Chromium on desktop Linux, plus mobile Chromium and mobile Safari (iOS) for the responsive phone target. |
| UI-NFR-05 | Theming integrity | No flash of incorrect theme on load; no unthemed legacy components visible on a fully migrated screen; brand palette consistent across both themes. |
| UI-NFR-06 | Maintainability | One MUI theme file is the single source of truth for tokens. No inline style attributes; no ad-hoc colour literals in components. |
| UI-NFR-07 | Quality gates | `npm run build` (TypeScript strict) passes with zero errors; ESLint clean; Vitest line+branch coverage stays >= 80% on changed code; i18n locale-parity test passes. |
| UI-NFR-08 | No backend change | No change to `kbeatz-catalog/api/openapi.yaml` or the generated client. If any limitation forces an API change, it is escalated, not silently introduced. |

---

## 6. Component / Screen Inventory (migration map)

| Current screen / component | Location | Target MUI realisation |
|---|---|---|
| App shell / header / toolbar | `App.tsx`, `App.module.css` | App Bar + responsive navigation drawer/rail + theme/language controls |
| Album grid + cards | `features/albums/album-grid.tsx`, `album-card.tsx` | MUI responsive card grid (virtualised/paginated) |
| Search box | `features/albums/search-box.tsx` | MUI `TextField` with search adornment |
| Filter panel + sort preference | `features/albums/filter-panel.tsx`, `sort-preference.tsx` | MUI drawer/menu controls, chips, selects |
| Album detail + editable fields | `features/albums/album-detail.tsx`, `editable-field.tsx` | MUI detail layout, inline-editable fields |
| Confirm-write + navigation guard dialogs | `features/albums/confirm-write-dialog.tsx`, `navigation-guard-dialog.tsx` | MUI `Dialog` |
| Discogs sync panel | `features/sync/sync-panel.tsx` | MUI panel, checkbox, buttons, snackbars |
| Library scan (button/progress/errors) | `features/library/*` | MUI Button, progress, Alert/List, Snackbar |
| Language toggle | `features/language/language-toggle.tsx` | MUI control in app bar / Settings |
| Dismissible banner, error boundary | `lib/*` | MUI Alert / fallback surfaces |
| Not-found page | `features/not-found/not-found-page.tsx` | MUI empty-state layout |

---

## 7. Domain / Data Model

No domain-model change. This rework touches presentation, theming, navigation, and responsive
layout only. The catalog API contract and the generated TypeScript client are unchanged.

New client-only state introduced:

| Entity | Storage | Notes |
|---|---|---|
| Theme preference | `localStorage` + React context (MUI `ThemeProvider`) | Values: `light`, `dark`, or unset (= follow OS). Global client state, not server state. |

---

## 8. Integrations

- **Catalog API**: unchanged. The reworked UI consumes the same generated client and TanStack
  Query hooks; query keys and invalidation from ADR-010 are retained.
- **i18next (en/de)**: retained; the language detector and locales are reused.

---

## 9. Acceptance Criteria

| ID | Criterion | How to verify |
|---|---|---|
| UI-AC-01 | App renders on MUI with the brand palette mapped to Material roles (primary violet, etc.) | Inspect theme; visual check both themes |
| UI-AC-02 | A theme toggle in the app bar switches light/dark instantly and the choice survives reload | Toggle, reload, confirm persisted theme |
| UI-AC-03 | On a fresh profile, the initial theme matches the OS `prefers-color-scheme` | Set OS to light then dark; load app with cleared storage |
| UI-AC-04 | No flash of the wrong theme on load | Throttle load; observe first paint matches stored/OS theme |
| UI-AC-05 | Navigation provides Albums, Library, and Settings destinations via an App Bar + drawer | Manual nav; drawer permanent on desktop, overlay on phone |
| UI-AC-06 | Every existing flow (browse, search, filter, edit tags, confirm write, nav guard, sync, scan, language switch) works identically post-migration | Run the existing E2E/component suites; manual regression |
| UI-AC-07 | Layout is usable with no horizontal scroll at MUI breakpoints xs/sm/md/lg/xl (phone -> desktop); nav drawer is overlay at xs/sm and permanent at md+ | Resize / device emulation at each MUI breakpoint |
| UI-AC-14 | Each destination has a bookmarkable URL; browser back/forward works; the unsaved-changes guard fires on route change and back/forward | Deep-link each route; edit a field then navigate/back; confirm guard prompt |
| UI-AC-15 | A superseding ADR is merged before MUI appears on main | Check ADR exists and predates the MUI dependency commit |
| UI-AC-08 | Automated axe scan reports no WCAG 2.1 AA violations on each screen in both themes | axe run per screen, light and dark |
| UI-AC-09 | All interactive elements are keyboard-reachable with visible focus | Keyboard-only pass per screen |
| UI-AC-10 | No hard-coded user-facing strings; locale-parity test passes for en/de | `npm run test`; grep for literals; i18next-eslint clean |
| UI-AC-11 | Initial JS payload <= 250 KB gzipped (shell + first route) | Build report / bundle analyzer |
| UI-AC-12 | `npm run build` (strict) passes, ESLint clean, Vitest coverage >= 80% | CI gates |
| UI-AC-13 | At each migration step the app is shippable (builds, no half-migrated screen merged) | Per-PR review + CI |

---

## 10. Assumptions

| ID | Assumption | Impact if wrong |
|---|---|---|
| A-01 | A new ADR supersedes the styling decision in ADR-010 (UI-FR-18); the TanStack Query decision in ADR-010 stays | If ADR-010 must stay intact, MUI adoption is blocked and we revert to "Material aesthetic on CSS Modules" |
| A-07 | The master `docs/requirements.md` (NFR-10 and section 11 mobile-out-of-scope) will be amended to reflect the full-responsive decision (D4), so the two docs do not contradict | If left unamended, two conflicting sources of truth exist for mobile scope |
| A-02 | MUI v6+ (Material 3, emotion-based) is acceptable as a runtime dependency despite ADR-010 having rejected CSS-in-JS | If the emotion runtime is unacceptable, evaluate MUI with a zero-runtime styling engine or Material Web |
| A-03 | No backend/API change is needed for any reworked screen | Any required API change is escalated as a separate requirement |
| A-04 | Existing feature set is frozen during the rework; new features (e.g. #811 UI) layer on top afterwards | Concurrent feature work on legacy components causes rebase/merge churn |
| A-05 | Full phone support is a genuine target now, expanding the master doc's desktop-first scope | If phone is deprioritised, UI-FR-13 / UI-AC-07 relax to tablet |
| A-06 | The 250 KB gzipped initial-payload budget is achievable with MUI tree-shaking + route code-splitting | If unattainable, the budget is renegotiated and recorded |

---

## 11. Out of Scope

- Any change to the catalog backend, database, or OpenAPI contract.
- New product features beyond the current feature set (per D3). Epic #811's features are tracked
  separately and only required to build on this new MUI foundation.
- A big-bang rewrite (explicitly rejected; migration is incremental per D5).
- Replacing TanStack Query or react-router.
- Native mobile apps (responsive web only).

---

## 12. Open Questions

| ID | Question | Default if unanswered |
|---|---|---|
| OQ-01 | MUI styling engine: default emotion runtime, or MUI's zero-runtime (Pigment CSS) to minimise bundle and honour ADR-010's CSS-in-JS concern? | Default to the stable emotion-based MUI; revisit Pigment CSS if UI-NFR-01 budget is missed (decide in the ADR) |
| OQ-02 | Navigation pattern at desktop width: permanent drawer vs compact nav rail | Default to a permanent drawer on desktop, collapsing to an overlay on phone; confirm during shell design |
| OQ-03 | Exact responsive breakpoints and the initial-payload budget value | Default to MUI's standard breakpoints and the 250 KB budget above; tune during implementation |

---

## 13. Top 3 Risks

1. **Bundle size / performance regression.** MUI plus emotion adds significant weight; without
   disciplined tree-shaking and route code-splitting the LAN load time and UI-NFR-01 budget are
   at risk. Mitigation: enforce the build-time bundle budget (UI-AC-11) from the first PR.
2. **ADR-010 supersession and architectural drift.** Adopting MUI reverses an Accepted ADR that
   deliberately rejected component frameworks and CSS-in-JS. Mitigation: write a superseding ADR
   up front (A-01/A-02) so the reversal is documented and intentional, not accidental.
3. **Scope expansion from IA restructure + full responsive.** Reworking navigation and committing
   to phone support enlarges scope well beyond a re-skin and beyond today's desktop-first
   requirements. Mitigation: freeze the feature set (A-04), migrate incrementally (D5), and hold
   the "no new features" boundary (UI-FR-10).

---

*Document generated by RequirementsAgent. Pending product-owner approval and an ArchitectAgent
challenge pass on completeness, testability, and NFR coverage.*
