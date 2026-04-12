# Project Instructions

> These instructions are loaded automatically in every Claude Code session.
> **Top half:** team-specific context (fill in the bracketed sections).
> **Bottom half:** fixed QRSPI workflow rules (do not modify).

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

## Issue Tracking

Issues are tracked using the playbook's own issue board — not TaskCreate or GitHub Issues.

- **Log new issues** → `tasks/new-issues.md` (triage inbox)
- **Active issue board** → `tasks/issues.md` (tracked work)
- **Template** → `templates/new-issues.md`

To log a new issue, append to `tasks/new-issues.md` using the format from `templates/new-issues.md`. Auto-increment the issue number.

Use `/issue-research-codex`, `/issue-plan`, `/issue-plan-review-codex`, `/issue-implement`, `/issue-code-review-codex` to move issues through the workflow.

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

# QRSPI Workflow Rules

**These rules are fixed. Do not modify them.**

<important if="editing source files">

## Pre-Edit Gate

**Before calling Edit or Write on any source file, classify the task:**

```
TRIVIAL
  Criteria: Single file, under ~20 changed lines,
            no new abstractions, no changed interfaces
  Workflow: Implement directly — no QRSPI needed

NON-TRIVIAL
  Criteria: 2+ files, OR new/changed abstractions,
            OR modified interfaces/contracts,
            OR changed control flow across modules
  Workflow: Full QRSPI required — all phases,
            no skipping
```

If uncertain, it is non-trivial. Do not call Edit or Write on source files until either (a) the task is trivial, or (b) `tasks/research-codebase.md` exists, the design in `tasks/design-decision.md` is finalized, and `tasks/plan.md` is approved.

**Bug fix mode:** When given a bug report, error log, or failing test — diagnose it autonomously. Do not ask the user to identify the root cause. The autonomy is about initiative and diagnosis, not about skipping process. A bug fix that meets the non-trivial criteria above still requires full QRSPI. Arrive at the plan on your own, then present it for approval as usual.

</important>

## Phase 1: Research (`/research-codebase`)

Before writing any code, investigate the codebase to gather ground truth. Document what IS, not what should be.

1. Run `/research-codebase` with the task description. It produces `tasks/research-codebase.md` (max 1000 lines) — located paths, current behavior analysis, codebase patterns, risks, and open questions.
2. **Optional:** Run `/research-codebase-codex` to have Codex verify and enhance the research.
3. **Verify context budget** — If above 30% context utilization after writing research, compact before proceeding.

## Phase 2: Design (`/design` → `/design-review-codex`)

Evaluate implementation options and present them with trade-offs.

1. Run `/design` — reads `tasks/research-codebase.md`, produces `tasks/design-decision.md` with 2-3 options, trade-offs, and open questions.
2. Run `/design-review-codex` — Codex reviews the design, appends findings, and recommends an option.
3. **Optional:** Run `/research-patterns` — finds production repos implementing the chosen approach, produces `tasks/research-patterns.md`.
4. **Do not plan until the design is finalized.** If the design review raises concerns, address them first.

## Phase 3: Plan (`/create-plan` → `/plan-review-codex`)

Generate a detailed implementation plan from the finalized design — do NOT plan from memory.

1. Run `/create-plan` — reads research, design, and patterns artifacts; produces `tasks/plan.md`.
2. **Optional:** Run `/plan-review-codex` — Codex reviews judgment calls, feasibility, completeness, and risks in the plan.
3. **Do not implement until the plan is approved.** If rejected or revised, update `tasks/plan.md` before proceeding.

## Phase 4: Implement (`/implement`)

**Prerequisite check:** Confirm that `tasks/plan.md` exists and the plan has been approved. If missing, stop — you have skipped a phase.

Execute the approved plan. Do not improvise.

1. Run `/implement` — executes the plan phase-by-phase.
2. Follow the plan step by step. Deviations require a plan update first.
3. Keep changes minimal — only modify what the plan specifies.
4. Run tests after each logical unit of change, not just at the end.
5. If something unexpected is encountered, **stop** and return to Research for that sub-problem.
6. Track progress via checkboxes in `tasks/plan.md`. Commit after each phase with conventional commit messages.
7. **Do not delete artifacts** — `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/research-patterns.md`, and `tasks/plan.md` stay until the next task begins. Session-start validation handles cleanup at that point.

## Multi-Batch Plans

When a plan contains multiple independent batches (e.g., a code review with 6 fix batches), do NOT implement them all in one pass. Each batch is a separate unit of work in its own prompt.

1. During Phase 3, identify and list independent batches in the plan.
2. Execute one batch per prompt. The pre-edit gate applies per-batch — trivial batches can skip QRSPI, non-trivial batches get full QRSPI.
3. Compact between batches to keep context low.

---

<important if="context utilization above 25%">

# Compaction Rules

Context is a scarce resource. Compact proactively, not reactively. LLM reasoning quality degrades significantly above ~40% context utilization (the "Dumb Zone") — the 30-35% trigger below keeps a safety margin.

```
Context utilization reaches 30-35%
  → Compact immediately — summarize conversation,
    drop raw file contents

Switching between sub-problems
  → Compact before pivoting to the new sub-problem

New conversation starts
  → Never carry forward a previous session's full context
```

When compacting:
- Preserve: task description, file paths, key decisions, current phase, and artifact locations
- Drop: raw file contents already written to artifacts, verbose tool output, superseded analysis

</important>

---

# Sub-Agent Behaviors

**Recursion guard:** Sub-agents MUST NOT spawn further sub-agents or follow QRSPI. They are leaf tasks: read, search, and report.

---

<important if="completing a task">

# Quality Standards

- **Read before modifying** — Do not propose changes to files you haven't read. Prefer editing existing files over creating new ones.
- **Verify before completing** — prove it works: run tests, run the linter, check logs, diff against the target branch. "I think it works" is not verification.
- **Find root causes** — no band-aids or temporary fixes. Trace symptoms to their source and fix the actual problem.
- **Surgical changes** — every changed line needs a reason traceable to the plan. No features, refactoring, or "improvements" beyond what the plan specifies. If you can't explain why a line changed, revert it.
- **Demand elegance for non-trivial changes** — before implementing, ask "is there a simpler way?" Skip for mechanical or single-line fixes.
- **Self-assess** — before marking any step complete, ask: "Would a staff engineer approve this?" If the answer is no, revise.
- If a task seems too large, break it into sub-tasks that each follow QRSPI independently.

</important>

---

# Session-Start Validation

At the start of each session, run these lightweight checks (no sub-agents, under 30 seconds total):

1. **Unconfigured CLAUDE.md** — Scan the top half of CLAUDE.md for `[TEAM FILLS IN` markers or `<!-- TODO` comments. If found, mention that `/playbook-setup` can fill them in.
2. **Playbook version** — If `.playbook-version` exists, read it. If the installed date is older than 30 days, mention that `/playbook-update` can check for updates.
