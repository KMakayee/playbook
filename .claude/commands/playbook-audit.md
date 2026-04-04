# Playbook Audit

You are running a periodic health check on the QRSPI playbook configuration. Walk through each step below, interacting with the developer at each decision point.

---

## Step 1: Read current state

1. Read `CLAUDE.md` from the project root.
2. List the contents of `tasks/` (if the directory exists).
3. Read `templates/audit-report.md` to know the output format.

If `tasks/` does not exist, note it — there are no artifacts to clean up. Skip to Step 2.

---

## Step 2: Explore codebase for CLAUDE.md accuracy

Spawn a single Explore subagent (`Agent` tool, `subagent_type: "Explore"`, thoroughness: "very thorough") with this prompt:

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

## Step 4: Clean up task artifacts

Check for these files in `tasks/`:
- `tasks/research-codebase.md`
- `tasks/design-decision.md`
- `tasks/research-patterns.md`
- `tasks/plan.md`

For each file found, ask the developer:
> "`tasks/[filename]` exists from a previous session. Delete it, or keep it?"

- **Delete** → Remove the file.
- **Keep** → Leave it. Note in the report.

If no artifacts are found (or `tasks/` doesn't exist), report "No leftover artifacts."

---

## Step 5: Generate health report

Write the audit report to `tasks/audit-report.md` using the structure from `templates/audit-report.md`. Fill in all sections based on what happened in Steps 1–4:

- **CLAUDE.md Health** — One row per section with status and notes.
- **Task Artifacts** — What was found and what action was taken.
- **Summary** — Totals and recommended next audit date (~2–4 weeks from now).

Present the summary section to the developer as a final overview.

---

## Edge cases

- **No `tasks/` directory:** Report "No tasks directory found — no artifacts to review." Focus the audit on CLAUDE.md health only.
- **All CLAUDE.md sections unconfigured:** Report all as unconfigured and recommend running `/playbook-setup`. Do not attempt to fill sections.
- **All sections match:** Report all as "ok" and congratulate the developer on a healthy playbook.
- **No `templates/audit-report.md`:** Create `tasks/audit-report.md` using the structure defined in Step 6 above directly. Mention that the template file is missing.
