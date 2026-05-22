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

## #4 — Tighten `codex-output-check.sh` validation (non-numeric arg, whitespace-only pass, stale comment)

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
