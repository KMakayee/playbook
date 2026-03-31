# Push and PR

!git status
!git log --oneline -3

Review the status above. Then:

1. If there are uncommitted changes, notify the developer and stop. Suggest running `/commit` first.
2. Verify the current branch has been pushed to the remote. If not (no upstream tracking branch, or local is ahead of remote), push it now.
3. Check whether an open PR already exists for this branch:
   `!gh pr list --head $(git branch --show-current) --state open 2>/dev/null`
   - If no open PR and `gh` is installed: run `gh pr create --fill` to open one. If the user provided a base branch argument (e.g., `/push-pr main`), add `--base <branch>` to the command.
   - If no open PR and `gh` is not installed: tell the developer and skip PR creation.
   - If a PR already exists: show the PR URL and skip creation.
4. **Code review** — Run `/code-review` on the PR (use the PR number from step 3). Wait for the review to complete.
5. **Conditional merge** — Evaluate the code review result:
   - **If the review found no issues** ("No issues found"): merge the PR via `gh pr merge --merge` and confirm the merge to the developer.
   - **If the review found issues**: list each issue clearly, do NOT merge, and suggest fixing via the RPI workflow (research → plan → implement).
6. **Post-merge sync** — Check the PR's base branch: `gh pr view <PR_NUMBER> --json baseRefName --jq '.baseRefName'`. If it was merged into `main`, sync main back into the current branch to keep them aligned:
   `git fetch origin main && git merge origin/main && git push`
   Skip this step if the PR targeted any branch other than `main`.
