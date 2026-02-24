# RPI Playbook

A ready-to-use toolkit for disciplined AI-assisted engineering with Claude Code. Based on the **Research → Plan → Implement** workflow from Dex Horthy's [No Vibes Allowed](https://www.youtube.com/watch?v=rmvDxxNubIg) talk.

The core idea: AI coding agents fail in complex codebases not because of model quality, but because of poor context management. This playbook enforces structured research, explicit planning, and minimal implementation — keeping the agent in the Smart Zone.

## Setup

### 1. Copy files to your repo

Copy these files into your project root:

```
CLAUDE.md                     # Project instructions (loaded every session)
quickref.md                   # Human reference card for the RPI workflow
templates/
  research.md                 # Template for research phase output
  plan.md                     # Template for plan phase output
.claude/
  commands/
    setup.md                  # One-time setup assistant (the /setup command)
```

You can do this manually or with:

```bash
# From your target repo root:
cp /path/to/playbook/CLAUDE.md .
cp /path/to/playbook/quickref.md .
cp -r /path/to/playbook/templates .
mkdir -p .claude/commands
cp /path/to/playbook/.claude/commands/setup.md .claude/commands/
```

### 2. Do NOT copy these files

These stay in the playbook repo only — they are reference material that would waste context budget if loaded into your project:

| File | Why it stays here |
|---|---|
| `main.md` | 323 lines of theory and rationale — useful for learning, not for every session |
| `ref_docs/` | Source documents used to build the playbook |
| `README.md` | This file — distribution instructions, not project instructions |

### 3. Run the setup assistant

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
| `quickref.md` | Human-readable RPI cheat sheet | No — for your reference |
| `.claude/commands/setup.md` | One-time setup slash command | Only when you run `/setup` |
