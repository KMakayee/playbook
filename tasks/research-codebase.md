# Research: Make `/checkpoint` reliable for suspend and resume

## Research Question

Rework `.claude/commands/checkpoint.md` so it reliably captures suspend state and rehydrates it in a fresh session. Two modes: (a) **QRSPI waypoint** inside an active task that auto-captures phase + step/batch + cursor, and (b) **standalone snapshot** outside QRSPI for ad-hoc saves. State capture must be automatic (filesystem + git, not agent recall). Checkpoints commit to git on creation as backups. On resume, the artifact is consumed (deleted/git-rm'd) so stale checkpoints can't accumulate. Acceptance: end-to-end test where a mid-batch checkpoint is created, the session exits, a fresh session resumes, state rehydrates cleanly, and the artifact is consumed.

## Summary

`/checkpoint` is a 13-line markdown command that asks the agent to write a free-form prose snapshot to `tasks/checkpoint.md`. It does not inspect filesystem or git, does not commit, has no resume path, and no consumer ever deletes the artifact — so stale checkpoints leak past `/finish` and are not surfaced by `/playbook-audit`. The rework is a documentation/harness change (no Python/JS); "implementation" means rewriting `.claude/commands/checkpoint.md` and touching neighboring lifecycle commands so the new artifact is owned end-to-end.

The most important architectural insight is that **most of the QRSPI position is already inferable from the filesystem alone**:

- **Phase** is encoded in which singleton artifacts exist: research done iff `tasks/research-codebase.md` exists, design done iff `tasks/design-decision.md` exists, plan done iff `tasks/plan.md` exists, implement-in-progress iff `tasks/plan.md` has unchecked `- [ ]` boxes (`research-codebase.md:17-19`, `design.md:14-17`, `create-plan.md:14-18`, `implement.md:9-25`).
- **Cursor inside `/implement`** is already extracted by `/implement` step 3 via the first unchecked `- [x]` checkbox (`implement.md:21-25`).
- **Issue flow** mirrors this with `tasks/research-issue-<N>.md` and `tasks/plan-issue-<N>.md` (`issue-research-codex.md:50`, `issue-plan.md:31`, `issue-implement.md:20-23`).

Because phase + cursor are already filesystem-derivable, the rework's "automatic state capture" requirement is largely a matter of **inspecting and recording** what's there, not inventing new tracking. The genuinely new decisions are: (1) what container the checkpoint lives in (single file vs. timestamped vs. directory), (2) how the working diff is preserved (in-artifact vs. real WIP commit), (3) how resume is triggered and how it consumes the artifact, and (4) how `/finish` and `/playbook-audit` learn to clean up checkpoints.

A second insight: there is **no current SessionStart hook**. `.claude/settings.local.json` contains permissions only. Every existing "session-start" behavior (the `Session-Start Validation` block in `CLAUDE.md:198-203`, and `templates/playbook-sections.md:153-159`) is natural-language instruction that Claude reads from `CLAUDE.md` and follows on its own. So "automatic resume on new session" must work the same way — checkpoint detection lives in `CLAUDE.md`'s session-start block, not in a settings hook. That keeps Task 1 within the existing harness model and avoids verifying hook schemas (which the repo has previously gotten wrong — see `tasks/errors.md:5-10`).

A third insight: the **current installed `CLAUDE.md` and `templates/playbook-sections.md` are out of sync**. The template (line 153-159) has a "Leftover artifacts" check at the top of `Session-Start Validation`; the installed `CLAUDE.md` (line 198-203) does not. So whatever checkpoint-detection text the rework adds must land in both files; `/playbook-update` will eventually propagate it, but Task 1's plan should update both.

Fourth insight: the user explicitly cited **multi-batch plan suspension** as the load-bearing use case. Inside `/implement`, the plan checkbox cursor is the position. Between batches the user is already expected to compact (`CLAUDE.md:144-146`, `quickref.md:127`). So the checkpoint's job between batches is small: confirm the plan is committed, capture the active task's QRSPI artifact set + branch, and write a tiny resume note. Most of the work the prior `/checkpoint` did (free-form prose) is redundant with what's already in the plan file.

Fifth insight: **what to commit on creation** is the choice that most affects UX. If checkpoint embeds the diff text inside the markdown, the worktree can stay dirty across sessions but resume must re-apply edits (and the 100-line cap conflicts with non-trivial diffs). If checkpoint promotes the in-progress edits into a real `wip:` git commit, the worktree is clean and resume just reads the checkpoint file and continues — but it pollutes git history with WIP commits that need squashing later. This is the central design choice for /design to resolve.

## Detailed Findings

### Current `/checkpoint` command

`.claude/commands/checkpoint.md` (13 lines total) tells the agent to write `tasks/checkpoint.md` with six prose sections (phase / done / next / artifacts / decisions / risks), keep it under 100 lines, overwrite, and confirm. There is no instruction to run `git status`, inspect any artifact, commit, or behave differently in QRSPI vs. standalone contexts. The "≤100 lines" cap is incompatible with embedding non-trivial diffs in the artifact.

### QRSPI lifecycle and where checkpoint plugs in

The QRSPI command chain has well-defined prerequisite gates:

- `/research-codebase` refuses to start if any of the four singleton artifacts exist (`research-codebase.md:17-19`).
- `/design` refuses without `tasks/research-codebase.md` (`design.md:14-17`).
- `/create-plan` refuses without research and design (`create-plan.md:14-18`).
- `/implement` refuses without `tasks/plan.md` and `tasks/research-codebase.md` (`implement.md:9-19`); on entry it scans `tasks/plan.md` for `- [x]` and resumes from the first unchecked phase, trusting earlier completions (`implement.md:21-25`).
- `/finish` (`finish.md:10-31`) verifies the plan is fully checked, marks the todo done, commits everything including the four QRSPI artifacts, pushes, then `git rm`s the four QRSPI artifacts in a local follow-up commit. **`tasks/checkpoint.md` is never touched** — this is why stale checkpoints leak.
- `/playbook-audit` (`playbook-audit.md:52-68`) scans `tasks/` for the four QRSPI artifacts plus `tasks/plan-issue-*.md` and `tasks/research-issue-*.md`. **No checkpoint files are listed** — second leak vector.

Phase is therefore implicit in the artifact set. The rework's "auto-capture" can simply enumerate which of these files exist, parse `tasks/plan.md` for cursor position, and synthesize the rest.

### Issue flow (parallel artifacts)

Issue commands use `$ARGUMENTS` (issue number `N`) and produce per-issue artifacts: `tasks/research-issue-<N>.md`, `tasks/plan-issue-<N>.md`. `/issue-implement.md:20-23` handles resume by checkmark scan but, unlike `/implement`, asks the developer to confirm before resuming. Issue artifacts are committed and **not removed** by `/issue-implement` (`issue-implement.md:53` — "do NOT remove them"). `/auto-issues` cleans them in Phase 11 (`auto-issues.md:154-170`), and the only existing mechanical evaluator (`pipeline-eval.sh`) is issue-pipeline-specific.

Multiple issues can be in flight (`tasks/plan-issue-3.md`, `tasks/plan-issue-7.md`), so a checkpoint inside the issue flow must encode which issue is active. The simplest signal is the issue number embedded in the most-recently-modified `plan-issue-<N>.md` file, but ambiguity is possible if multiple are stale.

### Multi-batch plan model

`CLAUDE.md:140-146` ("Multi-Batch Plans") instructs `/create-plan` to identify independent batches, sets the rule "one batch per `/implement` cycle," and tells the agent to compact between batches. `quickref.md:127` repeats this. The checkbox cursor inside `tasks/plan.md` is the only structural signal for which batch is next; there's no separate batch-tracking metadata. So a checkpoint between batches reduces to: (a) confirm the plan is committed with the latest checkmarks, (b) snapshot branch + uncommitted diff state, (c) note "next batch: <heading from first unchecked block>" so resume can read it directly.

### Session-start validation

`CLAUDE.md:198-203` has two checks: unconfigured CLAUDE.md, playbook age. **The installed CLAUDE.md does NOT have a leftover-artifact check** — but `templates/playbook-sections.md:153-159` does (it lists the four QRSPI artifacts plus `plan-issue-*.md` / `research-issue-*.md`). The template adds: "If found, notify the developer and ask whether to clean up or resume."

This is the natural insertion point for "if `tasks/checkpoint.md` (or whatever the rework names it) exists, ask whether to resume." Because session-start validation is plain natural-language instructions Claude follows from `CLAUDE.md`, the rework can extend it without touching `.claude/settings.local.json` or any hook schema.

### Settings and hooks

`.claude/settings.local.json` is permissions-only — `Bash`, `WebSearch`, `WebFetch`, two skill grants. There are no `hooks`, no `SessionStart`, no other behaviors. `tasks/errors.md:5-10` records that the playbook previously misreported hook schema details, so adding hook-based behavior would carry verification overhead.

### Child-process / `claude -p` precedent

`/auto-issues` runs every phase as a separate `claude -p "Read .claude/commands/X.md and follow its instructions exactly..."` child process, with `--dangerously-skip-permissions` and logs in `tasks/logs/` (`auto-issues.md:30-135`). `/implement.md:118-126` and `/design.md:184-189` use the same pattern for code-review fixes and pattern research. So "resume by spawning a child process that re-enters the right command" has precedent — but it's heavy and needed only if the resume agent shouldn't share parent context, which is the opposite of what's wanted here. Inline resume (read the checkpoint, follow the instructions in the same session) is simpler and matches how Claude already follows `CLAUDE.md` instructions on session start.

### Commit conventions

Recent log uses conventional commits (`docs:`, `fix:`, `chore:`, `feat:`, `refactor:`). `/finish` uses `chore: clean up QRSPI artifacts for <subject>` for cleanup commits (`finish.md:31`). `/auto-issues` Phase 11 uses `chore: clean up issue #N artifacts` (`auto-issues.md:168`). For checkpoint, plausible verbs: `wip:` for in-progress commits, `chore:` for checkpoint-file commits and cleanup commits.

### Distribution / managed-file list

`.claude/commands/playbook-update.md:9-43` enumerates "managed files" that `/playbook-update` synchronizes. It already lists `.claude/commands/checkpoint.md` (line 37). If the rework introduces new files (e.g., `.claude/commands/resume.md`, a new template, or a verification script), they must be added to this list so installs/upgrades carry them.

`/playbook-setup.md:135-143` and `/playbook-update.md:154-179` both have a "Verify maintainer artifacts" step that warns if `tasks/{todo,errors,issues}.md` are present. The rework should consider whether `tasks/checkpoint.md` (or the new container) needs a similar guard against leakage from the maintainer's working state.

### Documentation surface

`README.md:74` and `quickref.md:47` describe `/checkpoint` as "Save current work state to `tasks/checkpoint.md`." Both will need updating once the new behavior is in place. README's setup snippet (`README.md:18`) already runs `rm -rf tasks` to clear maintainer artifacts on install — checkpoints created during testing in this repo would also be cleared by that step.

## Code References

- `.claude/commands/checkpoint.md:1-13` — current command, prose-only, no automation.
- `.claude/commands/research-codebase.md:17-19` — research prerequisite gate (refuses on any singleton artifact).
- `.claude/commands/design.md:14-17` — design prerequisite gate.
- `.claude/commands/create-plan.md:14-18` — plan prerequisite gate.
- `.claude/commands/implement.md:9-25` — implement prerequisite + checkmark resume.
- `.claude/commands/implement.md:45-50` — checkmarks written to `tasks/plan.md` per phase.
- `.claude/commands/finish.md:20-31` — commits then `git rm`s the four QRSPI artifacts; checkpoint omitted.
- `.claude/commands/playbook-audit.md:52-68` — artifact cleanup scan; checkpoint omitted.
- `.claude/commands/playbook-setup.md:135-143` — maintainer-artifact leakage guard; checkpoint not listed.
- `.claude/commands/playbook-update.md:9-43` — managed-files distribution list; includes `checkpoint.md`.
- `.claude/commands/playbook-update.md:154-179` — second maintainer-artifact guard.
- `.claude/commands/issue-research-codex.md:50`, `issue-plan.md:31` — issue artifact paths.
- `.claude/commands/issue-implement.md:20-23` — issue resume flow (asks developer).
- `.claude/commands/issue-implement.md:53` — issue artifacts not removed by issue-implement.
- `.claude/commands/auto-issues.md:30-135` — `claude -p` child-process precedent.
- `.claude/commands/auto-issues.md:154-170` — issue artifact cleanup pattern.
- `.claude/commands/auto-issues.md:168` — `chore:` cleanup commit message.
- `.claude/commands/commit.md:1-13` — generic stage/commit/push flow.
- `.claude/scripts/pipeline-eval.sh:1-70` — only mechanical evaluator; issue-pipeline scoped.
- `CLAUDE.md:140-146` — multi-batch plan rule.
- `CLAUDE.md:198-203` — installed session-start validation (2 checks; missing leftover-artifact check).
- `CLAUDE.md:152-172` — compaction rules.
- `CLAUDE.md:176-178` — recursion guard for sub-agents.
- `templates/playbook-sections.md:153-159` — template session-start validation (3 checks, includes leftover artifacts).
- `tasks/errors.md:5-10` — record of past hook-schema misreport.
- `.gitignore:1-3` — `tasks/` is tracked.
- `README.md:74`, `quickref.md:47` — public docs describe `/checkpoint` as save-only.
- `.claude/settings.local.json:1-10` — permissions only; no hooks.

## Architecture Analysis

The playbook is a markdown harness. There is no application runtime; "code" means slash-command markdown that Claude reads and follows. State persistence is filesystem-based (`tasks/`), and inter-session handoff is by disk artifact, exactly as the issue pipeline already does (`auto-issues.md:3` — "Artifacts on disk are the handoff between phases").

Three patterns recur and are load-bearing:

1. **Prerequisite gates by file existence** — every QRSPI command checks for required input files and refuses if absent. Phase is therefore *implicit*, derivable from `ls tasks/`.

2. **In-band cursor via checkboxes** — `/implement` and `/issue-implement` use `- [x]` in `tasks/plan.md` as the only progress marker. There is no parallel state file. This is a deliberate design choice: the plan IS the progress tracker (`issue-implement.md:67`).

3. **Disk-mediated handoff** — `/auto-issues` and the parent/child `claude -p` invocations in `/implement.md` and `/design.md` show the precedent for "session A writes file → session B reads file → continues." Logs go to `tasks/logs/`, control state goes to `tasks/`.

The rework should fit these patterns: encode checkpoint state in a markdown file that downstream commands can read, derive position from the existing artifact set + plan checkboxes rather than introducing a parallel cursor format, and lean on `claude -p` only if a fresh-context resume is needed (it isn't — resume happens in the new user-driven session).

## Design Axes

### Axis A: Create-command surface

- **Choices:** (A1) extend `/checkpoint` with arg-based modes; (A2) keep `/checkpoint` for create only and add a separate `/resume` slash command; (A3) one command with auto-mode (no args, decides based on filesystem state); (A4) reuse `/checkpoint` by inspecting whether a checkpoint already exists and routing to resume automatically.
- **Per-axis constraints:** must remain a markdown command file under `.claude/commands/`; any new file must be added to the managed-files list at `playbook-update.md:9-43`; public docs (`README.md:74`, `quickref.md:47`) must be updated.
- **Evidence:** current single-purpose command (`checkpoint.md:1-13`); precedent for argument-based variants (`research-codebase.md:3-5`, every `issue-*.md`); precedent for separate verbs (`/research-codebase` vs. `/design`).

### Axis B: Resume-trigger mechanism

- **Choices:** (B1) explicit slash invocation by the user (`/resume` or `/checkpoint resume`); (B2) session-start validation in `CLAUDE.md` detects `tasks/checkpoint.md`, prompts the user, and the user confirms; (B3) settings-hook (`SessionStart` hook in `.claude/settings.json`) auto-runs detection; (B4) `claude -p` child process re-enters the relevant command.
- **Per-axis constraints:** session-start checks must remain "lightweight, no sub-agents, under 30 seconds" (`CLAUDE.md:200`); hook-based options must verify schema (the repo got hook schemas wrong before — `tasks/errors.md:5-10`); B2 requires updating both `CLAUDE.md` and `templates/playbook-sections.md` (currently out of sync, `:198-203` vs. `:153-159`).
- **Evidence:** no hooks in `.claude/settings.local.json`; existing session-start validation is natural-language instructions (`CLAUDE.md:198-203`); `claude -p` precedent for parent/child (`auto-issues.md:30-135`).

### Axis C: Storage shape and keying

- **Choices:** (C1) single file `tasks/checkpoint.md`; (C2) timestamped file `tasks/checkpoint-<timestamp>.md`; (C3) directory `tasks/checkpoints/<id>.md`; (C4) scoped name `tasks/checkpoint-issue-<N>.md` for issue-flow checkpoints + `tasks/checkpoint.md` for QRSPI/standalone.
- **Per-axis constraints:** path must not collide with the four QRSPI singleton paths or `plan-issue-*.md` / `research-issue-*.md` patterns; cleanup lists in `/finish` and `/playbook-audit` must enumerate or glob the chosen shape; `/playbook-setup`'s and `/playbook-update`'s maintainer-artifact warnings may also need to know the path; "consume on resume" semantics depend on whether multiple can coexist.
- **Evidence:** single-path precedent (`checkpoint.md:3`); timestamped precedent (`auto-issues.md:19-24` logs); issue-scoped precedent (`issue-plan.md:31`).

### Axis D: Artifact schema

- **Choices:** (D1) free-form markdown with stable section headings (current shape); (D2) YAML/key-value frontmatter + markdown body; (D3) stable headings with embedded fenced blocks for `git status`, `git diff`, plan-cursor snippet, branch, current-batch heading; (D4) hybrid — frontmatter for machine-parsable phase/branch/cursor-line, body for human notes.
- **Per-axis constraints:** task requires "automatic state capture" — pure free-form (D1) is **ruled out**; current 100-line cap conflicts with embedding diffs (`checkpoint.md:12`); no implementation parser exists, so structure is enforced only by what Claude reads back.
- **Evidence:** markdown templates as standard (`research-codebase.md:89-145`, `templates/audit-report.md:24-33`); key-value precedent (`.playbook-version` template at `playbook-update.md:137-146`).

### Axis E: Auto-detection scope (what counts as "the active task")

- **Choices:** (E1) singleton QRSPI only — `tasks/{research-codebase,design-decision,research-patterns,plan}.md`; (E2) singleton + issue-flow — also scan `tasks/{research,plan}-issue-*.md`; (E3) E2 + branch + uncommitted diff to disambiguate; (E4) E3 + most-recently-modified heuristic to pick the active issue when multiple are present.
- **Per-axis constraints:** capture must be filesystem/git-derived (no recall); `tasks/research-patterns.md` is optional and not a phase boundary; multiple issue artifacts may coexist; standalone mode must work with zero artifacts present.
- **Evidence:** phase gates at `research-codebase.md:17-19`, `design.md:14-17`, `create-plan.md:14-18`, `implement.md:9-19`; issue paths at `issue-plan.md:9-15`; status flow in `templates/new-issues.md:3-5`.

### Axis F: Plan-cursor extraction granularity

- **Choices:** (F1) record the file path only — let resume re-scan checkmarks via existing `/implement` step 3; (F2) record file path + first unchecked checkbox text; (F3) F2 + nearest enclosing heading (the "batch heading"); (F4) F3 + an inline snippet of the next batch block.
- **Per-axis constraints:** plan format is intentionally flexible (`create-plan.md:39`); `/implement.md:21-25` already extracts F1; multi-batch rule is "one batch per prompt" (`CLAUDE.md:140-146`).
- **Evidence:** existing checkmark resume in both `/implement.md:21-25` and `/issue-implement.md:20-23`; no batch metadata schema today.

### Axis G: What to commit on creation

- **Choices:** (G1) commit only the checkpoint file; (G2) checkpoint file + `git add -u` of all currently-tracked changes (a real WIP commit); (G3) G2 + interactive prompt for untracked files (mirroring `/finish` behavior); (G4) G2 + auto-stage untracked files under `tasks/` only.
- **Per-axis constraints:** task requires "checkpoints commit to git on creation"; conventional commit style is established; `/implement` commits per phase (`implement.md:47-50`) — overlap risk if checkpoint also commits the phase; untracked staging is interactive in `/commit` and `/finish` but auto in `/auto-issues` (`auto-issues.md:130-140`).
- **Evidence:** commit flow (`commit.md:8-12`); finish flow (`finish.md:20-28`); auto-issues noninteractive commit (`auto-issues.md:130-140`).

### Axis H: How in-progress edits are preserved

- **Choices:** (H1) embed `git diff` output as a fenced block inside the checkpoint markdown — worktree stays dirty after creation (the diff is the snapshot, not the head); (H2) promote uncommitted edits into a real `wip:` commit pointed-to from the checkpoint — worktree clean, history has WIP commits; (H3) write the checkpoint file but don't try to preserve uncommitted edits — user is responsible; (H4) hybrid — small diffs (under N lines) embed inline, large diffs trigger H2.
- **Per-axis constraints:** if H1 is chosen, the 100-line size cap from `checkpoint.md:12` must be relaxed; if H2 is chosen, resume must surface the WIP-commit hash and recommend a squash before /finish; H3 violates the spirit of "doubles as a backup."
- **Evidence:** no current precedent for `wip:` commits; recent log uses `feat/fix/chore/docs/refactor` only; `/commit` does staging but not WIP semantics; auto-issues commits per phase but doesn't suspend mid-phase.
- **Coupling:** **tightly coupled to Axis G** — H1 implies G1 (only the markdown is committed), H2 implies G2-G4 (real edits are committed too).

### Axis I: Resume execution model

- **Choices:** (I1) inline read-and-follow — current session reads checkpoint, follows its embedded "next-step" instructions in-context; (I2) child-process re-entry — spawn `claude -p "Read .claude/commands/<phase>.md..."` similar to auto-issues; (I3) prompt-and-handoff — Claude prints exact commands the user runs themselves; (I4) Claude invokes the next slash command directly (no precedent in the repo).
- **Per-axis constraints:** resume should rehydrate the *current* session's working memory, not start fresh — argues against I2; recursion guard applies to sub-agents but not to current-session reads (`CLAUDE.md:176-178`); no slash-from-slash invocation precedent (I4 unproven).
- **Evidence:** auto-issues child-process pattern (`auto-issues.md:30-135`); no inline `/foo`-from-inside-`/bar` precedent.

### Axis J: Consumption mechanic on resume

- **Choices:** (J1) `git rm` + commit immediately on resume (mirrors `/finish.md:29-31`'s cleanup); (J2) `rm` (untracked deletion) — but the file is already tracked once committed in G/H, so this leaves a dirty index; (J3) `git rm` and let the deletion sit staged for the next normal commit; (J4) move to `tasks/checkpoints/consumed/` instead of deleting (history-preserving but adds a new directory the rest of the harness must learn).
- **Per-axis constraints:** task requires "consumed and deleted after rehydration"; J4 is technically not "deleted"; J1 produces an extra commit per resume which clutters history; J3 combines cleanly with the next normal commit but means the file lingers staged-deleted in the working tree until then.
- **Evidence:** `/finish.md:29-32` precedent for "rm + chore commit not pushed"; `/auto-issues.md:154-170` precedent for "rm artifacts + chore commit + push."

### Axis K: Lifecycle integration scope

- **Choices:** (K1) update `/checkpoint` only (minimum viable); (K2) K1 + extend `/finish` cleanup list and `/playbook-audit` scan; (K3) K2 + update session-start validation in both `CLAUDE.md` and `templates/playbook-sections.md` for resume detection; (K4) K3 + update `README.md`, `quickref.md`, `playbook-update.md` managed-files list, and the maintainer-artifact warnings in `/playbook-setup` and `/playbook-update`; (K5) K4 + add a `pipeline-eval`-style verification script for the end-to-end test.
- **Per-axis constraints:** the rework's three named problems (capture, mode, accumulation) cannot all be fixed by K1 alone — accumulation requires `/finish` + `/playbook-audit` updates (so K2 is the lower bound); the user's acceptance criterion (end-to-end test) implies at least manual dogfood, K5 makes it mechanical.
- **Evidence:** `/finish.md:20-31` skips checkpoint; `/playbook-audit.md:52-60` skips checkpoint; `/playbook-update.md:9-43` distribution list.

## Axis Coupling

- **G ↔ H (tight):** If H = H1 (diff embedded in markdown) → G is forced to G1 (commit only the file). If H = H2 (WIP commit) → G must be G2/G3/G4 (commit code edits too) and Axis I's resume must surface the WIP commit hash for context.
- **A ↔ B:** If A = A2 (separate `/resume`) → B = B1 (explicit slash trigger) is natural; if A = A3 or A4 (single-command auto-mode) → B = B2 (session-start prompt) integrates cleanly.
- **C ↔ J:** If C = C1 (single file) → J = J1 or J3 work. If C = C2/C3 (timestamped/dir) → J needs glob-aware cleanup logic, and resume must select which checkpoint to consume (latest by mtime, or explicit identifier).
- **C ↔ E:** If C includes issue scope (C4) → E must produce the right key (issue number) to choose the file; if C is a single file (C1) → E's output is just text content, no key needed.
- **D ↔ E ↔ F:** D's structured fields (D2/D3/D4) directly determine what E and F can record. Free-form (D1) makes E and F implicit-only and is anyway ruled out by the task constraint.
- **B ↔ I:** B = B3 (settings hook) is incompatible with I = I1 (inline read), since a hook executes outside the conversation; B = B2 (session-start NL instruction) is compatible with all of I1/I2/I3.
- **K ↔ everything:** K2 is the floor regardless of other choices (otherwise stale checkpoints still leak); K3+ depend on B = B2; K4's docs-and-distribution scope depends on whether new files are created (Axis A).

## Cross-Cutting Constraints

- This is a markdown/harness change. No Python/JS/TS — the artifact is `.claude/commands/checkpoint.md` plus possibly new commands and template/CLAUDE.md edits.
- Sub-agents must not spawn sub-agents (`CLAUDE.md:176-178`).
- The four QRSPI artifact paths are LOCKED for Task 1 — the directory restructure that would change them is in the Deferred item gated on Task 7 (`tasks/todo.md:46`).
- `tasks/` is tracked in git (`.gitignore:1-3`). New artifact files will be tracked by default.
- Conventional commit messages — recent log uses `feat/fix/chore/docs/refactor`; if `wip:` is introduced (Axis H2), it's a new convention worth flagging.
- Plans are progress trackers via checkboxes — do not introduce a parallel cursor file; record only what's needed to *find* the cursor in the plan.
- Any new managed file must be added to `playbook-update.md:9-43` so installs/upgrades carry it.
- Public docs (`README.md`, `quickref.md`) describe `/checkpoint` and must stay accurate.
- Session-start validation must remain "no sub-agents, under 30 seconds" (`CLAUDE.md:200`).
- The currently installed `CLAUDE.md` is missing the leftover-artifact check that `templates/playbook-sections.md` has — any update to session-start validation should land in both files.

## External Research

No external knowledge gates an axis evaluation. Every viable choice has codebase precedent:

- Axis B's hook-based path (B3) is the only choice that would require external schema verification. **It is not a forced choice** — every other option in B is evaluable from codebase + spec alone, and the existing session-start validation pattern (B2) is closer to how the harness works today. If `/design` selects B3, external research on Claude Code's `SessionStart` hook schema becomes mandatory; otherwise it is not needed.
- Axis I's child-process choice (I2) has direct codebase precedent (`auto-issues.md:30-135`). No external research required.
- Axis I4 ("Claude invokes a slash command directly") has no codebase precedent and would require external verification of whether slash commands can be programmatically invoked from inside a slash-command file. If `/design` reaches for I4, that becomes a mandatory external check; otherwise skip.

The recommendation for `/design` is to prefer choices that don't trigger external research — the default path (B2 + I1) is fully evaluable from this artifact.

## Risk Analysis

- **Phase commit overlap.** If checkpoint commits during `/implement` (Axis G2-G4) and `/implement` itself commits per phase (`implement.md:47-50`), checkpoints created mid-phase produce a `wip:` commit followed by a `feat:` phase commit. This is fine but should be documented; resume needs to know the checkpoint commit may be older than the latest checkpoint info.
- **WIP commit pollution.** Axis H2 introduces `wip:` commits into history. If `/finish` doesn't squash or note them, the eventual PR will carry them. The plan must specify how WIP commits are reconciled before `/finish`.
- **Stale checkpoint blocks new task.** If a checkpoint exists from an abandoned task and the user starts a new task without resuming or cleaning, the resume prompt will keep firing. Mitigation: session-start prompt should offer "resume / discard" not just "resume," and `/playbook-audit` should list checkpoints.
- **Issue-flow ambiguity.** With multiple in-flight issues, auto-detection must pick the right one. The simplest rule (most recently modified) can pick wrong if the user touched a stale plan. Mitigation: in-issue-flow checkpoints should encode the issue number explicitly (Axis C4 or D2 frontmatter).
- **Worktree mismatch on resume.** If the user resumes on a different branch than was checkpointed, applying an embedded diff (Axis H1) may conflict. Mitigation: checkpoint records branch + commit, resume warns on mismatch.
- **Compaction race.** The `Compaction Rules` block (`CLAUDE.md:152-172`) tells Claude to compact at 30-35% utilization. If `/checkpoint` runs *just before* compaction, the checkpoint file is on disk and survives — good. If it runs *during* compaction (the agent compacts mid-tool-call), state may be inconsistent. Mitigation: the rework should explicitly instruct that creating a checkpoint is itself a compaction trigger (or runs before compaction), so the two operations don't race.
- **Acceptance test coverage.** The user's "create mid-batch, exit, fresh-resume, verify rehydration, verify consumption" can be partially automated (file presence + consumption checks via shell), but verifying that the agent *actually* picks up at the right batch is judgment-intensive. Mitigation: provide a documented dogfood script + a small `checkpoint-eval.sh` that does the mechanical pieces; flag the agent-judgment piece as manual.
- **Doc drift.** Updating `README.md` and `quickref.md` is easy to miss. If the rework is K1-K3 only, the public docs go stale. Mitigation: K4 is the practical minimum for shippable rework.
- **Hook schema risk.** If Axis B3 is somehow selected later, recall that `tasks/errors.md:5-10` records a prior misreport — verify against the live Claude Code docs before writing the hook config.

## Open Questions

- **Same-session vs. cross-session use.** The user said "quick saves" for standalone mode. Does that mean (a) save and keep working — a backup point you can roll back to without exiting; or (b) save and exit, expecting a new session later? Both are valid; the choice affects whether resume is mandatory after every checkpoint or optional. *Non-blocking — `/design` can pick a default and document it.*
- **Multiple checkpoints stacking.** If the user runs `/checkpoint` twice in the same session, do we (a) overwrite, (b) error, (c) stack? Couples to Axis C. *Non-blocking — once C is chosen, this resolves.*
- **WIP-commit reconciliation.** If Axis H2 is chosen, where does the squash happen? In `/finish`? On resume? At the user's discretion? *Non-blocking — `/design` should specify a default.*
- **Branch enforcement.** Should resume refuse if the current branch differs from the checkpointed branch, or just warn? *Non-blocking — warn is the conservative default.*
- **Issue-flow checkpoint key.** When in issue mode, encode the issue number in the filename (Axis C4) or only in frontmatter (Axis D2)? Filename makes glob-cleanup trivial; frontmatter keeps a single canonical path. *Non-blocking — `/design` to choose.*
- **Test-script scope.** Add a `checkpoint-eval.sh` for the end-to-end test (Axis K5), or rely on a documented manual dogfood? *Non-blocking — the user explicitly called out the end-to-end test, so K5 has clear value, but K4 is sufficient if the manual procedure is well documented.*
