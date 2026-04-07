# Finish

Wrap up the current task: mark it done, commit everything, and clean up artifacts for the next task.

!git status
!git diff

## Steps:

1. **Verify the plan is complete, then mark the todo task done:**
   - Read `tasks/plan.md` fully.
   - Check that all success criteria / checkboxes are marked done (`- [x]`).
   - If any are unchecked, **stop** — list the incomplete items and tell the developer the task isn't finished yet. Do not proceed.
   - If `tasks/plan.md` doesn't exist, skip the verification (the task may have been trivial with no plan).
   - Read `tasks/todo.md` fully.
   - Find the first unchecked task (`- [ ]`) — this is the task that was just completed.
   - Mark it as done (`- [x]`).
   - If `tasks/todo.md` doesn't exist, skip the todo update silently.

2. **Commit all changes (including the updated todo):**
   - If nothing is staged, run `git add -u` to stage all tracked changes, then show `git diff --staged` so you have the full picture.
   - Check for untracked files (shown in `git status`). If any exist, list them and ask the developer which (if any) to include. Stage the ones they approve with `git add <file>...`. If none exist, proceed.
   - Draft a concise conventional commit message (`type: subject`) based on the staged diff. Keep the subject under 72 characters.
   - Commit to the current branch using that message.
   - Push to the current branch.

3. **Clean up QRSPI artifacts:**
   - Delete these files if they exist:
     - `tasks/research-codebase.md`
     - `tasks/design-decision.md`
     - `tasks/research-patterns.md`
     - `tasks/plan.md`
   - Do NOT delete: `tasks/todo.md`, `tasks/errors.md`, `tasks/issues.md`, `tasks/new-issues.md`, `tasks/checkpoint.md`.

4. **Report:**
   - Show which todo task was marked complete (if any).
   - Confirm the commit hash and message.
   - List which artifacts were removed.
   - If there are remaining tasks in `tasks/todo.md`, show the next one up.

## Important notes:
- This command verifies the plan is complete before proceeding. If any plan items are unchecked, it stops early.
- Artifact deletion is not committed — it's just local cleanup to prepare for the next task.
- If there are no changes to commit (clean working tree, no staged changes), skip step 2 and just mark the todo complete and clean up artifacts.
