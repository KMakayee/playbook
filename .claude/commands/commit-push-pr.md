# Commit, Push, and PR

!git status
!git diff

Review the staged changes above. Then:

1. If there are no staged or unstaged changes to tracked files, skip to step 3 (push and PR).
   Otherwise, if nothing is staged, run `git add -u` to stage all tracked changes, then show `git diff --staged` so you have the full picture before proceeding.
2. Draft a concise conventional commit message (`type: subject`) based on the staged diff. Keep the subject under 72 characters. Commit and push to the current branch.
3. Check whether an open PR already exists for this branch:
   `!gh pr list --head $(git branch --show-current) --state open 2>/dev/null`
   - If no open PR and `gh` is installed: run `gh pr create --fill` to open one.
   - If no open PR and `gh` is not installed: tell the developer and skip PR creation.
   - If a PR already exists: show the PR URL and skip creation.
