# Project Instructions for AI Agents

This file provides guidance to Claude Code for all services in this monorepo.
Agent actions are logged to `~/.claude/kbeatz-sessions/<session_id>.jsonl`.

## Project Overview

**kbeatz** is a music collection management platform — a monorepo of:

| Module | Directory | Port | Notes |
|---|---|---|---|
| kbeatz-common | `kbeatz-common/` | — | Shared library: domain exceptions, Ktor plugins |
| kbeatz-filecodec | `kbeatz-filecodec/` | — | Audio codec library: FLAC reader/writer (RFC 9639); extensible to MP3/AAC via sub-packages |
| kbeatz-sources | `kbeatz-sources/` | — | Metadata library: `MetadataSource`/`MetadataCache` ports; `discogs/` + future `musicbrainz/` impls |
| kbeatz-tagger | `kbeatz-tagger/` | CLI | Tagging engine (`service/`) + CLI entry point (`cli/`); used by kbeatz-catalog and fat-JAR CLI |
| kbeatz-catalog | `kbeatz-catalog/` | 8080 | Music collection catalog — browse albums, tracks, FLAC metadata |
| kbeatz-ui | `kbeatz-ui/` | 3005 | React SPA |

## Common Tech Stack

- **Backend**: Kotlin + Ktor, Gradle Kotlin DSL
- **Frontend**: React 19 + TypeScript + Vite
- **API Contract**: OpenAPI spec at `kbeatz-catalog/api/openapi.yaml` — single source of truth (catalog only; `kbeatz-sources` and `kbeatz-tagger` are libraries, not HTTP services)
- **Persistence**: SQLite + Exposed ORM + Liquibase migrations (v1); PostgreSQL is the v2 migration target
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

Applies to `kbeatz-catalog` (the Ktor HTTP service). Libraries (`kbeatz-filecodec`, `kbeatz-sources`,
`kbeatz-tagger`) use a flat package structure appropriate to their scope.

```
adapters/inbound/web/       # HTTP: Ktor route handlers + mapper (API ↔ domain)
application/service/        # Business logic
domain/model/               # Pure domain model
domain/repository/          # Port interfaces
domain/exception/           # Domain exceptions
infrastructure/persistence/ # Exposed ORM + SQLite adapter (v1)
plugins/                    # Ktor plugin config (StatusPages, Logging)
```

### Domain Conventions
- Use `kotlin.uuid.Uuid` and `kotlinx.datetime.Instant`/`LocalDate` in domain code.
- No `java.time.*` or `java.util.UUID` in `domain/` or `application/`.
- No authentication in v1 (trusted LAN). Keycloak JWT/OIDC is the v2 target (see NFR-07).

## Issue Tracking

```bash
gh issue list
gh issue view <number>
gh issue create --title "..." --body "..."
gh pr create
```

> Update `<OWNER>` and `<REPO>` placeholders in `.claude/skills/create-pr/SKILL.md`
> and `.claude/skills/implement-epic/SKILL.md` to match your GitHub repository.

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
- `/kotlin-patterns` — Kotlin idioms, coroutines
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
