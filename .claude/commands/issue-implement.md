# Issue Implement

Implement the approved plan for issue **#$ARGUMENTS**.

---

## Steps

1. **Prerequisite check.** Confirm that:
   - `tasks/research.md` exists
   - `tasks/plan.md` exists and has been approved
   - If either is missing, stop and tell the developer what's needed

2. **Check for resume.** If `tasks/todo.md` exists and contains checkmarks for this issue, ask the developer: "Found existing progress in todo.md. Resume from where it left off, or start fresh?"

3. **Read issue context.** Read issue `#$ARGUMENTS` from `tasks/new-issues.md`. Read `tasks/plan.md`.

4. **Update issue status.** In `tasks/new-issues.md`, change issue #$ARGUMENTS status to `In Progress`.

5. **Initialize progress tracking.** If `tasks/todo.md` doesn't exist (or starting fresh), create it from `templates/todo.md` with steps derived from the plan. Include the issue number in the title.

6. **Execute the plan.** Follow the plan step by step:
   - Update `tasks/todo.md` as each step completes
   - Run tests after each logical unit of change
   - If something doesn't match expectations: **STOP** and present the mismatch clearly:
     > **Expected:** [what the plan said]
     > **Found:** [what actually happened]
     > **Why it matters:** [impact on the plan]
     Ask the developer how to proceed before continuing.

7. **Verify completion.** After all steps are done:
   - Run the full test suite
   - Confirm all acceptance criteria from the issue are met
   - Ask the developer to review the changes

8. **Clean up.** After verification:
   - Remove `tasks/research.md`, `tasks/plan.md`, `tasks/todo.md`
   - Do NOT remove `tasks/lessons.md` or `tasks/deferred.md`

9. **Update issue status.** In `tasks/new-issues.md`, change issue #$ARGUMENTS status to `Done`.

10. **Suggest next step.** Tell the developer: "Run `/issue-update $ARGUMENTS` to check if this affects other open issues."

---

## Rules

- Follow intent, adapt to reality — the plan is a guide, not a script. Minor deviations (e.g., a function moved 5 lines) are fine. Structural deviations require a pause.
- Do not improvise beyond the plan. If a new idea comes up during implementation, note it but don't act on it.
- If something unexpected is encountered, return to research for that sub-problem rather than guessing.
- Commit frequently with messages that reference the issue number and plan step.
