#!/usr/bin/env bash
# Hook: PreToolUse:Bash
# Blocks destructive or policy-violating Bash commands before they execute.
# Checks: force-push to main/master, git reset --hard on main, rm -rf /.

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || \
          echo "$INPUT" | grep -o '"command":"[^"]*"' | head -1 | sed 's/"command":"//;s/"//')

# Use line-start anchor (^\s*) when checking for git push patterns.
# This catches git push on any line of a multi-line command while avoiding
# false positives in heredoc content, where git push appears mid-line
# (e.g. inside markdown table cells or backtick spans).

deny() {
  python3 -c "
import json, sys
print(json.dumps({
    'hookSpecificOutput': {
        'hookEventName': 'PreToolUse',
        'permissionDecision': 'deny',
        'permissionDecisionReason': sys.argv[1]
    }
}))
" "$1"
  exit 0
}

warn() {
  python3 -c "
import json, sys
print(json.dumps({
    'systemMessage': sys.argv[1]
}))
" "$1"
  exit 0
}

# Block: force push to main or master
if echo "$COMMAND" | grep -qE '^\s*git push.*(--force|-f).*(main|master)'; then
  deny "Force push to main/master is blocked. Per branching-strategy rules, main is protected. Use a feature branch and open a PR instead."
fi

# Block: any force push to origin main/master (catches 'git push origin main --force' order variants)
if echo "$COMMAND" | grep -qE '^\s*git push.*(main|master).*--force'; then
  deny "Force push to main/master is blocked. Use a feature branch and PR workflow."
fi

# Block: git reset --hard on main/master checkout
if echo "$COMMAND" | grep -qE '^\s*git (checkout|switch) (main|master)' && \
   echo "$COMMAND" | grep -q 'reset --hard'; then
  deny "git reset --hard on main/master is blocked. This would destroy history."
fi

# Block: dangerous rm patterns
if echo "$COMMAND" | grep -qE '^\s*rm\s+-rf\s+/[^a-zA-Z]'; then
  deny "Blocked: 'rm -rf /' or similar root-level deletion detected."
fi

# Block: any direct push to main (non-force — force is already blocked above)
if echo "$COMMAND" | grep -qE '^\s*git push (origin )?main'; then
  deny "Direct push to main is blocked. Squash-rebase your branch with ./.claude/scripts/squash-rebase.sh, then merge via: gh pr merge <pr-id> --squash --delete-branch"
fi

# Warn: skipping hooks
if echo "$COMMAND" | grep -q -- '--no-verify'; then
  warn "Warning: --no-verify skips pre-commit hooks including quality gates. Only use this with explicit human approval."
fi

exit 0
