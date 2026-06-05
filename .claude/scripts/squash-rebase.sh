#!/usr/bin/env bash
# Squash-rebase a feature branch onto main.
# Usage: ./.claude/scripts/squash-rebase.sh <branch> "<conventional-commit-message>"
# Example: ./.claude/scripts/squash-rebase.sh feature/42-jwt-refresh "feat(auth): add JWT refresh token (#42)"

set -euo pipefail

BRANCH="${1:?Usage: $0 <branch> '<commit-message>'}"
MESSAGE="${2:?Usage: $0 <branch> '<commit-message>'}"

echo "Squash-rebasing $BRANCH onto main..."
git checkout "$BRANCH"
git rebase main

# Squash all commits on this branch into one
COMMITS=$(git rev-list main..HEAD --count)
git reset --soft "HEAD~${COMMITS}"
git commit -m "$MESSAGE"

# Fast-forward main to the squashed tip (no merge commit)
git checkout main
git merge --ff-only "$BRANCH"
git push origin main
git branch -d "$BRANCH" 2>/dev/null && echo "Deleted local branch $BRANCH" || true
git push origin --delete "$BRANCH" 2>/dev/null && echo "Deleted remote branch $BRANCH" || true
echo "Done. Squash-rebased '$BRANCH' onto main."
