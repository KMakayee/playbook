# Research: Task 6 — Collapse `-codex` variants in the issue workflow into integrated commands

## Research Question

Collapse the issue workflow's three split-Codex commands (`/issue-research-codex`, `/issue-plan-review-codex`, `/issue-code-review-codex`) into single integrated commands per phase, mirroring how Task 3 (PR #17, commit 78e7369) already integrated Codex into `/research-codebase`, `/design`, `/create-plan`, and `/implement`. Update the `/auto-issues` pipeline to drop the now-merged phases and the cross-reference surface (README, quickref, CLAUDE.md, templates, `pipeline-eval.sh`, `playbook-update.md` managed-files list) accordingly. Behavioral only — Task 7 handles the command-to-skill port later.

## Summary

Three things matter:

1. **The issue flow has 3 phases (research, plan, implement); the QRSPI flow has 4 (research, design, plan, implement).** The issue flow's research command already does double duty as research+design — it produces a "Recommended Approach" because there's no `/design` step. This is the one place where the issue flow won't be a pure mirror of QRSPI: integrated `/issue-research` must keep recommending, while integrated `/issue-plan` and `/issue-implement` are direct mirrors of `/create-plan` and `/implement`.

2. **The collapse is mostly mechanical — the QRSPI commands are the authoritative template.** Task 3 already proved out the integrated pattern (Codex sweeps/reviews → Claude synthesizes/triages → child process applies fixes for `/implement`). The issue commands need the same shape plus the Task 3 upgrades they never received: `model_reasoning_effort=xhigh`, `--search` for research, output verification via `codex-output-check.sh`, and the CORRECTION/TRADE-OFF/RISK taxonomy.

3. **`/auto-issues` and `pipeline-eval.sh` co-evolve or break.** The pipeline collapses from 11 phases to 7 (research, plan, implement, update, commit, eval, cleanup); `pipeline-eval.sh` hardcodes the current 9 log filenames + the `## Review (Resolved)` marker, both of which become obsolete.

The dominant cost is **getting the cross-reference fan-out right**. Six files still advertise the split commands; missing any creates a documentation lie. There's also a pre-existing inconsistency in `tasks/issues.md:5` (lists `/issue-research`, `/issue-audit`, omits `Implemented` state) that's easy to fix as collateral.

## Detailed Findings

### Current issue-flow command surface

The issue flow today exposes six commands that move an issue through the board, plus the orchestrator. Codex's §1 file map at `tasks/codex-research.tmp:6-21` enumerates the line-level entry points; the diagnostic layer below adds the *why* and the cross-component connections.

- **`/issue-research-codex` (`.claude/commands/issue-research-codex.md:1-103`)** — already integrated structurally (Codex sweeps, Claude verifies and synthesizes), but uses the *pre-Task-3* Codex CLI shape: plain `codex exec` (no `model_reasoning_effort=xhigh`, no `--search`), no `codex-output-check.sh` verification, inline prompt instead of the externalized template at `.claude/prompts/research-guide.md`. Outputs `tasks/research-issue-N.md` with a required **Recommended Approach** section (lines 78-79), which the issue flow's lack of `/design` makes load-bearing.
- **`/issue-plan` (`.claude/commands/issue-plan.md:1-71`)** — Claude-only draft. No Codex involvement. Mirrors `/create-plan`'s old shape pre-Task-3.
- **`/issue-plan-review-codex` (`.claude/commands/issue-plan-review-codex.md:1-69`)** — Codex review pass; appends a `## Review` section to `tasks/plan-issue-N.md` with CORRECTION/TRADE-OFF labels. Does NOT apply findings — the review is purely advisory in the manual path.
- **`/issue-implement` (`.claude/commands/issue-implement.md:1-74`)** — phase-by-phase execution loop. No Codex involvement.
- **`/issue-code-review-codex` (`.claude/commands/issue-code-review-codex.md:1-55`)** — Codex review pass over the implementation; presents findings only. No fix application.
- **`/issue-update` (`.claude/commands/issue-update.md:1-43`)** — post-implementation impact analysis on other open issues. **Out of scope for Task 6** — no Codex involvement, no behavioral change.
- **`/auto-issues` (`.claude/commands/auto-issues.md:1-189`)** — 11-phase orchestrator that runs the above as `claude -p ... --dangerously-skip-permissions` child processes, plus two custom inline prompts (Phase 4 and Phase 7) that "apply" the review/code-review findings.

### The QRSPI template (Task 3 finalized pattern)

These are the authoritative reference shape Task 6 mirrors. Codex's §5 named PR #17 (commit `78e7369`) as the precedent.

- **`/research-codebase` (`.claude/commands/research-codebase.md`)** — Codex with `--search` (foreground, 600000ms) → output verification → Claude spot-checks + synthesizes axes/coupling/external research → writes `tasks/research-codebase.md`. Uses externalized prompt template at `.claude/prompts/research-guide.md` with `{TASK}` and `{SEARCH_HINTS}` placeholders.
- **`/design` (`.claude/commands/design.md`)** — Claude proposes options → Codex independent design + cross-check (foreground) → Claude synthesizes; pattern research is its own foreground Codex `--search` call. Has a tiebreaker fallback that runs Codex once more.
- **`/create-plan` (`.claude/commands/create-plan.md`)** — Claude drafts → Codex review (foreground) → Claude absorbs findings *in place* (no separate `## Review` section, no separate apply step). The CORRECTION/TRADE-OFF/RISK taxonomy is enforced in the Codex prompt.
- **`/implement` (`.claude/commands/implement.md`)** — Phase-by-phase execution → Codex code review (`run_in_background`) → Claude triages findings → child `claude -p ...` process applies fixes (`run_in_background`) → final verification → commit. The triage step writes `tasks/code-review-fixes.tmp` as the precise hand-off to the child.

The template enforces three things the issue flow doesn't currently have:
1. **Output verification** via `bash .claude/scripts/codex-output-check.sh <tmp> <min-lines>` before reading any Codex output (`research-codebase.md:49`, `create-plan.md:86`, `implement.md:101`).
2. **Externalized prompt templates** for research (`.claude/prompts/research-guide.md`) and pattern research (`.claude/prompts/research-patterns-guide.md`).
3. **Codex CLI upgrades**: `model_reasoning_effort=xhigh` everywhere; `--search` for research-only; `run_in_background` for `/implement`'s code review only.

### Auto-pipeline structure today vs. after collapse

`/auto-issues` runs the following 11 phases (`auto-issues.md:26-152`):

| Phase | Today | Status after collapse |
|---|---|---|
| 1. Research | `/issue-research-codex` | Becomes `/issue-research` (renamed) |
| 2. Plan | `/issue-plan` (draft only) | Absorbs Phases 3+4 |
| 3. Plan Review | `/issue-plan-review-codex` | **Removed** (folded into Phase 2) |
| 4. Apply Review | inline `claude -p` (custom prompt) | **Removed** (folded into Phase 2) |
| 5. Implement | `/issue-implement` (execute only) | Absorbs Phases 6+7 |
| 6. Code Review | `/issue-code-review-codex` | **Removed** (folded into Phase 5) |
| 7. Apply Code Review | inline `claude -p` (custom prompt) | **Removed** (folded into Phase 5) |
| 8. Update | `/issue-update` | Renumbered |
| 9. Commit & Push | `/commit` | Renumbered |
| 10. Evaluate | `pipeline-eval.sh` | Renumbered |
| 11. Cleanup | inline | Renumbered |

Net effect: 11 → 7 phases (~36% reduction), and the two custom inline prompts at lines 67-72 and 108-113 disappear entirely (they were the only places auto-issues encoded behavior the standalone commands didn't).

### Pipeline-eval.sh dependencies on the current shape

`.claude/scripts/pipeline-eval.sh` hardcodes the current pipeline structure in three places:
- **Line 13**: log-filename loop expects `1-research, 2-plan, 3-review, 4-apply-review, 5-implement, 6-code-review, 7-apply-code-review, 8-update, 9-commit` (9 phases).
- **Line 41**: temp-file loop expects `tasks/codex-issue-research-N.tmp`, `tasks/codex-issue-plan-review-N.tmp`, `tasks/codex-issue-code-review-N.tmp` (3 temp files — would shrink if integrated commands clean up their own temp files like the QRSPI commands do).
- **Line 53**: `## Review (Resolved)` marker check on `tasks/plan-issue-N.md` — becomes obsolete if integrated `/issue-plan` absorbs review findings in place (no marker).

This script must co-evolve. Forgetting it means PASS verdicts on incomplete pipelines or FAIL verdicts on correct ones.

### Cross-reference fan-out

Six files outside the command surface still advertise the split commands:

| File | Line | Current text |
|---|---|---|
| `README.md` | 51-57 | Command table lists `/issue-research-codex`, `/issue-plan-review-codex`, `/issue-code-review-codex` |
| `quickref.md` | 31-37 | Same command table |
| `CLAUDE.md` | 32 | "Use `/issue-research-codex`, `/issue-plan`, `/issue-plan-review-codex`, `/issue-implement`, `/issue-code-review-codex` to move issues through the workflow." |
| `templates/new-issues.md` | 5 | Lists the 6 issue commands at the top of the template |
| `templates/deferred.md` | 4 | "Updated by: `/issue-plan-review-codex` moves items here when they fall outside the current plan's scope." |
| `.claude/commands/playbook-update.md` | 25-30 | Managed-files list includes 6 issue command files (must shrink to 3 + auto-issues) |

There is also a **pre-existing inconsistency** in `tasks/issues.md:5` that the file's commands list reads `/issue-research`, `/issue-plan`, `/issue-audit`, `/issue-implement`, `/issue-update` — wrong on three counts (no `-codex` suffix on research, an `/issue-audit` command that doesn't exist anywhere in `.claude/commands/`, and the status flow on line 4 omits `Implemented`). Easy to fix as collateral; flagged as a CORRECTION below.

### Recommended Approach is the architectural pivot

The QRSPI flow separates **research** (axes + evidence, no recommendation) from **design** (pick a winner from axes). The issue flow collapses both into research because there's no `/design` command — `/issue-research-codex` produces a "Recommended Approach" inline (lines 78-79) and `/issue-plan` consumes it as the design decision (lines 36 references "Recommended approach — which approach was chosen and why (from the research artifact's Recommended Approach section)").

This means integrated `/issue-research` cannot be a pure copy of `/research-codebase`'s structure. Either:
- (a) Keep the recommend-included shape — Codex produces axes per `research-guide.md`, then Claude synthesizes both the axes report AND the chosen approach in one artifact. The artifact's **Design Axes** section becomes scaffolding the Recommended Approach is built on.
- (b) Add a synthesis layer post-Codex that runs Claude through a mini-`/design`-equivalent — pick a winner from the axes Codex surfaced, write Recommended Approach.
- (c) Migrate the recommendation step into integrated `/issue-plan`, making it research+design+plan in one — but this collapses too much and loses the separation the artifact-on-disk handoff currently provides.

Today's `/issue-research-codex.md:96` says "Research AND recommend — since the issue workflow skips the design phase, this command should propose an implementation approach alongside the findings." Task 6 must keep that obligation while plugging into the new template.

### Manual vs. automated path split

`/auto-issues` and the standalone commands serve different audiences. Today:
- **Manual path**: developer runs each phase, reads findings, decides what to apply. `/issue-plan-review-codex` and `/issue-code-review-codex` are review-only by design — the developer chooses what to do with findings.
- **Automated path**: `/auto-issues` adds the inline "apply" prompts (Phases 4 and 7) to make the pipeline non-interactive.

When the commands integrate, the manual path must still expose the *findings* even if the same command auto-applies them. The QRSPI `/create-plan` solves this by absorbing findings in place and surfacing what was changed in Step 7's "Present findings" report. `/implement` solves it by separating the triage step (Step 7) from the apply step (Step 8 child process), then reporting both in Step 11. The integrated issue commands can do the same — the developer-facing report in the standalone path is the same as the auto path's log content.

## Code References

- `.claude/commands/issue-research-codex.md:1-103` — current research command (research+recommend, pre-Task-3 Codex shape)
- `.claude/commands/issue-research-codex.md:78-79,96` — "Recommended Approach" section + "Research AND recommend" rule
- `.claude/commands/issue-plan.md:1-71` — Claude-only plan draft
- `.claude/commands/issue-plan.md:36` — consumes Recommended Approach from research artifact
- `.claude/commands/issue-plan-review-codex.md:1-69` — Codex plan review (appends `## Review`)
- `.claude/commands/issue-plan-review-codex.md:51-55` — deferred-items handling (drops to `tasks/deferred.md`)
- `.claude/commands/issue-implement.md:1-74` — phase-by-phase execution
- `.claude/commands/issue-code-review-codex.md:1-55` — Codex code review (review-only)
- `.claude/commands/issue-update.md:1-43` — out of scope for Task 6
- `.claude/commands/auto-issues.md:26-152` — 11-phase pipeline
- `.claude/commands/auto-issues.md:62-77,104-117` — Phase 4 + Phase 7 inline "apply" prompts (eliminated by collapse)
- `.claude/commands/research-codebase.md` — QRSPI research template (target shape for integrated `/issue-research`)
- `.claude/commands/create-plan.md:48-90` — QRSPI plan-review absorption pattern (target shape for integrated `/issue-plan`)
- `.claude/commands/implement.md:71-153` — QRSPI code-review + child-process apply pattern (target shape for integrated `/issue-implement`)
- `.claude/scripts/pipeline-eval.sh:13,41,53` — hardcoded log/temp/marker assumptions
- `.claude/scripts/codex-output-check.sh` — output verification (used by all Task 3 commands; not yet used by issue commands)
- `.claude/prompts/research-guide.md` — externalized Codex prompt template
- `.claude/prompts/research-patterns-guide.md` — pattern-research template (issue flow has no equivalent — no design phase)
- `tasks/issues.md:4-5` — pre-existing inconsistency in commands list and status flow
- `templates/new-issues.md:5`, `templates/deferred.md:4`, `CLAUDE.md:32`, `README.md:51-57`, `quickref.md:31-37`, `.claude/commands/playbook-update.md:25-30` — cross-references to update
- `tasks/errors.md:15-17` — documents the 600000ms Codex timeout requirement
- `tasks/todo.md:24,38-39` — Task 6 description and Dependencies paragraph

## Architecture Analysis

**Why the split exists today.** The Codex commands look like later additions on top of the Claude-only baseline — `/issue-plan` and `/issue-implement` precede their `-codex` siblings in the QRSPI flow's evolution (Task 3's PR #17 was the cleanup pass for the *singleton* QRSPI commands; the issue flow lagged). Naming the additions `-codex` was a transparent way to say "this is the supplementary Codex pass," but it made the single-phase flow surface 6 commands instead of 3.

**Why integration matters now.** Task 3 demonstrated the integrated pattern works on the singleton flow without losing the developer's ability to inspect findings (Codex output stays in temp files until cleanup; final reports surface what was applied vs. flagged). The pattern is well-tested. The issue flow has been drifting from it — every Task 3 upgrade (output verification, taxonomy, `--search`, `model_reasoning_effort=xhigh`) is a missing feature on the issue side. Collapsing in lockstep with Task 3 means the issue flow inherits Task 3's quality bar in a single edit instead of slow piecemeal catch-up.

**Why `/auto-issues` is the secondary subject, not a bystander.** Phases 3, 4, 6, and 7 of the pipeline encode behavior that lives nowhere else (the inline "apply review" prompts at `auto-issues.md:67-72` and `:108-113` are NOT reused in the standalone commands — the manual path has no equivalent). Collapsing the standalone commands without restructuring auto-issues would leave the inline prompts pointing at non-existent next steps (Phase 6 calls `/issue-code-review-codex`, which would be removed). The two surfaces co-evolve.

**Why `pipeline-eval.sh` is the third co-evolving piece.** It's the integrity check. It encodes the *expected pipeline shape* — log filenames, temp filenames, the `## Review (Resolved)` marker. All three encode pre-collapse assumptions; all three must update. Forgetting it doesn't break anything functionally — eval just lies (PASS on incomplete pipelines or FAIL on correct ones).

## Design Axes

### Axis 1: Renaming strategy for `/issue-research-codex`

- **Choices:**
  - **A. Hard rename to `/issue-research`** — drop the `-codex` suffix; matches `/research-codebase` (no `-codex` in QRSPI naming).
  - **B. Keep the name `/issue-research-codex`** — preserves the existing surface; integrated behavior, suffix becomes vestigial.
  - **C. Rename + leave a one-line forwarding shim** under the old name pointing at the new — easier transition for existing developer muscle memory; shim itself ports forward to Task 7's skill rename.
- **Per-axis constraints:** The choice ripples to all 6 cross-reference files (README, quickref, CLAUDE.md, templates, playbook-update.md). `playbook-update.md:25-30` must update its managed-files list either way (file deletion or addition). `templates/deferred.md:4` references `/issue-plan-review-codex` by name — needs update regardless.
- **Evidence:** `.claude/commands/research-codebase.md` (no `-codex` in QRSPI); `.claude/commands/playbook-update.md:25-30` (managed-files list).

### Axis 2: Removal strategy for `/issue-plan-review-codex` and `/issue-code-review-codex`

- **Choices:**
  - **A. Delete the files outright** — the integrated `/issue-plan` and `/issue-implement` absorb all behavior; nothing references the old names after cross-ref updates.
  - **B. Delete and leave forwarding shims** — same as Axis 1 Option C but for the review commands; tells anyone with stale muscle memory or cached playbook references where the work moved.
  - **C. Keep the files but mark them `(Deprecated — see /issue-plan)`** — softer transition, but doubles the surface and creates "which one do I run?" ambiguity.
- **Per-axis constraints:** `auto-issues.md` must stop invoking the removed commands either way. `playbook-update.md`'s managed-files list must drop them (or keep them if shims). Deletion is easier to verify ("the file isn't there"); shims add a maintenance surface Task 7's skill port has to handle.
- **Evidence:** `auto-issues.md:55,96` invoke the removed commands; `playbook-update.md:27,30` lists them.

### Axis 3: Integrated `/issue-plan` review-absorption shape

- **Choices:**
  - **A. Mirror `/create-plan` exactly** — Claude drafts → Codex reviews → Claude absorbs in place; no `## Review` section, no `## Review (Resolved)` marker. `pipeline-eval.sh:53` marker check becomes obsolete.
  - **B. Hybrid — absorb in place but write a `## Decisions Absorbed` audit section** instead of `## Review (Resolved)` — preserves the audit trail in the artifact; doesn't require pipeline-eval changes if marker text stays the same.
  - **C. Keep the `## Review` artifact section + run inline absorption** — preserves the current marker (no pipeline-eval change) but makes the "absorbed" state implicit (heading text doesn't change).
- **Per-axis constraints:** Whatever's chosen must make the manual path's report-back equivalent to the current auto-pipeline's Phase 4 outcome. The CORRECTION/TRADE-OFF/RISK taxonomy from Codex must be preserved (it's load-bearing for Claude's absorption decisions).
- **Evidence:** `.claude/commands/create-plan.md:92-97` (in-place absorption pattern); `.claude/commands/issue-plan-review-codex.md:46-49` (current `## Review` section structure); `.claude/scripts/pipeline-eval.sh:53` (marker dependency).

### Axis 4: Integrated `/issue-implement` code-review fix-locus

- **Choices:**
  - **A. Mirror `/implement` exactly** — Codex review (background) → Claude triages → child `claude -p` process applies fixes → final verification → commit. Maximum context-quality preservation.
  - **B. Same flow but no child process** — Claude triages AND applies in the same session. Simpler; loses context-quality benefit; risks context bloat in long implementations.
  - **C. Review-only, no auto-fix** — preserves the current `/issue-code-review-codex` behavior; the manual path stays the same; the auto-issues pipeline keeps its inline Phase 7 prompt. Doesn't actually collapse anything.
- **Per-axis constraints:** Choice A removes auto-issues' Phase 7 entirely; choice B removes Phase 7 but bloats `/issue-implement`; choice C doesn't satisfy Task 6's "collapse" intent. Whatever's chosen must keep the surfacing of "Flagged for review" items so the developer sees what the auto-fix declined to touch.
- **Evidence:** `.claude/commands/implement.md:103-148` (parent-triage + child-apply pattern); `.claude/commands/issue-code-review-codex.md:39-46` (current review-only output shape); `.claude/commands/auto-issues.md:108-113` (current auto-fix prompt).

### Axis 5: Integrated `/issue-research` prompt-template strategy

- **Choices:**
  - **A. Reuse `.claude/prompts/research-guide.md` verbatim** — same `{TASK}` and `{SEARCH_HINTS}` placeholders; issue # supplies `{TASK}` from `tasks/issues.md`.
  - **B. Bespoke inline prompt** — keep current pattern from `issue-research-codex.md:22-38`, just add Task 3 upgrades (`model_reasoning_effort=xhigh`, `--search`, `codex-output-check.sh`).
  - **C. New issue-specific external template** — `.claude/prompts/issue-research-guide.md` with issue-flow-specific framing (e.g., the Recommended Approach obligation baked into investigation §6 or §7).
- **Per-axis constraints:** Whichever shape is chosen, the post-Codex Claude synthesis MUST add a Recommended Approach because the issue flow has no `/design` (see Architecture Analysis above). If Choice A, Claude's synthesis layer adds the recommendation step explicitly — `research-guide.md` produces axes only.
- **Evidence:** `.claude/prompts/research-guide.md:1-88` (axes-only output, no recommendation); `.claude/commands/issue-research-codex.md:78-79,96` (Recommended Approach obligation).

### Axis 6: Integrated `/issue-research` Codex CLI invocation upgrade

- **Choices:**
  - **A. Match QRSPI exactly** — `codex -c model_reasoning_effort=xhigh --search exec --sandbox read-only -o tasks/codex-issue-research-N.tmp ...` + `bash .claude/scripts/codex-output-check.sh ... 20` verification.
  - **B. Match QRSPI for flags but skip `--search`** — issues are typically narrower than QRSPI tasks; `--search` may rarely fire usefully and adds latency.
  - **C. Conditional `--search`** — only if the issue description references external libraries/specs.
- **Per-axis constraints:** All three need the 600000ms timeout (`tasks/errors.md:15-17`). All three need output verification (the Task 3 commands enforce it; skipping it is a regression). Conditional `--search` adds detection complexity for a marginal benefit.
- **Evidence:** `.claude/commands/research-codebase.md:43-49` (full QRSPI invocation); `tasks/errors.md:15-17` (timeout rationale).

### Axis 7: Codex foreground vs. background for integrated `/issue-implement` code review

- **Choices:**
  - **A. Background (`run_in_background`)** — matches `/implement.md:73-101`. Allows wall-clock parallelism with other work in the session.
  - **B. Foreground** — simpler control flow; blocks until Codex returns. Matches the current `/issue-code-review-codex` and the auto-issues Phase 6 wait pattern.
  - **C. Background only when run from `/auto-issues`; foreground otherwise** — auto-issues benefits from parallelism; the manual path is interactive anyway.
- **Per-axis constraints:** Background mode requires the parent session to know how to wait on the background process before triaging — `/implement` does this via the task-notification mechanism; the integrated `/issue-implement` would inherit the same. No special accommodation needed in `/auto-issues` — it already uses `run_in_background` for backgroundable phases.
- **Evidence:** `.claude/commands/implement.md:73,101` (background pattern); `.claude/commands/auto-issues.md:91-101` (current Phase 6 background invocation).

### Axis 8: Codex temp-file cleanup locus

- **Choices:**
  - **A. Integrated commands clean up their own temp files** — matches QRSPI commands (`research-codebase.md:148`, `create-plan.md:108-110`, `implement.md:155-160`). `/auto-issues` Phase 11 cleanup shrinks accordingly; `pipeline-eval.sh:41` temp-file checks become obsolete.
  - **B. Temp files persist until `/auto-issues` Phase 11** — matches current issue-flow behavior (`auto-issues.md:154-161`). `pipeline-eval.sh` checks still work; standalone manual path leaves temp files behind.
  - **C. Hybrid — commands clean up at the end of their last step, but `/auto-issues` Phase 10 (Evaluate) runs first** — preserves eval-time access to temp files; cleanup happens just before Phase 11.
- **Per-axis constraints:** `pipeline-eval.sh:41` must update under Choice A (drop the temp-file substance check) and Choice C (re-order phases). Choice B leaves manual path with stale temp files (not an issue since they get overwritten on next run, but inconsistent with QRSPI).
- **Evidence:** `.claude/commands/research-codebase.md:148`, `.claude/commands/create-plan.md:108`, `.claude/commands/implement.md:156-159` (per-command cleanup); `.claude/commands/auto-issues.md:154-161` (current pipeline cleanup); `.claude/scripts/pipeline-eval.sh:41-50` (eval-time temp-file checks).

### Axis 9: `/auto-issues` phase numbering after collapse

- **Choices:**
  - **A. Renumber contiguous (1-7)** — clean log filenames; consumers parsing logs by phase number need updates (only `pipeline-eval.sh` parses these).
  - **B. Preserve historical numbering with gaps** (1, 2, 5, 8, 9, 10, 11) — pipeline-eval.sh stays mostly unchanged; log-archive consistency for old runs.
  - **C. Renumber + version the pipeline** — add a `PIPELINE_VERSION=2` constant in auto-issues; pipeline-eval.sh branches on version. Overkill for the playbook's scale.
- **Per-axis constraints:** The collapse is a breaking change either way (removed phases produce no logs). Old pipeline-eval index entries (`tasks/logs/pipeline-eval-index.md`) are timestamped — they'll persist as historical records regardless of renumbering.
- **Evidence:** `.claude/commands/auto-issues.md:21-24,28-152` (current numbering); `.claude/scripts/pipeline-eval.sh:13` (log filename parsing).

### Axis 10: Integrated `/issue-plan` issue-status semantics

- **Choices:**
  - **A. Final status `In Review`** — the integrated command has reviewed and absorbed Codex findings, so it's review-complete; `In Planning` becomes a transient mid-execution state.
  - **B. Final status `In Planning`** — preserves the gate semantics: `/issue-implement` checks for `In Planning` (or any pre-implement state) and proceeds. Closer to current behavior.
  - **C. Drop `In Review` from the status flow** — the state is no longer reachable as an external boundary if the integrated command absorbs the review. Simplifies the status taxonomy.
- **Per-axis constraints:** `templates/new-issues.md:4` and the current `tasks/issues.md:4` (post-fix) document the status flow. `/issue-implement.md:25` updates status to `In Progress` regardless of incoming state, so the choice doesn't gate the next phase functionally — it's documentation.
- **Evidence:** `.claude/commands/issue-plan.md:49` (current `In Planning` setter); `.claude/commands/issue-plan-review-codex.md:56` (current `In Review` setter); `templates/new-issues.md:4` (status flow doc).

### Axis 11: Pre-existing `tasks/issues.md:5` inconsistency

- **Choices:**
  - **A. Fix as collateral** — update line 5 to match `templates/new-issues.md:5`; update line 4 to include `Implemented`. Cheap to bundle.
  - **B. Defer** — file a separate issue for the inconsistency; Task 6 ignores.
- **Per-axis constraints:** Editing `tasks/issues.md:4-5` doesn't change the issue board's *content* (only its header). Safe to bundle.
- **Evidence:** `tasks/issues.md:4-5` (current state); `templates/new-issues.md:4-5` (correct shape).

## Axis Coupling

- **If Axis 1 = A (hard rename to `/issue-research`)** → Axis 2 (Choice A or B) and the cross-reference fan-out (README, quickref, CLAUDE.md, templates, playbook-update.md) must update consistently. The renamed file replaces `issue-research-codex.md` in `playbook-update.md:25-30`'s managed list.
- **If Axis 3 = A (mirror `/create-plan` — absorb in place, no `## Review (Resolved)` marker)** → `pipeline-eval.sh:53` must drop the marker check. Axis 9's choice doesn't matter for this; the marker check goes regardless.
- **If Axis 4 = A (mirror `/implement` — child-process apply)** → `/auto-issues` Phase 7 (apply code review) is gone; phase numbering shifts (Axis 9 = A) or has a gap (Axis 9 = B).
- **If Axis 5 = A (reuse `research-guide.md`)** → integrated `/issue-research`'s Step "Claude synthesizes" must explicitly add a Recommended Approach (the template produces axes only; the issue flow's no-design constraint requires the recommendation). If Axis 5 = B or C, the recommendation can be baked into the prompt directly.
- **If Axis 6 = A (full QRSPI CLI: `--search` + `model_reasoning_effort=xhigh` + `codex-output-check.sh`)** → Codex temp file shape changes (the substance check expects ≥20 lines per `research-codebase.md:49`); `pipeline-eval.sh:41-50` thresholds may need adjustment if eval-time checks remain (Axis 8 = B or C).
- **If Axis 8 = A (per-command cleanup)** → `pipeline-eval.sh:41-50` temp-file substance checks become impossible (files don't exist by eval time); the eval must rely on artifact substance + log substance only. Auto-issues Phase 11 cleanup list shrinks correspondingly.
- **If Axis 9 = A (renumber contiguous)** → `pipeline-eval.sh:13` log loop must update to the new 7-phase list; the `pipeline-eval-index.md` keeps historical entries with old numbering (no migration needed — the index is append-only timestamped log).
- **If Axis 10 = A (final status `In Review`)** → `templates/new-issues.md:4` doc stays unchanged; if Axis 10 = C (drop `In Review` from flow), `templates/new-issues.md:4` must update. `tasks/issues.md:4` (Axis 11 dependency) must reflect whatever Axis 10 chooses.

## Cross-Cutting Constraints

These apply regardless of axis choice:

- **Keep the `.claude/commands/<name>.md` + `$ARGUMENTS` convention.** Task 7 ports to skills later (`tasks/todo.md:40`). Don't pre-empt that surface change.
- **10-minute Codex timeout** (`tasks/errors.md:15-17`) — every Codex invocation needs `timeout: 600000` because `codex exec` won't write its `-o` output if the bash tool kills it.
- **Sub-agent recursion guard** (`CLAUDE.md` "Sub-Agent Behaviors" section) — nothing changes here. Issue commands don't currently spawn sub-agents and don't need to.
- **CORRECTION/TRADE-OFF/RISK taxonomy** is load-bearing — `/create-plan` and `/implement` enforce it in Codex prompts so Claude can triage findings systematically. Integrated issue commands inherit the same enforcement.
- **`codex-output-check.sh` verification** before reading any Codex output — this is a Task 3 invariant; skipping it is a regression.
- **CORRECTION:** `tasks/issues.md:4-5` is inconsistent with `templates/new-issues.md:4-5` and current command behavior — wrong commands list (`/issue-research`, `/issue-audit` — neither exists), missing `Implemented` from the status flow. Fix as part of Task 6's cross-reference sweep.
- **CORRECTION:** `templates/deferred.md:4` says "Updated by: `/issue-plan-review-codex`" — must update to point to the integrated `/issue-plan` (regardless of Axis 1 rename outcome).
- **CORRECTION:** All 6 cross-reference files (README, quickref, CLAUDE.md, templates, playbook-update.md, plus issues.md inconsistency) need updates — leaving any out creates a documentation lie.
- **`/auto-issues` and `pipeline-eval.sh` co-evolve** — the pipeline shape is encoded in three places (auto-issues phase definitions, pipeline-eval log/temp/marker checks, log filename conventions). Changes must land together.

## External Research

None required. Every axis is evaluable from repository specs, command precedent in `.claude/commands/`, the QRSPI template files, and `tasks/errors.md`. The Codex CLI flags (`-c model_reasoning_effort=xhigh`, `--search`, `--sandbox read-only`, `-o`, `exec`) are already documented in the existing QRSPI commands; no version-specific behavior or external API depends on this task's choices.

## Risk Analysis

- **Manual-path regression on review-only ergonomics.** The current `/issue-code-review-codex` is review-only — the developer chooses what to apply. If Axis 4 = A (full child-process apply), the manual path always auto-applies, which removes the current "let me skim findings before deciding" affordance. Mitigation: the integrated command's "Flagged for review" report (mirroring `/implement.md:163-167`) preserves the surfacing; auto-apply happens to non-flagged items only. But this is a *behavior change*, not just a structural one — flag explicitly in the plan.
- **`pipeline-eval.sh` silently misreports.** If `pipeline-eval.sh` isn't updated in lockstep with `/auto-issues` phase changes, the eval will FAIL on correct pipelines (looking for non-existent log files) or PASS on incomplete pipelines (looking for non-existent markers). Easy to forget — explicit plan step.
- **Cross-reference drift.** Six files reference the split commands; missing any leaves stale documentation. Mitigate by treating the cross-reference sweep as a single phase in the plan, not scattered touchpoints.
- **Recommended Approach quality.** If integrated `/issue-research` reuses `research-guide.md` (Axis 5 = A), the synthesis layer that adds the recommendation needs to be substantive — not a token paragraph at the end. The current `/issue-research-codex.md:36-38` baked recommendation into the Codex prompt, getting Codex to do the lift; reusing the template means Claude does it, which is a context-quality trade-off.
- **Task 7 collision surface.** Task 7 (port commands to skills) is queued. If Task 6 deletes files (Axis 2 = A) without forwarding shims, Task 7 has fewer files to port — net positive. If Task 6 leaves shims (Axis 2 = B), Task 7 inherits the shims as additional skill files. Either way the collision is small; just align with whatever's planned for Task 7.
- **Multi-batch plans not currently supported in `/issue-implement`.** `/implement.md:84` references multi-batch handling per CLAUDE.md's "Multi-Batch Plans" section, but `/issue-implement.md` doesn't. Mirroring `/implement` exactly inherits multi-batch support — out of scope to add deliberately, but it'll come along for the ride. Flag in the plan as an unintended-but-safe inheritance.
- **Auto-issues uses `--dangerously-skip-permissions` for child processes** (`auto-issues.md:31,43,55,67,84,96,108,123,135`). The integrated commands' internal child-process call (in `/issue-implement` for the apply step) inherits this requirement when run from auto-issues — but the standalone manual path's child call needs it too. `/implement.md:141` already passes `--dangerously-skip-permissions`; the integrated `/issue-implement` will too.
- **`tasks/issues.md` line 5 fix isn't tested by any automation.** Easy to forget after editing the templates. Bundle the fix into the same edit batch as `templates/new-issues.md:5`.

## Open Questions

1. **Should integrated `/issue-research` keep "Recommended Approach" inline, or migrate that synthesis layer into integrated `/issue-plan`?** (Affects Axis 5 directly; downstream consumers of `tasks/research-issue-N.md` like `issue-plan.md:36` would need updating if recommendation moves.)
2. **Should the integrated `/issue-implement` always auto-apply non-flagged code-review fixes, or expose a review-only mode for the manual path?** (Affects Axis 4 — a Choice D variant: auto-apply when from auto-issues, review-only when run interactively.)
3. **Should `-codex` command files be deleted outright (Axis 2 = A) or shimmed (Axis 2 = B)?** Task 7's skill port will redo the layout anyway, but shims make the transition smoother for any external automation that wired in by command name.
4. **Should the pre-existing `tasks/issues.md:5` inconsistency be fixed in Task 6 (Axis 11 = A) or deferred to a separate cleanup issue?** Cheap to bundle; the question is whether bundling causes scope creep complaints in code review.
5. **Should `/auto-issues` phase numbering renumber contiguously (Axis 9 = A) or preserve gaps (Axis 9 = B)?** Doesn't affect functionality; affects log-archive ergonomics.
