# Issue Research (Codex)

Research issue **#$ARGUMENTS** from the issue board using OpenAI Codex for codebase exploration, then verify findings. Produces `tasks/research-issue-$ARGUMENTS.md`.

---

## Steps

1. **Read the issue board.** Read `tasks/issues.md` and locate issue `#$ARGUMENTS`. If the issue doesn't exist, stop and tell the developer.

2. **Check for prior research.** Check if `tasks/research-issue-$ARGUMENTS.md` exists. If so, read it as background context — but flag that it may be outdated and should be verified, not trusted blindly.

3. **Gather issue context.** Read the issue's Description, Acceptance Criteria, and Notes sections. These scope the research.

4. **Read any directly mentioned files first:**
   - If the issue references specific files, tickets, docs, or configs, read them FULLY first
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - This ensures you have full context before crafting the Codex prompt

5. **Analyze and decompose the research question:**
   - Break down the issue's Description and Acceptance Criteria into composable research areas
   - Identify specific components, patterns, or concepts to investigate
   - Consider which directories, files, or architectural patterns are relevant
   - Use this decomposition to craft a focused Codex prompt

6. **Run Codex research.** Run the following Bash command. Use a 10-minute timeout (600000ms) — Codex may take a while on large codebases:

   ```bash
   codex exec \
     --sandbox read-only \
     -o tasks/codex-exploration.tmp \
     "Read issue #$ARGUMENTS from tasks/issues.md. Use its Description and Acceptance Criteria to scope your research.

   Do the following in a single pass:
   1. Identify all relevant files, directories, and modules.
   2. Read each relevant file and document: current behavior, key functions/classes, dependencies, and gotchas. Be specific with line numbers.
   3. Identify naming conventions, testing patterns, error handling patterns, and architectural decisions in the relevant code.
   4. Document cross-component connections and how systems interact.
   5. Note any external libraries, APIs, or protocols involved.
   6. Flag open questions — areas that need further investigation or clarification.

   7. Based on your findings, propose an implementation approach — which files to change, in what order, and why. Note trade-offs and alternatives where relevant.

   Return a structured report covering all areas. Use specific file paths and line numbers, not vague references."
   ```

   After Codex finishes, read `tasks/codex-exploration.tmp` FULLY.

7. **Verify Codex findings.** Spot-check the key claims from Codex's output:
   - Verify 3-5 critical file paths and line numbers actually exist and contain what Codex says
   - Confirm key function signatures and behavior descriptions are accurate
   - Check that cross-component connections Codex identified are real
   - Flag anything that doesn't match — Codex can hallucinate paths and line numbers
   - If verification reveals significant inaccuracies, spawn a sub-agent to investigate the specific area that's wrong

8. **Write research artifact** to `tasks/research-issue-$ARGUMENTS.md` (max 1000 lines):

     ```markdown
     # Research: Issue #$ARGUMENTS — [Title]

     ## Research Question
     [Issue description and acceptance criteria from tasks/issues.md]

     ## Summary
     [High-level documentation of what was found]

     ## Detailed Findings

     ### [Component/Area 1]
     - Description of what exists ([file.ext:line](link))
     - How it connects to other components
     - Current implementation details (without evaluation)

     ### [Component/Area 2]
     ...

     ## Code References
     - `path/to/file.py:123` - Description of what's there
     - `another/file.ts:45-67` - Description of the code block

     ## Architecture Documentation
     [Current patterns, conventions, and design implementations found in the codebase]

     ## Recommended Approach
     [Proposed implementation approach with trade-offs and alternatives]

     ## Verification Notes
     [What was spot-checked, what was confirmed, what was corrected]

     ## Open Questions
     [Any areas that need further investigation]
     ```

9. **Clean up.** Delete `tasks/codex-exploration.tmp`.

10. **Update issue status.** In `tasks/issues.md`, change issue #$ARGUMENTS status from its current value to `In Research`.

11. **Report.** Tell the developer: `tasks/research-issue-$ARGUMENTS.md` is ready for review. Summarize the key findings in 3-5 sentences. Note which findings were verified and any corrections made. Suggest next step: "Run `/issue-plan $ARGUMENTS` to create the implementation plan."

---

## Rules

- Research AND recommend — since the issue workflow skips the design phase, this command should propose an implementation approach alongside the findings.
- Codex does the exploration, Claude does the verification. Do not duplicate Codex's work — focus verification on the most critical findings.
- Always run fresh research — never rely solely on existing research documents.
- **File reading**: Always read mentioned files FULLY (no limit/offset).
- If `tasks/research-issue-$ARGUMENTS.md` already exists from a different issue, warn the developer and ask whether to overwrite or abort.
- If context utilization is above 30% after writing research-issue.md, compact before finishing.
- If the `codex` command is not found or fails, tell the developer and offer to do the research using Claude sub-agents instead.
