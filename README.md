# Claude Code Playbook

A toolkit of commands, hooks, templates, and workflow rules for disciplined AI-assisted engineering with Claude Code.

## Setup

From your project root:

```bash
git clone https://github.com/KMakayee/playbook.git
mv playbook/* playbook/.claude .
rm -rf playbook/.git && rmdir playbook
```

> The `mv` command overwrites existing files. Back up your `CLAUDE.md`, `.claude/`, and `templates/` directories first if they already exist.

Then open Claude Code and run:

```
/playbook-setup
```

This detects your tech stack, fills in the `[TEAM FILLS IN]` sections of `CLAUDE.md`, and offers to install global utility commands.

## What's included

### Commands (25)

**QRSPI workflow**

| Command | Purpose |
|---|---|
| `/research-codebase` | Investigate codebase; writes `tasks/research-codebase.md` |
| `/research-codebase-codex` | Codex reviews and verifies existing research |
| `/design` | Evaluate options and trade-offs; writes `tasks/design-decision.md` |
| `/design-review-codex` | Codex reviews and finalizes the design |
| `/research-patterns` | Find production repos with chosen pattern (optional); writes `tasks/research-patterns.md` |
| `/create-plan` | Generate implementation plan; writes `tasks/plan.md` |
| `/plan-review-codex` | Codex reviews plan judgment calls, feasibility, and risks |
| `/implement` | Execute approved plan phase-by-phase |
| `/code-review-codex` | Codex reviews implementation against plan |
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

### Hooks

- **stop-verify** — Nudges the agent to verify work before finishing (changes match plan, no unintended files, verified not assumed).

### Templates

| Template | Purpose |
|---|---|
| `audit-report.md` | Output for `/playbook-audit` |
| `error-report.md` | Error and learning log entries |
| `deferred.md` | Out-of-scope items tracker |
| `new-issues.md` | Issue board template |
| `playbook-sections.md` | Reusable CLAUDE.md fragment |

### Workflow rules

`CLAUDE.md` includes the QRSPI (Questions, Research, Structure, Plan, Implement) workflow rules. Any task touching 2+ files or changing interfaces requires structured research, a reviewed design, an approved plan, and step-by-step implementation with verification. Codex review gates validate design and implementation independently. Trivial changes (single file, <20 lines) skip the process. See `quickref.md` for the full checklist.

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
| `.claude/commands/*` | 25 slash commands | Only when invoked |
| `.claude/hooks/stop-verify.sh` | Verification nudge hook | On agent stop events |
| `.claude/settings.local.json` | Permissions and hook config | Yes — every session |

## LSP

Enabling LSP (Language Server Protocol) in Claude Code gives **~25% faster and cheaper** results on multi-file tasks. Benchmarked across Python, TypeScript, and Go with find-references and refactoring tasks:

- **LSP helps most** when references span many files, type relationships matter, or interface implementations need discovery (30-60% improvement).
- **LSP doesn't help** when the answer is in 1-2 files or the codebase is simple enough for grep.

`/playbook-setup` will offer to enable LSP during configuration.

---

Built on the QRSPI workflow, evolved from the Research-Plan-Implement approach by [HumanLayer](https://github.com/humanlayer), with workflow orchestration principles from Boris Cherny.
