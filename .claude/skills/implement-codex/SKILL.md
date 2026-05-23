---
name: implement-codex
description: Experimental — Codex writes code phase-by-phase under sandbox; Claude verifies each phase.
disable-model-invocation: true
---

# Implement (Codex)

Experimental sibling of `/implement`. Codex writes the code phase-by-phase under `--sandbox workspace-write`; Claude verifies each phase (plan adherence + diff scope + cross-phase coherence + automated success criteria); Steps 6-8 (Codex review + Claude triage + child fix application) reuse `/implement`'s shape unchanged in semantics, with renamed artifact paths.

**Experimental status.** This command is experimental. `/implement` is the production path. Promotion criteria are tracked in `tasks/implement-codex-metrics.md`. Until promotion, prefer `/implement` for any phase that needs network access (install, fetch) or that touches critical paths flagged in `tasks/research-codebase.md`.

**Known experimental cost — final-review independence is weakened.** The Step 6 Codex review now reviews Codex-written code (same agent family — distinct sessions and stateless invocations, but shared training distribution). Per-phase Claude verify is the partial compensation. Whether this is sufficient is a measurable hypothesis the experiment must answer; do not paper over it by injecting Claude's per-phase findings into Step 6.

---

## Steps

### 1. Check prerequisites

- Verify `tasks/plan.md` exists. If not, stop — run `/create-plan` first.
- Verify the plan is finalized — it should not have unresolved blocking questions. If it does, stop and tell the developer the plan needs to be reviewed and finalized first.
- Verify `tasks/research-codebase.md` exists — it's needed for reference during implementation.
- Verify `codex` is on PATH: `command -v codex >/dev/null`. If not, stop and tell the developer to install Codex CLI before proceeding.

### 2. Read the plan fully

- Read `tasks/plan.md` FULLY — use the Read tool WITHOUT limit/offset parameters.
- Understand the design decision, phase structure, and success criteria.
- Read `tasks/research-codebase.md` and `tasks/design-decision.md` if you need additional context on specific files or patterns.

### 3. Check for resume

- Look for existing checkmarks (`- [x]`) in the plan's success criteria.
- If found, the plan was partially implemented in a prior session. Pick up from the first unchecked phase.
- Trust that completed phases are done — only re-verify if something seems off.
- **Pre-delete signal tmps for ALL phases at session start** — a leftover `tasks/codex-mismatch-{N}.tmp` from a prior aborted run could poison the state check on a clean retry:

  ```bash
  find tasks -maxdepth 1 \( \
    -name 'codex-mismatch-*.tmp' -o \
    -name 'codex-blocked-*.tmp' -o \
    -name 'codex-implement-phase-*-prompt.tmp' -o \
    -name 'codex-implement-phase-*.tmp' \
  \) -delete
  ```

  `find -delete` (not `rm -f <glob>`) so an empty glob doesn't abort the chain under zsh's default `NOMATCH` behavior.

  Do NOT delete `tasks/codex-debug-*.tmp` here — those are produced by structural-mismatch re-research and are cleaned in Step 10.

### 4. Execute phase-by-phase

For each unchecked phase N in `tasks/plan.md`, run the per-phase loop below. ATTEMPT is a per-phase counter initialized to 1 at the **start of each phase** (not inside Step 4e — re-entry from a MISMATCH retry or a partial-recoverable retry must NOT reset it).

```
For each unchecked phase N:
  ATTEMPT=1
  → 4a (read plan-cited files)
  → 4b (pre-flight network check; hard-stop if matched)
  → 4c (compose phase brief tmp)
  → 4d (pre-delete signal tmps for phase N)
  → 4e (capture baseline + invoke Codex)
  → 4f (state check — branches to DONE / MISMATCH / BLOCKED / CRASHED)

  DONE path → 4g, 4h, 4i, 4j, 4k, 4l, 4m, 4n → next phase
  MISMATCH retry → ATTEMPT++; goto 4c
  Partial-recoverable retry → ATTEMPT++; goto 4c (with resume-brief addendum)
  BLOCKED → Claude takeover (no ATTEMPT bump) → 4l, 4m, 4n → next phase
  CRASHED → diagnosis (effectively-done | partial-recoverable | ambiguous)
```

ATTEMPT cap is 2 per phase across MISMATCH and partial-recoverable retries combined. Second failure escalates to the developer.

#### 4a. Read plan-cited files

Identify the file paths cited in phase N's plan section. Read each FULLY (no limit/offset) using the Read tool. Hold them in conversation context for verification later.

#### 4b. Pre-flight network check

**Hard-stop on detection.** Network is disabled in the default `workspace-write` sandbox; the design puts network-required phases out-of-scope. Grep phase N's plan content for tokens implying network: `npm install`, `pip install`, `yarn add`, `cargo add`, `gem install`, `go get`, `curl`, `wget`, `fetch`, `requests.get`. If any match, **stop the entire `/implement-codex` invocation** with this message:

> Phase {N} appears to need network access ('{matched-token}' detected). The default `workspace-write` sandbox has network disabled. Run `/implement` instead for this batch, or remove the network step from the plan.

Do not prompt for confirmation — the design's hard-stop posture trumps developer override at the per-invocation level. False positives cost one developer plan re-read; false proceed costs a wasted Codex invocation.

#### 4c. Compose the phase brief

Write `tasks/codex-implement-phase-{N}-prompt.tmp` using the Write tool (not a shell heredoc). Contents:

1. The full contents of `${CLAUDE_SKILL_DIR}/implement-codex-phase-brief.md` (read with the Read tool, then write into the prompt tmp).
2. A filled `## Variable Slots` section appended at the end:

   ```markdown
   ## Variable Slots

   Phase number: {N}
   Plan excerpt: tasks/plan.md lines {start}-{end} (read these before editing)
   File allow-list:
   - path/a
   - path/b
   Success criteria (informational; Claude will run these — do NOT execute them):
   - command 1
   - command 2
   ```

Phase number, plan-line range, file allow-list, and success criteria are derived from the phase N section of `tasks/plan.md`.

#### 4d. Pre-delete signal tmps for phase N

```bash
rm -f tasks/codex-mismatch-{N}.tmp tasks/codex-blocked-{N}.tmp
```

This guards against leftover signals from a prior aborted attempt at the same phase. Step 3 catches the cross-phase case; this catches the same-phase retry case.

#### 4e. Capture baseline + invoke Codex

**Capture pre-Codex baseline** so post-Codex enumeration in 4g is a delta, not an absolute. Snapshot in conversation context (no persistent file):
- `git status --porcelain --ignored` — modified-tracked + untracked + ignored files (the `--ignored` flag is required so a file Codex creates that matches a `.gitignore` pattern is captured rather than silently excluded from the real-diff computation)
- `git diff --name-only` — tracked-only diff against HEAD

These baselines are the "before" state. Step 4g computes "after − before" and filters out command-owned artifacts.

**Invoke Codex.** Run with `run_in_background: true` (the Bash tool's parameter — required by the design's cross-cutting constraint):

```bash
mkdir -p tasks/logs && \
TIMESTAMP=$(date +%Y%m%d-%H%M%S) && \
codex -c model_reasoning_effort=xhigh -a never exec \
  --sandbox workspace-write \
  --json \
  -o tasks/codex-implement-phase-{N}.tmp \
  "$(cat tasks/codex-implement-phase-{N}-prompt.tmp)" \
  </dev/null \
  > tasks/logs/codex-implement-phase-{N}-${TIMESTAMP}-attempt${ATTEMPT}.log 2>&1
```

`ATTEMPT` is read from the outer per-phase loop variable — Step 4e does NOT initialize it.

`-a never` is required (background mode cannot answer interactive prompts). `--json` enables the event log used by 4h and the crash diagnosis. `--sandbox workspace-write` is the writable sandbox (`.git`, `.agents`, `.codex` remain read-only). `</dev/null` is the Issue #2 discipline.

#### 4f. State check (branches to DONE / MISMATCH / BLOCKED / CRASHED)

**Order matters** — see `tasks/design-decision.md:33-38`. After Codex returns:

1. **Ambiguous-signal first (always wins):**
   - Both `tasks/codex-mismatch-{N}.tmp` AND `tasks/codex-blocked-{N}.tmp` present → **CRASHED** (see Phase 4 branches).
   - Either signal file present AND zero-bytes → **CRASHED**.

2. **Only mismatch signal present (non-empty)** → **MISMATCH** branch (Phase 4).

3. **Only blocked signal present (non-empty)** → **BLOCKED** branch (Phase 4).

4. **Both signals absent** → run `bash .claude/scripts/codex-output-check.sh tasks/codex-implement-phase-{N}.tmp 5`:
   - Check fails → **CRASHED** branch (Phase 4).
   - Check passes → read the `STATUS:` line from the `-o` tmp:
     - `STATUS: done` → **DONE** path (continue with 4g).
     - `STATUS: mismatch` → if `tasks/codex-mismatch-{N}.tmp` exists and is non-empty, route to **MISMATCH** branch; else **CRASHED** branch (output contract violated — STATUS claims mismatch but no signal file was written).
     - `STATUS: blocked` → if `tasks/codex-blocked-{N}.tmp` exists and is non-empty, route to **BLOCKED** branch; else **CRASHED** branch (output contract violated — STATUS claims blocked but no signal file was written).
     - STATUS line missing or unrecognized → **CRASHED** branch (output contract violated).

The MISMATCH / BLOCKED / CRASHED branches are documented in §4f.MISMATCH / §4f.BLOCKED / §4f.CRASHED below.

#### 4g. File enumeration cross-check (DONE path)

1. `bash .claude/scripts/codex-output-check.sh tasks/codex-implement-phase-{N}.tmp 5` — already run in 4f's STATUS check; the output schema is at least 5 lines (STATUS / FILES_MODIFIED / FILES_CREATED / SUMMARY / NOTES).
2. Read `tasks/codex-implement-phase-{N}.tmp` FULLY. Parse the `FILES_MODIFIED` and `FILES_CREATED` lists.
3. Run `git status --porcelain --ignored` and `git diff --name-only` (post-Codex state). The `--ignored` flag must match the baseline form from 4e — otherwise an ignored-pattern file Codex created would slip through the path-set subtraction.
4. **Compute the "real diff" set** — files Codex actually changed = (post-state) minus (pre-Codex baseline from 4e), filtered to exclude command-owned artifacts:
   - `tasks/codex-implement-phase-*.tmp`
   - `tasks/codex-implement-phase-*-prompt.tmp`
   - `tasks/logs/codex-implement-phase-*.log`
   - `tasks/codex-mismatch-*.tmp`
   - `tasks/codex-blocked-*.tmp`
   - `tasks/codex-debug-*.tmp`
   - `tasks/implement-codex-metrics.md`

   The result is the authoritative "what Codex actually edited" set. This set is the input for 4j (diff-scope check) and 4n (commit staging).

   **Known limitation:** the subtraction is path-set based, so a file that was already dirty in the pre-Codex baseline AND further modified by Codex will not be detected by the path subtraction alone (the path is in both sets, so it cancels out). The JSON-event log audit (4h) and Codex's `FILES_MODIFIED` enumeration (4g item 5) provide the secondary signals for that case.
5. **Cross-check.** Every file in `FILES_MODIFIED + FILES_CREATED` (Codex's claim) must appear in the real diff, AND every file in the real diff must appear in Codex's enumeration. Mismatches are findings — record in metrics (4m's Notes column) but do not auto-block.

#### 4h. JSON-log audit (parseability + test-execution violations)

After every DONE-path completion (whether direct or via crash-recovery), audit the phase's JSON event log.

**Audit 1 — parseability** (per `tasks/design-decision.md:32`):

The log's first line is a non-JSON `Reading additional input from stdin...` notice (Codex emits it when stdin is piped via `</dev/null`). Filter to JSON-only lines before parseability checking. The audit must reject both unparseable lines AND a log with no JSON content at all (a bare `grep '^{' <log> | jq -c .` exits 0 on empty input, silently passing logs that have zero JSON events):

```bash
tmp_json=$(mktemp)
grep -h '^{' tasks/logs/codex-implement-phase-{N}-*-attempt*.log > "$tmp_json"
test -s "$tmp_json" && jq -c . "$tmp_json" > /dev/null
```

`-h` suppresses the per-file filename prefix when the glob matches multiple attempt logs (otherwise `<filename>:` is prepended to each line and breaks `jq`). `test -s` rejects an empty filtered output (no JSON lines = parseability finding).

If the audit fails, log a parseability finding in metrics Notes (`json-log-unparseable`). Do not block — the textual log is still inspectable for the test-execution audit. (`jq` is a standard developer-environment tool; if absent, fall back to `python3 -c "import json,sys; lines=[l for l in open('<log>') if l.startswith('{')]; assert lines; [json.loads(l) for l in lines]"` or skip the check with a metrics note.)

**Audit 2 — test-execution violations** (per `tasks/design-decision.md:31` test-ownership rule):

The Codex JSON event schema for shell commands is `{"type":"item.started","item":{"type":"command_execution","command":"/bin/zsh -lc ..."}}` (verified empirically in Phase 5 dry-run). Grep matches `command_execution` events whose command contains a test/lint/build runner:

```bash
grep -E '"type":"command_execution".*(npm (run )?test|pnpm( run)? test|yarn (run )?test|bun test|pytest|python -m pytest|cargo test|jest|vitest|tsc|eslint|prettier|ruff|mypy|go test|make test|make check)' tasks/logs/codex-implement-phase-{N}-*-attempt*.log
```

If any match, Codex ran a verification command despite the brief. Record `Test-violation: yes` in metrics; add a note identifying the offending command. **Do not block the commit** — the violation already happened; the metrics gate (zero violations in last 5 runs per `tasks/design-decision.md:193`) tracks recurrence.

If no match, `Test-violation: no`.

The audit grep pattern is best-effort and matches the schema observed at the time `/implement-codex` was authored. If Codex CLI ships a schema change, refine the pattern against the offending log.

#### 4i. Run plan-specified success criteria

Execute the automated success-criteria commands the plan specifies for phase N. Apply the standard scoping rule (`/implement` Step 4d, mirrored): failures in plan-touched files block the phase; pre-existing drift in unrelated files is noted for Step 11.

If success criteria fail and the failure is in plan-touched files, attempt up to 2 in-session patches (mirroring `/implement` Step 4c "Tests fail after 2 fix attempts" rule). On the third failure, stop and ask the developer.

Patch lines applied here count toward the metrics row's `Claude patch (lines)` column (4m).

#### 4j. Diff-scope check

For each file in the real-diff set (from 4g item 4):
- Is it in phase N's plan-cited file list?
- **Yes** → in scope.
- **No** → out-of-scope edit. Classify:
  - **Minor and on-pattern** (e.g., a one-line import update in a sibling file required by the phase's edit): patch in-session if needed, log as "scope drift caught (minor)" in metrics, continue.
  - **Structural or large** (a refactor, an unrelated file, a deleted file): **STOP and escalate to the developer.** Do NOT auto-route to MISMATCH — MISMATCH assumes Codex made no source edits (the pre-edit stop contract), but post-diff structural drift means Codex did edit, so the working tree is dirty. Auto-routing would contaminate the retry. Report to the developer: list the bulldozed files, the diff, and the plan-cited file list. The developer decides whether to revert (`git checkout -- <files>`), patch in-session, or drop the phase.

#### 4k. Cross-phase coherence check

Read `git log --oneline` for commits on the current branch since the plan started (use the first phase's commit as the baseline if known; otherwise read since the branch diverged from `main`). Read the diff of the last 1-2 prior phases. Check:

- Does this phase's edit pattern match prior phases' patterns? (e.g., consistent error-handling style, naming conventions established earlier)
- Cumulative scope drift: are total changed files trending past what the plan implied?
- Plan coverage: does this phase build on the prior phases as the plan intended, or has it skipped or duplicated something?

If a coherence concern is significant, halt and ask the developer rather than auto-patching — coherence violations are subjective by nature.

#### 4l. Update plan checkmarks

Mark phase N's success-criteria items as `- [x]` in `tasks/plan.md`. Include `tasks/plan.md` in the phase's commit (4n).

#### 4m. Append metrics line

If `tasks/implement-codex-metrics.md` does not exist, create it with this header:

```markdown
# /implement-codex experiment metrics

One row per phase. Used to compute promotion criteria — see `tasks/design-decision.md` § Open Questions for thresholds.

| Date | Run | Phase | State | Codex LOC | Files written | Claude patch (lines) | Drift caught | Test-violation | Step 6 severe (Codex-attrib) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

Then append one row for this phase. Field semantics:
- **Date:** `$(date +%Y-%m-%d)`.
- **Run:** the `TIMESTAMP` from 4e (matches the phase log filename).
- **Phase:** N.
- **State:** `done` | `mismatch` | `blocked` | `crashed`.
- **Codex LOC:** lines Codex wrote in this phase, computed from the real-diff set (4g item 4) using `git diff --shortstat` summed across the real-diff source files (or 0 for `mismatch`/`blocked` states where Codex didn't edit). Active-work numerator for the design's "≥25% Claude active-work reduction" gate.
- **Files written:** count of distinct files in the real-diff set. Use this, not Codex's `FILES_MODIFIED + FILES_CREATED` count — the real diff is authoritative.
- **Claude patch (lines):** total lines Claude modified in this phase post-Codex (in-session patches from 4i, plus blocked-state takeover from §4f.BLOCKED). 0 if Codex landed clean and Claude didn't patch.
- **Drift caught:** `yes` (out-of-scope file caught — minor patched, structural escalated) | `no`.
- **Test-violation:** `yes` (4h's JSON-log audit found Codex ran a test/lint/build command despite the brief) | `no`.
- **Step 6 severe (Codex-attrib):** `pending` at row-write time. Step 7 retroactively updates this column to the integer count of severe Step 6 findings whose offending code came from Codex's edits in this phase. Findings attributable to Claude's takeover (blocked-state) get `n/a`.
- **Notes:** one short string — anything noteworthy (e.g., "minor patch: import reorder in sibling file"; "crash-recovered (effectively-done)"; or Codex's mismatch/blocked summary truncated to 80 chars).

#### 4n. Commit the phase

Stage explicitly — never `git add -A` or `git add .` (those would sweep up command-owned tmp/log artifacts):

```bash
# Source files: every path in the "real diff" set from 4g item 4
git add <real-diff source files>
# Plan + metrics (always):
git add tasks/plan.md tasks/implement-codex-metrics.md
git commit -m "<conventional message describing this phase>"
```

Use the same conventional-commit style as `/implement` Step 4f. Include `tasks/plan.md` (checkmarks updated) and `tasks/implement-codex-metrics.md` (new metrics row). **Do not stage** `tasks/codex-implement-phase-*.tmp`, `tasks/codex-implement-phase-*-prompt.tmp`, `tasks/logs/codex-implement-phase-*.log`, signal tmps, or debug tmps — these are command-owned and either cleaned in Step 10 or kept untracked per the open log-retention question.

#### 4f.MISMATCH branch

**Trigger:** state classified as MISMATCH per 4f's order — `tasks/codex-mismatch-{N}.tmp` is present and non-empty (either reached via the "only mismatch signal present" rule, or via the STATUS=mismatch path which also requires the signal file to exist; STATUS=mismatch without the signal file routes to CRASHED).

**Pre-retry sanity check.** The MISMATCH branch assumes Codex made no source edits (the pre-edit stop contract). Before proceeding, compute the real diff (4g item 4) — files Codex touched, filtered to exclude command-owned artifacts. If the real diff is non-empty, **STOP and escalate to the developer** with the file list — do not auto-retry, the working tree is dirty.

Sub-flow (real diff is empty — pre-edit stop contract held):

1. Read `tasks/codex-mismatch-{N}.tmp` FULLY. Expect (a) what the plan assumed, (b) what Codex found, (c) file:line evidence, (d) the smallest delta needed.
2. Append a metrics row (4m) with State=`mismatch`, Codex LOC=0, Files written=0, Claude patch lines=0, Drift caught=`no`, Test-violation=`no`, Step 6 severe (Codex-attrib)=`pending`, Notes=Codex's mismatch summary truncated to 80 chars.
3. Run a top-level Codex re-research, mirroring `/implement` Step 4c (read-only) but adding `-a never` per the cross-cutting constraint:

   ```bash
   codex -c model_reasoning_effort=xhigh -a never exec \
     --sandbox read-only \
     -o tasks/codex-debug-{N}.tmp \
     "Re-research a structural mismatch encountered while implementing tasks/plan.md.

   The plan assumed: {brief description of the plan's premise}.
   What's actually present: {brief description of what Codex found}.

   Inspect tasks/plan.md (the original premise) and tasks/research-codebase.md (the original sweep), then sweep the current code at the cited paths. Return: actual structure and locations, what the plan assumed, and a delta description Claude can use to update the plan. Be specific with file paths and line numbers.
   Effort calibration: scope to the specific mismatch — do not sweep beyond the cited files unless the mismatch implicates a wider refactor." </dev/null
   ```

   Run with `run_in_background: true`. Verify: `bash .claude/scripts/codex-output-check.sh tasks/codex-debug-{N}.tmp 5`. If the check fails, stop and tell the developer.

4. Read `tasks/codex-debug-{N}.tmp`; update `tasks/plan.md` to reflect the actual structure (the plan's premise was wrong, not Codex's edit).
5. Delete the mismatch signal: `rm -f tasks/codex-mismatch-{N}.tmp`.
6. Increment the outer-loop `ATTEMPT` (cap = 2 across MISMATCH and partial-recoverable retries combined) and **retry the phase from 4c** (recompose the brief — the file_allow_list and plan_lines may have changed).
7. If the retry also returns `mismatch`, stop and report to the developer. Do not auto-restore the working tree.

#### 4f.BLOCKED branch

**Trigger:** state classified as BLOCKED per 4f's order — `tasks/codex-blocked-{N}.tmp` is present and non-empty (either reached via the "only blocked signal present" rule, or via the STATUS=blocked path which also requires the signal file to exist; STATUS=blocked without the signal file routes to CRASHED).

**Pre-takeover sanity check.** Codex's blocked contract says "exit without making source edits." Compute the real diff (4g item 4); if non-empty, escalate to the developer (working tree is dirty, partial Codex edits compromise Claude's clean takeover).

Sub-flow (real diff is empty):

1. Read `tasks/codex-blocked-{N}.tmp` FULLY.
2. Append a metrics row (4m) with State=`blocked`, Codex LOC=0, Files written=0, Claude patch lines=`<placeholder, updated below>`, Drift caught=`no`, Test-violation=`no`, Step 6 severe (Codex-attrib)=`n/a` (no Codex code), Notes=Codex's blocked summary truncated to 80 chars.
3. **Claude takes over the phase.** Use normal Edit/Write tools to apply the surgical edits the plan specified, exactly as `/implement` Step 4 would handle the phase. Run the success criteria. Mark plan checkmarks. Commit (using 4n's explicit-add discipline).
4. After commit, update the metrics row in-place: Claude patch lines = `git diff --shortstat HEAD~1` line count for the takeover commit.
5. Delete the blocked signal: `rm -f tasks/codex-blocked-{N}.tmp`.
6. **Do NOT retry Codex on this phase.** Blocked = "Codex hit a wall, hand back to Claude" — the phase is finished by Claude, not retried under Codex. ATTEMPT does NOT increment.

#### 4f.CRASHED branch

**Trigger:** state classified as CRASHED per 4f's order — output-check fail AND no signal tmps; OR both signal tmps present; OR any signal file zero-bytes; OR `-o` STATUS line missing or unrecognized.

Sub-flow — three diagnosis steps before involving the developer:

**Diagnosis step 1 — Read the JSON event log.**
- Path: the most recent `tasks/logs/codex-implement-phase-{N}-*-attempt{ATTEMPT}.log` (the file 4e wrote).
- Verify non-empty: `test -s tasks/logs/codex-implement-phase-{N}-*-attempt{ATTEMPT}.log`.
- **Parseability check** (per `tasks/design-decision.md:32`): each JSON line should be parseable when `--json` is enabled. Filter to JSON-only lines first (the log's first line is a `Reading additional input from stdin...` notice from Codex when stdin is piped) and also reject a log with zero JSON content: `tmp_json=$(mktemp); grep -h '^{' <log-file> > "$tmp_json"; test -s "$tmp_json" && jq -c . "$tmp_json" > /dev/null 2>&1`. The `-h` flag suppresses the `<filename>:` prefix when the glob matches multiple attempt logs; `test -s` rejects an empty filtered output. If the check fails, record a parseability finding in metrics Notes (`json-log-unparseable`) but do not block — the textual content is still inspectable.
- If empty (process died before any event): record as `crashed` ambiguous, escalate.
- Otherwise, read the last ~50 lines (`tail -n 50`) to identify Codex's last action. Look for `tool_use` events (file edits) and any `error` events.

**Diagnosis step 2 — Read git state.**
- `git status --porcelain` — captures both modified-tracked and untracked files.
- `git diff` — full content, not `--name-only` (semantic content matters).
- Enumerate untracked AND ignored files explicitly with `git ls-files --others` (no `--exclude-standard` — ignored files matter; Codex may have created a file matching a `.gitignore` pattern that would otherwise be invisible). Also run `git ls-files --others --exclude-standard` separately to distinguish "untracked-not-ignored" from "untracked-but-ignored."

**Diagnosis step 3 — Classify into one of three sub-states:**

- **(a) Effectively done** — all plan-cited files are in the diff, edits look coherent (compared against the plan), AND Claude-run success criteria pass.
  - **Action:** treat as DONE. Run 4g onwards (using the post-Codex git state as the "real diff" input — the baseline subtraction still works). Commit with a message noting "Codex crashed post-edits but pre-summary; verified manually."
  - **Metrics row:** State=`done` (the work is done); Notes=`crash-recovered (effectively-done)`.

- **(b) Partial but recoverable** — log shows Codex got partway through the file list before dying (transient: network blip, model timeout); OR success criteria fail with a coherent partial diff.
  - **Action:** retry with a *resume brief*. Increment ATTEMPT (outer-loop variable) to 2 — cap is 2 (one retry total per phase across mismatch + partial-recoverable; if ATTEMPT is already 2, escalate to (c)). The resume brief is the same template + slot block, with an additional appended note: "Files X, Y already edited and look correct based on the prior attempt. Please complete Z only."
  - Re-run 4e (now ATTEMPT=2; the log filename suffix updates accordingly).
  - If the retry also crashes, escalate to (c).
  - **Metrics rows:** original attempt → State=`crashed`, Notes=`partial-recoverable, attempt 1`. Retry on success → State=`done`, Notes=`crash-recovered (resumed, attempt 2)`.

- **(c) Ambiguous or repeated crash** — diff doesn't match the plan cleanly; untracked/ignored files don't fit the phase scope; both signal tmps present; or this is the second crash on the same phase (ATTEMPT == 2).
  - **Action:** STOP. Report to the developer with: log excerpt (last 50 lines), `git status --porcelain` output, summary of the diff, untracked+ignored file list, and one paragraph of Claude's diagnosis. **No auto-restore of the working tree** — the developer decides whether to roll back, patch, or drop the phase.
  - **Metrics row:** State=`crashed`, Notes=`ambiguous` or `repeated`.

### 5. Post-implementation verification

After all phases are complete, run the full test/lint suite one final time to confirm everything works together. Apply the same scoping rule from Step 4d: failures in files your plan touched must be fixed; pre-existing drift in unrelated files gets noted for Step 11, not fixed.

### 6. Run Codex code review

**Run with `run_in_background` — Codex phase, may take 10+ minutes.**

```bash
codex -c model_reasoning_effort=xhigh -a never exec \
  --sandbox read-only \
  -o tasks/codex-implement-code-review.tmp \
  "Review the recent implementation against the plan in tasks/plan.md.

Effort calibration: light review for ≤50 LOC changed; standard review for 50–300 LOC; exhaustive review for >300 LOC or any change touching critical paths flagged in tasks/research-codebase.md.

PRELUDE — Cross-batch coherence (only if multi-batch):
If tasks/plan.md flags itself as a multi-batch plan (per CLAUDE.md's "Multi-Batch Plans" section), inspect the prior batches' progress in plan.md (checked-off items) and the recent git log on this branch for cross-batch coherence. Evaluate whether this batch's changes contradict, duplicate, or undo prior batches' work. If the plan is single-batch, skip this section.

PART 1 — Plan adherence:
- Does the implementation match what the plan specified? Flag any deviations.
- Were any files changed that the plan didn't call for? (Note: \`tasks/plan.md\` may be updated during implementation — checkmarks, deviation notes — do not flag this as scope drift.)
- Are tests present and do they cover the acceptance criteria?

In-flight scope: this review fires after phase commits but before final cleanup. Do not flag (a) the presence of command-owned tmp artifacts under \`tasks/\` matching \`codex-implement-phase-*.tmp\`, \`codex-implement-phase-*-prompt.tmp\`, \`codex-mismatch-*.tmp\`, \`codex-blocked-*.tmp\`, \`codex-debug-*.tmp\`, or \`codex-implement-code-review.tmp\` — these are cleaned by Step 10 after this review runs; or (b) plan acceptance criteria that explicitly depend on Step 10 cleanup. Treat such observations as expected mid-flow state, not findings.

PART 2 — Independent code quality (evaluate on merit, regardless of what the plan says):
- Are there bugs, edge cases, or missing error handling?
- Can any of the code be simplified? Look for unnecessary abstractions, over-engineering, redundant logic, or verbose patterns that could be cleaner.
- Are established patterns and best practices being followed? Flag any anti-patterns, misused idioms, or places where a well-known pattern would be a better fit.
- Is the chosen approach the simplest one that solves the problem? If a simpler tool, pattern, or technique would work better than what the plan prescribed, flag it — the plan is not infallible.

For each finding, include: (a) the exact file path and line number(s); (b) a candidate minimal-fix sketch (raw input — Claude will triage; do not auto-apply); (c) a repro or failing-test command that demonstrates the issue, when applicable.
Prefix each finding with `CORRECTION:`, `TRADE-OFF:`, or `RISK:` per the RDPI taxonomy." </dev/null
```

The `-a never` flag is added per the design's cross-cutting constraint (every backgrounded `codex exec` runs with `-a never`). The prompt body mirrors `/implement`'s — Option 4 = choice A on independence mitigation; no prelude, no findings injection, no model_reasoning_effort change. The one targeted divergence is the "In-flight scope" paragraph in PART 1, which scopes the reviewer past command-owned tmp artifacts that the review observes mid-flow before Step 10 cleanup runs (`/implement` has no equivalent mid-flow artifact pattern, so this paragraph would be dead weight there).

**Check:** After the backgrounded Codex process completes, verify the output: `bash .claude/scripts/codex-output-check.sh tasks/codex-implement-code-review.tmp 10`. If the check fails, stop and tell the developer.

### 7. Triage findings

Read `tasks/codex-implement-code-review.tmp` FULLY.

**Spot-check Codex's claims:**
- Verify a sample of file paths and line numbers Codex reported — do they exist and match?
- Discard any claims that don't hold up.

**Categorize each finding:**
- **Fix:** Bugs, missing error handling, genuine simplification wins, pattern violations — anything where the fix is clear and scoped.
- **Skip:** False positives, claims that didn't survive spot-checking, subjective style preferences.
- **Flag for developer:** Architectural concerns, changes that would alter behavior beyond the plan's intent, anything ambiguous.

**Write fix instructions** to `tasks/code-review-fixes-implement.tmp` — a precise, actionable list for the child process:

```markdown
## Code Review Fixes

### Fix 1: [Short description]
- **File:** path/to/file.ext:line
- **Issue:** What Codex found (verified)
- **Fix:** Exactly what to change

### Fix 2: ...

## Flagged for Developer
- [Finding] — [Why it was deferred]
```

**Severe-finding attribution.** When triaging severe Step 6 findings, identify which phase introduced the offending code (read `git log --oneline` since the plan started, then `git show <commit>` to confirm). Tag each severe finding with its source phase. After triage, update the corresponding metrics row's "Step 6 severe (Codex-attrib)" column in `tasks/implement-codex-metrics.md` from `pending` to the integer count of severe findings attributable to Codex's edits in that phase. Findings attributable to Claude's takeover edits (blocked-state) get `n/a` — they're not Codex-attributable. **This attribution must run regardless of how findings were triaged** — runs with only-flagged or only-skipped findings still need the metrics column resolved from `pending`.

If there are no fixes to apply (all findings were skipped or flagged), skip Step 8 (no child process to run) and proceed to Step 9 — the severe-finding attribution above may have modified `tasks/implement-codex-metrics.md`, and Step 9's no-fixes branch handles that metrics-only commit before Step 10.

### 8. Apply fixes via child process

**Run with `run_in_background` — may take a few minutes.**

Compute the timestamp inline — shell state doesn't persist between calls:

```bash
mkdir -p tasks/logs && TIMESTAMP=$(date +%Y%m%d-%H%M) && claude -p "Read tasks/code-review-fixes-implement.tmp. Apply each fix listed under '## Code Review Fixes' exactly as described. For each fix:
1. Read the file FULLY before modifying it.
2. Apply the fix.
3. Run any relevant tests to confirm the fix doesn't break anything.
Do NOT commit — the parent session will verify and commit.
You are running non-interactively — do not ask questions." --dangerously-skip-permissions </dev/null > tasks/logs/code-review-fixes-implement-$TIMESTAMP.log 2>&1
```

### 9. Final verification

After the child process completes, verify that the code review fixes were applied correctly and that the full plan was implemented — all success criteria in `tasks/plan.md` should be met. Run the test/lint suite one final time, applying the same scoping rule from Step 4d (scoped failures must pass; inherited drift is noted, not fixed).

Once verified and any issues fixed, commit. Two commit shapes:

- **Fixes were applied** (the child process from Step 8 ran and produced source-file changes): stage the fixed source files alongside `tasks/implement-codex-metrics.md` (so the Step 7 severe-attribution update folds into the same commit) and commit with message `fix: apply code review revisions`.
- **No fixes were applied** (Step 7's no-fixes branch took us straight here, but Step 7's severe-attribution may still have modified `tasks/implement-codex-metrics.md`): if `tasks/implement-codex-metrics.md` is the only modified file, commit it alone with message `chore(implement-codex): update Step 6 severe-finding attribution`. If nothing was modified, skip the commit and proceed to Step 10.

### 10. Clean up

Delete the per-run tmps. Use `find -delete` (not `rm -f <glob>`) so empty globs don't abort the chain under zsh's default `NOMATCH` behavior:

```bash
rm -f tasks/codex-implement-code-review.tmp tasks/code-review-fixes-implement.tmp
find tasks -maxdepth 1 \( \
  -name 'codex-debug-*.tmp' -o \
  -name 'codex-implement-phase-*.tmp' -o \
  -name 'codex-implement-phase-*-prompt.tmp' -o \
  -name 'codex-mismatch-*.tmp' -o \
  -name 'codex-blocked-*.tmp' \
\) -delete
```

What this covers:
- `tasks/codex-implement-code-review.tmp` (Step 6 output) and `tasks/code-review-fixes-implement.tmp` (Step 7 fix instructions) — fixed names, safe with `rm -f`.
- `tasks/codex-debug-*.tmp` (one per structural-mismatch Codex call, if any fired during phases).
- `tasks/codex-implement-phase-*.tmp` (per-phase Codex `-o` outputs) and `tasks/codex-implement-phase-*-prompt.tmp` (per-phase composed briefs).
- `tasks/codex-mismatch-*.tmp` and `tasks/codex-blocked-*.tmp` (signals — already deleted on success but covered for safety after partial runs).

**Do NOT delete:**
- `tasks/implement-codex-metrics.md` (persistent — promotion evidence).
- `tasks/logs/codex-implement-phase-*.log` (per the design's open question on log retention — kept until the first promotion review).

### 11. Present results

Report with these sections:
- **Implemented:** Phases completed and commits made
- **Fixed:** What Codex found and the child process fixed (with file:line references)
- **Flagged for review:** Findings that need human judgment (with reasoning for why they were deferred). Include any repo-wide check failures outside your plan's scope (from Step 4d).
- **How to test:** Commands to run and manual steps to verify the implementation (e.g., test commands, endpoints to hit, UI flows to walk through)
- **Experiment metrics:** One-paragraph summary derived from the rows appended to `tasks/implement-codex-metrics.md` this run: total phases, clean-pass count, mismatch count, blocked count, crashed/retried count, observed Claude rewrite ratio, prompt-contract violations (test-execution findings from JSON-log audit). Cross-link to `tasks/implement-codex-metrics.md` for the full table.

---

## Important notes

- **Triage is the key step.** The parent session decides *what* to fix. The child process decides *how*. Write precise fix instructions — vague instructions produce vague fixes.
- Codex reviews, Claude triages, child fixes. Not everything Codex flags needs fixing — use judgment. When in doubt, flag rather than fix.
- If `codex` or `claude` is not found or fails, stop and tell the developer to fix it before proceeding.
