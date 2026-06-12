# Completed Tasks

> Archived completed tasks. Full bodies findable in git via `git log` on the commits that landed each task.

## Native multi-model agents (2026-06)

The native-agents pair (22 → 23): task 22 shipped the install/auto-boot lane; task 23 added the workflow model-routing layer that allocates work across the agent types task 22 installs.

### 22. Productize native multi-model agents — install + auto-boot lane
Shipped `/native-agents` (install + doctor) and the lane it manages: `codex` / `codex-xhigh` / `gemini-flash` as native subagent types served through a local model-routing relay in front of VibeProxy. Canonical relay template (claude-*→Anthropic verbatim with auth untouched; gpt-*/gemini-*→VibeProxy with credentials stripped; `GET /health` identity JSON with boot-time scriptHash; fail-fast port validation; `RELAY_GEMINI_PORT=8319` toggle for the inert local-only Vertex lane under `templates/native-agents/vertex/`). Fail-closed `claude-native` launcher (port check → identity handshake → hash staleness gate → mkdir-lock-guarded boot via a Node detach helper with 5 MB log rotation → exec) — never auto-kills, lockout structurally impossible since no settings `env` is ever written; `command claude` is always the stock form. Doctor: per-lane live-catalog preflight from installed agent frontmatter, per-type probes (gemini includes tool-use), authoritative relay-log assertion, gemini triage table, model-ID drift checklist, and post-PASS offers — `claude`→`claude-native` alias and global `~/.claude/agents/` install. Docs/distribution: README prereq + subsection, quickref row, playbook-setup Step 3D, playbook-update managed list (9 paths) + re-run-install nudge (the relay security-fix channel), `.claude/agents/` gitignore guard. Dogfooded end-to-end on the dev machine: codex/codex-xhigh PASS via relay-log evidence; gemini lane correctly diagnosed (VibeProxy provider not enabled — the designed acceptance outcome for the ships-untested OAuth lane). Final `/codex-audit` + `/codex-review` over the skill: 14 findings triaged → 9 fixes. Landed as PR #33 squash (`91ae8df`); RDPI artifacts preserved on the PR branch, none on main.

### 23. Multi-model workflow routing — CLAUDE.md Workflow section + recursion-guard upgrade + /forge rewrite
Added a model-routing layer for all delegated work now that Codex/Gemini run as native subagent types. Three pieces. (1) New **Workflow** section in CLAUDE.md governing every agent dispatch (Workflow-tool scripts and plain Agent spawns): cue-based role table — Codex builds essentially all code (`codex-xhigh` for deep-reasoning/contract-defining seams), Opus audits/synthesizes/reviews, Gemini Flash takes volume/repetitive/fetch work, Sonnet takes harness-dependent fan-out, the session model (Fable) orchestrates and is never spawned as a worker — plus the artifact authoring chain (Codex ideation/knowledge-dump → Opus authors → orchestrator reviews), reviewer≠author cross-model handshake, explicit-pin rule (every dispatch names `agentType` or `model`, never inherit), per-lane fast-fail fallback (no env sniffing — a sub-second `agentType` error marks only that lane down), the freedom clause, and a pointer naming the trio SKILLs as the inline execution path. (2) Recursion guard replaced with the non-transitive orchestrator-grant version (parent → orchestrator → leaf; granted only for adaptive investigation, plannable fan-out returns a work-list). (3) `/forge` rewritten from a fixed linear pass into task-shaped, dispatch-led orchestration: piece-agnostic (code or artifact), Frame classifies deliverable type, code Build dispatches to Codex workers, artifact pieces follow the authoring chain, Verify has a per-type form (tests/typecheck for code; fidelity + internal-consistency audit for artifacts), gates stay on `codex exec`. Both CLAUDE.md edits mirrored into `.claude/templates/playbook-sections.md`; README `/forge` row reworded off "model-led single pass." Implemented on `worktree-task-23` (Phases 1–5), Codex review fix applied, installed agent copies synced + verified. Landed as PR #34 squash (`58cdfcf`).

## Codex-trio batch (2026-06)

Standalone Codex skills beyond `/codex-review` — audit (fidelity) and research (grounding) — feeding the `/forge` lane (task 21).

### 19. Add /codex-audit skill — source-grounded fidelity + completeness audit
Added `.claude/skills/codex-audit/SKILL.md` — a source-grounded Codex audit of a target against the source(s) it was built from: fidelity/completeness/precision core lenses plus Claude-composed per-target secondary lenses, Claude-injected sources (never a CLI arg), optional multi-pass `review → triage → apply` loop (`passes` arg; default 1 = recommend-only, cap 5, editable-target guard). Plumbing from `/codex-review` (safe tmp-compose, `-a never exec --sandbox read-only`, output-check, cleanup-before-present); temps under gitignored `tasks/logs/audits/` with per-run-unique tokens. Registered in `/playbook-update`'s managed list + README/quickref rows; `/codex-review` byte-for-byte unchanged. Verified via 29 structural checks and a clean live self-audit run.

### 20. Add /codex-research skill — general-purpose Codex research (codebase + external), auto-invoked
Added `.claude/skills/codex-research/SKILL.md` — third of the Codex trio: general-purpose research/grounding second opinion routing per-request across codebase grounding / misc-generative / external prior-art modes (no fixed menu; `--search` only when routed external). Auto-invocable as a deliberate exception to the manual-invoke convention, bounded by a narrow weighty-OQ `when_to_use` threshold (no count/cap/marker — Option B) plus kept-doc dedup keyed on slug + stored question, with the metadata header as completion marker so failed/partial outputs self-heal. Output is a KEPT doc at `tasks/logs/research/<date>-<slug>.md` (gitignored; only the prompt tmp is cleaned; human-gated promotion to component `docs/` or `docs/research/`). Background `xhigh` Codex run, min-20-line validation, header prepended on success. Registered in `/playbook-update` managed list + README/quickref rows; siblings byte-for-byte unchanged. Verified via the plan's grep/diff acceptance checks plus a live end-to-end smoke run (kept doc survived, prompt tmp cleaned, citations spot-checked).

### 21. Add /forge skill — slim single-pass build lane for strong models (Fable window)
Added `.claude/skills/forge/SKILL.md` — a build lane built for the strong-model window that collapses RDPI into one model-led Frame → Build → optional design-confirm pause → gate-cycle pass for wide generative pieces, with an explicit Pre-Edit Gate override (developer invocation = authorization, cited by section name + operative phrase for portability). Gate cycle inlines the trio by reference-read, never slash-invocation (codex-audit Steps 1–4 at `passes = 1`, codex-review Steps 1–5), findings flowing into shared task-13-bucket triage (A.1 apply / A.2 no-op / B stop / C noise), per-cycle test/typecheck verify, convergence on no-new-critical findings with a ≤2-cycles-per-phase cap (cap exhaustion = needs-developer-review, never silent success). Orchestration: sequential-per-seam delegation, every spawned agent pins its model (no Fable-swarm inherit), Fable/Opus/Sonnet two-sided hierarchy, ≤4 sub-agents per phase / ≤2 concurrent, leaf-only with an explicit leaf-write override for dispatched build/fix agents. Registered in `/playbook-update`'s managed list + README/quickref rows. Originally specced temporary (archive on revert to Opus); made permanent by developer decision the same day it landed — temporary/archive framing stripped from the skill and boards. Verified via the plan's grep/diff acceptance checks (13/13 ACs) plus a zero-findings Codex review.

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
