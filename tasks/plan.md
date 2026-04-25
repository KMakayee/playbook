# Plan: Make `/checkpoint` reliable for suspend and resume

## Design reference

Chosen approach: **Option A** from `tasks/design-decision.md` — single `/checkpoint` slash command with A1+A4 hybrid auto-routing, NL session-start detection, embed-diff as recovery backup, J1 consume-on-resume.

Axis lock-in (from design): A1+A4 / B2 / C1 / D4 / E2 / F3 / **G1+H1** / I1 / J1 / K4.

**Single batch — all four phases land in one `/implement` cycle.** `/implement` commits after every phase (`implement.md:47`), so the per-phase commits *do* exist as intermediate states; the claim is not "every commit is a fully integrated working state" but rather "every commit is functional in isolation": the new `/checkpoint` works after Phase 1 alone (you can create/resume/discard manually), the lifecycle integration in Phase 2 just adds safety nets, and Phase 3 adds session-start surfacing. None of the intermediate commits is *broken* — they are progressively more integrated. The dogfood in Phase 4 is the final acceptance gate. Splitting into separate `/implement` cycles would gain little (each phase's verification is local) and lose the consolidated dogfood pass.

## Scope boundaries (what we're NOT doing)

Pulled verbatim from `tasks/design-decision.md` § "What We're NOT Doing":

- No `SessionStart` settings hook (Axis B3 ruled out).
- No child-process resume (Axis I2 ruled out).
- No timestamped or directory-based storage (Axis C2/C3 ruled out).
- No changes to the four QRSPI singleton paths.
- No new cursor-tracking file parallel to `tasks/plan.md` — the plan checkboxes remain the only progress marker; the checkpoint records a pointer to them.
- No `claude -p` child processes in the resume path.
- No `wip:` commit convention. Working-tree edits stay in the dirty worktree across session exit; the embedded diff in the artifact is a recovery backup only.

## Frontmatter schema (D4)

Every checkpoint file starts with this YAML block. Keys are stable so future tooling can parse without reading prose. Body follows the closing `---`.

```yaml
---
mode: qrspi | standalone
branch: <git branch name>
base_head: <short SHA, 7 chars — HEAD *before* the checkpoint save commit; the diff's base>
phase: research | design | plan | implement | none
plan_path: "tasks/plan.md" | "tasks/plan-issue-<N>.md" | ""
cursor_line: <integer line number of first `- [ ]` in plan_path, or 0>
cursor_text: "<single-line, double-quoted, embedded \" escaped as \\\">"
batch_heading: "<single-line, double-quoted>"
issue: <issue number, or 0 if not in issue flow>
created_at: "<ISO 8601 timestamp>"
---
```

**`base_head` (not `head`)** — design § "Second-round cross-check" line 122 explicitly renamed this key. The value is the short SHA of HEAD *before* the save commit (i.e., the base of the embedded diff). It is distinct from current HEAD after save, which is the checkpoint commit itself. Resume compares `base_head` against the current branch's HEAD ancestry to detect drift.

**No `subject` field.** The commit subject is computed in-line at create/replace time from `phase` + `batch_heading` (or `git log -1 --format=%s` in standalone mode) and used directly in the commit message. The design's D4 schema (design line 45) lists exactly the keys above; there is no need for a parallel record on disk.

**YAML safety rules** — all free-text values (`cursor_text`, `batch_heading`, `plan_path`, `created_at`) MUST be wrapped in double quotes and serialized on a single line. Escape characters in this order: first replace `\` with `\\`, then replace `"` with `\"` (order matters — the order escaping ensures the two passes don't interfere). If `cursor_text` would span multiple lines (rare; checkbox lines are normally single-line), collapse internal newlines to a single space before quoting. Numeric fields (`cursor_line`, `issue`) are unquoted integers; use `0` for "not applicable" rather than empty so the YAML always parses. This keeps the file safely consumable by any standard YAML parser even when checkbox text contains `:`, `#`, `"`, or `\`.

Body sections (all optional but produced by default, in this order):

1. **What's next** — 2–4 line prose synthesis derived from `cursor_text`, `batch_heading`, and the active phase. The agent re-reads this on resume to rehydrate working memory.
2. **Diff block** — verbatim output of `git diff --binary HEAD` at save time. May be arbitrarily long — the 100-line cap from current `checkpoint.md:12` is **explicitly removed**. `--binary` ensures binary files survive in the recovery backup (design line 124).
3. **Untracked file list** — one untracked file path per line.
4. **Untracked content blocks** — one per untracked file under the size threshold below, with the file path on the first line followed by the file body. See § "Untracked-file handling" below.

**Fence delimiter rule** — diff and untracked-content blocks must use **four backticks** (` ```` `) as the fence delimiter with the language tag (`diff`, `untracked`, `untracked-content`) immediately after. Three-backtick fences are unsafe for verbatim diff/file content because a content line containing ` ``` ` (e.g., the middle of a fenced markdown block in a file under change) would close the fence early. Four backticks handle the overwhelmingly common case; if the agent encounters content with four backticks (very rare in real source files), it falls through to a longer fence — the rule is "use a fence one backtick longer than the longest backtick run in the content, with a four-backtick floor." For the simple `untracked` filename list, three-backtick fences are fine (filenames don't normally contain backticks), but use four for symmetry.

## Untracked-file handling (judgment call resolution)

The design's only non-blocking question for this option:

- **Threshold:** **100 lines AND 10 KB per file** (both must be satisfied for the file to be embedded). The dual cap matters because a one-line minified blob can blow past any reasonable artifact size while still passing a line-count test (Codex flag in design Option A "Why it hurts").
- **Under both caps:** embed the file's contents in an `untracked-content` fenced block.
- **Above either cap:** `/checkpoint` refuses — it lists the offending file(s), shows which cap each one tripped (lines or bytes), and tells the user to either `git add <file>` (so the file rides on the embedded-diff path), `rm` it, or move it outside the worktree, then re-run. (`git rm` is for tracked files only and would error here.) This is deliberate friction: anything large enough to lose silently should be in the user's hands, not the artifact.
- **QRSPI artifact special case.** When the offending list includes any of the QRSPI singleton/issue artifact paths — `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/research-patterns.md`, `tasks/plan.md`, `tasks/research-issue-<N>.md`, `tasks/plan-issue-<N>.md` — the refusal message names them explicitly and recommends the `git add` path with an exact one-liner: *"`tasks/research-codebase.md` (33 KB, exceeds 10 KB cap) is a QRSPI artifact. Run `git add tasks/research-codebase.md tasks/design-decision.md tasks/plan.md` (whichever exist) and `git commit -m 'chore: snapshot QRSPI artifacts'`, then re-run `/checkpoint`."* This guides the user to the right action — QRSPI artifacts are *meant* to be tracked; checkpoint is just surfacing the hygiene gap. (Alternative auto-staging was considered but rejected: silently mutating the user's index has surprising downstream effects on `/finish` and `/implement` per-phase commits.)
- **Why these numbers:** 100 lines matches the existing `checkpoint.md:12` cap (which this rework removes for the diff but keeps for individual untracked files); 10 KB closes the minified-blob gap.

## Branch & base_head mismatch on resume (resolved in design)

- **Branch differs** from `branch:` → warn, do not refuse. Tell the user the checkpoint was saved on `<branch>` and they are on `<current>`; ask if they want to switch or proceed.
- **`base_head` not reachable** from current HEAD (the diff's base is no longer an ancestor — branch was reset, rebased, or hard-pointed elsewhere) → warn, recommend the user inspect the embedded diff before continuing. Do not refuse.
- **`base_head` reachable but current HEAD has advanced** beyond it → informational note; the worktree state is still the source of truth.

The consume step (J1) only runs after the user confirms rehydration is acceptable. If the user backs out at the branch-mismatch or base_head warning, the checkpoint file is **retained** for retry — no consume commit (design line 47).

---

## Phase 1 — Rewrite `.claude/commands/checkpoint.md`

**Goal:** Replace the 13-line prose-only command with the full create / resume / discard / replace flow, automatic state capture, and isolated commit semantics.

### Files

- `.claude/commands/checkpoint.md` — full rewrite. Existing 13 lines (`checkpoint.md:1-13`) are replaced.

### Behavior

The new command takes a single optional argument (`$ARGUMENTS`):

| `$ARGUMENTS` | Behavior |
|---|---|
| empty + no `tasks/checkpoint.md` | create-mode |
| empty + `tasks/checkpoint.md` exists | prompt: resume / discard / replace |
| `resume` | resume-mode (errors if no checkpoint exists) |
| `discard` | discard-mode (errors if no checkpoint exists) |
| `replace` | replace-mode (errors if no checkpoint exists) |
| anything else | error: list valid args |

#### Create-mode steps

1. **Inspect filesystem (no recall)** — record presence of each: `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/research-patterns.md`, `tasks/plan.md`. Glob `tasks/plan-issue-*.md` and `tasks/research-issue-*.md`, extract issue numbers from the filenames, take the **union** (a research-issue-only state is a valid mid-issue state where research is done but plan hasn't been created yet). Derive `mode`, `phase`, `plan_path`, and `issue` using the rules below — singleton-QRSPI flow is derived **first** because it's the primary task scope; only when no singleton artifacts are present do we fall through to issue flow.

   **Singleton-vs-issue precedence (Codex trade-off resolution):** if any of `tasks/{research-codebase,design-decision,research-patterns,plan}.md` exist, the user is in singleton-QRSPI mode regardless of any leftover `plan-issue-*.md` / `research-issue-*.md` files (those are most likely stale from prior work). Singleton wins. Issue flow only activates when no singleton QRSPI artifacts exist.

   **Active-issue selection (only runs when no singleton QRSPI artifacts exist):**
   - Zero issue artifacts (no `plan-issue-*.md` AND no `research-issue-*.md`) → `issue: 0`, fall through to standalone.
   - Exactly one issue number `N` across the union of `plan-issue-*.md` and `research-issue-*.md` → `issue: N`.
   - Multiple distinct issue numbers across the union → `issue: 0`, `mode: standalone`, `phase: none`. Add a body note: *"Active issue ambiguous — multiple issue artifacts present (`<list>`); treated as standalone snapshot. Run `/finish` or clean up stale issue plans before checkpointing in issue mode again."* This is the simpler resolution Codex flagged: don't guess.

   **Phase derivation (singleton-QRSPI flow):**
   - `tasks/plan.md` exists with at least one `- [ ]` → `mode: qrspi`, `phase: implement`, `plan_path: "tasks/plan.md"`.
   - `tasks/plan.md` exists, all `- [x]` → `mode: qrspi`, `phase: implement`, `plan_path: "tasks/plan.md"` (cursor empty; tell user the plan is fully checked — they probably want `/finish`, not `/checkpoint`).
   - `tasks/design-decision.md` exists, no `tasks/plan.md` → `mode: qrspi`, `phase: plan`, `plan_path: ""`.
   - `tasks/research-codebase.md` exists, no `tasks/design-decision.md` → `mode: qrspi`, `phase: design`, `plan_path: ""`.

   **Phase derivation (issue flow, when `issue: <N>` is set and no singleton artifacts exist):**
   - `tasks/plan-issue-<N>.md` exists with at least one `- [ ]` → `mode: qrspi`, `phase: implement`, `plan_path: "tasks/plan-issue-<N>.md"`.
   - `tasks/plan-issue-<N>.md` exists, all `- [x]` → `mode: qrspi`, `phase: implement`, `plan_path: "tasks/plan-issue-<N>.md"` (cursor empty; tell user the issue plan is complete).
   - `tasks/research-issue-<N>.md` exists, no `tasks/plan-issue-<N>.md` → `mode: qrspi`, `phase: plan`, `plan_path: ""`.

   **Standalone:** if neither flow yields a phase → `mode: standalone`, `phase: none`, `plan_path: ""`.

2. **Inspect git** — capture `branch` (`git rev-parse --abbrev-ref HEAD`) and `base_head` (`git rev-parse --short HEAD`). The current HEAD short SHA, captured *before* the save commit, becomes `base_head`.

3. **Extract cursor (F3)** — when `phase: implement` and `plan_path` is non-empty, read that file. Find the first `- [ ]` line; record:
   - 1-based line number as `cursor_line`,
   - full text (collapsed to a single line, double-quoted, escaped per the **YAML safety rules** above — `\` → `\\` then `"` → `\"`) as `cursor_text`,
   - the nearest preceding `##`/`###` heading (same quoting rules) as `batch_heading`.

   If no unchecked item exists, set `cursor_line: 0`, `cursor_text: ""`, `batch_heading: ""`.

4. **Capture diff** — run `git diff --binary HEAD` and embed the verbatim output in a fenced `diff` block per the **Fence delimiter rule** above (four-backtick floor; escalate if content has four-or-more-backtick runs). No size cap. `--binary` is required so binary files are recoverable from the artifact alone (design line 124).

5. **Capture untracked** — run `git ls-files --others --exclude-standard`. List each path in a fenced `untracked` block per the **Fence delimiter rule** above. For each path, check both caps (≤100 lines AND ≤10 KB):
   - Passes both → emit a fenced `untracked-content` block (per the same fence rule) with `path: <file>` on the first line followed by the file body.
   - Fails either → **abort** with the message from § "Untracked-file handling" listing all offending files and which cap each tripped. Do not write `tasks/checkpoint.md`. Do not commit.

6. **Synthesize body** — write a 2–4 line "What's next" note derived from `cursor_text` + `batch_heading` + active phase. In standalone mode (no QRSPI artifacts), write a generic "ad-hoc snapshot" line plus the most recent commit subject from `git log -1 --format=%s`. **Do not** treat `$ARGUMENTS` as a freeform user blurb — `$ARGUMENTS` is reserved for the mode keywords listed in the behavior table.

7. **Compose commit subject** — short imperative phrase, single-line, used in the commit message only (not stored in frontmatter). Selection rules:
   - `phase: implement` and `batch_heading` non-empty → use the heading text stripped of leading `##`/`###` markers.
   - `phase` is `research` / `design` / `plan` → use `"<phase> phase"`.
   - else (standalone) → use `git log -1 --format=%s` truncated to 60 chars.

8. **Write artifact** — overwrite `tasks/checkpoint.md` with frontmatter + body in the order documented above.

9. **Commit (G1+H1, isolated)** — for a brand-new checkpoint, the file is currently untracked, so `git commit --only` alone would error with "pathspec did not match any file known to git" (Codex correction). Stage the path first, then commit with `--only` so the commit is path-scoped regardless of whatever was previously staged in the user's index:

   ```
   git add -- tasks/checkpoint.md
   git commit --only -- tasks/checkpoint.md -m "chore: checkpoint <subject>"
   ```

   `git add` on a single path stages only that path (does not sweep other files). `git commit --only` then commits exactly that path, leaving the rest of the index untouched. The same two-step works for replace-mode (where the file is already tracked but modified). Do not push. The dirty worktree stays dirty.

10. **Confirm and recommend `/compact`** — report: created `tasks/checkpoint.md`, commit hash, mode, phase, cursor (if `phase: implement`). Tell the user the worktree is intentionally still dirty — the embedded diff is a recovery backup, not the primary survival mechanism. Then **explicitly recommend running `/compact` next**:

    > *"State is saved to git. Run `/compact` now to clear context — when you (or a fresh session) come back, run `/checkpoint resume` then `/implement` to pick up at `<cursor_text>`."*

    This closes the compaction-race risk research §Risk Analysis line 238 flagged: the checkpoint exists on disk and in git before context is cleared, so compaction can't lose the cursor.

    **Why recommend rather than auto-invoke:** `/compact` is a Claude Code built-in; a slash command cannot programmatically invoke another slash command (research §External Research notes I4 has no codebase precedent). The agent surfaces the recommendation; the user runs `/compact` themselves.

#### Resume-mode steps

1. **Read** `tasks/checkpoint.md` FULLY (no `limit`/`offset`).
2. **Validate** — parse frontmatter. If unparseable (e.g., missing `---` boundary, malformed YAML), abort and tell the user. Do not consume.
3. **Branch check** — compare `branch:` against current branch. If different, warn but do not abort:

   > *"Checkpoint was saved on `<saved>`; you are on `<current>`. Proceed, or switch branches first?"*

   Wait for user confirmation. If the user backs out, abort *without* consuming.
4. **base_head check** — compare `base_head:` against current HEAD ancestry (`git merge-base --is-ancestor <base_head> HEAD`). If `base_head` is not an ancestor of current HEAD, warn the user the diff's base is no longer reachable and recommend they inspect the embedded diff before continuing. Otherwise, if `base_head` differs from current short HEAD but is reachable, note in the resume report (informational).
5. **Rehydrate phase context** — read whichever QRSPI artifacts the `phase:` indicates, in this order: `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/research-patterns.md` (if present), and the active plan file (`plan_path`). For issue mode, read the corresponding `tasks/research-issue-<N>.md` and `tasks/plan-issue-<N>.md` instead of the singleton plan/research.
6. **Re-locate cursor** — if `phase: implement`, find the first `- [ ]` in `plan_path`. Reconcile:
   - Same line number AND same text → clean resume.
   - Different line number, same text → use the new line; note that the plan was edited.
   - Text changed → warn the user the plan changed since the checkpoint was created; show both the saved `cursor_text` and the current first-unchecked text.
7. **Present rehydration summary** — phase, `cursor_text`, `batch_heading`, branch warnings (if any), `base_head` note (if any). Do **not** auto-re-apply the embedded diff — the dirty worktree is the source of truth (design line 46). Mention the diff is available in the artifact for recovery only (e.g., if the user is on a different machine or has reset their worktree).
8. **Consume (J1, isolated)** — only if rehydration validation succeeded (frontmatter parsed, branch confirmed, cursor reconciled). Use `git rm` (matching the design's stated mechanic at design line 47) followed by an isolated `git commit --only` so the deletion is scoped without touching the rest of the user's index:

   ```
   git rm -- tasks/checkpoint.md
   git commit --only -- tasks/checkpoint.md -m "chore: consume checkpoint"
   ```

   `git rm` removes the file from both the worktree and the index in one step (more idiomatic than `rm` + relying on `git commit --only` to pick up the worktree deletion). Do not push. The deletion commit rides on the next normal push (mirrors `finish.md:32`).

   **If validation fails** (user declines branch override, `base_head` not reachable and user wants to investigate, etc.), retain `tasks/checkpoint.md` on disk — do **not** consume. Tell the user the checkpoint is preserved for retry.
9. **Confirm and hand off to `/implement`** — report the consume commit hash and tell the user the session is rehydrated. Then **explicitly point at the next move**:

   > *"Rehydrated at `<phase>`, cursor `<cursor_text>` (line `<cursor_line>` in `<plan_path>`). Run `/implement` to continue from here."*

   In `phase: research` / `design` / `plan` modes, replace the `/implement` recommendation with the appropriate next phase command (`/design`, `/create-plan`). In standalone mode, replace with "proceed normally — no QRSPI phase active." This closes the sync-point loop the user's notes called out: save → compact → resume → `/implement` picks up at the exact step.

#### Discard-mode steps

Same isolated pattern as the consume step, but with a different commit message:

```
git rm -- tasks/checkpoint.md
git commit --only -- tasks/checkpoint.md -m "chore: discard checkpoint"
```

Tell the user the checkpoint was deleted without rehydration.

#### Replace-mode steps

**Atomic single-commit overwrite** — Codex flagged that a "discard then create" sequence is non-atomic and can leave no checkpoint if interrupted between commits. A single overwrite commit also preserves the prior version in git history via the existing `chore: checkpoint <old>` commit, which is all the rollback we need:

1. Run create-mode steps 1–8 to build the new artifact (this overwrites the existing `tasks/checkpoint.md` in the working tree). The file is already tracked from the prior save commit, so `git add` is technically optional, but use the same two-step pattern for symmetry with create-mode:
   ```
   git add -- tasks/checkpoint.md
   git commit --only -- tasks/checkpoint.md -m "chore: checkpoint <new subject>"
   ```
2. Git records this as a modification of the tracked file; the prior `chore: checkpoint <old subject>` commit remains in history as the rollback target.
3. Confirm — single combined report: replaced existing checkpoint, new commit hash, mode, phase, cursor (if implement).

### Success criteria

- [x] `.claude/commands/checkpoint.md` is rewritten end-to-end and contains all four mode flows (create, resume, discard, replace), the frontmatter schema, and the untracked-file policy.
- [x] No reference to "Keep it under 100 lines" remains anywhere in the file.
- [x] `grep -n "git commit --only" .claude/commands/checkpoint.md` matches in create, consume, discard, and replace flows (4 hits expected).
- [x] `grep -n "git add -- tasks/checkpoint.md" .claude/commands/checkpoint.md` matches in create and replace flows (single-path `git add` is allowed; bulk staging like `git add -u` or `git add -A` is not).
- [x] `grep -nE "git add (-u|-A|--all|--update)" .claude/commands/checkpoint.md` returns **zero** matches (no bulk staging — sweeping the index is what `--only` is meant to avoid).
- [x] `grep -n "git rm -- tasks/checkpoint.md" .claude/commands/checkpoint.md` matches in consume and discard flows (2 hits expected).
- [x] `grep -n "git reset" .claude/commands/checkpoint.md` returns zero matches.
- [x] `grep -n "base_head" .claude/commands/checkpoint.md` matches in both create-mode (capture) and resume-mode (validation).
- [x] `grep -n "git diff --binary" .claude/commands/checkpoint.md` matches once (capture step).
- [x] `grep -n "untracked-content" .claude/commands/checkpoint.md` matches.
- [x] Both caps (100 lines AND 10 KB) for untracked files appear explicitly in the command text.
- [x] QRSPI-artifact special-case guidance appears in the refusal-message section (so the user is pointed at `git add` + `chore: snapshot QRSPI artifacts`).
- [x] YAML safety rule documents both `\` → `\\` and `"` → `\"` escaping (in that order), and is referenced from the create-mode cursor-extract step.
- [x] Fence delimiter rule documents the four-backtick floor for diff/untracked-content blocks.
- [x] Issue-flow phase derivation is present: the command handles `tasks/plan-issue-<N>.md` analogously to `tasks/plan.md`, takes the **union** of `plan-issue-*.md` and `research-issue-*.md` for issue-number extraction, and falls back to standalone (with a body note) when multiple distinct issue numbers are present.
- [x] Singleton-vs-issue precedence documented: any singleton QRSPI artifact wins over leftover issue artifacts.
- [x] Create-mode confirm step recommends `/compact` (sync-point closure for compaction races).
- [x] Resume-mode confirm step recommends `/implement` (or the appropriate next phase) and names the cursor explicitly.
- [x] Resume-mode preserves the checkpoint file when rehydration validation fails (do not consume on abort).
- [x] Verify by reading the file back end-to-end: every numbered step in this phase appears as instruction text the agent can follow without recall.

---

## Phase 2 — Lifecycle integration: `/finish` and `/playbook-audit`

**Goal:** Stop checkpoint leakage. Both commands learn that `tasks/checkpoint.md` is a tracked artifact that must be cleaned up if it survives past a task.

Rationale (research §Detailed Findings → "QRSPI lifecycle and where checkpoint plugs in"): `/finish.md:29-31` and `/playbook-audit.md:54-60` enumerate QRSPI artifacts; checkpoint is omitted from both, which is the leakage root cause.

### Files

- `.claude/commands/finish.md` — single edit at step 3 (`finish.md:29-31`).
- `.claude/commands/playbook-audit.md` — single edit at Step 4 (`playbook-audit.md:54-60`).

### Changes

**`.claude/commands/finish.md` step 3 (`finish.md:29-31`):**

Add `tasks/checkpoint.md` to the cleanup list. Important nuance: `/finish` runs **after** any active checkpoint has been resumed/consumed in the normal way. If a checkpoint still exists at `/finish` time, it means the user reached task completion without resuming — that's fine, the consume happens here as a final sweep. Update the bullet to:

```
- After the push in step 2 succeeds, `git rm` whichever of these exist: `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/research-patterns.md`, `tasks/plan.md`, `tasks/checkpoint.md`.
```

**`.claude/commands/playbook-audit.md` Step 4 (`playbook-audit.md:54-60`):**

Add `tasks/checkpoint.md` to the scanned set. Update the bullet list (currently 6 entries) to include `tasks/checkpoint.md` as an additional bullet. The interactive prompt logic at `playbook-audit.md:62-66` ("Delete or keep?") works as-is — the new entry inherits it.

### Success criteria

- [x] `grep -n "tasks/checkpoint.md" .claude/commands/finish.md` matches in step 3's cleanup list.
- [x] `grep -n "tasks/checkpoint.md" .claude/commands/playbook-audit.md` matches in Step 4's scan list.
- [x] No other lines in either file changed (surgical edits — `git diff` confirms scope).

---

## Phase 3 — Session-start checkpoint detection (`CLAUDE.md` + template)

**Goal:** When a fresh session opens with `tasks/checkpoint.md` present, the agent surfaces it via the existing natural-language session-start validation block (B2, no hooks).

This phase also resolves the existing `CLAUDE.md` ↔ template drift documented in research §Summary insight 3 (`templates/playbook-sections.md:153-159` has a "Leftover artifacts" check; the installed `CLAUDE.md:198-203` does not).

### Files

- `CLAUDE.md` — replace the Session-Start Validation block at `:198-203`.
- `templates/playbook-sections.md` — replace the Session-Start Validation block at `:153-159`.

### Changes

Both files end up with the same 4-check structure (mirroring what the template already has, plus a 4th check for checkpoint).

**`templates/playbook-sections.md`** lines 153–159 — replace the current 3-check block with a 4-check block by appending:

```
4. **Active checkpoint** — If `tasks/checkpoint.md` exists, do not auto-resume. Tell the developer: "Found `tasks/checkpoint.md` from a prior session. Run `/checkpoint resume` to rehydrate, `/checkpoint discard` to drop it, or `/checkpoint replace` to overwrite with a fresh save."
```

**`CLAUDE.md`** lines 198–203 — replace the current 2-check block (which is missing the leftover-artifact check that's already in the template) with the matching 4-check block in the same order:

1. Leftover artifacts (matching template line 157).
2. Unconfigured CLAUDE.md (matching template line 158).
3. Playbook version (matching template line 159).
4. Active checkpoint (the new check above).

After this phase, the two files express the same instruction set, in the same order, with the same wording — they don't need to be byte-identical (each lives in its own file with its own surrounding context), but the per-check rules and the order must match so the agent's behavior is identical regardless of which file Claude reads.

**Why both files:** `CLAUDE.md` is what Claude loads at session start (the live instruction). `templates/playbook-sections.md` is what `/playbook-setup` Step 0B (`playbook-setup.md:25`) appends to existing-project CLAUDE.md files during install — if it drifts, new installs miss the check. `/playbook-update`'s Category B merge (`playbook-update.md:114-129`) compares each project's CLAUDE.md bottom half against the latest repo CLAUDE.md (NOT against the template), so updating the template alone wouldn't propagate to existing projects via update — both must change.

### Success criteria

- [x] `grep -n "Active checkpoint" CLAUDE.md templates/playbook-sections.md` matches in both files.
- [x] Both files contain a 4-check Session-Start Validation block in the same order with the same per-check rules (verify by reading both blocks side-by-side; surrounding boilerplate may differ).
- [x] No other content in `CLAUDE.md` (especially the team-owned top half above the `---` boundary that precedes `# QRSPI Workflow Rules`) changes.
- [x] The block stays under the existing "no sub-agents, under 30 seconds" constraint — no new file reads beyond a single `[ -f tasks/checkpoint.md ]` check.

---

## Phase 4 — Public docs, maintainer-artifact warnings, and dogfood test

**Goal:** Update the user-facing description of `/checkpoint`, extend the maintainer-artifact warnings so the new artifact path is also guarded against leakage on install/update, and run the end-to-end dogfood test that gates production use (`tasks/todo.md:30` is explicit: *"create a checkpoint mid-batch, exit the session, resume in a fresh session, and verify that state rehydrates cleanly and the artifact is consumed. Breakage here loses in-flight work silently."*).

### Files

- `README.md:74` — update the `/checkpoint` row.
- `quickref.md:47` — update the `/checkpoint` row.
- `.claude/commands/playbook-setup.md:142` — extend the maintainer-artifact warning.
- `.claude/commands/playbook-update.md:176` — extend the maintainer-artifact warning.
- `.claude/commands/playbook-update.md:9-43` — **no change needed**, the managed-files list already includes `.claude/commands/checkpoint.md` at line 37.

### Changes

**`README.md:74`:**

Replace:
```
| `/checkpoint` | Save current work state to `tasks/checkpoint.md` |
```

with:
```
| `/checkpoint` | Save / resume / discard work state in `tasks/checkpoint.md` (commits on save, consumes on resume) |
```

**`quickref.md:47`:**

Replace:
```
| `/checkpoint`   | Save current work state to `tasks/checkpoint.md`                                 |
```

with:
```
| `/checkpoint`   | Save / resume / discard work state in `tasks/checkpoint.md` (auto-detects QRSPI phase + cursor) |
```

**`.claude/commands/playbook-setup.md:142`:**

Today the bullet enumerates `tasks/{todo,errors,issues}.md`. Append `tasks/checkpoint.md` to the same list. Reasoning: the maintainer's working repo may produce checkpoints during dogfooding; without this guard, a leftover checkpoint could ship to a fresh install. (The README's `rm -rf tasks` on line 18 already covers this on initial install, but the warning is the belt-and-suspenders layer.)

**`.claude/commands/playbook-update.md:176`:**

Same change — extend the existing `tasks/{todo,errors,issues}.md` list to include `tasks/checkpoint.md`.

### Dogfood test (manual procedure)

This procedure is the **acceptance gate** explicitly required by `tasks/todo.md:30`. Run end-to-end in this worktree (or a scratch QRSPI task) with the steps below. **Each step must succeed without manual fix-up.**

1. **Setup a synthetic mid-batch state.** In a sandbox branch, create `tasks/research-codebase.md`, `tasks/design-decision.md`, and `tasks/plan.md` with two `## Phase` blocks. Mark Phase 1's success criteria `- [x]` and leave Phase 2's `- [ ]`. Make a deterministic uncommitted edit to a real tracked file: insert the line `<!-- dogfood checkpoint marker -->` at the top of `quickref.md` (after the `# QRSPI Quick Reference` heading). Confirm the edit shows up in `git diff` before continuing — if the diff is empty, fix the edit (Codex flag: a no-op edit like a trailing newline can produce no diff and silently pass).
2. **Run `/checkpoint`** with no args. Verify:
   - `tasks/checkpoint.md` is created with frontmatter showing `mode: qrspi`, `phase: implement`, `plan_path: "tasks/plan.md"`, `cursor_line` and `cursor_text` matching Phase 2's first unchecked item, `batch_heading` matching the Phase 2 heading.
   - The diff fenced block contains the `quickref.md` marker line.
   - `git log -1 --format=%s` shows `chore: checkpoint <subject>`.
   - `git diff --stat HEAD~1 HEAD` shows ONLY `tasks/checkpoint.md` changed (verifies `git commit --only` isolated the commit — no other tracked changes leaked into the checkpoint commit).
   - `git status` still shows the dirty `quickref.md` change (worktree intentionally dirty).
3. **Untracked-file capture (small).** Create `tasks/dogfood-untracked.txt` with 5 lines (`seq 5 > tasks/dogfood-untracked.txt`). Re-run `/checkpoint replace`. Verify `tasks/checkpoint.md` now contains an `untracked-content` fenced block with the 5 lines and the file path, and an `untracked` fenced list naming `tasks/dogfood-untracked.txt`.
4. **Untracked-file refusal (line cap).** Create `tasks/dogfood-large.txt` with 200 lines (`seq 200 > tasks/dogfood-large.txt`). Run `/checkpoint replace`. Verify the command refuses, names `tasks/dogfood-large.txt`, reports it tripped the line cap, and tells the user to add/remove/move the file. `tasks/checkpoint.md` from step 3 must be unchanged on disk after the refusal.
5. **Untracked-file refusal (byte cap).** Delete `dogfood-large.txt`, then create a one-line untracked file that exceeds 10 KB: `python3 -c 'print("a" * 11000)' > tasks/dogfood-blob.txt`. Run `/checkpoint replace`. Verify the command refuses, names the file, reports it tripped the byte cap. Then `rm tasks/dogfood-blob.txt` and continue.
6. **Simulate session exit.** Delete `tasks/dogfood-untracked.txt` to keep state clean, then open a fresh Claude Code session in the same worktree.
7. **Session-start validation fires.** Verify the agent surfaces the checkpoint and prompts for `/checkpoint resume` / `discard` / `replace` per the new CLAUDE.md block from Phase 3.
8. **Run `/checkpoint resume`.** Verify:
   - The agent reads `tasks/research-codebase.md`, `tasks/design-decision.md`, and `tasks/plan.md` (rehydration).
   - The presented summary names Phase 2 and the unchecked cursor line.
   - The branch check matches (no warning).
   - After rehydration: `git log -1 --format=%s` shows `chore: consume checkpoint`, and `tasks/checkpoint.md` no longer exists.
   - `git status` still shows the dirty `quickref.md` change preserved across the resume.
9. **Index-isolation check.** Before running `/checkpoint` again, modify `quickref.md` further and `git add quickref.md` to stage the change. Run `/checkpoint`. Then run `/checkpoint resume`. Verify (via `git status`) that the user's pre-existing staged `quickref.md` change is **still staged** afterward — neither the save commit nor the consume commit may have swept it up (this exercises the `git commit --only` isolation guarantee Codex flagged).
10. **Run `/finish` (synthetic).** Mark Phase 2 done in the test plan, run `/finish`. Verify the cleanup commit at `finish.md:29-31` does NOT mention `tasks/checkpoint.md` (it was already consumed in step 8). If a checkpoint was *not* consumed (e.g., simulate by creating a fresh checkpoint right before `/finish`), verify `/finish`'s cleanup commit does include `tasks/checkpoint.md`.
11. **`/checkpoint discard` variant.** Recreate a checkpoint with `/checkpoint`, then run `/checkpoint discard`. Verify the artifact is removed via `chore: discard checkpoint` and no rehydration runs.
12. **`/checkpoint replace` variant (atomicity).** Recreate a checkpoint with `/checkpoint`, modify another tracked file, then run `/checkpoint replace`. Verify exactly **one** new commit was added (`chore: checkpoint <new subject>`) — not a `discard` then `checkpoint` pair (this exercises Codex's atomicity concern).
13. **Branch-mismatch warning.** Recreate a checkpoint, then `git checkout -b dogfood-other-branch`, then `/checkpoint resume`. Verify the agent warns (does not refuse) about the saved-vs-current branch mismatch and waits for confirmation.
14. **Issue-flow ambiguity.** Create both `tasks/plan-issue-1.md` (with one `- [ ]`) and `tasks/plan-issue-2.md` (with one `- [ ]`). Run `/checkpoint`. Verify `mode: standalone`, `phase: none`, `issue: 0`, and the body explicitly notes "Active issue ambiguous". Clean up by `rm`-ing both before the next step.
15. **Compact-cycle (the sync point).** Recreate the synthetic mid-batch state from step 1. Run `/checkpoint` and verify the confirmation message recommends `/compact`. Then **actually run `/compact`** in the same session. After compaction completes, run `/checkpoint resume` and verify: (a) the resume report names Phase 2 and the cursor exactly, (b) the next-move recommendation explicitly says `/implement`, (c) `tasks/checkpoint.md` is consumed via `chore: consume checkpoint`. This is the load-bearing flow the user's notes called out — checkpoint must survive compaction so the implement step isn't lost when context is cleared.

If any step fails, **stop**, return to the relevant phase, fix the command, and re-run from step 1.

### Success criteria

- [ ] `README.md:74` and `quickref.md:47` rows are updated; `git diff` shows only those two lines changed in their respective files.
- [ ] Both `playbook-setup.md` and `playbook-update.md` maintainer-artifact warnings include `tasks/checkpoint.md`.
- [ ] Dogfood test steps 1–15 all pass without manual intervention. Record any deviations as inline notes in this section before marking Phase 4 complete.
- [ ] Specifically: untracked-file capture (step 3), line-cap refusal (step 4), byte-cap refusal (step 5), index isolation (step 9), replace-mode atomicity (step 12), and the compact-cycle (step 15) — these are the load-bearing behaviors the dogfood must exercise; missing any one is a failed dogfood.

### Post-implementation integration test (final acceptance gate)

After all four phases are complete and committed, run the **full 15-step dogfood end-to-end in one session** before marking Task 1 done. This is not optional — `tasks/todo.md:30` is explicit: *"Breakage here loses in-flight work silently, so dogfood before promoting to production."* The earlier per-phase success criteria verify the building blocks; this final pass verifies the **whole feature works as a system**, including:

- All 6 of the user's original requirements: batch suspension, resume-as-sync, artifact deletion, override on next batch, commit-on-create, and the **compact-cycle** (save → `/compact` → resume → `/implement` picks up at the exact step).
- Lifecycle integration: `/finish` and `/playbook-audit` clean up checkpoints if they leak.
- Session-start detection: a fresh Claude Code session surfaces the checkpoint via the `CLAUDE.md` block.

If any step fails in this final pass, do **not** mark Task 1 done. Return to the relevant phase, fix, and re-run all 15 steps from scratch. Document any deviations or partial failures in this plan before deciding whether the failure is in scope to fix or a follow-up task.

---

## Judgment Calls

Numbered list of choices the plan made where a viable alternative existed. Each is annotated with why this option was picked.

1. **Untracked-file caps = 100 lines AND 10 KB per file.** Alternatives: 50 lines (more conservative, more user friction); 200 lines (matches a "page" but lets larger files leak); line cap only (Codex flagged this leaves a gap for one-line minified blobs); byte cap only (cleaner from a storage view but less intuitive). The dual cap is the simplest robust answer: 100 lines is the user-recognizable carry-over from the existing `checkpoint.md:12` cap, and 10 KB closes the minified-blob gap.
2. **Refuse-on-large-untracked rather than skip-and-warn.** A skip-and-warn path would be friendlier but it accepts silent loss of new files — the exact failure mode `tasks/todo.md:30` warns against. Refusal forces a deliberate user action.
3. **Resume does not auto-re-apply the embedded diff.** Design line 46 specified this; the plan keeps it. The dirty worktree is the source of truth, the diff is recovery-only. Auto-apply would conflict with the already-dirty tree on every resume in the common case.
4. **Discard / Replace as first-class modes.** Adds two extra branches in the command file vs. "delete the file manually" and "run `/checkpoint` to overwrite." Justification: A4 auto-routing requires a non-overwrite default, so the "I want to replace" and "I want to drop it" paths need explicit non-prompty entry points.
5. **Single batch (one `/implement` cycle).** Alternative: split into two batches (Phase 1 alone; Phases 2–4 together) so the heart of the change can be reviewed before lifecycle integration. Codex flagged that the original "every commit point in a working state" claim was overstated — `/implement` commits per phase, so an interrupt after Phase 1 leaves checkpoint-the-command rewritten without checkpoint-the-cleanup integration. The corrected framing: each per-phase commit is *functional in isolation* (the new `/checkpoint` works after Phase 1 alone), just progressively more integrated. Single-batch is picked because the dogfood is the acceptance gate and is most cleanly run end-to-end after all four phases land; splitting would force a half-feature commit + a separate verification pass with little gain.
6. **Active-issue ambiguity → fall back to standalone (no heuristic).** Alternatives: an mtime-gap heuristic (research §Risk Analysis warns mtime can pick the wrong stale issue); an explicit `/checkpoint <issue-N>` argument (widens the contract). The design's Open Questions resolution literally says "fall back to standalone mode rather than guess." The body note tells the user *why*, so they can clean up and retry rather than wondering why the issue field was empty.
7. **`git add <path>` + `git commit --only <path>` for create/replace; `git rm <path>` + `git commit --only <path>` for consume/discard.** Codex flagged that bare `git commit --only` errors on untracked paths, so create-mode has to stage the file first. The two-step pattern remains path-scoped: `git add <single-path>` only stages that path (no sweeping), and `git commit --only` ignores anything else in the index. Alternatives considered: `git add <path>` + plain `git commit` (sweeps already-staged changes — bad); `git stash --keep-index` + commit + stash pop (more machinery, error-recovery edge cases); `git reset` + `git rm` + commit (Codex: destroys the user's pre-checkpoint staged/unstaged distinction). For consume/discard, `git rm <path>` matches the design's stated mechanic at design line 47 and is more idiomatic than plain `rm` + relying on `git commit --only` to detect the worktree deletion.
8. **Replace-mode = single overwrite commit, not discard-then-create.** Codex flagged the two-commit sequence as non-atomic (interrupt between commits → no checkpoint). Single-commit replace preserves the prior version in git history via the existing `chore: checkpoint <old>` commit, which is the only rollback target we ever need.
9. **YAML frontmatter free-text values are double-quoted single-line strings.** Alternatives: block scalars (`|`) or unquoted plain strings. Block scalars handle multi-line cleanly but require the agent to apply consistent indentation, which is error-prone. Unquoted strings break on `:`, `#`, or quotes inside checkbox text. Single-line + double-quote + escape-`\`-then-`"` is the simplest YAML-safe shape and matches conservative-default tooling (GitHub Actions, Jekyll frontmatter). Codex flagged that escaping only `"` is incomplete — both `\` and `"` need escaping, with `\` first so the second pass doesn't double-escape.
10. **No `subject` field in frontmatter.** Earlier draft added `subject` for self-describing commits. Codex flagged it as a schema expansion not in the design (design line 45 lists exactly the 10 keys). Dropped — the commit subject is computed in-line at create/replace time and lives only in the git commit message. Reversibility: adding it back later is a one-line edit.
11. **Singleton-QRSPI wins over leftover issue artifacts.** Codex flagged the precedence as under-specified. Picked singleton-wins because the QRSPI singleton flow is the primary task scope; leftover `plan-issue-*.md` files in a singleton-active repo are most likely stale. Issue flow only activates when no singleton QRSPI artifacts are present. This is deterministic and matches the user's mental model of "the thing I'm working on right now."
12. **Issue-number extraction is the union of `plan-issue-*.md` and `research-issue-*.md`.** Codex flagged that scanning only `plan-issue-*.md` made the "research-issue exists, no plan-issue-N" branch unreachable. Plan now globs both and dedupes by issue number, so a research-only issue state is detectable as `phase: plan` for that issue.
13. **`base_head` (not `head`).** The design's first round used `head`; the second-round cross-check (design line 122) renamed it to `base_head` to clarify it's the diff's base, not current HEAD. Plan adopts the design's final wording.
14. **`git diff --binary` (not bare `git diff`).** Design line 124 specifies `--binary` so binary files survive in the recovery backup. Plan adopts.
15. **Four-backtick fences for diff and untracked-content blocks.** Codex flagged that triple-backtick fences are unsafe for verbatim content because a content line containing ` ``` ` closes the fence early. Picked four-backtick floor with dynamic escalation rule ("fence one longer than longest run in the content"), four being the practical floor for real source files. Alternative: HTML-encode the content. Rejected — bloats artifact and makes manual `git apply` harder.
16. **Refuse-on-large-untracked also includes a QRSPI-artifact-specific message.** Codex trade-off 5: typical mid-task state has uncommitted QRSPI artifacts (research/design/plan) that themselves exceed the 10 KB cap. Auto-staging was considered but rejected (silently mutating the user's index has surprising effects on `/finish` and per-phase commits). Plan keeps the refusal but adds a special-case message that names the QRSPI artifacts and gives the exact one-liner: `git add tasks/research-codebase.md tasks/design-decision.md tasks/plan.md` + `git commit -m 'chore: snapshot QRSPI artifacts'`. Friction is once-per-task and surfaces a clear next action.
17. **Final acceptance gate is a manual 15-step procedure, not a `checkpoint-eval.sh` script.** Design Open Questions resolution says K5 (test script) is "not required unless a tiny shell check falls out naturally." The 15-step procedure depends on real Claude Code session boundaries and `/compact` invocation that a shell script can't simulate, so a script would only mechanize the easy parts (file presence, commit-message grep) while the load-bearing parts (cross-session resume, compact survival) still need manual execution. Skip the script; document the procedure in the plan.

## Artifact references

- Research: `tasks/research-codebase.md`
- Design: `tasks/design-decision.md`
- Open Questions resolutions: `tasks/design-decision.md` § "Open Questions" (the four `[x]` items + the two `[ ]` items resolved here in §"Untracked-file handling" and §"Dogfood test")
