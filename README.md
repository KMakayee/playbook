# Agentic Engineering Playbook

A workflow toolkit that orchestrates **Claude** and **Codex** for disciplined software engineering. Each phase pairs the two agents — Codex does broad codebase sweeps and independent cross-checks, Claude synthesizes, makes judgment calls, and drives implementation. Together they catch mistakes neither would catch alone: Codex surfaces what exists; Claude decides what matters.

## Prerequisites

- [Claude Code](https://claude.com/claude-code) — the runtime for slash commands
- [Codex CLI](https://github.com/openai/codex) — invoked in every QRSPI phase for independent review

## Setup

From your project root:

```bash
git clone https://github.com/KMakayee/playbook.git
mv playbook/* playbook/.claude .
rm -rf playbook/.git && rmdir playbook
rm -rf tasks
```

> The `mv` command overwrites existing files. Back up your `CLAUDE.md`, `.claude/`, and `templates/` directories first if they already exist.
>
> `rm -rf tasks` clears the playbook maintainer's working artifacts (`todo.md`, `errors.md`, `issues.md`) that ship with the repo. QRSPI commands recreate `tasks/` as you work.

Then open Claude Code and run:

```
/playbook-setup
```

This detects your tech stack, fills in the `[TEAM FILLS IN]` sections of `CLAUDE.md`, and offers to install global utility commands.

## What's included

### Commands

**QRSPI workflow**

| Command | Purpose |
|---|---|
| `/research-codebase` | Codex sweeps, Claude synthesizes; writes `tasks/research-codebase.md` |
| `/design` | Evaluate options, run Codex cross-check, pick a winner; writes `tasks/design-decision.md`. Includes inline pattern research with RUN/SKIP gate. |
| `/create-plan` | Draft plan, Codex reviews, absorb findings; writes `tasks/plan.md` |
| `/implement` | Execute plan phase-by-phase, run Codex code review, apply triaged fixes via child process |
| `/create-todo` | Create standalone `tasks/todo.md` for ad-hoc tracking |

**Issue workflow**

| Command | Purpose |
|---|---|
| `/issue-research-codex` | Codex researches issue, Claude verifies; writes `tasks/research-issue-N.md` |
| `/issue-plan` | Generate `tasks/plan-issue-N.md` from research |
| `/issue-plan-review-codex` | Codex reviews plan against research and acceptance criteria |
| `/issue-implement` | Execute approved plan step-by-step |
| `/issue-code-review-codex` | Codex reviews implementation against issue-specific plan |
| `/issue-update` | Check impact of completed issue on other open issues |
| `/auto-issues` | Run full issue pipeline end-to-end, unattended |

**Setup & maintenance**

| Command | Purpose |
|---|---|
| `/playbook-setup` | One-time project configuration |
| `/playbook-audit` | Health check and artifact cleanup |
| `/playbook-update` | Fetch and apply latest playbook version |

**Utility**

| Command | Purpose |
|---|---|
| `/commit` | Stage, commit, and push to current branch |
| `/push-pr` | Push, open PR, full code review, conditional merge |
| `/push-pr-light` | Push, open PR, light diff review, conditional merge |
| `/checkpoint` | Save current work state to `tasks/checkpoint.md` |
| `/finish` | Wrap up task: verify, commit artifacts, clean up |

### Templates

| Template | Purpose |
|---|---|
| `audit-report.md` | Output for `/playbook-audit` |
| `error-report.md` | Error and learning log entries |
| `deferred.md` | Out-of-scope items tracker |
| `new-issues.md` | Issue board template |
| `playbook-sections.md` | Reusable CLAUDE.md fragment |

### Workflow rules

`CLAUDE.md` includes the QRSPI (Questions, Research, Structure, Plan, Implement) workflow rules. Any task touching 2+ files or changing interfaces requires structured research, a reviewed design, an approved plan, and step-by-step implementation with verification. Every phase pairs Claude's synthesis with an independent Codex cross-check — the two-agent handshake is what separates this playbook from single-agent workflows. Trivial changes (single file, <20 lines) skip the process. See `quickref.md` for the full checklist.

## Updating

```
/playbook-update
```

Fetches the latest playbook, shows what changed, and lets you approve each file update individually. Your team-specific `CLAUDE.md` sections are never touched.

## File overview

| File | Purpose | Loaded by Claude Code? |
|---|---|---|
| `CLAUDE.md` | Project context + workflow rules | Yes — every session |
| `quickref.md` | Human-readable QRSPI cheat sheet | No — for your reference |
| `templates/*` | Structures for research, plans, audits, etc. | Referenced when writing artifacts |
| `.claude/commands/*` | Slash commands | Only when invoked |
| `.claude/settings.local.json` | Permissions config | Yes — every session |

## LSP

Enabling LSP (Language Server Protocol) in Claude Code gives **~25% faster and cheaper** results on multi-file tasks. Benchmarked across Python, TypeScript, and Go with find-references and refactoring tasks:

- **LSP helps most** when references span many files, type relationships matter, or interface implementations need discovery (30-60% improvement).
- **LSP doesn't help** when the answer is in 1-2 files or the codebase is simple enough for grep.

`/playbook-setup` will offer to enable LSP during configuration.

---

Built on the QRSPI workflow, evolved from the Research-Plan-Implement approach by [HumanLayer](https://github.com/humanlayer), with workflow orchestration principles from Boris Cherny. Two-agent orchestration pattern inspired by pairing human code review with an independent reviewer.
