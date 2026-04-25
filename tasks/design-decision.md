# Design: `/codex-review <target>` — generalized Codex review entry point

## Context

Ship a small slash command, `/codex-review <target>`, that gives developers a one-shot Codex second-opinion pass over any target — a file, a diff, an artifact, or a freeform description. The point is to consolidate the unbiased-review principles already encoded across the seven existing Codex-driven review touchpoints (`research-codebase`, `design`, `create-plan`, `implement`, `issue-research-codex`, `issue-plan-review-codex`, `issue-code-review-codex`) into one generalized prompt so ad-hoc `codex exec` invocations stop drifting from the playbook's standards.

Hard constraints from the task spec:
- No task-lifecycle integration — no prerequisite artifacts, no status updates, no follow-on commands, no entry in `/finish` cleanup.
- One generalized prompt — no per-target-type prompt branches.
- Single target per invocation (multi-target is a feature increment, not v1).

Research has already ruled out several axis choices: strict typing of `<target>` (A3), per-type prompt branches (B3), maximal principle lift (C3), persistent output (D3), stdout-only output (D2 — breaks spot-check), pass-through synthesis (E1 — violates spot-check consensus), and triage synthesis (E3 — implies remediation).

**Research:** `tasks/research-codebase.md`

## Options Considered

### Option 1 — Minimalist pass-through (A1 + B1 + C1 + D1 + E2 + F1 + G1)

Axis-choice combination: pass-through `<target>`; single generalized lens block; lift only the universal (5/7+) principles — `--sandbox read-only`, file:line specificity, simplest-approach lens, technical-merit framing; temp file → spot-check → present → delete; inline prompt; single target.

How it works: Claude substitutes `$ARGUMENTS` into the prompt verbatim with a single instruction set ("review this target on three lenses: factual/correctness, simplest-approach, pattern"). No target shape detection, no factual-vs-judgment labels, no consumer-side note about Codex's confidence.

What's good: smallest possible prompt; cleanest possible command shell; lowest risk of drift back to ad-hoc when developers find the slash command lighter than handwriting `codex exec`.

What's not: the task explicitly says "consolidate the unbiased-review principles already encoded across the existing Codex-driven review prompts" — that wording reaches beyond the universal-only set into principles like factual-vs-judgment and "Codex's confidence is not evidence" that appear in fewer prompts but are load-bearing where they appear. C1 leaves those on the floor and arguably under-delivers on the stated goal.

### Option 2 — Consensus-consolidated, pass-through args (A1 + B1 + C2 + D1 + E2.5 + F1 + G1)

Axis-choice combination: pass-through `<target>`; single generalized lens block; lift the universal principles **plus** selectively-applicable ones that generalize cleanly — spot-checking (consumer-side), CORRECTION-vs-TRADE-OFF reframed as "factual issue vs judgment call", "Codex's confidence is not evidence" as consumer-side guidance to Claude, "report findings — no remediation plan or task sequence"; temp file → spot-check → present → **opt-in triage** → delete; inline prompt; single target.

How it works: Claude passes the literal `$ARGUMENTS` into the prompt. The prompt body is one universally-applicable lens block (factual/correctness, simplest-approach, pattern) with the factual-vs-judgment classification baked in as labels Codex applies to its findings. Codex infers target shape from its own reading and is asked to state explicitly what it could and could not inspect when the target is ambiguous. The consumer-side step contains the spot-check loop and the one-line confidence-isn't-evidence note.

Implementation refinements (surfaced by Codex cross-check):
- Pre-delete any stale `tasks/codex-review.tmp` before invoking Codex, so a failed previous run isn't mistaken for fresh output.
- Compose the Codex prompt safely — `$ARGUMENTS` may contain quotes, backticks, or newlines, so avoid careless one-line interpolation (write the prompt to a tmp file or use a heredoc; the plan picks the exact mechanism).
- Phrase the "no remediation" instruction narrowly — "no remediation plan or task sequence", not "never include a brief expected direction". A finding often needs a one-line direction to be actionable.
- Ask Codex to state what it could and could not inspect when the target is ambiguous; this keeps A1 honest without adding A2's classifier.

Late-stage refinement (surfaced during planning, after Codex cross-check):
- **E2 widened to E2.5 — opt-in deep triage, no action.** After spot-check + present, the command asks the developer if they want triage. If declined, cleanup runs and the command exits (matches original E2). If accepted, Claude re-reads each cited file/section in full (deeper than the Step 4 sample spot-check), evaluates each finding against the actual code (not just Codex's framing — is its implied direction actually the simplest fix?), and labels each as **apply** (factual issue, verification passed, fix is clear), **judgment call** (defensible alternatives — needs developer input), or **noise** (false positive, didn't survive deeper verification, subjective style). Presents the triaged view with a one-line recommendation per finding. Does NOT apply changes — the developer drives action even on "apply" items. Rationale: raw Codex findings without judgment are often not actionable; deferring all triage to the developer wastes Claude's evaluation capacity. Capped at triage (no fix application) to preserve the "shortcut" framing — extending to action would require scope, an artifact to track fixes, and a verification loop, which is `/implement`'s territory.

What's good: directly matches the task wording ("consolidate the unbiased-review principles already encoded"); a single prompt body avoids B2's drift risk; no target-shape preprocessing keeps the command shell minimal; coupling holds (A1 + B1 is fine — Codex can infer target shape).

What's not: when `<target>` is something marginal (a glob, an unquoted multi-word phrase, a non-existent path), Codex has to figure out what's going on without help. The "state what you could/couldn't inspect" instruction puts a floor on this: ambiguity surfaces as an explicit caveat in the output rather than confused findings.

### Option 3 — Light classification + consensus-consolidated (A2 + B1 + C2 + D1 + E2 + F1 + G1)

Axis-choice combination: identical to Option 2 except Axis A — Claude inspects `<target>` heuristically (does the path exist? is it inside `tasks/`? does it look like a `git diff` ref?) and adds a one-line "this looks like a {file|diff|artifact|freeform} target" preface to the prompt. The review body itself does NOT branch.

How it works: before calling Codex, Claude does a small classification pass — `test -f`, prefix check on `tasks/`, regex for `<sha>..<sha>` or `HEAD~N`. The result becomes a single preface line in the prompt. The lens block is still the one generalized version from Option 2.

What's good: marginally more focused Codex output on edge-case targets; tightens up the one identified weakness in Option 2 (target-shape ambiguity).

What's not: adds preprocessing logic that doesn't exist in any other slash command — the playbook convention is `$ARGUMENTS` pass-through (`auto-issues`, all `issue-*`). Adds a code path that needs maintenance. The marginal quality gain only fires on genuinely ambiguous targets, which the developer can resolve with a clearer arg. Slight tension with the task's "Keep it simple" framing.

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)
- None — every active axis has a defensible choice given the heuristics; no question would change which axis-choice combination wins.

### Non-blocking (can resolve during implementation)
- All four research-stage open questions (OQ1–OQ4) were resolved by Codex cross-check with cited evidence and folded into Option 2 above:
  - OQ1 (where the "Codex's confidence is not evidence" note lives) → consumer-side spot-check step, matching `.claude/commands/design.md:122-126`.
  - OQ2 (refuse blank `<target>`) → yes, mirroring `.claude/commands/research-codebase.md:5`.
  - OQ3 (temp file location) → `tasks/codex-review.tmp`, matching the existing `.tmp` convention.
  - OQ4 (explicit findings-only line) → yes, phrased narrowly as "no remediation plan or task sequence" so brief expected direction is still allowed.

## What We're NOT Doing

- No prerequisite artifact reads (no `tasks/research-codebase.md` or similar).
- No persistent output artifact — temp file only, deleted in cleanup.
- No status updates to `tasks/issues.md` or `tasks/todo.md`.
- No follow-on command suggestions ("run `/X` next").
- No entry in `/finish`'s cleanup list.
- No multi-target support.
- No strict typing of `<target>` — accept the literal arg string.
- No per-target-type prompt branches.
- No skill port — Task 7 in `tasks/todo.md` handles that.

## Decision

**Chosen approach:** Option 2 — Consensus-consolidated, pass-through args (A1 + B1 + C2 + D1 + E2.5 + F1 + G1), with the four Codex-surfaced refinements and the late-stage E2 → E2.5 widening absorbed into Option 2 above.

**Rationale:** Option 2 wins on all three decision heuristics. (1) Codebase patterns: A1 pass-through matches the universal `$ARGUMENTS` convention (`auto-issues.md`, all `issue-*` commands); F1 inline matches majority precedent (4/7 review prompts); D1 + E2.5 (temp → spot-check → present → opt-in triage → delete) keeps the spot-check pattern that's universal across Codex commands and adds opt-in triage as a Claude-synthesizes-on-top extension consistent with the playbook's wider Claude/Codex division of labor. (2) Simplicity: one lens block, no target classifier, one inline prompt — the smallest plausible shape that still consolidates the principles the task wording calls out. The opt-in triage adds one conversational branch, not a code path or artifact. (3) Reversibility: if A2 classification ever proves useful, it can be added as a single preprocessing step without restructuring the prompt; if E2.5 triage proves overkill, it can be removed without restructuring the rest of the command.

Option 1 was rejected because C1 (universal-only) under-delivers on the task's "consolidate the unbiased-review principles" wording — it omits factual-vs-judgment labels and the consumer-side confidence skepticism, both of which generalize cleanly. Option 3 was rejected because A2's preprocessing introduces a code path that exists in no other slash command for a marginal quality gain; Codex's "state what you could/couldn't inspect" instruction (now folded into Option 2) addresses ambiguous-target output without adding the classifier.

Codex independently arrived at A1+B1+C2+D1+**E2**+F1+G1, which reinforced the original axis combination. The E2 → E2.5 widening was a late-stage refinement after planning — not a Codex-surfaced one — driven by the observation that raw Codex findings without judgment are often not actionable enough to justify the developer reading them in full. Capping the widening at opt-in triage (rather than full E3 fix-application) preserves the shortcut framing while letting Claude's synthesis layer earn its keep when invited.
