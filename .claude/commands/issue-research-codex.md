# Issue Research (Codex)

Research issue **#$ARGUMENTS** from the issue board and produce `tasks/research.md`, using OpenAI Codex for codebase exploration.

---

## Steps

1. **Read the issue board.** Read `tasks/new-issues.md` and locate issue `#$ARGUMENTS`. If the issue doesn't exist, stop and tell the developer.

2. **Check for prior research.** Check if `tasks/research-issue-$ARGUMENTS.md` exists. If so, read it as background context — but flag that it may be outdated and should be verified, not trusted blindly.

3. **Gather issue context.** Read the issue's Description, Acceptance Criteria, and Notes sections. These scope the research.

4. **Explore the codebase via Codex.** Run the following Bash command, substituting the issue's Description and Acceptance Criteria into the prompt:

   ```bash
   codex exec \
     --sandbox read-only \
     -o tasks/codex-exploration.tmp \
     "Given this task from issue #$ARGUMENTS:

   [Paste the issue's Description and Acceptance Criteria here]

   Do the following in a single pass:
   1. Identify all relevant files, directories, and modules.
   2. Read each relevant file and summarize: current behavior, key functions/classes, dependencies, and gotchas. Be specific with line numbers.
   3. Identify naming conventions, testing patterns, error handling patterns, and architectural decisions in the relevant code.
   Return a structured report covering all three areas."
   ```

   After Codex finishes, read `tasks/codex-exploration.tmp` to get the exploration results. Document what IS — do not critique or suggest improvements. Use specific file paths and line numbers, not vague references.

5. **Write research.md.** Aggregate findings into `tasks/research.md` using the structure from `templates/research.md`. Include the issue number in the title (e.g., "Research: Issue #$ARGUMENTS — [Title]"). Do not exceed 1000 lines.

6. **Clean up.** Delete `tasks/codex-exploration.tmp`.

7. **Update issue status.** In `tasks/new-issues.md`, change issue #$ARGUMENTS status from its current value to `In Research`.

8. **Report.** Tell the developer: `tasks/research.md` is ready for review. Summarize the key findings in 3-5 sentences. Note that Codex was used for exploration.

---

## Rules

- Do not plan or propose solutions — research only.
- If `tasks/research.md` already exists from a different issue, warn the developer and ask whether to overwrite or abort.
- If context utilization is above 30% after writing research.md, compact before finishing.
- If the `codex` command is not found or fails, tell the developer and suggest using `/issue-research` (the Claude Explore variant) instead.
