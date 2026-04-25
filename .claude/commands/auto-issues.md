# Auto Issues

Run the full issue pipeline for issue **#$ARGUMENTS** end-to-end, unattended. Each phase runs as a separate `claude -p` invocation with fresh context. Artifacts on disk are the handoff between phases.

---

## Prerequisites

Before starting:
- Verify issue #$ARGUMENTS exists in `tasks/issues.md`. If it doesn't exist, stop and tell the developer.
- Verify NONE of the following leftover artifacts exist (the integrated commands hard-stop if they do, which would cause a silent skip): `tasks/research-issue-$ARGUMENTS.md`, `tasks/plan-issue-$ARGUMENTS.md`, `tasks/codex-issue-prompt-$ARGUMENTS.tmp`, `tasks/codex-issue-research-$ARGUMENTS.tmp`, `tasks/codex-issue-plan-review-$ARGUMENTS.tmp`, `tasks/codex-issue-code-review-$ARGUMENTS.tmp`, `tasks/code-review-fixes-issue-$ARGUMENTS.tmp`. If any exist, stop and tell the developer to remove them (or rename) before re-running.

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
claude -p "Read .claude/commands/issue-research.md and follow its instructions exactly for issue #$ARGUMENTS. You are running non-interactively — do not ask questions, make reasonable choices and proceed." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-1-research-$TIMESTAMP.log 2>&1
```

**Check:** Verify `tasks/research-issue-$ARGUMENTS.md` exists AND issue #$ARGUMENTS status is `In Research` in `tasks/issues.md`. If either fails, report failure and stop.

Report: "Phase 1 complete — research artifact written."

### Phase 2: Plan

**Run with `run_in_background` — Codex phase, may take 10+ minutes.**

```bash
claude -p "Read .claude/commands/issue-plan.md and follow its instructions exactly for issue #$ARGUMENTS. You are running non-interactively — do not ask questions or wait for approval. Make reasonable choices and proceed." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-2-plan-$TIMESTAMP.log 2>&1
```

**Check:** Verify `tasks/plan-issue-$ARGUMENTS.md` exists AND issue #$ARGUMENTS status is `In Review` in `tasks/issues.md`. If either fails, report failure and stop.

Report: "Phase 2 complete — plan artifact written."

### Phase 3: Implement

**Run with `run_in_background` — implementation may take 10+ minutes.**

```bash
claude -p "Read .claude/commands/issue-implement.md and follow its instructions exactly for issue #$ARGUMENTS. You are running non-interactively — the plan is approved, proceed with implementation. Do not ask questions. If you hit a structural mismatch, follow .claude/commands/issue-implement.md's structural-mismatch handling exactly (Step 4c)." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-3-implement-$TIMESTAMP.log 2>&1
```

**Check:** Verify issue #$ARGUMENTS status is `Implemented` in `tasks/issues.md`. If not, check the log and report what happened.

Report: "Phase 3 complete — implementation done, code reviewed, fixes applied."

### Phase 4: Update

**Timeout: 600000ms.**

```bash
claude -p "Read .claude/commands/issue-update.md and follow its instructions exactly for issue #$ARGUMENTS. You are running non-interactively — do not ask questions." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-4-update-$TIMESTAMP.log 2>&1
```

**Check:** Verify issue #$ARGUMENTS status is `Done` in `tasks/issues.md`. If not, check the log and report what happened.

Report: "Phase 4 complete — related issues updated, issue marked Done."

### Phase 5: Commit & Push

**Timeout: 600000ms.**

```bash
claude -p "Read .claude/commands/commit.md and follow its instructions exactly. You are running non-interactively — do not ask questions. Stage all tracked changes and any new untracked files in tasks/. Draft a conventional commit message and commit. Push to the current branch." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-5-commit-$TIMESTAMP.log 2>&1
```

**Check:** Verify the working tree is clean (`git status` shows no uncommitted changes). If not, report what's left.

Report: "Phase 5 complete — committed and pushed."

### Phase 6: Evaluate

Integrity check — run directly in this session. These are mechanical file checks.

**Must run before cleanup so artifacts are still on disk.**

```bash
bash .claude/scripts/pipeline-eval.sh $ARGUMENTS $TIMESTAMP
```

Report: "Phase 6 complete — pipeline eval: [PASS/WARN/FAIL]." Include any flagged issues in the report.

### Phase 7: Cleanup

Delete the issue artifacts that are no longer needed:

```bash
rm -f tasks/research-issue-$ARGUMENTS.md
rm -f tasks/plan-issue-$ARGUMENTS.md
# Defensive — integrated commands clean these in normal exit, but interrupted runs leave them behind
rm -f tasks/codex-issue-prompt-$ARGUMENTS.tmp
rm -f tasks/codex-issue-research-$ARGUMENTS.tmp
rm -f tasks/codex-issue-plan-review-$ARGUMENTS.tmp
rm -f tasks/codex-issue-code-review-$ARGUMENTS.tmp
rm -f tasks/code-review-fixes-issue-$ARGUMENTS.tmp
rm -f tasks/codex-debug-issue-$ARGUMENTS-*.tmp
```

Do NOT delete:
- `tasks/issues.md` (the board)
- `tasks/deferred.md` (if it exists)
- `tasks/logs/` (keep for review)

After cleanup, commit with message: `chore: clean up issue #$ARGUMENTS artifacts`

Then push explicitly: `git push origin HEAD` (avoids "no upstream branch" errors on worktree branches where Phase 5's child process set tracking in a separate session).

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
