# Plan Review (Codex)

Review the plan in `tasks/plan.md` using OpenAI Codex, then update the plan with review findings.

---

## Steps

1. **Check prerequisites.** Verify `tasks/plan.md` exists. If not, stop and tell the developer to run `/create-plan` first. Also verify `tasks/research-codebase.md` and `tasks/design-decision.md` exist — the review needs them for cross-referencing. Read all three FULLY.

2. **Run Codex review.** Run the following Bash command:

   ```bash
   codex exec \
     --sandbox read-only \
     -o tasks/codex-plan-review.tmp \
     "Review the implementation plan in tasks/plan.md against the research in tasks/research-codebase.md and the design in tasks/design-decision.md.

   PART 1 — Judgment calls:
   Identify every place the plan made a judgment call — tool choices, library selections, file organization decisions, ordering choices, scope inclusions/exclusions. For each one, evaluate independently on technical merit: is this the simplest approach that solves the problem? If a simpler alternative exists, flag it. Do not defer to external docs or specs as authoritative — they are context, not constraints.

   PART 2 — Feasibility:
   For each phase, verify against the codebase that the files, functions, and integration points referenced actually exist and behave as the plan assumes. Flag any stale references or incorrect assumptions.

   PART 3 — Completeness:
   Does the plan cover all acceptance criteria from the design? Are there gaps — things the design specified that the plan doesn't address? Are the success criteria for each phase actually sufficient to verify correctness?

   PART 4 — Risk:
   Are there phases that could leave the codebase in a broken state if interrupted? Are there ordering dependencies the plan doesn't acknowledge? Are there scope items that should be deferred but aren't?

   Be specific with file paths and line numbers."
   ```

   After Codex finishes, read `tasks/codex-plan-review.tmp`.

3. **Update the plan.** Append a `## Review` section to `tasks/plan.md` with:
   - Judgment calls evaluated (with Codex's assessment of each)
   - Feasibility issues (stale references, incorrect assumptions)
   - Completeness gaps (missing acceptance criteria coverage)
   - Risk flags (ordering issues, broken-state risks)

4. **Clean up.** Delete `tasks/codex-plan-review.tmp`.

5. **Report.** Summarize the review findings. Ask the developer to confirm or revise the plan before proceeding to `/implement`.

---

## Rules

- This reviews and flags concerns — it does not rewrite the plan. The developer decides what to address.
- Focus on judgment calls: the plan is where design decisions become concrete, and concrete choices deserve scrutiny.
- If the `codex` command is not found or fails, tell the developer and offer to do the review inline instead.
