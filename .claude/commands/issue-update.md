# Issue Update

After completing issue **#$ARGUMENTS**, check if the changes affect other open issues.

---

## Steps

1. **Read the completed issue.** Read issue `#$ARGUMENTS` from `tasks/new-issues.md`. Confirm its status is `Done` or `In Progress`. If it's still in an earlier status, warn the developer that this command is meant to run after implementation.

2. **Read all other issues.** Read every other issue in `tasks/new-issues.md` that is NOT `Done` or `Deferred`.

3. **Analyze impacts.** For each open issue, consider:
   - Does the completed work change files or modules that the open issue plans to touch?
   - Does it resolve or invalidate any of the open issue's acceptance criteria?
   - Does it shift the open issue's priority (e.g., a dependency was added, or a blocker was removed)?
   - Does it introduce new information the open issue should account for?

4. **Annotate impacted issues.** For each issue that IS affected, add an entry to that issue's **Impacts** section in `tasks/new-issues.md`:

   ```
   - [YYYY-MM-DD] Issue #$ARGUMENTS completed: [1-2 sentence description of how this affects the current issue and what, if anything, needs to change in its approach]
   ```

5. **Do not modify the completed issue.** Only annotate OTHER issues.

6. **Present summary.** Report:
   - How many open issues were checked
   - Which issues were impacted and what was noted
   - Which issues were unaffected

   If no issues were impacted, say so — don't force connections that aren't there.

---

## Rules

- Be conservative. Only flag genuine impacts, not tenuous connections.
- Do not change issue statuses, priorities, or acceptance criteria — only add notes to the Impacts section.
- If there are no other open issues, report that and finish.
