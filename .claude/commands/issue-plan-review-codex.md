# Issue Plan Review (Codex)

Review the plan for issue **#$ARGUMENTS** using OpenAI Codex, then update the plan with review findings.

---

## Steps

1. **Check prerequisites.** Verify `tasks/plan-issue-$ARGUMENTS.md` and `tasks/research-issue-$ARGUMENTS.md` exist. If not, stop and tell the developer which commands to run first. Also read issue `#$ARGUMENTS` from `tasks/issues.md`. Read all artifacts FULLY.

2. **Run Codex review.** Run the following Bash command with a 10-minute timeout (600000ms) — Codex may take a while on large codebases:

   ```bash
   codex exec \
     --sandbox read-only \
     -o tasks/codex-issue-plan-review-$ARGUMENTS.tmp \
     "Review the implementation plan in tasks/plan-issue-$ARGUMENTS.md against the research in tasks/research-issue-$ARGUMENTS.md and issue #$ARGUMENTS in tasks/issues.md.

   IMPORTANT — For every finding across all parts, classify it as either:
   - CORRECTION: factual error, stale reference, or contradiction with the input documents (research/issue). These should be fixed, not debated.
   - TRADE-OFF: genuine design choice with viable alternatives. These need developer input.
   Do not present corrections as open questions.

   PART 1 — Acceptance criteria coverage:
   For each acceptance criterion in the issue, verify the plan includes steps that address it. Mark each as Covered (with plan step reference) or Missing (flag as a gap).

   PART 2 — Judgment calls:
   Identify every place the plan made a judgment call — tool choices, library selections, file organization decisions, ordering choices, scope inclusions/exclusions. For each call, evaluate independently on technical merit: is this the simplest approach that solves the problem? If a simpler alternative exists, flag it.

   PART 3 — Feasibility:
   For each phase, verify against the codebase that the files, functions, and integration points referenced actually exist and behave as the plan assumes. Flag any stale references or incorrect assumptions.

   PART 4 — Completeness:
   Are there gaps — things the research or issue specified that the plan doesn't address? Are the success criteria for each phase actually sufficient to verify correctness?

   PART 5 — Risk:
   Are there phases that could leave the codebase in a broken state if interrupted? Are there ordering dependencies the plan doesn't acknowledge? Does the plan touch files or modules that research identified as fragile or high-risk without acknowledging the risk? Are there scope items that should be deferred but aren't?

   Be specific with file paths and line numbers."
   ```

   After Codex finishes, read `tasks/codex-issue-plan-review-$ARGUMENTS.tmp`.

3. **Update the plan.** Append a `## Review` section to `tasks/plan-issue-$ARGUMENTS.md` with:
   - Acceptance criteria coverage (covered vs. missing)
   - Judgment calls evaluated (with Codex's assessment of each)
   - **Corrections** — factual errors, stale references, contradictions with input documents. These are not open questions.
   - **Trade-offs** — genuine choices needing developer input, with Codex's recommendation for each.
   - Risk flags (ordering issues, broken-state risks, fragile areas)

4. **Handle deferred items.** If the plan or research mentions items explicitly deferred or out of scope:
   - Create or append to `tasks/deferred.md` using the structure from `templates/deferred.md`
   - Group entries under the current issue number
   - Include: what was deferred, why, and suggested future action

5. **Update issue status.** In `tasks/issues.md`, change issue #$ARGUMENTS status to `In Review`.

6. **Report.** Summarize the review findings. Ask the developer to confirm or revise the plan before proceeding to `/issue-implement $ARGUMENTS`.

---

## Rules

- This reviews and flags concerns — it does not rewrite the plan. The developer decides what to address.
- Focus on judgment calls: the plan is where design decisions become concrete, and concrete choices deserve scrutiny.
- Separate corrections (fix these) from trade-offs (developer decides) so the developer knows which findings need their input.
- If everything checks out, say so clearly — don't invent issues.
- If the `codex` command is not found or fails, tell the developer and offer to do the review inline instead.
