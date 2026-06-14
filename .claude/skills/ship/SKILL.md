---
name: ship
description: >
  Full parallel SDLC pipeline: implement all target items (epics, stories, or all approved),
  challenge every PR from 9 specialist perspectives, comment BLOCKER/MAJOR/MINOR/NIT findings,
  fix them, merge, then challenge the main branch and open issues for every finding.
  Agents run in parallel where dependency order allows.
argument-hint: "[epic <N> [N...]] | [story <N> [N...]] | [all]"
arguments: [targets]
user-invocable: true
effort: max
allowed-tools: Read Write Edit Bash(gh *) Bash(git *) Bash(./gradlew *) Bash(npm *) Bash(find *) Bash(grep *)
---

## Targets: $targets

!`echo "Resolving targets: $targets"`
!`gh issue list --state open --label "approved" --limit 100 --json number,title,labels,body 2>/dev/null | head -200`
!`git status --short`
!`git log --oneline -5`

## Instructions

### Phase 0 — Resolve the work list

Parse `$targets`:

| Input | Meaning |
|---|---|
| `epic 14 15` | All open approved stories that are sub-issues of epics 14 and 15 |
| `story 57 58` | Exactly issues 57 and 58 |
| `all` | Every open issue with labels `approved` + (`story` or `bug` or `enhancement`) |
| *(omitted)* | Same as `all` |

For each resolved issue, collect:
- Number, title, labels, body (acceptance criteria, dependencies)
- Whether it is a **code story**, **docs story** (`documentation`/`adr` label), or **fix issue** (`bug`/`enhancement`)
- Its declared dependencies (`Depends on #NNN`, `Blocked by #NNN` in the body)

Skip closed issues and issues labelled `BLOCKED` or `pending-approval`. Log each skip.

If the work list is empty → exit: "No implementable issues found matching: $targets"

---

### Phase 0a — Human confirmation gate

Before building the dependency graph or dispatching any agents, output a summary of the resolved work list and wait for explicit confirmation.

Print a summary table:

```
## Planned /ship run — $(date +%Y-%m-%d)

| # | Issue | Title | Type | Labels |
|---|-------|-------|------|--------|
| 1 | #57   | ...   | story | story, approved |
| 2 | #58   | ...   | bug   | bug, approved   |
...

Total: N issues to implement.
```

Then stop and ask:

```
Proceed with implementing these N issues? [y/N]
```

- If the human answers `y` or `yes` (case-insensitive): continue to Phase 1.
- Any other answer (including no response): exit cleanly with "Aborted. No changes made."

---

### Phase 1 — Build the dependency graph and execution waves

1. Build an adjacency map: `blockers[N] = {set of open issue numbers N depends on}`
2. Ignore dependencies on already-closed issues (treat as satisfied)
3. Run Kahn's topological sort to detect cycles — if a cycle is found, label all involved issues `BLOCKED` and exit
4. Partition the work list into waves:
   - **Wave 1**: issues with no unmet dependencies
   - **Wave K**: issues whose blockers are all in waves 1…K-1

---

### Phase 2 — Group each wave by module for parallel execution

Within each wave, group issues by the primary **module/directory** they will touch. Issues that touch the same module must go to the **same agent** (to avoid git conflicts). Issues touching different modules can go to **different parallel agents**.

**Grouping heuristic** (adapt to the project's structure):
- Read each issue's scope from its labels, body, and title to determine which source directories it will modify
- Common splits: `backend-service`, `backend-api`, `frontend`, `infra/ci`, `docs`, `library-X`
- One agent per group per wave

Example grouping for a wave of 7 fixes:
```
Agent A: issues #131 #133 #134 (all touch module-api service layer)
Agent B: issues #128 #132 #137 (all touch module-api handlers)
Agent C: issues #129 #136 #138 (all touch module-ui)
Agent D: issues #95 #130 #143  (module-library + CI + docs)
```

**Rule**: When in doubt, put issues in the same agent rather than risk a conflict. Parallelism is a performance optimisation, not a correctness requirement.

---

### Phase 3 — Execute waves

For each wave **in order** (never start wave N+1 until all wave N agents complete):

#### 3a — Dispatch agents in the wave

Spawn one background agent per group with this prompt template:

```
You are implementing/fixing the following GitHub issues in <repo>:
  [list of issue numbers + titles]

Working directory: <path>
Module/files you own (do NOT touch other modules — other agents own them):
  [list of file patterns]

For EACH issue, follow this lifecycle:
  1. git checkout main && git pull origin main
  2. gh issue view NNN --json body -q '.body'   # read acceptance criteria
  3. gh issue edit NNN --add-assignee "@me" && gh issue edit NNN --add-label "In Progress"
  4. ./.claude/scripts/create-branch.sh <type> NNN <slug>   # or equivalent
  5. Implement the fix/feature (code or docs)
  6. Run quality gates: [project-specific commands]
  7. Commit with: <type>(<scope>): #NNN <summary>
  8. git push -u origin <branch>
  9. gh pr create --title "..." --body "..."
 10. Challenge the PR from all 9 specialist perspectives (see §Challenge below)
 11. Comment ALL findings (BLOCKER through NIT) as a single consolidated comment on the PR
 12. Fix ALL findings directly on the branch (including MINOR and NIT) — not just BLOCKER/MAJOR; re-run quality gates after fixes
 13. gh pr checks <pr-num>  # wait for CI green
 14. gh pr merge <pr-num> --squash --delete-branch
 15. gh issue close NNN --comment "Fixed in PR #PR_NUM."
 16. git branch -D <branch>  # delete local branch in your worktree
 17. git fetch origin && git checkout -b <next-type>/<next-NNN>-<slug> origin/main  # sync for next issue

Implement issues in this order to respect dependencies: [ordered list]
Never start an issue until its listed dependencies are merged.
[Include §Challenge and §Quality-Gate blocks verbatim]
```

All agents in the wave run in **parallel (background)**. Wait for all to complete before starting wave N+1.

#### 3b — Handle failures

After each wave, for any issue where no PR was created or the branch is still dirty:
- Label the issue `BLOCKED`
- Skip issues in subsequent waves that depend on the failed one
- Log: `"#NNN failed — skipping dependents: #X #Y"`

---

### § Challenge — Standard PR review block (embed in every agent prompt)

After creating a PR, review it from these 9 perspectives and post one consolidated comment:

```
gh pr comment <PR> --body "$(cat <<'EOF'
## Challenge Report — #NNN <title>

### BLOCKER
- [finding or None]

### MAJOR
- [finding or None]

### MINOR
- [finding or None]

### NIT
- [finding or None]

**Verdict: APPROVE / REQUEST CHANGES**
EOF
)"
```

**What to check per perspective:**

| # | Persona | Focus |
|---|---------|-------|
| 1 | End User | Does the change deliver the stated AC? Is it discoverable? |
| 2 | Security | OWASP Top 10, path traversal, secrets in logs, input validation |
| 3 | QA | All ACs tested, edge cases, error paths, coverage ≥ 80% |
| 4 | Architect | SOLID, correct layer placement, no circular deps, API design |
| 5 | DevSecOps | Build correct, config externalised, CI covers the change |
| 6 | UX/Accessibility | WCAG AA, keyboard nav, ARIA, contrast |
| 7 | Requirements | All ACs implemented, NFRs addressed |
| 8 | Performance | No N+1 queries, pagination, debouncing, memory |
| 9 | Operations | Structured logging, health check impact, graceful shutdown |

Severity guide:
- **BLOCKER**: data loss, security hole, broken critical path — fix directly on the PR branch before merge
- **MAJOR**: correctness bug, missing test for a stated AC, design smell — fix directly on the PR branch before merge
- **MINOR**: style/naming, unlikely edge case, missing optional test — fix directly on the PR branch before merge
- **NIT**: whitespace, comment wording, pedantic — fix directly on the PR branch before merge

**Default behavior**: Fix ALL findings (BLOCKER through NIT) directly on the branch and push before merging. Do NOT open separate GitHub issues for individual PR findings. The Phase 5 issue-creation step applies only to Phase 4 main branch challenge findings.

---

### § Quality Gate — Standard gate block (embed in every agent prompt)

```bash
# Kotlin/Gradle (run per-module, not at root in includeBuild setups)
./gradlew :<module>:detektMain          # linter — after every .kt change
./gradlew :<module>:check               # tests + detekt + kover (≥ 80% coverage)

# TypeScript/React
cd <frontend-dir>
npm run lint                            # ESLint
npm run build                           # TypeScript strict compile
npm run test:coverage                   # Vitest/Jest ≥ 80% coverage

# Docs-only stories: verify file exists at correct path, build not broken
```

Common Kotlin Detekt false-positive patterns to avoid (see global CLAUDE.md):
- `?: return` → use `?.let` expression body
- Loop with 2+ `continue` → extract to private function
- ReturnCount exceeded → expression body
- MagicNumber for spec constants → `@Suppress("MagicNumber")` with comment

---

### Phase 4 — Main branch challenge

After **all waves complete and all PRs are merged**, pull latest main and run a full 9-perspective challenge against the diff since the last release tag (or since the branch point of the oldest merged PR):

```bash
git checkout main && git pull origin main
git log --oneline <base>..HEAD          # all merged work
git diff <base>..HEAD -- <src-dirs> | head -8000
```

Review from all 9 perspectives (same as §Challenge above) plus:
- Cross-cutting patterns: does the same anti-pattern appear in multiple PRs?
- Are all BLOCKER/MAJOR items from individual PR challenges actually fixed?
- Are the new CI checks sufficient to catch regressions?

---

### Phase 5 — Open issues for all findings

For **every** finding from the main branch challenge (BLOCKER through NIT), open a GitHub issue:

```bash
gh issue create \
  --title "<severity>(<scope>): <short title>" \
  --label "<label>" \
  --body "$(cat <<'EOF'
## Finding

**Severity:** BLOCKER / MAJOR / MINOR / NIT
**Persona:** <specialist role>
**File:** <path:line if applicable>

## Description
<full description>

## Why it matters
<impact>

## Suggested fix
<specific approach>

## Found by
Main branch challenge — /ship run $(date +%Y-%m-%d)
EOF
)"
```

Label mapping:
- BLOCKER → `bug` + `blocker`
- MAJOR → `bug` (correctness) or `enhancement` (design)
- MINOR → `enhancement`
- NIT → `enhancement`

---

### Phase 6 — Close parent epics

After all issues are merged and challenge findings are filed, close any parent epics whose **all** sub-issues are now closed:

```bash
# For each epic in scope
gh issue view <epic> --json body -q '.body' | grep "^\- \[" | grep -v "^\- \[x\]"
# If all story checkboxes are closed → close the epic
gh issue close <epic> --comment "All stories implemented and merged. Challenge findings filed as follow-up issues."
```

---

### Phase 7 — Final summary

Output a complete pipeline report:

```markdown
## /ship Summary — $(date +%Y-%m-%d)

### Work completed
| Issue | Title | Wave | Agent group | PR | Status |
|-------|-------|------|-------------|----|--------|
| #NNN | ... | 1 | backend-service | #NNN | ✓ merged |

### Main branch challenge
| Severity | Count | Issues filed |
|----------|-------|--------------|
| BLOCKER | N | #NNN #NNN |
| MAJOR | N | #NNN #NNN |
| MINOR | N | #NNN |
| NIT | N | #NNN |

### Epics closed
#NNN, #NNN

### Verdict
CLEAN / FINDINGS FILED — ready for next sprint
```

---

## Rollback Runbook

Use this section when a merged PR turns out to be wrong and needs to be reverted after the ship run completes.

### When to revert vs. fix forward

| Situation | Action |
|---|---|
| Small logic bug, no data impact | Fix forward: open a new issue, implement, PR, merge |
| Data loss or corruption | Treat as P0 incident first; revert once blast radius is understood |
| API contract broken, consumers failing | Revert immediately |
| Cosmetic or non-critical defect | Fix forward |

Do not revert unless the defect is causing active harm or blocking other teams. A revert PR is itself a change that can introduce regressions.

### Step 1 - Identify which commits to revert

List the squash commits merged during the ship run (use the ship start timestamp as the lower bound):

```bash
git log --oneline --after="YYYY-MM-DDTHH:MM:SSZ" main
```

Each squash commit corresponds to one PR. Note the SHA and PR number for each commit you need to revert.

### Step 2 - Revert a single merged PR

```bash
# Create a revert branch
git checkout main && git pull origin main
git checkout -b fix/<issue-number>-revert-pr-<pr-number>

# Revert the squash commit (-m 1 targets the mainline parent)
git revert -m 1 <squash-commit-sha>

# Amend the revert commit message to follow conventions
git commit --amend -m "revert(<scope>): #<issue-number> revert PR #<pr-number> - <reason>"

git push -u origin fix/<issue-number>-revert-pr-<pr-number>
gh pr create --title "revert(<scope>): #<issue-number> revert PR #<pr-number>" \
  --body "Reverts the changes introduced in PR #<pr-number>. Reason: <reason>"
```

Merge the revert PR through the normal review and CI process - do not bypass quality gates.

### Step 3 - Revert multiple PRs in a batch

Revert in reverse merge order (newest squash commit first) to minimise conflicts:

```bash
git checkout main && git pull origin main
git checkout -b fix/<issue-number>-batch-revert

# Revert newest first
git revert -m 1 <sha-of-newest-squash>
git revert -m 1 <sha-of-older-squash>
# ... continue in reverse order

git push -u origin fix/<issue-number>-batch-revert
gh pr create --title "revert: batch revert PRs #A #B #C" \
  --body "Reverts PRs in reverse order: #C, #B, #A. Reason: <reason>"
```

If conflicts arise between reverts, resolve them manually - each conflict means two reverted PRs touched the same code.

### Step 4 - Re-open issues after reverting

Once the revert PR is merged:

```bash
# Re-open each reverted issue
gh issue reopen <number> --comment "Reverted in PR #<revert-pr-number>. Needs rework."

# Remove "closed" state indicators and restore In Progress
gh issue edit <number> --add-label "In Progress"
gh issue edit <number> --add-assignee "@me"
```

Update the issue body with a note about what went wrong so the next implementation avoids the same mistake.

### Step 5 - Clean up the reverted branch

```bash
# After the revert PR merges, delete the revert branch
git push origin --delete fix/<issue-number>-revert-pr-<pr-number>
git checkout main && git pull origin main
git branch -D fix/<issue-number>-revert-pr-<pr-number>
```

---

## Lessons from field use (2026-06-07)

### Worktree isolation prevents agent interference
When multiple agents work on the same repo simultaneously, use `git worktree add` to give each agent its own working tree. Without this, agents on different branches in the same working directory leave uncommitted files on each other's branches and create stash stacks that are hard to clean up.

```bash
WORKTREE=/path/to/project-worktrees/agent-NNN
git worktree add $WORKTREE <branch-name>
# work inside $WORKTREE, not the main working dir
git worktree remove -f -f $WORKTREE   # cleanup after merge
```

### Module-ownership grouping prevents merge conflicts
Even when issues are independent in the dependency graph, two agents that both modify `Application.kt` or the same handler will produce conflicting PRs. Assign issues to agents by the **files they will touch**, not just their feature area. One file → one agent, always.

### Group ordering: isolated refactors first
When a wave has both complex multi-file changes and simple isolated refactors, implement the simple refactors first (smaller PRs merge cleanly, reducing the conflict surface for subsequent PRs that depend on the same base).

### Chain-dependent epics
When Epic B depends on Epic A, do not start Epic B's agent until all Epic A PRs are merged into main. Checking "is the API I need available on main?" is faster and more reliable than trying to base branches on unmerged branches.

### Network timeout recovery
Long-running agents (implementing 7+ stories) can hit network idle timeouts. Before restarting:
1. Check what branches and PRs already exist (`git branch -a`, `gh pr list`)
2. Check working tree state (`git status --short`)
3. Check stash list (`git stash list`)
4. Recover any uncommitted partial work to the correct branch before restarting
5. Restart with explicit "starting from story #NNN, prior work already committed" context

### CI must cover all modules before final merge
The main branch challenge consistently reveals gaps when CI only covers the backend. Add frontend build/lint/test as a parallel CI job early — before the first wave merges.

### Fix ALL challenge findings directly on the PR branch - do not defer to follow-up issues
The user prefers that every PR challenge finding (BLOCKER through NIT) is fixed directly on the feature branch and pushed before merging. Do not open separate GitHub issues for findings from individual PR challenges; only Phase 4 main branch challenge findings become issues. This keeps the main branch clean after each merge without leaving a trail of NIT-level debt.

In practice this means step 12 in the agent lifecycle is "Fix ALL findings (not just BLOCKER/MAJOR), re-run quality gates, push." The consolidated PR comment still lists all findings so the review record exists.

### Local branch cleanup is a mandatory step in each agent lifecycle
After `gh pr merge --squash --delete-branch`, delete the local branch with `git branch -D <branch>` inside the worktree. Without this, worktrees accumulate stale branches that can conflict with subsequent issues in the same agent session.

### Worktree initialization: use `--detach` or a holding branch, never share `main`
When a worktree is created with `git worktree add <path> -b wt-agent-X`, the holding branch (`wt-agent-X`) is used only as an anchor. For each issue, create the feature branch with `git checkout -b <type>/<NNN>-<slug> origin/main` (not from the holding branch). After the ship run, delete holding branches with `git branch | grep "wt-agent-" | xargs git branch -D` and worktrees with `git worktree remove -f -f <path>`.
