# Push and PR (Light)

!git status
!git log --oneline -3

Review the status above. Then:

1. If there are uncommitted changes, notify the developer and stop. Suggest running `/commit` first.
2. Verify the current branch has been pushed to the remote. If not (no upstream tracking branch, or local is ahead of remote), push it now.
3. Check whether an open PR already exists for this branch:
   `!gh pr list --head $(git branch --show-current) --state open 2>/dev/null`
   - If no open PR and `gh` is installed: run `gh pr create --fill` to open one. If the user provided a base branch argument (e.g., `/push-pr-light main`), add `--base <branch>` to the command.
   - If no open PR and `gh` is not installed: tell the developer and skip PR creation.
   - If a PR already exists: show the PR URL and skip creation.
4. **Light review** — Run `gh pr diff <PR_NUMBER>` and do a single-pass scan of the diff for:
   - Obvious bugs or typos
   - Security red flags (hardcoded secrets, injection risks)
   - Leftover debug code (`console.log`, `debugger`, `TODO`)
   - Anything that looks unintentional
   Keep the review brief — a short bullet list of findings, or "No issues found". Do NOT run `/code-review`.
5. **Conditional merge** — Evaluate the light review result:
   - **If the review found no issues** ("No issues found"): merge the PR via `gh pr merge --merge` and confirm the merge to the developer.
   - **If the review found issues**: list each issue clearly, do NOT merge, and suggest fixing via the RPI workflow (research → plan → implement).
