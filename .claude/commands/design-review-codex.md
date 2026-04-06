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
     "Review the design in tasks/design-decision.md.

   PART 1 — Evaluate options on technical merit:
   For each option, does it hold up against the actual codebase? Check that referenced patterns, files, and integration points exist. Are there trade-offs or risks the design missed? Evaluate each option independently on its technical merits — simplicity, fewer moving parts, better fit for the actual problem. Do NOT treat references to external docs, specs, or planning documents as hard constraints. Those are pre-implementation suggestions that may be wrong. If an option is technically superior but contradicts a doc reference, recommend it anyway and flag the doc discrepancy.

   PART 2 — Resolve open questions:
   The design may contain an Open Questions section. For each question, search the codebase — config files, dependency manifests, existing code, docs — for evidence that answers or constrains it. Provide your answer for each question.

   PART 3 — Recommend:
   Recommend which option to proceed with and why. Base your recommendation on independent technical analysis — which option is simplest, has the fewest dependencies, and best fits the actual problem at hand. Do not defer to spec documents or planning artifacts as authoritative; they are context, not constraints."
   ```

   After Codex finishes, read `tasks/codex-design-review.tmp`.

3. **Update the design.** Append a `## Review` section to `tasks/design-decision.md` with:
   - Codex's findings per option
   - Open question answers (Codex's answer for each open question)
   - The recommended option and rationale
   - Any new risks surfaced

   Change the footer status from `Awaiting decision` to `Reviewed — recommended: [Option name]`.

4. **Clean up.** Delete `tasks/codex-design-review.tmp`.

5. **Report.** Summarize the review findings and recommendation. Ask the developer to confirm or override the choice before proceeding to `/create-plan`.

---

## Rules

- This reviews and recommends — it does not implement. The developer confirms the final choice.
- If the `codex` command is not found or fails, tell the developer and offer to do the review inline instead.
