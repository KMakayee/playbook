# Issue Plan

Build an implementation plan for issue **#$ARGUMENTS** from the research artifact's recommended approach, then cross-check it with Codex.

If `$ARGUMENTS` is empty or blank, stop and tell the developer to re-invoke with an issue number (e.g., `/issue-plan 12`).

This command uses a three-stage planning process:
1. **Claude drafts** — phased plan grounded in the research artifact's `## Recommended Approach`
2. **Codex reviews** — judgment calls, feasibility, completeness, risk
3. **Claude absorbs findings** — applies corrections, resolves trade-offs with best judgment, folds risks into the plan

The issue flow has no `/design` step, so the recommended approach lives in `tasks/research-issue-$ARGUMENTS.md` (the `## Recommended Approach` section), not in a separate design doc.

---

## Steps

### 1. Check prerequisites
- Verify `tasks/research-issue-$ARGUMENTS.md` exists. If not, stop and tell the developer to run `/issue-research $ARGUMENTS` first.
- Locate issue `#$ARGUMENTS` in `tasks/issues.md`. If the issue doesn't exist, stop and tell the developer.
- If `tasks/plan-issue-$ARGUMENTS.md` already exists, **stop. Do not overwrite.** Tell the developer to manually remove the existing artifact (or rename it) before re-running. Do NOT prompt for confirmation — `/auto-issues` runs children with `--dangerously-skip-permissions`, and a non-interactive child instructed to "ask" may interpret the failure to ask as license to proceed. Hard stop.
- Read `tasks/research-issue-$ARGUMENTS.md` and the issue body in `tasks/issues.md` FULLY — use the Read tool WITHOUT limit/offset parameters.

### 1.5. Update issue status to In Planning
In `tasks/issues.md`, change issue #$ARGUMENTS status to `In Planning`. (The status flow is `In Research → In Planning → In Review`; this command transitions through both. The final `In Review` setter happens in Step 7.)

### 2. Claude drafts the plan
Claude leads the synthesis step — translates the research's recommended approach into a phased execution plan.

1. **Extract implementation context:**
   - Recommended approach from `tasks/research-issue-$ARGUMENTS.md` (the `## Recommended Approach` section — the issue flow's substitute for `tasks/design-decision.md`)
   - Scope boundaries ("What We're NOT Doing") inferred from the recommendation and the issue's acceptance criteria
   - Non-blocking open questions surfaced in the research artifact's `## Open Questions` section (if any)
   - Acceptance criteria — read directly from the issue body in `tasks/issues.md`, not from the research artifact

2. **Create the phase structure:**
   - Each phase must be independently testable and leave the codebase in a working state.
   - Order phases so later phases build on earlier ones.
   - If more than ~5 phases are needed, the issue may be too big — surface this in the present step so the developer can decide whether to split.

3. **Write detailed plan per phase:**
   - For each phase, specify the exact files to change with line references from research.
   - Describe what changes are needed and why (traceable to the recommended approach or an acceptance criterion).
   - Write success criteria: commands the agent can run to verify the phase works.
   - If you encounter something unclear, stop and re-research that specific sub-problem using a sub-agent — do not guess.

4. **Write the plan artifact** to `tasks/plan-issue-$ARGUMENTS.md`. Title it `"Plan: Issue #$ARGUMENTS — [Title]"`. Structure the plan however best fits the issue — there's no rigid template. Use Claude's native planning format. Consider including, where useful:
   - **Issue reference** — issue number, description, and acceptance criteria from `tasks/issues.md`
   - **Recommended approach reference** — chosen approach with pointer to the `## Recommended Approach` section of `tasks/research-issue-$ARGUMENTS.md`
   - **Scope boundaries** — what we're NOT doing, to prevent drift during implementation
   - **Phased breakdown** — implementation broken into phases that can be verified independently
   - **File-level specifics** — which files change, what changes, with line references from research
   - **Success criteria per phase** — commands the agent can run to verify each phase works
   - **Judgment Calls** — numbered list of specific choices (tools, libraries, organization, ordering) where an alternative was viable
   - **Artifact references** — pointer to `tasks/research-issue-$ARGUMENTS.md`

### 3. Run Codex review
Run Codex against the drafted plan. Use a 10-minute timeout (600000ms) — Codex may take a while on large codebases:

```bash
codex -c model_reasoning_effort=xhigh exec \
  --sandbox read-only \
  -o tasks/codex-issue-plan-review-$ARGUMENTS.tmp \
  "Review the implementation plan in tasks/plan-issue-$ARGUMENTS.md against the research in tasks/research-issue-$ARGUMENTS.md and the issue body in tasks/issues.md (acceptance criteria are in the issue, not a separate design doc). The recommendation the plan implements lives in the research artifact's ## Recommended Approach section.

Effort calibration: use the highest applicable level. Light review only when ≤3 phases AND ≤100 LOC of plan-specified changes; standard review when 4–7 phases OR 100–500 LOC; exhaustive review when ≥8 phases OR >500 LOC.

IMPORTANT — For every finding across all parts, classify it with one label:
- CORRECTION: factual error, stale reference, or contradiction with the input documents (research/issue). These should be fixed, not debated.
- TRADE-OFF: genuine design choice with viable alternatives. These need developer input.
- RISK: something that could go wrong, fragile assumption, or interruption hazard (PART 6 stale-reference audit excluded — those are CORRECTIONS).
Do not present corrections as open questions.

PART 1 — Judgment calls:
Identify every place the plan made a judgment call — tool choices, library selections, file organization decisions, ordering choices, scope inclusions/exclusions. If the plan has a 'Judgment Calls' section, evaluate each numbered item there specifically. Then scan the rest of the plan for any additional implicit judgment calls. For each call, evaluate independently on technical merit: is this the simplest approach that solves the problem? If a simpler alternative exists, flag it. Do not defer to external docs or specs as authoritative — they are context, not constraints.

PART 2 — Feasibility:
For each phase, verify against the codebase that the files, functions, and integration points referenced actually exist and behave as the plan assumes. Flag any stale references or incorrect assumptions.

PART 3 — Completeness:
Are there gaps — things the recommendation in the research artifact's ## Recommended Approach section specified that the plan doesn't address (excluding acceptance-criteria coverage, which is PART 5's job)? Are the success criteria for each phase actually sufficient to verify correctness?

PART 4 — Risk:
Are there phases that could leave the codebase in a broken state if interrupted? Are there ordering dependencies the plan doesn't acknowledge? Are there scope items that should be deferred but aren't?

PART 5 — Acceptance criteria coverage:
For each acceptance criterion in the issue body in tasks/issues.md (acceptance criteria are in the issue, not a separate design doc), verify the plan includes steps that address it. Mark each as Covered (with the plan's phase or step reference) or Missing (flag as a CORRECTION, since the issue's acceptance criteria are factual inputs).

PART 6 — Stale-reference audit:
For every file:line reference cited in the plan, verify it exists at the cited line in the current code and matches what the plan describes. Flag stale references as CORRECTIONS — these are factual errors the implementer must fix before proceeding, not trade-offs to debate.

Be specific with file paths and line numbers."
```

Verify the output before reading: `bash .claude/scripts/codex-output-check.sh tasks/codex-issue-plan-review-$ARGUMENTS.tmp 10`. If the check fails, stop and tell the developer.

After Codex finishes, read `tasks/codex-issue-plan-review-$ARGUMENTS.tmp` FULLY.

If the `codex` command is not found or fails, stop and tell the developer to fix it before proceeding.

### 4. Claude spot-checks and absorbs findings
Go through every finding Codex flagged — corrections, trade-offs, and risks. For each one, use best judgment and edit `tasks/plan-issue-$ARGUMENTS.md` directly to apply the resolution:

- **Corrections** — apply the fix. If a correction conflicts with what you verified in the codebase, trust what you observed.
- **Trade-offs** — weigh alternatives on technical merit and pick one. Codex's recommendation is input, not authority. If a trade-off can't be resolved on merit, stop and tell the developer.
- **Risks** — use best judgment to decide which risks warrant folding into the plan, and where they belong.

**Absorb in place — no separate review section, no resolution marker.** Edits go directly into the plan body so there's no marker for downstream tooling to gate on.

### 4.5. Handle deferred items
If Codex's review surfaces items explicitly out of scope or deferred for the current issue:
- Append them to `tasks/deferred.md` using the structure from `templates/deferred.md`.
- Group entries under `### From Issue #$ARGUMENTS — [Title]`.
- Include: what was deferred, why, and suggested future action.

### 5. Verify the plan is implementation-ready
Before handing off to `/issue-implement`, check:
- **All corrections applied.** No stale file paths or line numbers remain.
- **Every phase has success criteria** — commands the agent can run.
- **Codex claims verified** — any file path, line, or reference Codex surfaced that was absorbed into the plan has been checked against real code.
- **Plan holds together end-to-end.** Read `tasks/plan-issue-$ARGUMENTS.md` start to finish: phases flow logically, ordering makes sense, and the plan fully executes the recommended approach and addresses every acceptance criterion in the issue.

If Claude can resolve a failed check → fix and re-verify. If it needs developer input → STOP and tell the developer.

### 6. Clean up
Delete `tasks/codex-issue-plan-review-$ARGUMENTS.tmp`.

### 7. Update issue status
In `tasks/issues.md`, change issue #$ARGUMENTS status to `In Review`.

### 8. Present findings
- List the phases with one-line descriptions.
- Note any corrections, trade-off decisions, or risk adjustments absorbed from Codex's review (brief — what changed and why).
- Highlight any areas where research was thin and you had to make judgment calls.
- Suggest next step: "Run `/issue-implement $ARGUMENTS` next."
- Ask the developer to confirm or revise the plan before proceeding to `/issue-implement`. Do not implement until the plan is approved.

---

## Important notes
- **This command produces a plan artifact — it does NOT implement anything.**
- **The recommended approach is already chosen.** It lives in `tasks/research-issue-$ARGUMENTS.md`'s `## Recommended Approach` section. Do not revisit or re-evaluate the recommendation — plan the execution.
- **Be skeptical of research references.** If research says a function exists at a specific line, verify it before building the plan around it. Code changes between research and planning.
- **Sub-agents are optional** for verifying a specific function or file still exists, but MUST NOT spawn further sub-agents (recursion guard).
- **File reading**: Always read mentioned files FULLY (no limit/offset) before any planning.
