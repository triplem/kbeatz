---
name: challenge-all
description: Run all specialist reviewer perspectives (user, security, QA, architect, DevOps, UX, requirements, performance, operations, technical writer) against a single target and produce a consolidated challenge report. Use before merging a significant feature or finalising an epic.
argument-hint: <pr-number | issue-number | "inline text to review">
arguments: [target]
user-invocable: true
allowed-tools: Read Bash(gh *) Bash(grep -r *) Bash(git diff *) Bash(find *)
---

## Multi-perspective challenge: $target

!`gh issue view $target 2>/dev/null || gh pr view $target 2>/dev/null || echo "Reviewing inline: $target"`

!`gh pr diff $target 2>/dev/null | head -4000`

## Instructions

You embody all specialist roles simultaneously. For each persona, apply that lens to the target and record findings. Then synthesise into a consolidated verdict. A single REJECT from any persona blocks the target.

Work through each persona in order. Findings from one persona may inform another — consistency across perspectives is as important as depth within each.

---

## Persona 1: End User (music collector, desktop + LAN)
*Usability, real-world fit, collection workflow*

Apply the checklist from `/ux-review` through the user's lens:
- Can the user browse and find an album within a few seconds?
- Are tag edits discoverable and forgiving (undo / cancel)?
- Is the Discogs sync flow clear — does the user know what will change?
- Does the CLI (`kbeatz-tagger`) produce clear output for both success and skip?
- Does the feature work from another device on the LAN without extra config?

---

## Persona 2: Security Specialist
*OWASP Top 10, secrets, path traversal, input validation*

Apply the checklist from `/security-review`:
- `DISCOGS_TOKEN` never in source, logs, or API responses?
- All filesystem path parameters validated within the configured library root?
- No injection vectors in tag values written to FLAC files?
- No secrets in build args or committed config?

---

## Persona 3: QA Engineer
*Test coverage, edge cases, regression risk*

Apply the checklist from `/qa-review`:
- All acceptance criteria testable and tested?
- Boundary values, error paths, null inputs covered?
- Multi-disc albums, VA compilations, missing id files tested?
- No tests skipped or commented out?

---

## Persona 4: Software Architect
*Hexagonal layers, SOLID, module boundaries, API design*

Apply the checklist from `/architect-review`:
- Domain layer free of framework imports?
- `kbeatz-filecodec`, `kbeatz-sources`, `kbeatz-tagger` dependency graph acyclic?
- No logic duplicated between CLI and catalog service paths?
- Breaking changes versioned?

---

## Persona 5: DevSecOps Engineer
*Container hygiene, env config, CI/CD, supply chain*

Apply the checklist from `/devops-review`:
- Base images pinned?
- `DISCOGS_TOKEN` and `LIBRARY_ROOT` present in compose file as env vars (not hard-coded)?
- New services in correct `depends_on` chain?
- Secrets never in build args?

---

## Persona 6: UI/UX and Accessibility Specialist
*WCAG AA, ease of use, interaction design*

Apply the checklist from `/ux-review`:
- Contrast ratio ≥ 4.5:1?
- All inputs have labels (not just placeholders)?
- Touch targets ≥ 44px (tablet usability)?
- Keyboard navigation works?

---

## Persona 7: Requirements Engineer
*Completeness, testability, consistency, NFRs*

Apply the checklist from `/requirements-review`:
- All criteria SMART and unambiguous?
- NFRs stated (performance, availability)?
- No contradictions with existing ADRs or `docs/requirements.md`?

---

## Persona 8: Performance Engineer
*Query efficiency, bundle size, response times*

Apply the checklist from `/performance-review`:
- No N+1 queries on the album listing?
- Pagination enforced above the 5 000 album threshold (NFR-12)?
- Client-side filter stays under 200 ms p95 at 2 000 albums?
- Bundle size impact assessed?

---

## Persona 9: Operations / SRE
*Observability, graceful degradation, runbook*

Apply the checklist from `/operations-review`:
- Structured logs include `albumDir` / `discogsId` context on errors?
- Discogs rate-limit exhaustion produces a clear WARN, not a silent drop?
- New env vars have safe defaults?
- `.kbeatz-write.lock` repair path exercised in tests?

---

## Persona 10: Technical Writer
*Documentation, clarity, in-app help text*

Apply the checklist from `/technical-writer-review`:
- ADRs complete (Context / Decision / Consequences / Alternatives)?
- CLI `--help` text accurate and complete?
- Error messages explain what to do next?

---

## Consolidated report format

```markdown
## Challenge-All Report: $target

**Overall verdict**: ACCEPT | REVISE | REJECT

A single REJECT from any persona = overall REJECT.
Any REVISE from a persona = overall REVISE (at minimum).

---

### Persona verdicts

| Persona | Verdict | Top finding |
|---|---|---|
| User | ACCEPT/REVISE/REJECT | [one-liner] |
| Security | ACCEPT/REVISE/REJECT | [one-liner] |
| QA | ACCEPT/REVISE/REJECT | [one-liner] |
| Architect | ACCEPT/REVISE/REJECT | [one-liner] |
| DevOps | ACCEPT/REVISE/REJECT | [one-liner] |
| UX/Accessibility | ACCEPT/REVISE/REJECT | [one-liner] |
| Requirements | ACCEPT/REVISE/REJECT | [one-liner] |
| Performance | ACCEPT/REVISE/REJECT | [one-liner] |
| Operations | ACCEPT/REVISE/REJECT | [one-liner] |
| Technical Writer | ACCEPT/REVISE/REJECT | [one-liner] |

---

### Consolidated required changes (REVISE)
1. [Change] — raised by [Persona]
2. [Change] — raised by [Persona]

### Blockers (REJECT)
- [Blocker] — raised by [Persona] — must be resolved before proceeding

### Cross-cutting observations
- [Pattern spotted by multiple personas — systemic issue or strength]

### Positive consensus
- [What multiple personas agreed is well done]
```
