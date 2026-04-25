# Create Plan

Build an implementation plan from the finalized design in `tasks/design-decision.md` and research in `tasks/research-codebase.md`, then cross-check it with Codex.

This command uses a three-stage planning process:
1. **Claude drafts** — phased plan grounded in design + research
2. **Codex reviews** — judgment calls, feasibility, completeness, risk
3. **Claude absorbs findings** — applies corrections, resolves trade-offs with best judgment, folds risks into the plan

---

## Steps

### 1. Check prerequisites
- Verify `tasks/research-codebase.md` exists. If not, stop and tell the developer to run `/research-codebase` first.
- Verify `tasks/design-decision.md` exists. If not, stop and tell the developer to run `/design` first. (`/design` only writes the artifact after Codex cross-check + synthesis, so its existence is the finalized signal.)
- If `tasks/plan.md` already exists, stop and ask the developer whether to overwrite or keep.
- Read `tasks/research-codebase.md`, `tasks/design-decision.md`, and `tasks/research-patterns.md` (if it exists) FULLY — use the Read tool WITHOUT limit/offset parameters.

### 2. Claude drafts the plan
Claude leads the synthesis step — translates the chosen approach into a phased execution plan.

1. **Extract implementation context:**
   - Chosen approach from `tasks/design-decision.md` (the winning option after Codex cross-check)
   - Scope boundaries ("What We're NOT Doing")
   - Non-blocking open questions (if any)
   - Acceptance criteria implied by the design

2. **Create the phase structure:**
   - Each phase must be independently testable and leave the codebase in a working state.
   - Order phases so later phases build on earlier ones.

3. **Write detailed plan per phase:**
   - For each phase, specify the exact files to change with line references from research.
   - Describe what changes are needed and why (traceable to the design decision).
   - Write success criteria: commands the agent can run to verify the phase works.
   - If you encounter something unclear, stop and re-research that specific sub-problem using a sub-agent — do not guess.

4. **Write the plan artifact** to `tasks/plan.md`. Structure the plan however best fits the task — there's no rigid template. Use Claude's native planning format. Consider including, where useful:
   - **Design decision reference** — chosen approach with pointer to `tasks/design-decision.md`
   - **Scope boundaries** — what we're NOT doing, to prevent drift during implementation
   - **Phased breakdown** — implementation broken into phases that can be verified independently
   - **File-level specifics** — which files change, what changes, with line references from research
   - **Success criteria per phase** — commands the agent can run to verify each phase works
   - **Judgment Calls** — numbered list of specific choices (tools, libraries, organization, ordering) where an alternative was viable
   - **Artifact references** — pointers to `tasks/research-codebase.md` and `tasks/design-decision.md`

### 3. Run Codex review
Run Codex against the drafted plan. Use a 10-minute timeout (600000ms) — Codex may take a while on large codebases:

```bash
codex exec \
  --sandbox read-only \
  -o tasks/codex-plan-review.tmp \
  "Review the implementation plan in tasks/plan.md against the research in tasks/research-codebase.md and the design in tasks/design-decision.md.

IMPORTANT — For every finding across all parts, classify it as either:
- CORRECTION: factual error, stale reference, or contradiction with the input documents (research/design). These should be fixed, not debated.
- TRADE-OFF: genuine design choice with viable alternatives. These need developer input.
Do not present corrections as open questions.

PART 1 — Judgment calls:
Identify every place the plan made a judgment call — tool choices, library selections, file organization decisions, ordering choices, scope inclusions/exclusions. If the plan has a 'Judgment Calls' section, evaluate each numbered item there specifically. Then scan the rest of the plan for any additional implicit judgment calls. For each call, evaluate independently on technical merit: is this the simplest approach that solves the problem? If a simpler alternative exists, flag it. Do not defer to external docs or specs as authoritative — they are context, not constraints.

PART 2 — Feasibility:
For each phase, verify against the codebase that the files, functions, and integration points referenced actually exist and behave as the plan assumes. Flag any stale references or incorrect assumptions.

PART 3 — Completeness:
Are there gaps — things the design specified that the plan doesn't address (excluding acceptance-criteria coverage, which is PART 5's job)? Are the success criteria for each phase actually sufficient to verify correctness?

PART 4 — Risk:
Are there phases that could leave the codebase in a broken state if interrupted? Are there ordering dependencies the plan doesn't acknowledge? Are there scope items that should be deferred but aren't?

PART 5 — Acceptance criteria coverage:
For each acceptance criterion implied by tasks/design-decision.md (e.g., what the chosen approach must achieve, scope items the design explicitly includes), verify the plan includes steps that address it. Mark each as Covered (with the plan's phase or step reference) or Missing (flag as a CORRECTION, since the design's acceptance criteria are factual inputs).

PART 6 — Stale-reference audit:
For every file:line reference cited in the plan, verify it exists at the cited line in the current code and matches what the plan describes. Flag stale references as CORRECTIONS — these are factual errors the implementer must fix before proceeding, not trade-offs to debate.

Be specific with file paths and line numbers."
```

After Codex finishes, read `tasks/codex-plan-review.tmp` FULLY.

If the `codex` command is not found or fails, stop and tell the developer to fix it before proceeding.

### 4. Claude spot-checks and absorbs findings
Go through every finding Codex flagged — corrections, trade-offs, and risks. For each one, use best judgment and edit `tasks/plan.md` directly to apply the resolution:

- **Corrections** — apply the fix. If a correction conflicts with what you verified in the codebase, trust what you observed.
- **Trade-offs** — weigh alternatives on technical merit and pick one. Codex's recommendation is input, not authority. If a trade-off can't be resolved on merit, stop and tell the developer.
- **Risks** — use best judgment to decide which risks warrant folding into the plan, and where they belong.

### 5. Verify the plan is implementation-ready
Before handing off to `/implement`, check:
- **All corrections applied.** No stale file paths or line numbers remain.
- **Every phase has success criteria** — commands the agent can run.
- **Codex claims verified** — any file path, line, or reference Codex surfaced that was absorbed into the plan has been checked against real code.
- **Plan holds together end-to-end.** Read `tasks/plan.md` start to finish: phases flow logically, ordering makes sense, and the plan fully executes the chosen design.

If Claude can resolve a failed check → fix and re-verify. If it needs developer input → STOP and tell the developer.

### 6. Clean up
Delete `tasks/codex-plan-review.tmp`.

### 7. Present findings
- List the phases with one-line descriptions.
- Note any corrections, trade-off decisions, or risk adjustments absorbed from Codex's review (brief — what changed and why).
- Highlight any areas where research was thin and you had to make judgment calls.
- Ask the developer to confirm or revise the plan before proceeding to `/implement`.

---

## Important notes
- **This command produces a plan artifact — it does NOT implement anything.**
- **The design decision is already made.** Do not revisit or re-evaluate design options — plan the execution of the chosen approach.
- **Be skeptical of research references.** If research says a function exists at a specific line, verify it before building the plan around it. Code changes between research and planning.
- **Sub-agents are optional** for verifying a specific function or file still exists, but MUST NOT spawn further sub-agents (recursion guard).
