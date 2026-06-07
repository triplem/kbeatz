# Rule: Writing Style

## No Em-Dashes

Do not use the em-dash character (—, U+2014) in any written artifact.

**Why**: The user has explicitly requested plain ASCII punctuation. Em-dashes can also cause copy-paste or rendering issues in some terminals, editors, and CI log viewers.

**Applies to**: GitHub issue bodies and titles, PR descriptions and comments, commit messages, AsciiDoc docs, Markdown files, code comments, challenge reports, ADRs, operations guides, and all other written output produced by agents or skills.

**Replace with**:

| Instead of | Use |
|---|---|
| dash between clauses | plain hyphen-minus `-` |
| introducing a clause | colon `:` |
| parenthetical aside | parentheses `( )` or reword |
| list separator | plain hyphen-minus `-` |

**Examples**:

```
// Bad
**Severity:** BLOCKER — data loss on every rescan

// Good
**Severity:** BLOCKER - data loss on every rescan

// Bad
This change fixes the bug — the root cause was a null override.

// Good
This change fixes the bug. The root cause was a null override.

// Bad
Replaces echo() with kotlin-logging — operational messages now respect log level.

// Good
Replaces echo() with kotlin-logging so operational messages respect log level.
```

**Search to audit**: `grep -r "—" .claude/ docs/ kbeatz-*/docs/` to find any em-dashes already in artifacts.
