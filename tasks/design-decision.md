# Design: Task 6 — Collapse `-codex` variants in the issue workflow into integrated commands

## Context

The issue flow today exposes six commands (`/issue-research-codex`, `/issue-plan`, `/issue-plan-review-codex`, `/issue-implement`, `/issue-code-review-codex`, `/issue-update`) where the QRSPI singleton flow has already integrated Codex into 4 commands via Task 3 (PR #17). The split surface forces `/auto-issues` to encode review-application behavior in two custom inline prompts (Phases 4 and 7) that don't exist anywhere else, and `pipeline-eval.sh` hardcodes the 9-phase log shape and the `## Review (Resolved)` marker. The collapse mirrors Task 3's pattern: Codex sweeps/reviews → Claude synthesizes/triages → child process applies fixes for `/issue-implement`. The one structural deviation: integrated `/issue-research` must keep recommending an approach (issue flow has no `/design` step), unlike `/research-codebase` which is axes-only.

**Research:** `tasks/research-codebase.md`

## Options Considered

### Option A — Full QRSPI Mirror (hard rename, delete old files)

**Axis-choice combination:** 1=A, 2=A, 3=A, 4=A, 5=A, 6=A, 7=A, 8=A, 9=A, 10=A, 11=A.

**How it works:**
- Rename `/issue-research-codex` → `/issue-research` (file rename + content rewrite). Delete `/issue-plan-review-codex.md` and `/issue-code-review-codex.md` outright.
- `/issue-research`: reuses `.claude/prompts/research-guide.md` verbatim (`{TASK}` filled from issue body, `{SEARCH_HINTS}` from the issue's keyword surface). Codex CLI matches QRSPI exactly: `model_reasoning_effort=xhigh` + `--search` + `codex-output-check.sh` verification (≥20 lines) + 600000ms timeout. Claude's synthesis layer adds an explicit Recommended Approach section after axes (since `research-guide.md` produces axes only).
- `/issue-plan`: mirrors `/create-plan` — Claude drafts → Codex reviews (foreground, `model_reasoning_effort=xhigh`) → Claude absorbs CORRECTION/TRADE-OFF/RISK findings in place. No `## Review` section, no `## Review (Resolved)` marker. Final issue status: `In Review`. **Inherits the deferred-item handling from `issue-plan-review-codex.md:51-55`**: if Codex's review surfaces items explicitly out of scope, append them to `tasks/deferred.md` using `templates/deferred.md`'s structure, grouped by issue number.
- `/issue-implement`: mirrors `/implement` exactly — phase-by-phase execution → Codex code review (background, `run_in_background`) → Claude triages findings into `tasks/code-review-fixes-issue-N.tmp` (issue-scoped to avoid collision with singleton `/implement`'s `tasks/code-review-fixes.tmp`) → child `claude -p ... --dangerously-skip-permissions` process applies fixes (background) → final verification → commit. "Flagged for review" items surface in the developer-facing report.
- All three integrated commands clean up their own Codex temp files (matching QRSPI per-command cleanup).
- `/auto-issues`: collapses 11 phases → 7 (research, plan, implement, update, commit, eval, cleanup) with **contiguous renumbering** (1-7). The two custom inline "apply" prompts at lines 67-72 and 108-113 are deleted.
- `pipeline-eval.sh`: the 9-log loop (line 13) shrinks to the **5 child-process logs** that the new pipeline produces — `1-research, 2-plan, 3-implement, 4-update, 5-commit` (eval and cleanup don't run as `claude -p` children, so they produce no logs — this matches today's behavior where Phases 10/11 are also unlogged). The substance loop (line 22) checks all 5 since every child phase now produces non-empty Claude output (no Codex-only phases left at the parent level). The temp-file check (line 41) updates to the 3 new integrated temp files — `tasks/codex-issue-research-N.tmp`, `tasks/codex-issue-plan-review-N.tmp` (or rename to match new naming), `tasks/codex-issue-code-review-N.tmp` — but **only if** per-command cleanup runs *after* eval, which Axis 8=A doesn't guarantee. Since Axis 8=A removes temps before eval, drop the temp-file check entirely (line 41-51). The `## Review (Resolved)` marker check (line 54) drops since absorption happens in place.
- Cross-reference sweep: README.md, quickref.md, CLAUDE.md, templates/new-issues.md, templates/deferred.md, .claude/commands/playbook-update.md all updated to the new 3+`/auto-issues` surface.
- Collateral: fix `tasks/issues.md:4-5` inconsistency (commands list and status flow) in the same edit batch.

**What's good:**
- Smallest surface area — 3 issue commands + `/auto-issues` + `/issue-update` = 5 files in `.claude/commands/issue-*.md` instead of 6, no shims, no deprecated stubs.
- Maximum consistency with Task 3's QRSPI template — every Task 3 upgrade (`xhigh`, `--search`, output verification, taxonomy, child-process apply) lands at once.
- `pipeline-eval.sh` has clean post-collapse contracts (no marker checks, no temp-file checks); reduced surface for silent misreports.
- Task 7 (skill port) inherits a smaller, cleaner command set with no shim baggage.

**What's not:**
- Hard rename + delete is a breaking change. Anyone with cached muscle memory (or external automation, though there's no evidence of any) for `/issue-plan-review-codex` or `/issue-code-review-codex` sees "command not found" with no breadcrumb.
- Any in-flight `tasks/plan-issue-N.md` or `tasks/research-issue-N.md` artifacts produced by the old commands stay valid (the artifact format is unchanged), but anyone who paused mid-pipeline before this lands has to re-run the new command from scratch.
- Choice 4=A always auto-applies Codex's non-flagged code-review fixes. The current `/issue-code-review-codex` is review-only — the manual path loses the "let me skim before deciding" affordance. Mitigation: the "Flagged for review" report mirrors `/implement`'s surfacing, so findings stay visible — but the behavior change is real.
- Reusing `research-guide.md` (Axis 5=A) means Claude's synthesis adds the Recommended Approach. The current `issue-research-codex.md:36-38` baked recommendation into Codex's prompt, getting Codex to do the lift. Moving to Claude is a context-quality trade-off (smaller per-call cost on Codex; more synthesis weight on Claude).

### Option B — Soft Transition (forwarding shims, preserve phase numbering gaps)

**Axis-choice combination:** 1=C, 2=B, 3=A, 4=A, 5=A, 6=A, 7=A, 8=A, 9=B, 10=A, 11=A. (Axis 10 must be A here, not B — under Option B the integrated `/issue-plan` absorbs the only setter for `In Review` from `issue-plan-review-codex.md:56`. Setting final status to `In Planning` would make the `In Review` state in `templates/new-issues.md:4`'s status flow unreachable.)

**How it works:**
- Same internal collapse as Option A (Axes 3-8, 11 identical: integrated commands, QRSPI Codex CLI, in-place absorption, child-process apply, per-command cleanup, fix `tasks/issues.md` inconsistency).
- Axis 1=C: rename `/issue-research-codex` → `/issue-research`, but keep `.claude/commands/issue-research-codex.md` as a 1-line shim that runs the new command with `$ARGUMENTS`.
- Axis 2=B: delete the implementation but leave 1-line forwarding shims at `.claude/commands/issue-plan-review-codex.md` and `.claude/commands/issue-code-review-codex.md` pointing developers to `/issue-plan` / `/issue-implement` respectively.
- Axis 9=B: preserve historical phase numbering (1, 2, 5, 8, 9, 10, 11). `pipeline-eval.sh:13` log-loop list shrinks but keeps the same numbers; `tasks/logs/pipeline-eval-index.md` stays interpretable across the boundary.
- Axis 10=A: same as Option A (integrated `/issue-plan` sets `In Review`, the absorbed setter from `issue-plan-review-codex.md:56`).
- Like Option A, deferred-item handling moves into integrated `/issue-plan`.

**What's good:**
- Smoother developer-facing transition. Anyone running `/issue-plan-review-codex` from cached muscle memory gets the new behavior with a forwarding hint, not an error.
- Preserves phase numbering gaps in `/auto-issues`, which keeps `tasks/logs/pipeline-eval-index.md` historical entries unambiguous (a `pipeline-eval-2026-04-25-T1234-issue-1` log under the old numbering and a new log under preserved-gap numbering both decode to the same phases).
- `templates/new-issues.md:4` and `tasks/issues.md:4` (post-fix) status flow doc stays consistent with the current setter behavior, no doc churn beyond the cross-reference sweep.

**What's not:**
- Three additional shim files (`issue-research-codex.md`, `issue-plan-review-codex.md`, `issue-code-review-codex.md`) — the file count savings vs. today are 0 instead of 3.
- Task 7 (skill port) inherits the shim files and has to decide whether to port them as skills or drop them; net work for Task 7 is higher than Option A.
- `playbook-update.md:25-30` managed-files list has to keep all 6 issue-command files because the shims are real files needing version management.
- Phase-number gaps in `/auto-issues` are visually noisy ("Phase 5: Implement" with no Phases 3, 4, 6, 7) and require a comment explaining the gaps to anyone reading auto-issues for the first time.
- The shims serve no production audience — this repo is single-developer and there's no external automation invoking issue commands by name. The transition cost is theoretical; the maintenance cost is real.

### Option C — Hybrid Manual/Auto Code-Review Mode

**Axis-choice combination:** 1=A, 2=A, 3=A, 4=hybrid (auto-apply when invoked from `/auto-issues`, review-only when run interactively), 5=A, 6=A, 7=B (foreground), 8=A, 9=A, 10=A, 11=A.

**How it works:**
- Same as Option A except Axis 4: integrated `/issue-implement` detects whether it's running under `/auto-issues` (e.g., via an env var the auto-pipeline sets, or by checking for `--dangerously-skip-permissions` mode) and branches:
  - **Auto context:** Codex reviews → Claude triages → child process applies (Option A's flow).
  - **Manual context:** Codex reviews → Claude triages → present findings to developer for confirmation; no auto-apply.
- Axis 7=B (foreground Codex): manual interactive path doesn't benefit from background mode (the user is waiting); foreground simplifies the no-auto-apply branch.

**What's good:**
- Preserves the current manual-path ergonomic ("review-only, developer chooses") that Option A removes. Addresses the explicit research risk: "Manual-path regression on review-only ergonomics."
- The `/auto-issues` pipeline still gets full automation — the auto-apply branch matches Option A's behavior there.

**What's not:**
- This is a **Choice D** on Axis 4 — the research artifact enumerates only A/B/C and frames this as Open Question #2, not a vetted axis choice. Per design rules, introducing a new choice not in research means either justifying that the existing axis coverage was incomplete (it was — research surfaces this exact tension as a risk) or stopping to research more.
- Branch detection adds runtime complexity. There's no clean signal for "running under `/auto-issues`" — the env-var approach requires `/auto-issues` to set a sentinel; the permission-flag approach is fragile. Either way, the integrated `/issue-implement` becomes the only QRSPI-pattern command with conditional branching.
- Diverges from QRSPI's invariant: `/implement` always auto-applies, no manual mode. The manual-mode argument applies to `/implement` too in principle, and Task 3 explicitly chose to drop it. Re-introducing it for the issue flow creates an asymmetry that has to be justified.
- The "Flagged for review" report from Option A already preserves visibility of contested fixes — the developer can see what was applied and what was deferred. The remaining gap is "I don't trust Codex's judgment on the auto-applicable items" — and if that's the concern, the answer is to make Codex's triage stricter (more items flagged), not to gate the entire apply step.

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)

None. All axis choices have evidence cited; the contested decision points are framed in the option trade-offs.

### Non-blocking (can resolve during implementation)

- [ ] How exactly does Claude's synthesis layer in integrated `/issue-research` add the Recommended Approach when reusing `research-guide.md`? Implementation detail: a final synthesis step that picks the highest-merit axis-choice combination from Codex's axes report and writes a `## Recommended Approach` section. The exact prose template is plan-phase work. (Resolved that the recommendation stays in `/issue-research`, not migrated to `/issue-plan`.)
- [ ] Naming for the issue-scoped code-review fixes temp file. Decision: `tasks/code-review-fixes-issue-N.tmp` to avoid collision with singleton `/implement`'s `tasks/code-review-fixes.tmp`.

## What We're NOT Doing

- **Not changing `/issue-update`.** Out of scope per research §1; no Codex involvement, no behavioral change.
- **Not adding multi-batch plan support to `/issue-implement`.** Mirroring `/implement` may inherit it as a side effect, but it's not deliberate scope.
- **Not adding Codex `--search` to `/issue-plan` or `/issue-implement` review steps.** QRSPI's `/create-plan` and `/implement` don't use it — review/plan steps are codebase-grounded, not external-research-grounded.
- **Not pre-empting Task 7 (skill port).** Keep the `.claude/commands/<name>.md` + `$ARGUMENTS` convention. Task 7 changes the surface; Task 6 only changes the contents.
- **Not adding new axes or external research.** The research artifact is the authoritative axis enumeration; this design picks combinations from it.

## Decision

**Chosen approach:** Option A — Full QRSPI Mirror (hard rename, delete old files), with two implementation amendments surfaced by Codex's cross-check (deferred-item handling explicitly carried into integrated `/issue-plan`; `pipeline-eval.sh` updated to the actual 5-log child-process shape, not a 7-log shape).

**Rationale:** Option A wins on every decision heuristic. **Codebase patterns:** it's a 1:1 mirror of Task 3's QRSPI template, the proven pattern in this repo — every Task 3 upgrade (`xhigh`, `--search`, `codex-output-check.sh`, CORRECTION/TRADE-OFF/RISK taxonomy, child-process apply) lands at once. **Simplicity:** smallest surface — 3 issue commands + `/auto-issues` + `/issue-update` instead of 6 + auto-issues, no shims, no deprecated stubs, no conditional branching. Option B's transition value is theoretical (single-developer repo, no external automation invokes these commands by name); the maintenance and Task 7 hand-off costs are real. Option C introduces a Choice D not in research and a runtime-detection pattern that diverges from QRSPI's invariant. **Reversibility:** if a downstream consumer turns up needing the old surface, restoring shims is a 3-file edit — easier than backing out conditional branching or unforking the QRSPI mirror. Codex's independent design converged exactly on Option A's axis combination (1=A through 11=A); the convergence reinforces the choice but isn't the basis for it. The two amendments — deferred handling carryover and pipeline-eval log-shape correction — were direct CORRECTION/RISK callouts from Codex's cross-check that close real gaps in the original Option A draft.
