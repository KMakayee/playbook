# Issue Plan

Generate a plan for issue **#$ARGUMENTS** from research findings.

---

## Steps

1. **Check prerequisites.** Verify `tasks/research.md` exists. If not, stop and tell the developer to run `/issue-research $ARGUMENTS` first.

2. **Read inputs.** Read `tasks/research.md` and locate issue `#$ARGUMENTS` in `tasks/new-issues.md`. Confirm the research covers this issue.

3. **Generate the plan.** Produce `tasks/plan.md` using the structure from `templates/plan.md`. Include the issue number in the title (e.g., "Plan: Issue #$ARGUMENTS — [Title]").

   For every change:
   - Specify exact file paths and line number ranges
   - Describe what changes and why
   - Include per-step verification

   Include:
   - Testing strategy (new tests, modified tests, manual verification)
   - Rollback strategy
   - Dependencies (what must happen before/after)
   - Out of scope (explicitly list what this plan does NOT address)

4. **Be skeptical.** Verify assumptions through code, not memory. If research.md references a function or pattern, confirm it still exists before building the plan around it. Plan from research.md, never from scratch.

5. **Structure-first for large plans.** If the plan has more than 5 steps, present a numbered outline first and ask the developer to confirm the approach before writing the detailed plan.

6. **Update issue status.** In `tasks/new-issues.md`, change issue #$ARGUMENTS status to `In Planning`.

7. **Present for review.** Show the plan to the developer. Do NOT implement until the plan is approved.

---

## Rules

- Plan from `tasks/research.md` — do not re-research or plan from memory.
- If `tasks/plan.md` already exists from a different issue, warn the developer and ask whether to overwrite or abort.
- Do not implement anything. This command produces a plan only.
