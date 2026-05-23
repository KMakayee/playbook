# Issue Board

> **Purpose:** Track issues through the playbook workflow. Each issue progresses through statuses as slash commands are run against it.
> **Status flow:** `Draft` → `In Research` → `In Planning` → `In Review` → `In Progress` → `Implemented` → `Done` | `Deferred`
> **Commands:** `/issue-research`, `/issue-plan`, `/issue-implement`, `/issue-update`, `/issue-finish`

---

## Issue Format

Each issue uses the structure below. Copy it when adding a new issue.

```
## #N — [Title]

**Status:** Draft
**Priority:** High | Medium | Low
**Created:** YYYY-MM-DD

### Description

[What needs to happen and why. Be specific enough that research can begin without further clarification.]

### Acceptance Criteria

- [ ] [Observable, testable outcome]
- [ ] [Another outcome]

### Constraints

[Optional. Scope boundaries, locked decisions, behavior the implementation must not break. Omit if none.]

### Relevant paths

[Optional. Files, globs, or docs likely relevant — discovery accelerators, not scope. May go stale on the board; omit if unsure.]

### Notes

[Accumulates during workflow — research findings, plan decisions, implementation notes. Newest entries first.]

### Impacts

[Filled by `/issue-update` after a related issue completes. Describes how other issues' changes affect this one.]
```

---

## Issues

<!-- Add new issues below. Number sequentially. -->

## #3 — /playbook-setup should install the permission rules the playbook's commands require

**Status:** Draft
**Priority:** Medium
**Created:** 2026-05-20

### Description

The RDPI commands shell out to `codex exec` and `claude -p` (both now backgrounded after Task 10). On a fresh playbook install these invocations have no matching permission rules, so Claude Code's auto-mode classifier denies them on first use — the developer hits a hard stop mid-workflow (e.g. the first `/research-codebase` Codex sweep, or `/auto-issues` Phase 4's `claude -p` child).

Observed during Task 10 verification testing: `Bash(codex *)` happened to already be present in this repo's `.claude/settings.local.json`, but `Bash(claude -p *)` was missing and had to be added ad hoc to run the test. `/playbook-setup` has no step that establishes these permissions, so every new playbook adopter rediscovers the gap one denial at a time.

The fix should audit the complete set of permissions the playbook's commands depend on — at minimum `codex` and `claude -p`, but likely also the `.claude/scripts/*.sh` helpers, git operations, and `gh` — and add a `/playbook-setup` step that installs them. The target settings file (project `.claude/settings.json` for team-wide rules vs. `.claude/settings.local.json`) is an open design question for the research/plan phase.

### Acceptance Criteria

- [ ] The full set of permission rules the playbook's commands require is enumerated (`codex`, `claude -p`, `.claude/scripts/*.sh`, git, `gh`, etc.)
- [ ] `/playbook-setup` (`.claude/commands/playbook-setup.md`) gains a step that installs the required permission rules, merging with any existing rules rather than overwriting them
- [ ] The step is idempotent — re-running `/playbook-setup` does not duplicate rules
- [ ] A fresh playbook install can run the Codex/`claude -p` commands without hitting an auto-mode permission denial

### Notes

Surfaced 2026-05-20 during Task 10 (background-by-default migration) verification testing.

### Impacts

[Filled by `/issue-update` after a related issue completes.]

## #4 — Enable Codex web search (`--search`) on `/design` and `/codex-review`

**Status:** Draft
**Priority:** Medium
**Created:** 2026-05-22

### Description

Codex's `--search` (web search) and `--sandbox` (filesystem write access) are independent flags — a `--sandbox read-only` call can still search the web if `--search` is passed. Today only the research-oriented Codex calls enable it: `/research-codebase` (research-codebase.md:57), `/issue-research` (issue-research.md:47), and `/design`'s pattern-research pass (design.md:201).

Two `/design` Codex calls and the `/codex-review` call currently run without `--search`, which means they cannot verify claims against the open web:

- `/design` design review (design.md:89) — independent cross-check of the proposed design options.
- `/design` tiebreaker (design.md:141) — conditional pass that breaks a stalemate between options.
- `/codex-review` (codex-review.md:58) — ad-hoc review of a target file/doc/assumption.

Design decisions frequently hinge on external facts (does framework X support Y? is this API still current?), and the tiebreaker's whole job is resolving uncertainty — both benefit from being able to check online. For `/codex-review`, the motivating use case is having Codex review web research the developer already did, to confirm coverage is complete.

The fix adds `--search` to these three Codex invocations and updates each command's surrounding prose to reflect that web search is now available. The pattern-research pass (design.md:201) already has `--search` and needs no change.

### Acceptance Criteria

- [ ] `/design` design review Codex call (design.md:89) runs with `--search`
- [ ] `/design` tiebreaker Codex call (design.md:141) runs with `--search`
- [ ] `/codex-review` Codex call (codex-review.md:58) runs with `--search`
- [ ] Each affected command's prose is updated so the search-enabled behavior is documented (mirroring how research-codebase.md:89 notes `--search` was enabled)
- [ ] Plan/implement-phase Codex calls (`/create-plan`, `/issue-plan`, `/implement`, `/issue-implement`, `/implement-codex`) are left unchanged — they remain codebase-grounded with no web search

### Constraints

Do not touch the `--sandbox read-only` setting on any of these calls — `--search` is orthogonal to the sandbox and the read-only filesystem boundary must hold. Scope is limited to `/design` and `/codex-review`; do not add `--search` to the plan or implement phases.

### Relevant paths

- `.claude/commands/design.md` — lines 89, 141 (and 201 as the existing `--search` reference)
- `.claude/commands/codex-review.md` — line 58
- `.claude/commands/research-codebase.md` — line 57, existing `--search` pattern to mirror

### Notes

Surfaced 2026-05-22 in a conversation auditing whether playbook Codex invocations can do outside investigation.

### Impacts

[Filled by `/issue-update` after a related issue completes.]

## #5 — Tighten `codex-output-check.sh` validation (non-numeric arg, whitespace-only pass, stale comment)

**Status:** Draft
**Priority:** Medium
**Created:** 2026-05-22

### Description

`.claude/scripts/codex-output-check.sh` is the gate 9 skills use to verify Codex tmp output exists and "has substance" before reading it. Surfaced by a Tier A `/codex-review` pass during Task 7 verification: the script has three gaps.

1. **Non-numeric `min-lines` exits success.** Line 17 (`[ "$LINES" -lt "$MIN_LINES" ]`) doesn't validate that `MIN_LINES` is numeric. Running `bash .claude/scripts/codex-output-check.sh somefile abc` prints a bash `integer expression expected` error, then falls through and exits 0 with `OK`. A caller passing a typo gets a silent pass — the safety gate fails open.
2. **`wc -l` treats newlines as substance.** Line 16 (`LINES=$(wc -l < "$FILE")`) only counts newlines. A Codex response of 5 blank lines passes the default threshold. The script's stated purpose ("verify ... has substance") implies non-empty content, but the implementation accepts pure whitespace.
3. **Stale/inaccurate precedent comment.** Line 4 says `Default min-lines: 5 (matches pipeline-eval.sh:41-50 precedent for Codex outputs)`. `pipeline-eval.sh` actually uses 10-line log and 20-line artifact thresholds, not 5 — the cited precedent doesn't exist. Misleading documentation.

All three are pre-existing — none were introduced by Task 7. The Task 7 port deliberately left this shared script untouched ("no behavioral change" constraint). Logging here for a separate fix pass.

### Acceptance Criteria

- [ ] `bash .claude/scripts/codex-output-check.sh <file> <non-numeric>` exits non-zero with a clear error (no silent `OK`).
- [ ] A file containing only whitespace fails the gate at the default threshold (count non-empty / non-whitespace lines, not raw newlines).
- [ ] Line 4's precedent comment is either corrected to match `pipeline-eval.sh`'s actual thresholds, or dropped.
- [ ] All 9 callers still pass the gate on normal Codex output (no false negatives introduced).

### Relevant paths

- `.claude/scripts/codex-output-check.sh` — the script itself.
- `.claude/scripts/pipeline-eval.sh` — for verifying the precedent comment.
- Callers: any skill invoking `bash .claude/scripts/codex-output-check.sh` — `research-codebase`, `design`, `create-plan`, `implement`, `implement-codex`, `issue-research`, `issue-plan`, `issue-implement`, `codex-review` (9 total).

### Notes

Surfaced 2026-05-22 during Task 7 (skill port) Tier A verification. Codex pass against `codex-output-check.sh` as a trivial target.

### Impacts

[Filled by `/issue-update` after a related issue completes.]
