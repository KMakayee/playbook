# Project Instructions

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

## Commands

[TEAM FILLS IN — Commands the agent must use:
- Install dependencies: `[COMMAND]`
- Dev server: `[COMMAND]`
- Production build: `[COMMAND]`
- Lint / format: `[COMMAND]`
- Run the full test suite: `[COMMAND]`
- Run a single test file: `[COMMAND]`
Also note the test framework and test-file location convention (e.g., Vitest, co-located `.test.ts`).]

## Critical Paths

[TEAM FILLS IN — Files and areas that require extra caution:
- Auth / security-sensitive code
- Payment / billing logic
- Database migrations
- Public API contracts
- Dependency/version constraints that must not change (e.g., "do not upgrade X past Y")
- Any file that should NOT be modified without explicit human approval]

---

# Sub-Agent Behaviors

**Recursion guard:** Sub-agents are leaf tasks (read, search, report): they MUST NOT spawn sub-agents unless their spawn prompt explicitly grants the orchestrator role. The grant is non-transitive: an orchestrator spawns leaves only (max depth: parent → orchestrator → leaf).

Grant the role only for adaptive investigation — when each next spawn depends on the previous result and the lead's accumulated context doesn't serialize well (deep debugging, unfamiliar-code archaeology). If the fan-out is plannable up front, don't grant: have the lead return a work-list as structured output and spawn its items from the parent or workflow script.

## Sub-Agent Use

When spawning sub-agents:

- **Split test:** Spawn N sub-agents only if you can write N independent prompts where each result is usable without the others. If a gap can't be split this way, use one sub-agent.
- **Batch parallel calls:** When spawning ≥2 sub-agents, send all `Agent` calls in a single message (one tool-use batch). "In parallel" alone is not enough — explicit batching is the steering signal.
- **Acceptance contract:** Ask sub-agents to ground their findings — file:line citations for code reads, source URLs for web reads — and to flag contradictions with prior findings. Uncited claims are how sub-agent errors slip through.
- **Parent-only fallback:** If output is missing citations/URLs or contradicts prior findings, the parent reads the relevant files/sources directly to fill the gap. Do not re-spawn for the same gap (the recursion guard above).

---

# Workflow

Model routing for delegated work — this section governs ALL agent dispatch: plain Agent-tool spawns and Workflow-tool scripts alike. The orchestrator allocates the model by role using the recognition cues below. Economics, once: Codex calls are cheap and Gemini Flash is frontier-tier at a fraction of Claude prices — Claude agent spend is the scarce resource.

| Role | Dispatch | Recognition cues |
|---|---|---|
| **Codex** — coder | `agentType: codex`; deep-reasoning or contract-defining seams → `agentType: codex-xhigh` | The deliverable is code — essentially all of it, including small code changes. If the spawn prompt says "write or change source," it routes here. |
| **Opus** — auditor / synthesizer | `model: opus` | Auditing Codex output, synthesizing many inputs into one deliverable, reviewing for correctness or design. If the task judges or merges what others produced, it routes here. |
| **Gemini Flash** — volume / fetch | `agentType: gemini-flash` | Small or minor tasks; repetitive, high-volume, or high-frequency work; fetching. If you are about to spawn N similar leaves, they route here. |
| **Sonnet** — harness-dependent fan-out | `model: sonnet` | Trivial fan-out that specifically relies on the Claude harness (reliability, harness tooling, longer context). Volume alone is not a cue — that routes to Gemini; name the harness need. |
| **Session model** — orchestrator only | never spawned | Orchestration, spine decisions, and user interaction stay in the main loop. The session's top-tier model is never multiplied as workers (Fable is the motivating case). |

- **Reviewer ≠ author:** Codex-written code is audited by Opus/Claude; Claude-written artifacts get Codex review. On high-stakes items, add a Gemini verification pass — a third model family, an additional vote on top of the handshake, never a replacement for the primary reviewer.
- **Artifact authoring chain** (non-code deliverables — specs, docs, plans, strategy): Codex takes the upstream generative work (knowledge dump, ideation, strategy, mockups; `codex-xhigh` for hard strategy; RUN it for wide or unfamiliar territory, SKIP for narrow conform-only documents) → Opus authors the deliverable from that raw material → the orchestrator reviews in the main loop. Reviewer ≠ author holds at every link.
- **Explicit pin:** every dispatch names `agentType` or `model` — never inherit. The harness default inherits the main-loop model, which silently multiplies the session model exactly as forbidden above.
- **Writer grant:** ordinary leaves read, search, and report. An explicitly dispatched build or fix worker MAY write the files its prompt names — a writer grant is not an orchestrator grant (the recursion guard is unchanged by it).
- **Per-lane fallback (no env sniffing):** in a session without the relay, an `agentType` spawn fails fast (sub-second) with a contained model error — that fast-fail IS the detector. Mark only that lane down for the session and route its work to Claude tiers: Opus takes coding, Sonnet/Haiku take small tasks. Lanes fail independently (`gemini-flash` can be down while `codex` works). In a Claude-only session led by Opus, a deliberately pinned Opus worker is legitimate — the freedom clause covers it.
- **Skill precedence:** a skill's explicit dispatch instructions (e.g., a pinned `subagent_type: "Explore"`) are a standing stated reason and win; this table fills in whatever the skill leaves unspecified.
- **Standing request:** for `codex` / `codex-xhigh` / `gemini-flash`, this section constitutes the explicit request their agent descriptions gate on.
- **Freedom clause:** defaults, not law — deviate when the cues misfit, with a one-line stated reason.

## Dispatch mechanics

- Claude tiers route via `model:` — the closed enum `sonnet | opus | haiku | fable` (`fable` is in the enum but never pinned for workers — see the session-model row). Codex and Gemini route via the agent type — `subagent_type` on the Agent tool, `opts.agentType` in Workflow scripts: `codex | codex-xhigh | gemini-flash`.
- The Sub-Agent Use rules above (split test, batching, acceptance contract, parent-only fallback) apply to non-Claude leaves too — Codex and Gemini workers also return file:line citations or source URLs.
- For the research and fidelity-audit roles, the trio specs — `.claude/skills/codex-research/SKILL.md`, `.claude/skills/codex-audit/SKILL.md`, `.claude/skills/codex-review/SKILL.md` — are the canonical execution path. Skills are never slash-invoked from sub-agents; the orchestrator applies the spec inline (forge's pattern).

---

# Quality Standards

- **Read before modifying** — Do not propose changes to files you haven't read. Prefer editing existing files over creating new ones.
- **Verify before completing** — prove it works: run tests, run the linter, check logs, diff against the target branch. "I think it works" is not verification.
- **Find root causes** — no band-aids or temporary fixes. Trace symptoms to their source and fix the actual problem.
- **Surgical changes** — keep diffs minimal and scoped to the task. No drive-by features, refactoring, or "improvements" beyond what was asked. When working from an approved plan, changes trace to the plan; otherwise they trace to the user's request.
- **Demand elegance for non-trivial changes** — before implementing, ask "is there a simpler way?" Skip for mechanical or single-line fixes.

---

# Issue Tracking

Issues live on the playbook's own issue board — not TaskCreate or GitHub Issues. Log new issues by appending to `tasks/new-issues.md` (format: `.claude/templates/new-issues.md`, auto-increment the number); the active board is `tasks/issues.md`.

