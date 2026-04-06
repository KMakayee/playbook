# Setup Assistant

You are setting up the QRSPI playbook for this codebase. Start by asking the developer whether this is a new project (playbook template already in CLAUDE.md) or an existing project (their own CLAUDE.md that needs playbook sections added). Then follow the appropriate path.

---

## Step 0: Ask new or existing project

Ask the developer:

> "Is this a **new project** (you followed the playbook README setup instructions and CLAUDE.md already has the `[TEAM FILLS IN]` sections) or an **existing project** (you have your own CLAUDE.md that you'd like the playbook sections added to)?"

- **New project** → proceed to Step 1
- **Existing project** → proceed to Step 0B

---

## Step 0B: Append playbook structure to existing CLAUDE.md

For existing projects only:

1. Read their existing CLAUDE.md and summarize what's there (1-2 sentences) so the developer can confirm it's the right file.
2. Explain: "I'll append 7 new sections (Codebase Overview, Architecture, Conventions, Testing, Build & Run, Critical Paths, Dependencies) and the QRSPI Workflow Rules to your file. Your existing content will not be touched."
3. Wait for developer confirmation.
4. Read `templates/playbook-sections.md` and append its full contents to the end of CLAUDE.md using the Edit tool.
5. After appending, proceed to Step 1 — CLAUDE.md now has markers.

---

## Step 1: Read CLAUDE.md and identify unfilled sections

Read `CLAUDE.md` in the project root. Identify which sections still contain the marker text `[TEAM FILLS IN`.

- **Markers found** → skip any already-filled sections, proceed to Step 2 with the unfilled ones.
- **No markers found, all headers present** → the playbook is fully configured. Tell the developer and stop.
- **No markers found, missing headers** → this shouldn't happen after Step 0. Tell the developer something is unexpected and suggest re-running `/playbook-setup`.

---

## Step 2: Explore the codebase via subagent

Spawn a single Explore subagent (`Agent` tool, `subagent_type: "Explore"`, thoroughness: "very thorough") to detect the ecosystem and gather findings for all unfilled sections at once. **Do not read any source or config files yourself** — the subagent handles all file I/O.

Read `templates/explore-prompt.md`, replace `[UNFILLED_SECTIONS]` with the comma-separated list of unfilled section names from Step 1, and use the result as the subagent prompt.

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

## Step 3B: Install global utility commands

Offer to install reusable workflow commands to `~/.claude/commands/` (global, available in all workspaces).

1. Check if `~/.claude/commands/` exists. If not, create it.
2. For each of the following command files:
   - `.claude/commands/commit.md`
   - `.claude/commands/push-pr.md`
   - `.claude/commands/push-pr-light.md`

   a. Check if the file already exists at `~/.claude/commands/[filename]`.
   b. If it doesn't exist: ask the developer:
      > "Install `/[name]` globally? This adds it to `~/.claude/commands/` so it's available in every workspace."
      - yes → copy the file
      - skip → leave it
   c. If it already exists: check whether the contents differ.
      - Same → skip silently.
      - Different → show a brief summary of the changes and ask: "Update global `/[name]`? (yes / skip)"
3. Tell the developer which commands were installed (or mention that this step was skipped).

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

## Step 4: Wrap up

After all sections are filled:

1. Print a summary of what was filled
2. Remind the developer: *"Review the full CLAUDE.md to make sure everything reads well together. You can always edit it manually later."*
3. If the project doesn't have the `templates/` directory or `quickref.md`, mention that they should copy those from the playbook repo as well
4. Mention that the `tasks/` directory will be created at runtime to hold QRSPI artifacts (`research-codebase.md`, `design-decision.md`, `research-patterns.md`, `plan.md`) — it does not need to be created manually

---

## Edge cases

- **Partially filled CLAUDE.md:** Skip any section that doesn't contain `[TEAM FILLS IN`. Only process unfilled sections.
- **Minimal/empty repo:** If very few files exist, tell the developer. Fill what you can detect, and for sections with insufficient signal, write a short placeholder like `<!-- TODO: Fill in after project structure is established -->` and explain why.
- **Monorepo:** If monorepo markers are found, note this in the Architecture section and ask the developer which package/app is the primary focus for this CLAUDE.md instance.
- **Non-standard structure:** If the project doesn't follow common conventions, rely more heavily on developer input. Present what you found and ask them to describe what's different.
