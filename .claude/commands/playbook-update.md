# Playbook Update

You are updating the QRSPI playbook to the latest version. Walk through each step below, interacting with the developer at each decision point.

**Key principle:** The top half of CLAUDE.md (team-specific sections) is never touched. Only playbook-managed files and the QRSPI rules section are updated.

---

## Managed files

These are the files owned by the playbook that can be updated wholesale:

```
quickref.md
templates/audit-report.md
templates/playbook-sections.md
templates/explore-prompt.md
.claude/commands/fix-tables.md
.claude/commands/playbook-setup.md
.claude/commands/playbook-audit.md
.claude/commands/playbook-update.md
.claude/commands/research-codebase.md
.claude/commands/research-codebase-codex.md
.claude/commands/research-patterns.md
.claude/commands/design.md
.claude/commands/design-review-codex.md
.claude/commands/code-review-codex.md
.claude/commands/create-plan.md
.claude/commands/implement.md
.claude/commands/create-todo.md
.claude/commands/issue-research.md
.claude/commands/issue-plan.md
.claude/commands/issue-audit.md
.claude/commands/issue-implement.md
.claude/commands/issue-update.md
templates/new-issues.md
templates/deferred.md
.claude/commands/commit.md
.claude/commands/push-pr.md
.claude/commands/push-pr-light.md
.claude/commands/checkpoint.md
.claude/commands/issue-audit-codex.md
.claude/commands/issue-research-codex.md
templates/error-report.md
```

---

## Step 0: Preflight

1. Check if `.playbook-version` exists in the project root. If it exists, read it and extract `source`, `commit`, and `date`.
   - If it exists, report: "Current playbook version: [commit short hash] from [date], source: [source]"
   - If it does not exist, report: "No `.playbook-version` found — this is the first time running `/playbook-update`. I'll set up version tracking after this update."

2. The default playbook source is `https://github.com/KMakayee/playbook.git`. If `.playbook-version` has a `source` field, use that instead. Ask the developer to confirm the source URL:
   > "Playbook source: `[URL]` — is this correct?"

3. Read CLAUDE.md and check whether it contains the `# QRSPI Workflow Rules` marker (or the legacy `# RPI Workflow Rules` marker).
   - If neither marker is found, warn: "CLAUDE.md does not contain the `# QRSPI Workflow Rules` section — the CLAUDE.md partial merge (Category B) will be skipped. Run `/playbook-setup` to install the playbook structure."
   - Continue with the rest of the update (managed files can still be updated).

---

## Step 1: Fetch latest

1. Clone the playbook source into a temp directory using `git clone --depth 1 [SOURCE_URL] [TEMP_DIR]`. Use a temp directory under `/tmp/playbook-update-[timestamp]`.

2. Get the latest commit hash and date from the cloned repo:
   ```
   git -C [TEMP_DIR] log -1 --format="%H %ai"
   ```

3. Compare the latest commit hash against the installed commit (from `.playbook-version`):

   - **Same commit** → Tell the developer: "Already on latest ([short hash] from [date]). No updates needed." Ask if they want to force-update anyway. If no, clean up the temp directory and stop.

   - **Different commit (or no `.playbook-version`)** → Show what changed. If there's a prior commit hash, try to fetch full history and show the changelog:
     ```
     git -C [TEMP_DIR] fetch --unshallow 2>/dev/null
     git -C [TEMP_DIR] log --oneline [OLD_COMMIT]..HEAD
     ```
     If the old commit is not in history (e.g., after a force-push), show the latest 10 commits instead:
     ```
     git -C [TEMP_DIR] log --oneline -10
     ```
     Ask: "Proceed with update?"

   - If the developer declines, clean up the temp directory and stop.

---

## Step 2: Update managed files

Work through two categories of updates:

### Category A — Wholesale replacement files

For each file in the managed files list above:

1. Check if the file exists in the latest playbook source (the temp dir).
2. If it exists in both locations, diff the current project file against the latest:
   - If identical → skip silently.
   - If different → summarize what changed (added/removed/modified lines, brief description) and ask:
     > "Update `[filename]`? (yes / skip / show diff)"
     - **yes** → Replace the project file with the latest version.
     - **skip** → Leave it unchanged. Note it in the summary.
     - **show diff** → Show the full diff, then ask yes/skip again.
3. If the file exists in the latest but NOT in the project → report it as a new file:
   > "New file: `[filename]` — [brief description of what it is]. Install it? (yes / skip)"
4. If the file exists in the project but NOT in the latest → do nothing (it may be a local addition).

### Category B — CLAUDE.md (partial merge)

CLAUDE.md requires special handling because the top half is team-owned and the bottom half is playbook-owned.

1. Read the project's current CLAUDE.md.
2. Find the boundary: locate the `---` line that immediately precedes `# QRSPI Workflow Rules` (or the legacy `# RPI Workflow Rules`). This is the split point.
   - Everything above that `---` line (inclusive) is the **team-owned top half** — do not touch it.
   - Everything from the workflow rules heading onward is the **playbook-owned bottom half**.
3. Read the latest CLAUDE.md from the temp directory. Extract its bottom half using the same boundary logic.
4. Compare the current bottom half against the latest bottom half:
   - If identical → skip silently, report "QRSPI rules section is up to date."
   - If different → summarize the changes and ask:
     > "The QRSPI rules section of CLAUDE.md has changed. Update? (yes / skip / show diff)"
     - **yes** → Merge the latest version into the bottom half. Do NOT wholesale-replace. Instead:
       1. Identify which differences are **upstream playbook updates** (new rules, formatting changes, restructured sections, removed content that was in the old upstream) vs **project-specific customizations** the user added (extra rules, extended bullets, custom checks not present in any upstream version).
       2. Apply the upstream changes while preserving project-specific customizations in their logical locations.
       3. Show the proposed merged result to the developer for confirmation before writing.
       4. If an upstream change directly modifies the same text the user customized, present both versions for that specific conflict and let the user decide.
     - **skip** → Leave unchanged. Note it in the summary.
     - **show diff** → Show the diff of the bottom halves only, then ask yes/skip again.

**Important:** After updating, verify the resulting CLAUDE.md by reading it back. Confirm the top half is completely untouched and the bottom half matches the latest.

---

## Step 3: Update version file

Write `.playbook-version` in the project root with the following content:

```
# Playbook version tracking — do not edit manually
# This file is managed by /playbook-update

source: [SOURCE_URL]
commit: [FULL_COMMIT_HASH]
date: [YYYY-MM-DD]
```

If `.playbook-version` already existed, overwrite it. If this is the first run, create it.

Tell the developer: "Version tracking updated. Consider adding `.playbook-version` to your repo so the team shares update state."

---

## Step 4: Cleanup and summary

1. Remove the temp directory.

2. Print a summary table:

   ```
   ## Update Summary

   | File | Action |
   |---|---|
   | quickref.md | Updated / Skipped / Already current / New — installed |
   | templates/playbook-sections.md | Updated / Skipped / Already current |
   | ... | ... |
   | CLAUDE.md (QRSPI rules) | Updated / Skipped / Already current |
   | .playbook-version | Written |

   **Previous version:** [old commit or "none"]
   **Current version:** [new commit] ([date])
   **Source:** [URL]
   ```

3. Remind the developer:
   > "Run `git diff` to review all changes, then commit when you're satisfied."

---

## Edge cases

- **No network / clone fails:** Report the error clearly: "Could not reach the playbook source at `[URL]`. Check your network connection and the source URL, then try again." Clean up any partial temp directory.
- **`# QRSPI Workflow Rules` marker missing from CLAUDE.md (and no legacy `# RPI Workflow Rules`):** Abort the CLAUDE.md update only (not the whole command). Update other managed files normally. Suggest running `/playbook-setup` to fix the structure.
- **Old commit not in history:** Skip the targeted changelog. Show the latest 10 commits instead and note: "The previously installed commit is no longer in the source history (possibly due to a force-push). Showing recent commits instead."
- **Developer has modified a managed file:** The diff will show their changes. They can choose to skip that file to preserve their modifications, or overwrite with the latest.
- **Self-update:** `playbook-update.md` is in the managed files list. If it updates itself, note: "The update command itself was updated. The changes will take effect next time you run `/playbook-update`."
- **Temp directory already exists:** Remove it before cloning to avoid conflicts.
