# Contributing to kbeatz

Thank you for your interest in contributing. This guide covers everything you need to make a
correct pull request: environment setup, project structure, running locally, testing, conventions,
and the review process.

For the full initial setup including Docker Compose and production configuration, see
[docs/getting-started.adoc](docs/getting-started.adoc).

## Table of contents

- [Development environment](#development-environment)
- [Project structure](#project-structure)
- [Running locally](#running-locally)
- [Running tests](#running-tests)
- [Branch naming](#branch-naming)
- [Commit conventions](#commit-conventions)
- [Quality gates](#quality-gates)
- [Opening a PR](#opening-a-pr)
- [Code review process](#code-review-process)
- [Architecture notes](#architecture-notes)

---

## Development environment

### Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| JDK | 21 | `JAVA_HOME` must be set. Temurin builds recommended. |
| Node.js | 22 | Required for the React frontend only. |
| Git | any recent | - |

The Gradle wrapper (`./gradlew`) is included. You do not need a separate Gradle installation.

### Recommended IDE

IntelliJ IDEA (Community or Ultimate) with the Kotlin plugin. The project ships with `.idea/`
config for run configurations and code style.

### Clone and set up

```bash
git clone https://github.com/triplem/kbeatz.git
cd kbeatz

# Install frontend dependencies
cd kbeatz-ui && npm install && cd ..

# Verify the build works before making changes
./gradlew buildBackends
cd kbeatz-ui && npm run build && cd ..
```

---

## Project structure

| Module | Directory | What it does |
|---|---|---|
| kbeatz-common | `kbeatz-common/` | Shared domain exceptions consumed by all other modules. Touch this only for cross-cutting domain errors. |
| kbeatz-sources | `kbeatz-sources/` | Metadata library: `MetadataSource` and `MetadataCache` ports, Discogs adapter, image download quota tracking. Touch this for Discogs or MusicBrainz changes. |
| kbeatz-tagger | `kbeatz-tagger/` | FLAC binary codec (reads/writes Vorbis Comment blocks), `TaggerService`, and id-file parser. Touch this for codec or tag format changes. |
| kbeatz-cli | `kbeatz-cli/` | Fat JAR CLI with two commands: `tag` (write FLAC tags from an id-file) and `migrate-ids` (convert id-file formats). Touch this for CLI behaviour changes. |
| kbeatz-catalog | `kbeatz-catalog/` | Ktor HTTP service on port 8080: browse albums, edit tags, trigger Discogs sync. Touch this for API or catalog feature changes. |
| kbeatz-ui | `kbeatz-ui/` | React SPA on port 3005. Touch this for UI changes. |

### Where to make changes

- **New API endpoint:** update `kbeatz-catalog/api/openapi.yaml` first, then add the handler in `kbeatz-catalog/`
- **New UI feature:** work in `kbeatz-ui/src/features/`; run `npm run api:generate` if the API changed
- **FLAC tag reading/writing:** work in `kbeatz-tagger/`
- **Discogs metadata:** work in `kbeatz-sources/`
- **CLI command:** work in `kbeatz-cli/`

---

## Running locally

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `CATALOG_LIBRARY_ROOT` | **Yes** | Absolute path to the root of your FLAC music library. The catalog service will not start without this. |
| `DISCOGS_TOKEN` | No | Discogs API token. Without it the service starts normally, but Discogs sync and metadata lookups are unavailable. |
| `DATA_DIR` | No | Directory for image download quota tracking. Defaults to `./data`. |
| `CATALOG_JDBC_URL` | No | JDBC connection string. Defaults to an in-memory H2 database. |

### Start the catalog service

```bash
export CATALOG_LIBRARY_ROOT=/path/to/your/music/library
export DISCOGS_TOKEN=your_token_here   # optional

cd kbeatz-catalog && ./gradlew run
# Service starts at http://localhost:8080
# API docs: http://localhost:8080/api/v1/health
```

### Start the UI

In a separate terminal:

```bash
cd kbeatz-ui
npm run dev
# Open http://localhost:3005
```

### Run the CLI

The CLI is a fat JAR. Build it first, then run it:

```bash
./gradlew :kbeatz-cli:shadowJar
java -jar kbeatz-cli/build/libs/kbeatz-cli-all.jar --help
java -jar kbeatz-cli/build/libs/kbeatz-cli-all.jar tag --help
java -jar kbeatz-cli/build/libs/kbeatz-cli-all.jar migrate-ids --help
```

---

## Running tests

### Unit tests

```bash
# All modules
./gradlew test

# Single module
cd kbeatz-catalog && ./gradlew test
```

### Integration tests

```bash
export CATALOG_LIBRARY_ROOT=/tmp/kbeatz-test-library

./gradlew integrationTest
# Or per module:
cd kbeatz-catalog && ./gradlew integrationTest
```

### E2E tests

```bash
export CATALOG_LIBRARY_ROOT=/tmp/kbeatz-test-library

cd kbeatz-catalog && ./gradlew e2eTest
```

E2E tests use Ktor's `testApplication {}` in-process engine - no real server is started.

### Frontend tests

```bash
cd kbeatz-ui
npm run test           # Vitest unit tests
npm run test:coverage  # Vitest with coverage report
```

### All quality gates at once

```bash
./gradlew check        # backend: tests + Detekt + Kover coverage
cd kbeatz-ui && npm run build && npm run lint && npm run test
```

---

## Branch naming

```
<type>/<issue-number>-<short-description>
```

`type` must be one of: `feature`, `fix`, `bug`, `chore`, `docs`, `refactor`

Examples:

```
feature/42-discogs-sync-ui
fix/101-flac-little-endian-length
docs/12-operations-guide
refactor/88-extract-domain-events
```

Create a branch using the project script, which validates the type, pulls `main`, and checks
out in one step:

```bash
./.claude/scripts/create-branch.sh <type> <issue-number> <short-description>
# Example:
./.claude/scripts/create-branch.sh feature 42 discogs-sync-ui
```

Never commit directly to `main`.

---

## Commit conventions

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <issue-number> <summary>
```

### Types

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `refactor` | Code change with no feature or fix |
| `test` | Tests only |
| `docs` | Documentation only |
| `style` | Formatting, whitespace |
| `build` | Build system, dependencies |
| `ci` | CI/CD configuration |
| `chore` | Other housekeeping |
| `revert` | Revert a prior commit |

### Scopes

Use the scope that matches the area you changed:

| Scope | Area |
|---|---|
| `catalog` | kbeatz-catalog service |
| `sources` | kbeatz-sources library |
| `tagger` | kbeatz-tagger codec |
| `cli` | kbeatz-cli module |
| `ui` | kbeatz-ui React SPA |
| `common` | kbeatz-common shared library |
| `discogs` | Discogs-specific logic |
| `idfile` | id.txt / metadata.yml parsing |
| `library` | Library scan and album indexing |
| `api` | OpenAPI spec |
| `db` | H2 schema, Liquibase migrations |
| `config` | Application configuration |
| `ci` | CI/CD pipeline |
| `scaffold` | Project-wide structure, root config |

### Rules

- Use imperative mood: "add", "fix", "update" (not "added", "fixes")
- No period at the end of the summary
- Max 72 characters for type + scope + summary combined
- Lowercase first letter of summary
- Include the issue number: `feat(catalog): #42 add album grid endpoint`

### Examples

```
feat(catalog): #12 add album listing endpoint with pagination
fix(tagger): #34 handle little-endian Vorbis Comment length
docs(api): document cover art resolution order
test(sources): add unit tests for Discogs rate limiting
```

---

## Quality gates

All of the following must pass before you open a PR. CI enforces the same checks and the PR
cannot be merged until they are all green.

### 1. All tests pass

```bash
./gradlew test
cd kbeatz-ui && npm run test
```

### 2. Unit test coverage >= 80%

```bash
./gradlew koverVerify   # fails if backend line coverage drops below 80%
cd kbeatz-ui && npm run test:coverage
```

### 3. Detekt passes (Kotlin linter)

```bash
# Run per module - composite build does not support a single root detektMain task
./gradlew :kbeatz-catalog:detektMain :kbeatz-cli:detektMain :kbeatz-common:detektMain \
          :kbeatz-sources:detektMain :kbeatz-tagger:detektMain
```

Or run `./gradlew check` which covers all of the above.

### 4. TypeScript strict build passes

```bash
cd kbeatz-ui && npm run build
```

`tsconfig.json` enables `noUnusedLocals` and `noUnusedParameters`. Unused imports and type
aliases are compiler errors.

### 5. Lockfile regeneration after dependency changes

After any change to `libs.versions.toml`, regenerate the Gradle lockfile for each affected
module and commit the updated `gradle.lockfile`:

```bash
./gradlew --project-dir <module> dependencies --write-locks
# Example: after changing a dependency used by kbeatz-catalog
./gradlew --project-dir kbeatz-catalog dependencies --write-locks
```

Trivy scans lockfiles in CI to detect JVM CVEs. A stale lockfile causes false positives
or misses real vulnerabilities.

### 6. No new TODOs without issue references

Every TODO or FIXME must link to an open issue:

```kotlin
// TODO(#42): extract to MetadataService
```

---

## Opening a PR

### Before you push

1. Rebase your branch on `main`: `git rebase main`
2. Run all quality gates (see above)
3. Push: `git push -u origin <branch>`

### PR description

A good PR description includes:

- A summary of what changed and why (2-3 bullet points)
- A test plan: what to run or check to verify the change
- `Closes #<issue-number>`

Example:

```markdown
## Summary

- Adds `GET /api/v1/albums` endpoint with pagination support
- Wires `AlbumService` to the new `AlbumRepository` port
- Updates OpenAPI spec and regenerates TypeScript client

## Test plan

- [ ] `./gradlew :kbeatz-catalog:check` passes
- [ ] `cd kbeatz-ui && npm run build` passes after `npm run api:generate`
- [ ] Album grid loads at http://localhost:3005

Closes #42
```

### PR title

Match the squash commit message format:

```
feat(catalog): #42 add album listing endpoint with pagination
```

---

## Code review process

Reviews typically happen within 1-2 business days. The reviewer uses four severity levels:

| Level | Meaning | Required action |
|---|---|---|
| **BLOCKER** | Incorrect behaviour, broken command, missing required AC, security issue | Must fix before merge |
| **MAJOR** | Missing important section, inaccurate technical detail, logic error | Must fix before merge |
| **MINOR** | Style, missing optional detail, suboptimal approach | Fix if quick; can defer to a follow-up |
| **NIT** | Wording, whitespace, trivial preference | Fix only if trivial |

If you receive a BLOCKER or MAJOR finding: push a fix commit, then reply on the comment to let
the reviewer know it has been addressed.

CI must be green before any PR is merged. This includes the Trivy security scan, Detekt, Kover
coverage, and all test suites.

---

## Architecture notes

### Hexagonal architecture in kbeatz-catalog

`kbeatz-catalog` uses hexagonal (ports and adapters) architecture. Each layer has a strict
dependency direction:

```
adapters/inbound/web/       - HTTP route handlers and mappers (API <-> domain)
application/service/        - Business logic
domain/model/               - Pure domain objects (no framework dependencies)
domain/repository/          - Port interfaces
domain/exception/           - Domain exceptions
infrastructure/persistence/ - Exposed ORM + H2 adapter
plugins/                    - Ktor plugin configuration
```

When adding a feature:
1. Define the domain model change
2. Add or update the port interface in `domain/repository/`
3. Add business logic in `application/service/`
4. Implement the persistence adapter in `infrastructure/persistence/`
5. Add the HTTP handler in `adapters/inbound/web/`

### Domain conventions

- Use `kotlin.uuid.Uuid` and `kotlinx.datetime.Instant`/`LocalDate` in domain code
- Do not use `java.time.*` or `java.util.UUID` in `domain/` or `application/`
- Domain objects are plain Kotlin data classes with no framework annotations

### OpenAPI-first design

`kbeatz-catalog/api/openapi.yaml` is the source of truth for the catalog API. Always update
the spec before writing handler code. Server stubs are generated automatically by the Gradle
build; do not edit generated files in `build/generated/`.

The frontend TypeScript client is generated from the same spec. After changing the spec, run:

```bash
cd kbeatz-ui && npm run api:generate
```

### Library modules (kbeatz-tagger, kbeatz-sources)

These are plain libraries, not HTTP services. They use a flat package structure rather than
hexagonal layers. There is no OpenAPI spec for them.
