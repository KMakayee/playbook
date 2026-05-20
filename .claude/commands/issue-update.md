# Issue Update

After completing issue **#$ARGUMENTS**, check if the changes affect other open issues.

---

## Steps

1. **Read the completed issue.** Read issue `#$ARGUMENTS` from `tasks/issues.md`. Confirm its status is `Implemented`. If it's still in an earlier status, warn the developer that this command is meant to run after implementation and code review.

2. **Read all other issues.** Read every other issue in `tasks/issues.md` that is NOT `Done` or `Deferred`.

3. **Read the completed work's change set.** `/issue-update` runs before the pipeline's single commit, so there is no pipeline-produced commit to read — the working tree is the only signal. Inspect `git diff` (tracked changes) and `git status --porcelain --untracked-files=all` (new files) to get the concrete set of files and modules issue #$ARGUMENTS changed. Use that change set — not `git log` — as the evidence base for the impact analysis below.

4. **Analyze impacts.** For each open issue, consider:
   - Does the completed work change files or modules that the open issue plans to touch?
   - Does it resolve or invalidate any of the open issue's acceptance criteria?
   - Does it shift the open issue's priority (e.g., a dependency was added, or a blocker was removed)?
   - Does it introduce new information the open issue should account for?

5. **Annotate impacted issues.** For each issue that IS affected, add an entry to that issue's **Impacts** section in `tasks/issues.md`:

   ```
   - [YYYY-MM-DD] Issue #$ARGUMENTS completed: [1-2 sentence description of how this affects the current issue and what, if anything, needs to change in its approach]
   ```

6. **Update issue status.** In `tasks/issues.md`, change issue #$ARGUMENTS status to `Done`.

7. **Do not otherwise modify the completed issue.** Only annotate OTHER issues.

8. **Present summary.** Report:
   - How many open issues were checked
   - Which issues were impacted and what was noted
   - Which issues were unaffected

   If no issues were impacted, say so — don't force connections that aren't there.

---

## Rules

- Be conservative. Only flag genuine impacts, not tenuous connections.
- Do not change other issues' statuses, priorities, or acceptance criteria — only add notes to their Impacts section.
- If there are no other open issues, report that and finish.
