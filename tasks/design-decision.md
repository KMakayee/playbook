# Design: Task 21 — /forge skill (slim single-pass build lane for strong models)

## Context

Add a new skill `/forge` (`.claude/skills/forge/SKILL.md`): a deliberately thin, **temporary** build lane that collapses RDPI's Research/Design/Plan/Implement into one model-led pass for wide, generative tasks, then verifies with the Codex trio (audit fidelity gate → review merit gate), applies triaged fixes inline, and verifies with tests/typecheck. Built for a ~2-week strong-model window (Fable, through ~2026-06-24); archived (not folded into RDPI) on revert to Opus. Governing principle: scaffolding scales inversely with model strength.

Lane shape: **Frame** (read source piece fully; 3-line intent + AC; no Codex) → **Build** (one freeform model-led pass, design + code together; no axis/option matrix; may self-summon `/codex-research`-style grounding) → optional **design-confirm pause** (default ON for load-bearing pieces) → **Gate 1 fidelity** (inline `/codex-audit`) → **Gate 2 merit** (inline `/codex-review`) → **apply triaged fixes** → **verify** → present. Gates RUN/SKIP per piece; may loop to convergence (stop on no new *critical* findings, max-passes cap). Wide pieces split at natural seams with compaction + an emitted continuation prompt between phases. Workflow orchestration allowed — invoking `/forge` is the Workflow opt-in; every spawned agent pins its model explicitly; sub-agents are leaf.

Hard constraints: skills cannot runtime-invoke slash commands — trio logic is inlined by reading their SKILL.md files as canonical reference specs; trio stays independently runnable; reuse shared plumbing (safe tmp-compose, `codex -a never exec --sandbox read-only`, `codex-output-check.sh`, cleanup-before-present); no fixed front-of-lane Codex sweep (self-summon only); manual invocation (`disable-model-invocation: true`); purely additive — RDPI and every existing skill unchanged; ~50-line target treated as a forcing function ("thin" is the AC).

Acceptance criteria: 13 items at `tasks/todo.md:429-442` — see research for the full extraction.

**Research:** `tasks/research-codebase.md`

## Options Considered

Both options share two axis choices that the evidence effectively forces:

- **Axis 6 (fix-apply mechanism): inline parent apply.** Child `claude -p` is blocked by the auto-mode permission classifier on this machine, targeted for removal (issue #7, `tasks/new-issues.md:205`), and recommend-only contradicts AC5. Inline precedents: `issue-implement/SKILL.md:154`, `codex-audit/SKILL.md:130-134`. No `code-review-fixes*.tmp` artifact needed.
- **Axis 3 (design-confirm pause): (a) Claude classifies** load-bearing vs conform-only, defaults ON for load-bearing, and announces the call — pinned by the spec (`tasks/todo.md:399`). Classification line: a piece is **load-bearing** if it defines or changes a contract/interface other pieces depend on; conform-only pieces implement against already-settled contracts.
- **Axis 6 (triage vocabulary): task-13 buckets — A.1 auto-fix / A.2 verified no-op / B tradeoff → stop for developer input / C not legit.** AC5's letter names task-13 bucket logic (`tasks/todo.md:434`; bucket definitions at `tasks/todo.md:25`). The gates' native interim labels map cleanly: apply→A.1, judgment call→B, noise→C. Pre-committing to task-13's vocabulary is acceptable here because task 13's own design notes already state the A.1/A.2/B/C preference (`tasks/todo.md`, design note 8) and `/forge` is archived before any inconsistency debt matures. (Codex cross-check flagged this; verified against the AC text.)

Ruled out before the options (by constraint, not preference):

- **Axis 1 (b) self-contained** — the trio totals 510 lines for three behaviors; condensed copies blow the line budget and duplicate machinery that inline-not-invoke does not force (file reads are legal — `checkpoint/SKILL.md:180` bars only invocation). The task's own lean note offered self-containment only as a fallback if tasks 19/20 hadn't landed; both landed.
- **Axis 7 (c) fixed top-level temp names** — imports the logged collision risk (issue #6); dominated by both other choices.
- **Axis 8 (c) pre-adopt task-17's light checkpoint format** — the format doesn't exist yet (task 17 not landed); adopting it would invert the dependency and violate AC9's "no new handoff format".
- **Axis 9 (b) pure plain-Agent orchestration** — viable only in part: AC10 says Workflow fan-out is *allowed*, not required (Codex CORRECTION — sequential runs need no Workflow), but a skill whose text never sanctions Workflow leaves AC10's "invoking `/forge` is the Workflow opt-in" unsatisfiable. Agent-calls-by-default with Workflow sanctioned for genuinely parallel phases is exactly choice (c) hybrid — so (b) survives only as a degenerate case of (c), not a distinct option.

### Option A — Disposable Reference Spine

*Thinnest lane, judgment-driven control surface, minimal registration footprint, cheap archive.*

> Amended after Codex cross-check: Axis 6 vocabulary switched to task-13 buckets (now a shared/forced choice, above) and Axis 10 switched from local-only to managed-list-only — Codex surfaced the AC8 evidence chain (`tasks/todo.md:436` → "same check as task 13 AC8" → `tasks/todo.md:43` "if enumerated, add the new skill") that rules out the recorded-opt-out reading.

Axis-choice combination:

| Axis | Choice |
|---|---|
| 1 Composition | (a) reference-canonical — spine only; reads trio SKILL.mds at runtime, applies their steps with stated deltas |
| 2 Grounding threshold | (b) qualitative judgment ("fits comfortably in context"; sprawling → summon) |
| 3 Design-confirm | (a) judgment, default ON for load-bearing (shared/forced) |
| 4 Gate RUN/SKIP | (a) judgment from the piece's role, announced before running |
| 5 Convergence | (b) one combined audit→review→apply convergence loop, single max-cycles cap |
| 6 Vocabulary | task-13 A.1/A.2/B/C buckets (shared/forced — see above); gate-native labels map in |
| 7 Temps | (b) inherit each inlined skill's own scheme (coupled: forced by 1=a — applying codex-audit's steps as written lands temps in `tasks/logs/audits/` with run tokens). Safe because the lane runs gates strictly sequentially — codex-review's fixed tmp names (`codex-review/SKILL.md:30`, issue #6) collide only under parallel gate execution, which the fixed audit→review ordering already forbids |
| 8 Handoff | (a) emitted ready-to-run continuation prompt only (pure Multi-Batch; `CLAUDE.md:142`) |
| 9 Orchestration | (c) hybrid — plain Agent calls for sequential seams, Workflow only for genuinely parallel phases (with `isolation: 'worktree'`); fixed-N hard agent cap (works under both vehicles; coupled: budget-scaled cap requires Workflow-only) |
| 10 Registration | managed-list-only — one entry for `.claude/skills/forge/SKILL.md` in `/playbook-update`'s managed list (`playbook-update/SKILL.md:15-55`); **no** README or quickref rows (narrower choice Codex surfaced between research's (a) full and (c) local-only; satisfies AC8's letter with minimal footprint). The managed-list entry is also the **delivery mechanism**: consumer repos receive `/forge` via `/playbook-update` (developer-confirmed 2026-06-10 — the skill is project-agnostic, for any repo importing the playbook) |
| 11 Archive | delete the skill dir + remove the one managed-list line + add a `playbook-removals.md` entry (propagation to consumer repos is the delivery mechanism, so the entry is definitely needed; entries auto-expire after ~6 months) |
| 12 Pre-Edit Gate | (a) skill-text-as-override — `/forge` states that explicit developer invocation of the skill is the authorization to Edit/Write without RDPI artifacts for this lane; no CLAUDE.md edit |

How it works: the skill carries only the lane spine (Frame → Build → pause → gates → apply → verify → present), and for each gate says "read `.claude/skills/codex-audit/SKILL.md` (or codex-review) and apply its Steps N–M with these deltas: target = freshly built code, sources = the spine docs, triage applies inline via task-13 buckets instead of recommend-only." Frame records the target repo's test/typecheck commands alongside intent + AC (AC6 needs them at verify time — `tasks/todo.md:435`). The convergence loop wraps the *pair* of gates: one cycle = audit → review → apply triaged fixes; stop when a cycle surfaces no new critical findings, hard cap **default 2 cycles** (worst case 4 gate calls + optional self-summon = ≤5 Codex calls, under RDPI's ~6 — one number bounds total spend instead of two per-gate caps; Codex's independent design converged on the same shape and cap). Control surface is uniform: every RUN/SKIP and pause decision is a one-line announced judgment call, matching Axis 3's spec-pinned idiom (coupling: judgment+judgment = one announcement pattern, no argument-parsing text). Routing sentences for the agent hierarchy: a phase is **straightforward** (Opus-suitable) when it is conform-only work against settled contracts; a gate fix is **bounded** (routable down) when it is single-file/localized with no contract or interface change — complex/subtle fixes stay with the orchestrator.

Refinements from developer review (2026-06-10):

- **Verify runs per cycle, not once at the end.** Each gate cycle closes with the Frame-recorded tests/typecheck; convergence = no new critical findings AND passing checks (matches the repair-loop prior art in `tasks/research-patterns.md`). A verify failure with a clear mechanical cause is fixed in-cycle (A.1); an unclear failure is probed by self-summoning codex-research-style grounding — one or more targeted runs, each sharpening the question — before falling back to a B-stop.
- **Mid-Build escape hatch (probe-then-stop).** When Build hits contradictory sources, a piece wider than Framed, or an unknown it can't settle: first self-summon codex-research with a targeted question (iterating with sharper questions is the probing mechanism), and B-stop only if the answers still leave a genuine tradeoff or contradiction for the developer.
- **Pause scope under phasing.** The design-confirm pause fires once per piece, when the spine/contracts settle (typically before phase 1's code); conform-only later phases do not re-pause. A later phase that forces a contract change triggers a fresh pause (or B-stop).
- **Cycle cap is per phase and exists to bound thrash, not Codex spend.** Codex calls are cheap (developer-confirmed); each independently-verifiable phase gets its own ≤2-cycle loop, with RUN/SKIP judgment keeping conform-only phases at audit-only or no gates. The scarce resource is strong-model sub-agent spend, guarded structurally: explicit model pin on every spawn, leaf-only, at most one build sub-agent per seam, spine never delegated, hard fixed-N cap.
- **Convergence has concrete stop cues, stated with emphasis.** "No new critical findings" means: stop when a cycle's new findings are only nitpicks, cosmetic/style preferences, or errata in the source docs themselves — anything that is not a larger issue. The skill must state this rule emphatically (rule-grade wording, not a passing note): it is a soft gate that judgment-driven loops tend to ignore, and ignoring it is the thrash failure mode. Concrete cues over bare "best judgment."
- **Routing is two-sided, with concrete cues.** A Fable-tier build sub-agent requires a one-line announced justification (why Opus won't do). Symmetrically, critical or subtle work must not drift down to Opus out of cost habit — contract-adjacent, cross-cutting, or subtle-bug work reverts to Fable. The skill gives concrete cues rather than bare "best judgment": small/mechanical/nitpick-level → route down; contract-touching/subtle/critical → Fable.
- **Ask-when-unclear posture (beyond the pause).** The structured design-confirm pause fires once per piece, but the lane keeps a standing posture: when the model is guessing, entering territory it is uncomfortable in, or something would simply benefit from developer eyes, it surfaces the question to the developer instead of pressing on. Progress-blocking load-bearing questions get a codex-research probe first — `/codex-research`'s own auto-fire gate already triggers exactly there (immediately before stopping to ask the developer about a progress-blocking, materially-architectural question), so no new machinery is needed; the skill just must not suppress it.
- **Project-agnostic skill text.** `/forge` serves any repo importing the playbook; the skill body and its argument examples carry zero references to any specific consumer project — consumer-project details are confidential and the managed-list entry propagates the file.

Good: smallest skill (~60–90 lines plausible); matches the playbook's composition idiom exactly (inline-by-reference is *the* documented pattern — Architecture Analysis); satisfies AC5 and AC8 by their letter; disposability is near-total — archive = delete the skill dir + remove one managed-list line + a removals entry; single combined cap bounds gate thrash structurally.

Not good: runtime dependency on trio files (if codex-audit/review are edited mid-window, `/forge` behavior shifts silently — acceptable: they are canonical specs and the window is 2 weeks); each run re-reads up to ~320 lines of reference specs (cheap in a 1M-token Fable window, the only window this skill lives in); judgment-driven gates have run-to-run variance vs a policy table; skill-text-as-override for the Pre-Edit Gate is an untested pattern — a future session could weigh always-loaded `CLAUDE.md:98` above in-context skill text (mitigation: the override sentence must be explicit and cite the gate by line); consumer repos receive the temporary skill via `/playbook-update` — now intended (it is the delivery mechanism), at the cost of a guaranteed removals entry at archive time.

### Option B — Registered Workflow Lane

*Self-legible hybrid body, deterministic policy-table gates, full lifecycle registration, Workflow-native orchestration.*

Axis-choice combination:

| Axis | Choice |
|---|---|
| 1 Composition | (c) hybrid — one-paragraph inline recipe per gate + pointer to the canonical SKILL.md for the full mechanic |
| 2 Grounding threshold | (c) size-of-surface heuristic (concrete line/file-count line, e.g. source set > N lines → summon) |
| 3 Design-confirm | (a) judgment, default ON for load-bearing (shared/forced) |
| 4 Gate RUN/SKIP | (c) fixed policy table — contract-defining → both gates; conform-only → audit only; trivial → none |
| 5 Convergence | (c) audit-loop (native codex-audit pass mechanic, cap ≤5 clamped) + single-shot review |
| 6 Vocabulary | task-13 A.1/A.2/B/C buckets (shared/forced — see above) |
| 7 Temps | (a) own per-run token scheme under new `tasks/logs/forge/` (clones codex-audit's proven scheme; gitignored) |
| 8 Handoff | (b) continuation prompt + optional current heavy `/checkpoint` for overnight/cross-session gaps |
| 9 Orchestration | (a) Workflow script per run — deterministic loops, per-agent `model` pin, budget-scaled agent cap (`budget.total ? floor(total/X) : N`) |
| 10 Registration | (a) full — managed list + README + quickref rows (task-19/20 precedent) |
| 11 Archive | (a) delete + `playbook-removals.md` entry + README/quickref row removal (coupled: forced by 10=a) |
| 12 Pre-Edit Gate | (b) additive sentence in CLAUDE.md outside the fixed RDPI block naming `/forge` a sanctioned lane |

How it works: the skill body is larger (~120+ lines) but each run is self-legible — gate recipes are inline so the model doesn't re-read trio specs; the audit gate loops natively per codex-audit's own pass mechanic and review runs once after convergence; a policy table makes RUN/SKIP deterministic; orchestration always goes through a Workflow script, which buys the budget API and deterministic fan-out; the skill registers everywhere skills normally register.

Good: deterministic gates (no judgment variance); no runtime dependency on sibling files; budget-scaled caps are strictly more expressive; full registration follows the freshest precedent (tasks 19/20).

Not good: violates the disposability premise on two fronts — full registration (README + quickref rows on top of the managed-list entry) maximizes archive debt for a 2-week skill, and the CLAUDE.md sentence touches the always-loaded file the task says to leave unchanged (even outside the fixed block, the top half here is template content that propagates). Workflow-always is heavyweight for the dominant sequential-seam case (Step-9 docs are sequential phases, not parallel fan-out). Review findings get applied with no re-check (single-shot review is the *last* gate, so its fixes ship unverified by any gate). Policy table + judgment pause = two control idioms (coupling cost: more argument/decision text against the line budget). Line count roughly doubles Option A.

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)
None remaining. The AC8-reading question (local-only vs managed-list registration) was resolved by Codex's cross-check evidence: task-21 AC8 defers to task-13 AC8 (`tasks/todo.md:436`), whose text says "if enumerated, add the new skill" (`tasks/todo.md:43`) — and the list is enumerated (`playbook-update/SKILL.md:15-55`). Managed-list-only registration is folded into Option A. The former non-blocking proposals (combined cap = 2 cycles, load-bearing classification sentence, Opus-boundary sentences, Frame capturing verify commands) were corroborated by Codex and folded into the shared choices and Option A's description.

### Non-blocking (can resolve during implementation)
- [ ] Exact fixed-N value for the hard agent cap — settle in `/create-plan` (starting point: ≤4 agents per phase, ≤2 concurrent).

*(Resolved 2026-06-10: the archive-time removals entry is definitely needed — propagation via `/playbook-update` is the delivery mechanism, developer-confirmed. The Fable-justification rule is adopted, two-sided — see Option A refinements.)*

## What We're NOT Doing

- Not modifying the RDPI rules block, any existing skill, or the trio's behavior — purely additive.
- Not landing task 13 (triage spec) or task 17 (light checkpoint) as side effects; no new handoff format.
- No fixed front-of-lane Codex sweep — grounding is self-summoned only.
- No commits or pushes from inside the skill; no persistent artifacts outside gitignored `tasks/logs/`.
- Not folding the lane into RDPI at end of window — it is archived.
- Not tailoring the skill to any one consumer project: `/forge` is project-agnostic, delivered to all consumer repos via `/playbook-update`. The skill text carries no consumer-project-specific references (those details are confidential and do not belong in playbook-distributed files). Not hardened for hostile inputs.

## Decision

**Chosen approach:** Option A — Disposable Reference Spine (as amended after the Codex cross-check: task-13 bucket vocabulary; managed-list-only registration).

**Rationale:** Option A wins on all three decision heuristics. **Patterns:** reference-canonical composition is the playbook's documented idiom (inline-by-reference, never invoke — research §Architecture Analysis), it inherits the trio's proven temp schemes, and the handoff is the existing Multi-Batch continuation pattern; Option B introduces a policy table, a second temp scheme, Workflow-always orchestration, and a CLAUDE.md edit the task says not to make. **Simplicity:** roughly half the skill text, one control idiom (announced judgment), one combined convergence cap that structurally bounds Codex spend at ≤5 calls vs RDPI's ~6. **Reversibility:** archive = delete the dir + remove one managed-list line, with the existing removals mechanism covering any propagation — Option B's full registration maximizes archive debt for a deliberately 2-week skill. Codex's independent design (options withheld) converged on the same axis combination on every structural axis, and its cross-check materially improved the decision twice: AC-letter evidence forced task-13 vocabulary over the trio's interim labels, and the managed-list-only middle path replaced local-only registration, eliminating the design's only blocking open question.

Refinements from developer review (2026-06-10), folded into Option A's description: per-cycle verification with a probe-then-stop failure path, a mid-Build probe-then-stop escape hatch, once-per-piece pause scope, per-phase cycle caps (thrash-bounding, not Codex-cost-bounding), project-agnostic skill text, and delivery-via-`/playbook-update` confirmed as the propagation mechanism. Second round: concrete convergence stop cues stated with rule-grade emphasis (nitpicks/cosmetics/source-errata = stop), two-sided routing justification (announce why a Fable spawn is needed; never drift critical/subtle work down to Opus out of cost habit), and a standing ask-when-unclear posture backed by codex-research probes before developer stops.
