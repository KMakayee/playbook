# RPI Playbook

A ready-to-use toolkit for disciplined AI-assisted engineering with Claude Code. Built from two sources: the **Research → Plan → Implement** workflow from Dex Horthy's [No Vibes Allowed](https://www.humanlayer.dev/nva) talk, and the workflow orchestration principles from Boris Cherny (creator of Claude Code) — covering plan-first defaults, demand elegance, autonomous bug fixing, and verification before done.

The core idea: AI coding agents fail in complex codebases not because of model quality, but because of poor context management. This playbook enforces structured research, explicit planning, and minimal implementation — keeping the agent in the Smart Zone.

## Setup

### 1. Add the playbook to your project

From your project root:

```bash
git clone https://github.com/KMakayee/playbook.git
mv playbook/* playbook/.claude .
rmdir playbook
```

> **Warning:** The `mv` command will overwrite existing files without prompting. If your project already has a `CLAUDE.md`, `.claude/` directory, `quickref.md`, or `templates/` directory, back them up before running the setup commands.

> **Note:** A `tasks/` directory is created at runtime to hold `research.md`, `plan.md`, and `todo.md` for the current task. It is not included in this distribution.

### 2. Run the setup assistant

Open Claude Code in your project and run:

```
/playbook-setup
```

The assistant will:
1. Detect your tech stack (language, framework, package manager, test runner, etc.)
2. Walk through each `[TEAM FILLS IN]` section in CLAUDE.md
3. Draft proposed content based on what it finds in your codebase
4. Ask you to confirm or edit each section before writing it
5. Offer to install global utility commands (like `/commit`, `/push-pr`) to `~/.claude/commands/`

After setup, your CLAUDE.md will be fully configured for your project.

## How the RPI workflow works

Once CLAUDE.md is configured, Claude Code automatically follows the RPI workflow for any task touching more than 2 files:

**Research** — Sub-agents explore the codebase and write findings to `research.md`. No code is written.

**Plan** — A detailed `plan.md` is generated from the research. You review and approve before any implementation begins.

**Implement** — The approved plan is executed step by step. Deviations require a plan update. Tests run after each step.

Context is compacted between phases to keep the agent in the Smart Zone (under ~35% context utilization).

See `quickref.md` for the full checklist.

## Updating the playbook

When the playbook is updated with new rules, templates, or slash commands:

```
/playbook-update
```

The update command fetches the latest playbook, shows what changed, and lets you approve each file update individually. Your team-specific CLAUDE.md sections are never touched.

## File overview

| File | Purpose | Loaded by Claude Code? |
|---|---|---|
| `CLAUDE.md` | Project-specific context + RPI rules | Yes — every session |
| `templates/research.md` | Structure for research output | Referenced when writing research |
| `templates/plan.md` | Structure for plan output | Referenced when writing plans |
| `templates/todo.md` | Structure for task progress tracking | Referenced when tracking implementation |
| `templates/audit-report.md` | Structure for audit command output | Referenced when generating audit reports |
| `templates/error-report.md` | Structure for error and learnings log entries | Referenced when logging errors/learnings to `tasks/errors.md` |
| `quickref.md` | Human-readable RPI cheat sheet | No — for your reference |
| `.claude/commands/playbook-setup.md` | One-time setup slash command | Only when you run `/playbook-setup` |
| `.claude/commands/playbook-audit.md` | Periodic maintenance slash command | Only when you run `/playbook-audit` |
| `.claude/commands/playbook-update.md` | Update slash command | Only when you run `/playbook-update` |
| `.claude/commands/commit.md` | Stage, commit, and push to current branch | Only when you run `/commit` |
| `.claude/commands/push-pr.md` | Push, open PR, code review, and merge | Only when you run `/push-pr` |
| `.claude/commands/push-pr-light.md` | Push, open PR, light diff review, and merge | Only when you run `/push-pr-light` |
| `.claude/commands/checkpoint.md` | Save current work state to `tasks/checkpoint.md` | Only when you run `/checkpoint` |
| `.claude/commands/issue-research-codex.md` | Research using Codex for exploration | Only when you run `/issue-research-codex` |
| `.claude/commands/issue-audit-codex.md` | Audit using Codex for analysis | Only when you run `/issue-audit-codex` |
| `.playbook-version` | Tracks installed playbook version | No — used by `/playbook-update` |
