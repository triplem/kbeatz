---
name: create-pr
description: Post-merge cleanup after a PR lands on main. Delete branches, close linked issues, and close the parent epic if all its stories are done.
argument-hint: <pr-number>
arguments: [pr_number]
disable-model-invocation: true
allowed-tools: Bash(git *) Bash(gh *)
---

Run this skill once the PR shows `state: MERGED`.

## Step 1 - Delete branches

```bash
git checkout main && git pull
git push origin --delete $branch
git branch -D $branch
```

If the remote branch was already deleted, skip the `push --delete` silently.

## Step 2 - Close linked issues

Collect every issue the PR closes:

```bash
gh pr view $pr_number --json closingIssuesReferences \
  --jq '.closingIssuesReferences[].number'
```

Close each issue:

```bash
gh issue close <number> --comment "Closed by PR #$pr_number (merged to main)."
```

Skip issues that are already closed.

## Step 3 - Check parent epic

For each issue closed above, look up its parent epic:

```bash
gh api graphql -f query='
{
  repository(owner: "triplem", name: "kbeatz") {
    issue(number: <number>) {
      parent {
        number
        title
        state
        subIssues(first: 50) {
          nodes { number state }
        }
      }
    }
  }
}'
```

If the issue has a parent epic **and** every sub-issue in `subIssues.nodes` has `state: CLOSED`:

```bash
gh issue close <epic-number> --comment "All stories complete - closing epic."
```

If different issues belong to different epics, check each epic independently.
