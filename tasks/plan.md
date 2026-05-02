# Plan: Issue #2 — uniform `</dev/null` discipline (no automated guard)

## Design decision reference

**Chosen approach:** Option B's *coverage* half (uniform `</dev/null` across all 19 sites) from `tasks/design-decision.md:125`. The regression-guard half is **dropped by user direction** — operator monitors backgrounded runs manually and prefers no automated guard for now.

**Why scope grew vs. the original Issue #2:** the 2026-05-02 empirical update (`tasks/design-decision.md:9-14`) falsified Issue #2's "foreground sites are safe" premise — Claude observed the harness auto-background a foreground `codex exec` call from `.claude/commands/design.md:87` and hang it indefinitely. So every long-running `codex exec` / `claude -p` site needs `</dev/null`, not just the seven backgrounded sites originally enumerated.

**Why no lint:** `</dev/null` is a workaround for a harness bug we can't fix from this repo. The lint would enforce per-site discipline, but the operator runs backgrounded calls under direct observation and will catch a hang manually. If discipline rots later, file a follow-up — better next steps are a centralized wrapper (Axis 2=B, deferred) or an upstream harness bug, not entrenching a per-site lint.

**Inputs:**
- `tasks/research-codebase.md` (verified call-site map at lines 19-47)
- `tasks/design-decision.md` (Option B, including Codex's bash-fence refinement at lines 56-68)
- `tasks/issues.md:84-133` (Issue #2 acceptance criteria — needs broadening per design decision)

## Scope boundaries

**In scope:**
- Add `</dev/null` to all 19 long-running `codex exec` / `claude -p` invocations across 9 files in `.claude/commands/`.
- Update `tasks/issues.md` Issue #2 (status, description, acceptance criteria, Notes, Impacts) to reflect the broader scope and apply the OQ wording fixes.
- Append a one-line preservation requirement to Task 11 in `tasks/todo.md` (per design mitigation at `tasks/design-decision.md:69` — even without a lint, Task 11 should preserve the discipline).

**Out of scope (deferred):**
- **Automated regression guard / lint script.** Dropped by user direction. If needed later, add as a follow-up issue.
- Centralized wrapper for `codex exec` / `claude -p` (Option B Axis 2=B; Issue #2 explicitly defers — `tasks/research-codebase.md:110`). Better long-term fix than per-site discipline.
- Task 10 mode flips (foreground → background migration) — separate task; uniform `</dev/null` is what makes Task 10 a clean mode flip later.
- Pre-commit hook integration (Option B Axis 5=A is standalone script only — `tasks/design-decision.md:106`).
- Edits to `CLAUDE.md` top half or QRSPI rules (`tasks/design-decision.md:118`).
- Edits to marker text (`Run with run_in_background`, `Timeout: 600000ms`) — left verbatim.
- `/codex-review`'s missing `codex-output-check.sh` call (`tasks/research-codebase.md:213`) — tangential follow-up, not Issue #2.
- Task 11's actual rewrites of `auto-issues.md` Phases 4-5 and `issue-implement.md` background sites — that's Task 11's own work. Phase 2 of this plan only adds a *cross-reference* to Task 11 so its rewrites preserve the discipline.

## Site map (verified against current code 2026-05-02)

All 19 sites confirmed at the cited line. Each entry shows the **closing line** of the simple command — that's where `</dev/null` attaches (per Axis 3 placement rule, `tasks/design-decision.md:Axis 3`).

### Backgrounded `codex exec` (2 sites)
| File | Start | Closing line | Closing-line text (current) |
|---|---:|---:|---|
| `.claude/commands/implement.md` | 76 | 98 | `Prefix each finding with \`CORRECTION:\`, \`TRADE-OFF:\`, or \`RISK:\` per the QRSPI taxonomy."` |
| `.claude/commands/issue-implement.md` | 83 | 109 | `Prefix each finding with \`CORRECTION:\`, \`TRADE-OFF:\`, or \`RISK:\` per the QRSPI taxonomy."` |

### Backgrounded `claude -p` (5 sites — chained-line placement applies to implement.md:141 and issue-implement.md:154)
| File | Closing line | Notes |
|---|---:|---|
| `.claude/commands/auto-issues.md` | 33 | single-line; `</dev/null` between `--dangerously-skip-permissions` and `> tasks/logs/...log 2>&1` |
| `.claude/commands/auto-issues.md` | 45 | same pattern |
| `.claude/commands/auto-issues.md` | 57 | same pattern |
| `.claude/commands/implement.md` | 146 | chained `mkdir && TIMESTAMP=… && claude -p …`; redirect attaches to `claude -p`, not chain front |
| `.claude/commands/issue-implement.md` | 159 | same chained pattern as implement.md:146 |

### Foreground `claude -p` (2 sites — defensive coverage from original Issue #2 scope)
| File | Closing line |
|---|---:|
| `.claude/commands/auto-issues.md` | 69 |
| `.claude/commands/auto-issues.md` | 81 |

### Foreground `codex exec` (10 sites — Axis 1b=C uniform coverage adds these to scope)
| File | Codex start | Closing line | Closing-line text (current) |
|---|---:|---:|---|
| `.claude/commands/research-codebase.md` | 43 | 46 | `"$(cat tasks/codex-prompt.tmp)"` |
| `.claude/commands/design.md` | 87 | 104 | `Recommend the best approach … not deference to the original design."` |
| `.claude/commands/design.md` | 137 | 144 | `Prefix every claim with \`CORRECTION:\`, \`TRADE-OFF:\`, or \`RISK:\` per the QRSPI taxonomy."` |
| `.claude/commands/design.md` | 195 | 198 | `"$(cat tasks/patterns-prompt.tmp)"` |
| `.claude/commands/create-plan.md` | 55 | 86 | `Be specific with file paths and line numbers."` |
| `.claude/commands/issue-research.md` | 43 | 46 | `"$(cat tasks/codex-issue-prompt-$ARGUMENTS.tmp)"` |
| `.claude/commands/issue-plan.md` | 61 | 92 | `Be specific with file paths and line numbers."` |
| `.claude/commands/codex-review.md` | 58 | 61 | `"$(cat tasks/codex-review-prompt.tmp)"` |
| `.claude/commands/implement.md` | 39 | 48 | `Effort calibration: scope to the specific mismatch — do not sweep beyond the cited files unless the mismatch implicates a wider refactor."` |
| `.claude/commands/issue-implement.md` | 46 | 55 | `Effort calibration: scope to the specific mismatch — do not sweep beyond the cited files unless the mismatch implicates a wider refactor."` |

### Placement rules (from Axis 3 in design)
- **Codex calls** end with the closing `"` of the prompt argument (or `"$(cat …)"` form). Append ` </dev/null` after the closing quote on the same final line so the redirect attaches to the `codex` simple command (which spans multiple lines via `\` continuations).
- **`claude -p` single-line calls** in `auto-issues.md` end with `> tasks/logs/…log 2>&1`. Insert `</dev/null ` *between* `--dangerously-skip-permissions` and `> tasks/logs/…` (order: `</dev/null > log 2>&1` — both attach to the same `claude -p` command).
- **`claude -p` chained calls** in `implement.md:141-146` and `issue-implement.md:154-159` use `mkdir -p … && TIMESTAMP=… && claude -p "…multi-line prompt…" --dangerously-skip-permissions > tasks/logs/…log 2>&1`. Same insertion point as single-line: between `--dangerously-skip-permissions` and `> tasks/logs/…`. **Do NOT** put `</dev/null` at the front of the chain — it would apply to `mkdir`, not `claude -p` (this is the failure mode Issue #2 calls out at `tasks/issues.md:113`).

## Phased breakdown

### Phase 1 — Apply `</dev/null` to all 19 sites

**Goal:** Every long-running `codex exec` / `claude -p` invocation in `.claude/commands/*.md` has `</dev/null` attached to the simple command. Existing `> tasks/logs/...log 2>&1` redirects and `\` line continuations are preserved.

**Files modified (9):**
1. `.claude/commands/auto-issues.md` — 5 edits at lines 33, 45, 57, 69, 81.
2. `.claude/commands/codex-review.md` — 1 edit at line 61 (closes the codex call started at 58).
3. `.claude/commands/create-plan.md` — 1 edit at line 86 (closes the codex call started at 55).
4. `.claude/commands/design.md` — 3 edits at lines 104, 144, 198 (close codex calls started at 87, 137, 195).
5. `.claude/commands/implement.md` — 3 edits at lines 48, 98, 146 (close calls started at 39, 76, 141).
6. `.claude/commands/issue-implement.md` — 3 edits at lines 55, 109, 159 (close calls started at 46, 83, 154).
7. `.claude/commands/issue-plan.md` — 1 edit at line 92 (closes the codex call started at 61).
8. `.claude/commands/issue-research.md` — 1 edit at line 46 (closes the codex call started at 43).
9. `.claude/commands/research-codebase.md` — 1 edit at line 46 (closes the codex call started at 43).

**Per-edit shape:**

For codex sites — append ` </dev/null` after the closing `"` (or `"$(cat …)"`) on the final line of the multi-line `\`-continued command. Example for `design.md:104`:
```diff
-Recommend the best approach — a proposed option, your own, or a hybrid. Base this on technical merit, not deference to the original design."
+Recommend the best approach — a proposed option, your own, or a hybrid. Base this on technical merit, not deference to the original design." </dev/null
```

For `claude -p` sites — insert `</dev/null ` between `--dangerously-skip-permissions` and `> tasks/logs/…`. Example for `auto-issues.md:33`:
```diff
-claude -p "..." --dangerously-skip-permissions > tasks/logs/auto-issue-$ARGUMENTS-1-research-$TIMESTAMP.log 2>&1
+claude -p "..." --dangerously-skip-permissions </dev/null > tasks/logs/auto-issue-$ARGUMENTS-1-research-$TIMESTAMP.log 2>&1
```

For chained `claude -p` (implement.md:146, issue-implement.md:159) — same insertion point. The `mkdir -p tasks/logs &&` and `TIMESTAMP=$(…) &&` prefix at the chain front stays untouched.

**Sub-batch ordering (single commit, but ordered for readability):**
- Sub-batch 1: 7 mandatory backgrounded sites (Issue #2 original scope).
- Sub-batch 2: 12 additional sites added by Axis 1b=C.

**Success criteria for Phase 1 (manual verification only — no lint script):**
- [x] `grep -c "</dev/null" .claude/commands/auto-issues.md` returns ≥ 5 (was 0).
- [x] `grep -c "</dev/null" .claude/commands/implement.md` returns ≥ 3 (was 0).
- [x] `grep -c "</dev/null" .claude/commands/issue-implement.md` returns ≥ 3 (was 0).
- [x] `grep -c "</dev/null" .claude/commands/design.md` returns ≥ 3 (was 0).
- [x] `grep -c "</dev/null" .claude/commands/research-codebase.md` returns ≥ 1 (was 0).
- [x] `grep -c "</dev/null" .claude/commands/issue-research.md` returns ≥ 1 (was 0).
- [x] `grep -c "</dev/null" .claude/commands/create-plan.md` returns ≥ 1 (was 0).
- [x] `grep -c "</dev/null" .claude/commands/issue-plan.md` returns ≥ 1 (was 0).
- [x] `grep -c "</dev/null" .claude/commands/codex-review.md` returns ≥ 1 (was 0).
- [x] **Total `</dev/null` count inside bash fences across `.claude/commands/*.md` ≥ 19** (uniform-coverage scope is exactly 19 sites): `awk 'BEGIN{ib=0} /^[[:space:]]*\`\`\`bash[[:space:]]*$/{ib=1; next} /^[[:space:]]*\`\`\`[[:space:]]*$/{ib=0; next} ib && /<\/dev\/null/{c++} END{print c+0}' .claude/commands/*.md` returns ≥ 19.
- [x] **Per-site placement check (chained `claude -p`):** for each chained-line site, confirm `</dev/null` appears on the same physical line as `> tasks/logs/`: `grep -nE "</dev/null .*> tasks/logs/code-review-fixes" .claude/commands/implement.md .claude/commands/issue-implement.md` returns one match per file (the chain's tail line at `implement.md:146` and `issue-implement.md:159`).
- [x] **Per-site placement check (single-line `claude -p`):** `grep -cE "</dev/null > tasks/logs/auto-issue" .claude/commands/auto-issues.md` returns 5.
- [x] **Per-site placement check (`codex exec`):** every codex-closing line cited in the Site Map (table above) ends with `</dev/null` (or contains `</dev/null` at the end of the simple command). Spot-check by grep: `grep -nE '"\s*</dev/null\s*$|"\$\(cat[^)]+\)"\s*</dev/null\s*$' .claude/commands/*.md` returns ≥ 10 matches (one per codex site).
- [x] No existing `> tasks/logs/...log 2>&1` redirect was removed: `grep -c "> tasks/logs/" .claude/commands/auto-issues.md` returns 5 (unchanged); same check on `implement.md` returns 1 (unchanged); on `issue-implement.md` returns 1 (unchanged).
- [x] No `\` line-continuation broken: visual diff inspection confirms backslash continuations and indentation preserved on every edited codex call (markdown isn't bash-parseable, so no `bash -n` validation).
- [x] **Negative anti-pattern check (chained-line placement):** confirm none of the chained `claude -p` lines have `</dev/null` at the chain front (would apply to `mkdir`): `grep -nE "^[[:space:]]*</dev/null[[:space:]]+(mkdir|TIMESTAMP=)" .claude/commands/*.md` returns nothing.
- [ ] **Smoke test (operator-monitored):** after Phase 1 commits, the operator runs one representative backgrounded `codex exec` invocation (e.g., trigger `/implement` Step 6 or `/issue-implement` Step 6 in a real workflow) and confirms it completes and produces the expected output artifact. Per `tasks/issues.md:119`: if a run still hangs after the fix, the cause is something other than fd-0 reads (`/dev/tty`, permission prompts, model timeouts) — not evidence the redirect failed.

**Commit message:** `fix(commands): add </dev/null to long-running codex/claude -p calls (#2)`

### Phase 2 — Update `tasks/issues.md` Issue #2 + Task 11 cross-reference in `tasks/todo.md`

**Goal:** Bring Issue #2's body in line with what Phase 1 delivered (uniform coverage), apply the wording corrections from the design's non-blocking OQ list, drop the regression-guard acceptance criterion (no lint is being shipped), and cross-reference Task 11 so its rewrites preserve the `</dev/null` discipline (per design-decision Cons line at `tasks/design-decision.md:69`).

**Files modified (2):** `tasks/issues.md`, `tasks/todo.md`.

**Edits to `tasks/issues.md`:**

1. **Description wording (`tasks/issues.md:93`)** — change `the child appears to inherit an open stdin pipe with no writer` to `the child inherits a stdin pipe whose writer-side fd is held open by the harness` (POSIX-accurate per `tasks/research-codebase.md:51` and the design OQ at `tasks/design-decision.md:110`). Companion edit: broaden the trigger framing in the same paragraph from "the harness's `run_in_background: true` mode" to "the harness's `run_in_background: true` mode (or any long-running call the harness may auto-background — see 2026-05-02 update in `tasks/design-decision.md:9-14`)".

2. **Acceptance criteria (`tasks/issues.md:110-119`)** — replace the seven existing checkboxes with the broader uniform-coverage list, **without** a regression-guard criterion (operator monitors manually; no lint shipping). Final form (all checked, since Phase 2 runs after Phase 1 has completed and verified the work):
   - [x] Apply `</dev/null` to every long-running `codex exec` and `claude -p` invocation in `.claude/commands/*.md` (19 sites total: 7 originally-mandatory backgrounded + 12 added by uniform coverage).
   - [x] **Placement rule** — for chained lines like `mkdir -p tasks/logs && TIMESTAMP=… && claude -p …`, the redirect attaches to the `claude -p` simple command (between `--dangerously-skip-permissions` and `> tasks/logs/…log 2>&1`), never the front of the chain.
   - [x] **Verification** — operator-monitored smoke test: at least one representative backgrounded `codex exec` invocation completes and produces its expected output artifact. Live repro on 2026-05-02 confirmed the underlying bug fires in the main repo and that `</dev/null` resolves it. **If a run still hangs after the fix, do not assume `</dev/null` is at fault** — it only addresses fd-0 reads (`/dev/tty`, permission prompts, model timeouts, lock contention may all hang independently).
   - [x] **Regression guard deferred** — no automated lint shipping with this hotfix. Operator monitors backgrounded runs; if discipline rots, file a follow-up to add a lint or build a centralized wrapper (per `tasks/research-codebase.md:110`).

3. **Notes section (`tasks/issues.md:121-129`)** — append a `**2026-05-02 — Scope broadened, lint dropped.**` paragraph explaining (a) the empirical 2026-05-02 finding (foreground call hung after harness auto-backgrounded it) drove the scope expansion from 7 mandatory + 2 defensive sites to 19 uniform sites, and (b) the regression-guard half of the design (Axis 4=B) was dropped on user direction — operator monitors manually. Cite `tasks/design-decision.md:9-14` for the empirical evidence.

4. **Impacts section (`tasks/issues.md:131-133`)** — replace `_None yet._` with a one-paragraph note: **Task 11** (`tasks/todo.md`) will rewrite `auto-issues.md` Phases 4-5 and `issue-implement.md`'s background sites — Task 11 must preserve the `</dev/null` discipline on every long-running `codex exec` / `claude -p` it produces. Without an automated guard, Task 11's reviewer is responsible for verifying the discipline was carried forward.

5. **Status (`tasks/issues.md:86`)** — change `Draft` → `Implemented`. (Per Codex's plan-review trade-off finding #6: setting status `Implemented` after Phase 1 verification is cleaner than leaving it `Draft` while the acceptance criteria are checked. The hand-written `/finish` or PR-merge step moves it to `Done`.)

**Edits to `tasks/todo.md`:**

6. **Task 11 acceptance/notes section** — locate the Task 11 entry and append a one-line bullet to its acceptance criteria or Notes: "Preserve `</dev/null` on every `codex exec` / `claude -p` invocation in the rewritten files (per Issue #2). No automated lint exists — verify by spot-check during review and a smoke run of one backgrounded site." (This satisfies the design's mitigation language at `tasks/design-decision.md:69`, adapted to the no-lint reality.)

**Success criteria for Phase 2:**
- [x] `tasks/issues.md` Issue #2 description no longer contains the phrase "open pipe with no writer".
- [x] `tasks/issues.md` Issue #2 acceptance criteria reference all 19 sites and explicitly note the regression guard was deferred.
- [x] `tasks/issues.md` Issue #2 Notes section contains a 2026-05-02 scope-broadening entry citing the design decision.
- [x] `tasks/issues.md` Issue #2 status is `Implemented`.
- [x] `tasks/issues.md` Issue #2 Impacts section names Task 11 as the cross-coupling.
- [x] `tasks/todo.md` Task 11 entry contains the discipline-preservation note referencing Issue #2.
- [x] No other issues' bodies modified: `git diff tasks/issues.md` only touches the lines under `## #2`.
- [x] No other tasks' entries modified: `git diff tasks/todo.md` only touches Task 11's section.

**Commit message:** `docs(issues): broaden #2 scope to uniform </dev/null discipline`

## Judgment Calls

1. **No automated regression guard in this hotfix.** User direction (operator monitors backgrounded runs manually). Per-site `</dev/null` is a workaround for a harness bug we can't fix from this repo; the right durable fix is a centralized wrapper (Axis 2=B, deferred per `tasks/research-codebase.md:110`) or an upstream harness fix, not entrenching a per-site lint. If discipline rots, file a follow-up. Trade-off: future contributors get no automated enforcement; mitigated by the cross-reference added to Task 11 in Phase 2 and by operator monitoring.

2. **Single commit for Phase 1's 19 site edits, not one commit per file.** The edits are a single logical change (uniform `</dev/null` discipline). Per-file commits would create review noise and make it harder to revert the discipline as a unit if needed. The commit message names Issue #2 so the PR description can lead with the empirical-update framing per `tasks/design-decision.md:134`.

3. **No new `tasks/errors.md` entry.** Issue #2's Notes section captures the rationale and the operator-monitoring stance. Adding an errors entry would duplicate that content.

4. **Issue #2 status moves to `Implemented` in Phase 2 (not left as `Draft`).** Phase 2 runs after Phase 1 verifies the work, so the body is consistent with `Implemented`. Leaving status `Draft` while ticking acceptance criteria as `[x]` would create a mixed board state (Codex's plan-review trade-off finding #6). The hand-written `/finish` or PR-merge step moves it to `Done`.

## Risks

- **Phase 1 chained-line placement.** Putting `</dev/null` at the front of a chain (`</dev/null mkdir && … && claude -p …`) silently misapplies the redirect to `mkdir` — the bug stays. Mitigation: the negative anti-pattern check in Phase 1 success criteria (`grep -nE "^[[:space:]]*</dev/null[[:space:]]+(mkdir|TIMESTAMP=)"`) catches this; visual diff inspection during edit catches it earlier.

- **No automated guard means silent regression.** Without a lint, a future contributor adding a `codex exec` call without `</dev/null` introduces a new hang site that won't surface until it actually hangs. Mitigation: operator monitors backgrounded runs manually (per user direction); Phase 2 adds a discipline-preservation note to Task 11; if drift becomes painful, follow up by either adding a lint or building a centralized wrapper (Axis 2=B).

- **Task 11 collision.** Per `tasks/todo.md:111`, Task 11 rewrites `auto-issues.md` Phases 4-5 and `issue-implement.md`'s background sites. Task 11 is sequenced before Task 10 and has not yet started. Mitigation: Phase 2 of this plan adds a discipline-preservation note to Task 11's acceptance criteria in `tasks/todo.md`. Task 11's reviewer is responsible for verifying the carry-forward (no automated check exists).

- **Editor-introduced whitespace on long codex prompt lines.** Some closing lines (e.g. `design.md:104`) are long single lines with embedded backticks. An over-eager auto-formatter could break them. Mitigation: each Phase 1 edit uses `Edit` tool with the full literal line as `old_string` — exact-match guards against silent rewrites.

## Artifact references

- Research: `tasks/research-codebase.md` (verified call-site map at lines 19-47, mechanism analysis at lines 49-59, axes at lines 114-165).
- Design: `tasks/design-decision.md` (Option B coverage half at lines 46-69, decision rationale at lines 123-134; the regression-guard half is dropped per user direction).
- Issue body: `tasks/issues.md:84-133` (Issue #2; Phase 2 rewrites the acceptance criteria).
- Existing convention: `.claude/scripts/codex-output-check.sh` and `.claude/scripts/pipeline-eval.sh` (no new scripts added).
