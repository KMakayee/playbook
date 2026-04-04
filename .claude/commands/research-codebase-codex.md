# Research Codebase (Codex)

Review the research in `tasks/research-codebase.md` using OpenAI Codex, then update the research with review findings.

---

## Steps

1. **Check prerequisites.** Verify `tasks/research-codebase.md` exists. If not, stop and tell the developer to run `/research-codebase` first. Read it FULLY.

2. **Run Codex review.** Run the following Bash command:

   ```bash
   codex exec \
     --sandbox read-only \
     -o tasks/codex-research-review.tmp \
     "Review the research in tasks/research-codebase.md against the actual codebase. For each finding:
   - Does the referenced file/function/line still exist and match what the research describes?
   - Are there relevant files, patterns, or connections the research missed?
   - Are there inaccuracies or stale references?

   Be specific with file paths and line numbers."
   ```

   After Codex finishes, read `tasks/codex-research-review.tmp`.

3. **Update the research.** Append a `## Review` section to `tasks/research-codebase.md` with:
   - Confirmed findings (what Codex verified as accurate)
   - Corrections (inaccuracies or stale references found)
   - Additions (relevant files, patterns, or connections the research missed)

4. **Clean up.** Delete `tasks/codex-research-review.tmp`.

5. **Report.** Summarize the review findings — what was confirmed, what was corrected, what was added. Ask if the developer has follow-up questions before proceeding to `/design`.

---

## Rules

- This reviews and enhances existing research — it does not start fresh. The research must already exist.
- Focus on verifying accuracy: do the referenced files, functions, and line numbers match reality?
- If the `codex` command is not found or fails, tell the developer and offer to do the review inline instead.
