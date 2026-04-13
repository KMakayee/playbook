# Auto Issues

Run the full issue pipeline for issue **#$ARGUMENTS** end-to-end, unattended. Each phase runs as a separate `claude -p` invocation with fresh context. Artifacts on disk are the handoff between phases.

---

## Prerequisites

Before starting, verify issue #$ARGUMENTS exists in `tasks/issues.md`. If it doesn't exist, stop and tell the developer.

## Execution

Run each phase below sequentially via Bash. After each phase, verify the expected artifact exists before proceeding. If an artifact is missing, stop the pipeline and report which phase failed.

Log full output to `tasks/logs/` so the developer can review failures. Only bring the last few lines into this session to keep context lean.

**Setup:**

```bash
mkdir -p tasks/logs
TIMESTAMP=$(date +%Y%m%d-%H%M)
```

Use `$TIMESTAMP` in all log filenames below so re-runs don't overwrite previous logs.

### Phase 1: Research

**Run with `run_in_background` — Codex phase, may take 10+ minutes.**

```bash
claude -p "Read .claude/commands/issue-research-codex.md and follow its instructions exactly for issue #$ARGUMENTS. You are running non-interactively — do not ask questions, make reasonable choices and proceed." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-1-research-$TIMESTAMP.log 2>&1
```

**Check:** Verify `tasks/research-issue-$ARGUMENTS.md` exists. If missing, report failure and stop.

Report: "Phase 1 complete — research artifact written."

### Phase 2: Plan

**Timeout: 600000ms.**

```bash
claude -p "Read .claude/commands/issue-plan.md and follow its instructions exactly for issue #$ARGUMENTS. You are running non-interactively — do not ask questions or wait for approval. Make reasonable choices and proceed." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-2-plan-$TIMESTAMP.log 2>&1
```

**Check:** Verify `tasks/plan-issue-$ARGUMENTS.md` exists. If missing, report failure and stop.

Report: "Phase 2 complete — plan artifact written."

### Phase 3: Plan Review

**Run with `run_in_background` — Codex phase, may take 10+ minutes.**

```bash
claude -p "Read .claude/commands/issue-plan-review-codex.md and follow its instructions exactly for issue #$ARGUMENTS. You are running non-interactively — do not ask questions. Complete the review and append findings to tasks/plan-issue-$ARGUMENTS.md." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-3-review-$TIMESTAMP.log 2>&1
```

**Check:** Verify `tasks/plan-issue-$ARGUMENTS.md` contains a `## Review` section. If missing, report failure and stop.

Report: "Phase 3 complete — plan reviewed."

### Phase 4: Apply Review

**Timeout: 600000ms.**

```bash
claude -p "Read tasks/plan-issue-$ARGUMENTS.md and its ## Review section. Then:
1. Evaluate and apply: For each CORRECTION and TRADE-OFF, verify it against the codebase. Apply all necessary fixes to the plan.
2. Defer out-of-scope items: For any findings that are outside the scope of issue #$ARGUMENTS, append to tasks/deferred.md using the format from templates/deferred.md, grouped under issue #$ARGUMENTS.
3. Mark review as resolved: Change the ## Review heading to ## Review (Resolved).
4. Verify the plan: Re-read tasks/plan-issue-$ARGUMENTS.md and confirm all applied fixes are reflected, no orphaned stale references remain, and the plan is internally consistent.
You are running non-interactively — do not ask questions." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-4-apply-review-$TIMESTAMP.log 2>&1
```

**Check:** Verify `tasks/plan-issue-$ARGUMENTS.md` contains `## Review (Resolved)`. If missing, report failure and stop.

Report: "Phase 4 complete — review corrections applied, trade-offs deferred."

### Phase 5: Implement

**Run with `run_in_background` — implementation may take 10+ minutes.**

```bash
claude -p "Read .claude/commands/issue-implement.md and follow its instructions exactly for issue #$ARGUMENTS. You are running non-interactively — the plan is approved, proceed with implementation. Do not ask questions. If you hit a structural mismatch, adapt and continue." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-5-implement-$TIMESTAMP.log 2>&1
```

**Check:** Verify issue #$ARGUMENTS status is `Implemented` in `tasks/issues.md`. If not, check the log and report what happened.

Report: "Phase 5 complete — implementation done."

### Phase 6: Code Review

**Run with `run_in_background` — Codex phase, may take 10+ minutes.**

```bash
claude -p "Read .claude/commands/issue-code-review-codex.md and follow its instructions exactly for issue #$ARGUMENTS. You are running non-interactively — do not ask questions. Complete the review." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-6-code-review-$TIMESTAMP.log 2>&1
```

**Check:** Verify `tasks/codex-issue-code-review-$ARGUMENTS.tmp` exists. If missing, report failure and stop.

Report: "Phase 6 complete — code reviewed."

### Phase 7: Apply Code Review

**Run with `run_in_background` — may run end-to-end tests, can take 10+ minutes.**

```bash
claude -p "Read tasks/codex-issue-code-review-$ARGUMENTS.tmp (the code review findings) and tasks/plan-issue-$ARGUMENTS.md for context on issue #$ARGUMENTS. Then:
1. Evaluate findings: Apply all necessary fixes — bugs, missing acceptance criteria, and genuine simplification wins.
2. Run live tests if necessary: If the issue involves user-facing behavior, UI, API endpoints, or anything that unit tests alone cannot verify — run the application end-to-end to confirm the issue is actually solved. If the issue is purely internal (refactor, config, tooling), unit tests are sufficient.
3. Verify: Re-read issue #$ARGUMENTS from tasks/issues.md and confirm every acceptance criterion is met. Also confirm that each code review fix from step 1 was applied correctly.
4. Commit fixes: If changes were made, commit with a message like 'fix(#$ARGUMENTS): apply code review revisions'.
You are running non-interactively — do not ask questions." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-7-apply-code-review-$TIMESTAMP.log 2>&1
```

Report: "Phase 7 complete — code review revisions applied."

### Phase 8: Update

**Timeout: 600000ms.**

```bash
claude -p "Read .claude/commands/issue-update.md and follow its instructions exactly for issue #$ARGUMENTS. You are running non-interactively — do not ask questions." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-8-update-$TIMESTAMP.log 2>&1
```

**Check:** Verify issue #$ARGUMENTS status is `Done` in `tasks/issues.md`. If not, check the log and report what happened.

Report: "Phase 8 complete — related issues updated, issue marked Done."

### Phase 9: Commit & Push

**Timeout: 600000ms.**

```bash
claude -p "Read .claude/commands/commit.md and follow its instructions exactly. You are running non-interactively — do not ask questions. Stage all tracked changes and any new untracked files in tasks/. Draft a conventional commit message and commit. Push to the current branch." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-9-commit-$TIMESTAMP.log 2>&1
```

**Check:** Verify the working tree is clean (`git status` shows no uncommitted changes). If not, report what's left.

Report: "Phase 9 complete — committed and pushed."

### Phase 10: Evaluate

Integrity check — run directly in this session. These are mechanical file checks.

**Must run before cleanup so artifacts are still on disk.**

```bash
bash .claude/scripts/pipeline-eval.sh $ARGUMENTS $TIMESTAMP
```

Report: "Phase 10 complete — pipeline eval: [PASS/WARN/FAIL]." Include any flagged issues in the report.

### Phase 11: Cleanup

Delete the issue artifacts that are no longer needed:
- `tasks/research-issue-$ARGUMENTS.md`
- `tasks/plan-issue-$ARGUMENTS.md`
- `tasks/codex-issue-research-$ARGUMENTS.tmp`
- `tasks/codex-issue-plan-review-$ARGUMENTS.tmp`
- `tasks/codex-issue-code-review-$ARGUMENTS.tmp`

Do NOT delete:
- `tasks/issues.md` (the board)
- `tasks/deferred.md` (if it exists)
- `tasks/logs/` (keep for review)

After cleanup, commit with message: `chore: clean up issue #$ARGUMENTS artifacts`

Then push explicitly: `git push origin HEAD` (avoids "no upstream branch" errors on worktree branches where Phase 9's child process set tracking in a separate session).

## After All Phases

Report a final summary:
- **Pipeline eval verdict** (PASS / WARN / FAIL) and any flagged issues
- Any issues flagged during the update phase
- Final commit hash from `git log --oneline -1`

---

## Rules

- Run phases sequentially — each one must finish before the next starts.
- Do NOT read log file contents into this session unless a phase fails. The logs exist for the developer to review, not to fill this context.
- If a phase fails (artifact missing or error exit code), stop immediately. Report which phase failed and point to its log file.
- Each `claude -p` child process requires `--dangerously-skip-permissions` since it runs non-interactively. If the developer prefers, they can configure tool allowlists in `.claude/settings.json` instead.
- Keep this session's context minimal — short status reports between phases only.
- **Timestamp:** Compute the timestamp once at the start (`date +%Y%m%d-%H%M`) and substitute the literal value into all subsequent log filenames.
