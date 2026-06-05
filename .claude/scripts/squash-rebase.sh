#!/usr/bin/env bash
# Squash-rebase a feature branch onto origin/main (local prep only — never pushes to main).
# After running this, merge via: gh pr merge <pr-id> --squash --delete-branch
#
# Usage: ./.claude/scripts/squash-rebase.sh <branch> "<conventional-commit-message>"
# Example: ./.claude/scripts/squash-rebase.sh feature/42-jwt-refresh "feat(auth): add JWT refresh token (#42)"

set -euo pipefail

BRANCH="${1:?Usage: $0 <branch> '<commit-message>'}"
MESSAGE="${2:?Usage: $0 <branch> '<commit-message>'}"

cleanup() {
  if git rebase --show-current-patch &>/dev/null || [ -d "$(git rev-parse --git-dir)/rebase-merge" ] || [ -d "$(git rev-parse --git-dir)/rebase-apply" ]; then
    echo "Aborting in-progress rebase..." >&2
    git rebase --abort 2>/dev/null || true
  fi
}
trap 'echo "Error on line $LINENO. Cleaning up..." >&2; cleanup' ERR

# Fetch latest main so the rebase targets the true remote tip
git fetch origin main

git checkout "$BRANCH"
git rebase origin/main

# Guard: nothing to squash
COMMITS=$(git rev-list origin/main..HEAD --count)
if [[ "$COMMITS" -eq 0 ]]; then
  echo "Error: '$BRANCH' has no commits ahead of origin/main. Nothing to squash." >&2
  exit 1
fi

# Squash all commits on this branch into one
git reset --soft "HEAD~${COMMITS}"
git commit -m "$MESSAGE"

# Push the squashed branch (force-with-lease: safe rewrite of already-pushed branch)
git push --force-with-lease origin "$BRANCH"
echo "Done. '$BRANCH' squash-rebased onto origin/main and pushed."
echo "Next: gh pr merge <pr-id> --squash --delete-branch"
