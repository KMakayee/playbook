# Checkpoint

Save, resume, discard, or replace a suspend-and-resume snapshot stored in `tasks/checkpoint.md`. The artifact captures QRSPI phase, plan cursor, branch state, and a recovery diff so a cold session (or a session after `/compact`) can pick up where the previous one left off.

Takes a single optional argument (`$ARGUMENTS`):

| `$ARGUMENTS` | Behavior |
|---|---|
| empty + no `tasks/checkpoint.md` | create-mode |
| empty + `tasks/checkpoint.md` exists | prompt the developer: resume / discard / replace |
| `resume` | resume-mode (errors if no checkpoint exists) |
| `discard` | discard-mode (errors if no checkpoint exists) |
| `delete` | alias for `discard` (errors if no checkpoint exists) |
| `remove` | alias for `discard` (errors if no checkpoint exists) |
| `replace` | replace-mode (errors if no checkpoint exists) |
| anything else | error — list the valid args (`resume`, `discard`/`delete`/`remove`, `replace`) and stop |

The `$ARGUMENTS` slot is reserved for these mode keywords. Do **not** treat a freeform user blurb in `$ARGUMENTS` as commentary for the body — ignore anything that isn't one of the keywords and surface the error path above.

---

## Frontmatter schema

Every `tasks/checkpoint.md` starts with this YAML block. Keys are stable so future tooling can parse without reading prose. The body follows the closing `---`.

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

**`base_head` (not `head`)** — the short SHA of HEAD *before* the save commit. After the save commit lands, current HEAD is the checkpoint commit; `base_head` is one behind it and is the base of the embedded diff. On resume, `base_head` is compared against the current branch's ancestry to detect drift.

**No `subject` field.** The commit subject is computed in-line at create/replace time from `phase` + `batch_heading` (or `git log -1 --format=%s` in standalone mode) and used directly in the commit message — it is not stored on disk.

### YAML safety rules (applied to every free-text value)

All free-text values (`cursor_text`, `batch_heading`, `plan_path`, `created_at`) MUST be wrapped in double quotes and serialized on a single line. Escape characters in this order:

1. First replace `\` with `\\`.
2. Then replace `"` with `\"`.

Order matters — escaping `\` first ensures the second pass does not double-escape the backslashes produced in step 1. If `cursor_text` would span multiple lines (rare; checkbox lines are normally single-line), collapse internal newlines to a single space before quoting.

Numeric fields (`cursor_line`, `issue`) are unquoted integers; use `0` for "not applicable" rather than empty, so the YAML always parses.

### Fence delimiter rule

Diff and untracked-content blocks use **four backticks** (` ```` `) as the fence delimiter, with the language tag (`diff`, `untracked`, `untracked-content`) immediately after. Three-backtick fences are unsafe for verbatim diff/file content because a content line containing ` ``` ` (for example the middle of a fenced markdown block under change) would close the fence early.

The rule: use a fence one backtick longer than the longest backtick run in the content, with a **four-backtick floor**. If content contains a four-or-longer-backtick run, escalate to five (or longer). For the simple `untracked` filename list, three-backtick fences are fine (filenames don't normally contain backticks), but use four for symmetry.

### Body sections

Produced in this order, every time (all optional but always emitted by default):

1. **What's next** — 2–4 line prose synthesis derived from `cursor_text`, `batch_heading`, and the active phase. The agent re-reads this on resume to rehydrate working memory.
2. **Diff block** — verbatim output of `git diff --binary HEAD` at save time, inside a four-backtick `diff` fence. No size cap. `--binary` ensures binary files survive in the recovery backup.
3. **Untracked file list** — one untracked file path per line inside a four-backtick `untracked` fence.
4. **Untracked content blocks** — one per untracked file under the size threshold below, inside a four-backtick `untracked-content` fence with `path: <file>` on the first line followed by the file body. See § "Untracked-file handling" below.

---

## Untracked-file handling

For every untracked file (`git ls-files --others --exclude-standard`), check both caps:

- **Line cap:** ≤ 100 lines.
- **Byte cap:** ≤ 10 KB (10240 bytes).
- **Binary detection:** A file is treated as binary if it contains any null byte in its first 8 KB (or if `git check-attr binary -- <file>` reports `binary: set`). Binary files are **always** refused regardless of size — embedding raw bytes inside a Markdown fence would corrupt them on recovery, and the `untracked-content` block was designed for text only. The refusal message names the file, calls out the binary detection, and gives the same `git add` / `rm` / move-outside-worktree guidance as the cap-tripped case.

**Both caps must be satisfied AND the file must be non-binary** for it to be embedded. A file passing one cap but tripping the other (or any binary file) is a refusal — the dual cap closes the minified-blob gap (a one-line 500 KB file passes a naïve line-count test), and the binary check closes the small-binary gap (a 5 KB PNG passes both caps but cannot be safely embedded as text).

- **Under both caps and non-binary:** embed the file's contents in an `untracked-content` fenced block.
- **Above either cap, OR detected as binary:** `/checkpoint` **refuses** — it lists every offending file, names the reason each was refused (line cap, byte cap, or binary), and tells the developer to either `git add <file>` (so the file rides on the embedded-diff path, where `git diff --binary` handles binary content correctly), `rm` it, or move it outside the worktree, then re-run. (`git rm` is for tracked files only and would error here.) This is deliberate friction: anything large enough to lose silently — or any binary that can't survive a Markdown fence — should be in the developer's hands, not the artifact.

### QRSPI artifact special case

If the offending list includes any of the QRSPI singleton/issue artifact paths — `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/research-patterns.md`, `tasks/plan.md`, `tasks/research-issue-<N>.md`, `tasks/plan-issue-<N>.md` — the refusal message names them explicitly and recommends the `git add` path with an exact one-liner, for example:

> *"`tasks/research-codebase.md` (33 KB, exceeds 10 KB cap) is a QRSPI artifact. Run `git add tasks/research-codebase.md tasks/design-decision.md tasks/plan.md` (whichever exist) and `git commit -m 'chore: snapshot QRSPI artifacts'`, then re-run `/checkpoint`."*

QRSPI artifacts are *meant* to be tracked; checkpoint is just surfacing the hygiene gap. (Auto-staging was considered and rejected: silently mutating the developer's index has surprising downstream effects on `/finish` and `/implement`'s per-phase commits.)

---

## Branch and `base_head` mismatch on resume

On resume, compare the saved `branch:` and `base_head:` against the current repo state:

- **Branch differs** from `branch:` → **warn, do not refuse**. Tell the developer the checkpoint was saved on `<branch>` and they are on `<current>`; ask whether to switch branches or proceed. Wait for confirmation.
- **`base_head` not reachable** from current HEAD (the diff's base is no longer an ancestor — branch was reset, rebased, or hard-pointed elsewhere) → **warn, recommend** the developer inspect the embedded diff before continuing. Do not refuse.
- **`base_head` reachable but current HEAD has advanced** beyond it → **informational note** in the resume report; the worktree state is still the source of truth.

The consume step only runs after rehydration validation succeeds (frontmatter parsed, branch confirmed, cursor reconciled). If the developer backs out at any warning, the checkpoint file is **retained** on disk for retry — no consume commit.

---

## Create-mode steps

1. **Inspect filesystem (no recall)** — check for presence of each QRSPI artifact. Glob `tasks/plan-issue-*.md` and `tasks/research-issue-*.md`, extract issue numbers from filenames, and take the **union** (a research-issue-only state is a valid mid-issue state where research is done but plan hasn't been created yet). Derive `mode`, `phase`, `plan_path`, and `issue` using the rules below. The singleton-QRSPI flow is derived **first**; only when no singleton artifacts are present do we fall through to issue flow.

   **Singleton-vs-issue precedence:** if any of `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/research-patterns.md`, or `tasks/plan.md` exist, the developer is in singleton-QRSPI mode **regardless of any leftover `plan-issue-*.md` / `research-issue-*.md` files** (those are most likely stale from prior work). Singleton wins. Issue flow only activates when no singleton QRSPI artifacts exist.

   **Active-issue selection (only runs when no singleton QRSPI artifacts exist):**
   - Zero issue artifacts (no `plan-issue-*.md` AND no `research-issue-*.md`) → `issue: 0`, fall through to standalone.
   - Exactly one issue number `N` across the union → `issue: N`.
   - Multiple distinct issue numbers across the union → `issue: 0`, `mode: standalone`, `phase: none`, and add a body note: *"Active issue ambiguous — multiple issue artifacts present (`<list>`); treated as standalone snapshot. Run `/finish` or clean up stale issue plans before checkpointing in issue mode again."*

   **Phase derivation (singleton-QRSPI flow):**
   - `tasks/plan.md` exists with at least one `- [ ]` → `mode: qrspi`, `phase: implement`, `plan_path: "tasks/plan.md"`.
   - `tasks/plan.md` exists, all `- [x]` → `mode: qrspi`, `phase: implement`, `plan_path: "tasks/plan.md"` with an empty cursor; tell the developer the plan is fully checked (they probably want `/finish`, not `/checkpoint`).
   - `tasks/design-decision.md` exists, no `tasks/plan.md` → `mode: qrspi`, `phase: plan`, `plan_path: ""`.
   - `tasks/research-codebase.md` exists, no `tasks/design-decision.md` → `mode: qrspi`, `phase: design`, `plan_path: ""`.

   **Phase derivation (issue flow, when `issue: <N>` is set and no singleton artifacts exist):**
   - `tasks/plan-issue-<N>.md` exists with at least one `- [ ]` → `mode: qrspi`, `phase: implement`, `plan_path: "tasks/plan-issue-<N>.md"`.
   - `tasks/plan-issue-<N>.md` exists, all `- [x]` → `mode: qrspi`, `phase: implement`, `plan_path: "tasks/plan-issue-<N>.md"` with an empty cursor; tell the developer the issue plan is complete.
   - `tasks/research-issue-<N>.md` exists, no `tasks/plan-issue-<N>.md` → `mode: qrspi`, `phase: plan`, `plan_path: ""`.

   **Standalone fallback:** if neither flow yields a phase → `mode: standalone`, `phase: none`, `plan_path: ""`, `issue: 0`.

2. **Inspect git** — capture `branch` (`git rev-parse --abbrev-ref HEAD`) and `base_head` (`git rev-parse --short HEAD`). The current HEAD short SHA, captured *before* the save commit, becomes `base_head`.

3. **Extract cursor (F3)** — when `phase: implement` and `plan_path` is non-empty, read that file. Find the first `- [ ]` line; record:
   - 1-based line number as `cursor_line`,
   - full text of that line, collapsed to a single line, double-quoted, and escaped per the YAML safety rules above (`\` → `\\` first, then `"` → `\"`) — stored as `cursor_text`,
   - the nearest preceding `##`/`###` heading (same quoting rules) as `batch_heading`.

   If no unchecked item exists, set `cursor_line: 0`, `cursor_text: ""`, `batch_heading: ""`.

4. **Capture diff** — run `git diff --binary HEAD` and embed the verbatim output in a four-backtick `diff` fence per the fence delimiter rule (escalate beyond four if the diff itself contains a four-or-longer backtick run). No size cap. `--binary` is required so binary files are recoverable from the artifact alone.

5. **Capture untracked** — run `git ls-files --others --exclude-standard`. List each path in a four-backtick `untracked` fenced block. For each path, check both caps (≤ 100 lines AND ≤ 10 KB) and run binary detection:
   - Passes both caps AND is non-binary → emit a four-backtick `untracked-content` block with `path: <file>` on the first line followed by the file body.
   - Fails either cap, OR is detected as binary → **abort** with the refusal message from § "Untracked-file handling", listing every offending file and the reason each was refused (line cap, byte cap, or binary). Do **not** write `tasks/checkpoint.md`. Do **not** commit. Apply the QRSPI artifact special case if any offender is a QRSPI artifact path.

6. **Synthesize body** — write a 2–4 line "What's next" note derived from `cursor_text`, `batch_heading`, and the active phase. In standalone mode (no QRSPI artifacts), write a generic "ad-hoc snapshot" line plus the most recent commit subject from `git log -1 --format=%s`. Do **not** treat `$ARGUMENTS` as a freeform blurb.

7. **Compose commit subject** — a short imperative phrase, single-line, used in the commit message only (not stored in frontmatter). Selection rules:
   - `phase: implement` and `batch_heading` non-empty → use the heading text stripped of leading `##`/`###` markers.
   - `phase` is `research` / `design` / `plan` → use `"<phase> phase"`.
   - Else (standalone) → use `git log -1 --format=%s` truncated to 60 chars.

8. **Write artifact** — overwrite `tasks/checkpoint.md` with the frontmatter plus body in the order documented above.

9. **Commit (isolated)** — the file is currently untracked (brand-new checkpoint), so bare `git commit --only` would error with "pathspec did not match any file known to git". Stage the path first, then commit with `--only` so the commit is path-scoped regardless of whatever was previously staged in the developer's index:

   ```
   git add -- tasks/checkpoint.md
   git commit --only -- tasks/checkpoint.md -m "chore: checkpoint <subject>"
   ```

   `git add` on a single path stages only that path (does not sweep other files). `git commit --only` then commits exactly that path, leaving the rest of the index untouched. Do **not** push. The dirty worktree stays dirty — the embedded diff is a recovery backup, not the primary survival mechanism.

   Stage **only** the single checkpoint path. Bulk index operations (sweeping every tracked change, or clearing the index) would destroy the developer's pre-existing staged/unstaged distinction and pull unrelated work into the checkpoint commit — use the two-step `add --only` pattern above and nothing else.

10. **Confirm and recommend `/compact`** — report: created `tasks/checkpoint.md`, commit hash, mode, phase, cursor (if `phase: implement`). Tell the developer the worktree is intentionally still dirty. Then **explicitly recommend `/compact` as the next move**:

    > *"State is saved to git. Run `/compact` now to clear context — when you (or a fresh session) come back, run `/checkpoint resume` then `/implement` to pick up at `<cursor_text>`."*

    The checkpoint exists on disk and in git before context is cleared, so compaction cannot lose the cursor.

    **Why recommend rather than auto-invoke:** `/compact` is a Claude Code built-in; a slash command cannot programmatically invoke another slash command. The agent surfaces the recommendation; the developer runs `/compact` themselves.

---

## Resume-mode steps

1. **Read** `tasks/checkpoint.md` FULLY (no `limit`/`offset`).
2. **Validate** — parse the frontmatter. If unparseable (missing `---` boundary, malformed YAML), abort and tell the developer. Do **not** consume.
3. **Branch check** — compare `branch:` against current branch. If different, warn but do not abort:

   > *"Checkpoint was saved on `<saved>`; you are on `<current>`. Proceed, or switch branches first?"*

   Wait for developer confirmation. If they back out, abort *without* consuming.
4. **`base_head` check** — compare `base_head:` against current HEAD ancestry using `git merge-base --is-ancestor <base_head> HEAD`. If `base_head` is not an ancestor of current HEAD, warn that the diff's base is no longer reachable, recommend the developer inspect the embedded diff before continuing, and then **wait for explicit confirmation to proceed**. If they back out, abort *without* consuming — `tasks/checkpoint.md` stays on disk for retry. Otherwise, if `base_head` differs from current short HEAD but is reachable, note it in the resume report (informational, no confirmation needed).
5. **Rehydrate phase context** — read the QRSPI artifacts the `phase:` indicates, in this order: `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/research-patterns.md` (if present), and the active plan file (`plan_path`). In issue mode, read the corresponding `tasks/research-issue-<N>.md` and `tasks/plan-issue-<N>.md` instead of the singleton plan/research.
6. **Re-locate cursor** — if `phase: implement`, find the first `- [ ]` in `plan_path` and reconcile against the saved cursor:
   - Same line number AND same text → clean resume.
   - Different line number, same text → use the new line; note that the plan was edited.
   - Text changed → warn that the plan changed since the checkpoint was created; show both the saved `cursor_text` and the current first-unchecked text.
7. **Present rehydration summary** — phase, `cursor_text`, `batch_heading`, branch warning (if any), `base_head` note (if any). Do **not** auto-re-apply the embedded diff — the dirty worktree is the source of truth. Mention that the diff is available in the artifact for recovery only (e.g., if the developer is on a different machine or has reset the worktree).
8. **Consume (isolated)** — only if rehydration validation succeeded (frontmatter parsed, branch confirmed, cursor reconciled). Use `git rm` followed by an isolated `git commit --only` so the deletion is scoped without touching the rest of the developer's index:

   ```
   git rm -- tasks/checkpoint.md
   git commit --only -- tasks/checkpoint.md -m "chore: consume checkpoint"
   ```

   `git rm` removes the file from both worktree and index in one step (more idiomatic than `rm` + relying on `git commit --only` to pick up the worktree deletion). Do not push. The deletion commit rides on the next normal push.

   **If validation fails** (developer declines branch override, `base_head` unreachable and they want to investigate, etc.), **retain** `tasks/checkpoint.md` on disk — do **not** consume. Tell them the checkpoint is preserved for retry.
9. **Confirm and hand off to `/implement`** — report the consume commit hash and tell the developer the session is rehydrated. Then **explicitly point at the next move**:

   > *"Rehydrated at `<phase>`, cursor `<cursor_text>` (line `<cursor_line>` in `<plan_path>`). Run `/implement` to continue from here."*

   In `phase: research` / `design` / `plan` modes, replace the `/implement` recommendation with the appropriate next phase command (`/design`, `/create-plan`). In standalone mode, replace it with "proceed normally — no QRSPI phase active."

---

## Discard-mode steps

Same isolated pattern as the consume step, but with a different commit message:

```
git rm -- tasks/checkpoint.md
git commit --only -- tasks/checkpoint.md -m "chore: discard checkpoint"
```

Tell the developer the checkpoint was deleted without rehydration.

---

## Replace-mode steps

**Atomic single-commit overwrite.** A "discard then create" sequence is non-atomic: an interrupt between commits could leave the developer with no checkpoint at all. A single overwrite commit preserves the prior version in git history via the existing `chore: checkpoint <old subject>` commit, which is the only rollback target needed.

1. Run create-mode steps 1–8 to build the new artifact (this overwrites the existing `tasks/checkpoint.md` in the working tree). The file is already tracked from the prior save commit, so `git add` is technically optional, but use the same two-step pattern for symmetry with create-mode:

   ```
   git add -- tasks/checkpoint.md
   git commit --only -- tasks/checkpoint.md -m "chore: checkpoint <new subject>"
   ```

2. Git records this as a modification of the tracked file. The prior `chore: checkpoint <old subject>` commit remains in history as the rollback target.
3. **Confirm** — one combined report: replaced existing checkpoint, new commit hash, mode, phase, cursor (if `phase: implement`).
