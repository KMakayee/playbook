# Plan: `/catchup` for parallel-worktree catch-up + close Issue #1

> **Source artifacts:** `tasks/research-codebase.md`, `tasks/design-decision.md`. No `tasks/research-patterns.md` (no novel external patterns required — all conventions reuse `/checkpoint`/`/push-pr` precedent).

## Design Decision Reference

**Approach:** Option A — "Inline + CLAUDE.md, conventions-first" (`tasks/design-decision.md:127-139`), with the four refinements absorbed inline:

1. `/push-pr*` staleness gate uses the existing PR's `baseRefName` when available (Axis 1 refinement).
2. Validation reads CLAUDE.md but **asks before running** and **narrows to non-mutating verification commands** (lint/typecheck/test only — never install, dev server, build, or `format --write`).
3. Existing-PR title hygiene is handled advisorily — surface the current PR title; recommend `gh pr edit` if it doesn't read cleanly.
4. Post-merge sync is reworded for squash semantics and uses the detected default branch (no longer hardcoded `main`).

Plus: explicitly close Issue #1 by editing `tasks/issues.md` (status → Done) as part of the implementation PR.

## Scope Boundaries (What We're NOT Doing)

- **No rebase support.** Merge-only catch-up. Rebase deferred to a future iteration.
- **No automatic conflict resolution.** Agent surfaces conflicts and stops; developer resolves.
- **No auto-push after `/catchup`.** Always recommend `/push-pr*`; never invoke it.
- **No `/checkpoint` global-install fix.** Out of scope; logged in design open questions.
- **No new `--include` mechanism for slash commands.** Inline duplication is the deliberate cost.
- **No `/auto-issues` changes.** Phase 9 uses `/commit`, not `/push-pr`, so unaffected.
- **No new `--validate` flag on `/catchup`.** Validation runs by default when configured (per design Axis 7 (A) refinement); skips silently on placeholder.
- **No automated PR-title rewrite for existing PRs.** Advisory-only — show current title, suggest `gh pr edit`.

## Phased Breakdown

This plan runs as **a single batch** end-to-end. The pre-edit gate classifies this as **non-trivial** (5+ files, new command surface, modified interfaces). All phases stay in markdown — no code, no tests, no build.

Each phase below leaves the repo in a working state. Run them in order; commit after each phase with a conventional commit message.

---

### Phase 1: Author `/catchup` (`.claude/commands/catchup.md`)

**Why first:** every later phase references `/catchup`. Wiring the gate (Phase 2) before the command exists creates a broken recommendation.

**File created:** `.claude/commands/catchup.md` (new file, ~180 lines).

**Structure** (mirrors `/checkpoint` format — `.claude/commands/checkpoint.md:1-18` argument table, `:23-44` schema, prose body with numbered steps):

1. **H1 title and one-paragraph purpose** — what `/catchup` does, when to run it (drift detected by `/push-pr*` staleness gate, or pre-emptively before push). State up front: this command is worktree-safe (uses `fetch` + `merge`, never `checkout main`).

2. **Argument switch table** (mirror `.claude/commands/checkpoint.md:5-18`):

   | `$ARGUMENTS` | Behavior |
   |---|---|
   | empty | auto-detect default branch |
   | `<base>` (e.g., `main`, `dev`) | use the supplied branch as the catch-up base |
   | anything else | error — list the valid forms (empty or `<base>`) and stop |

3. **Step 1 — Pre-flight checks** (sub-checks run in this order; halt on any failure):
   - **In-progress merge from a prior run** (must run **before** the dirty-worktree check, otherwise an unresolved merge stops as "dirty" before the resume/abort choice). Detect via `test -f "$(git rev-parse --git-path MERGE_HEAD)"` — this is worktree-safe (in a linked worktree `.git` is a file, not a directory; `git rev-parse --git-path` returns the actual MERGE_HEAD path). If present, **warn and ask** (Axis 5 (B)): "Found in-progress merge from prior `/catchup`. Continue (jump to Step 5 conflict resolution), abort (`git merge --abort`), or stop?" Wait for explicit choice.
   - **Clean worktree.** Run `git status --porcelain`. If non-empty (and the in-progress-merge check above didn't already route to Step 5), tell the developer to commit or stash, then stop. Mirror `.claude/commands/push-pr.md:8` pattern.

4. **Step 2 — Detect default branch + refuse-if-on-default** (Axis 1 (A) + (D) fallback; Axis 3 (C)):
   - Primary: `git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null` returns `origin/<default>` (e.g., `origin/main`). **Strip the `origin/` prefix** before use — downstream commands use `origin/<default>`, so passing `origin/origin/main` would silently fail. One-liner: `BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')`. Document the failure mode inline: returns empty with `fatal: ref refs/remotes/origin/HEAD is not a symbolic ref` if `set-head` was never run.
   - Fallback: ask the developer "Detected no default branch — what's the base? (e.g., `main`, `dev`)" Wait for input.
   - Override: if `$ARGUMENTS` was a non-empty `<base>`, skip detection and use the argument. Validate the branch exists on the remote (`git rev-parse --verify origin/<base>`); error if not.
   - **Refuse if currently on `<default>`:** compare `git rev-parse --abbrev-ref HEAD` against the resolved `<default>`. If equal, refuse with a one-liner: `/catchup` on `<default>` is a no-op — already there. Stop.

5. **Step 3 — Fetch + staleness signal** (Axis 8 (A)):
   - `git fetch origin <default>` — narrow fetch to the default branch.
   - `git rev-list --left-right --count HEAD...origin/<default>` — capture ahead/behind. Parse as `<ahead>\t<behind>`.
   - **Idempotent short-circuit:** if behind == 0, report "Already up to date with `origin/<default>` (ahead by N)" and **skip to Step 8** (handoff). No merge attempted, no validation run.

6. **Step 4 — Merge** (Axis 3 (A)):
   - `git merge origin/<default>` — auto-commits on clean merge; pauses on conflict.
   - On clean (auto-committed) merge → fall through to Step 6 (validation).
   - On conflict (exit 1, conflicted files reported) → fall through to Step 5 (conflict handling).

7. **Step 5 — Conflict handling** (Axis 4 (A) + Axis 9 (B) inline reversibility):
   - List conflicted paths via `git diff --name-only --diff-filter=U`.
   - **Explicit keep-both prose:**
     > "When both sides added independent content at the same anchor (two new package.json scripts, two new entries in a list, two new config keys), **keep BOTH**. Pick one only when the values are mutually exclusive (e.g., a single config value rewritten to two different values). The original feature commits are still intact — `git show <feature-sha>:<path>` works as a recovery fallback."
   - **Escape hatch (pre-commit only):** mention `git merge --abort` and what it does (restores worktree + index to pre-merge state).
   - Stop and wait for the developer to resolve and commit (`git add` + `git commit` to finish the merge).
   - On resume after the developer's merge commit lands → fall through to Step 6.

8. **Step 6 — Reversibility surface (post-merge-commit, pre-validation)** (Axis 9 (B) inline placement):
   - One-line reminder: "Merge committed. To undo before pushing: `git reset --hard ORIG_HEAD`. After push, only `git revert -m 1 <merge-sha>` is safe."

9. **Step 7 — Validation** (Axis 6 (A) + Axis 7 (A) refined):
   - **Skip-on-already-up-to-date:** if Step 3 short-circuited, skip Step 7 entirely (already noted in Step 3).
   - **Read CLAUDE.md sections:** open the project's CLAUDE.md, locate the `## Build & Run` and `## Testing` sections.
   - **Skip on placeholder:** if either section still contains `[TEAM FILLS IN` or unfilled `[COMMAND]` placeholders for the verification commands, report "No validation commands configured — skipping. Add commands to `Build & Run` / `Testing` in CLAUDE.md to enable this step." and continue to Step 8.
   - **Narrow scope:** extract only **non-mutating verification** commands. Eligible: lint check, typecheck, test runner. **Excluded:** `Install dependencies`, `Dev server`, `Production build`, any `format --write` / `--fix`-style mutating commands. If the prose is ambiguous, lean toward including (the next step asks for confirmation).
   - **Ask before running:** present the extracted command list to the developer (numbered) and ask for confirm / edit / skip. Wait for input. On confirm, run each in sequence, stopping on first failure.
   - **On failure:** surface the failing command's output. Recommend `git reset --hard ORIG_HEAD` to undo the merge if the failure is regression-shaped. Stop — do not hand off to push.
   - **On success:** continue to Step 8.

10. **Step 8 — Handoff** (Axis 10 (A)):
    - Report final state: ahead by N, behind by 0, validation passed (or skipped, with reason).
    - Recommend `/push-pr` for full code review or `/push-pr-light` for light review. Mirror `.claude/commands/checkpoint.md:167-173` "recommend, don't invoke" prose, including the runtime-constraint note ("a slash command cannot programmatically invoke another slash command").

11. **Step 9 — Reflect** (mirror `.claude/commands/push-pr.md:26`):
    - Scan the reflection prompt in `templates/error-report.md`. If anything from this session is worth logging (conflict surprise, validation misfire, CLAUDE.md misread), append a learning entry to `tasks/errors.md`.

**Style guardrails:**
- Use defensive shell idioms — explicit `git fetch` before any rev count, no `git pull`, quote `$ARGUMENTS` properly.
- Prose tone matches `/checkpoint` and `/push-pr` (numbered steps, sub-bullets for conditions, blockquoted recommendations).
- No backticked `[COMMAND]` placeholders or `[TEAM FILLS IN` markers — `/catchup` is fully specified.

**Success criteria for Phase 1** (each check is independent — run all):
- `test -f .claude/commands/catchup.md && wc -l .claude/commands/catchup.md` — file exists, ~180 lines.
- `grep -n "git symbolic-ref --short refs/remotes/origin/HEAD" .claude/commands/catchup.md` — primary default-branch detection present.
- `grep -nE "sed 's@\^origin/@@'" .claude/commands/catchup.md` — `origin/` prefix strip present (prevents `origin/origin/main` bug).
- `grep -n "git rev-parse --git-path MERGE_HEAD" .claude/commands/catchup.md` — worktree-safe MERGE_HEAD detection.
- `grep -n "keep BOTH" .claude/commands/catchup.md` — explicit conflict guidance present.
- `grep -n "git merge --abort" .claude/commands/catchup.md` — pre-commit escape hatch present.
- `grep -n "reset --hard ORIG_HEAD" .claude/commands/catchup.md` — post-commit escape hatch present.
- `grep -n "git rev-list --left-right --count" .claude/commands/catchup.md` — staleness signal present.
- `grep -n "ask.*confirm\|confirm.*before\|Wait for input" .claude/commands/catchup.md` — ask-before-running validation present.
- `! grep -nE "git pull|git checkout (main|origin)" .claude/commands/catchup.md` — no `git pull` and no `git checkout main` (worktree-unsafe).
- Manual read-through: validation step extracts only non-mutating commands (lint/typecheck/test); explicitly excludes install, dev server, build, format-write.

---

### Phase 2: Wire the staleness gate, squash default, and PR-title hybrid into `/push-pr` and `/push-pr-light`

**Why second:** `/catchup` exists from Phase 1, so the staleness gate's recommendation has a real target.

**Files modified:**
- `.claude/commands/push-pr.md`
- `.claude/commands/push-pr-light.md`

**Edits per file (changes are the same shape; small differences noted):**

**Edit A — Insert staleness gate as a new step between current Step 1 (uncommitted check) and Step 2 (push):**

After current Step 1 (`If there are uncommitted changes, notify the developer and stop. Suggest running /commit first.`), insert a new numbered step 2 (renumbering subsequent steps). Both files get the same gate prose, ~12 lines:

> **2. Staleness gate** — Verify the current branch is up to date with its base before pushing.
> - **Detect base, in priority order:**
>   1. If `$ARGUMENTS` is non-empty (e.g., `/push-pr dev`), use `$ARGUMENTS` as the base. This preserves the existing `<base>` arg semantics for new PRs targeting non-default branches.
>   2. Else if an open PR already exists for this branch, use that PR's `baseRefName`: `gh pr view --json baseRefName --jq '.baseRefName'`.
>   3. Else derive the default branch: `git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@'` (strip the `origin/` prefix; the raw output is `origin/<default>`).
>   4. If all three yield empty, ask the developer for the base.
> - **Fetch + count.** `git fetch origin <base> && git rev-list --count HEAD..origin/<base>`.
> - **If non-zero:** stop. Tell the developer: "Branch is N commits behind `<base>`. Run `/catchup`, then re-run `/push-pr`." Do not proceed. (Cannot programmatically invoke `/catchup` — see `/checkpoint`'s `/compact` recommendation pattern.)
> - **If zero:** continue.

The five subsequent steps (push, PR creation, review, conditional merge, post-merge sync, reflect) renumber from 2..7 to 3..8.

**Edit B — Step 3 (PR creation; was Step 3): replace `--fill` with hybrid `--title "<...>" --fill` flow.**

`.claude/commands/push-pr.md:12` and `.claude/commands/push-pr-light.md:12` currently read:
```
- If no open PR and `gh` is installed: run `gh pr create --fill` to open one. If the user provided a base branch argument (e.g., `/push-pr main`), add `--base <branch>` to the command.
```

Replace with the hybrid-confirm flow (Axis 11 (D)):

> - **If no open PR and `gh` is installed:**
>   1. Derive a candidate PR title from the latest commit subject (`git log -1 --format=%s`).
>   2. If the subject reads like fixup/WIP (matches `^(wip|fix typo|fixup|squash|tmp)`, contains `wip` as a token, or is shorter than 10 chars after stripping `type:` prefix), **do not propose it** — ask the developer to supply a descriptive title outright. (Branch-name fallback is explicitly avoided here: Issue #1 acceptance criterion #3 calls out "not auto-generated from branch name." If the latest commit is bad, asking is the cleaner path.)
>   3. Otherwise, show the derived title and ask: "Use this title for the squash commit on `<base>`? (yes / edit)". Wait for confirmation.
>   4. Run `gh pr create --title "<confirmed-title>" --fill` to open the PR (`--title` overrides `--fill`'s auto-derivation; `--fill` still supplies the body from commits). If the user provided a base branch argument (e.g., `/push-pr main`), add `--base <branch>` to the command.

**Edit C — Step 3 "If a PR already exists" branch: surface advisory title hygiene.**

`.claude/commands/push-pr.md:14` and `.claude/commands/push-pr-light.md:14` currently read:
```
- If a PR already exists: show the PR URL and skip creation.
```

Replace with:

> - **If a PR already exists:**
>   1. Show the PR URL.
>   2. Fetch the existing title: `gh pr view <PR_NUMBER> --json title --jq '.title'`. Display it.
>   3. **Advisory:** if the title looks auto-derived from a branch name (lowercase, hyphenated, e.g., `worktree-todo-8`) or fixup-flavored, suggest: "Consider editing for a clean squash commit: `gh pr edit <PR_NUMBER> --title \"<descriptive>\"`." This is advisory — do not block on it. Skip creation and continue.

**Edit D — Conditional merge step (was Step 5; renumbers to Step 6): swap `--merge` for `--squash`.**

`.claude/commands/push-pr.md:17` reads `merge the PR via gh pr merge --merge`; `.claude/commands/push-pr-light.md:22` reads the same. Replace `--merge` with `--squash` in both. Update prose surrounding the call to mention squash semantics ("the resulting commit on `<base>` is a single squashed commit; the work-branch ref is preserved post-merge so QRSPI artifacts stay retrievable via `git show <feature-sha>:<path>`").

**Edit E — Post-merge sync (was Step 6; renumbers to Step 7): use detected default branch + reword for squash semantics.**

`.claude/commands/push-pr.md:23-25` and `.claude/commands/push-pr-light.md:28-30` currently read:

```
6. **Post-merge sync** — Check the PR's base branch: `gh pr view <PR_NUMBER> --json baseRefName --jq '.baseRefName'`. If it was merged into `main`, sync main back into the current branch to keep them aligned:
   `git fetch origin main && git merge origin/main && git push`
   Skip this step if the PR targeted any branch other than `main`.
```

Replace with:

> **7. Post-merge sync** — Capture the PR's base: `gh pr view <PR_NUMBER> --json baseRefName --jq '.baseRefName'`. Detect the repo's default branch: `git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@'` (strip the `origin/` prefix; the raw output is `origin/<default>`). If the PR was merged into the default branch, sync it back so the current branch stays aligned. With `--squash`, `origin/<default>` now points to a fresh squash commit (not the feature-branch tip), so `git merge` will produce a small reconciliation merge commit rather than a fast-forward — that's expected, not a problem.
>
>    `git fetch origin <default> && git merge origin/<default> && git push`
>
>    Skip this step if the PR targeted any branch other than the default.

**Edit F — Argument-line update at top of step 3 PR-creation note** (`/push-pr.md` only — the `<base>` arg propagates through Edit B; verify that the existing wording about `/push-pr <base>` survives).

**`/push-pr-light` divergence note:** the `--squash` and `--title` edits are mechanically identical; the only structural difference between the two files is the review style (Step 4: full `/code-review` vs. light diff scan). Edits A/B/C/D/E apply to both with the renumbering offset.

**Atomicity guardrail (Codex risk #2):** because Phase 2 mirrors coupled edits across both `push-pr.md` and `push-pr-light.md`, an interruption mid-phase can leave the two files diverged. Apply both files' edits before running ANY of the success checks below, and only commit when every check passes for both files. If a check fails, fix and re-run all checks — do not commit a partial Phase 2.

**Success criteria for Phase 2** (each check is independent — run all; both files must pass each):
- `grep -n "Staleness gate" .claude/commands/push-pr.md .claude/commands/push-pr-light.md` — gate present in both files.
- `grep -n "gh pr merge --squash" .claude/commands/push-pr.md .claude/commands/push-pr-light.md` — squash default in both.
- `grep -nE 'gh pr create --title "[^"]+" --fill' .claude/commands/push-pr.md .claude/commands/push-pr-light.md` — hybrid title flow in both.
- `grep -nE "sed 's@\^origin/@@'" .claude/commands/push-pr.md .claude/commands/push-pr-light.md` — `origin/` prefix strip present in both (prevents `origin/origin/main` bug in gate + post-merge sync).
- `grep -n '\$ARGUMENTS' .claude/commands/push-pr.md .claude/commands/push-pr-light.md` — explicit `$ARGUMENTS` base priority preserved in the gate.
- `grep -n "gh pr edit" .claude/commands/push-pr.md .claude/commands/push-pr-light.md` — existing-PR title hygiene advisory present.
- `! grep -n "gh pr merge --merge" .claude/commands/push-pr.md .claude/commands/push-pr-light.md` — old `--merge` removed.
- `! grep -n "git fetch origin main && git merge origin/main" .claude/commands/push-pr.md .claude/commands/push-pr-light.md` — hardcoded-`main` post-merge sync removed.
- `! grep -nE 'gh pr create --fill\b' .claude/commands/push-pr.md .claude/commands/push-pr-light.md` — bare `--fill` (without `--title`) removed.
- `grep -nE 'Run `/catchup`' .claude/commands/push-pr.md .claude/commands/push-pr-light.md` — recommendation text present.
- Step numbering re-validated by manual read-through: both files have steps 1..8 (was 1..7) with the staleness gate as step 2.

---

### Phase 3: Update distribution surfaces — `playbook-update.md` and `playbook-setup.md`

**Why third:** new commands need to propagate to consuming repos (`/playbook-update`) and be globally available so the staleness-gate recommendation isn't a dead-end (`/playbook-setup`).

**Files modified:**
- `.claude/commands/playbook-update.md` — add `.claude/commands/catchup.md` to the managed-files list, immediately after `.claude/commands/checkpoint.md` (currently line 37).
- `.claude/commands/playbook-setup.md` — add `.claude/commands/catchup.md` to global-install list at lines 100-102 (currently `commit.md`, `push-pr.md`, `push-pr-light.md`; insert after `push-pr-light.md`).

**Edit A — `playbook-update.md` after line 37:**

Current line 37 in the managed-files block: `.claude/commands/checkpoint.md`

Add immediately after:
```
.claude/commands/catchup.md
```

(Position chosen: utility commands clustered together — `commit`, `push-pr`, `push-pr-light`, `checkpoint`, `catchup`, `finish`. Alphabetical-within-category is consistent with the existing list's loose ordering.)

**Edit B — `playbook-setup.md` lines 100-102:**

Current block:
```
   - `.claude/commands/commit.md`
   - `.claude/commands/push-pr.md`
   - `.claude/commands/push-pr-light.md`
```

Add:
```
   - `.claude/commands/catchup.md`
```

after `push-pr-light.md`. Order matches `playbook-update.md` conceptual grouping.

**Success criteria for Phase 3:**
- `grep -n "catchup.md" .claude/commands/playbook-update.md` — managed list now includes catchup.
- `grep -n "catchup.md" .claude/commands/playbook-setup.md` — global-install list now includes catchup.

---

### Phase 4: Update docs — `README.md` and `quickref.md`

**Why fourth:** docs reflect the surface added in Phase 1 and the squash-default change made in Phase 2.

**Files modified:**
- `README.md` — add `/catchup` row to utility commands table (after line 73, between `/push-pr-light` and `/checkpoint`); update `/push-pr` and `/push-pr-light` descriptions to note squash default.
- `quickref.md` — add `/catchup` row to code-quality table (after line 46, between `/push-pr-light` and `/checkpoint`); update `/push-pr` and `/push-pr-light` descriptions to note squash default.

**Edit A — `README.md` lines 71-77 utility commands table:**

Current:
```
| `/commit` | Stage, commit, and push to current branch |
| `/push-pr` | Push, open PR, full code review, conditional merge |
| `/push-pr-light` | Push, open PR, light diff review, conditional merge |
| `/checkpoint` | Save / resume / discard work state in `tasks/checkpoint.md` (commits on save, consumes on resume) |
| `/codex-review` | One-shot Codex second-opinion pass over a file, diff, artifact, or freeform target |
| `/finish` | Wrap up task: verify, commit artifacts, clean up |
```

Replace `/push-pr` and `/push-pr-light` rows with squash mentions, and insert `/catchup` between `/push-pr-light` and `/checkpoint`:

```
| `/commit` | Stage, commit, and push to current branch |
| `/push-pr` | Push, open PR, full code review, squash-merge by default |
| `/push-pr-light` | Push, open PR, light diff review, squash-merge by default |
| `/catchup` | Catch a feature branch up to its default base — fetch, merge, surface conflicts, run validation, recommend `/push-pr` |
| `/checkpoint` | Save / resume / discard work state in `tasks/checkpoint.md` (commits on save, consumes on resume) |
| `/codex-review` | One-shot Codex second-opinion pass over a file, diff, artifact, or freeform target |
| `/finish` | Wrap up task: verify, commit artifacts, clean up |
```

**Edit B — `quickref.md` lines 41-52 code-quality table:**

Current rows for `/push-pr` and `/push-pr-light`:
```
| `/push-pr`      | Push, open PR, code review, and merge if passing                                 |
| `/push-pr-light`| Push, open PR, light diff review, and merge if passing                           |
```

Replace and insert `/catchup` row between `/push-pr-light` and `/checkpoint`:

```
| `/push-pr`      | Push, open PR, code review, squash-merge if passing                              |
| `/push-pr-light`| Push, open PR, light diff review, squash-merge if passing                        |
| `/catchup`      | Catch a feature branch up to its default base — fetch, merge, surface conflicts  |
```

(Match column widths to the surrounding rows. The `Command` column is 16 chars; the `What it does` column is 81 chars — adjust trailing spaces to align.)

**Success criteria for Phase 4:**
- `grep -n "/catchup" README.md` — present in utility table.
- `grep -n "/catchup" quickref.md` — present in code-quality table.
- `grep -n "squash-merge" README.md quickref.md` — both `/push-pr` and `/push-pr-light` rows mention squash.

---

### Phase 5: Close Issue #1 in `tasks/issues.md`

**Why last:** issue closure must reflect that the work is actually done. Closing earlier risks marking work done that's still in motion.

**File modified:** `tasks/issues.md`

**Edit:** update the `## #1` heading block (lines 44-79):

- `**Status:** Draft` → `**Status:** Done`
- Add a `**Closed:** 2026-04-25` line after the existing `**Updated:**` line.
- Check off acceptance-criteria checkboxes (lines 65-69):
  - `- [ ] /push-pr defaults to gh pr merge --squash` → `- [x]`
  - `- [ ] /push-pr-light does the same` → `- [x]`
  - `- [ ] PR title is pre-set via gh pr create --title "<descriptive>" so the squash commit on main reads cleanly (not auto-generated from branch name)` → `- [x]`
  - `- [ ] README.md and quickref.md mention squash as the default` → `- [x]`
  - `- [ ] Existing PR review and conditional-merge logic preserved unchanged` → `- [x]`
- Append a Notes line: "**2026-04-25 — Closed by Task 8.** Task 8's `/catchup` work edited `/push-pr*` for the staleness gate; squash default + `--title` hybrid landed in the same edit."

**Success criteria for Phase 5:**
- `grep -nA1 "^## #1" tasks/issues.md` — Status line reads `Done`.
- `! grep -n "^- \[ \]" tasks/issues.md | grep -A0 "squash\|push-pr"` — no unchecked acceptance criteria for issue #1.

---

## Judgment Calls

Numbered places where an alternative was viable. Listed for transparency and Codex review.

1. **Phase ordering: catchup-first vs. push-pr-first.** Catchup-first is correct because the staleness gate references `/catchup` by name; landing the gate first creates a window where the recommendation points at a non-existent command. (Alternative: bundle as one big edit and commit them together. Rejected — phasing isolates failures.)

2. **Single-batch vs. multi-batch implementation.** Treated as one batch because the changes are tightly coupled: the staleness gate is meaningless without `/catchup`, the squash default is co-located with the gate edit, and Issue #1 closure depends on Phase 2 + 4 landing. Multi-batch would force re-reading research between phases for no real isolation gain.

3. **`git symbolic-ref --short refs/remotes/origin/HEAD` over `gh repo view --json defaultBranchRef`.** Local, no network, no `gh` dependency, and matches the existing playbook stance (no implicit network calls). Fallback to developer prompt covers the `set-head`-not-run case. (Alternative: `gh`-first per Option B. Rejected — adds a network call to every run for a marginal authoritativeness gain.)

4. **Staleness-gate base priority: `$ARGUMENTS` → existing-PR `baseRefName` → detected default → developer prompt.** Three sources, prioritized so explicit override always wins. Existing-PR base reuse eliminates a false-positive class (PR targets `dev` but gate measures against `main`). `$ARGUMENTS` priority preserves the existing `/push-pr <base>` semantics for new PRs targeting non-default branches. (Alternative: skip the PR-base check, always use `origin/HEAD`. Rejected — measurable false-positive in any project that uses non-default base branches.)

5. **Validation: ask-before-run vs. run-then-show-output.** Ask-before-run is the design's chosen refinement. The agent's read of CLAUDE.md prose is interpretive, and silent execution risks running install/build/dev-server commands the developer didn't expect. (Alternative: run all extracted commands silently. Rejected by design — too risky.)

6. **PR-title hybrid: latest-commit-subject only; ask outright on fixup/WIP.** Matches Axis 11 (D) but drops the branch-name fallback Codex flagged — Issue #1 acceptance criterion #3 explicitly avoids branch-name-derived titles, so the fallback would re-introduce the exact problem the issue closes. When the latest commit subject is fixup/WIP-shaped, prompting the developer is the cleaner path. (Alternative: ask developer outright with no derived candidate. Rejected — adds friction even when the latest commit subject is fine.)

7. **Existing-PR title hygiene: advisory only.** Don't auto-edit the title. The developer may have intentionally set it, and silently rewriting an existing PR's title is the kind of side-effect Option A explicitly avoids. (Alternative: prompt to rewrite. Rejected — adds an interactive step on every push to an existing PR, even when the title is fine.)

8. **Catchup positioning in tables (after `/push-pr-light`, before `/checkpoint`).** Groups the worktree-management commands together. Alternative: alphabetical (after `/checkpoint`). Either works; chose grouping because the README/quickref already group by purpose, not strict alphabet.

9. **Validation skip-on-already-up-to-date.** When the staleness check shows behind == 0, skip both merge and validation. No regression possible; running validation on a no-op merge is wasted time. (Alternative: always run validation. Rejected — defeats idempotency.)

10. **No `--validate` flag on `/catchup`.** Design Axis 7 chose default-on-when-configured. Adding a flag would weaken the gate without solving the interpretive risk (which is mitigated by ask-before-run). (Alternative: opt-in via `--validate`. Rejected by design.)

## Artifact References

- Research: `tasks/research-codebase.md` (located paths, behavior analysis, axes, risks).
- Design: `tasks/design-decision.md` (chosen approach + four refinements).
- No `tasks/research-patterns.md` — no novel external patterns required.
