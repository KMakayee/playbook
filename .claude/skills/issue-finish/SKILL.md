---
name: issue-finish
description: Wrap up an issue — commit remaining work and clean up the issue artifacts.
argument-hint: '[issue-number]'
disable-model-invocation: true
---

# Issue Finish

Wrap up issue #N: commit any remaining issue work, then clean up the issue artifacts.

Takes an optional `$ARGUMENTS` (issue number) used to override the issue number
derived from the branch.

```!
git status
git diff
```

## Steps:

1. **Resolve the issue number, then verify it is Done:**
   - Detect the current branch with `git rev-parse --abbrev-ref HEAD`. If it matches
     `worktree-issue-<N>` (e.g., `worktree-issue-7`), derive `N` from the branch name.
   - If `$ARGUMENTS` is non-empty, it **overrides** the derived `N`. This is the
     off-worktree / regular-branch case — there is no "first unchecked issue" fallback,
     so an explicit `N` is required when the branch is not a `worktree-issue-<N>` branch.
   - If the branch is a `worktree-issue-<M>` branch but `$ARGUMENTS` names a different
     `N`, warn about the mismatch and proceed with the `$ARGUMENTS` value.
   - If neither the branch nor `$ARGUMENTS` yields an `N`, **stop** and tell the
     developer to re-invoke `/issue-finish` with an issue number.
   - Locate issue `#N` in `tasks/issues.md`. **Hard-stop unless its status is `Done`** —
     `/issue-finish` only wraps up completed issues. (`Done` is set by `/issue-update`.)

2. **Finalize commit — commit + push any remaining work:**
   - Run `git status --porcelain` to see whether the working tree has uncommitted work.
   - **Treat `tasks/pipeline-eval-index.md` as NOT "remaining work"** for this decision.
     On the `/auto-issues` path, Phase 6 appends to that index *after* Phase 5's commit,
     so the index is the only dirty path at `/issue-finish` time — committing+pushing it
     as standalone work would be wrong. The index belongs to Step 3's cleanup commit.
   - **If the working tree is clean, or the only dirty path is `tasks/pipeline-eval-index.md`**
     (the `/auto-issues` path — Phase 5 already committed + pushed the real work):
     skip to Step 3.
   - **If there is real uncommitted work** (the standalone path — the developer ran
     `/issue-implement` directly, so the whole issue is uncommitted): stage and commit it:
     - `git add -u` — stage tracked modifications + deletions.
     - Compute the real-diff source set: run `git status --porcelain --untracked-files=all`,
       and from its output exclude command-owned `tasks/*.tmp` files and anything under
       `tasks/logs/`. `git add` each remaining path **explicitly** — never stage with
       the all-files form (`git add` with the `-A` flag) and never `git add .`.
     - Explicitly `git add tasks/research-issue-N.md tasks/plan-issue-N.md` (the Pattern A
       artifacts) if they exist.
     - Show `git diff --staged` so you have the full picture.
     - Draft a conventional commit message referencing the issue
       (`feat(#N): <subject>` or `fix(#N): <subject>`). Keep the subject under 72 chars.
     - `git commit` with that message.
     - Push: if the branch has no upstream tracking branch, `git push -u origin HEAD`;
       if upstream tracking already exists, a plain `git push`.

3. **Cleanup commit — local, no push:**
   - After Step 2, `git rm` whichever issue artifacts exist:
     `tasks/research-issue-N.md`, `tasks/plan-issue-N.md`.
   - If `git status --porcelain -- tasks/pipeline-eval-index.md` prints any line (the
     index shows as modified, or — on the first-ever run — untracked; `/auto-issues`
     Phase 6 writes it after Phase 5's commit), `git add tasks/pipeline-eval-index.md`
     into this same commit.
   - Defensively `rm -f` any leftover temp files (untracked — not committed):
     `tasks/codex-issue-prompt-N.tmp`, `tasks/codex-issue-research-N.tmp`,
     `tasks/codex-issue-plan-review-N.tmp`, `tasks/codex-issue-code-review-N.tmp`,
     `tasks/code-review-fixes-issue-N.tmp`, `tasks/codex-debug-issue-N-*.tmp`.
   - Commit the staged deletions + index update with message
     `chore: clean up issue #N artifacts`.
   - **Do not push this commit.** It rides on the next push (`/push-pr` / `/push-pr-light`),
     keeping `/issue-finish` to a single push.
   - If no artifacts exist and the index has no pending changes, skip this step entirely.

4. **Report:**
   - Show which issue number was finished.
   - Confirm the Step 2 commit hash + message (or "no work to commit" if Step 2 skipped).
   - List which artifact files were removed in Step 3's cleanup commit.
   - Next-step hint: "Run `/catchup` if behind, then `/push-pr` or `/push-pr-light`."

## Important notes:
- `/issue-finish` is the issue-flow analog of `/finish`. Unlike `/finish` (which uses
  worktree-name detection to *disambiguate which task* to mark done), `/issue-finish`
  already has `N`. Worktree detection here only resolves `N` and warns on a mismatch.
- The same finalizer serves both paths: on the `/auto-issues` path Phase 5 already
  committed, so Step 2 is a no-op; on the standalone path the whole issue is uncommitted,
  so Step 2 does the full finalize. A `git status` gate distinguishes them.
- The cleanup commit is not pushed — it travels with the next push.
