# Design Review (Codex)

Review the design in `tasks/design-decision.md` using OpenAI Codex, then update the design with review comments and finalize it.

---

## Steps

1. **Check prerequisites.** Verify `tasks/design-decision.md` exists. If not, stop and tell the developer to run `/design` first. Read it FULLY.

2. **Run Codex review.** Run the following Bash command, substituting the design content into the prompt:

   ```bash
   codex exec \
     --sandbox read-only \
     -o tasks/codex-design-review.tmp \
     "Review the design in tasks/design-decision.md. For each option:
   - Does it hold up against the actual codebase? Check that referenced patterns, files, and integration points exist.
   - Are there trade-offs or risks the design missed?
   - Are there open issues, edge cases, or discussions that should be addressed?

   Then recommend which option to proceed with and why, based on the decision heuristics in the document."
   ```

   After Codex finishes, read `tasks/codex-design-review.tmp`.

3. **Update the design.** Append a `## Review` section to `tasks/design-decision.md` with:
   - Codex's findings per option
   - The recommended option and rationale
   - Any new risks or open questions surfaced

   Change the footer status from `Awaiting decision` to `Reviewed — recommended: [Option name]`.

4. **Clean up.** Delete `tasks/codex-design-review.tmp`.

5. **Report.** Summarize the review findings and recommendation. Ask the developer to confirm or override the choice before proceeding to `/create-plan`.

---

## Rules

- This reviews and recommends — it does not implement. The developer confirms the final choice.
- If the `codex` command is not found or fails, tell the developer and offer to do the review inline instead.
