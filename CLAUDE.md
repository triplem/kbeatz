# Project Instructions for AI Agents

This file provides guidance to Claude Code for all services in this monorepo.
Agent actions are logged to `~/.claude/kbeatz-sessions/<session_id>.jsonl`.

## Project Overview

**kbeatz** is a music collection management platform — a monorepo of:

| Module | Directory | Port | Notes |
|---|---|---|---|
| kbeatz-common | `kbeatz-common/` | — | Shared library: domain exceptions |
| kbeatz-sources | `kbeatz-sources/` | — | Metadata library: `MetadataSource`/`MetadataCache` ports; `discogs/` + future `musicbrainz/` impls |
| kbeatz-tagger | `kbeatz-tagger/` | — | FLAC codec (`codec/flac/`) + `TaggerService` + id-file parser; library consumed by catalog and CLI |
| kbeatz-cli | `kbeatz-cli/` | CLI | Fat JAR CLI: `tag` and `migrate-ids` commands (Clikt entry point only) |
| kbeatz-catalog | `kbeatz-catalog/` | 8080 | Music collection catalog — browse albums, edit tags, Discogs sync |
| kbeatz-ui | `kbeatz-ui/` | 3005 | React SPA |

## Common Tech Stack

- **Backend**: Kotlin + Ktor, Gradle Kotlin DSL
- **Frontend**: React 19 + TypeScript + Vite
- **API Contract**: OpenAPI spec at `kbeatz-catalog/api/openapi.yaml` — single source of truth (catalog only; `kbeatz-sources` and `kbeatz-tagger` are libraries, not HTTP services)
- **Persistence**: H2 + Exposed ORM + Liquibase migrations (v1); PostgreSQL is the v2 migration target (see ADR-006)
- **Tooling**: Detekt, Kover (≥ 80% coverage), CycloneDX SBOM, AsciiDoc docs

## Commands

### Full Monorepo Build
```bash
./gradlew build              # All backends + kbeatz-ui frontend
./gradlew check              # Build + tests + Detekt + Kover
./gradlew buildBackends      # Gradle only (no frontend)
./gradlew buildFrontend      # npm build only
./gradlew build --no-parallel  # Sequential (saves RAM on ≤ 8 GB machines)
```

### Backend (per service)
```bash
./gradlew test               # Unit tests
./gradlew integrationTest    # Integration tests
./gradlew e2eTest            # E2E tests
./gradlew check              # All tests + Detekt + Kover
./gradlew detektMain         # Linter only
./gradlew koverReport        # Coverage report
./gradlew asciidoctor        # Build AsciiDoc docs
```

### Frontend
```bash
cd kbeatz-ui
npm install
npm run api:generate         # Regenerate TypeScript clients from openapi.yaml specs
npm run dev                  # Dev server (http://localhost:3005)
npm run build                # TS compile + Vite build
npm run lint                 # ESLint
npm run test                 # Vitest
npm run test:coverage        # Vitest with coverage
```

## Architecture

### API-First Design
`api/openapi.yaml` is the contract between frontend and backend.
- **Backend**: `openApiGenerate` Gradle task → Ktor server stubs in `build/generated/api/`
- **Frontend**: `npm run api:generate` → TypeScript/Axios client in `src/api/generated/`

Always update the spec before writing handlers.

### Hexagonal Architecture (Ports and Adapters)

Applies to `kbeatz-catalog` (the Ktor HTTP service). Libraries (`kbeatz-sources`,
`kbeatz-tagger`) use a flat package structure appropriate to their scope.

```
adapters/inbound/web/       # HTTP: Ktor route handlers + mapper (API ↔ domain)
application/service/        # Business logic
domain/model/               # Pure domain model
domain/repository/          # Port interfaces
domain/exception/           # Domain exceptions
infrastructure/persistence/ # Exposed ORM + H2 adapter (v1)
plugins/                    # Ktor plugin config (StatusPages, Logging)
```

### Domain Conventions
- Use `kotlin.uuid.Uuid` and `kotlinx.datetime.Instant`/`LocalDate` in domain code.
- No `java.time.*` or `java.util.UUID` in `domain/` or `application/`.
- No authentication in v1 (trusted LAN). Keycloak JWT/OIDC is the v2 target (see NFR-07).

## Module Details

### kbeatz-common

- Root package: `org.javafreedom.kbeatz.common`
- Purpose: shared domain exceptions consumed by all other modules
- Key files: `kbeatz-common/src/main/kotlin/org/javafreedom/kbeatz/common/`

### kbeatz-sources

- Root package: `org.javafreedom.kbeatz.sources`
- Purpose: metadata library implementing `MetadataSource` and `MetadataCache` ports; `discogs/` adapter; `cache/` adapter
- Key behaviours:
  - Discogs rate limiting: 1 request/second enforced in the Discogs adapter
  - Image download quota tracked in the `data/` directory (configured via `DATA_DIR` env var)

### kbeatz-tagger

- Root package: `org.javafreedom.kbeatz.tagger`
- Purpose: FLAC codec and `TaggerService`; id-file parser
- Sub-packages:
  - `codec/flac/` - FLAC binary reader/writer (RFC 9639 StreamInfo, VorbisComment blocks)
  - `idfile/` - id.txt / local_ids.txt / metadata.yml format parser
  - `service/` - `TaggerService` orchestrating codec + id-file reads/writes

### kbeatz-catalog

- Root package: `org.javafreedom.kbeatz.catalog`
- Package structure (hexagonal):
  ```
  adapters/inbound/web/        HTTP route handlers + mappers (API <-> domain)
  application/service/         Business logic services
  domain/model/                Pure domain objects
  domain/repository/           Port interfaces
  infrastructure/persistence/  Exposed ORM + H2 (AlbumsTable, ExposedAlbumRepository)
  plugins/                     Ktor plugins (StatusPages, TraceId, Routing, Serialization)
  ```
- H2 schema via Liquibase: `kbeatz-catalog/src/main/resources/db/changelog/`
- Key env vars:
  - `CATALOG_LIBRARY_ROOT` (required) - absolute path to the music library root directory
  - `DATA_DIR` (default: `./data`) - directory for image download quota tracking
  - `CATALOG_JDBC_URL` (default: in-memory H2) - JDBC connection string
  - `DISCOGS_TOKEN` (optional) - Discogs API token; Discogs sync is unavailable without it

### kbeatz-cli

- Root package: `org.javafreedom.kbeatz.cli`
- Purpose: fat-JAR CLI; Clikt entry point for two commands
- Sub-packages:
  - `command/` - `tag` (write FLAC tags from id-file) and `migrate-ids` (convert id-file formats)
  - `util/` - CLI utility helpers

### kbeatz-ui

- Root: `kbeatz-ui/src/`
- Key feature directories:
  - `src/features/albums/` - album grid, album detail, editable tag fields, confirm dialog
  - `src/features/library/` - library scan trigger and status
  - `src/features/sync/` - Discogs sync workflow
- API client: `src/api/generated/` - auto-generated from `kbeatz-catalog/api/openapi.yaml`; do not edit manually (regenerate with `npm run api:generate`)
- State management: React hooks and local component state only; no Redux or global state library

## Language Server Setup (LSP)

LSP integration is configured via the Claude Code plugin system. The `enabledPlugins` block in
`.claude/settings.json` enables the Kotlin and TypeScript language servers project-wide (all
collaborators who trust the project folder get them automatically).

```json
"enabledPlugins": {
  "kotlin-lsp@claude-plugins-official": true,
  "typescript-lsp@claude-plugins-official": true
}
```

Once active, Claude gains:
- **Automatic diagnostics**: type errors and missing imports reported after every edit, without
  running a compiler manually
- **Code navigation**: go-to-definition, find references, call hierarchy

### Required binaries

Both plugins require the language server binary to be on `$PATH`:

| Language | Plugin | Binary | Installation |
|---|---|---|---|
| Kotlin | `kotlin-lsp` | `kotlin-language-server` | `pacman -S kotlin-language-server` (Arch); or download from [github.com/fwcd/kotlin-language-server/releases](https://github.com/fwcd/kotlin-language-server/releases) |
| TypeScript | `typescript-lsp` | `typescript-language-server` | `npm install -g typescript-language-server typescript --prefix ~/.local` |

### After changing plugin config

Run `/reload-plugins` inside Claude Code to activate changes without restarting.

If a plugin fails to load, check the `/plugin` Errors tab. The most common cause is the binary
not being found in `$PATH`.

## Audit Logging

Agent actions are written to `~/.claude/kbeatz-sessions/<session_id>.jsonl` via a PostToolUse hook.

### Log format

One JSON object per line:

| Field | Type | Description |
|---|---|---|
| `ts` | ISO 8601 UTC | Timestamp of the action |
| `agent` | string | `"Claude"` for agent actions, `"System"` for hook-generated entries |
| `session_id` | string | Claude Code session identifier |
| `action` | string | `bash`, `write`, `edit`, `session_start`, `session_stop` |
| `detail` | string | Command or file path |

Additional fields on `session_stop`: `branch` (current git branch), `actions_this_session` (count).

### What is logged

- Bash commands (except read-only commands: `cat`, `grep`, `find`, `ls`, and similar)
- `Write` and `Edit` tool operations
- Session start and stop events

### What is NOT logged

- Read-only shell commands (`cat`, `grep`, `find`, `ls`)
- File reads via the Read tool
- Hook metadata entries

### Sample entries

```json
{"ts":"2026-06-07T10:00:00Z","agent":"Claude","session_id":"abc123","action":"bash","detail":"git commit -m 'fix(catalog): #201 ...'"}
{"ts":"2026-06-07T10:05:00Z","agent":"System","session_id":"abc123","action":"session_stop","branch":"main","actions_this_session":12}
```

### Useful queries

```bash
# All git commits made by agents in the last session
grep '"action":"bash"' ~/.claude/kbeatz-sessions/*.jsonl | grep "git commit"

# Session summary (actions per session)
grep '"action":"session_stop"' ~/.claude/kbeatz-sessions/*.jsonl
```

### Retention

90 days, configured via `cleanupPeriodDays: 90` in `.claude/settings.json`.

## Issue Tracking

```bash
gh issue list
gh issue view <number>
gh issue create --title "..." --body "..."
gh pr create
```


## Branch Naming

```
<type>/<issue-number>-<short-description>
```
Types: `feature`, `fix`, `bug`, `chore`, `docs`, `refactor`

## Commit Conventions

```
<type>(<scope>): <issue-number> <summary>
```
See `.claude/rules/commit-conventions.md` for the full list of types.

## Quality Gates (mandatory before any PR)

- [ ] All tests pass
- [ ] Unit test coverage ≥ 80% (`./gradlew koverVerify`)
- [ ] Detekt passes (`./gradlew detektMain`)
- [ ] OpenAPI spec valid (if changed)
- [ ] `npm run build` passes (TypeScript strict mode)
- [ ] No untracked TODO/FIXME in changed files

## Rules Index

All rules live in `.claude/rules/` and are automatically applied.

- `commit-conventions.md` — Conventional Commits
- `branching-strategy.md` — Branch naming & merge strategy
- `quality-gates.md` — Mandatory checks before PR
- `test-pyramid.md` — Unit / Integration / E2E ratios
- `solid-principles.md` — SOLID + Clean Code
- `api-design.md` — OpenAPI / REST best practices
- `security.md` — SAST, OWASP, secret hygiene
- `kotlin-style.md` — Kotlin idioms, Detekt, Gradle
- `typescript-style.md` — TypeScript strict mode, ESLint
- `logging.md` — Structured logging
- `openapi.md` — OpenAPI spec discipline
- `agent-context.md` — CLAUDE.md convention, hook patterns
- `github-issue-management.md` — Sub-issues, epic body structure
- `writing-style.md` — No em-dashes; plain ASCII punctuation in all artifacts

## Skills Index

Invoke with `/skill-name`. All skills live in `.claude/skills/`.

### SDLC Workflow
- `/gather-requirements` — elicit and document requirements
- `/write-epics` — decompose requirements into epics
- `/write-stories` — decompose epic into user stories
- `/implement` — implement a story on a feature branch
- `/implement-epic` — implement all stories under an epic in dependency order
- `/write-tests` — write tests for an implementation
- `/create-pr` — open a guided PR with post-merge cleanup
- `/pr-reviewer` — review a PR; auto-posts findings and fixes them
- `/release` — tag, changelog, GitHub release
- `/create-adr` — document an architecture decision

### Code Patterns
- `/typescript-patterns` — TS strict patterns
- `/react-patterns` — hooks, context, component design
- `/openapi-patterns` — spec-first API design
- `/logging-kotlin` — structured logging with kotlin-logging
- `/logging-typescript` — structured logging with pino/winston

### Specialist Reviews
- `/security-review` — OWASP Top 10, auth, secrets
- `/qa-review` — test coverage, acceptance criteria
- `/architect-review` — hexagonal layers, SOLID, coupling
- `/devops-review` — container hygiene, CI/CD
- `/ux-review` — WCAG AA, ease of use
- `/performance-review` — query efficiency, bundle size
- `/operations-review` — observability, graceful degradation
- `/technical-writer-review` — documentation clarity
- `/requirements-review` — completeness, testability
- `/challenge-all` — all 9 specialist perspectives at once

### Meta
- `/learn` — extract a reusable rule from a completed story
- `/domain-model` — build/update the project domain model
- `/claude-code-expert` — audit and improve CLAUDE.md, hooks, skills, MCP config
