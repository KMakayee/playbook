# Code Review (Codex)

Review the implementation against the plan in `tasks/plan.md` using OpenAI Codex.

---

## Steps

1. **Check prerequisites.** Verify `tasks/plan.md` exists. If not, stop and tell the developer there's no plan to review against. Read it FULLY.

2. **Run Codex review.** Run the following Bash command with a 10-minute timeout (600000ms) — Codex may take a while on large codebases:

   ```bash
   codex exec \
     --sandbox read-only \
     -o tasks/codex-code-review.tmp \
     "Review the recent implementation against the plan in tasks/plan.md.

   PART 1 — Plan adherence:
   - Does the implementation match what the plan specified? Flag any deviations.
   - Were any files changed that the plan didn't call for?
   - Are tests present and do they cover the acceptance criteria?

   PART 2 — Independent code quality (evaluate on merit, regardless of what the plan says):
   - Are there bugs, edge cases, or missing error handling?
   - Can any of the code be simplified? Look for unnecessary abstractions, over-engineering, redundant logic, or verbose patterns that could be cleaner.
   - Are established patterns and best practices being followed? Flag any anti-patterns, misused idioms, or places where a well-known pattern would be a better fit.
   - Is the chosen approach the simplest one that solves the problem? If a simpler tool, pattern, or technique would work better than what the plan prescribed, flag it — the plan is not infallible."
   ```

   After Codex finishes, read `tasks/codex-code-review.tmp`.

3. **Report.** Present Codex's findings in these sections:
   - **Solid:** What matches the plan and looks correct
   - **Needs revision:** Deviations, bugs, or gaps
   - **Missing:** Anything the plan required that wasn't implemented
   - **Simplification opportunities:** Code that could be cleaner, less abstract, or more concise
   - **Pattern notes:** Anti-patterns found or better idioms that could be used

4. **Clean up.** Delete `tasks/codex-code-review.tmp`.

---

## Rules

- This reviews — it does not fix. The developer decides what to address.
- If the `codex` command is not found or fails, tell the developer and suggest using `/code-review` instead.
