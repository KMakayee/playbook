# Finish

Wrap up the current task: mark it done and commit everything including QRSPI artifacts.

!git status
!git diff

## Steps:

1. **Verify the plan is complete, then mark the todo task done:**
   - Read `tasks/plan.md` fully.
   - Check that all success criteria / checkboxes are marked done (`- [x]`).
   - If any are unchecked, **stop** — list the incomplete items and tell the developer the task isn't finished yet. Do not proceed.
   - If `tasks/plan.md` doesn't exist, skip the verification (the task may have been trivial with no plan).
   - Read `tasks/todo.md` fully.
   - Detect the current branch with `git rev-parse --abbrev-ref HEAD`. If it matches `worktree-todo-<N>` (e.g., `worktree-todo-8`), find task `<N>` in `tasks/todo.md` and mark it done (`- [x]`). The worktree's branch name names the task it's dedicated to, so use that directly — do **not** assume top-to-bottom sequential execution.
   - Otherwise (regular branch, no worktree convention), find the first unchecked task (`- [ ]`) and mark it as done. This is the fallback when there's no worktree-name signal to disambiguate.
   - If `tasks/todo.md` doesn't exist, skip the todo update silently.

2. **Commit all changes (including the updated todo and QRSPI artifacts):**
   - Run `git add -u` to stage all tracked changes.
   - Explicitly stage any QRSPI artifact files that exist (whether newly created or updated from a prior task): `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/research-patterns.md`, `tasks/plan.md`.
   - Show `git diff --staged` so you have the full picture.
   - Check for remaining untracked files (shown in `git status`). If any exist, list them and ask the developer which (if any) to include. Stage the ones they approve with `git add <file>...`. If none exist, proceed.
   - Draft a concise conventional commit message (`type: subject`) based on the staged diff. Keep the subject under 72 characters.
   - Commit to the current branch using that message.
   - Push to the current branch.

3. **Clean up QRSPI artifacts (local commit, no push):**
   - After the push in step 2 succeeds, `git rm` whichever of these exist: `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/research-patterns.md`, `tasks/plan.md`, `tasks/checkpoint.md`.
   - Commit the deletions with a message of the form `chore: clean up QRSPI artifacts for <subject>` — reuse the subject from step 2's commit so the pair is easy to correlate in history.
   - **Do not push this commit.** It rides on the next task's push, keeping `/finish` to a single push.
   - If no artifacts exist, skip this step entirely.

4. **Report:**
   - Show which todo task was marked complete (if any).
   - Confirm the commit hash and message for the main commit from step 2.
   - List which artifact files were committed in step 2 and which were removed in step 3's follow-up local commit.
   - If the current branch is a `worktree-todo-<N>` worktree, skip the "next up" hint — this worktree is dedicated to its task, and the next task belongs to a different worktree (or the developer's discretion). Otherwise, if there are remaining tasks in `tasks/todo.md`, show the next one up.

## Important notes:
- This command verifies the plan is complete before proceeding. If any plan items are unchecked, it stops early.
- QRSPI artifacts are committed as a record of the work, then removed in a follow-up local commit so the next task starts with a clean `tasks/` directory. The cleanup commit is not pushed — it travels with the next task's push.
- If there are no changes to commit (clean working tree, no staged changes), skip step 2 and just mark the todo complete. Step 3 still runs if artifacts are present.
