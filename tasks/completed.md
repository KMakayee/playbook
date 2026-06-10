# Completed Tasks

> Archived completed tasks. Full bodies findable in git via `git log` on the commits that landed each task.

## Codex-trio batch (2026-06)

Standalone Codex skills beyond `/codex-review` — audit (fidelity) and research (grounding) — feeding the temporary `/forge` lane (task 21).

### 19. Add /codex-audit skill — source-grounded fidelity + completeness audit
Added `.claude/skills/codex-audit/SKILL.md` — a source-grounded Codex audit of a target against the source(s) it was built from: fidelity/completeness/precision core lenses plus Claude-composed per-target secondary lenses, Claude-injected sources (never a CLI arg), optional multi-pass `review → triage → apply` loop (`passes` arg; default 1 = recommend-only, cap 5, editable-target guard). Plumbing from `/codex-review` (safe tmp-compose, `-a never exec --sandbox read-only`, output-check, cleanup-before-present); temps under gitignored `tasks/logs/audits/` with per-run-unique tokens. Registered in `/playbook-update`'s managed list + README/quickref rows; `/codex-review` byte-for-byte unchanged. Verified via 29 structural checks and a clean live self-audit run.

### 20. Add /codex-research skill — general-purpose Codex research (codebase + external), auto-invoked
Added `.claude/skills/codex-research/SKILL.md` — third of the Codex trio: general-purpose research/grounding second opinion routing per-request across codebase grounding / misc-generative / external prior-art modes (no fixed menu; `--search` only when routed external). Auto-invocable as a deliberate exception to the manual-invoke convention, bounded by a narrow weighty-OQ `when_to_use` threshold (no count/cap/marker — Option B) plus kept-doc dedup keyed on slug + stored question, with the metadata header as completion marker so failed/partial outputs self-heal. Output is a KEPT doc at `tasks/logs/research/<date>-<slug>.md` (gitignored; only the prompt tmp is cleaned; human-gated promotion to component `docs/` or `docs/research/`). Background `xhigh` Codex run, min-20-line validation, header prepended on success. Registered in `/playbook-update` managed list + README/quickref rows; siblings byte-for-byte unchanged. Verified via the plan's grep/diff acceptance checks plus a live end-to-end smoke run (kept doc survived, prompt tmp cleaned, citations spot-checked).

## Skill conversion and upfront-spec batch (2026-04 to 2026-05)

Twelve tasks closing out playbook command → skill migration plus blog-driven spec improvements (upfront specs, subagent guidance, Codex expansion across RDPI, background-by-default migration). Task 7 (skill port) landed last so behavioral changes settled first; Tasks 1-6 and 8-12 were the behavioral surface.

### 1. /checkpoint reliable suspend/resume
Reworked checkpoint into (a) waypoint inside RDPI cycle capturing phase/step automatically and (b) standalone snapshot mode. Commits to git on creation; consumed and deleted on resume so stale checkpoints don't accumulate.

### 2. Generalized /codex-review entry point
Shipped `/codex-review <target>` for ad-hoc second-opinion reviews. Consolidated unbiased-review principles from research/plan/code-review prompts into one generalized prompt so any target gets the same framing.

### 3. Expand Codex share across RDPI commands
Audited research-codebase, design, create-plan, implement. Pushed more lift onto Codex (additional sweeps, parallel branches, deeper reviews) while preserving the Claude-synthesizes-on-top pattern.

### 4. Tighten subagent guidance
Closed three gaps in subagent delegation: testable split heuristic, explicit fallback for incomplete results, and explicit parallelism (Opus 4.7 does not fan out proactively). Applied across all commands that delegate to subagents.

### 5. Enforce upfront specs for Research
Defined four required fields (intent, constraints, acceptance criteria, relevant paths) and propagated across the research-codebase skill, CLAUDE.md pre-edit gate, templates/new-issues.md, and the research-guide.md prompt template (added data-flow tracing emphasis in §2).

### 6. Collapse `-codex` variants in issue workflow
Merged issue-research-codex, issue-plan-review-codex, issue-code-review-codex into integrated commands where Codex does heavy sweeps and Claude synthesizes — mirroring the RDPI flow. Updated auto-issues to drop the removed phases.

### 7. Port playbook slash commands to skills
Converted every `.claude/commands/<name>.md` to a skill under `.claude/skills/<name>/`. Resolved the Deferred auto-invocation item NO — side-effect skills stay manual-invoke as permanent posture (Axis 3 = split by weight).

### 8. /catchup command for parallel-worktree catch-up
Added `/catchup` for drift detection → merge default in → conflict guidance → validation hook. Added staleness gate to /push-pr and /push-pr-light. Closed Issue #1 alongside (squash-merge default).

### 9. Reshape /codex-review triage to recommend-only
Step 6 now lists apply items as recommendations, judgment calls as a "needs input" subsection, noise collapsed to a count with show-all opt-in. Cuts the presentation surface to items Claude wants to defend.

### 10. Background-by-default for long-running Codex / claude -p calls
Migrated foreground Codex/claude -p invocations in research-codebase, design (3 sites), create-plan, issue-research, issue-plan, codex-review, and the structural-mismatch paths to `run_in_background: true` with `</dev/null` discipline preserved. Eliminates the silent 10-min cap failure mode.

### 11. Restructure /auto-issues commit/cleanup + add /issue-finish
Moved from per-phase commits to a single end-of-pipeline commit. Added `/issue-finish` for cleanup + deletion commits (mirrors `/finish`). Gitignored `tasks/logs/`. Adopted per-issue worktree (`worktree-issue-<N>`) deployment model. Updated pipeline-eval.sh.

### 12. /implement-codex experiment
Sibling command where Codex drives implementation per-phase and Claude verifies/reviews each phase boundary, then runs the standard Codex code review + triage. Production `/implement` stays the default; experiment promotion criteria documented up front.

### Deferred — skill auto-invocation (RESOLVED: NO)
Side-effect / singleton-artifact-writing workflow skills stay manual-invoke (`disable-model-invocation: true`) permanently. The Axis 6 artifact restructure was investigated in Task 7 research and not pursued — the docs recommend manual-invoke for side-effect workflows, so the restructure's only payoff (safe auto-invocation) is something these skills should not have anyway.
