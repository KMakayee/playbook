# Design Review (Codex)

Review the design in `tasks/design-decision.md` using OpenAI Codex, then update the design with review comments and finalize it.

---

## Steps

1. **Check prerequisites.** Verify `tasks/design-decision.md` exists. If not, stop and tell the developer to run `/design` first. Read it FULLY.

2. **Extract the problem statement.** Read `tasks/design-decision.md` and pull out just the problem/goal and requirements (before the proposed options). You'll pass this to Codex — NOT the options themselves.

3. **Run Codex review.** Run the following Bash command, substituting the problem statement. Use a 10-minute timeout (600000ms) — Codex may take a while on large codebases:

   ```bash
   codex exec \
     --sandbox read-only \
     -o tasks/codex-design-review.tmp \
     "PHASE 1 — Independent design (do this BEFORE reading tasks/design-decision.md):
   Read tasks/research-codebase.md for full codebase context. Then, given this problem: {PROBLEM_STATEMENT}
   Propose your own approach. Prioritize simplicity and fewest moving parts. Be specific with file paths and line numbers.

   PHASE 2 — Cross-check (now read tasks/design-decision.md):
   Compare your approach against the proposed options. Report:
   - Which proposed option (if any) aligns with your independent approach
   - Trade-offs or risks the proposed options missed
   - Whether your independent approach is better than all proposed options
   - Open question answers (evidence for any unresolved questions)

   PHASE 3 — Recommend:
   Recommend the best approach — a proposed option, your own, or a hybrid. Base this on technical merit, not deference to the original design."
   ```

   After Codex finishes, read `tasks/codex-design-review.tmp`.

4. **Update the design.** Append a `## Review` section to `tasks/design-decision.md` with:
   - Codex's independent approach summary
   - Alignment or divergence with proposed options
   - Missed trade-offs or risks
   - Open question answers
   - Final recommendation and rationale

   Change the footer status from `Awaiting decision` to `Reviewed — recommended: [Option name or "Independent approach"]`.

5. **Clean up.** Delete `tasks/codex-design-review.tmp`.

6. **Report.** Summarize the review findings and recommendation. Ask the developer to confirm or override the choice before proceeding to `/create-plan`.

---

## Rules

- This reviews and recommends — it does not implement. The developer confirms the final choice.
- If the `codex` command is not found or fails, tell the developer and offer to do the review inline instead.
