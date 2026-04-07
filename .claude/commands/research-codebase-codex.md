# Research Codebase (Codex)

Review the research in `tasks/research-codebase.md` using OpenAI Codex, then update the research with review findings.

---

## Steps

1. **Check prerequisites.** Verify `tasks/research-codebase.md` exists. If not, stop and tell the developer to run `/research-codebase` first. Read it FULLY.

2. **Extract the task description.** Read `tasks/research-codebase.md` and pull out just the task/goal (the first section, before any findings). You'll pass this to Codex — NOT the findings themselves.

3. **Run Codex research.** Run the following Bash command, substituting the task description:

   ```bash
   codex exec \
     --sandbox read-only \
     -o tasks/codex-research-review.tmp \
     "PHASE 1 — Independent research (do this BEFORE reading tasks/research-codebase.md):
   Research the codebase to answer this task: {TASK_DESCRIPTION}
   Search thoroughly. Report specific file paths, function names, and line numbers.

   PHASE 2 — Cross-check (now read tasks/research-codebase.md):
   Compare your findings against the original research. Report:
   - Agreements (both found the same thing)
   - Corrections (inaccuracies in the original)
   - New findings (what you found that the original missed)
   - Open question answers (evidence for any unresolved questions)"
   ```

   After Codex finishes, read `tasks/codex-research-review.tmp`.

4. **Update the research.** Append a `## Review` section to `tasks/research-codebase.md` with:
   - Agreements (high-confidence, confirmed by both)
   - Corrections (inaccuracies in original research)
   - New findings (discovered independently, missed by original)
   - Open question answers

5. **Clean up.** Delete `tasks/codex-research-review.tmp`.

6. **Report.** Summarize the review findings — what was confirmed, what was corrected, what was added. Ask if the developer has follow-up questions before proceeding to `/design`.

---

## Rules

- This reviews and enhances existing research — it does not start fresh. The research must already exist.
- Focus on verifying accuracy: do the referenced files, functions, and line numbers match reality?
- If the `codex` command is not found or fails, tell the developer and offer to do the review inline instead.
