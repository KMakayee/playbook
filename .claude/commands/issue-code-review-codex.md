# Issue Code Review (Codex)

Review the implementation for issue **#$ARGUMENTS** against the issue-specific plan using OpenAI Codex.

---

## Steps

1. **Check prerequisites.** Verify `tasks/plan-issue-$ARGUMENTS.md` exists. If not, stop and tell the developer there's no plan to review against. Read it FULLY. Also read `tasks/research-issue-$ARGUMENTS.md` and issue `#$ARGUMENTS` from `tasks/issues.md` for full context.

2. **Run Codex review.** Run the following Bash command with a 10-minute timeout (600000ms) — Codex may take a while on large codebases:

   ```bash
   codex exec \
     --sandbox read-only \
     -o tasks/codex-issue-code-review-$ARGUMENTS.tmp \
     "Review the recent implementation against the plan in tasks/plan-issue-$ARGUMENTS.md and the research in tasks/research-issue-$ARGUMENTS.md for issue #$ARGUMENTS.

   PART 1 — Plan adherence:
   - Does the implementation match what the plan specified? Flag any deviations.
   - Were any files changed that the plan didn't call for?
   - Are tests present and do they cover the acceptance criteria?

   PART 2 — Acceptance criteria:
   - Check each acceptance criterion from the issue. Is it fully addressed by the implementation?
   - Flag any criteria that are partially met or missing.

   PART 3 — Independent code quality (evaluate on merit, regardless of what the plan says):
   - Are there bugs, edge cases, or missing error handling?
   - Can any of the code be simplified? Look for unnecessary abstractions, over-engineering, redundant logic, or verbose patterns that could be cleaner.
   - Are established patterns and best practices being followed? Flag any anti-patterns, misused idioms, or places where a well-known pattern would be a better fit.
   - Is the chosen approach the simplest one that solves the problem? If a simpler tool, pattern, or technique would work better than what the plan prescribed, flag it — the plan is not infallible.

   Be specific with file paths and line numbers."
   ```

   After Codex finishes, read `tasks/codex-issue-code-review-$ARGUMENTS.tmp`.

3. **Report.** Present Codex's findings in these sections:
   - **Solid:** What matches the plan and looks correct
   - **Needs revision:** Deviations, bugs, or gaps
   - **Missing:** Anything the plan required that wasn't implemented
   - **Acceptance criteria:** Coverage status for each criterion
   - **Simplification opportunities:** Code that could be cleaner, less abstract, or more concise
   - **Pattern notes:** Anti-patterns found or better idioms that could be used

4. **Suggest next step.** Tell the developer: "Run `/issue-update $ARGUMENTS` to finalize and check if this affects other open issues."

---

## Rules

- This reviews — it does not fix. The developer decides what to address.
- If the `codex` command is not found or fails, tell the developer and offer to do the review inline instead.
