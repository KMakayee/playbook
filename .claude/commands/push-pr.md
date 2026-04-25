# Push and PR

!git status
!git log --oneline -3

Review the status above. Then:

1. If there are uncommitted changes, notify the developer and stop. Suggest running `/commit` first.
2. **Staleness gate** — Verify the current branch is up to date with its base before pushing.
   - **Detect base, in priority order:**
     1. If `$ARGUMENTS` is non-empty (e.g., `/push-pr dev`), use `$ARGUMENTS` as the base. This preserves the existing `<base>` arg semantics for new PRs targeting non-default branches.
     2. Else if an open PR already exists for this branch, use that PR's `baseRefName`: `gh pr view --json baseRefName --jq '.baseRefName'`.
     3. Else derive the default branch: `git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@'` (strip the `origin/` prefix; the raw output is `origin/<default>`).
     4. If all three yield empty, ask the developer for the base.
   - **Fetch + count.** `git fetch origin <base> && git rev-list --count HEAD..origin/<base>`.
   - **If non-zero:** stop. Tell the developer: "Branch is N commits behind `<base>`. Run `/catchup <base>`, then re-run `/push-pr <base>` (omit `<base>` if it matches the default)." Do not proceed. (Cannot programmatically invoke `/catchup` — see `/checkpoint`'s `/compact` recommendation pattern.)
   - **If zero:** continue.
3. Verify the current branch has been pushed to the remote. If not (no upstream tracking branch, or local is ahead of remote), push it now.
4. Check whether an open PR already exists for this branch:
   `!gh pr list --head $(git branch --show-current) --state open 2>/dev/null`
   - **If no open PR and `gh` is installed:**
     1. Derive a candidate PR title from the latest **non-merge** commit subject on this branch since it diverged from `<base>`: `git log -1 --no-merges --format=%s "$(git merge-base HEAD origin/<base>)..HEAD"`. Skipping merge commits is load-bearing — `/catchup` (and any other reconciliation merge) leaves a merge commit like `Merge remote-tracking branch 'origin/main' into <branch>` at the tip, which is structural noise and would produce an unreadable squash commit on `<base>`. If the command returns empty (the branch has *only* merge commits since diverging — rare, but possible after a /catchup-only branch), fall through to the bad-title path below and ask the developer outright.
     2. If the derived subject reads like fixup/WIP (matches `^(wip|fix typo|fixup|squash|tmp)`, contains `wip` as a token, or is shorter than 10 chars after stripping a `type:` prefix), **do not propose it** — ask the developer to supply a descriptive title outright. Branch-name fallback is explicitly avoided here: Issue #1 acceptance criterion #3 calls out "not auto-generated from branch name." If the latest commit subject is bad, asking is the cleaner path.
     3. Otherwise, show the derived title and ask: "Use this title for the squash commit on `<base>`? (yes / edit)". Wait for confirmation.
     4. Run `gh pr create --title "<confirmed-title>" --fill` to open the PR. `--title` overrides `--fill`'s auto-derivation; `--fill` still supplies the body from commits. If the user provided a base branch argument (e.g., `/push-pr main`), add `--base <branch>` to the command.
   - If no open PR and `gh` is not installed: tell the developer and skip PR creation.
   - **If a PR already exists:**
     1. Show the PR URL.
     2. Fetch the existing title: `gh pr view <PR_NUMBER> --json title --jq '.title'`. Display it.
     3. **Advisory:** if the title looks auto-derived from a branch name (lowercase, hyphenated, e.g., `worktree-todo-8`) or fixup-flavored, suggest: "Consider editing for a clean squash commit: `gh pr edit <PR_NUMBER> --title \"<descriptive>\"`." This is advisory — do not block on it. Skip creation and continue.
5. **Code review** — Run `/code-review` on the PR (use the PR number from step 4). Wait for the review to complete.
6. **Conditional merge** — Evaluate the code review result:
   - **If the review found no issues** ("No issues found"): merge the PR via `gh pr merge --squash` and confirm the merge to the developer. With `--squash`, the resulting commit on `<base>` is a single squashed commit; the work-branch ref is preserved post-merge so QRSPI artifacts stay retrievable via `git show <feature-sha>:<path>`.
   - **If the review found issues**: list each issue clearly, do NOT merge, and suggest fixing via the QRSPI workflow (research → design → plan → implement).
   - **Merge error handling** — If `gh pr merge` fails:
     1. Wait 15 seconds and retry once.
     2. If retry fails with "merge already in progress": close the PR (`gh pr close <PR_NUMBER>`), create a fresh PR with the same base, and attempt to merge again.
     3. If the fresh PR also fails: stop, log the error to `tasks/errors.md` (use the format in `templates/error-report.md`), and report the issue to the developer.
7. **Post-merge sync** — Capture the PR's base: `gh pr view <PR_NUMBER> --json baseRefName --jq '.baseRefName'`. Detect the repo's default branch: `git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@'` (strip the `origin/` prefix; the raw output is `origin/<default>`). If the PR was merged into the default branch, sync it back so the current branch stays aligned. With `--squash`, `origin/<default>` now points to a fresh squash commit (not the feature-branch tip), so `git merge` will produce a small reconciliation merge commit rather than a fast-forward — that's expected, not a problem.

   `git fetch origin <default> && git merge origin/<default> && git push`

   Skip this step if the PR targeted any branch other than the default.
8. **Reflect** — Scan the reflection prompt in `templates/error-report.md`. If anything from this session is worth logging, append a learning entry to `tasks/errors.md`.
