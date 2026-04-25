# Research: Add `/catchup` for parallel-worktree catch-up + close Issue #1

## Research Question

Task 8 (from `tasks/todo.md`): Add a new `/catchup` slash command that handles drift detection → merge default in → conflict surfacing → host-project validation → ready-to-push, plus a small staleness gate added to `/push-pr` and `/push-pr-light`. Co-locate Issue #1 (default `/push-pr` and `/push-pr-light` to `--squash`, with explicit `--title`) on the same edit surface and close it out.

## Summary

This task ships entirely in markdown — slash-command prompts in `.claude/commands/`, plus three doc files (`README.md`, `quickref.md`, `CLAUDE.md`'s playbook-managed sections via `templates/playbook-sections.md`). No code, no tests, no build. The hard part is design, not implementation.

The dominant precedent is `/checkpoint`: explicit `$ARGUMENTS` switch table, defensive shell snippets, warn-don't-refuse on edge cases, idempotency, and the rule that a slash command *recommends* another slash command rather than invoking it. `/catchup` should mirror this style end-to-end.

Three architectural decisions reshape the design space:

1. **No shared-prompt mechanism.** Slash commands are plain markdown with no `include` directive. The staleness gate logic in `/push-pr` and `/push-pr-light` cannot reuse `/catchup`'s code — it must be duplicated inline, kept short, and mirrored across both files. This is a hard constraint, not a preference.
2. **Worktree-only flow.** The repo has 4 active worktrees branched from `main` right now (`git worktree list`). The catch-up flow cannot use `git checkout main && git pull` — that fails when `main` is checked out elsewhere. Must use `git fetch origin && git merge origin/<default>` exclusively.
3. **Validation hook is not parseable.** The `Build & Run` and `Testing` sections in `CLAUDE.md` are free-form prose, with `[COMMAND]` placeholders meant for human eyes. `/catchup`'s validation step cannot reliably extract a command from them. The realistic options are: (a) ask the agent to *read* those sections and run whatever commands it finds; (b) skip validation entirely if placeholders are unfilled; (c) require the developer to confirm before running. Option (a) — "agent reads and decides" — is the only one that matches how every other slash command in the repo treats CLAUDE.md, but it's load-bearing on the agent's judgment.

Issue #1 closure is mechanical: change `--merge` → `--squash` in two files, change `--fill` → `--title "<descriptive>"` (with `--fill` retained for body, since it's overridden by explicit `--title`), update README + quickref. The Issue #1 PR-title change has a subtle interaction with `/auto-issues` (none — `/auto-issues` Phase 9 uses `/commit`, not `/push-pr`) but a real interaction with how `--fill` and `--title` compose at the `gh` CLI layer.

## Detailed Findings

### `/catchup` command surface (new file)

The new command lives at `.claude/commands/catchup.md`. It is a plain markdown prompt the agent reads and executes step-by-step. It has no programmatic interface; everything is shell snippets and conditional prose.

The natural step structure (derived from `/checkpoint` and `/push-pr`):

1. **Argument parsing** — `$ARGUMENTS` switch table (empty = auto-detect default branch; explicit `<base>` = override; anything else = error). Mirror `/checkpoint`'s switch-table format (`.claude/commands/checkpoint.md:5-18`).
2. **Worktree-state preflight** — clean worktree check (matching `/push-pr` step 1), in-progress-merge detection (`MERGE_HEAD` exists), and any other reasons to refuse before mutating state.
3. **Default-branch detection** — see Axis 1.
4. **Fetch + staleness signal** — `git fetch origin && git rev-list --left-right --count HEAD...origin/<default>` to get ahead/behind counts. Idempotent no-op if behind = 0.
5. **Merge** — `git merge origin/<default>`. On conflict, hand off to step 6; on clean merge, fall through to step 7. On "Already up to date" (after step 4 missed an edge case), report and exit.
6. **Conflict handling** — surface conflicts with the keep-both-by-default policy (Axis 4); offer `git merge --abort` as the bailout path; wait for developer to resolve and commit; then continue.
7. **Validation** — read CLAUDE.md `Testing` and `Build & Run` sections, run whatever commands the agent finds; skip if `[TEAM FILLS IN]`/`[COMMAND]` placeholders remain.
8. **Handoff** — recommend `/push-pr` or `/push-pr-light` (don't auto-push; mirror `/checkpoint`'s `/compact` recommendation pattern).
9. **Reflect** — append to `tasks/errors.md` per `templates/error-report.md` if anything surprising happened.

### Existing edit surface — `/push-pr` and `/push-pr-light`

Both files have identical structure. The Issue #1 + Task 8 edits compose into three changes per file:

- `.claude/commands/push-pr.md:12` and `.claude/commands/push-pr-light.md:12` — `gh pr create --fill` becomes `gh pr create --title "<descriptive>" --fill` (or `--title ... --body ...`; see Axis 11). The `--title` argument overrides `--fill`'s title-from-commit auto-derivation per `gh` docs.
- `.claude/commands/push-pr.md:17` and `.claude/commands/push-pr-light.md:22` — `gh pr merge --merge` becomes `gh pr merge --squash`.
- A **new step** between current step 1 (clean worktree) and step 2 (push) — staleness gate. Inspect `git rev-list --count HEAD..origin/<default>` (after a fetch). If non-zero, refuse and tell the developer: "Branch is N commits behind `<default>`. Run `/catchup`, then re-run `/push-pr`." Cannot programmatically invoke `/catchup`.

The existing **post-merge sync** at `push-pr.md:23-25` (`git fetch origin main && git merge origin/main && git push`) hardcodes `main`. Task 8 also requires this to use the detected default branch. This is an extra Issue-#1-adjacent change — small, mechanical, but easy to miss.

### Validation hook source — `CLAUDE.md` is the only candidate

`templates/playbook-sections.md:24-39` defines the schema of CLAUDE.md's `Testing` and `Build & Run` sections:

```
## Testing
[TEAM FILLS IN — Testing setup:
- Framework (...)
- Test file location convention (...)
- How to run the full suite: `[COMMAND]`
- How to run a single test file: `[COMMAND]`
- Minimum coverage expectations, if any]

## Build & Run
[TEAM FILLS IN — Commands to build and run locally:
- Install dependencies: `[COMMAND]`
- Dev server: `[COMMAND]`
- Production build: `[COMMAND]`
- Lint / format: `[COMMAND]`]
```

These are free-form prose with backtick-fenced `[COMMAND]` placeholders. They are **not machine-parseable**: the team is expected to replace `[COMMAND]` with the actual command, but the schema doesn't constrain *where* in the prose the command lands or whether multiple commands are listed (e.g., a team could write "run `pnpm test` then `pnpm typecheck`").

The realistic agent-side handling: the `/catchup` prompt instructs the agent to read those two sections, find the build/lint/test commands relevant to a "did this change break anything?" check (typically: lint + typecheck + the main test command), and run them. If the sections still contain unfilled `[TEAM FILLS IN` or `[COMMAND]` markers, skip validation with a one-liner ("No validation commands configured — skipping. Add commands to `Build & Run`/`Testing` in CLAUDE.md to enable this step.").

This is the same approach `/playbook-audit` already takes when it scans CLAUDE.md sections (`.claude/commands/playbook-audit.md:17-25` flags sections as `ok / stale / unconfigured`). The pattern of "agent reads CLAUDE.md sections to decide behavior" is established; `/catchup` would be the first command to *execute* commands found there.

### Distribution and global-install considerations

`.claude/commands/playbook-update.md:13-43` lists 30 managed files. Adding `.claude/commands/catchup.md` to this list is required — without it, `/playbook-update` won't propagate `/catchup` to consuming repos.

`.claude/commands/playbook-setup.md:99-102` only globally installs `commit`, `push-pr`, `push-pr-light` to `~/.claude/commands/`. **Coupling:** if global `/push-pr` is installed and points the developer at `/catchup`, but `/catchup` is not globally installed, the developer hits a dead end in workspaces that don't have the playbook installed locally. Task 8 should add `catchup.md` to this list. The same logic applies to `/checkpoint`, which is curiously not in the global list either — but that's out of scope and worth a separate note (see Open Questions).

`README.md:67-76` and `quickref.md:39-48` have command tables that need a new row for `/catchup`. `quickref.md`'s table for utility commands is the natural home; the row should match the format of existing rows (one-line description, no shell snippets).

### Squash-default mention in docs (Issue #1 acceptance criteria #4)

Issue #1 calls out adding a squash-default mention to `README.md` and `quickref.md`. The natural homes:
- `README.md:71-77` (Utility commands table) — add a one-line note after the table or in the description column for `/push-pr` and `/push-pr-light`.
- `quickref.md:45-46` — same; the description column for both rows should mention "squash-merge default."

### `tasks/errors.md` reflection pattern

Both `/push-pr` and `/push-pr-light` step 7 ("Reflect") append to `tasks/errors.md` using `templates/error-report.md`'s schema. `/catchup` should do the same — likely log when conflicts hit, what was kept/dropped during resolution, and any validation failures. The reflection prompt at `templates/error-report.md:34-42` already has the "wrong approach before the right one" prompt that fits conflict-resolution mistakes.

### Worktree state machine and reversibility

The escape hatches for the catch-up flow:

- **Pre-merge** (after `git fetch`, before `git merge`): nothing to undo. `git fetch` only updates remote-tracking refs.
- **Mid-merge, conflicts unresolved**: `git merge --abort` restores the worktree and index to their pre-merge state. Documented at https://git-scm.com/docs/git-merge.
- **Merge committed, not yet pushed**: `git reset --hard ORIG_HEAD` undoes the merge commit (Git sets `ORIG_HEAD` to the pre-merge tip). Documented at https://www.kernel.org/pub/software/scm/git/docs/git-reset.html.
- **Merge pushed**: only `git revert -m 1 <merge-sha>` is safe; reset would require force-push.

Task 8's "Worst-case recovery" note (the original feature commits survive even after a destructive resolution) is correct in the merge-commit case — the merge is additive. In the rebase case, the original SHAs are abandoned (recoverable only via reflog before GC). This is one reason merge is the default and rebase is opt-in.

The `/catchup` prompt should surface escape hatches at the moment they're available:
- Up-front mention is too early (developer hasn't seen the conflict yet).
- Embedded in the conflict-handling step is the natural placement (developer sees `--abort` exactly when they need it).
- Post-merge-commit, pre-validation: mention `reset --hard ORIG_HEAD` if validation fails.

### Slash-command-cannot-invoke-slash-command

Confirmed by inspecting `/checkpoint` step 10 (`.claude/commands/checkpoint.md:167-173`): "Why recommend rather than auto-invoke: `/compact` is a Claude Code built-in; a slash command cannot programmatically invoke another slash command. The agent surfaces the recommendation; the developer runs `/compact` themselves."

This is a runtime constraint, not a stylistic choice. `/push-pr`'s staleness gate must surface "Run `/catchup`" as text and stop, not call `/catchup` and proceed. Same for `/catchup`'s handoff to `/push-pr`.

## Code References

- `tasks/todo.md:44-53` — Task 8 spec, including the seven-bullet "Useful context" list at the bottom (merge-over-rebase, conflict failure mode, reversibility, validation hook, default-branch detection, no-cross-invocation, idempotency, Issue #1 closeout)
- `tasks/issues.md:44-79` — Issue #1, currently re-scoped to just squash-default + PR-title; co-located with Task 8
- `.claude/commands/push-pr.md:8-25` — direct edit surface (staleness gate insertion, `--fill`→`--title`, `--merge`→`--squash`, hardcoded `main` in step 6)
- `.claude/commands/push-pr-light.md:8-30` — same edits, mirrored
- `.claude/commands/checkpoint.md:5-18` — `$ARGUMENTS` switch-table style precedent
- `.claude/commands/checkpoint.md:96-104` — warn-don't-refuse pattern (branch and `base_head` mismatch)
- `.claude/commands/checkpoint.md:156-173` — recommend-don't-invoke pattern (the `/compact` handoff)
- `.claude/commands/checkpoint.md:177-207` — resume-mode validation flow (parse, validate, rehydrate, consume)
- `.claude/commands/playbook-update.md:13-43` — managed-files list to extend with `catchup.md`
- `.claude/commands/playbook-setup.md:99-102` — global-install list (currently only `commit`, `push-pr`, `push-pr-light`)
- `.claude/commands/playbook-audit.md:17-25` — precedent for "agent reads CLAUDE.md sections and classifies"
- `templates/playbook-sections.md:24-39` — schema for the `Testing` and `Build & Run` sections used as the validation hook source
- `templates/error-report.md:8-42` — `tasks/errors.md` log format and reflection prompt
- `README.md:71-77` — utility commands table (needs `/catchup` row + squash-default note)
- `quickref.md:39-48` — code-quality commands table (same)
- `.claude/commands/auto-issues.md:130-170` — confirms `/auto-issues` uses `/commit` for push (Phase 9), not `/push-pr` — so Issue #1's `--title` change does not affect `/auto-issues`

## Architecture Analysis

The playbook is a thin layer of markdown prompts over `git`, `gh`, `claude`, and `codex`. There is no shared library, no helper module, no shell library. Every slash command is a self-contained prompt that the agent reads and executes. This shapes the architecture in three ways:

1. **No abstraction = no DRY violations.** When two commands need the same logic (staleness check in `/catchup` and `/push-pr*`), the logic gets duplicated. There is no `--include` directive in command markdown. Maintenance burden is real but consistent — the trade-off is that every command is fully readable in one file, which fits the agent's context model.
2. **Defensive shell over abstraction.** `/checkpoint` establishes the "two-step `git rm` + `git commit --only`" pattern for path-scoped commits that don't sweep the developer's index. Same defensive style applies to `/catchup`: explicit fetch before any staleness check, explicit merge (not pull, since pull conflates fetch+merge), explicit `--abort` mention in conflict handling. The shell is opinionated; the agent's judgment is bounded.
3. **CLAUDE.md as configuration.** Host-project specifics (build commands, test commands, critical paths) live in CLAUDE.md as prose. Every slash command that needs project-specific behavior reads CLAUDE.md and *interprets* — the agent is the schema parser. This is the only viable pattern in a markdown-prompt architecture, and `/catchup`'s validation hook fits naturally into it.

A fourth architectural observation: **commands recommend, never compose.** `/push-pr` doesn't call `/commit`; it tells the developer to run `/commit` if there are uncommitted changes. `/checkpoint` doesn't call `/compact`; it recommends `/compact`. This is forced by the runtime constraint (no programmatic invocation) but has a design upshot: every slash command has a natural "stopping point" where it hands control back to the developer. `/catchup`'s natural stopping point is post-validation, before push.

## Design Axes

### Axis 1: Default-branch detection mechanism

- **Choices:**
  - **(A) Local `git symbolic-ref refs/remotes/origin/HEAD`** — fast, no network, no `gh` dependency. Returns `refs/remotes/origin/main` when properly configured. Confirmed working in this worktree. Failure mode: `origin/HEAD` may be unset after a bare `git clone` without `--depth` or after `set-head` was never run (https://git-scm.com/docs/git-remote/2.53.0.html).
  - **(B) `gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'`** — authoritative; queries GitHub API. Failure modes: requires `gh` installed, requires auth, requires network, fails outside GitHub-hosted repos (https://cli.github.com/manual/gh_repo_view).
  - **(C) PR-base-derived: `gh pr view --json baseRefName --jq '.baseRefName'`** — only works if a PR already exists. Useful for `/push-pr`'s staleness gate (the PR is created in step 3 anyway), not useful for standalone `/catchup`.
  - **(D) Developer prompt fallback** — ask the developer if (A)-(C) all fail.
- **Per-axis constraints:** No hardcoded `main`. Method must work in worktrees (all options above do — none require `git checkout`).
- **Evidence:** Confirmed `git symbolic-ref refs/remotes/origin/HEAD` returns `refs/remotes/origin/main` in this repo via shell. `gh repo view --json defaultBranchRef` per `gh` docs https://cli.github.com/manual/gh_repo_view.

### Axis 2: Staleness check location

- **Choices:**
  - **(A) Inline duplicated** in `/catchup`, `/push-pr`, and `/push-pr-light`. Simplest given no shared-prompt mechanism.
  - **(B) Helper script in `.claude/scripts/`** — there is one script precedent (`pipeline-eval.sh`), so this is feasible. Script runs the staleness check; commands shell out.
  - **(C) Move all the staleness logic into `/catchup` and have `/push-pr*` simply ask `/catchup` to run-or-noop** — blocked by no-cross-invocation constraint, but a degenerate variant works: `/push-pr*` runs only the *signal* (`git rev-list --count HEAD..origin/<default>`) inline and tells the developer to run `/catchup` if non-zero.
- **Per-axis constraints:** Whatever lives in `/push-pr*` must surface "run `/catchup`" as recommendation, not invocation. Logic must run before `gh pr create` and before any merge-attempt.
- **Evidence:** No `--include` directive in command markdown (verified by reading multiple command files; none reference each other for content). Helper-script precedent: `.claude/scripts/pipeline-eval.sh` invoked by `auto-issues.md:149`.

### Axis 3: `/catchup` operation strategy

- **Choices:**
  - **(A) Merge default into feature** (`git merge origin/<default>`) — Task 8's stated default. Squash-on-PR collapses the merge commit on `main`. No force-push needed. (https://git-scm.com/docs/git-merge/2.49.0.html)
  - **(B) Rebase feature onto default** (`git rebase origin/<default>`) — opt-in for unpushed branches only. Linearizes history but rewrites SHAs and requires force-push if branch is already pushed.
  - **(C) Refuse if currently on default branch** — `/catchup` makes no sense on `main`/`dev`; `git rev-parse --abbrev-ref HEAD` against detected default and exit early.
- **Per-axis constraints:** No `git checkout main && git pull` (worktree-incompatible — `git worktree` docs and `git checkout` docs both confirm a branch checked out in another worktree cannot be checked out here, https://git-scm.com/docs/git-worktree.html). Default is merge per Task 8.
- **Evidence:** Existing `/push-pr.md:23-25` already uses `git fetch origin main && git merge origin/main && git push` — the same plumbing pattern.

### Axis 4: Conflict surfacing UX

- **Choices:**
  - **(A) Single conflict report** — list conflicted files via `git diff --name-only --diff-filter=U`, optionally show full diff, surface the keep-both-by-default policy and the `git merge --abort` escape hatch, then wait for developer to resolve and commit.
  - **(B) File-by-file walk** — agent opens each conflicted file, presents both sides, asks the developer for direction per file. More guided but slower; risks the agent making the call when it shouldn't.
  - **(C) Developer-led** — agent prints `git status` and stops; developer resolves entirely outside the prompt; agent re-engages on the next `/catchup` (or a follow-up `/catchup continue`).
- **Per-axis constraints:** Conflict prompt must explicitly state: "for independent additions on both sides, keep BOTH; pick one only when the values are mutually exclusive." This is the dominant failure mode per Task 8's pre-research notes (line 46 of `tasks/todo.md`). Must surface `git merge --abort` and `git reset --hard ORIG_HEAD` (post-commit) escape hatches.
- **Evidence:** Task 8 line 46 is explicit on the keep-both rule. `/checkpoint`'s style precedent leans toward warn-and-confirm rather than agent-makes-decision.

### Axis 5: In-progress merge handling

- **Choices:**
  - **(A) Detect `MERGE_HEAD` and continue** — if `.git/MERGE_HEAD` exists, treat as resumed conflict resolution; jump to step 6 (conflict handling).
  - **(B) Detect `MERGE_HEAD` and ask** — warn the developer they're mid-merge from a prior run; offer continue / abort / proceed-anyway.
  - **(C) Refuse** — pre-flight error if `MERGE_HEAD` exists.
- **Per-axis constraints:** `/checkpoint` favors warn/confirm over destructive action (`.claude/commands/checkpoint.md:96-104`); same style fits here. `git merge --abort` only works if a merge is actually in progress.
- **Evidence:** `git status` reports "You have unmerged paths" when conflicts exist; `MERGE_HEAD` presence is the canonical marker.

### Axis 6: Validation hook config source

- **Choices:**
  - **(A) Read CLAUDE.md `Testing` + `Build & Run` sections** — agent reads, finds backtick-fenced commands, runs them. Skip if `[TEAM FILLS IN]` or `[COMMAND]` placeholders remain. Matches existing CLAUDE.md-as-config pattern.
  - **(B) Dedicated `.claude/validation.json` config file** — new convention, no precedent. Cleaner schema but introduces a new managed surface.
  - **(C) Environment variable** (`PLAYBOOK_VALIDATION_CMD`) — also new, also no precedent.
  - **(D) Developer-supplied via `/catchup --validate "<cmd>"`** — explicit, no config plumbing. Loses the "sensible default" feel.
- **Per-axis constraints:** Must skip cleanly if validation config absent — the playbook's own CLAUDE.md is in this state (all `[TEAM FILLS IN]` placeholders), so a `/catchup` test run in this repo must skip validation gracefully without erroring.
- **Evidence:** `templates/playbook-sections.md:24-39` shows the schema; `.claude/commands/playbook-audit.md:17-25` is the only precedent for reading CLAUDE.md sections programmatically.

### Axis 7: Validation trigger

- **Choices:**
  - **(A) Always run** after a successful merge (clean or post-conflict).
  - **(B) Only after conflicts** — assumes clean merges don't change semantics. False — clean merges can still introduce broken combinations of independent changes.
  - **(C) Opt-in via `/catchup --validate`** — developer chooses.
  - **(D) Skip silently** if validation config is unfilled (this is option (A) modified by Axis 6's skip-on-placeholder behavior).
- **Per-axis constraints:** Task 8 line 49 says "Skip the validation step if no config exists". Default behavior is "run if configured, skip if not".
- **Evidence:** Task 8 explicit.

### Axis 8: Already-up-to-date short-circuit point

- **Choices:**
  - **(A) Pre-merge check** — `git rev-list --count HEAD..origin/<default>` after fetch; if 0, exit before attempting `git merge`. Cleanest no-op.
  - **(B) Post-merge parsing** — let `git merge` run and detect "Already up to date" in stdout. Mutates `ORIG_HEAD` even on no-op (per merge docs, https://git-scm.com/docs/git-merge/2.49.0.html), which complicates the "what does ORIG_HEAD point to right now?" reasoning later.
  - **(C) `git merge-base --is-ancestor origin/<default> HEAD`** — exits 0 if `origin/<default>` is reachable from HEAD (i.e., the branch already contains it). Cheaper than rev-list count but binary (no ahead/behind numbers).
- **Per-axis constraints:** Idempotent — running `/catchup` already-up-to-date is a one-line "already up to date" report (Task 8 line 51). Must not produce log spam.
- **Evidence:** `git rev-list --left-right --count HEAD...origin/<default>` (https://git-scm.com/docs/git-rev-list/2.53.0.html) and `git merge-base --is-ancestor` (https://git-scm.com/docs/git-merge-base) both work.

### Axis 9: Reversibility surface placement

- **Choices:**
  - **(A) Up-front in command preamble** — list `--abort` and `reset --hard ORIG_HEAD` at the top.
  - **(B) Inline at the moment they apply** — `--abort` in the conflict-handling step, `reset --hard ORIG_HEAD` only when validation fails post-merge-commit.
  - **(C) Bottom-of-prompt reference list** — single "Escape hatches" section the agent can point at.
  - **(D) On-demand only** — surface only if the developer asks "how do I undo this?".
- **Per-axis constraints:** Escape hatches change with state — `--abort` is invalid post-commit; `reset --hard` is invalid post-push. Surfacing them at the wrong moment misleads.
- **Evidence:** Git docs for both commands document state preconditions. Task 8 line 47 explicitly calls this out.

### Axis 10: Post-validation handoff

- **Choices:**
  - **(A) Stop and recommend `/push-pr` or `/push-pr-light`** — mirrors `/checkpoint`'s `/compact` recommendation pattern. Most consistent with no-cross-invocation rule.
  - **(B) Auto-push** — `git push` and stop. Loses the `reset --hard ORIG_HEAD` escape hatch (now post-push).
  - **(C) Stop and report status, no recommendation** — leaves the next move ambiguous.
- **Per-axis constraints:** Cannot programmatically invoke `/push-pr` (no-cross-invocation). Auto-push narrows reversibility (Codex flagged this; consistent with Axis 9).
- **Evidence:** `/checkpoint` step 10 ("recommend `/compact`, do not invoke") at `.claude/commands/checkpoint.md:167-173`.

### Axis 11: Issue #1 PR-title source

- **Choices:**
  - **(A) Ask developer** — `gh pr create --title "<developer-supplied>" --body "$(...)"`. Pure for the squash-commit-on-main goal.
  - **(B) Derive from latest commit subject** — `gh pr create --title "$(git log -1 --format=%s)" --fill`. Works when commits are well-named; fails on `wip` / `fix typo` last commits.
  - **(C) Branch-name-derived** (the current `--fill` default) — disfavored by Issue #1 acceptance criterion #3.
  - **(D) Hybrid** — `--fill` provides the body and a default title; agent shows the derived title and asks the developer to confirm or edit.
- **Per-axis constraints:** Title must read cleanly on `main` after squash. `--title` overrides `--fill`'s title-from-commits derivation per `gh` docs (https://cli.github.com/manual/gh_pr_create) — so `--fill` can stay for body while `--title` is set explicitly. `/auto-issues` does not use `/push-pr` (Phase 9 uses `/commit` only), so this change does not affect the unattended pipeline.
- **Evidence:** `gh pr create` docs, https://cli.github.com/manual/gh_pr_create. `auto-issues.md:130-140` confirms Phase 9 is `/commit`-based.

### Axis 12: Argument shape for `/catchup`

- **Choices:**
  - **(A) No args** — auto-detect default branch only.
  - **(B) Optional `<base>` override** — matches `/push-pr <base>` (`push-pr.md:12`). Useful when detection picks the wrong branch.
  - **(C) Optional `--rebase` flag** — switches Axis 3 to (B). Opt-in for branches not yet pushed.
  - **(D) Both override and flag** — composable.
- **Per-axis constraints:** `$ARGUMENTS` is a single string; multi-flag parsing is a small prose burden but feasible (see `/checkpoint`'s switch table). Errors should list valid args (`/checkpoint.md:16` precedent).
- **Evidence:** `/push-pr.md:12` accepts `<base>` arg. `/checkpoint.md:5-18` switch-table style.

### Axis 13: Distribution surface

- **Choices:**
  - **(A) Add to `/playbook-update` managed files only** — `/catchup` propagates to consuming repos via update flow.
  - **(B) Add to `/playbook-update` AND `/playbook-setup` global-install list** — `/catchup` becomes available globally (in `~/.claude/commands/`) like `/push-pr`.
  - **(C) Local-only** — leave it out of both lists; only the playbook repo itself has `/catchup`.
- **Per-axis constraints:** If `/push-pr*` (which is globally installed) recommends `/catchup` on staleness, `/catchup` must also be globally installed — otherwise the developer hits a dead end in workspaces without local playbook install. Coupling makes (A) untenable if (B) is the staleness-gate target.
- **Evidence:** `playbook-update.md:13-43` and `playbook-setup.md:99-102`.

## Axis Coupling

- **If Axis 1 = (A) only (no `gh` fallback) → Axis 1 must add (D) developer prompt** as a real fallback. `origin/HEAD` being unset is a common case (`git remote set-head` is a manual step), so (A)-alone is brittle. Reference: https://git-scm.com/docs/git-remote/2.53.0.html.
- **If Axis 2 = (A) inline duplicated → maintenance constraint** spans 3 files (`catchup.md`, `push-pr.md`, `push-pr-light.md`); README + quickref need parallel updates. No way to reduce this with current architecture.
- **If Axis 3 = (B) rebase → Axis 9 narrows** to `git reflog` recovery only (rebase abandons original SHAs from branch tip). The "original feature commits survive" guarantee in Task 8 line 48 is merge-only.
- **If Axis 6 = (A) read CLAUDE.md → Axis 7 default is "run if configured, skip on placeholder"** — the agent is the schema parser, so if it can't find commands, validation is silently skipped.
- **If Axis 8 = (B) post-merge parsing → Axis 9's `reset --hard ORIG_HEAD` mention** must clarify ORIG_HEAD has already moved to the (no-op) merge — confusing. (A) avoids this confusion.
- **If Axis 10 = (B) auto-push → Axis 9 narrows** to `git revert` only post-execution; lose the `reset --hard ORIG_HEAD` window.
- **If Axis 13 = (B) global-install → Axis 13 must update both lists** in the same PR; missing one creates a dead-end UX.
- **Issue #1 has no coupling with Task 8 axes** beyond co-location: `--merge`→`--squash` and `--fill`→`--title` are independent of every catch-up axis above.

## Cross-Cutting Constraints

- **No `--include` directive in command markdown.** Logic shared between `/catchup` and `/push-pr*` must be duplicated inline. Verified by reading multiple command files; no command references another for content (only for recommendation).
- **No programmatic slash-command invocation.** `/push-pr`'s staleness gate must surface "Run `/catchup`" as text and stop. Established by `/checkpoint`'s `/compact` recommendation pattern (`checkpoint.md:167-173`).
- **Worktree-safe git only.** `git fetch origin && git merge origin/<default>` is the only worktree-compatible path. `git checkout main` fails when main is checked out elsewhere (`git worktree` docs, https://git-scm.com/docs/git-worktree.html).
- **Argument convention.** `$ARGUMENTS` switch-table style from `/checkpoint.md:5-18`. Errors enumerate valid args.
- **Defensive shell.** Path-scoped commits, explicit fetches before reads, no `git pull` (use `fetch` + `merge` separately for clarity). Pattern from `/checkpoint` and `/push-pr`.
- **Conventional commits in body of any commit message** the agent generates (`type: subject` from `commit.md:10`).
- **README + quickref parity** with `.claude/commands/`. Any new command needs a row in both.
- **CLAUDE.md as configuration.** Every host-project specific behavior reads CLAUDE.md and interprets — agent is the schema parser. Validation hook follows this pattern.
- **Reflection logging.** `tasks/errors.md` per `templates/error-report.md` schema. Both push commands already follow this.
- **`/playbook-update` managed-files list** must be kept in sync — every new command file must be added.

## External Research

- **`git symbolic-ref refs/remotes/origin/HEAD`** is the canonical local mechanism for default-branch lookup; `git remote set-head -a` configures it. **Unblocks: Axis 1, choice (A).** Failure mode: ref unset after clone unless `set-head` was run. Source: https://git-scm.com/docs/git-remote/2.53.0.html.
- **`gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'`** returns the GitHub-side default branch authoritatively. **Unblocks: Axis 1, choice (B).** Failure modes: requires `gh` install, auth, network, GitHub-hosted repo. Source: https://cli.github.com/manual/gh_repo_view.
- **`git merge-base --is-ancestor`** exits 0 when first commit is ancestor of second. **Unblocks: Axis 8, choice (C).** Source: https://git-scm.com/docs/git-merge-base.
- **`git rev-list --left-right --count A...B`** gives left/right commit counts. **Unblocks: Axis 8, choice (A) and the staleness signal in Axis 2.** Source: https://git-scm.com/docs/git-rev-list/2.53.0.html.
- **`git merge` semantics**: sets `ORIG_HEAD`, exits "Already up to date" when commits are ancestors, records conflict stages, supports `--abort` / `--continue`. **Unblocks: Axes 3, 5, 8, 9.** Source: https://git-scm.com/docs/git-merge/2.49.0.html.
- **`git reset --hard ORIG_HEAD`** is the documented undo path for a merge or pull. **Unblocks: Axis 9, choice (B) inline placement.** Source: https://www.kernel.org/pub/software/scm/git/docs/git-reset.html.
- **Worktree branch checkout exclusivity**: a branch already checked out in another worktree cannot be checked out again. **Unblocks: Axis 3 constraint** (no `checkout main`). Sources: https://git-scm.com/docs/git-worktree.html, https://www.kernel.org/pub/software/scm/git/docs/git-checkout.html.
- **`gh pr create --title --body --base`** is fully supported; explicit `--title` overrides the auto-derivation that `--fill` performs. **Unblocks: Axis 11, choice (A) and (D)** — `--fill` can stay for body while `--title` is explicit. Source: https://cli.github.com/manual/gh_pr_create.
- **`gh pr merge --squash`** is a first-class strategy; merge queues may ignore explicit strategy flags. **Unblocks: Issue #1 mechanical change.** Source: https://cli.github.com/manual/gh_pr_merge.
- **GitHub squash-merge prerequisites**: requires repo-level enablement; protected branches with linear history require squash or rebase; strict status checks require up-to-date branches (which is exactly what Task 8's staleness gate enforces). **Unblocks: Issue #1 + Task 8 alignment** — the staleness gate makes "up-to-date" a precondition, which dovetails with strict-checks repos. Source: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github, https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches.

## Risk Analysis

- **Conflict resolution drops independent additions.** The dominant failure mode (Task 8 line 46). Mitigation: the conflict-handling step's prose must explicitly say "keep BOTH sides for independent additions; pick one only when values are mutually exclusive." Show an example (two `package.json` scripts at the same anchor → keep both).
- **`origin/HEAD` unset after clone.** `git symbolic-ref refs/remotes/origin/HEAD` errors with `fatal: ref refs/remotes/origin/HEAD is not a symbolic ref` in this state. `/catchup` needs a fallback path (Axis 1 (B), (C), or (D)).
- **Validation hook reads unparseable CLAUDE.md.** If the team filled `Build & Run` with prose that the agent misreads, validation runs the wrong commands. Mitigation: agent presents what it found and asks for confirmation before running, OR validation surfaces command output for the developer to gauge.
- **Auto-push narrows rollback.** Axis 10 (B) takes `reset --hard ORIG_HEAD` off the table. Recommendation: stop after validation (Axis 10 (A)).
- **Global `/push-pr` recommends `/catchup` that isn't installed.** Coupling between Axis 13 and the staleness gate. If `/catchup` is added to the playbook-update managed list but not to the playbook-setup global-install list, consuming repos that already installed `/push-pr` globally will get the recommendation but no `/catchup` to run. Both lists must be updated.
- **`/auto-issues` interaction.** `/auto-issues` Phase 9 uses `/commit` (not `/push-pr`), so Issue #1's `--title` and `--squash` changes do NOT affect the unattended pipeline. Confirmed by reading `auto-issues.md:130-170`. Worth a one-line check during implementation.
- **Mid-merge state from a prior run.** `MERGE_HEAD` exists if a previous `/catchup` was abandoned mid-conflict. Axis 5 governs handling. (A) auto-continue is risky (developer may not remember why they stopped); (B) warn-and-ask is safer.
- **Dirty worktree before merge.** `git merge` refuses with "Your local changes would be overwritten by merge" if any tracked file has uncommitted changes that conflict with the incoming merge. The pre-flight clean-worktree check catches this before fetch.
- **Long-running `gh pr create` body fill.** When using `--fill`, `gh` shells out to a temp editor or uses commit history for the body. This is a network-bound operation and may be slow. No direct mitigation; existing `/push-pr*` already uses `--fill` so the perf baseline doesn't change.
- **Strict-checks repos.** GitHub branch protection rules can require "branches must be up to date before merging" (https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches). The staleness gate is the right enforcement point, but implementations need to gracefully handle the case where the staleness gate passes locally but GitHub rejects the merge anyway (rare, but possible if a sibling branch lands between the gate and the merge call).

## Open Questions

- **Should `/checkpoint` also be added to the `/playbook-setup` global-install list?** Currently absent. Out of scope for Task 8, but worth noting — `/checkpoint` is referenced by `Session-Start Validation` in CLAUDE.md (`templates/playbook-sections.md:157`), so consuming repos with global installs but no local playbook hit the same dead end as `/catchup` would. Could be a follow-up issue.
- **Validation hook: ask-before-running, or run-and-show-output?** Axis 6 (A) doesn't fully resolve this. Running unconditionally on the agent's interpretation of CLAUDE.md is fast but risks running the wrong commands; ask-before-running is safer but adds a confirmation step. Decision deferred to `/design`.
- **Conflict-step UX granularity.** Axis 4 has three real choices; the keep-both rule applies to all of them. (A) single-report is the lowest-friction default but might miss subtleties on a multi-file conflict.
- **Should `/catchup` accept a `<feature-branch>` argument?** Probably not — `/catchup` is meant to run from inside the worktree it's catching up. Cross-branch catch-up is a different operation. Confirm during design.
- **Does `/catchup` commit the merge before validation?** `git merge` auto-commits on a clean (non-conflicting) merge. On conflict, the merge is uncommitted until the developer commits. Ordering matters for Axis 9 (`reset --hard ORIG_HEAD` only works post-commit). Most natural sequence: clean merge → auto-committed → validate → (recommend push) | conflict → developer resolves → developer commits → validate → (recommend push). Confirm during design.

## Findings Index

- `CORRECTION:` `/push-pr` and `/push-pr-light` use `gh pr merge --merge`; Issue #1 requires `--squash`. (Detailed Findings → Existing edit surface)
- `CORRECTION:` `/push-pr*` use `gh pr create --fill` for both title and body; Issue #1 requires explicit `--title`. (Detailed Findings → Existing edit surface; Axis 11)
- `CORRECTION:` `/push-pr.md:23-25` and `push-pr-light.md:28-30` hardcode `origin/main` in the post-merge sync; Task 8 requires default-branch detection. (Detailed Findings → Existing edit surface)
- `CORRECTION:` `README.md:71-77` and `quickref.md:39-48` lack a `/catchup` row and a squash-default mention. (Detailed Findings → Distribution; Issue #1 acceptance criterion #4)
- `CORRECTION:` `.claude/commands/playbook-update.md:13-43` managed-files list does not include `catchup.md`; Task 8 must add it. (Detailed Findings → Distribution)
- `RISK:` Conflict resolution can drop independent additions; the conflict prompt must explicitly bias toward keeping both. (Risk Analysis; Axis 4)
- `RISK:` `origin/HEAD` may be unset after `git clone` without `set-head`; Axis 1 needs a fallback. (Risk Analysis; Axis 1)
- `RISK:` `CLAUDE.md` validation sections are human-readable prose, not machine-parseable; agent interpretation can misfire. (Risk Analysis; Axis 6)
- `RISK:` Auto-push narrows reversibility to `git revert`; pre-push retains `reset --hard ORIG_HEAD`. (Risk Analysis; Axes 9, 10)
- `RISK:` Globally installed `/push-pr` recommending `/catchup` requires `/catchup` to also be globally installed. (Risk Analysis; Axis 13)
- `RISK:` Strict-checks repos may have GitHub-side staleness gates that fire even when the local gate passes. (Risk Analysis)
- `RISK:` Mid-merge `MERGE_HEAD` from a prior abandoned `/catchup` run needs handling. (Risk Analysis; Axis 5)
- `TRADE-OFF:` Default-branch detection — local `origin/HEAD`, `gh` API, PR-base-derived, or developer prompt. (Axis 1)
- `TRADE-OFF:` Staleness check location — inline duplicated, helper script, or signal-only-in-push-pr. (Axis 2)
- `TRADE-OFF:` Catch-up operation — merge default in vs. opt-in rebase. (Axis 3)
- `TRADE-OFF:` Conflict surfacing UX — single report, file-by-file walk, or developer-led. (Axis 4)
- `TRADE-OFF:` In-progress merge handling — auto-continue, warn-and-ask, or refuse. (Axis 5)
- `TRADE-OFF:` Validation hook source — CLAUDE.md sections, dedicated config, env var, or `--validate` flag. (Axis 6)
- `TRADE-OFF:` Validation trigger — always, only-on-conflict, opt-in, or skip-on-placeholder. (Axis 7)
- `TRADE-OFF:` Already-up-to-date short-circuit — pre-merge rev-list, post-merge string parse, or merge-base ancestor check. (Axis 8)
- `TRADE-OFF:` Reversibility surface placement — up-front, inline at applicability, bottom-of-prompt, or on-demand. (Axis 9)
- `TRADE-OFF:` Post-validation handoff — recommend `/push-pr`, auto-push, or stop with no recommendation. (Axis 10)
- `TRADE-OFF:` Issue #1 PR-title source — developer-supplied, latest-commit-derived, branch-name-derived, or hybrid confirm. (Axis 11)
- `TRADE-OFF:` `/catchup` argument shape — no args, base override, rebase flag, or both. (Axis 12)
- `TRADE-OFF:` Distribution surface — managed-files only, plus global-install, or local-only. (Axis 13)
