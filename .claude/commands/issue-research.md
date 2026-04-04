# Issue Research

Research issue **#$ARGUMENTS** from the issue board and produce `tasks/research-issue-$ARGUMENTS.md`.

---

## Steps

1. **Read the issue board.** Read `tasks/issues.md` and locate issue `#$ARGUMENTS`. If the issue doesn't exist, stop and tell the developer.

2. **Check for prior research.** Check if `tasks/research-issue-$ARGUMENTS.md` exists. If so, read it as background context — but flag that it may be outdated and should be verified, not trusted blindly.

3. **Gather issue context.** Read the issue's Description, Acceptance Criteria, and Notes sections. These scope the research.

4. **Explore the codebase.**
   - Spawn sub-agents to research the codebase however you see fit — parallelize across domains, go deep on a single module, whatever the task requires. Scope all agents to the issue's Description and Acceptance Criteria.
   - All agents are documentarians: describe what exists, don't evaluate or suggest improvements.
   - If web research would help, include it — return links with findings.

   **Tactical guidance:**
   - Start broad — find WHERE relevant files and components live
   - Then go deep — understand HOW specific code works
   - Look for patterns — identify conventions, testing approaches, and architecture
   - Run multiple agents in parallel when searching different domains
   - Don't over-prompt agents on HOW to search — they already know
   - Have agents document examples and usage patterns as they exist

5. **Wait for all sub-agents to complete and synthesize findings:**
   - IMPORTANT: Wait for ALL sub-agent tasks to complete before proceeding
   - Compile all sub-agent results
   - Prioritize live codebase findings as primary source of truth
   - Connect findings across different components
   - Include specific file paths and line numbers for reference

6. **Write research.** Aggregate findings into `tasks/research-issue-$ARGUMENTS.md` (max 1000 lines). Title it "Research: Issue #$ARGUMENTS — [Title]". Structure the document however best fits the findings — include file paths with line numbers, current behavior, patterns, and open questions. Document what IS, not what should be.

7. **Update issue status.** In `tasks/issues.md`, change issue #$ARGUMENTS status from its current value to `In Research`.

8. **Report.** Tell the developer: `tasks/research-issue-$ARGUMENTS.md` is ready for review. Summarize the key findings in 3-5 sentences.

---

## Rules

- Do not plan or propose solutions — research only.
- Always use parallel sub-agents to maximize efficiency and minimize context usage.
- Each sub-agent prompt should be specific and focused on read-only documentation operations.
- Keep the main agent focused on synthesis, not deep file reading.
- Have sub-agents document examples and usage patterns as they exist.
- **File reading**: Always read mentioned files FULLY (no limit/offset) before spawning sub-agents.
- If `tasks/research-issue-$ARGUMENTS.md` already exists from a different issue, warn the developer and ask whether to overwrite or abort.
- If context utilization is above 30% after writing research-issue.md, compact before finishing.
