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
  rm -f tasks/codex-mismatch-*.tmp tasks/codex-blocked-*.tmp tasks/codex-implement-phase-*-prompt.tmp tasks/codex-implement-phase-*.tmp
  ```

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

1. The full contents of `.claude/prompts/implement-codex-phase-brief.md` (read with the Read tool, then write into the prompt tmp).
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
- `git status --porcelain` — modified-tracked + untracked + ignored files
- `git diff --name-only` — tracked-only diff against HEAD

These baselines are the "before" state. Step 4g computes "after − before" and filters out command-owned artifacts.

**Invoke Codex.** Run with `run_in_background: true` (the Bash tool's parameter — required by the design's cross-cutting constraint). Use a 30-minute timeout (1800000ms) for safety on larger phases:

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
     - `STATUS: mismatch` → treat as if mismatch signal were present → **MISMATCH** branch.
     - `STATUS: blocked` → treat as if blocked signal were present → **BLOCKED** branch.
     - STATUS line missing or unrecognized → **CRASHED** branch (output contract violated).

The MISMATCH / BLOCKED / CRASHED branches are documented in §4f.MISMATCH / §4f.BLOCKED / §4f.CRASHED below.

#### 4g. File enumeration cross-check (DONE path)

1. `bash .claude/scripts/codex-output-check.sh tasks/codex-implement-phase-{N}.tmp 5` — already run in 4f's STATUS check; the output schema is at least 5 lines (STATUS / FILES_MODIFIED / FILES_CREATED / SUMMARY / NOTES).
2. Read `tasks/codex-implement-phase-{N}.tmp` FULLY. Parse the `FILES_MODIFIED` and `FILES_CREATED` lists.
3. Run `git status --porcelain` and `git diff --name-only` (post-Codex state).
4. **Compute the "real diff" set** — files Codex actually changed = (post-state) minus (pre-Codex baseline from 4e), filtered to exclude command-owned artifacts:
   - `tasks/codex-implement-phase-*.tmp`
   - `tasks/codex-implement-phase-*-prompt.tmp`
   - `tasks/logs/codex-implement-phase-*.log`
   - `tasks/codex-mismatch-*.tmp`
   - `tasks/codex-blocked-*.tmp`
   - `tasks/codex-debug-*.tmp`
   - `tasks/implement-codex-metrics.md`

   The result is the authoritative "what Codex actually edited" set. This set is the input for 4j (diff-scope check) and 4n (commit staging).
5. **Cross-check.** Every file in `FILES_MODIFIED + FILES_CREATED` (Codex's claim) must appear in the real diff, AND every file in the real diff must appear in Codex's enumeration. Mismatches are findings — record in metrics (4m's Notes column) but do not auto-block.

#### 4h. JSON-log audit

(Filled in by Phase 4 of the plan.)

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
If tasks/plan.md flags itself as a multi-batch plan (per CLAUDE.md's \"Multi-Batch Plans\" section), inspect the prior batches' progress in plan.md (checked-off items) and the recent git log on this branch for cross-batch coherence. Evaluate whether this batch's changes contradict, duplicate, or undo prior batches' work. If the plan is single-batch, skip this section.

PART 1 — Plan adherence:
- Does the implementation match what the plan specified? Flag any deviations.
- Were any files changed that the plan didn't call for? (Note: \`tasks/plan.md\` may be updated during implementation — checkmarks, deviation notes — do not flag this as scope drift.)
- Are tests present and do they cover the acceptance criteria?

PART 2 — Independent code quality (evaluate on merit, regardless of what the plan says):
- Are there bugs, edge cases, or missing error handling?
- Can any of the code be simplified? Look for unnecessary abstractions, over-engineering, redundant logic, or verbose patterns that could be cleaner.
- Are established patterns and best practices being followed? Flag any anti-patterns, misused idioms, or places where a well-known pattern would be a better fit.
- Is the chosen approach the simplest one that solves the problem? If a simpler tool, pattern, or technique would work better than what the plan prescribed, flag it — the plan is not infallible.

For each finding, include: (a) the exact file path and line number(s); (b) a candidate minimal-fix sketch (raw input — Claude will triage; do not auto-apply); (c) a repro or failing-test command that demonstrates the issue, when applicable.
Prefix each finding with \`CORRECTION:\`, \`TRADE-OFF:\`, or \`RISK:\` per the RDPI taxonomy." </dev/null
```

The `-a never` flag is added per the design's cross-cutting constraint (every backgrounded `codex exec` runs with `-a never`). The prompt body itself is byte-for-byte identical to `/implement`'s — Option 4 = choice A on independence mitigation; no prelude, no findings injection, no model_reasoning_effort change.

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

If there are no fixes to apply (all findings were skipped or flagged), skip directly to Step 10.

**Severe-finding attribution.** When triaging severe Step 6 findings, identify which phase introduced the offending code (read `git log --oneline` since the plan started, then `git show <commit>` to confirm). Tag each severe finding with its source phase. After triage, update the corresponding metrics row's "Step 6 severe (Codex-attrib)" column in `tasks/implement-codex-metrics.md` from `pending` to the integer count of severe findings attributable to Codex's edits in that phase. Findings attributable to Claude's takeover edits (blocked-state) get `n/a` — they're not Codex-attributable.

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

Once verified and any issues fixed, commit with message: `fix: apply code review revisions`.

### 10. Clean up

Delete:
- `tasks/codex-implement-code-review.tmp`
- `tasks/code-review-fixes-implement.tmp`
- All `tasks/codex-debug-*.tmp` files (one per structural-mismatch Codex call, if any fired during phases)
- All `tasks/codex-implement-phase-*.tmp` files (per-phase Codex `-o` outputs)
- All `tasks/codex-implement-phase-*-prompt.tmp` files (per-phase composed briefs)
- All `tasks/codex-mismatch-*.tmp` and `tasks/codex-blocked-*.tmp` files (signals — already deleted on success but listed for safety after partial runs)

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
