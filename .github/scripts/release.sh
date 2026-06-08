#!/usr/bin/env bash
# release.sh - Monorepo release script using Angular semver conventions
#
# Determines the version bump from conventional commits since the last tag,
# updates all build.gradle.kts files, commits the change, creates a tag, and
# opens a GitHub release with a grouped changelog.
#
# Bump rules (highest impact wins):
#   BREAKING CHANGE footer or ! suffix -> major
#   feat                               -> minor
#   fix, perf                          -> patch
#   chore, docs, test, style, ci       -> no release
#
# Usage: .github/scripts/release.sh
# Requires: git, gh (GitHub CLI), sed, bash 4+

set -euo pipefail

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log() { echo "[release] $*"; }

die() { echo "[release] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Determine commit range
# ---------------------------------------------------------------------------

LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || true)

if [[ -z "$LAST_TAG" ]]; then
    log "No previous tag found - collecting all commits for first release"
    COMMIT_RANGE="HEAD"
    RANGE_ARGS=""
else
    log "Last tag: $LAST_TAG"
    COMMIT_RANGE="${LAST_TAG}..HEAD"
    RANGE_ARGS="${LAST_TAG}..HEAD"
fi

# ---------------------------------------------------------------------------
# Collect commits since last tag (or all commits for first release)
# ---------------------------------------------------------------------------

if [[ -z "$RANGE_ARGS" ]]; then
    COMMITS=$(git log --format="%H %s" HEAD 2>/dev/null || true)
else
    COMMITS=$(git log --format="%H %s" "${LAST_TAG}..HEAD" 2>/dev/null || true)
fi

if [[ -z "$COMMITS" ]]; then
    log "No commits since last tag - nothing to release"
    exit 0
fi

# ---------------------------------------------------------------------------
# Determine bump type
# ---------------------------------------------------------------------------

BUMP="none"

while IFS= read -r line; do
    SUBJECT="${line#* }"  # everything after the first space

    # Check for BREAKING CHANGE in full commit body
    HASH="${line%% *}"
    FULL_MSG=$(git log --format="%B" -n 1 "$HASH" 2>/dev/null || true)

    if echo "$FULL_MSG" | grep -qE "^BREAKING CHANGE:"; then
        BUMP="major"
        break
    fi

    # Check for ! suffix in type (e.g. feat!, fix!)
    if echo "$SUBJECT" | grep -qE "^[a-z]+(\([^)]+\))?!:"; then
        BUMP="major"
        break
    fi

    # feat -> minor (unless already major)
    if echo "$SUBJECT" | grep -qE "^feat(\([^)]+\))?:"; then
        if [[ "$BUMP" != "major" ]]; then
            BUMP="minor"
        fi
    fi

    # fix or perf -> patch (unless already minor or major)
    if echo "$SUBJECT" | grep -qE "^(fix|perf)(\([^)]+\))?:"; then
        if [[ "$BUMP" == "none" ]]; then
            BUMP="patch"
        fi
    fi
done <<< "$COMMITS"

if [[ "$BUMP" == "none" ]]; then
    log "No releasable commits (only chore/docs/test/style/ci) - skipping release"
    exit 0
fi

log "Bump type: $BUMP"

# ---------------------------------------------------------------------------
# Calculate next version
# ---------------------------------------------------------------------------

if [[ -z "$LAST_TAG" ]]; then
    # First release - start at v0.1.0
    NEXT_VERSION="0.1.0"
else
    # Strip leading v
    CURRENT_VERSION="${LAST_TAG#v}"
    MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
    MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)
    PATCH=$(echo "$CURRENT_VERSION" | cut -d. -f3)

    case "$BUMP" in
        major)
            MAJOR=$((MAJOR + 1))
            MINOR=0
            PATCH=0
            ;;
        minor)
            MINOR=$((MINOR + 1))
            PATCH=0
            ;;
        patch)
            PATCH=$((PATCH + 1))
            ;;
    esac

    NEXT_VERSION="${MAJOR}.${MINOR}.${PATCH}"
fi

NEXT_TAG="v${NEXT_VERSION}"
log "Next version: $NEXT_TAG"

# ---------------------------------------------------------------------------
# Idempotency check - skip if tag already exists
# ---------------------------------------------------------------------------

if git tag --list | grep -qx "$NEXT_TAG"; then
    log "Tag $NEXT_TAG already exists - skipping (idempotent)"
    exit 0
fi

# ---------------------------------------------------------------------------
# Update all build.gradle.kts files
# ---------------------------------------------------------------------------

log "Updating build.gradle.kts files to version $NEXT_VERSION"

# Find all build.gradle.kts files that contain a version = "..." line.
# Excludes worktree copies and build-logic (convention plugins have no version).
mapfile -t GRADLE_FILES < <(
    git ls-files '*/build.gradle.kts' 'build.gradle.kts' |
    grep -v '^build-logic/' |
    xargs grep -l 'version = "' 2>/dev/null || true
)

if [[ ${#GRADLE_FILES[@]} -eq 0 ]]; then
    die "No build.gradle.kts files with version = \"...\" found"
fi

for f in "${GRADLE_FILES[@]}"; do
    log "  Updating $f"
    sed -i "s/version = \"[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\"/version = \"${NEXT_VERSION}\"/" "$f"
done

# ---------------------------------------------------------------------------
# Commit version bump
# ---------------------------------------------------------------------------

PACKAGE_JSON="kbeatz-ui/package.json"
if [[ -f "$PACKAGE_JSON" ]]; then
    log "  Updating $PACKAGE_JSON"
    sed -i "s/\"version\": \"[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\"/\"version\": \"${NEXT_VERSION}\"/" "$PACKAGE_JSON"
    git add "$PACKAGE_JSON"
fi

git add "${GRADLE_FILES[@]}"
git commit -m "chore(scaffold): bump version to ${NEXT_VERSION} for release ${NEXT_TAG}"

# ---------------------------------------------------------------------------
# Create tag locally
# ---------------------------------------------------------------------------

git tag "$NEXT_TAG"

# ---------------------------------------------------------------------------
# Build changelog grouped by commit type
# ---------------------------------------------------------------------------

build_changelog() {
    local range_start="$1"

    declare -A COMMIT_GROUPS
    COMMIT_GROUPS["breaking"]=""
    COMMIT_GROUPS["feat"]=""
    COMMIT_GROUPS["fix"]=""
    COMMIT_GROUPS["perf"]=""
    COMMIT_GROUPS["other"]=""

    local log_args
    if [[ -z "$range_start" ]]; then
        log_args="HEAD"
    else
        log_args="${range_start}..HEAD"
    fi

    # Read commits up to (but not including) the new version-bump commit
    # by reading the range from LAST_TAG to the parent of HEAD.
    # HEAD is now the version-bump commit, so use HEAD^ to exclude it.
    if [[ -z "$range_start" ]]; then
        local all_commits
        all_commits=$(git log --format="%H %s" HEAD^ 2>/dev/null || true)
    else
        local all_commits
        all_commits=$(git log --format="%H %s" "${range_start}..HEAD^" 2>/dev/null || true)
    fi

    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        local hash subject
        hash="${line%% *}"
        subject="${line#* }"

        local full_msg
        full_msg=$(git log --format="%B" -n 1 "$hash" 2>/dev/null || true)

        # Determine type and label
        local entry="- ${subject}"

        if echo "$full_msg" | grep -qE "^BREAKING CHANGE:" || \
           echo "$subject" | grep -qE "^[a-z]+(\([^)]+\))?!:"; then
            COMMIT_GROUPS["breaking"]+="${entry}"$'\n'
        elif echo "$subject" | grep -qE "^feat(\([^)]+\))?:"; then
            COMMIT_GROUPS["feat"]+="${entry}"$'\n'
        elif echo "$subject" | grep -qE "^fix(\([^)]+\))?:"; then
            COMMIT_GROUPS["fix"]+="${entry}"$'\n'
        elif echo "$subject" | grep -qE "^perf(\([^)]+\))?:"; then
            COMMIT_GROUPS["perf"]+="${entry}"$'\n'
        else
            COMMIT_GROUPS["other"]+="${entry}"$'\n'
        fi
    done <<< "$all_commits"

    local changelog=""

    if [[ -n "${COMMIT_GROUPS["breaking"]}" ]]; then
        changelog+=$'## Breaking Changes\n\n'
        changelog+="${COMMIT_GROUPS["breaking"]}"$'\n'
    fi

    if [[ -n "${COMMIT_GROUPS["feat"]}" ]]; then
        changelog+=$'## Features\n\n'
        changelog+="${COMMIT_GROUPS["feat"]}"$'\n'
    fi

    if [[ -n "${COMMIT_GROUPS["fix"]}" ]]; then
        changelog+=$'## Bug Fixes\n\n'
        changelog+="${COMMIT_GROUPS["fix"]}"$'\n'
    fi

    if [[ -n "${COMMIT_GROUPS["perf"]}" ]]; then
        changelog+=$'## Performance\n\n'
        changelog+="${COMMIT_GROUPS["perf"]}"$'\n'
    fi

    if [[ -n "${COMMIT_GROUPS["other"]}" ]]; then
        changelog+=$'## Other Changes\n\n'
        changelog+="${COMMIT_GROUPS["other"]}"$'\n'
    fi

    echo "$changelog"
}

CHANGELOG=$(build_changelog "$LAST_TAG")

# ---------------------------------------------------------------------------
# Create GitHub release
# ---------------------------------------------------------------------------

log "Creating GitHub release $NEXT_TAG"

# Push the version-bump commit first (without the tag).
# The tag is pushed separately after gh release create succeeds, so that a
# failed release creation does not leave an orphaned remote tag that would
# block retries via the idempotency check above.
git push origin HEAD

gh release create "$NEXT_TAG" \
    --title "Release $NEXT_TAG" \
    --notes "$CHANGELOG" \
    --target "$(git rev-parse HEAD)"

# Push only the new tag - not all local tags.
git push origin "refs/tags/${NEXT_TAG}"

log "Release $NEXT_TAG created successfully"
