# Playbook Audit

You are running a periodic health check on the RPI playbook configuration. Walk through each step below, interacting with the developer at each decision point.

---

## Step 1: Read current state

1. Read `CLAUDE.md` from the project root.
2. Read `tasks/lessons.md` (if it exists).
3. List the contents of `tasks/` (if the directory exists).
4. Read `templates/audit-report.md` to know the output format.

If `tasks/` does not exist, note it — there are no artifacts to clean up and no lessons to review. Skip to Step 2.

---

## Step 2: Explore codebase for CLAUDE.md accuracy

Spawn a single Explore subagent (`Task` tool, `subagent_type: "Explore"`, thoroughness: "very thorough") with this prompt:

> Compare the top-half sections of CLAUDE.md (Codebase Overview, Architecture, Conventions, Testing, Build & Run, Critical Paths, Dependencies) against the actual codebase state. For each section:
> 1. If the section contains `[TEAM FILLS IN` markers, report it as "unconfigured".
> 2. If the section contains `<!-- TODO` comments, report it as "unconfigured".
> 3. Otherwise, check whether the described tech stack, file paths, commands, and conventions still match reality. Report any discrepancies with specific evidence (file paths, package.json entries, etc.).
> Return a structured report with one row per section: section name, status (ok / stale / unconfigured), and notes explaining the assessment.
> Do NOT spawn sub-agents.

Store the subagent's response for use in Step 3.

---

## Step 3: Flag stale CLAUDE.md sections

For each section the subagent flagged as "stale" or "unconfigured":

### If unconfigured:
- Tell the developer: "The **[Section Name]** section still has placeholder markers. Run `/playbook-setup` to fill it in."
- Do not attempt to fill it here — that's the setup command's job.

### If stale:
- Present the discrepancy: what CLAUDE.md says vs. what the codebase shows.
- Propose a specific update (show the replacement text in a fenced code block).
- Ask the developer: *"Should I apply this update? (yes / edit / skip)"*
  - **yes** → Apply the edit to CLAUDE.md using the Edit tool.
  - **edit** → Incorporate their changes, re-present, and confirm.
  - **skip** → Move on. Note it in the report as "stale — skipped by developer".

If all sections are ok, say so and move on.

---

## Step 4: Lessons lifecycle review

Skip this step if `tasks/lessons.md` does not exist or has fewer than 5 entries.

1. **Count entries.** Report the total and whether it exceeds the ~30 active cap.

2. **Identify graduation candidates.** An entry qualifies if ALL of these are true:
   - Older than 90 days
   - Severity is low or medium
   - No recurrence noted

   Present each candidate to the developer:
   > "[Date] — [Title] (severity: [level]). This entry is [N] days old with no recurrence. Graduate (remove)?"

3. **Identify consolidation candidates.** Look for entries with:
   - The same root cause, or
   - The same or overlapping prevention rules

   Present each group:
   > "These entries share the same root cause / prevention rule: [list titles]. Consolidate into one?"

4. **Flag high-severity entries.** List any high-severity entries older than 90 days:
   > "[Date] — [Title] (high severity). This entry is [N] days old. High-severity entries require manual review — keep, rewrite, or graduate?"

5. Apply approved changes using the Edit tool. For consolidation, keep the most recent date and the strongest prevention rule.

---

## Step 5: Clean up task artifacts

Check for these files in `tasks/`:
- `tasks/research.md`
- `tasks/plan.md`
- `tasks/todo.md`

For each file found, ask the developer:
> "`tasks/[filename]` exists from a previous session. Delete it, or keep it?"

- **Delete** → Remove the file.
- **Keep** → Leave it. Note in the report.

**Never touch `tasks/lessons.md`.** Explicitly confirm this in your output.

If no artifacts are found (or `tasks/` doesn't exist), report "No leftover artifacts."

---

## Step 6: Generate health report

Write the audit report to `tasks/audit-report.md` using the structure from `templates/audit-report.md`. Fill in all sections based on what happened in Steps 1–5:

- **CLAUDE.md Health** — One row per section with status and notes.
- **Lessons Review** — Counts, graduated entries, consolidated entries, flagged entries.
- **Task Artifacts** — What was found and what action was taken.
- **Summary** — Totals and recommended next audit date (~2–4 weeks from now).

Present the summary section to the developer as a final overview.

---

## Edge cases

- **No `tasks/` directory:** Report "No tasks directory found — no artifacts or lessons to review." Focus the audit on CLAUDE.md health only.
- **All CLAUDE.md sections unconfigured:** Report all as unconfigured and recommend running `/playbook-setup`. Do not attempt to fill sections.
- **Fewer than 5 lessons entries:** Skip the lifecycle review. Report "Fewer than 5 entries — no lifecycle action needed."
- **All sections match:** Report all as "ok" and congratulate the developer on a healthy playbook.
- **No `templates/audit-report.md`:** Create `tasks/audit-report.md` using the structure defined in Step 6 above directly. Mention that the template file is missing.
