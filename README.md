# RPI Playbook

A ready-to-use toolkit for disciplined AI-assisted engineering with Claude Code. Based on the **Research → Plan → Implement** workflow from Dex Horthy's [No Vibes Allowed](https://www.youtube.com/watch?v=rmvDxxNubIg) talk.

The core idea: AI coding agents fail in complex codebases not because of model quality, but because of poor context management. This playbook enforces structured research, explicit planning, and minimal implementation — keeping the agent in the Smart Zone.

## Setup

### 1. Add the playbook to your project

From your project root:

```bash
git clone https://github.com/KMakayee/playbook.git
rm -rf playbook/main.md playbook/ref_docs playbook/README.md playbook/.git
mv playbook/* playbook/.claude .
rmdir playbook
```

> **Warning:** The `mv` command will overwrite existing files without prompting. If your project already has a `CLAUDE.md`, `.claude/` directory, `quickref.md`, or `templates/` directory, back them up before running the setup commands.

> **Note:** A `tasks/` directory is created at runtime to hold `research.md`, `plan.md`, `todo.md`, and `lessons.md` for the current task. It is not included in this distribution.

### 2. Run the setup assistant

Open Claude Code in your project and run:

```
/setup
```

The assistant will:
1. Detect your tech stack (language, framework, package manager, test runner, etc.)
2. Walk through each `[TEAM FILLS IN]` section in CLAUDE.md
3. Draft proposed content based on what it finds in your codebase
4. Ask you to confirm or edit each section before writing it

After setup, your CLAUDE.md will be fully configured for your project.

## How the RPI workflow works

Once CLAUDE.md is configured, Claude Code automatically follows the RPI workflow for any task touching more than 2 files:

**Research** — Sub-agents explore the codebase and write findings to `research.md`. No code is written.

**Plan** — A detailed `plan.md` is generated from the research. You review and approve before any implementation begins.

**Implement** — The approved plan is executed step by step. Deviations require a plan update. Tests run after each step.

Context is compacted between phases to keep the agent in the Smart Zone (under ~35% context utilization).

See `quickref.md` for the full checklist.

## File overview

| File | Purpose | Loaded by Claude Code? |
|---|---|---|
| `CLAUDE.md` | Project-specific context + RPI rules | Yes — every session |
| `templates/research.md` | Structure for research output | Referenced when writing research |
| `templates/plan.md` | Structure for plan output | Referenced when writing plans |
| `templates/lessons.md` | Structure for self-improvement entries | Referenced when capturing corrections |
| `templates/todo.md` | Structure for task progress tracking | Referenced when tracking implementation |
| `quickref.md` | Human-readable RPI cheat sheet | No — for your reference |
| `.claude/commands/setup.md` | One-time setup slash command | Only when you run `/setup` |
