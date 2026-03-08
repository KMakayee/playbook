# Commit

!git status
!git diff

Review the staged changes above. Then:

1. If nothing is staged, run `git add -u` to stage all tracked changes, then show `git diff --staged` so you have the full picture before proceeding.
2. Draft a concise conventional commit message (`type: subject`) based on the staged diff. Keep the subject under 72 characters.
3. Commit to the current branch using that message. Do NOT push.
