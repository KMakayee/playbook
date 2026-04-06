# Issue Implement

Implement the approved plan for issue **#$ARGUMENTS**.

---

## Steps

1. **Prerequisite check.** Confirm that:
   - `tasks/research-issue-$ARGUMENTS.md` exists
   - `tasks/plan.md` exists and has been approved
   - If either is missing, stop and tell the developer what's needed

2. **Check for resume.** Look for existing checkmarks (`- [x]`) in `tasks/plan.md`. If found, ask the developer: "Found existing progress in plan.md. Resume from where it left off, or start fresh?"

3. **Read issue context.** Read issue `#$ARGUMENTS` from `tasks/issues.md`. Read `tasks/plan.md`.

4. **Update issue status.** In `tasks/issues.md`, change issue #$ARGUMENTS status to `In Progress`.

5. **Execute the plan.** Follow the plan step by step:
   - If the plan identifies multiple independent batches, execute only the first batch. Present remaining batches to the developer and suggest starting a new prompt for each.
   - Check off completed items in `tasks/plan.md` as each step completes
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
   - Remove `tasks/research-issue-$ARGUMENTS.md`, `tasks/plan.md`
   - Do NOT remove `tasks/deferred.md`

9. **Update issue status.** In `tasks/issues.md`, change issue #$ARGUMENTS status to `Done`.

10. **Suggest next step.** Tell the developer: "Run `/issue-update $ARGUMENTS` to check if this affects other open issues."

---

## Rules

- Follow intent, adapt to reality — the plan is a guide, not a script. Minor deviations (e.g., a function moved 5 lines) are fine. Structural deviations require a pause.
- Do not improvise beyond the plan. If a new idea comes up during implementation, note it but don't act on it.
- If something unexpected is encountered, return to research for that sub-problem rather than guessing.
- Commit frequently with messages that reference the issue number and plan step.
