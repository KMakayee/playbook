# Agentic Engineering Playbook

An agentic engineering toolkit built on the Claude Code harness: it brings traditional engineering discipline — research before code, reviewed designs, approved plans, independent review — into agentic development with sub-agents, workflows, and multi-model routing. Claude orchestrates; Codex and Gemini take the lanes they're best at, and no model reviews its own work.

## Prerequisites

- [Claude Code](https://claude.com/claude-code) — the runtime for slash commands
- [Codex CLI](https://github.com/openai/codex) — invoked for independent review and cross-checks

## Setup

From your project root:

```bash
rm -rf /tmp/playbook
git clone --depth 1 https://github.com/KMakayee/playbook.git /tmp/playbook &&
  mkdir -p .claude &&
  cp -R /tmp/playbook/.claude/. .claude/ &&
  { [ -f quickref.md ] || cp /tmp/playbook/quickref.md .; }
rm -rf /tmp/playbook
```

> This copies only the playbook's `.claude/` content (skills, templates, prompts, scripts) and `quickref.md` (skipped if you already have one). Your `CLAUDE.md`, `README.md`, `tasks/`, and everything else in your project are never touched. The copy **merges** into an existing `.claude/` — your own commands, skills, agents, hooks, and settings are preserved, and the playbook's files are added alongside them. One caveat: if a file exists at the exact same path as a playbook file (e.g., your own skill named `commit` at `.claude/skills/commit/SKILL.md`), that file is overwritten — check for name collisions first if you maintain skills or templates with playbook names. The leading `rm -rf /tmp/playbook` clears any stale clone from an earlier failed run, and the `&&` chain stops the copy if the clone fails.

**Optional preflight** — if you maintain your own `.claude/` skills or templates and want to see what the copy would overwrite, run the first two lines (the `rm -rf` and the `git clone`) by themselves, then:

```bash
(cd /tmp/playbook && find .claude -type f) | while IFS= read -r f; do [ -e "$f" ] && echo "would overwrite: $f"; done
```

No output means the copy is purely additive. Any `would overwrite:` line is a same-path file — rename yours or accept the overwrite deliberately, then run the remaining lines.

Then open Claude Code and run:

```
/playbook-setup
```

This creates `CLAUDE.md` for a new project — or, for an existing project, walks you through merging the playbook sections into your `CLAUDE.md` section by section, never removing or rewriting your content without asking. It then detects your tech stack, fills in the `[TEAM FILLS IN]` sections, offers the playbook's recommended `.gitignore` entries (each one your choice), and offers to install global utility skills.

## What's included

### Skills

**RDPI workflow**

| Skill | Purpose |
|---|---|
| `/research-codebase` | Investigate the codebase before writing code — current behavior, relevant paths, patterns, risks; writes `tasks/research-codebase.md` |
| `/design` | Evaluate implementation options, cross-check them with a second model, and pick a winner; writes `tasks/design-decision.md` |
| `/create-plan` | Turn the finalized design into a reviewed, step-by-step plan for your approval; writes `tasks/plan.md` |
| `/implement` | Execute the approved plan phase-by-phase, then code-review the result and apply the fixes |
| `/implement-codex` | *Experimental.* Like `/implement`, but Codex writes the code and Claude verifies each phase; `/implement` remains the production path |
| `/forge` | Build one named piece (code, doc, spec, …) end-to-end: define its contract, build it, then review-and-fix until it passes |
| `/create-todo` | Turn a rough goal into a structured task backlog in `tasks/todo.md` |

**Issue workflow**

| Skill | Purpose |
|---|---|
| `/issue-research` | Investigate an issue and recommend an approach; writes `tasks/research-issue-N.md` |
| `/issue-plan` | Write a reviewed implementation plan for an issue; writes `tasks/plan-issue-N.md` |
| `/issue-implement` | Execute the issue's plan, then code-review the result and apply the fixes |
| `/issue-update` | Check impact of completed issue on other open issues |
| `/auto-issues` | Run the full pipeline for one issue end-to-end, unattended, inside its `worktree-issue-N` worktree |
| `/issue-finish` | Commit remaining issue work, then clean up issue artifacts |

**Setup & maintenance**

| Skill | Purpose |
|---|---|
| `/playbook-setup` | One-time project configuration |
| `/playbook-audit` | Health check and artifact cleanup |
| `/playbook-update` | Fetch and apply latest playbook version |
| `/native-agents` | Install GPT/Gemini as native subagent types via a local relay (optional; macOS) |

**Utility**

| Skill | Purpose |
|---|---|
| `/commit` | Stage, commit, and push to current branch |
| `/push-pr` | Push, open PR, full code review, squash-merge by default |
| `/push-pr-light` | Push, open PR, light diff review, squash-merge by default |
| `/catchup` | Catch a feature branch up to its default base — fetch, merge, surface conflicts, run validation, recommend `/push-pr` |
| `/checkpoint` | Save / resume / discard work state in `tasks/checkpoint.md` (commits on save, consumes on resume) |
| `/codex-review` | Get a second-opinion review of a file, diff, or artifact from a different model |
| `/codex-audit` | Check that a derived artifact faithfully matches its source(s) — fidelity, completeness, precision |
| `/codex-research` | Research a question — in the codebase, externally, or "is there a better way" — and keep the findings in `tasks/logs/research/` |
| `/finish` | Wrap up task: verify, commit artifacts, clean up |

### Native multi-model agents (optional, macOS)

`/native-agents` installs `codex`, `codex-xhigh`, and `gemini-flash` as native subagent types, served through a local model-routing relay. Sessions opt in via the installed `claude-native` launcher (fail-closed — stock `claude` sessions are untouched), and `/native-agents doctor` verifies the install end-to-end. Once installed, CLAUDE.md's Workflow section routes delegated work across the lanes by default — Codex codes, Opus audits and synthesizes, Gemini Flash takes volume — with stock sessions falling back to Claude-only routing.

### Templates

| Template | Purpose |
|---|---|
| `audit-report.md` | Output for `/playbook-audit` |
| `error-report.md` | Error and learning log entries |
| `deferred.md` | Out-of-scope items tracker |
| `new-issues.md` | Issue board template |
| `playbook-sections.md` | Reusable CLAUDE.md fragment |

### Workflow rules

`CLAUDE.md` carries the always-loaded rules: sub-agent behaviors (recursion guard, grounded findings), the Workflow model-routing table (Codex builds, Claude audits and synthesizes, Gemini Flash takes volume work and third-family verification), and quality standards. The RDPI cycle (Research, Design, Plan, Implement) is opt-in — run it via the skills above when a task warrants structured research, a reviewed design, and an approved plan. Every phase pairs the author with an independent cross-check from another model — the author never reviews its own work, and that rule is what separates this playbook from single-agent workflows. See `quickref.md` for the operator checklist.

## Updating

```
/playbook-update
```

Fetches the latest playbook, shows what changed, and lets you approve each file update individually. Your team-specific `CLAUDE.md` sections are never touched.

## File overview

| File | Purpose | Loaded by Claude Code? |
|---|---|---|
| `CLAUDE.md` | Project context + workflow rules | Yes — every session |
| `quickref.md` | Human-readable RDPI cheat sheet | No — for your reference |
| `.claude/templates/*` | Structures for research, plans, audits, etc. | Referenced when writing artifacts |
| `.claude/skills/*` | Slash commands | Only when invoked |

## LSP

Enabling LSP (Language Server Protocol) in Claude Code gives **~25% faster and cheaper** results on multi-file tasks. Benchmarked across Python, TypeScript, and Go with find-references and refactoring tasks:

- **LSP helps most** when references span many files, type relationships matter, or interface implementations need discovery (30-60% improvement).
- **LSP doesn't help** when the answer is in 1-2 files or the codebase is simple enough for grep.

`/playbook-setup` will offer to enable LSP during configuration.

---

Credits to [HumanLayer](https://github.com/humanlayer) for the workflow foundation and to [Boris Cherny](https://x.com/bcherny) and [Peter Steinberger](https://github.com/steipete) for orchestration principles. Two-agent orchestration pattern inspired by pairing human code review with an independent reviewer.
