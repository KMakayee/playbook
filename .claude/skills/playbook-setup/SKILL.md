---
name: playbook-setup
description: Set up the RDPI playbook for this codebase.
disable-model-invocation: true
---

# Setup Assistant

You are setting up the RDPI playbook for this codebase. The README install copies only `.claude/` and `quickref.md` — CLAUDE.md is created or merged here, interactively. Start by asking the developer whether this is a new project (CLAUDE.md to be created from the playbook template) or an existing project (their own CLAUDE.md to merge the playbook sections into). Then follow the appropriate path.

---

## Step 0: Ask new or existing project

Ask the developer:

> "Is this a **new project** (no CLAUDE.md yet, or only the playbook's `[TEAM FILLS IN]` template) or an **existing project** (you have your own CLAUDE.md that the playbook sections should be merged into)?"

- **New project** → proceed to Step 0A
- **Existing project** → proceed to Step 0B

---

## Step 0A: Create CLAUDE.md from the template

For new projects only:

1. If CLAUDE.md already exists — whether it still carries `[TEAM FILLS IN` markers or is already fully configured — **never recreate or overwrite it.** Leave it as-is and proceed to Step 1, which handles both states. Recreating on a re-run would wipe a configured CLAUDE.md back to placeholders.
2. Only when CLAUDE.md is absent, create it in the project root: a `# Project Instructions` heading followed by the full contents of `.claude/templates/playbook-sections.md` (drop the template's leading `---` separator line — it exists for the append path in Step 0B).
3. Proceed to Step 1.

---

## Step 0B: Merge playbook structure into an existing CLAUDE.md

For existing projects only. Governing rule: **nothing in the developer's CLAUDE.md is removed or rewritten without their explicit yes.**

1. If CLAUDE.md already contains the playbook section headers (e.g., `# Sub-Agent Behaviors`), the playbook structure is already installed — tell the developer, skip the merge, and proceed to Step 1. A re-run must never append the sections a second time.
2. Read their existing CLAUDE.md and summarize what's there (2-3 sentences) so the developer can confirm it's the right file.
3. Read `.claude/templates/playbook-sections.md` and map the developer's existing content against the incoming sections, into three groups:
   - **Seeds** — existing content that belongs in one of the 5 team sections (Codebase Overview, Architecture, Conventions, Commands, Critical Paths). E.g., they already document build commands or architecture. Propose filling the matching playbook section with their content (instead of a `[TEAM FILLS IN]` placeholder), removing the original only if it would otherwise be duplicated.
   - **Overlaps** — existing rules that the playbook's rule sections (Sub-Agent Behaviors, Workflow, Quality Standards) supersede, duplicate, or contradict — e.g., their own sub-agent, review, or quality rules. For each, show both versions side by side and ask: **keep yours**, **adopt the playbook's** (theirs is removed), or **keep both** (theirs stays put as a project customization).
   - **Untouched** — everything else stays exactly where it is.
4. Present the merge plan (seeds, overlaps, what stays untouched), then walk through the seed and overlap decisions one at a time. Wait for the developer's answer on each.
5. Apply the confirmed plan with the Edit tool: append the playbook sections from the template to the end of CLAUDE.md, fill seeded sections with the developer's existing content, and remove or relocate their original content ONLY where they said yes.
6. Proceed to Step 1 — CLAUDE.md now has the playbook section headers; seeded sections are already filled, so Step 1 picks up only the remaining markers.

---

## Step 1: Read CLAUDE.md and identify unfilled sections

Read `CLAUDE.md` in the project root. Identify which sections still contain the marker text `[TEAM FILLS IN`.

- **Markers found** → skip any already-filled sections, proceed to Step 2 with the unfilled ones.
- **No markers found, all headers present** → all sections are already filled (e.g., a fully-seeded Step 0B merge, or a re-run on a configured project). Tell the developer, skip Steps 2–3, and proceed to Step 3A — the install offers and the Step 4 wrap-up checks still run.
- **No markers found, missing headers** → this shouldn't happen after Step 0. Tell the developer something is unexpected and suggest re-running `/playbook-setup`.

---

## Step 2: Explore the codebase via subagent

Spawn a single Explore subagent (`Agent` tool, `subagent_type: "Explore"`, thoroughness: "very thorough") to detect the ecosystem and gather findings for all unfilled sections at once. **Do not read any source or config files yourself** — the subagent handles all file I/O.

Use this prompt, substituting the actual unfilled section names for `[UNFILLED_SECTIONS]`:

> Explore this codebase thoroughly and gather findings for the following CLAUDE.md sections: [UNFILLED_SECTIONS].
>
> For each section, return:
> **Summary:** what you found (specific file paths, commands, patterns)
> **Proposed draft:** concise content ready to paste into CLAUDE.md
>
> Section definitions:
> - **Codebase Overview** — what the project does, who uses it, maturity stage (2-3 sentences)
> - **Architecture** — primary language/framework, directory layout, key abstractions, DB layer, external services
> - **Conventions** — naming conventions, import ordering, error handling patterns, logging style
> - **Commands** — install, dev server, build, lint/format, full-suite and single-file test commands; test framework and test-file location convention
> - **Critical Paths** — auth, payments, migrations, public API contracts, must-not-change version constraints, files requiring extra caution

Store the subagent's full response — you will use it in Step 3. **Do not read any additional source or config files yourself.**

---

## Step 3: Fill each section interactively

For each unfilled section (in the order they appear in CLAUDE.md), follow this loop:

### A. Extract findings

Extract the findings and proposed draft for this section from the exploration subagent's output. Do not read any additional source files.

### B. Draft a proposal

Present a proposed replacement for the section in a fenced code block. The draft should:
- Match the style hints in the `[TEAM FILLS IN]` placeholder
- Be concise — this goes in CLAUDE.md which is loaded every session
- Use specific paths, commands, and framework names (not generic placeholders)

### C. Confirm with the developer

Ask: *"Does this look accurate? Edit anything you'd like to change, or say 'looks good' to continue."*

Wait for the developer's response. If they provide corrections, incorporate them and present the revised draft. Repeat until confirmed.

### D. Write to CLAUDE.md

Once confirmed, replace the `[TEAM FILLS IN ...]` placeholder in CLAUDE.md with the confirmed content. Use the Edit tool — do not rewrite the entire file.

Then move to the next unfilled section.

---

## Step 3A: Offer .gitignore entries

The playbook repo gitignores a few paths, but the install deliberately does not copy its `.gitignore` — whether these paths are tracked is the developer's choice, not the playbook's. Offer each entry **individually**; never add one without an explicit yes.

1. Read the project's `.gitignore` (if present). For each entry below not already covered, ask yes/skip with the rationale:
   - `tasks/logs/` — **recommended.** Skills use it as scratch: Codex audit/review temps and kept research docs land here, and several skills assume it is ignored (their "a stranded temp can never be committed" safety claim depends on this entry). Declining is legitimate — e.g., to version research logs — but then a broad `git add` mid-run can commit stranded temp files; say so when the developer declines.
   - `.claude/settings.local.json` — machine-local Claude Code settings (permissions, local overrides); conventionally untracked.
   - `.claude/worktrees/` — Claude Code worktree checkouts (`/auto-issues` runs in these); always machine-local.
   - `.claude/agents/` — only relevant if the developer later runs `/native-agents`: its install copies agent files here from templates, so ignoring keeps machine-installed copies out of the repo. Skip if they don't plan to use native agents — or if the team wants to share agent files through git.
2. Append the accepted entries to `.gitignore`. If the file doesn't exist, create it only when at least one entry was accepted. Declined entries are skipped silently — no nagging on re-runs (an entry already present counts as covered).

---

## Step 3B: Install global utility skills

Offer to install reusable workflow skills to `~/.claude/skills/` (global, available in all workspaces).

Each utility skill is a folder — its `SKILL.md` installs to `~/.claude/skills/<name>/SKILL.md`. Note: `commit`, `push-pr`, `push-pr-light`, and `catchup` each reference `.claude/templates/error-report.md` by a repo-relative path in their reflection step, so that template does not resolve when the skill runs outside a playbook workspace — the rest of the skill works normally. (Pre-existing behavior; surfaced so it isn't a surprise.)

1. For each of the following skills (`<name>` → source `SKILL.md`):
   - `commit` → `.claude/skills/commit/SKILL.md`
   - `push-pr` → `.claude/skills/push-pr/SKILL.md`
   - `push-pr-light` → `.claude/skills/push-pr-light/SKILL.md`
   - `catchup` → `.claude/skills/catchup/SKILL.md`

   a. Ensure the skill's parent directory exists: `mkdir -p ~/.claude/skills/<name>`.
   b. Check if `~/.claude/skills/<name>/SKILL.md` already exists.
   c. If it doesn't exist: ask the developer:
      > "Install `/[name]` globally? This adds it to `~/.claude/skills/<name>/SKILL.md` so it's available in every workspace."
      - yes → copy the file
      - skip → leave it
   d. If it already exists: check whether the contents differ.
      - Same → skip silently.
      - Different → show a brief summary of the changes and ask: "Update global `/[name]`? (yes / skip)"
2. Tell the developer which skills were installed (or mention that this step was skipped).

---

## Step 3C: Recommend LSP

Ask the developer:

> "Would you like to **enable LSP** (Language Server Protocol) for Claude Code? Our benchmarks show it makes Claude **~25% faster and cheaper** on multi-file tasks — especially in repos with complex type hierarchies, cross-file references, or interface implementations.
>
> It doesn't help (and can add overhead) for small codebases where grep is sufficient.
>
> Want me to enable it? (yes / skip)"

- **yes** → Tell the developer to run the following command in their terminal to install the LSP plugin:
  ```
  /plugin install lsp
  ```
  This installs the LSP plugin directly into Claude Code — no MCP server configuration needed.
- **skip** → move on silently.

---

## Step 3D: Offer native multi-model agents (optional, macOS)

If the platform is macOS, mention the optional native-agents lane:

> "The playbook can also install **native multi-model agents** — `codex` (GPT-5.5), `codex-xhigh`, and `gemini-flash` as native subagent types, served through a local relay in front of VibeProxy. It's opt-in per session via a `claude-native` launcher; plain `claude` is never affected. Interested? Run `/native-agents` whenever you like — it walks through the whole install and has a `doctor` mode for verification."

Do not run the install inline — `/native-agents` owns that flow. On non-macOS platforms, skip this step silently (VibeProxy is macOS-only).

---

## Step 4: Wrap up

After all sections are filled:

1. Print a summary of what was filled
2. Remind the developer: *"Review the full CLAUDE.md to make sure everything reads well together. You can always edit it manually later."*
3. If the project doesn't have the `.claude/templates/` directory or `quickref.md`, mention that they should copy those from the playbook repo as well
4. **Check for stray maintainer artifacts.** Check whether `tasks/todo.md`, `tasks/completed.md`, `tasks/errors.md`, `tasks/issues.md`, `tasks/new-issues.md`, or `tasks/checkpoint.md` exist. The first five ship with the playbook repo as the maintainer's working artifacts — the current README install never copies `tasks/`, but older install instructions moved it in wholesale; `tasks/checkpoint.md` is a local artifact from `/checkpoint` and is worth flagging the same way. If any are present and the developer didn't author them, warn the developer: *"Found `tasks/[filename]` — this may be a leftover from the playbook maintainer's working state. Review the contents; if they're not yours, remove them before starting your own work."* Do not exit setup without surfacing this check.
5. Mention that RDPI commands will create artifacts in `tasks/` as you work (`research-codebase.md`, `design-decision.md`, `research-patterns.md`, `plan.md`). The `tasks/` directory is tracked in git so working state is versioned — add it to `.gitignore` if you prefer to keep it local only.

---

## Edge cases

- **Partially filled CLAUDE.md:** Skip any section that doesn't contain `[TEAM FILLS IN`. Only process unfilled sections.
- **Minimal/empty repo:** If very few files exist, tell the developer. Fill what you can detect, and for sections with insufficient signal, write a short placeholder like `<!-- TODO: Fill in after project structure is established -->` and explain why.
- **Monorepo:** If monorepo markers are found, note this in the Architecture section and ask the developer which package/app is the primary focus for this CLAUDE.md instance.
- **Non-standard structure:** If the project doesn't follow common conventions, rely more heavily on developer input. Present what you found and ask them to describe what's different.
