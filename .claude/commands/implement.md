# Implement

Execute the approved plan phase-by-phase, then review and fix. Implementation stays in this session for full control. Codex review and fix application are offloaded to keep context quality high.

---

## Steps

### 1. Check prerequisites

- Verify `tasks/plan.md` exists. If not, stop — run `/create-plan` first.
- Verify the plan is finalized — it should not have unresolved blocking questions. If it does, stop and tell the developer the plan needs to be reviewed and finalized first.
- Verify `tasks/research-codebase.md` exists — it's needed for reference during implementation.

### 2. Read the plan fully

- Read `tasks/plan.md` FULLY — use the Read tool WITHOUT limit/offset parameters.
- Understand the design decision, phase structure, and success criteria.
- Read `tasks/research-codebase.md` and `tasks/design-decision.md` if you need additional context on specific files or patterns.

### 3. Check for resume

- Look for existing checkmarks (`- [x]`) in the plan's success criteria.
- If found, the plan was partially implemented in a prior session. Pick up from the first unchecked phase.
- Trust that completed phases are done — only re-verify if something seems off.

### 4. Execute phase-by-phase

For each phase in the plan:

a. **Read all files** mentioned in the phase before making changes. Use the Read tool WITHOUT limit/offset.

b. **Implement the changes** specified for this phase. Keep changes minimal — only modify what the plan specifies.

c. **Handle mismatches:**
   - **Minor** (function moved a few lines, variable renamed): adapt and continue.
   - **Structural** (module reorganized, interface changed, file deleted): STOP. Run a top-level Codex call to re-research the mismatch (replace `{phase}` with the current phase number, e.g. `tasks/codex-debug-3.tmp`):
     ```bash
     codex -c model_reasoning_effort=xhigh exec \
       --sandbox read-only \
       -o tasks/codex-debug-{phase}.tmp \
       "Re-research a structural mismatch encountered while implementing tasks/plan.md.

     The plan assumed: {brief description of the plan's premise}.
     What's actually present: {brief description of what the implementer found}.

     Inspect tasks/plan.md (the original premise) and tasks/research-codebase.md (the original sweep), then sweep the current code at the cited paths. Return: actual structure and locations, what the plan assumed, and a delta description Claude can use to update the plan. Be specific with file paths and line numbers.
     Effort calibration: scope to the specific mismatch — do not sweep beyond the cited files unless the mismatch implicates a wider refactor."
     ```
     Verify the output before reading: `bash .claude/scripts/codex-output-check.sh tasks/codex-debug-{phase}.tmp 5`. If the check fails, stop and tell the developer.

     Use a 10-minute timeout (600000ms). Read the output, adapt the plan, and continue. (Sub-agents are no longer used here — Codex sweeps faster on read-only structural questions, and the recursion guard at `CLAUDE.md:178` foreclosed Codex-from-inside-sub-agents anyway.)
   - **Plan premise invalidated** (the mechanism the plan specified doesn't actually work as described): document the deviation in `tasks/plan.md`, adapt while preserving the step's intent, and continue. If the deviation affects the design — not just the mechanism — STOP and revisit the plan.
   - **Tests fail after 2 fix attempts:** STOP and ask the developer for guidance.

d. **Run automated verification** — execute the automated success criteria listed in the plan for this phase.
   - **Failures in files your plan touched:** fix them before proceeding.
   - **Failures in files outside your plan's scope** (pre-existing lint/format drift, unrelated warnings): verify the scoped subset passes, do NOT fix — that's scope creep. Surface in Step 11's "Flagged for review".

e. **Check off completed items** — update the plan file to mark success criteria as done (`- [x]`).

f. **Commit the phase:**
   - Commit with a conventional message that describes what was done (e.g., `feat: add validation layer for user input`)
   - Each phase should be a separate commit so changes are reviewable
   - If you modified `tasks/plan.md` during the phase (checkmarks, deviation notes from 4c), include it in the phase's commit — the updates are part of the work record.

### 5. Post-implementation verification

After all phases are complete, run the full test/lint suite one final time to confirm everything works together. Apply the same scoping rule from Step 4d: failures in files your plan touched must be fixed; pre-existing drift in unrelated files gets noted for Step 11, not fixed.

### 6. Run Codex code review

**Run with `run_in_background` — Codex phase, may take 10+ minutes.**

```bash
codex -c model_reasoning_effort=xhigh exec \
  --sandbox read-only \
  -o tasks/codex-code-review.tmp \
  "Review the recent implementation against the plan in tasks/plan.md.

Effort calibration: light review for ≤50 LOC changed; standard review for 50–300 LOC; exhaustive review for >300 LOC or any change touching critical paths flagged in tasks/research-codebase.md.

PRELUDE — Cross-batch coherence (only if multi-batch):
If tasks/plan.md flags itself as a multi-batch plan (per CLAUDE.md's "Multi-Batch Plans" section), inspect the prior batches' progress in plan.md (checked-off items) and the recent git log on this branch for cross-batch coherence. Evaluate whether this batch's changes contradict, duplicate, or undo prior batches' work. If the plan is single-batch, skip this section.

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
Prefix each finding with `CORRECTION:`, `TRADE-OFF:`, or `RISK:` per the QRSPI taxonomy."
```

**Check:** After the backgrounded Codex process completes, verify the output: `bash .claude/scripts/codex-output-check.sh tasks/codex-code-review.tmp 10`. If the check fails, stop and tell the developer.

### 7. Triage findings

Read `tasks/codex-code-review.tmp` FULLY.

**Spot-check Codex's claims:**
- Verify a sample of file paths and line numbers Codex reported — do they exist and match?
- Discard any claims that don't hold up.

**Categorize each finding:**
- **Fix:** Bugs, missing error handling, genuine simplification wins, pattern violations — anything where the fix is clear and scoped.
- **Skip:** False positives, claims that didn't survive spot-checking, subjective style preferences.
- **Flag for developer:** Architectural concerns, changes that would alter behavior beyond the plan's intent, anything ambiguous.

**Write fix instructions** to `tasks/code-review-fixes.tmp` — a precise, actionable list for the child process:

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

### 8. Apply fixes via child process

**Run with `run_in_background` — may take a few minutes.**

Compute the timestamp inline — shell state doesn't persist between calls:

```bash
mkdir -p tasks/logs && TIMESTAMP=$(date +%Y%m%d-%H%M) && claude -p "Read tasks/code-review-fixes.tmp. Apply each fix listed under '## Code Review Fixes' exactly as described. For each fix:
1. Read the file FULLY before modifying it.
2. Apply the fix.
3. Run any relevant tests to confirm the fix doesn't break anything.
Do NOT commit — the parent session will verify and commit.
You are running non-interactively — do not ask questions." --dangerously-skip-permissions > tasks/logs/code-review-fixes-$TIMESTAMP.log 2>&1
```

### 9. Final verification

After the child process completes, verify that the code review fixes were applied correctly and that the full plan was implemented — all success criteria in `tasks/plan.md` should be met. Run the test/lint suite one final time, applying the same scoping rule from Step 4d (scoped failures must pass; inherited drift is noted, not fixed).

Once verified and any issues fixed, commit with message: `fix: apply code review revisions`.

### 10. Clean up

Delete:
- `tasks/codex-code-review.tmp`
- `tasks/code-review-fixes.tmp`
- Any `tasks/codex-debug-*.tmp` files (one per structural-mismatch Codex call, if any fired during phases)

### 11. Present results

Report with these sections:
- **Implemented:** Phases completed and commits made
- **Fixed:** What Codex found and the child process fixed (with file:line references)
- **Flagged for review:** Findings that need human judgment (with reasoning for why they were deferred). Include any repo-wide check failures outside your plan's scope (from Step 4d).
- **How to test:** Commands to run and manual steps to verify the implementation (e.g., test commands, endpoints to hit, UI flows to walk through)

---

## Important notes

- **Sub-agents are optional**: Use them sparingly for targeted debugging, never for broad exploration during implementation.
- **Triage is the key step.** The parent session decides *what* to fix. The child process decides *how*. Write precise fix instructions — vague instructions produce vague fixes.
- Codex reviews, Claude triages, child fixes. Not everything Codex flags needs fixing — use judgment. When in doubt, flag rather than fix.
- If `codex` or `claude` is not found or fails, stop and tell the developer to fix it before proceeding.
