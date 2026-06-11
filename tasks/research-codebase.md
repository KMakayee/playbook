# Research: Task 21 — Add /forge skill (slim single-pass build lane for strong models)

## Research Question

Add a new skill `/forge` (`.claude/skills/forge/SKILL.md`): a deliberately thin, **temporary** build lane that collapses RDPI's Research/Design/Plan/Implement-design into one model-led pass for wide, generative tasks, then verifies with the Codex trio (`/codex-audit` fidelity gate → `/codex-review` merit gate), applies triaged fixes via inline bucket logic, and verifies with tests/typecheck. Built for a ~2-week strong-model window (Fable, through ~2026-06-24); archived (not folded into RDPI) on revert to Opus. Governing principle: **scaffolding scales inversely with model strength.**

Lane shape: **Frame** (read source piece fully; 3-line intent + AC; no Codex) → **Build** (one freeform model-led pass, design + code together; no axis/option matrix; may self-summon `/codex-research`-style grounding) → optional **design-confirm pause** (default ON for load-bearing pieces) → **Gate 1 fidelity** (inline `/codex-audit`) → **Gate 2 merit** (inline `/codex-review`) → **apply triaged fixes** (inline bucket logic, agent-hierarchy routing) → **verify** → present. Gates RUN/SKIP per piece; may loop to convergence (stop on no new *critical* findings, max-passes cap). Wide pieces split at natural seams with compaction + an emitted continuation prompt between phases (Multi-Batch / checkpoint light-handoff pattern, no new format). Workflow orchestration allowed — invoking `/forge` is the Workflow opt-in; Fable orchestrates and owns the spine design; every spawned agent pins its model explicitly; sub-agents are leaf.

### Upfront spec

**Intent** *(supplied)*: as above — full text at `tasks/todo.md:394`.

**Constraints** *(supplied, `tasks/todo.md:417-423`)*:
- Temporary/disposable; thin (~50-line target); archived on revert, not folded into RDPI.
- **Inlined, not invoked** — skills cannot runtime-invoke slash commands (`checkpoint/SKILL.md:180`); `/forge` inlines the trio's logic using their SKILL.md files as canonical reference specs; trio stays independently runnable; reuse shared plumbing (safe tmp-compose, `codex -a never exec --sandbox read-only`, `codex-output-check.sh`, cleanup-before-present).
- Independence on verification, not input — no fixed front-of-lane Codex sweep; self-summon only.
- Bounded-surface rule — direct-read only while the surface fits comfortably in context; sprawling surface → summon grounding.
- Manual invocation (`disable-model-invocation: true`).
- Purely additive — RDPI and every existing skill unchanged.

**Acceptance criteria** *(supplied)*: 13 items at `tasks/todo.md:429-442` — skill exists thin + temporary-note (1); single model-led pass, no option matrix, source read fully (2); self-summon research, no fixed sweep (3); design-confirm pause default ON for load-bearing (4); inline audit-then-review gates, RUN/SKIP each, inline-triage fixes (5); verify via tests/typecheck (6); reuse shared plumbing (7); RDPI + existing skills unchanged, `/playbook-update` managed list accounts for the skill (8); seam-split phasing with continuation prompts, no new handoff format (9); Workflow fan-out with every agent's model pinned, `/forge` invocation = Workflow opt-in (10); routing hierarchy by orchestrator judgment — Fable spine/orchestrator, Opus straightforward phases + bounded fixes, Sonnet reads + trivial writes (11); hard agent cap, leaf-only sub-agents (12); gate loops to convergence with max-passes cap (13).

**Relevant paths** *(supplied)*: new `.claude/skills/forge/SKILL.md`; reference specs `.claude/skills/codex-audit/SKILL.md`, `.claude/skills/codex-review/SKILL.md`, `.claude/skills/codex-research/SKILL.md`, task-13 triage spec (`tasks/todo.md:23-78`, NOT landed); plumbing `.claude/scripts/codex-output-check.sh`; handoff `.claude/skills/checkpoint/SKILL.md` + CLAUDE.md Multi-Batch rule; orchestration = Workflow tool + `CLAUDE.md:178` recursion guard; target use case `~/Projects/Omakase/omk-core/docs/fp-rebuild/` Step-9 files; `/playbook-update` managed list.

## Summary

Everything `/forge` composes already exists and is verified on disk: both gates and the summonable research lane landed as full skills (184 / 136 / 190 lines), the shared plumbing is real, and the Workflow/Agent APIs support every routing requirement the spec makes (model pinning incl. `fable`, worktree isolation, budget accessors, skill-invocation-as-opt-in). The research surfaced four things design must reckon with that the task spec doesn't fully anticipate:

1. **The ~50-line target is unreachable by self-containing; reference-style composition is forced.** The trio totals 510 lines for the three behaviors `/forge` needs. The viable shape is `/forge` as orchestration spine that *reads the trio SKILL.mds at runtime as reference specs* (file reads are legal; only slash-invocation is barred) — which also keeps the temps in each skill's proven scheme.
2. **The Pre-Edit Gate conflict is real and unaddressed.** `CLAUDE.md:98` unconditionally forbids Edit/Write on non-trivial work without RDPI artifacts, and the RDPI rules block is marked "fixed, do not modify." Codex paraphrased a "sanctioned alternate lane" exemption into the gate that does not exist. `/forge` violates the gate's letter on every non-trivial run; design must pick a coexistence mechanism (CORRECTION to Codex's report).
3. **The apply mechanism is effectively decided by the evidence.** Child `claude -p` is triple-condemned: open issue #7 wants it gone (`tasks/new-issues.md:205`), the auto-mode classifier blocks it on this machine (memory), and `issue-implement:154` + `codex-audit:130-134` prove inline parent apply works. Recommend-only contradicts AC5. Inline parent apply is the only standing choice; the genuine residual freedom is bucket *vocabulary* (task-13's A.1/A.2/B/C vs the landed trio's apply/judgment-call/noise).
4. **The archive axis has a cleaner option than the task imagined**: `skillOverrides: {"forge": "off"}` in settings (documented four-state visibility control) — and registration breadth couples directly to archive cost: a never-registered local skill needs no `playbook-removals.md` entry and never propagates to consumer repos.

The target use case is comfortably bounded: the five Step-9 spine files total 1,491 lines (~1,523 with README) — trivially direct-readable, with natural seams already marked by the docs' own file boundaries.

## Detailed Findings

### Gate 1 reference spec — /codex-audit (184 lines, landed task 19)

- Target resolution: explicit `$ARGUMENTS` or inferred from context; trailing integer parses as `passes` (default 1, **cap 5 clamped**, 0/negative rejected) — `codex-audit/SKILL.md:19-28`.
- Sources are never a CLI arg — Claude injects them into the composed prompt (on-disk paths as bullets; chat-only content inline) — `codex-audit/SKILL.md:30,90-93`. For `/forge`: target = freshly built code, sources = the spine docs; the mapping is direct.
- Per-run unique temp token (`slug+date+random`, no `$$`/command-substitution — each Bash call is a separate shell) under gitignored `tasks/logs/audits/<run>-*.tmp`; pre-delete with `find`; cleanup-before-present — `codex-audit/SKILL.md:38-46,152-158`.
- Multi-pass mechanic: pass = run Codex → verify output → triage → apply → regenerate prompt (only if another pass remains); next pass re-reads corrected on-disk target — `codex-audit/SKILL.md:104-146`. Single pass is recommend-only; multi-pass applies on every pass. Editable-target guard: non-writable target downgrades `effective_passes` to 1 — `codex-audit/SKILL.md:101-102`.
- Between-pass triage vocabulary: **apply / judgment call / noise** (`codex-audit/SKILL.md:127-134`) — deliberately interim, chosen to avoid pre-committing to task-13's A.1/A.2/B/C (`tasks/todo.md:68`).
- Prompt lens structure: Fidelity / Completeness / Precision + Claude-composed secondary lenses — `codex-audit/SKILL.md:59-86`.

### Gate 2 reference spec — /codex-review (136 lines, pre-existing)

- Accepts file | diff | artifact | description; safe tmp-compose (prompt body to tmp, read via `"$(cat ...)"` — shell-quoting hazard protection) — `codex-review/SKILL.md:14-15,35`.
- **Fixed tmp names** `tasks/codex-review.tmp` / `-prompt.tmp` — collision-prone on concurrent runs, logged as issue #6 (`tasks/new-issues.md:164`). Do not copy this part.
- Output: three lens headers (Factual/correctness, Simplest-approach, Pattern/best-practice) with **factual issue** / **judgment call** labels — `codex-review/SKILL.md:62`.
- Triage (Step 6) is **recommend-only — never edits files** (`codex-review/SKILL.md:116-126`); noise is collapsed to a count with `show all` opt-in. `/forge`'s gate must diverge here: AC5 requires fixes applied.
- Cleanup-before-present is load-bearing (interactive offer would strand temps) — `codex-review/SKILL.md:88-94`.

### Summonable grounding reference spec — /codex-research (190 lines, landed task 20)

- Three blendable routes (codebase grounding / misc-generative / external prior-art); `--search` only when routed external — `codex-research/SKILL.md:12-16,46`.
- Output is a **KEPT doc** at `tasks/logs/research/<date>-<slug>.md` with a metadata header as completion marker; only the prompt tmp is cleaned; dedup keyed on slug + stored question — `codex-research/SKILL.md:48-67,144-168`. A `/forge` self-summon therefore leaves a persistent, reusable doc — useful across forge phases (phase N+1 can re-read it instead of re-summoning).
- It is the trio's deliberate auto-invoke exception (no `disable-model-invocation`, narrow `when_to_use` gate) — `tasks/completed.md` task-20 record.

### Fix-apply plumbing and its known failure

- `/implement` writes `tasks/code-review-fixes.tmp` then spawns `claude -p ... --dangerously-skip-permissions` (`implement/SKILL.md:125,150-155`); `/implement-codex` same with `-implement` suffix (`implement-codex/SKILL.md:421,448`). `/issue-implement` applies **inline in the parent, no child** (`issue-implement/SKILL.md:134,154`).
- Issue #7 (`tasks/new-issues.md:205`) proposes dropping the child process entirely; established memory: the auto-mode permission classifier denies the child on this machine. The `code-review-fixes*.tmp` artifact exists *for* the child handoff — inline apply needs no fix file at all.

### Lifecycle / registration surfaces

- `/playbook-update` managed list (`playbook-update/SKILL.md:15-55`) is **enumerated per-path, no globs** — a new skill must be added explicitly. `quickref.md` is managed; **README.md is not in the managed list** (refines Codex's claim).
- README (`README.md:69-79`) and quickref (`quickref.md:41-53`) both enumerate skills as table rows; tasks 19/20 each registered in managed list + README + quickref (`tasks/completed.md` records).
- Removal path: `.claude/playbook-removals.md` — entries added when a *previously managed* file is renamed/deleted; read from playbook source by `/playbook-update` Step 2.5; entries dropped after ~6 months. A never-managed skill needs no entry.
- `playbook-setup` global-install list (`playbook-setup/SKILL.md:106-121`) covers four utility skills only — no change needed for `/forge`.
- No transient/temporary-skill notion exists anywhere in the lifecycle tooling.

### Phasing / handoff substrate

- Multi-Batch Plans rule (`CLAUDE.md:142`): one batch per prompt, compact between — the pattern AC9 reuses.
- Current `/checkpoint` is the heavy git-committed `tasks/checkpoint.md` (YAML frontmatter + embedded diff, committed on create, `git rm` on resume) — `checkpoint/SKILL.md:161-207`. The light log-based format is task 17 — **not landed**; pre-adopting its format would be inventing a format that doesn't exist yet.
- The slash-invocation wall: "a slash command cannot programmatically invoke another slash command" — `checkpoint/SKILL.md:180`.

### Pre-Edit Gate tension (Codex CORRECTION)

`CLAUDE.md:98`: "Do not call Edit or Write on source files until either (a) the task is trivial, or (b) `tasks/research-codebase.md` exists, the design … is finalized, and `tasks/plan.md` is approved." Unconditional; the surrounding RDPI block says "These rules are fixed. Do not modify them." Codex's report claimed the gate allows "a sanctioned alternate lane" — **no such language exists**. Every non-trivial `/forge` run breaches the gate's letter. See Axis 12.

### Target use case (omk-core fp-rebuild)

- `docs/blueprint/pieces/contracts.md` **does not exist**; no `docs/blueprint/` dir (verified). The load-bearing surface is the five Step-9 files named in `docs/fp-rebuild/README.md`: design-digest (197), design-fp-rebuild (859), mvp-build-slice (225), frozen-skeleton (80), carried-to-build (130) = **1,491 lines** (Codex's 1,523 included the README). The "contracts" the task mentions live inside the frozen-skeleton's "5 named contracts" — a piece *within* these docs, not a separate file.
- Natural seams pre-exist: digest → skeleton/contracts → design body → MVP slice + carried-to-build map cleanly onto per-phase boundaries.
- omk-core `/codex-do` sibling pattern: read doc/section, snapshot baseline, scoped checks, no commits.

## Code References

- `tasks/todo.md:392-467` — task 21 full spec; `tasks/todo.md:23-78` — task 13 triage spec (bucket logic to inline)
- `.claude/skills/codex-audit/SKILL.md:24-28,38-46,101-102,104-146,152-158` — passes parse/cap, run-token temps, editable-target guard, pass loop, cleanup
- `.claude/skills/codex-review/SKILL.md:30,35,62,70-73,88-94,110-126` — fixed tmps, safe compose, lenses, invocation, cleanup-before-present, recommend-only triage
- `.claude/skills/codex-research/SKILL.md:12-16,22-29,46,48-67,144-168` — routes, auto-fire gate, --search, dedup, kept-doc lifecycle
- `.claude/scripts/codex-output-check.sh:1-23` — args `<path> [min-lines=5]`; checks existence + line count only
- `.claude/skills/implement/SKILL.md:125,150-155` / `implement-codex/SKILL.md:421,448,470` / `issue-implement/SKILL.md:134,154` — child-process vs inline apply precedents
- `.claude/skills/playbook-update/SKILL.md:15-55,269` — enumerated managed list; maintainer-artifact check
- `.claude/playbook-removals.md:1-26` — orphan-removal manifest and propagation
- `.claude/skills/checkpoint/SKILL.md:161-207,180` — current heavy checkpoint; slash-invocation wall
- `CLAUDE.md:98` — Pre-Edit Gate; `CLAUDE.md:142` — Multi-Batch Plans; `CLAUDE.md:178` — recursion guard
- `tasks/new-issues.md:127,164,205` — issues #5 (output-check weaknesses), #6 (tmp collisions), #7 (drop child claude -p)
- `.gitignore:6` — `tasks/logs/` ignored

## Architecture Analysis

The playbook's composition idiom is **inline-by-reference, never invoke**: skills are leaf workflows; cross-skill reuse happens by treating a sibling SKILL.md as a canonical spec the running skill applies (task 13 formalized the vocabulary: "wire into X" = apply X's logic inline). The trio was explicitly built as reference specs for this (task 19/20 completion records). Shared plumbing converged on: compose prompt → tmp file → `codex -a never exec --sandbox read-only -o out "$(cat prompt)" </dev/null` (background) → `codex-output-check.sh` → read fully → spot-check citations → clean before presenting. Two temp philosophies coexist: fixed top-level names (codex-review — older, collision-prone, issue #6) and per-run tokens under gitignored `tasks/logs/<area>/` (codex-audit — newer, the direction of travel). Artifact lifecycle is centralized: anything persistent must be known to `/finish`, `/playbook-audit`, `/checkpoint`; the trio deliberately avoids persistent artifacts (or keeps them in gitignored `tasks/logs/`) to stay out of those lists — `/forge` should do the same.

Frontmatter survey: 22 of 24 skills set `disable-model-invocation: true`; only `codex-review` and `codex-research` omit it (advisory/read-only or deliberate auto-fire exception). `/forge` is side-effecting → flag required, matching convention.

## Design Axes

### Axis 1: Skill body composition
- **Choices:** (a) **reference-canonical** — `/forge` carries the lane spine only and instructs reading the trio SKILL.mds at runtime, applying their steps with stated deltas ("apply codex-audit Steps 2–5 with target=built code, sources=spine docs"); (b) **self-contained** — condensed copies of the trio's prompts/recipes inside `/forge`; (c) **hybrid** — inline one-paragraph gate recipes + pointer to canonical files for the full mechanic.
- **Per-axis constraints:** no runtime slash invocation (`checkpoint/SKILL.md:180`); trio independently runnable; ~50-line target; "no duplicated machinery beyond what inline-not-invoke forces" (AC7). File-reads of sibling SKILL.mds are legal — the wall is invocation, not reading.
- **Evidence:** trio sizes 184/136/190 (`wc`, agent extraction); task's own lean note: "inline-reference 19 … self-contain the rest if 20/13 lag" (`tasks/todo.md:459`) — moot now that 19/20 landed.

### Axis 2: Discovery grounding & bounded-surface threshold
- **Choices:** (a) direct-read with a **numeric context threshold** for when to summon (codebase precedent: CLAUDE.md's 30–35% compaction trigger / ~40% Dumb Zone); (b) direct-read with qualitative judgment ("fits comfortably"); (c) size-of-surface heuristic (line/file count of the piece's source set).
- **Per-axis constraints:** no fixed front sweep (hard); source piece itself always read fully (AC2); summon output is a kept doc under `tasks/logs/research/` (persists across phases).
- **Evidence:** `CLAUDE.md:154-160`; `codex-research/SKILL.md:12-16`; target surface 1,491 lines ≈ well under any threshold. Note: the Fable session window is 1M tokens (model id `claude-fable-5[1m]`), so the 30–35% *relative* trigger is far more generous in absolute terms during exactly the window `/forge` lives in.

### Axis 3: Design-confirm pause control
- **Choices:** (a) Claude classifies load-bearing vs conform-only and defaults ON/OFF accordingly, announcing the call; (b) explicit flag/argument; (c) always pause.
- **Per-axis constraints:** spec pins "default ON for load-bearing pieces" (`tasks/todo.md:399`); the pause is the lane's only human design gate (replaces `/create-plan` approval).
- **Evidence:** `tasks/todo.md:399,433`; precedent for judgment-over-menu: codex-audit/research "compose, never menu" philosophy (`codex-research/SKILL.md:12`).

### Axis 4: Gate RUN/SKIP expression
- **Choices:** (a) Claude judgment from the piece's role, announced before running; (b) explicit flags in `$ARGUMENTS`; (c) fixed policy table in the skill (contracts→both, conform-only→audit-only/none).
- **Per-axis constraints:** audit before review (ordering fixed); both gates optional per piece (AC5).
- **Evidence:** `tasks/todo.md:400-404,458`; argument-parsing precedent `codex-audit/SKILL.md:24-28`.

### Axis 5: Gate convergence shape
- **Choices:** (a) per-gate loops, each reusing codex-audit's pass mechanic (audit loops natively; review gets the same review→triage→apply→re-run wrapper); (b) one combined audit+review convergence loop (alternate gate types per pass); (c) audit-loop + single-shot review (review has no loop precedent; keep it one-pass).
- **Per-axis constraints:** stop = no new *critical* findings (nits OK); max-passes cap required (AC13); codex-audit's cap is 5, clamped (`codex-audit/SKILL.md:27`); loop runs at orchestrator level (recursion guard makes build/gate/fix separate leaf dispatches).
- **Evidence:** `codex-audit/SKILL.md:104-146`; `tasks/todo.md:406`; `codex-review/SKILL.md` (no loop machinery — choice (a) for review means new machinery, in tension with AC7).

### Axis 6: Fix-apply mechanism & bucket vocabulary
- **Choices (mechanism):** inline parent apply is effectively forced — child `claude -p` is blocked by the auto-mode classifier (memory), targeted for removal (issue #7, `tasks/new-issues.md:205`), and recommend-only contradicts AC5. Inline precedents: `issue-implement/SKILL.md:154`, `codex-audit/SKILL.md:130-134`.
- **Choices (vocabulary):** (a) task-13's A.1 auto-fix / A.2 verified no-op / B tradeoff-stop / C not-legit (AC5 names task 13 as the spec); (b) the landed trio's interim apply / judgment-call / noise (consistency with on-disk skills; task 13 will sweep-reconcile later per `tasks/todo.md:68`).
- **Per-axis constraints:** B-items stop for developer input (the posture, regardless of labels); "Codex confidence is not evidence" carries over; no `code-review-fixes*.tmp` needed for inline apply.
- **Evidence:** `tasks/todo.md:25-36,68`; `codex-review/SKILL.md:110-113`.

### Axis 7: Temp artifact scheme
- **Choices:** (a) per-run unique token under a new `tasks/logs/forge/` (clones codex-audit's proven scheme); (b) inherit each inlined skill's own scheme (audit temps in `tasks/logs/audits/`, review temps at `tasks/codex-review*.tmp`); (c) fixed top-level `tasks/forge-*.tmp`.
- **Per-axis constraints:** cleanup-before-present; `tasks/logs/` gitignored (`.gitignore:6`); fixed names carry logged collision risk (issue #6) — (c) is dominated; nothing persistent may be invisible to `/finish`/`/playbook-audit` (gitignored logs are exempt).
- **Evidence:** `codex-audit/SKILL.md:38-46`; `codex-review/SKILL.md:30`; `tasks/new-issues.md:164`.

### Axis 8: Phase handoff vehicle
- **Choices:** (a) emitted ready-to-run continuation prompt in conversation only (pure Multi-Batch pattern — operator compacts and pastes); (b) (a) plus optional current `/checkpoint` for overnight/cross-session gaps (heavy: commits `tasks/checkpoint.md`); (c) pre-adopt task-17's light `.log` brief format.
- **Per-axis constraints:** "no new handoff format" (AC9) — (c) would *create* the format before task 17 designs it, a dependency inversion; continuation carries settled spine decisions + remaining phases, never raw file contents.
- **Evidence:** `CLAUDE.md:142`; `checkpoint/SKILL.md:161-207`; task 17 not landed (`tasks/todo.md:260`).

### Axis 9: Orchestration vehicle & cap policy
- **Choices (vehicle):** (a) Workflow tool script (deterministic loops, per-agent `model` pin, `budget` accessors); (b) plain Agent-tool calls from the main loop (sequential per-seam fits naturally; no budget API); (c) hybrid — Agent calls for sequential seams, Workflow only when genuinely parallel independent phases exist (which then need `isolation: 'worktree'`).
- **Choices (cap):** fixed N; budget-scaled (`budget.total ? floor(total/X) : N` — only available under Workflow); per-phase vs per-run.
- **Per-axis constraints:** every spawned agent pins its model — note the harness's own guidance *defaults to omitting* `model` (inherit), so the skill text must counter-instruct explicitly; spine design never delegated; one sub-agent per seam; leaf-only (`CLAUDE.md:178`); skill-instructed Workflow use is a documented opt-in path (verified first-hand).
- **Evidence:** Workflow tool spec (this session, first-hand): `agent(prompt, {model: 'sonnet'|'opus'|'haiku'|'fable', isolation: 'worktree', ...})`, concurrency min(16, cores−2), 1,000-agent lifetime cap, `budget.total/spent()/remaining()`; Agent tool has the same `model` enum. Resolves Codex's "Workflow API not verifiable locally" RISK.

### Axis 10: Registration breadth
- **Choices:** (a) full — managed list + README + quickref rows (the task-19/20 precedent); (b) partial — quickref/README rows for discoverability, NOT in managed list (no propagation to consumer repos); (c) local-only — no registration anywhere, skill exists only in this repo's tree.
- **Per-axis constraints:** AC8 says the managed list "accounts for" the skill — satisfiable by an explicit recorded decision *not* to manage a transient skill, but design must justify reading it that way or register fully; managed list is enumerated, not globbed (`playbook-update/SKILL.md:15-55`).
- **Evidence:** `tasks/completed.md` task-19/20 records (both registered fully); `playbook-removals.md:7-10` (only previously-managed files need removal entries).

### Axis 11: Archive mechanism (on revert to Opus)
- **Choices:** (a) delete the skill dir (+ `playbook-removals.md` entry iff it was managed; git history preserves it); (b) `skillOverrides: {"forge": "off"}` in `.claude/settings.json` — documented four-state visibility control, hides from model and menu without touching files; (c) move to `.claude/skills/_archive/forge/` — confirmed effective (skill names derive from the immediate child dir of `.claude/skills/`; nested dirs are not discovered), but undocumented as an archival convention.
- **Per-axis constraints:** "archived, not folded into RDPI"; memory `project_fable_window_forge` already tracks the archive obligation.
- **Evidence:** https://code.claude.com/docs/en/skills.md (discovery + `skillOverrides` states, fetched 2026-06-10); `playbook-removals.md:9` (entries dropped after ~6 months).

### Axis 12: Pre-Edit Gate coexistence
- **Choices:** (a) document inside `/forge` that explicit developer invocation of the skill *is* the authorization — the skill's instructions supersede the default gate for the session (skill-text-as-override; no CLAUDE.md edit); (b) additive CLAUDE.md sentence outside the fixed RDPI block (e.g., near the top half) naming `/forge` a sanctioned lane — but the gate itself sits *inside* the "fixed, do not modify" block, and the task says every existing skill + RDPI unchanged; (c) accept the latent contradiction undocumented.
- **Per-axis constraints:** `CLAUDE.md:98` is unconditional; RDPI block self-declares immutable; AC8 "RDPI … unchanged."
- **Evidence:** `CLAUDE.md:96-98`; CORRECTION — Codex's claimed "sanctioned alternate lane" exemption does not exist in the file.

## Axis Coupling

- **If Axis 1 = (a) reference-canonical → Axis 7 narrows to (b)** inherit-inlined-schemes (applying codex-audit's steps as written lands temps in `tasks/logs/audits/` with run tokens). **If Axis 1 = (b) self-contained → Axis 7 should be (a)** own run-token scheme — copying codex-review's fixed names imports issue #6.
- **If Axis 5 = (a) per-gate loops → AC7 tension**: a review-gate loop is new machinery (codex-review has none); (c) audit-loop + one-shot review avoids it; (b) combined loop reuses one wrapper for both.
- **If Axis 6 vocabulary = A.1/A.2/B/C → mild inconsistency with the landed trio's interim vocabulary** until task 13's sweep reconciles them (`tasks/todo.md:68`); if = interim vocabulary, `/forge` joins the set task 13 must later sweep.
- **If Axis 9 = (b) plain Agent calls → budget-scaled cap is off the table** (no `budget` API outside Workflow) → Axis 9 cap narrows to fixed-N.
- **If Axis 10 = (c) local-only → Axis 11 narrows to plain delete** (no removals entry — never managed; no consumer-repo cleanup). **If Axis 10 = (a) full → Axis 11 = (a) requires a removals entry + README/quickref row removal**; (b) `skillOverrides` leaves managed files in place (consumer repos would still receive a hidden skill — messy).
- **If Axis 3 = judgment and Axis 4 = judgment → consistent control surface** (one announcement pattern); mixing judgment and flags across the two pauses doubles the skill's argument-parsing text (pressure on the line budget).
- **If Axis 8 = (c) pre-adopt task-17 format → blocked**: format doesn't exist; would invert the 17→21 dependency the board says doesn't exist (`tasks/todo.md:453`).

## Cross-Cutting Constraints

- Frontmatter: `name: forge`, `description`, `argument-hint: '[piece — source path or "description"]'`, `disable-model-invocation: true` (22-of-24 convention; only advisory skills omit it).
- Shared Codex invocation idiom: prompt → tmp via Write (shell-quoting safety), `codex -a never exec --sandbox read-only -o <out> "$(cat <prompt>)" </dev/null`, background run, `codex-output-check.sh` gate, read fully, spot-check citations, cleanup-before-present. `model_reasoning_effort=xhigh` is used by research-grade sweeps; gates at default effort per trio precedent.
- `codex-output-check.sh` checks existence + line count only; known false-pass weaknesses (issue #5, `tasks/new-issues.md:127`) — spot-checking Codex citations stays mandatory.
- No commits/pushes from the skill (trio + sibling `/codex-do` convention); verify step runs tests/typecheck before presenting (AC6) — target repo's commands discovered at Frame time (omk-core for the immediate use case).
- Purely additive: zero edits to existing skills; CLAUDE.md edit only if Axis 12 = (b) and only outside the fixed block.
- Recursion guard (`CLAUDE.md:178`): build, gate-run, and fix-apply are separate leaf dispatches; only the orchestrator loops.
- Codex CLI 0.137.0 verified; all required flags present.

## External Research

- **Claude Code skills docs** — project skills load from `.claude/skills/`; `SKILL.md` required; `disable-model-invocation: true` blocks model auto-invocation; `user-invocable: false` hides from menu; `skillOverrides` settings provide four visibility states incl. `"off"` (hidden from model and menu). Source: https://code.claude.com/docs/en/skills.md (fetched 2026-06-10). **Unblocks:** Axis 11 choice (b); frontmatter constraints.
- **Skill discovery depth** — skill command names derive from the immediate child directory of `.claude/skills/`; `.claude/skills/_archive/forge/SKILL.md` is not discovered (docs describe `<name>/SKILL.md` layout; nested-`.claude/skills/` discovery is a different mechanism for subdirectory trees). Source: https://code.claude.com/docs/en/skills.md §automatic-discovery. **Unblocks:** Axis 11 choice (c) — viable but undocumented as a convention.
- **Workflow tool API (verified first-hand in this session — stronger than docs):** `agent(prompt, {model, isolation: 'worktree', agentType, schema})` with model enum including `fable`; default is *inherit main-loop model* (confirming the task's inherit-trap warning — and the harness guidance actively recommends omitting `model`, so `/forge` must counter-instruct); concurrency cap min(16, cores−2); 1,000-agent lifetime cap; `budget.total/spent()/remaining()`; skill-instructed Workflow use is an explicit documented opt-in path ("the user invoked a skill … whose instructions tell you to call Workflow"). **Unblocks:** Axis 9 (all choices implementable; budget-scaled cap requires Workflow; AC10's opt-in claim is platform-valid). Resolves Codex's §6 RISK about the unverifiable Workflow surface.
- **Sub-agents docs** (Codex, corroborated by session tool schema) — model aliases sonnet/opus/haiku/fable; per-invocation override; subagents cannot spawn subagents. Source: https://code.claude.com/docs/en/sub-agents. **Unblocks:** Axis 9 choice (b).

## Risk Analysis

- **Line-budget blowout.** 13 ACs spanning gates, routing, phasing, convergence, and triage against a ~50-line target; codex-audit needs 184 lines for one gate alone. Even reference-style composition with terse deltas will strain 50 lines — expect the design to either accept ~80–120 lines or aggressively delegate to the canonical specs. Treat 50 as a forcing function, not a hard AC (AC1 says "thin," the constraint says "~50 target").
- **Pre-Edit Gate contradiction ships latent** if Axis 12 = (c): a future session could refuse `/forge` work citing `CLAUDE.md:98`, or worse, silently start RDPI. The gate text binds every session in this repo *and* in consumer repos if the skill propagates (couples to Axis 10).
- **Gate-loop cost runaway**: each audit pass is a full Codex call; convergence judgment ("no new critical findings") is subjective across passes. The cap (≤5 per codex-audit precedent) bounds it, but two looping gates compound — worst case ~10 Codex calls, *exceeding* RDPI's ~6 and defeating the lane's purpose. Design should set a combined budget, not just per-gate caps.
- **`codex-output-check.sh` false-passes** (issue #5) — a whitespace-padded weak gate output could pass the line check; citation spot-checks are the real gate.
- **Model-pin discipline erosion**: the harness's own Workflow guidance recommends omitting `model` (inherit). A casually-written `/forge` instruction loses the conservation property the task exists to protect. The pin rule needs to be stated as a hard rule in the skill, with the rationale.
- **Stale target reference**: the task's `contracts.md` path doesn't exist; first real run must Frame against the Step-9 files (the "5 named contracts" live in `step-9-frozen-skeleton-fp-rebuild.md`). Low risk — Frame reads the source fully and would discover this — but the skill's argument examples shouldn't cite the dead path.
- **Codex line-count nitpick**: Codex reported the spine at 1,523 lines (included the README); the five files are 1,491. No axis impact.

## Open Questions

Genuine design-phase decisions (research found no further facts that settle them):

1. **Load-bearing classification** for the design-confirm default (Axis 3): what makes a piece load-bearing — contract-defining vs contract-conforming is the obvious line; needs a crisp sentence in the skill.
2. **Opus-boundary severity line** (Axis 9 / task OQ): what makes a phase "straightforward" enough for an Opus build agent, and a gate fix "bounded" enough to route down vs applying inline as A.1. Orchestrator judgment per the spec — but the skill needs one guiding sentence.
3. **Seam heuristic** (task OQ): per contract group / module boundary discovered at Frame. The Step-9 docs suggest doc-boundary seams for the immediate use case; whether the phase plan is operator-gated (Multi-Batch style) or auto-chosen is a design call.
4. **Combined gate budget** (from Risk Analysis): per-gate caps alone don't bound total Codex spend; design should pick a per-run ceiling (e.g., total Codex calls ≤ N) to honor the ~1–2-call net-cost intent (`tasks/todo.md:404`).
5. **AC8 reading under Axis 10 (b)/(c)**: if design chooses partial/local-only registration, confirm with the developer that "managed list accounts for the new skill" is satisfied by a recorded opt-out decision rather than a list entry.
