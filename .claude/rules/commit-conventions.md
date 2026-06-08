# Rule: Commit Conventions

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/) with the Angular preset.

## Format

```
<type>(<scope>): <short summary>

[optional body - wrap at 72 chars]

[optional footer: BREAKING CHANGE: ..., Closes #N, Refs #N]
```

## Types

| Type | When | Triggers release |
|---|---|---|
| `feat` | New feature | minor |
| `fix` | Bug fix | patch |
| `perf` | Performance improvement | patch |
| `refactor` | Code change (no feature/fix) | none |
| `test` | Tests only | none |
| `docs` | Documentation only | none |
| `style` | Formatting, whitespace | none |
| `build` | Build system, dependencies | none |
| `ci` | CI/CD configuration | none |
| `chore` | Other (release scripts, etc.) | none |
| `revert` | Revert a prior commit | patch |

Breaking change: append `!` to type or add `BREAKING CHANGE:` in footer → major bump.

## Scope

The scope is the module or domain area affected. Use one of the following:

| Scope | Covers |
|---|---|
| `catalog` | kbeatz-catalog service (API handlers, scan, browse) |
| `sources` | kbeatz-sources library (MetadataSource, MetadataCache, Discogs impl) |
| `tagger` | kbeatz-tagger codec sub-package (FLAC reader/writer, future MP3) |
| `cli` | kbeatz-cli module (Clikt entry point, tag and migrate-ids commands) |
| `ui` | kbeatz-ui React SPA |
| `common` | kbeatz-common shared library |
| `discogs` | Discogs-specific logic inside kbeatz-sources |
| `idfile` | id.txt / local_ids.txt / metadata.yml parsing and migration |
| `library` | Library scan, album indexing |
| `api` | OpenAPI spec (kbeatz-catalog/api/openapi.yaml) |
| `db` | H2 schema, Liquibase migrations |
| `config` | Application configuration, environment variables |
| `ci` | CI/CD pipeline |
| `scaffold` | Project-wide structure, build-logic, root config |

Use the same scope consistently for a feature area. Check existing commits for precedent.

## Summary Rules

- Imperative mood: "add", "fix", "update" (not "added", "fixes", "updating")
- No period at the end
- Max 72 characters total (type + scope + summary)
- Lowercase first letter
- Include the issue number when one exists: `feat(catalog): #42 add album grid endpoint`

## Examples

```
feat(catalog): #12 add album listing endpoint with pagination

fix(tagger): #34 handle little-endian Vorbis Comment length correctly

refactor(tagger): #56 extract TaggerService from CLI entry point

test(sources): add unit tests for DiscogsMetadataSource rate limiting

docs(api): document cover art resolution order

feat(tagger)!: #88 change FlacFile API to streaming writes

BREAKING CHANGE: FlacWriter.write() now takes a Path instead of ByteArray.
Closes #88
```

## Squash Rebase Policy

When rebasing a PR onto main, squash all commits. The squash commit message must be the story-level conventional commit:

```
feat(scope): story title (#story-id)
```

Individual commits during development may be informal, but the squash message must be clean.

## Tooling

```bash
# Validate locally before push
npx commitlint --from HEAD~1 --to HEAD

# Interactive commit helper
npx git-cz
```

Add `commitlint` as a commit-msg hook in `.husky/commit-msg`.
