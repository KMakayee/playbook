# Push and PR

!git status
!git log --oneline -3

Review the status above. Then:

1. If there are uncommitted changes, notify the developer and stop. Suggest running `/commit` first.
2. Push to the current branch.
3. Check whether an open PR already exists for this branch:
   `!gh pr list --head $(git branch --show-current) --state open 2>/dev/null`
   - If no open PR and `gh` is installed: run `gh pr create --fill` to open one.
   - If no open PR and `gh` is not installed: tell the developer and skip PR creation.
   - If a PR already exists: show the PR URL and skip creation.
