# Commit

!git status
!git diff

Review the staged changes above. Then:

1. If nothing is staged, run `git add -u` to stage all tracked changes, then show `git diff --staged` so you have the full picture.
2. Check for untracked files (shown in `git status`). If any exist, list them and ask the developer which (if any) to include. Stage the ones they approve with `git add <file>...`. If none exist, proceed.
3. Draft a concise conventional commit message (`type: subject`) based on the staged diff. Keep the subject under 72 characters.
4. Commit to the current branch using that message.
5. Push to the current branch.
6. **Reflect** — Scan the reflection prompt in `templates/error-report.md`. If anything from this session is worth logging, append a learning entry to `tasks/errors.md`.
