# Design: Make `/checkpoint` reliable for suspend and resume

## Context

The current `/checkpoint` (`.claude/commands/checkpoint.md:1-13`) is a 13-line prose-only command: the agent writes a free-form summary to `tasks/checkpoint.md`, never inspects filesystem or git, never commits, has no resume path, and no downstream consumer deletes the artifact. Stale checkpoints leak past `/finish` (`finish.md:20-31`) and are not surfaced by `/playbook-audit` (`playbook-audit.md:52-68`).

The rework must deliver:

1. **Automatic state capture** — phase/cursor/branch come from filesystem + git, not agent recall.
2. **Two modes** — a QRSPI waypoint (captures phase + plan-cursor + batch heading) and a standalone snapshot (usable outside QRSPI).
3. **Commit on creation** — checkpoints double as git-backed backups.
4. **Resume consumes the artifact** — after rehydration the checkpoint is deleted (via `git rm`) so stale checkpoints cannot accumulate.
5. **Acceptance test** — mid-batch checkpoint → exit session → fresh session resumes at the exact cursor → artifact is gone.

Load-bearing research findings the options inherit:

- **Phase is already filesystem-derivable** from the four QRSPI singletons + `tasks/plan.md` checkboxes (research §Summary insight 1). Capture is an *inspection* problem, not a new tracking layer.
- **There is no SessionStart hook** — every "session-start" behavior today is natural-language instruction inside `CLAUDE.md:198-203` / `templates/playbook-sections.md:153-159` that Claude reads and follows (research §Summary insight 2). Prior hook work has been misreported (`tasks/errors.md:5-10`), so hook-based designs carry verification cost.
- **`CLAUDE.md` and `templates/playbook-sections.md` are already out of sync** on session-start validation (installed: 2 checks; template: 3 checks, including leftover artifacts). Any session-start change must land in both.
- **Multi-batch suspension is the load-bearing use case** — between batches the plan already holds the cursor; checkpoint just records phase + active artifact set + branch (research §Summary insight 4).
- **G ↔ H is the central design tension** (research §Summary insight 5): either embed the diff in the markdown (worktree stays dirty, single commit) or promote uncommitted edits into a `wip:` commit (worktree clean, history gains WIP commits needing squash).

**Research:** `tasks/research-codebase.md`

## Options Considered

Each option below names its axis-choice combination using the axes in `tasks/research-codebase.md` §Design Axes. All three share a floor set of choices derived from decision heuristics and from coupling constraints:

- **D4** — short YAML-style frontmatter (mode, branch, HEAD sha, detected phase, plan path, first-unchecked cursor line, batch heading, issue number if applicable) plus a markdown body. A stable keyed header is trivial for Claude to re-read on resume without a parser; free-form prose (D1) is ruled out by the automatic-capture constraint.
- **E2** — QRSPI singletons + issue-flow (`tasks/{research,plan}-issue-*.md`). E1 omits issue flow (a regression); E3/E4 layer extra disambiguation that isn't needed when issue ambiguity resolves via an explicit fallback. When a single QRSPI/issue artifact is present, it's the active scope; when multiple `plan-issue-*.md` files exist and the active one can't be resolved from artifact presence alone, prompt the user for the issue number or fall back to standalone mode — the plan phase picks the default. (Note: branch-based disambiguation would move this to E3; we stay on E2 because we're not reading branch state for scope selection.)
- **F3** — file path + first unchecked checkbox text + nearest enclosing heading. F1/F2 lose batch context; F4 embeds a full block that duplicates the plan.
- **I1** — inline read-and-follow on resume. I2 (child process) matches auto-issues but starts fresh context, which is the opposite of what resume needs; I3 hands off to the user; I4 has no precedent (research §External Research).
- **J1** — `git rm` the checkpoint + commit on resume (mirrors `/finish.md:29-31`). J2 leaves a dirty index; J3 leaves the deletion staged until the next commit (confusing); J4 keeps a consumed/ directory (new pattern, no value).
- **K4** — update `/checkpoint`, `/finish` cleanup list, `/playbook-audit` scan, session-start validation in both `CLAUDE.md` and `templates/playbook-sections.md`, `README.md:74`, `quickref.md:47`, the managed-files list in `playbook-update.md:9-43`, and the maintainer-artifact warnings in `/playbook-setup.md:135-143` and `/playbook-update.md:154-179`. K2 is the floor to stop leakage; K4 is the practical minimum for shippable rework (research §Risk Analysis "Doc drift"). K5 (test script) is called out in Open Questions.

The options differ on the **command surface (A)**, the **resume trigger (B)**, and — the central tension — **what gets committed on creation (G)** and **how in-progress edits are preserved (H)**.

### Option A — Embed-diff as recovery backup, single `/checkpoint` with auto-routing + NL session-start detection

**Axis choices:** **A1+A4 hybrid** + B2 + C1 + D4 + E2 + F3 + **G1 + H1** + I1 + J1 + K4.

- **A1+A4 hybrid** — `/checkpoint` is the only slash command. Its behavior routes off whether `tasks/checkpoint.md` already exists: no artifact → save; artifact present → prompt resume / discard / replace (no silent overwrite). Optional `resume` / `discard` args short-circuit the prompt. Keeps one command file and one managed-files entry. (Codex's A4 refinement: auto-routing on an existing artifact is safer than silent overwrite and is trivial to implement in the command prose.)
- **B2** — Session-start validation in `CLAUDE.md` / `templates/playbook-sections.md` detects `tasks/checkpoint.md` on entry and tells the user: *"Checkpoint found. Run `/checkpoint` to resume, discard, or replace."* No hook, no settings change.
- **C1** — Single path `tasks/checkpoint.md`. Two-in-a-session is handled by the A4 routing above (resume / discard / replace — no stacking).
- **D4** — Frontmatter keys: `mode` (qrspi | standalone), `branch`, `base_head` (short sha of HEAD *before* the checkpoint save commit — the diff's base; distinct from current HEAD after save), `phase` (research | design | plan | implement | none), `plan_path`, `cursor_line`, `cursor_text` (the unchecked item), `batch_heading`, `issue` (number or empty), `created_at`. Markdown body below: fenced ` ```diff ` block with `git diff --binary HEAD` output (`--binary` so recovery survives binaries), a fenced `untracked-content:` section that inlines each untracked file's contents when under the per-file size threshold, and a short "What's next" prose note auto-synthesized from the cursor context. If any untracked file exceeds the threshold (or the total approaches a pragmatic cap), the command stops and asks the user to `git add` the files, then re-run — backup fidelity is a hard requirement.
- **G1 + H1** — On creation, stage only `tasks/checkpoint.md` and commit it with `git commit --only -- tasks/checkpoint.md -m 'chore: checkpoint <subject>'` so any unrelated staged state in the user's index is not swept into the save commit. The worktree stays dirty for the user's in-progress edits — they survive across session exit because git doesn't clobber the working tree. **The embedded diff is a recovery backup, not the primary resume mechanism**: on resume, the existing dirty worktree is the source of truth; the diff in the artifact is consulted only if worktree state was lost (branch switch, reset, different machine). Resume does NOT automatically re-apply the diff. (Codex cross-check: re-applying by default would duplicate or conflict with the already-dirty tree.)
- **J1** — On resume, rehydrate first (read frontmatter, scan QRSPI artifacts, reconcile the cursor and branch), validate that rehydration is complete and correct, *then* consume: `git rm tasks/checkpoint.md` followed by `git commit --only -- tasks/checkpoint.md -m 'chore: consume checkpoint'` so the deletion commit isolates the checkpoint file from any unrelated staged state (no `git reset` needed — `--only` is path-scoped). Not pushed — rides on the next normal push like `/finish`'s cleanup commit (`finish.md:31-32`). If rehydration validation fails (branch mismatch the user declines to override, base_head drift, etc.), keep the checkpoint file for retry — do NOT consume until rehydration is confirmed successful.

**Why it works:** Avoids introducing a `wip:` commit convention (research §Cross-Cutting Constraints notes WIP is *not* in the current commit vocabulary). Single file, single commit on save, one slash-command surface. Matches existing precedent: single-file artifacts (four QRSPI singletons), auto-detect-on-entry (`/implement`'s checkmark resume at `implement.md:21-25`), NL session-start instructions (`CLAUDE.md:198-203`). The 100-line cap from `checkpoint.md:12` is explicitly relaxed in this option (diffs can be arbitrarily large).

**Why it hurts:** The worktree stays dirty after `/checkpoint` — anyone reading `git status` after save sees the same uncommitted changes as before, which makes "the checkpoint is saved" feel intangible to someone reading git state. Large diffs can balloon the artifact (readability concern, not a correctness one). **Untracked files require inline capture to count as backed up** (Codex risk): a names-only list doesn't preserve content, so the D4 schema mandates inline contents for under-threshold files and refusal-plus-prompt for anything larger. Binary files likewise need `git diff --binary` in the embedded diff (or refusal) to be recoverable from the artifact alone.

### Option B — WIP-commit, dual `/checkpoint` + `/resume`, NL session-start detection

**Axis choices:** A2 + B1+B2 + C1 + D4 + E2 + F3 + **G2 + H2** + I1 + J1 + K4.

- **A2** — Two commands: `/checkpoint` (save) and `/resume` (rehydrate). One extra file in `.claude/commands/`, added to the managed-files list.
- **B1 + B2** — Resume is invoked explicitly via `/resume` (B1); session-start validation (B2) *detects* `tasks/checkpoint.md` and *suggests* running `/resume`, but doesn't auto-trigger. B1 is the mechanical trigger; B2 is the discoverability layer.
- **C1** — Single path `tasks/checkpoint.md`.
- **G2 + H2** — On save, the command stages tracked changes (`git add -u`), creates a `wip: checkpoint <subject>` commit, records that commit's SHA + short subject in the checkpoint frontmatter, then stages and commits the checkpoint file itself (`chore: checkpoint ...`). Worktree is clean after save (for tracked changes). Resume just reads the checkpoint file and continues — no diff re-application.

**Why it works:** Clean worktree after save matches user mental model ("my work is safe in git"). Resume is trivial — the edits are already in history, so the user just continues working. The WIP-commit SHA in the artifact is a precise handle (you can `git show <sha>` to inspect exactly what was saved) and survives even if the artifact is lost.

**Why it hurts:** Introduces `wip:` as a new commit-message convention (research §Cross-Cutting Constraints flags this). WIP commits pollute branch history and must be squashed before `/finish` — and **`/finish.md:20-32` does not currently do any squashing** (Codex risk); landing this option requires real `/finish` changes before the push at `finish.md:27`, expanding Task 1's blast radius. Two slash commands instead of one widens the command surface. **`git add -u` does not capture untracked files** (Codex risk): new source files created this session would be silently excluded from the WIP commit — the same untracked-files problem as Option A, but without even an in-artifact list. Needs either an explicit untracked-files prompt (mirror `/finish.md:24`) or a documented "commit/stash untracked first" precondition.

### Option C — Clean-worktree-required, dual `/checkpoint` + `/resume` *(ruled out)*

**Axis choices:** A2 + B1+B2 + C1 + D4 + E2 + F3 + **G1 + H3** + I1 + J1 + K4.

- Same A2/B/C/D/E/F/I/J/K shape as Option B.
- **G1 + H3** — `/checkpoint` *refuses* if `git status` is non-empty. It tells the user to commit or stash first, then re-run. Only the checkpoint metadata file is committed. No diff embedding, no WIP commits. Resume just reads the checkpoint and continues; since the worktree was clean at save, resume can safely pick up where the user left off.

**Why it works:** Entirely sidesteps the G↔H tension. No new commit convention, no diff-re-apply logic, no large-artifact problem. Simplest possible artifact — phase, cursor, branch, batch heading, a short prose "what's next" note.

**Why it's ruled out:** The task explicitly states "checkpoints commit to git on creation **as backups**" and `tasks/todo.md:30` warns "**Breakage here loses in-flight work silently, so dogfood before promoting to production**" — both confirm that preserving the in-progress diff (not just phase/cursor metadata) is a load-bearing requirement. Codex's independent analysis converged on the same conclusion. Kept listed here only to document that the "just commit/stash first" framing was considered and rejected on explicit user intent.

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)

*(None remain after Codex cross-check. Resolved: "commit to git as backups" means preserving the in-progress diff, confirmed by both `tasks/todo.md:30`'s "breakage loses in-flight work silently" warning and Codex's independent reading — Option C is out.)*

### Non-blocking (can resolve during implementation)

- [x] **Multiple checkpoint stacking** — Resolved by A4 auto-routing: if `tasks/checkpoint.md` already exists, `/checkpoint` prompts resume / discard / replace instead of silently overwriting. No stacking.
- [x] **Branch mismatch on resume** — Default: warn but don't refuse (research §Risk Analysis "Worktree mismatch"; Codex concurs).
- [x] **Issue-flow active-issue key** — Encode the issue number in the frontmatter `issue:` field (D4), not the filename (single-path C1 preserved). When multiple `plan-issue-*.md` files exist and the active one can't be resolved unambiguously, prompt the user for the issue number. If they decline, fall back to standalone mode. Plan phase picks which of prompt-vs-fallback is the default.
- [ ] **Untracked-files size threshold** — The D4 schema mandates inline-content-or-refuse; the threshold is all that's left to pick. Default: 100 lines per untracked file, with a soft cap on total untracked volume (say, 500 lines) before the command refuses and asks the user to `git add`. Plan finalizes the exact numbers.
- [ ] **Rehydration validation criteria** — What counts as "rehydration successful" before J1 consumes the artifact? Default: branch matches (or user overrides on mismatch warning), `base_head` is reachable from current HEAD (ancestor check), and the cursor referenced in `plan_path` / `cursor_line` still exists. Plan finalizes whether any of these should refuse rather than warn.
- [ ] **End-to-end test automation (K5)** — Default: document a manual dogfood procedure in `tasks/plan.md` and run it as part of Phase 4 verification. Add a small `checkpoint-eval.sh` only if mechanical file-presence + consumption checks fall out naturally in under ~50 lines (Codex: "not required unless a tiny shell check falls out naturally").

## What We're NOT Doing

- **No SessionStart hook** (Axis B3). The natural-language session-start pattern is load-bearing; introducing a hook requires schema verification the repo has historically gotten wrong.
- **No child-process resume** (Axis I2). Resume must rehydrate the *current* session's working memory, not start fresh — auto-issues' fresh-context child-process pattern is wrong for this use case.
- **No timestamped / directory-based storage** (Axis C2/C3). Single-file C1 is simplest and "consume on resume" is already the anti-accumulation mechanism.
- **No changes to the four QRSPI singleton paths.** Task 1 targets the current artifact layout; the directory restructure is deferred and gated on Task 7 (`tasks/todo.md:46`).
- **No new cursor-tracking file parallel to `tasks/plan.md`.** The plan's checkboxes remain the only progress marker; the checkpoint just records a pointer to them.
- **No `claude -p` child processes in the resume path.** Inline reads match how `CLAUDE.md` instructions already work.

## Decision

**Chosen approach:** Option A — Embed-diff as recovery backup, single `/checkpoint` with A1+A4 hybrid auto-routing and NL session-start detection.

**Rationale:**

- **Heuristic 1 (codebase patterns):** Option A reuses the three load-bearing patterns documented in research §Architecture Analysis — prerequisite gates by file existence (one `tasks/checkpoint.md`), in-band cursor via checkboxes (resume reads `tasks/plan.md`, no parallel cursor file), and disk-mediated handoff (no child-process or hook needed). It avoids the only novel convention the problem could introduce (`wip:` commits, which Option B needs), matching the existing `feat/fix/chore/docs/refactor` vocabulary recorded at research §Detailed Findings → Commit conventions.
- **Heuristic 2 (simpler is better):** One slash command, one artifact path, one save commit (`chore: checkpoint ...`), one consume commit (`chore: consume checkpoint`). Option B adds a second slash command *and* forces `/finish` to learn how to squash `wip:` commits before pushing — Codex flagged that as a real blast-radius expansion (`/finish.md:20-32` currently does no squashing). Option A's only complication, untracked-file contents, is a bounded prose-policy decision in the command file.
- **Heuristic 3 (reversibility):** Option A is a markdown-command rewrite plus narrow edits to `/finish`, `/playbook-audit`, session-start blocks, and docs. If the approach needs revision, it's a prose edit away. Option B's `wip:` commits would already be in branch history by the time a revision happened.
- **Codex's cross-check materially hardened the design** without shifting the winner: upgraded A1 → A1+A4 hybrid (auto-route on existing artifact rather than silent overwrite), D3 → D4 (keyed frontmatter for stable recovery), clarified that the embedded diff is a *recovery backup* and resume does not auto-re-apply it, and called out that the J1 consume commit must isolate the deletion so it doesn't sweep in unrelated staged changes. Each of these landed in place on Option A rather than creating a fourth option.
- **Option C was ruled out on explicit user intent** (`tasks/todo.md:30` warns "breakage here loses in-flight work silently") — Codex independently reached the same conclusion, which raises confidence in the ruling.

**Second-round cross-check (absorbed in place, did not shift the winner):** Codex re-reviewed the updated artifact and confirmed Option A still holds. Hardenings landed into Option A:
- Save-side commit isolation parallels J1 consume isolation — both paths now use `git commit --only -- tasks/checkpoint.md` instead of implicit staging or index resets. Lower-cost than resetting the index and doesn't unstage legitimate user work.
- `head` frontmatter key renamed to `base_head` and defined as the pre-checkpoint HEAD sha (the diff's base) to avoid false-warns on resume after the save commit advanced HEAD.
- Untracked-files schema aligned to the inline-content-or-refuse policy (the earlier D4 wording said "fenced `untracked:` list" which silently contradicted the open question's mitigation default).
- `git diff --binary` specified so binary content survives in the recovery backup.
- Consume-after-successful-rehydration made explicit: if validation fails (branch mismatch the user declines, base_head drift, missing cursor), the checkpoint file is retained for retry rather than git-rm'd prematurely.
- E2 wording tightened to not lean on branch-based disambiguation (which would have implied E3).
