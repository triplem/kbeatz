#!/usr/bin/env bash
# Hook: PreToolUse:Bash
# Blocks destructive or policy-violating Bash commands before they execute.
# Checks: force-push to main/master, git reset --hard on main, rm -rf /.

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || \
          echo "$INPUT" | grep -o '"command":"[^"]*"' | head -1 | sed 's/"command":"//;s/"//')

# Extract only the first line of the command for push/commit checks.
# This prevents false positives when heredoc content mentions git push commands
# in documentation strings or PR body text.
FIRST_LINE=$(echo "$COMMAND" | head -1)

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
if echo "$FIRST_LINE" | grep -qE 'git push.*(--force|-f).*(main|master)'; then
  deny "Force push to main/master is blocked. Per branching-strategy rules, main is protected. Use a feature branch and open a PR instead."
fi

# Block: any force push to origin main/master (catches 'git push origin main --force' order variants)
if echo "$FIRST_LINE" | grep -qE 'git push.*(main|master).*--force'; then
  deny "Force push to main/master is blocked. Use a feature branch and PR workflow."
fi

# Block: git reset --hard on main/master checkout
if echo "$FIRST_LINE" | grep -qE 'git (checkout|switch) (main|master)' && \
   echo "$FIRST_LINE" | grep -q 'reset --hard'; then
  deny "git reset --hard on main/master is blocked. This would destroy history."
fi

# Block: dangerous rm patterns
if echo "$FIRST_LINE" | grep -qE 'rm\s+-rf\s+/[^a-zA-Z]'; then
  deny "Blocked: 'rm -rf /' or similar root-level deletion detected."
fi

# Block: any direct push to main (non-force — force is already blocked above)
if echo "$FIRST_LINE" | grep -qE 'git push (origin )?main'; then
  deny "Direct push to main is blocked. Squash-rebase your branch with ./.claude/scripts/squash-rebase.sh, then merge via: gh pr merge <pr-id> --squash --delete-branch"
fi

# Warn: skipping hooks
if echo "$COMMAND" | grep -q -- '--no-verify'; then
  warn "Warning: --no-verify skips pre-commit hooks including quality gates. Only use this with explicit human approval."
fi

exit 0
