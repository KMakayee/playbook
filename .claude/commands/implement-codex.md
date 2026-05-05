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

See §Phase loop below for the full per-phase contract. (Filled in by Phases 3 and 4 of the plan.)

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
