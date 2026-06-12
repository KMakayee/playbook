---
name: forge
description: Piece-agnostic single-pass build lane — Frame the piece (code or artifact), dispatch Build per the CLAUDE.md Workflow routing (Codex workers build code; artifacts follow the authoring chain), then run the Codex gate cycle and per-type verify.
argument-hint: '[piece — source path or "description"]'
disable-model-invocation: true
when_to_use: 'Manual only: use when the developer invokes /forge on a piece — code or artifact.'
---

# Forge

A build lane that collapses RDPI's Research/Design/Plan/Implement into **one dispatch-led pass** — for the piece: **$ARGUMENTS**. The orchestrator frames, composes the dispatch, coordinates seams, and reviews; workers build. Governing principle: scaffolding scales inversely with model strength — here the strength is the orchestrator plus the routed frontier workers it dispatches. RDPI itself is unchanged and runs alongside this lane.

**Pre-Edit Gate override.** Explicit developer invocation of `/forge` IS the authorization for this lane: for the named piece, Frame + Build replace the RDPI artifact prerequisites of the **Pre-Edit Gate** in CLAUDE.md's RDPI Workflow Rules — the rule reading "Do not call Edit or Write on source files until…". While this skill runs, sessions must not refuse edits for a missing `tasks/plan.md` and must not silently fall back into RDPI.

**Lane shape:** Frame → compose dispatch → Build (dispatched) → optional design-confirm pause → gate cycle(s) (audit → review → triage → apply → verify) → present. Wide pieces split at natural seams: one phase per prompt, with compaction and a continuation prompt between phases (the Multi-Batch Plans pattern in CLAUDE.md).

---

## Steps

### 1. Frame (no Codex)

- Read the source piece FULLY, plus directly-referenced files.
- Produce in conversation (no artifact): a 3-line intent + acceptance criteria, and, for wide pieces, the **seam plan** — natural seams are the contract-group / module / doc boundaries discovered here, each phase independently buildable and verifiable.
- Classify the piece on two dimensions:
  - **Contract weight:** **load-bearing** = defines or changes a contract/interface other pieces depend on; **conform-only** = implements against settled contracts.
  - **Deliverable type:** **code** / **artifact** (spec, doc, plan) / **other** — an open list: an "other" piece gets a Frame-declared verify plan rather than a forced fit into the first two.
- **Record the per-type verify plan now** (Verify needs it every cycle): code → the repo's **test/typecheck commands** (discover them here); artifact → the **upstream source list** (Gate 1's fidelity audit needs it) plus an internal-consistency/cross-reference check plan; other → declared explicitly.
- Announce the control decisions as one-line judgment calls: design-confirm pause ON/OFF (default ON for load-bearing, OFF for conform-only); the per-phase gate RUN/SKIP plan — cues: contract-defining → both gates; conform-only → audit-only or none; trivial → none; the **dispatch composition** — sequential seams / parallel lanes / single worker (mechanics under Orchestration & routing); and, for artifact pieces, the authoring-chain ideation RUN/SKIP alongside the gate plan.

### 2. Build (dispatched)

The orchestrator does not write the deliverable (non-relayed fallback excepted) — it composes seam briefs and dispatches per the Frame composition:

- **Code pieces:** each seam goes to a Codex worker — `agentType: codex`; deep-reasoning or contract-defining seams → `agentType: codex-xhigh`. The **seam brief** is the load-bearing serialization: intent + ACs, settled contracts, files in scope, test commands, and the acceptance contract (file:line citations; flag contradictions with prior findings). Workers MAY write the files their brief names (the writer grant, under Orchestration & routing).
- **Artifact pieces — the authoring chain:** ideation dump RUN/SKIP per Frame (RUN for wide or unfamiliar territory: apply `.claude/skills/codex-research/SKILL.md` inline; kept doc under `tasks/logs/research/`; `codex-xhigh` for hard strategy) → **Opus authors** the deliverable (`model: opus`) from the dump + sources → the orchestrator reviews in the main loop. Reviewer ≠ author at every link; both gates still run on the Opus-authored artifact.
- **Bounded-surface rule (orchestrator):** direct-read while the surface fits comfortably in context — grounding reads feed the seam briefs. A sprawling surface → self-summon grounding: read `.claude/skills/codex-research/SKILL.md` and apply its steps inline (file reads are legal; slash invocation is not). Its kept doc under `tasks/logs/research/` persists — later phases re-read it instead of re-summoning. No fixed front-of-lane Codex sweep.
- **Mid-Build escape hatch (orchestrator — probe, then stop):** contradictory sources, a piece wider than Framed, or an unsettleable unknown → first probe with targeted codex-research-style runs, iterating with sharper questions; stop for developer input (a bucket-B stop, per the triage buckets below) only if a genuine tradeoff or contradiction survives the probes.
- When guessing or in uncomfortable territory, the orchestrator surfaces the question to the developer rather than pressing on — and does not suppress `/codex-research`'s own auto-fire gate; it already triggers exactly at progress-blocking, materially-architectural questions.

### 3. Design-confirm pause (once per piece)

When the spine/contracts settle — typically before phase 1's build — state the contract shapes and boundaries in a few lines and wait for yes/no. Default ON for load-bearing, OFF for conform-only, as announced at Frame. Conform-only later phases do not re-pause; a later phase that forces a contract change triggers a fresh pause (or a B stop). The pause is a main-loop interaction — never inside a Workflow script (workflows take no mid-run user input).

### 4. Gate cycle (per phase)

One cycle = audit → review → triage → apply → verify. The trio SKILL.md files are canonical reference specs, read at runtime.

- **Gate 1 — fidelity (RUN/SKIP per Frame):** read `.claude/skills/codex-audit/SKILL.md` and apply its Steps 1–4 (run token + temp dir under `tasks/logs/audits/` → safe prompt compose → invoke → output-check + relation spot-check). Deltas: target = the piece just built (the code, or the Opus-authored artifact); sources per type — code: the spine docs + settled contracts; artifact: the Frame-recorded upstream source list + settled contracts; other: per the Frame-declared plan — injected per its source-block rules; **single Codex pass per cycle** (`passes = 1` — the /forge cycle loop supersedes its native multi-pass mechanic, so its Steps 5–7 triage/present are replaced by the shared triage below). Clean its temps with its Step 6 `find … -delete` command before presenting.
- **Gate 2 — merit (RUN/SKIP per Frame):** read `.claude/skills/codex-review/SKILL.md` and apply its Steps 1–5 (pre-delete fixed tmps → safe compose → invoke → spot-check → cleanup). Delta: findings flow into the shared triage instead of Step 6's recommend-only presentation. Its fixed tmp names are safe here only because the gates run **strictly sequentially** (audit → review, always); and because those tmps live at `tasks/` top level — NOT under gitignored `tasks/logs/` — its Step 1 pre-delete and cleanup-on-failure discipline are the self-heal for temps stranded by an interrupted run. Never elide them when applying the delta.
- **Shared triage (task-13 buckets):** verify each finding against the actual code first — Codex's confidence is not evidence. **A.1** (clear right answer, contained scope, no behavioral change) → apply now. **A.2** (verified no-op) → record it, no edit. **B** (genuine tradeoff) → STOP for developer input. **C** (not legit) → drop, keep a one-line note, present as a count with `show all` opt-in. Gate-native labels map: fidelity defect / apply → A.1 candidate (after verification); judgment call → B; noise → C.
- **Apply routing:** A.1 fixes apply inline in the orchestrator by default; **bounded** fixes (single-file/localized, no contract or interface change) may route to an Opus sub-agent (`model: opus`); complex or subtle fixes stay with the orchestrator. No fix file, no child `claude -p`.
- **Verify (every cycle, per the Frame-recorded plan):** code → run the Frame-recorded tests/typecheck — every cycle, not once at the end. Artifact → Gate 1's fidelity audit doubles as the source-fidelity verify (never run a second Codex audit for Verify); Verify proper is the orchestrator-run internal-consistency/cross-reference pass from the Frame plan. Other → run the Frame-declared plan. Failure with a clear mechanical cause → fix in-cycle (A.1). Unclear failure → probe via codex-research-style grounding (one or more targeted runs, sharpening the question) → B stop if still unclear.
- **Convergence:** stop when a cycle surfaces **no new critical findings** AND the piece's per-type verify passes. New findings that are only nitpicks, cosmetic/style preferences, or errata in the source docs themselves are NOT grounds for another cycle — looping on them is the thrash failure mode. Hard cap: **≤2 cycles per phase**. Cap exhausted with uncleared critical findings → present the residual delta as **needs developer review** — never silently treat max-cycle exhaustion as success.

### 5. Present + phase handoff

- Per phase, present: **Applied** (each fix: location + one-line what/why), **Needs your input** (B items, each with the specific missing input that keeps it open), **Filtered as noise** (count + `show all` opt-in), verification results, and a compact **convergence record** (cycles run, new-critical count per cycle, checks status). Inspectability lives in this output — no new artifact.
- If phases remain: emit a **ready-to-run continuation prompt** carrying the settled spine decisions, intent/ACs, files touched, the Frame-recorded per-type verify plan, gate RUN/SKIP decisions, fixes applied, the dispatch composition, the seam → worker map (which seams went to which `agentType`/`model`), any open parallel-lane worktree status (merged or pending), any lanes marked down, the remaining phase list, and the exact next step — **never raw file contents**. Instruct the operator to compact and continue on a clean window (pure Multi-Batch pattern; no checkpoint, no new handoff format).

## Orchestration & routing

- Routing inherits CLAUDE.md § Workflow — the role table allocates; this section states only forge-specific deltas. **HARD RULE: every spawned agent — Agent tool or Workflow `agent()` — pins `agentType` or `model` explicitly; none inherit.** The harness default inherits the main-loop model; under a top-tier session that silently spawns a session-model swarm.
- **Composition (Frame's call, per piece):** sequential seams via the Agent tool (phase N+1 sees N's output — the default); parallel Workflow lanes ONLY for genuinely independent seams touching disjoint file sets, each lane with `isolation: 'worktree'`; a single worker for narrow pieces. **Merge-back is orchestrator-owned:** nothing merges lane worktrees automatically — the orchestrator merges each lane's branch back before any gate runs.
- **Hierarchy:** the orchestrator (session model) owns the spine — Frame, composition, design-confirm, gates, triage, merge-back, presentation — and is never spawned as a worker. **Codex** builds all code seams (`agentType: codex`; deep-reasoning or contract-defining seams → `codex-xhigh`). **Opus** (`model: opus`) takes delegated review legwork on Codex output and bounded gate fixes. **Gemini Flash** (`agentType: gemini-flash`) takes small/repetitive support work and fetching. **Sonnet** (`model: sonnet`) only with a named harness need. Two-sided: contract-touching or subtle work never drifts down a tier out of cost habit — it goes to `codex-xhigh` and back through orchestrator review.
- **Caps + leaf rule:** hard cap ≤4 sub-agents per phase, ≤2 concurrent — coordination bounds: workers are cheap, the cap bounds chaos and review bandwidth, not spend. `codex-xhigh` counts double toward the concurrency cap. Sub-agents are leaves (CLAUDE.md's recursion guard — forge grants no orchestrator roles); gate Codex runs are Bash calls from the orchestrator, not sub-agents; gates run strictly sequentially in the main loop even when build lanes parallelize (codex-review's fixed `tasks/`-top-level tmp names collide otherwise); never sub-split one interdependent phase.
- **Writer grant (leaf-write override):** explicitly dispatched build and fix workers are **granted writers, not granted orchestrators** — they MAY write the files their seam brief names; ordinary leaves stay read/search/report; no grant is transitive. The writer grant does not exempt a worker from the routing table.
- **Fallback (non-relayed session or lane down):** the first `agentType` spawn failing fast (contained model error) marks that lane down for the session. With the codex lane down, forge degrades to its previous shape — the orchestrator builds in the main loop, Opus takes straightforward conform-only seams and bounded fixes, Sonnet takes trivial mechanical writes (stubs, boilerplate — never logic). Gates are unaffected: they run on Bash `codex exec`, which does not depend on the relay. Note the degraded shape in the phase presentation.

## Important notes

- No commits or pushes from this skill. Nothing persistent outside gitignored `tasks/logs/` (audit temps per codex-audit's scheme, review temps per codex-review's, kept research docs per codex-research's). Cleanup-before-present on every exit path, including failures.
- The trio stays independently runnable and unchanged; this skill reads their SKILL.md files as reference specs — it never slash-invokes them.
- Chained runs — `/forge` a spec today, `/forge` the code from it later, run 1's output as run 2's source — are one common pattern, an emergent usage; never a prescribed two-step or an internal authorship pipeline.
- Project-agnostic: serves any repo importing the playbook; argument examples stay generic.
- Not added to `/finish`'s cleanup list — no persistent artifacts to clean.
