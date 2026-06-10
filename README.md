# kbeatz

[![CI](https://github.com/triplem/kbeatz/actions/workflows/ci.yml/badge.svg)](https://github.com/triplem/kbeatz/actions/workflows/ci.yml)
[![Documentation](https://img.shields.io/badge/docs-github%20pages-blue)](https://triplem.github.io/kbeatz/)

kbeatz is a self-hosted music collection management platform for FLAC libraries. It reads and writes
FLAC metadata (Vorbis Comment tags), fetches release information from Discogs, and exposes a web UI
for browsing and editing your album collection. It is built for developers and audio enthusiasts who
want full control over their local library without relying on third-party desktop apps.

## Architecture

| Module | Directory | Port | Purpose |
|---|---|---|---|
| kbeatz-common | `kbeatz-common/` | - | Shared library: domain exceptions |
| kbeatz-sources | `kbeatz-sources/` | - | Metadata library: Discogs adapter (v1), MusicBrainz adapter (planned), MetadataSource/MetadataCache ports |
| kbeatz-tagger | `kbeatz-tagger/` | - | FLAC codec, TaggerService, and id-file parser |
| kbeatz-cli | `kbeatz-cli/` | CLI | Fat JAR CLI: `tag` and `migrate-ids` commands |
| kbeatz-catalog | `kbeatz-catalog/` | 8080 | Ktor HTTP service: browse albums, edit tags, Discogs sync |
| kbeatz-ui | `kbeatz-ui/` | 3005 | React SPA |

## Tech stack

- **Backend:** Kotlin 2.x + Ktor 3.x, Gradle 9 (Kotlin DSL, composite builds)
- **Frontend:** React 19 + TypeScript + Vite
- **Persistence:** H2 + Exposed ORM + Liquibase migrations (PostgreSQL is the v2 target)
- **API contract:** OpenAPI 3.1 spec at `kbeatz-catalog/api/openapi.yaml`

## Prerequisites

- JDK 21 or later (`JAVA_HOME` set)
- Node.js 22 or later (for the UI)
- The Gradle wrapper is included; no separate Gradle installation is needed

## Quick start

```bash
# 1. Clone the repository
git clone https://github.com/triplem/kbeatz.git
cd kbeatz

# 2. Set required environment variables
export CATALOG_LIBRARY_ROOT=/path/to/your/music/library
# CATALOG_LIBRARY_ROOT must point to the root of your FLAC collection.
# The catalog service will not start without this.

export DISCOGS_TOKEN=your_token_here
# DISCOGS_TOKEN is optional. Without it the service starts normally,
# but Discogs sync and metadata lookups are unavailable.

# 3. Build everything (backend + frontend)
./gradlew build

# 4. Run the catalog service
cd kbeatz-catalog && ./gradlew run
# API available at http://localhost:8080/api/v1

# 5. Open the UI (in a separate terminal, from the repo root)
cd kbeatz-ui
npm install
npm run dev
# UI available at http://localhost:3005
```

For the quickest start using Docker Compose, and for full container and production setup,
see [docs/getting-started.adoc](docs/getting-started.adoc).

## Commands reference

### Build and verify

```bash
# Build all modules (backend + frontend)
./gradlew build

# Run all quality gates: tests, Detekt, Kover coverage check
./gradlew check

# Build backends only (skip frontend)
./gradlew buildBackends

# Sequential build (saves RAM on machines with 8 GB or less)
./gradlew build --no-parallel
```

### Frontend

```bash
cd kbeatz-ui
npm run dev          # Start dev server at http://localhost:3005
npm run build        # TypeScript strict compile + Vite bundle
npm run lint         # ESLint
npm run test         # Vitest unit tests
npm run api:generate # Regenerate TypeScript client from openapi.yaml
```

### Dependency lockfile maintenance

After changing any dependency in `libs.versions.toml`, regenerate the lockfile for each affected
module and commit the updated `gradle.lockfile`:

```bash
./gradlew --project-dir <module> dependencies --write-locks
# Example: after a change that affects kbeatz-catalog
./gradlew --project-dir kbeatz-catalog dependencies --write-locks
```

Trivy scans the lockfiles in CI to detect JVM CVEs. Stale lockfiles will cause false positives
or miss real vulnerabilities.

## Documentation

- [Getting started](docs/getting-started.adoc) - full setup, Docker Compose, environment variables
- [Operations guide](kbeatz-catalog/docs/operations-guide.adoc) - running kbeatz-catalog in production
- [Architecture decision records](docs/adr/) - design decisions and their rationale

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, commit conventions, quality gates, and
the PR process.

## License

MIT - see [LICENSE](LICENSE).
