# Project Instructions

> These instructions are loaded automatically in every Claude Code session.
> **Top half:** team-specific context (fill in the bracketed sections).
> **Bottom half:** fixed RPI workflow rules (do not modify).

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

## When to Use RPI

Any task that touches **more than 2 files** or involves **architectural decisions** MUST follow the Research → Plan → Implement workflow. Single-file fixes and trivial changes can skip directly to implementation.

**Bug fix mode:** When given a bug report, error log, or failing test — resolve it autonomously. Trace from symptoms to root cause, fix it, verify the fix, and report what you did. Do not ask the user to diagnose the problem for you. RPI still applies if the fix spans more than 2 files.

## Phase 1: Research

Before writing any code, investigate the codebase to gather ground truth.

1. **Locate** — Spawn a sub-agent to identify all files, directories, and modules relevant to the task. Do NOT read file contents in this step — return a structured list of paths with one-sentence explanations of relevance.
2. **Analyze** — Spawn sub-agent(s) to read each relevant area and summarize: current behavior, key functions/classes, dependencies, and gotchas. Be specific with line numbers. Parallelize across independent areas.
3. **Find patterns** — Spawn a sub-agent to identify naming conventions, testing patterns, error handling patterns, and architectural decisions in the relevant code. These guide implementation.
4. **Write research.md** — Aggregate all findings into `research.md` (target: 300–1,000 lines). Use the structure in `templates/research.md`.
5. **Verify context budget** — After writing research.md, check context utilization. If above 30%, compact before proceeding.

### Research output requirements
- Specific file paths and line numbers, not vague references
- Existing patterns and conventions observed (not assumed)
- Dependencies and integration points that will be affected
- Known constraints or gotchas discovered during research
- Summary of current behavior in the relevant area

## Phase 2: Plan

Generate a detailed plan from research.md — do NOT plan from memory or re-research.

1. Read `research.md` into context.
2. Produce `plan.md` using the structure in `templates/plan.md`.
3. Every change must specify: exact file paths, line number ranges, what changes and why.
4. Include testing strategy, rollback strategy, and dependencies (what must be done before this change, what depends on it).
5. Present the plan to the human for review. **Do not implement until the plan is approved.**
6. If the plan is rejected or revised, update `plan.md` before proceeding.

## Phase 3: Implement

Execute the approved plan. Do not improvise.

1. Follow the plan step by step. Deviations require a plan update first.
2. Keep changes minimal — only modify what the plan specifies.
3. Run tests after each logical unit of change, not just at the end.
4. If something unexpected is encountered, **stop** and return to Research for that sub-problem.
5. Commit frequently with messages that reference plan steps.
6. Track progress in `tasks/todo.md` — write checkable items from the plan, mark them as you go, and add a brief result summary for each completed step. Use the structure in `templates/todo.md`.

---

# Compaction Rules

Context is a scarce resource. Compact proactively, not reactively. LLM reasoning quality degrades significantly above ~40% context utilization (the "Dumb Zone") — the 30-35% trigger below keeps a safety margin.

| Trigger | Action |
|---|---|
| Context utilization reaches **30–35%** | Compact immediately — summarize conversation, drop raw file contents |
| Research phase completes | Compact before starting the Plan phase |
| Switching between sub-problems | Compact before pivoting to the new sub-problem |
| New conversation starts | Never carry forward a previous session's full context |

When compacting:
- Preserve: task description, file paths, key decisions, current phase, and artifact locations
- Drop: raw file contents already written to artifacts, verbose tool output, superseded analysis

---

# Sub-Agent Behaviors

When spawning sub-agents for the Research phase, use these behaviors:

### codebase-locator
> Given this task: [TASK], identify all files, directories, and modules that are relevant. Do NOT read file contents. Return a structured list of paths with one-sentence explanations of why each is relevant.

### codebase-analyzer
> Read [FILE_LIST] and produce a summary of: current behavior, key functions/classes, dependencies, and any constraints or gotchas. Be specific with line numbers.

### codebase-pattern-finder
> Analyze [FILE_LIST] and identify: naming conventions, testing patterns, error handling patterns, and any architectural decisions. These will guide implementation.

---

# General Rules

- Read code before modifying it. Do not propose changes to files you haven't read.
- Prefer editing existing files over creating new ones.
- Do not add features, refactoring, or "improvements" beyond what the plan specifies.
- Run the linter and test suite before considering any step complete.
- If a task seems too large, break it into sub-tasks that each follow RPI independently.

---

# Quality Standards

- **Verify before completing** — prove it works: run tests, check logs, diff against the target branch. "I think it works" is not verification.
- **Find root causes** — no band-aids or temporary fixes. Trace symptoms to their source and fix the actual problem. Apply senior-engineer judgment.
- **Surgical changes** — every changed line needs a reason traceable to the plan. If you can't explain why a line changed, revert it.
- **Demand elegance for non-trivial changes** — before implementing, pause and ask "is there a simpler way?" Skip this for mechanical or single-line fixes.
- **Self-assess** — before marking any step complete, ask: "Would a staff engineer approve this?" If the answer is no, revise before proceeding.

---

# Self-Improvement

- After any user correction or failed verification, add an entry to `tasks/lessons.md` using the structure in `templates/lessons.md`.
- At the start of each session, read `tasks/lessons.md` (if it exists) before beginning work.
- If the same mistake occurs twice, the existing lesson is too weak — rewrite it with a stronger prevention rule.
