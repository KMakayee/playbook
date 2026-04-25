# Todo: Playbook skill conversion and upfront-spec improvements

## Source

Freehand — no design document. Derived from (a) the decision to convert playbook slash commands to skills, and (b) a review of the Anthropic engineering blog on upfront specifications.

## Upstream constraints

- Skills default to `disable-model-invocation: true` — playbook workflow skills stay manual-invoke only until the artifact layout supports auto-fire (see Deferred)
- Original `.claude/commands/<name>.md` files stay in place until all skills are verified; deletion is a separate cleanup pass
- No behavioral changes beyond the blog-driven spec improvements called out per-task

## Out of scope

- Deleting `.claude/commands/*.md` files (separate cleanup pass after all skills verified)
- Flipping `disable-model-invocation` to `false` (blocked on artifact restructure — see Deferred)

## Open questions / blockers

- Whether the artifact-restructuring prerequisite behind auto-invocation (see Deferred) is cheap enough to land alongside Task 7. Task 7's research phase should fold in that investigation and surface the answer before planning.

## Dependencies

Task 7 (port to skills) is mechanical and should land **last**, after all behavioral changes have settled — otherwise the port operates on a moving target as Tasks 1, 3, 4, and 6 reshape the command surface. Among the behavioral tasks: Task 3 is the biggest rewrite of the QRSPI commands (`research-codebase`, `design`, `create-plan`, `implement`), so it sequences before Tasks 4 and 5, which patch surgical changes on top of the same surface. Task 4 tightens subagent invocation on top of Task 3's structure; Task 5's `research-codebase` edit is a surgical addition on top of 4 (plus its independent CLAUDE.md and template edits). Task 6 mirrors Task 3's finalized Codex pattern onto the `/issue-*` surface and should land after Task 3. Tasks 2 (new `/codex-review`) and 1 (`/checkpoint`) are independent of the QRSPI-command chain and can run anywhere. Task 1 targets the current artifact layout; if the Deferred restructure later lands alongside Task 7, Task 1's resume logic gets updated then. The Deferred item remains gated on Task 7's research findings.

**Execution order:** top-to-bottom, 1 → 7.

## Tasks

- [ ] 1. **Make `/checkpoint` reliable for suspend and resume** — Rework checkpoint to support two modes: (a) a waypoint inside a QRSPI cycle that automatically captures the current phase and step/batch so a later session resumes at the exact point, and (b) a standalone snapshot usable outside QRSPI for quick saves. State capture must happen automatically — no relying on the user or agent to narrate where they are. Checkpoints commit to git on creation so they double as backups. On resume, the artifact is consumed and deleted after rehydration so stale checkpoints don't accumulate. Motivation: the command today misses workflow position, doesn't work cleanly outside QRSPI, and leaves old artifacts lying around. This also unlocks reliable batching of large plans across multiple implementation sessions — `/checkpoint` becomes the vehicle for suspending between batches. **Before shipping to regular use, run an end-to-end test: create a checkpoint mid-batch, exit the session, resume in a fresh session, and verify that state rehydrates cleanly and the artifact is consumed. Breakage here loses in-flight work silently, so dogfood before promoting to production.**

- [x] 2. **Ship a generalized Codex review entry point** — Add a simple `/codex-review <target>` for ad-hoc second-opinion reviews. Consolidate the unbiased-review principles already encoded across the existing Codex-driven review prompts (research, plan, code review) into one generalized prompt so any target — a file, a diff, an artifact — gets the same framing. Purpose: replace ad-hoc Codex invocations that drift from the principles established elsewhere in the playbook. Keep it simple — no task-lifecycle integration, just a shortcut.

- [ ] 3. **Expand Codex's share of work across QRSPI commands** — Audit `research-codebase`, `design`, `create-plan`, and `implement` and identify where Codex can take on additional lift without displacing Claude's synthesis role. Motivation: Codex credits regularly go unused while Claude continues to carry work that Codex could do better or in parallel. Goal: push more of each phase onto Codex (e.g., additional sweeps, parallel branches, deeper reviews) while preserving the Claude-synthesizes-on-top pattern that already works. Research should prioritize the highest-value expansions per command rather than add Codex work uniformly.

- [ ] 4. **Tighten subagent guidance across QRSPI commands** — Three concrete gaps in how commands delegate to subagents: (a) the split heuristic is vague — there's no testable rule for when to spawn separate subagents vs. one; (b) no fallback behavior is documented for when a subagent returns incomplete or wrong results (re-spawn, read files directly, adjust the prompt?); and (c) Opus 4.7 does not fan out proactively — any command that wants parallel subagent calls must name the parallelism explicitly rather than assume it. Apply across every command that delegates to subagents (notably `research-codebase` and `design`). Purpose: remove the ambiguity that currently causes uneven subagent use in practice.

- [ ] 5. **Enforce upfront specs for Research** — Define the four fields that must accompany any non-trivial task (intent, constraints, acceptance criteria, relevant paths) and propagate them across three surfaces: (a) the `research-codebase` skill should capture acceptance criteria alongside intent in the task block passed to Codex and ask the user once when any field is missing rather than invoking Codex with thin hints; (b) the CLAUDE.md pre-edit gate should require the same four fields before a non-trivial task enters Research as a safety net for prompts that bypass the skill; and (c) `templates/new-issues.md` should grow explicit `Constraints` and `Relevant paths` sections alongside the existing `Acceptance Criteria` so issues are logged with all four fields from the start.

- [ ] 6. **Collapse the `-codex` variants in the issue workflow into integrated commands** — Today the issue flow exposes `issue-research-codex`, `issue-plan-review-codex`, and `issue-code-review-codex` as separate Codex entry points alongside the Claude-driven commands. Collapse each phase into a single integrated command where Codex does the heavy sweeps/reviews and Claude synthesizes on top, mirroring how `/research-codebase`, `/design`, `/create-plan`, and `/implement` already work. Scope is behavioral — the command-to-skill port is Task 7's job; this task changes what each phase *does*, not where it lives. Should inherit whatever expansions Task 3 settles on so the QRSPI flow and the issue flow stay consistent. Also update the `auto-issues` pipeline to drop the now-merged review phases so it doesn't invoke removed commands.

- [ ] 7. **Port all playbook slash commands to skills** — Convert each `.claude/commands/<name>.md` into a skill under `.claude/skills/<name>/`, move supporting files into the skill directory, and update internal references so the skill is self-contained. Verify each converted skill by invoking `/<name>`. During this task's research phase, fold in the Deferred auto-invocation investigation — if the artifact restructure is feasible to land together, skills can ship with auto-invocation enabled rather than deferred.

## Deferred

- [ ] **Enable skill auto-invocation** — Prerequisite: restructure QRSPI artifacts from static singleton files (`tasks/research-codebase.md`, `tasks/plan.md`, etc.) to task-scoped directories. Needed before flipping `disable-model-invocation` to `false`. Investigate naming, active-task tracking, cleanup lifecycle, and reference sites across commands/skills/CLAUDE.md. **Merge into Task 7 research:** this investigation should be folded into Task 7's research phase so the skill port and (if feasible) the artifact restructure can land together.
