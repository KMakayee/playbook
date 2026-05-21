# Auto Issues

Run the full issue pipeline for one issue end-to-end, unattended, **inside a dedicated
`worktree-issue-<N>` worktree**. Each phase runs as a separate `claude -p` invocation with
fresh context; artifacts on disk are the handoff between phases.

This command does **not** create the worktree — it assumes the developer has already set up
a `worktree-issue-<N>` worktree and is running from inside it. The issue number `N` is
derived from the branch name, so no argument is needed.

---

## Resolve the issue number

Before anything else, detect the current branch:

```bash
git rev-parse --abbrev-ref HEAD
```

If the branch matches `worktree-issue-<N>` (e.g., `worktree-issue-7`), derive `N` from it.
If the branch does **not** match that pattern, stop and tell the developer to run
`/auto-issues` from inside the issue's dedicated `worktree-issue-<N>` worktree.

Use the derived `N` everywhere below in place of the literal `N`.

## Prerequisites

Before starting:
- Verify issue #N exists in `tasks/issues.md`. If it doesn't exist, stop and tell the developer.
- Verify NONE of the following leftover artifacts exist (the integrated commands hard-stop if they do, which would cause a silent skip): `tasks/research-issue-N.md`, `tasks/plan-issue-N.md`, `tasks/codex-issue-prompt-N.tmp`, `tasks/codex-issue-research-N.tmp`, `tasks/codex-issue-plan-review-N.tmp`, `tasks/codex-issue-code-review-N.tmp`, `tasks/code-review-fixes-issue-N.tmp`. If any exist, stop and tell the developer to remove them (or rename) before re-running.

## Execution

Run each phase below sequentially via Bash. If a phase fails, stop the pipeline and report which phase failed.

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
claude -p "Read .claude/commands/issue-research.md and follow its instructions exactly for issue #N. You are running non-interactively — do not ask questions, make reasonable choices and proceed." --permission-mode auto </dev/null > tasks/logs/auto-issue-N-1-research-$TIMESTAMP.log 2>&1
```

**Check:** `test -f tasks/research-issue-N.md` — if it is missing, report Phase 1 failed and stop.

Report: "Phase 1 complete — research artifact written."

### Phase 2: Plan

**Run with `run_in_background` — Codex phase, may take 10+ minutes.**

```bash
claude -p "Read .claude/commands/issue-plan.md and follow its instructions exactly for issue #N. You are running non-interactively — do not ask questions or wait for approval. Make reasonable choices and proceed." --permission-mode auto </dev/null > tasks/logs/auto-issue-N-2-plan-$TIMESTAMP.log 2>&1
```

**Check:** `test -f tasks/plan-issue-N.md` — if it is missing, report Phase 2 failed and stop.

Report: "Phase 2 complete — plan artifact written."

### Phase 3: Implement

**Run with `run_in_background` — implementation may take 10+ minutes.**

```bash
claude -p "Read .claude/commands/issue-implement.md and follow its instructions exactly for issue #N. You are running non-interactively — the plan is approved, proceed with implementation. Do not ask questions. If you hit a structural mismatch, follow .claude/commands/issue-implement.md's structural-mismatch handling exactly (Step 4c)." --permission-mode auto </dev/null > tasks/logs/auto-issue-N-3-implement-$TIMESTAMP.log 2>&1
```

**Check:** Verify issue #N status is `Implemented` in `tasks/issues.md`. If not, check the log and report what happened.

Report: "Phase 3 complete — implementation done, code reviewed, fixes applied."

### Phase 4: Update

**Run with `run_in_background: true` — this is a Bash-tool parameter (set it when you call the Bash tool), not shell syntax. May take 10+ minutes.**

```bash
claude -p "Read .claude/commands/issue-update.md and follow its instructions exactly for issue #N. You are running non-interactively — do not ask questions." --permission-mode auto </dev/null > tasks/logs/auto-issue-N-4-update-$TIMESTAMP.log 2>&1
```

**Check:** Verify issue #N status is `Done` in `tasks/issues.md`. If not, check the log and report what happened.

Report: "Phase 4 complete — related issues updated, issue marked Done."

### Phase 5: Commit & Push

Run **inline in this orchestrator session** — no `claude -p` child, no Phase 5 log. The
orchestrator session holds full permissions; the child phases above run at `claude -p`
nesting depth 1, so the commit cannot be delegated to a further child.

Phases 1-4 leave the working tree **uncommitted**. This phase produces the single commit
for the whole `/auto-issues` run. Spell every command out — do not say "commit" without
naming exactly what to stage:

1. `git add -u` — stage tracked modifications + deletions (covers `tasks/issues.md` status
   edits, plan-file checkmarks, etc.).
2. Compute the real-diff source set: run `git status --porcelain --untracked-files=all`.
   From its output, exclude command-owned `tasks/*.tmp` files and anything under
   `tasks/logs/`. `git add` each remaining path **explicitly** — never stage with the
   all-files form (`git add` with the `-A` flag) and never `git add .`. This discovers
   agent-created source files robustly, independent of plan accuracy.
3. Explicitly `git add tasks/research-issue-N.md tasks/plan-issue-N.md` (the Pattern A
   artifacts) if they exist.
4. Show `git diff --staged`, then draft a conventional commit message referencing issue #N
   (`feat(#N): <subject>` / `fix(#N): <subject>`). `git commit` with that message.
5. Push: `git push -u origin HEAD` — the worktree branch's first push sets upstream
   tracking.

**Check:** Verify the working tree is clean (`git status` shows no uncommitted changes).
If not, report what's left.

Report: "Phase 5 complete — committed and pushed."

### Phase 6: Evaluate

Integrity check — run directly in this session. These are mechanical file checks.

```bash
bash .claude/scripts/pipeline-eval.sh N $TIMESTAMP
```

Report: "Phase 6 complete — pipeline eval: [PASS/WARN/FAIL]." Include any flagged issues in the report.

(The eval index now lives at `tasks/pipeline-eval-index.md`. Phase 6 runs after Phase 5's
commit, so the index update is left uncommitted — `/issue-finish` Step 3 absorbs it.)

## After All Phases

Report a final summary:
- **Pipeline eval verdict** (PASS / WARN / FAIL) and any flagged issues
- Any issues flagged during the update phase
- Final commit hash from `git log --oneline -1`

Then hand off: "Run `/issue-finish` (then `/catchup` if behind, then `/push-pr` or
`/push-pr-light`) from this worktree to clean up the issue artifacts and open the PR."

---

## Rules

- Run phases sequentially — each one must finish before the next starts.
- Do NOT read log file contents into this session unless a phase fails. The logs exist for the developer to review, not to fill this context.
- If a phase fails (artifact missing or error exit code), stop immediately. Report which phase failed and point to its log file.
- Each `claude -p` child process runs with `--permission-mode auto` (non-interactive). This caps `claude -p` nesting at depth 1 — the child phases must not spawn further `claude -p` children, and the Phase 5 commit therefore runs inline in this orchestrator session rather than as a delegated child. If the developer prefers, they can configure tool allowlists in `.claude/settings.json` instead.
- Keep this session's context minimal — short status reports between phases only.
- **Timestamp:** Compute the timestamp once at the start (`date +%Y%m%d-%H%M`) and substitute the literal value into all subsequent log filenames.
