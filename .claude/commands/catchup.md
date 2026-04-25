# Catchup

Bring a feature branch up to date with its base by fetching the latest base, merging it in, surfacing any conflicts for the developer to resolve, optionally running the project's verification commands, and then handing off to `/push-pr` or `/push-pr-light`. Run this when `/push-pr*`'s staleness gate tells you the branch is behind, or pre-emptively before pushing if you suspect drift.

This command is **worktree-safe**: it never runs `git checkout <base>` (which fails when the base is checked out in another worktree). It uses `git fetch` plus `git merge origin/<base>` exclusively.

Takes a single optional argument (`$ARGUMENTS`):

| `$ARGUMENTS` | Behavior |
|---|---|
| empty | auto-detect the default branch via `origin/HEAD` |
| `<base>` (e.g., `main`, `dev`) | use the supplied branch as the catch-up base |
| anything else | error — list the valid forms (empty or `<base>`) and stop |

The `$ARGUMENTS` slot is reserved for the base override. Do **not** treat freeform commentary as the base — if `$ARGUMENTS` is non-empty, validate it as a branch name (matches `origin/<arg>`) and error otherwise.

---

## Step 1 — Pre-flight checks

Run the sub-checks in the order below. The in-progress-merge check **must run before** the dirty-worktree check — otherwise an unresolved prior merge would be rejected as "dirty" without ever offering the resume / abort choice.

1. **In-progress merge from a prior `/catchup` run.** Detect via:

   ```
   test -f "$(git rev-parse --git-path MERGE_HEAD)"
   ```

   `git rev-parse --git-path` is worktree-safe: in a linked worktree the `.git` entry is a file (not a directory), and `--git-path` returns the actual path to `MERGE_HEAD` regardless. If present, **warn and ask** the developer:

   > "Found in-progress merge from a prior `/catchup`. Continue (jump to Step 5 conflict resolution), abort (`git merge --abort` restores the worktree to its pre-merge state), or stop?"

   Wait for an explicit choice. On `continue`, skip the rest of Step 1 and Steps 2–4 and jump to Step 5. On `abort`, run `git merge --abort` and stop. On `stop`, stop without changes.

2. **Clean worktree.** Run `git status --porcelain`. If the output is non-empty (and the in-progress-merge check above did not already route you to Step 5), tell the developer to commit or stash their changes, then stop. Mirror `/push-pr`'s clean-worktree refusal — `/catchup` should never merge on top of dirty state.

---

## Step 2 — Detect default branch + refuse-if-on-default

1. **Primary detection.** Run:

   ```
   BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')
   ```

   The raw `git symbolic-ref` output is `origin/<default>` (e.g., `origin/main`). The `sed` strips the leading `origin/` so downstream commands such as `git fetch origin <base>` and `git rev-list HEAD...origin/<base>` get a bare branch name. **Skip the strip and you will get `origin/origin/main` everywhere downstream**, which silently fails ref resolution.

   The command returns empty (with `fatal: ref refs/remotes/origin/HEAD is not a symbolic ref` on stderr) if the local clone never ran `git remote set-head origin --auto`. Fall through to the developer prompt below in that case.

2. **Fallback prompt.** If `BASE` is empty after the primary detection:

   > "Detected no default branch (`origin/HEAD` is not set). What's the catch-up base? (e.g., `main`, `dev`)"

   Wait for input. Validate the answer matches `origin/<answer>` via `git rev-parse --verify origin/<answer>`; error and stop if it does not.

3. **Override.** If `$ARGUMENTS` was a non-empty `<base>`, skip detection and use the argument directly. Validate that `git rev-parse --verify origin/<base>` succeeds; error and stop if not (do not silently fall back to detection — explicit override should fail loudly).

4. **Refuse if currently on `<base>`.** Compare `git rev-parse --abbrev-ref HEAD` against the resolved `<base>`. If equal, refuse with a one-liner — `/catchup` on `<base>` is a no-op since you are already there — and stop.

---

## Step 3 — Fetch + staleness signal

1. **Narrow fetch.** Run `git fetch origin <base>` — fetch only the resolved base branch, not every remote ref.

2. **Ahead/behind count.** Run:

   ```
   git rev-list --left-right --count HEAD...origin/<base>
   ```

   The output is `<ahead>\t<behind>`. Parse both numbers.

3. **Idempotent short-circuit.** If `<behind>` is `0`, report:

   > "Already up to date with `origin/<base>` (ahead by `<ahead>`). No merge needed."

   **Skip directly to Step 8** (handoff). Do not attempt a merge. Do not run validation. Idempotency is the point — re-running `/catchup [<base>]` on a fresh branch should be a clean no-op.

---

## Step 4 — Merge

Run:

```
git merge origin/<base>
```

`git merge` auto-creates a merge commit when there are no conflicts, and pauses the merge in progress (with `MERGE_HEAD` written) when there are conflicts.

- On clean merge (auto-committed) → fall through to **Step 6** (reversibility surface), then **Step 7** (validation).
- On conflict (exit 1, conflicted paths reported) → fall through to **Step 5** (conflict handling).

---

## Step 5 — Conflict handling

1. **List conflicted paths.**

   ```
   git diff --name-only --diff-filter=U
   ```

2. **Keep-both guidance.** Surface the following prose to the developer verbatim — the keep-both default is the rule, not the exception:

   > "When both sides added independent content at the same anchor (two new `package.json` scripts, two new entries in a list, two new config keys, two unrelated functions in a module), **keep BOTH**. Pick one only when the values are mutually exclusive — e.g., a single config value rewritten to two different values, or two implementations of the same function. The original feature commits are still intact in this branch's history; if you accidentally drop content, `git show <feature-sha>:<path>` retrieves the pre-merge file from any commit on this branch."

3. **Pre-commit escape hatch.** Mention:

   > "If the conflict is bigger than expected and you want to back out cleanly, `git merge --abort` restores the worktree and index to the exact pre-merge state — no commit was made yet."

4. **Stop and wait.** Stop and wait for the developer to resolve every conflicted path, `git add` the resolutions, and `git commit` to finish the merge. Do not proceed until the merge commit has landed.

5. **On resume after the developer's merge commit lands**, fall through to **Step 6**.

---

## Step 6 — Reversibility surface (post-merge-commit, pre-validation)

Surface a one-line reminder:

> "Merge committed. To undo before pushing: `git reset --hard ORIG_HEAD`. After push, only `git revert -m 1 <merge-sha>` is safe."

`ORIG_HEAD` is the branch tip from before the merge — `git reset --hard ORIG_HEAD` rewinds the merge commit cleanly without touching the working tree of any other worktree.

---

## Step 7 — Validation (read CLAUDE.md, ask before running)

Skip this step entirely if Step 3 short-circuited (already up to date).

1. **Read CLAUDE.md.** Open the project's `CLAUDE.md`. Locate the `## Build & Run` and `## Testing` sections.

2. **Skip on placeholder.** If either section still contains `[TEAM FILLS IN` markers or unfilled `[COMMAND]` placeholders for the verification commands, report:

   > "No validation commands configured in CLAUDE.md — skipping. Add commands to the `Build & Run` and `Testing` sections to enable this step on future runs."

   Continue to Step 8.

3. **Narrow scope to non-mutating verification commands.** Extract only commands that *verify* the codebase without changing it. Eligible:
   - lint / lint-check / `eslint --check`
   - typecheck / `tsc --noEmit`
   - test runner (`pytest`, `vitest`, `jest`, `go test`, etc.) — read-only test execution

   **Exclude unconditionally:**
   - `Install dependencies` (mutates `node_modules` / `Pipfile.lock` / etc.)
   - `Dev server` (long-running, never exits)
   - `Production build` (mutates `dist/`, may run codegen)
   - Any `format --write`, `--fix`, `--in-place`, or otherwise mutating commands

   If the prose is ambiguous about whether a command mutates, lean toward including it — the next step asks the developer for confirmation, which closes the gap.

4. **Ask before running.** Present the extracted command list to the developer numbered, e.g.:

   ```
   I plan to run these verification commands from CLAUDE.md:
     1. npm run lint
     2. npm run typecheck
     3. npm test
   Confirm (run all), edit (drop or modify entries), or skip?
   ```

   Wait for input. On `confirm`, run each command in sequence. On `edit`, accept the developer's revised list and re-confirm. On `skip`, continue to Step 8.

5. **Stop on first failure.** Run the confirmed commands sequentially. On the first failure, stop and surface the failing command and its output. If the failure is regression-shaped (a previously passing check now fails), recommend:

   > "This looks like a regression introduced by the merge. To undo: `git reset --hard ORIG_HEAD`."

   Do not auto-revert and do not hand off to push.

6. **On success**, continue to Step 8.

---

## Step 8 — Handoff

Report the final state in one short summary:

- ahead by `<N>`, behind by `0`
- validation passed (or skipped, with the reason)
- merge commit SHA (or "no merge needed" on the idempotent path)

Then **explicitly recommend** the next move:

> "Branch is up to date with `origin/<base>` and verified. Run `/push-pr` for full code review, or `/push-pr-light` for a quick diff scan."

**Why recommend rather than auto-invoke:** a slash command cannot programmatically invoke another slash command — `/push-pr` and `/push-pr-light` are also markdown prompts that the agent must execute. The agent surfaces the recommendation; the developer (or the agent's next prompt) runs the chosen push command.

---

## Step 9 — Reflect

Scan the reflection prompt in `templates/error-report.md`. If anything from this `/catchup` session is worth logging — a conflict surprise (the keep-both prose mismatched what was needed), a validation misfire (a command that turned out to mutate), a CLAUDE.md misread (the agent extracted the wrong commands) — append a learning entry to `tasks/errors.md` per the template format. If nothing surprising happened, skip the entry.
