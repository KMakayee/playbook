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
- [ ] `/playbook-setup` (`.claude/skills/playbook-setup/SKILL.md`) gains a step that installs the required permission rules, merging with any existing rules rather than overwriting them
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

Codex's `--search` (web search) and `--sandbox` (filesystem write access) are independent flags — a `--sandbox read-only` call can still search the web if `--search` is passed. Today only the research-oriented Codex calls enable it: `/research-codebase` (`.claude/skills/research-codebase/SKILL.md:64`), `/issue-research` (`.claude/skills/issue-research/SKILL.md:54`), and `/design`'s pattern-research pass (`.claude/skills/design/SKILL.md:207`).

Two `/design` Codex calls and the `/codex-review` call currently run without `--search`, which means they cannot verify claims against the open web:

- `/design` design review (`.claude/skills/design/SKILL.md:95`) — independent cross-check of the proposed design options.
- `/design` tiebreaker (`.claude/skills/design/SKILL.md:147`) — conditional pass that breaks a stalemate between options.
- `/codex-review` (`.claude/skills/codex-review/SKILL.md:70`) — ad-hoc review of a target file/doc/assumption.

Design decisions frequently hinge on external facts (does framework X support Y? is this API still current?), and the tiebreaker's whole job is resolving uncertainty — both benefit from being able to check online. For `/codex-review`, the motivating use case is having Codex review web research the developer already did, to confirm coverage is complete.

The fix adds `--search` to these three Codex invocations and updates each skill's surrounding prose to reflect that web search is now available. The pattern-research pass (`.claude/skills/design/SKILL.md:207`) already has `--search` and needs no change.

### Acceptance Criteria

- [ ] `/design` design review Codex call (`.claude/skills/design/SKILL.md:95`) runs with `--search`
- [ ] `/design` tiebreaker Codex call (`.claude/skills/design/SKILL.md:147`) runs with `--search`
- [ ] `/codex-review` Codex call (`.claude/skills/codex-review/SKILL.md:70`) runs with `--search`
- [ ] Each affected skill's prose is updated so the search-enabled behavior is documented (mirroring how `.claude/skills/research-codebase/SKILL.md:96` notes `--search` was enabled)
- [ ] Plan/implement-phase Codex calls (`/create-plan`, `/issue-plan`, `/implement`, `/issue-implement`, `/implement-codex`) are left unchanged — they remain codebase-grounded with no web search

### Constraints

Do not touch the `--sandbox read-only` setting on any of these calls — `--search` is orthogonal to the sandbox and the read-only filesystem boundary must hold. Scope is limited to `/design` and `/codex-review`; do not add `--search` to the plan or implement phases.

### Relevant paths

- `.claude/skills/design/SKILL.md` — lines 95, 147 (and 207 as the existing `--search` reference)
- `.claude/skills/codex-review/SKILL.md` — line 70
- `.claude/skills/research-codebase/SKILL.md` — line 64, existing `--search` pattern to mirror

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
2. **`wc -l` treats newlines as substance.** Line 16 (`LINES=$(wc -l < "$FILE" | tr -d ' ')`) only counts newlines (the `tr -d ' '` just strips `wc`'s leading spaces from the count — it does not affect what's counted). A Codex response of 5 blank lines passes the default threshold. The script's stated purpose ("verify ... has substance") implies non-empty content, but the implementation accepts pure whitespace.
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

## #6 — `/codex-review` tmp files: orphaned on some paths + fixed names collide on concurrent runs

**Status:** Draft
**Priority:** Medium
**Created:** 2026-06-09

### Description

Two related defects in how `/codex-review` (`.claude/skills/codex-review/SKILL.md`) manages its two tmp files (`tasks/codex-review.tmp`, `tasks/codex-review-prompt.tmp`):

1. **Tmp files are not always cleaned up.** Cleanup is documented in Steps 3–5 (Codex-not-found, output-check fail, and the pre-present cleanup), but in practice files get stranded on some paths — likely the backgrounded Codex run (`run_in_background: true`) that the developer never returns to, or an interruption before Step 5 runs. Separately, there are legitimate times the output is worth *keeping* — but the current design has no deliberate keep path, so a kept finding is just an orphaned `.tmp`. If we want to keep findings, they should be promoted into a real named doc, not left as a stray temp. Decide the fix: guarantee cleanup on every exit path, AND add an explicit "promote findings to a named doc" option — not an accidental leftover either way.
2. **Fixed tmp names collide on concurrent runs.** Both tmp files use fixed names, so two `/codex-review` runs at once — two targets reviewed in parallel, or two worktrees sharing `tasks/` — clobber each other (one run reads the other's prompt/output, and Step 1's pre-delete can nuke an in-flight run's tmp). Needs per-run-unique names (PID / timestamp / target-hash suffix) so concurrent reviews don't corrupt each other.

Small, self-contained fix to the tmp-file lifecycle/naming — logged as an issue rather than a task.

### Acceptance Criteria

- [ ] Two `/codex-review` runs can execute concurrently without clobbering each other's tmp files (per-run-unique names; Step 1's stale-file pre-delete only targets the current run's files).
- [ ] tmp files are removed on every exit path (success, Codex-not-found, output-check failure, declined/ignored triage offer, backgrounded-then-abandoned run) — no orphaned `.tmp` left behind.
- [ ] When the output is worth keeping, there is a deliberate path to promote findings into a named doc, instead of relying on the leftover tmp.
- [ ] The no-persistent-artifact boundary the skill claims still holds.

### Constraints

- Keep the safe tmp-compose convention (write prompt to a tmp file, read via `"$(cat ...)"`) — only the naming/lifecycle changes, not the mechanism.
- Same fixed-name pattern recurs across the other Codex skills and the planned `/codex-audit` (task 19) — prefer a fix that generalizes over a one-off.

### Relevant paths

- `.claude/skills/codex-review/SKILL.md` — tmp compose (Step 2), invoke (Step 3), spot-check (Step 4), cleanup (Step 5).
- Sibling skills using the same fixed-name tmp pattern: `research-codebase`, `design`, `create-plan`, `implement`, `implement-codex` — check whether the concurrency collision is shared.
- Prior art for a keep/promote path: none yet — `~/Projects/Omakase/omk-core/.claude/commands/codex-source-audit.md` also relies on fixed-name tmps and deletes them.

### Notes

Logged 2026-06-09 from developer report: tmp files sometimes left behind; cannot run two codex-reviews simultaneously because the tmp files are always named the same.

### Impacts

[Filled by `/issue-update` after a related issue completes.]

## #7 — Apply Codex review fixes inline in `/implement` + `/implement-codex` — drop the `claude -p --dangerously-skip-permissions` child process

**Status:** Draft
**Priority:** Medium
**Created:** 2026-06-09

### Description

Step 8 ("Apply fixes via child process") of both `/implement` and `/implement-codex` applies the triaged Codex code-review fixes by spawning a backgrounded child Claude:

- `.claude/skills/implement/SKILL.md:150-155` — `claude -p "Read tasks/code-review-fixes.tmp. Apply each fix ..." --dangerously-skip-permissions </dev/null > tasks/logs/... 2>&1`
- `.claude/skills/implement-codex/SKILL.md:447-453` — same pattern against `tasks/code-review-fixes-implement.tmp`.

Two problems with this design:

1. **`--dangerously-skip-permissions` is a blanket bypass.** The child runs unsandboxed with every permission gate disabled and no human in the loop. It's only there because the child is headless (`-p` + `</dev/null`) and would otherwise hang on a prompt — i.e. the flag is a workaround for the child-process pattern, not a real requirement.
2. **The child process is the wrong tool for this step.** The parent session already holds full context — the plan it executed, the code it just wrote, and the findings it already verified during triage. A fresh child re-reads the fix-instruction tmp and the target files cold, losing all of that. Applying the fixes inline in the parent is both safer (no permission bypass) and higher quality (the edits happen where the context already lives).

Direction: apply the triaged review fixes **inline in the parent session** and remove the child-process invocation and the `--dangerously-skip-permissions` flag from both skills. The Fix/Skip/Flag triage and finding spot-checks stay; only the application mechanism changes. `/issue-implement` has no such child process and needs no change.

Knock-on edits in both skills:
- **Step 7** (write fix instructions to `tasks/code-review-fixes.tmp` / `tasks/code-review-fixes-implement.tmp`) — the parent no longer needs to serialize instructions to hand off to a child. Decide whether the tmp survives as a triage scratchpad/record or is dropped entirely.
- **Step 9** ("After the child process completes, verify ...") — reword to the inline flow; parent still verifies, runs the test/lint suite, and commits `fix: apply code review revisions`.
- **Step 10 / cleanup** — adjust the tmp-file cleanup list if Step 7's tmp changes.
- **`/implement-codex` only:** the Step 7 severe-finding attribution + `tasks/implement-codex-metrics.md` update (`.claude/skills/implement-codex/SKILL.md:437`) and Step 9's two commit shapes must be preserved exactly.

### Acceptance Criteria

- [ ] Neither `/implement` nor `/implement-codex` spawns a `claude -p` (or other background child) to apply code-review fixes.
- [ ] `--dangerously-skip-permissions` no longer appears in `.claude/skills/implement/SKILL.md` or `.claude/skills/implement-codex/SKILL.md`.
- [ ] Triaged Codex review fixes are applied inline by the parent session, preserving the Fix / Skip / Flag-for-developer categorization and the finding spot-checks.
- [ ] Every step that referenced the child process (Step 8 invocation, Step 9 "after the child process completes", Step 7 fix-instruction tmp, Step 10 cleanup) is reworded to match the inline flow with no dangling references.
- [ ] `/implement-codex`'s severe-finding attribution and `tasks/implement-codex-metrics.md` update still run, and both Step 9 commit shapes (fixes-applied vs. metrics-only) still hold.
- [ ] Parent verify/commit behavior is unchanged — test/lint run, commit message `fix: apply code review revisions`.
- [ ] `/issue-implement` is confirmed unaffected (no child-process step to change).

### Constraints

- Keep the Fix/Skip/Flag-for-developer triage and the verified-finding spot-checking — only the application mechanism (child process → inline) changes.
- Parent still owns the commit; do not change commit messages.
- Preserve `/implement-codex`'s metrics/attribution logic verbatim.

### Relevant paths

- `.claude/skills/implement/SKILL.md` — Step 7 (fix tmp, ~line 125), Step 8 (child process + flag, lines 150–155), Step 9 (verify), Step 10 (cleanup).
- `.claude/skills/implement-codex/SKILL.md` — Step 7 (fix tmp + severe attribution, lines 421/437), Step 8 (child process + flag, lines 447–453), Step 9 (verify/commit), Step 10 (cleanup).
- `.claude/skills/issue-implement/SKILL.md` — confirm no child-process step; expected no change.

### Notes

Logged 2026-06-09 from developer review of the `--dangerously-skip-permissions` usage: developer objects to both the permission bypass and to using a child process for a step where the parent already has the relevant context. Investigation confirmed the flag appears only in these two Step 8 child-process calls (all other matches are `.claude/worktrees/` snapshots); `/issue-implement` does not use it.

### Impacts

[Filled by `/issue-update` after a related issue completes.] Related to #3 (enumerating `claude -p` permission needs) — removing these two child calls shrinks but does not eliminate #3's scope, since `/auto-issues` Phase 4 still uses a `claude -p` child.

## #8 — Promote three `tasks/todo.md` patterns into the `/create-todo` skill

**Status:** Draft
**Priority:** Low
**Created:** 2026-06-10

### Description

The current `tasks/todo.md` (a standing backlog, not a single-design decomposition) carries three structural patterns that the `/create-todo` skill (`.claude/skills/create-todo/SKILL.md`) does not emit, and that are genuinely better than what the skill produces today. They were surfaced while auditing whether the todo aligns with the skill. The skill should be updated to emit them so future generated todos start at the same quality bar.

The three patterns:

1. **Four-field intake per task** — each backlog task carries Intent / Constraints / Acceptance criteria / Relevant paths. This is exactly the intake `CLAUDE.md` requires before a non-trivial task enters Research; the skill today emits only "bold title + brief description + checkbox" (`create-todo/SKILL.md:65`), pushing intake capture downstream to `/research-codebase` Step 2.5. Emitting the four fields per task means each task arrives at RDPI already intake-complete.

2. **Per-task open questions + a non-blocking-preflight note** — the skill puts open questions in one top-level section (`create-todo/SKILL.md:63`) and never reconciles them with `/research-codebase`'s readiness preflight, which stops on unresolved open questions. The todo's "Note for RDPI" header note (`tasks/todo.md:21`) declares per-task open-questions accepted-and-deferred so they don't trip that gate. The skill should attach open questions per-task and emit the reconciling note.

3. **A "Design notes for RDPI to review (not pre-committed)" block per task** — a place to park pre-RDPI candidate directions without binding them, richer than the skill's "surface, don't solve" (`create-todo/SKILL.md:49`).

### Acceptance Criteria

- [ ] `/create-todo` emits the four-field intake (Intent / Constraints / Acceptance criteria / Relevant paths) per task, not just a brief description.
- [ ] `/create-todo` attaches open questions per-task and emits the non-blocking-preflight reconciliation note (mirroring `tasks/todo.md:21`), instead of (or in addition to) a single top-level open-questions section.
- [ ] `/create-todo` supports an optional per-task "Design notes for RDPI to review (not pre-committed)" block.
- [ ] The abstraction-discipline guardrail (`create-todo/SKILL.md:35-40`) is preserved and, where needed, strengthened: Relevant paths may carry file:line; **Acceptance criteria stay at the outcome/capability level and must not encode an implementation sequence or mechanism** that RDPI's design phase should own.
- [ ] The temporary note at the top of `tasks/todo.md` (the "remove when issue #8 closes" block pointing here) is deleted as part of landing this.

### Constraints

- This is an enrichment of the artifact the skill emits, not a reshaping of the existing `tasks/todo.md` — the current backlog is hand-curated and stays as-is.
- The four new fields raise the floor on generated tasks; do not let them become a license to do design/plan work inside the todo (see the last acceptance criterion).

### Relevant paths

- `.claude/skills/create-todo/SKILL.md` — Step 4 (abstraction discipline, `:35-40`), Step 6 (open questions, `:47-50`), Step 8 (artifact structure, `:57-69`).
- `tasks/todo.md` — the exemplar (the "Note for RDPI" header note `:21`; tasks 13–21 as four-field-intake examples).
- `CLAUDE.md` — four-field intake requirement (RDPI Workflow Rules → Pre-Edit Gate).

### Notes

Surfaced 2026-06-10 while checking whether `tasks/todo.md` aligns with `/create-todo`. The structural mismatches (no Source line, no design-doc title, no top-level Out-of-Scope) are deliberate — the todo is a standing backlog, not a one-shot decomposition — and are not in scope. Only the three quality patterns above are worth promoting.

### Impacts

[Filled by `/issue-update` after a related issue completes.]
