---
name: playbook-update
description: Update the RDPI playbook to the latest version.
disable-model-invocation: true
---

# Playbook Update

You are updating the RDPI playbook to the latest version. Walk through each step below, interacting with the developer at each decision point.

**Key principle:** The top half of CLAUDE.md (team-specific sections) is never touched. Only playbook-managed files and the RDPI rules section are updated.

---

## Managed files

These are the files owned by the playbook that can be updated wholesale:

```
quickref.md
.claude/templates/audit-report.md
.claude/templates/playbook-sections.md
.claude/skills/playbook-setup/SKILL.md
.claude/skills/playbook-audit/SKILL.md
.claude/skills/playbook-update/SKILL.md
.claude/skills/research-codebase/SKILL.md
.claude/skills/design/SKILL.md
.claude/skills/create-plan/SKILL.md
.claude/skills/implement/SKILL.md
.claude/skills/implement-codex/SKILL.md
.claude/skills/codex-review/SKILL.md
.claude/skills/codex-audit/SKILL.md
.claude/skills/create-todo/SKILL.md
.claude/skills/issue-research/SKILL.md
.claude/skills/issue-plan/SKILL.md
.claude/skills/issue-implement/SKILL.md
.claude/skills/issue-update/SKILL.md
.claude/skills/auto-issues/SKILL.md
.claude/skills/issue-finish/SKILL.md
.claude/templates/new-issues.md
.claude/templates/deferred.md
.claude/skills/commit/SKILL.md
.claude/skills/push-pr/SKILL.md
.claude/skills/push-pr-light/SKILL.md
.claude/skills/checkpoint/SKILL.md
.claude/skills/catchup/SKILL.md
.claude/skills/finish/SKILL.md
.claude/prompts/research-guide.md
.claude/skills/design/research-patterns-guide.md
.claude/skills/implement-codex/implement-codex-phase-brief.md
.claude/skills/auto-issues/scripts/pipeline-eval.sh
.claude/scripts/codex-output-check.sh
.claude/templates/error-report.md
```

---

## Step 0: Preflight

1. Check if `.playbook-version` exists in the project root. If it exists, read it and extract `source`, `commit`, and `date`.
   - If it exists, report: "Current playbook version: [commit short hash] from [date], source: [source]"
   - If it does not exist, report: "No `.playbook-version` found — this is the first time running `/playbook-update`. I'll set up version tracking after this update."

2. The default playbook source is `https://github.com/KMakayee/playbook.git`. If `.playbook-version` has a `source` field, use that instead. Ask the developer to confirm the source URL:
   > "Playbook source: `[URL]` — is this correct?"

3. Read CLAUDE.md and check whether it contains the `# RDPI Workflow Rules` marker (or the legacy `# QRSPI Workflow Rules` / `# RPI Workflow Rules` markers).
   - If none of the markers are found, warn: "CLAUDE.md does not contain the `# RDPI Workflow Rules` section — the CLAUDE.md partial merge (Category B) will be skipped. Run `/playbook-setup` to install the playbook structure."
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

**Before writing any managed file** (whether replacing an existing file or installing a new one), ensure the target's parent directory exists — `mkdir -p` the dirname first. Managed files now live at nested paths (`.claude/skills/<name>/SKILL.md`, `.claude/templates/*.md`), so the parent directory may not exist on an older install.

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
2. Find the boundary: locate the `---` line that immediately precedes `# RDPI Workflow Rules` (or the legacy `# QRSPI Workflow Rules` / `# RPI Workflow Rules`). This is the split point.
   - Everything above that `---` line (inclusive) is the **team-owned top half** — do not touch it.
   - Everything from the workflow rules heading onward is the **playbook-owned bottom half**.
3. Read the latest CLAUDE.md from the temp directory. Extract its bottom half using the same boundary logic.
4. Compare the current bottom half against the latest bottom half:
   - If identical → skip silently, report "RDPI rules section is up to date."
   - If different → summarize the changes and ask:
     > "The RDPI rules section of CLAUDE.md has changed. Update? (yes / skip / show diff)"
     - **yes** → Merge the latest version into the bottom half. Do NOT wholesale-replace. Instead:
       1. Identify which differences are **upstream playbook updates** (new rules, formatting changes, restructured sections, removed content that was in the old upstream) vs **project-specific customizations** the user added (extra rules, extended bullets, custom checks not present in any upstream version).
       2. Apply the upstream changes while preserving project-specific customizations in their logical locations.
       3. Show the proposed merged result to the developer for confirmation before writing.
       4. If an upstream change directly modifies the same text the user customized, present both versions for that specific conflict and let the user decide.
     - **skip** → Leave unchanged. Note it in the summary.
     - **show diff** → Show the diff of the bottom halves only, then ask yes/skip again.

**Important:** After updating, verify the resulting CLAUDE.md by reading it back. Confirm the top half is completely untouched and the bottom half matches the latest.

---

## Step 2.5: Apply legacy removals (rename / deprecation cleanup)

The playbook occasionally renames or removes files it used to manage (e.g., the `.claude/commands/` → `.claude/skills/<name>/SKILL.md` migration in PR #28). To prevent target repos from accumulating orphans — and from registering duplicate slash entries when both the old command and the new skill exist — the playbook ships `.claude/playbook-removals.md` in its source tree listing paths that should be removed.

**This step must always prompt the developer before deleting anything.** Never delete silently.

### A. Read the manifest

1. Check whether `.claude/playbook-removals.md` exists in the temp dir (`[TEMP_DIR]/.claude/playbook-removals.md`).
   - If absent → skip this step entirely. Not every playbook version ships removals.
2. Parse entries listed under the `## Entries` heading **only**. Ignore everything else in the file — including text inside fenced code blocks (these may be format examples or documentation, not real entries). Each entry has the format:
   ```
   - path: <relative path from repo root; trailing / denotes a directory>
     since: YYYY-MM-DD
     reason: <one-line note shown to the developer>
   ```

### B. Validate scope (hard guardrail — never skip, never relax)

For every path in the manifest, validate against the lists below **before doing anything else**. If any path fails validation, **abort the entire `/playbook-update` run** with a loud error — this indicates a bug in the playbook source, not a recoverable condition.

**Allowed prefixes** — a path MUST start with exactly one of these:

```
.claude/skills/
.claude/commands/
.claude/templates/
.claude/prompts/
.claude/scripts/
.claude/hooks/
```

**Forbidden — always reject even if listed:**

```
Any path that does not start with .claude/
The literal path .claude/ or .claude (the directory root itself)
Any path starting with .claude/settings (user/IDE config — gitignored locally)
CLAUDE.md, README.md, quickref.md, .gitignore, .playbook-version
Any path starting with tasks/ (developer artifacts)
```

**Path-traversal check:** reject any entry containing `..` or starting with `/` or `~`.

**Character restriction:** each path must match `[A-Za-z0-9._/-]` only — no spaces, no shell metacharacters (`$`, backticks, `;`, `|`, `&`, `*`, `?`, `(`, `)`, quotes, etc.). Reject any path with disallowed characters.

If validation fails for any entry, do not proceed to step C. Report: "ABORTING: `.claude/playbook-removals.md` contains an out-of-scope path `[path]`. This is a bug in the playbook source — report it. No files were removed." Then exit `/playbook-update` (managed-file updates from Step 2 stay; version file write in Step 3 is skipped).

### C. Build the proposal

For each entry that passed validation, check whether the path exists in the target repo:
- If absent → silently skip (nothing to remove).
- If present and a file → record line count and the first 5 lines for the preview.
- If present and a directory → record file count and the first 5 filenames (alphabetical) for the preview.

If no entries remain after this filter, skip the prompt and move to Step 3.

### D. Prompt the developer

Present a single consolidated prompt listing every entry that exists:

> "The playbook no longer manages these paths. Remove them from your repo?
>
> - `.claude/commands/` (directory — 22 files: auto-issues.md, catchup.md, checkpoint.md, codex-review.md, commit.md, ...) — Ported to skills (since 2026-05-22)
>
> Choose: **yes** (remove all) / **no** (skip all) / **one-by-one** (decide per entry)"

- **yes** → For each entry, delete with `rm -- '<path>'` (for files) or `rm -rf -- '<path>'` (for directories) — single-quote the exact path from the manifest and include `--` to terminate option parsing (defends against paths beginning with `-`). Log each as "Removed (legacy)" in the Step 4 summary table.
- **no** → Skip all. Log each as "Kept (declined)" in the summary table.
- **one-by-one** → Ask per entry with the same yes/skip choices.

### E. Safety rules during deletion

- Use the exact path from the manifest — never expand globs, never substitute, never operate on a parent directory.
- Echo the full path immediately before each `rm` so the developer sees what is about to be deleted.
- If any `rm` fails (permissions, file in use), abort the remaining removals and report which paths were and were not removed. Do not silently continue.

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
   | .claude/templates/playbook-sections.md | Updated / Skipped / Already current |
   | ... | ... |
   | CLAUDE.md (RDPI rules) | Updated / Skipped / Already current |
   | .playbook-version | Written |

   **Previous version:** [old commit or "none"]
   **Current version:** [new commit] ([date])
   **Source:** [URL]
   ```

3. **Verify no maintainer artifacts slipped in.** Check whether `tasks/todo.md`, `tasks/completed.md`, `tasks/errors.md`, `tasks/issues.md`, `tasks/new-issues.md`, or `tasks/checkpoint.md` exist in the project. `/playbook-update` does not touch `tasks/`, so any of these files present were either authored by the developer or leaked from the initial install (the README install flow includes `rm -rf tasks` to prevent this). If any are found, remind the developer: *"Found `tasks/[filename]` — verify the contents are yours. If they look like leftover maintainer state, remove them."* Do not exit update without surfacing this check.

4. Remind the developer:
   > "Run `git diff` to review all changes, then commit when you're satisfied."

---

## Edge cases

- **No network / clone fails:** Report the error clearly: "Could not reach the playbook source at `[URL]`. Check your network connection and the source URL, then try again." Clean up any partial temp directory.
- **`# RDPI Workflow Rules` marker missing from CLAUDE.md (and no legacy `# QRSPI Workflow Rules` / `# RPI Workflow Rules`):** Abort the CLAUDE.md update only (not the whole command). Update other managed files normally. Suggest running `/playbook-setup` to fix the structure.
- **Old commit not in history:** Skip the targeted changelog. Show the latest 10 commits instead and note: "The previously installed commit is no longer in the source history (possibly due to a force-push). Showing recent commits instead."
- **Developer has modified a managed file:** The diff will show their changes. They can choose to skip that file to preserve their modifications, or overwrite with the latest.
- **Self-update:** `.claude/skills/playbook-update/SKILL.md` is in the managed files list. If it updates itself, tell the developer: "The `/playbook-update` skill itself was updated — any new logic in this update (including new legacy-removal entries that would be handled in Step 2.5) didn't run this pass because the agent loaded the old instructions at the start. To apply pending changes, run `/playbook-update` again — when it reports 'already on latest,' accept the force-update prompt to re-run with the new logic."
- **Temp directory already exists:** Remove it before cloning to avoid conflicts.
