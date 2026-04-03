---

## Codebase Overview

[TEAM FILLS IN — 2-3 sentence description of what this project does, who uses it, and what stage it's in (greenfield, mature, legacy).]

## Architecture

[TEAM FILLS IN — High-level architecture. Include:
- Primary language(s) and framework(s)
- Directory structure and what lives where
- Key abstractions (e.g., "all API routes are in src/routes/, each exports a Hono router")
- Database / storage layer
- External services and integrations]

## Conventions

[TEAM FILLS IN — Coding standards enforced in this repo:
- Naming conventions (files, functions, variables, types)
- Import ordering and module boundaries
- Error handling patterns
- Logging conventions]

## Testing

[TEAM FILLS IN — Testing setup:
- Framework (e.g., Jest, Vitest, pytest)
- Test file location convention (e.g., `__tests__/`, co-located `.test.ts`)
- How to run the full suite: `[COMMAND]`
- How to run a single test file: `[COMMAND]`
- Minimum coverage expectations, if any]

## Build & Run

[TEAM FILLS IN — Commands to build and run locally:
- Install dependencies: `[COMMAND]`
- Dev server: `[COMMAND]`
- Production build: `[COMMAND]`
- Lint / format: `[COMMAND]`]

## Critical Paths

[TEAM FILLS IN — Files and areas that require extra caution:
- Auth / security-sensitive code
- Payment / billing logic
- Database migrations
- Public API contracts
- Any file that should NOT be modified without explicit human approval]

## Dependencies

[TEAM FILLS IN — Key dependencies and version constraints worth noting. Omit obvious ones — only list what the agent needs to know to avoid breaking things.]

---

# RPI Workflow Rules

**These rules are fixed. Do not modify them.**

## Pre-Edit Gate

**Before calling Edit or Write on any source file, classify the task:**

| Classification | Criteria | Workflow |
|---|---|---|
| **Trivial** | Single file, under ~20 changed lines, no new abstractions, no changed interfaces | Implement directly — no RPI needed |
| **Non-trivial** | 2+ files, OR new/changed abstractions, OR modified interfaces/contracts, OR changed control flow across modules | **Full RPI required** — all three phases, no skipping |

If uncertain, it is non-trivial. Do not call Edit or Write on source files until either (a) the task is trivial, or (b) `research.md` exists and `plan.md` has been approved.

**Bug fix mode:** When given a bug report, error log, or failing test — diagnose it autonomously. Do not ask the user to identify the root cause. The autonomy is about initiative and diagnosis, not about skipping process. A bug fix that meets the non-trivial criteria above still requires full RPI. Arrive at the plan on your own, then present it for approval as usual.

## Phase 1: Research

Before writing any code, investigate the codebase to gather ground truth.

1. **Explore** — Spawn a **single** Explore sub-agent to locate all relevant files, read and analyze them, and identify codebase patterns — all in one pass. Only split into multiple agents when the task spans multiple unrelated domains.
2. **Write research.md** — Aggregate findings into `research.md` (max 1000 lines). Follow the structure in `templates/research.md` — it defines all required sections (paths, current behavior, patterns, risks, etc.).
3. **Verify context budget** — If above 30% context utilization after writing research.md, compact before proceeding.

## Phase 2: Plan

Generate a detailed plan from research.md — do NOT plan from memory or re-research.

1. Read `research.md` into context.
2. Produce `plan.md`.
3. **Do not implement until the plan is approved.** If rejected or revised, update `plan.md` before proceeding.

## Phase 3: Implement

**Prerequisite check:** Confirm that `tasks/research.md` and `tasks/plan.md` exist and the plan has been approved. If either is missing, stop — you have skipped a phase.

Execute the approved plan. Do not improvise.

1. Follow the plan step by step. Deviations require a plan update first.
2. Keep changes minimal — only modify what the plan specifies.
3. Run tests after each logical unit of change, not just at the end.
4. If something unexpected is encountered, **stop** and return to Research for that sub-problem.
5. Track progress in `tasks/todo.md` using `templates/todo.md`. Commit frequently with messages that reference plan steps.
6. **Clean up artifacts** — After all steps are complete and verified, remove `tasks/research.md`, `tasks/plan.md`, and `tasks/todo.md`.

## Multi-Batch Plans

When a plan contains multiple independent batches (e.g., a code review with 6 fix batches), do NOT implement them all in one pass. Each batch is a separate unit of work in its own prompt.

1. During Phase 2, identify and list independent batches in the plan.
2. Execute one batch per prompt. The pre-edit gate applies per-batch — trivial batches can skip RPI, non-trivial batches get full RPI.
3. Compact between batches to keep context low.

---

# Compaction Rules

Context is a scarce resource. Compact proactively, not reactively. LLM reasoning quality degrades significantly above ~40% context utilization (the "Dumb Zone") — the 30-35% trigger below keeps a safety margin.

| Trigger | Action |
|---|---|
| Context utilization reaches **30–35%** | Compact immediately — summarize conversation, drop raw file contents |
| Switching between sub-problems | Compact before pivoting to the new sub-problem |
| New conversation starts | Never carry forward a previous session's full context |

When compacting:
- Preserve: task description, file paths, key decisions, current phase, and artifact locations
- Drop: raw file contents already written to artifacts, verbose tool output, superseded analysis

---

# Sub-Agent Behaviors

**Recursion guard:** Sub-agents MUST NOT spawn further sub-agents or follow RPI. They are leaf tasks: read, search, and report.

### codebase-explorer (default for Research phase)
> Given this task: [TASK], do the following in a single pass:
> 1. Identify all relevant files, directories, and modules.
> 2. Read each relevant file and summarize: current behavior, key functions/classes, dependencies, and gotchas. Be specific with line numbers.
> 3. Identify naming conventions, testing patterns, error handling patterns, and architectural decisions in the relevant code.
> Return a structured report covering all three areas. Do NOT spawn sub-agents.

---

# Quality Standards

- **Read before modifying** — Do not propose changes to files you haven't read. Prefer editing existing files over creating new ones.
- **Verify before completing** — prove it works: run tests, run the linter, check logs, diff against the target branch. "I think it works" is not verification.
- **Find root causes** — no band-aids or temporary fixes. Trace symptoms to their source and fix the actual problem.
- **Surgical changes** — every changed line needs a reason traceable to the plan. No features, refactoring, or "improvements" beyond what the plan specifies. If you can't explain why a line changed, revert it.
- **Demand elegance for non-trivial changes** — before implementing, ask "is there a simpler way?" Skip for mechanical or single-line fixes.
- **Self-assess** — before marking any step complete, ask: "Would a staff engineer approve this?" If the answer is no, revise.
- If a task seems too large, break it into sub-tasks that each follow RPI independently.

---

# Session-Start Validation

At the start of each session, run these lightweight checks (no sub-agents, under 30 seconds total):

1. **Leftover artifacts** — Check if `tasks/research.md`, `tasks/plan.md`, or `tasks/todo.md` exist from a previous session. If found, notify the developer and ask whether to clean up or resume.
2. **Unconfigured CLAUDE.md** — Scan the top half of CLAUDE.md for `[TEAM FILLS IN` markers or `<!-- TODO` comments. If found, mention that `/playbook-setup` can fill them in.
3. **Playbook version** — If `.playbook-version` exists, read it. If the installed date is older than 30 days, mention that `/playbook-update` can check for updates.
