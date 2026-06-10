# Rule: Branching Strategy

## Main Branches

| Branch | Purpose | Protection |
|---|---|---|
| `main` | Production-ready code | Protected: require PR, CI green, squash rebase only |
| `develop` | Integration branch (optional, for large teams) | Protected: require PR, CI green |

**Direct commits to `main` are blocked by a git hook - this is enforced, not just a convention.**
Never commit directly to `main` or `develop`.

## Creating a Feature Branch

Always create a branch before staging any commits. Use the project script:

```bash
./.claude/scripts/create-branch.sh <type> <issue-number> <short-description>
# Example:
./.claude/scripts/create-branch.sh docs 321 pr-reviewer-skill
```

The script validates the type, slugifies the description, checks out `main`, pulls latest, and creates the branch in one step.

If the script fails due to unstaged changes (error: `cannot pull with rebase: You have unstaged changes`), stash first, pull, then branch:

```bash
git stash
git pull origin main
git checkout -b <type>/<issue-number>-<short-description>
git stash pop
# then stage and commit normally
git push -u origin <branch>
```

Do **not** attempt to commit on `main` and then move the commit - always create the branch first.

## Feature Branches

```
<type>/<issue-number>-<short-description>
```

- `type` must match the conventional commit type: `feature`, `fix`, `bug`, `chore`, `docs`, `refactor`
- `issue-number` is the tracker issue ID (GitHub #, Jira, GitLab !)
- `short-description` is 2–5 words, kebab-case, describing the work

Examples:
```
feature/42-user-jwt-auth
fix/101-null-pointer-on-login
bug/77-payment-timeout-retry
chore/55-upgrade-spring-boot-3
docs/12-openapi-auth-endpoints
refactor/88-extract-domain-events
```

## Worktrees for Parallel Agents

When multiple agents work on the same story:

```bash
# Agent A
git worktree add ../worktree-42-impl feature/42-user-jwt-auth

# Agent B (test writer)
git worktree add ../worktree-42-tests feature/42-user-jwt-auth
```

Each agent commits to the same branch via its own worktree. Coordinate via the feature branch - rebase frequently.

## Rebase Policy

- **main ← feature**: Squash rebase. One commit per story.
- **develop ← feature**: Rebase onto develop (fast-forward, preserves history).
- **Never**: merge main into a feature branch. Always rebase: `git rebase main`.

## Release Tags

```
v<major>.<minor>.<patch>
```

Tags are created on `main` by ReleaseAgent after squash rebase. Semver bump is determined automatically from conventional commits.

## Post-Rebase Branch Cleanup

**Remote branch deletion is automated.** The `.github/workflows/branch-cleanup.yml`
workflow triggers on `pull_request` `closed` and, when `merged == true`, deletes the
merged head branch from the remote (protected branches `main`/`develop` are skipped).
You normally do not need to run `git push origin --delete` by hand.

Local branch deletion remains a **manual** step - GitHub Actions cannot touch a
developer's local git state:

```bash
# Switch away from the branch first if on it
git checkout main

# Prune the now-deleted remote-tracking ref, then delete the local branch
git fetch --prune
git branch -D <branch-name>
```

If the automated workflow is ever disabled or fails, fall back to deleting the
remote branch manually as the last step of the merge flow:

```bash
git push origin --delete <branch-name>
```

Stale branches clutter `git branch` output and confuse future work, so confirm both
the remote (automated) and local (manual) branch are gone after every merge.

## Stale Branches

Any branch that has been rebased/closed and not yet deleted is stale. Clean up proactively:

```bash
git fetch --prune                    # removes stale remote-tracking refs
git branch -vv | grep ': gone]'      # shows local branches whose remote is deleted
```

## Worktree Cleanup: Double-Force Required for Locked Worktrees

Claude agent worktrees are locked with a lock reason. A single `git worktree remove --force` is not enough - it fails with `"cannot remove a locked working tree, use 'remove -f -f' to override"`. Always use double-force:

```bash
git worktree remove -f -f /path/to/worktree
```

After removing worktrees, delete the now-dangling local branches:

```bash
git branch | grep "worktree-agent-" | xargs -r git branch -D
```

Then prune stale remote-tracking refs:

```bash
git fetch --prune
```

## Hotfix

For production bugs requiring immediate fix:

```
fix/<issue-number>-hotfix-<description>
```

Branch from `main`, fix, PR to `main`. ReleaseAgent creates a patch release immediately.
