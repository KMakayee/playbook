# Issue Implement

Execute the approved plan for issue **#$ARGUMENTS** phase-by-phase. Follow the plan precisely, verify after each phase, and commit working code at every step.

---

## Steps

1. **Check prerequisites:**
   - Verify `tasks/plan.md` exists. If not, stop and tell the developer to run `/issue-plan $ARGUMENTS` first.
   - Verify the plan is finalized — it should not have unresolved blocking questions. If it does, stop and tell the developer the plan needs to be reviewed first.
   - Verify `tasks/research-issue-$ARGUMENTS.md` exists — it's needed for reference during implementation.
   - Read issue `#$ARGUMENTS` from `tasks/issues.md`.

2. **Read the plan fully:**
   - Read `tasks/plan.md` FULLY — use the Read tool WITHOUT limit/offset parameters.
   - Understand the phase structure and success criteria.
   - Read `tasks/research-issue-$ARGUMENTS.md` if you need additional context on specific files or patterns.

3. **Check for resume:**
   - Look for existing checkmarks (`- [x]`) in the plan's success criteria.
   - If found, ask the developer: "Found existing progress in plan.md. Resume from where it left off, or start fresh?"
   - Trust that completed phases are done — only re-verify if something seems off.

4. **Update issue status.** In `tasks/issues.md`, change issue #$ARGUMENTS status to `In Progress`.

5. **Execute phase-by-phase:**
   For each phase in the plan:

   a. **Check for batches.** If the plan identifies multiple independent batches, execute only the first batch. Present remaining batches to the developer and suggest starting a new prompt for each.

   b. **Read all files** mentioned in the phase before making changes. Use the Read tool WITHOUT limit/offset.

   c. **Implement the changes** specified for this phase. Keep changes minimal — only modify what the plan specifies.

   d. **Handle mismatches:**
      - **Minor** (function moved a few lines, variable renamed): adapt and continue.
      - **Structural** (module reorganized, interface changed, file deleted): STOP. Re-research that specific sub-problem using a sub-agent, then adapt the plan and continue.
      - **Tests fail after 2 fix attempts:** STOP and ask the developer for guidance.

   e. **Run automated verification** — execute the success criteria listed in the plan for this phase. Fix any failures before proceeding.

   f. **Check off completed items** — update the plan file to mark success criteria as done (`- [x]`).

   g. **Commit the phase:**
      - Commit with a conventional message that references the issue number (e.g., `feat(#N): add validation layer for user input`)
      - Each phase should be a separate commit so changes are reviewable

6. **After all phases are complete:**
   - Run the full test/lint suite one final time to confirm everything works together.
   - Confirm all acceptance criteria from the issue are met.
   - Present a summary of what was implemented, referencing the plan phases.
   - Ask the developer to review the changes.

7. **Clean up.** Once the developer confirms the changes look good:
   - Remove `tasks/research-issue-$ARGUMENTS.md`, `tasks/plan.md`
   - Do NOT remove `tasks/deferred.md`

8. **Update issue status.** In `tasks/issues.md`, change issue #$ARGUMENTS status to `Done`.

9. **Suggest next step.** Tell the developer: "Run `/issue-update $ARGUMENTS` to check if this affects other open issues."

---

## Rules

- The plan is your guide, not a script. Follow intent while adapting to what you find — but deviations require a plan update first.
- One phase at a time. Complete and verify a phase before starting the next. Never work on multiple phases simultaneously.
- Read files fully before modifying them. Never edit a file you haven't read in this session.
- Progress lives in `tasks/plan.md` checkboxes — no separate todo file needed. The plan IS the progress tracker.
- Commit after every phase. Frequent, small commits are better than one large commit at the end.
- Do not improvise beyond the plan. If a new idea comes up during implementation, note it but don't act on it.
- If something unexpected is encountered that doesn't fit the mismatch categories above, use your judgment — adapt for minor issues, stop for major ones.
- **Sub-agents are optional**: Use them sparingly for targeted debugging or verifying that something from the plan still exists. Never for broad exploration during implementation.
- **Compaction**: For multi-phase plans, compact between phases — drop file contents from completed phases and verbose test output, keep plan.md location, current phase, and what's next.
- **File reading**: Always read mentioned files FULLY (no limit/offset) before modifying them.
