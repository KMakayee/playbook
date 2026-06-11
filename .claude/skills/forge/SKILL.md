---
name: forge
description: TEMPORARY slim single-pass build lane for the strong-model window — collapses RDPI into one model-led Frame → Build → gate → verify pass for wide generative pieces. Archived on revert to Opus.
argument-hint: '[piece — source path or "description"]'
disable-model-invocation: true
when_to_use: 'Manual only: use when the developer invokes /forge on a blueprint piece during the strong-model window.'
---

# Forge

A TEMPORARY build lane that collapses RDPI's Research/Design/Plan/Implement into **one model-led pass** for wide, generative pieces — for the piece: **$ARGUMENTS**. Governing principle: scaffolding scales inversely with model strength; this is the lighter calibration for the strong-model window.

**Temporary / archive note.** Built for the strong-model window (Fable, ~through 2026-06-24). On revert to Opus, archive this lane from the playbook *source* repo: delete `.claude/skills/forge/`, drop its line from the `playbook-update/SKILL.md` managed-files list, and add a `.claude/playbook-removals.md` entry — the skill propagates to consumer repos via `/playbook-update`, so the removals entry is required, not optional. Not folded into RDPI; full RDPI resumes unchanged.

**Pre-Edit Gate override.** Explicit developer invocation of `/forge` IS the authorization for this lane: for the named piece, Frame + Build replace the RDPI artifact prerequisites of the **Pre-Edit Gate** in CLAUDE.md's RDPI Workflow Rules — the rule reading "Do not call Edit or Write on source files until…". While this skill runs, sessions must not refuse edits for a missing `tasks/plan.md` and must not silently fall back into RDPI.

**Lane shape:** Frame → Build → optional design-confirm pause → gate cycle(s) (audit → review → triage → apply → verify) → present. Wide pieces split at natural seams: one phase per prompt, with compaction and a continuation prompt between phases (the Multi-Batch Plans pattern in CLAUDE.md).

---

## Steps

### 1. Frame (no Codex)

- Read the source piece FULLY, plus directly-referenced files.
- Produce in conversation (no artifact): a 3-line intent + acceptance criteria; the target repo's **test/typecheck commands** (discover them now — Verify needs them every cycle); and, for wide pieces, the **seam plan** — natural seams are the contract-group / module / doc boundaries discovered here, each phase independently buildable and verifiable.
- Classify the piece: **load-bearing** = defines or changes a contract/interface other pieces depend on; **conform-only** = implements against settled contracts.
- Announce the control decisions as one-line judgment calls: design-confirm pause ON/OFF (default ON for load-bearing, OFF for conform-only), and the per-phase gate RUN/SKIP plan — cues: contract-defining → both gates; conform-only → audit-only or none; trivial → none.

### 2. Build

- One freeform model-led pass — design and code together, no axis/option matrix.
- **Bounded-surface rule:** direct-read while the surface fits comfortably in context. A sprawling surface → self-summon grounding: read `.claude/skills/codex-research/SKILL.md` and apply its steps inline (file reads are legal; slash invocation is not). Its kept doc under `tasks/logs/research/` persists — later phases re-read it instead of re-summoning. No fixed front-of-lane Codex sweep.
- **Mid-Build escape hatch (probe, then stop):** contradictory sources, a piece wider than Framed, or an unsettleable unknown → first probe with targeted codex-research-style runs, iterating with sharper questions; stop for developer input (a bucket-B stop, per the triage buckets below) only if a genuine tradeoff or contradiction survives the probes.
- When guessing or in uncomfortable territory, surface the question to the developer rather than pressing on — and do not suppress `/codex-research`'s own auto-fire gate; it already triggers exactly at progress-blocking, materially-architectural questions.

### 3. Design-confirm pause (once per piece)

When the spine/contracts settle — typically before phase 1's code — state the contract shapes and boundaries in a few lines and wait for yes/no. Default ON for load-bearing, OFF for conform-only, as announced at Frame. Conform-only later phases do not re-pause; a later phase that forces a contract change triggers a fresh pause (or a B stop). The pause is a main-loop interaction — never inside a Workflow script (workflows take no mid-run user input).

### 4. Gate cycle (per phase)

One cycle = audit → review → triage → apply → verify. The trio SKILL.md files are canonical reference specs, read at runtime.

- **Gate 1 — fidelity (RUN/SKIP per Frame):** read `.claude/skills/codex-audit/SKILL.md` and apply its Steps 1–4 (run token + temp dir under `tasks/logs/audits/` → safe prompt compose → invoke → output-check + relation spot-check). Deltas: target = the code just built; sources = the spine docs + settled contracts, injected per its source-block rules; **single Codex pass per cycle** (`passes = 1` — the /forge cycle loop supersedes its native multi-pass mechanic, so its Steps 5–7 triage/present are replaced by the shared triage below). Clean its temps with its Step 6 `find … -delete` command before presenting.
- **Gate 2 — merit (RUN/SKIP per Frame):** read `.claude/skills/codex-review/SKILL.md` and apply its Steps 1–5 (pre-delete fixed tmps → safe compose → invoke → spot-check → cleanup). Delta: findings flow into the shared triage instead of Step 6's recommend-only presentation. Its fixed tmp names are safe here only because the gates run **strictly sequentially** (audit → review, always); and because those tmps live at `tasks/` top level — NOT under gitignored `tasks/logs/` — its Step 1 pre-delete and cleanup-on-failure discipline are the self-heal for temps stranded by an interrupted run. Never elide them when applying the delta.
- **Shared triage (task-13 buckets):** verify each finding against the actual code first — Codex's confidence is not evidence. **A.1** (clear right answer, contained scope, no behavioral change) → apply now. **A.2** (verified no-op) → record it, no edit. **B** (genuine tradeoff) → STOP for developer input. **C** (not legit) → drop, keep a one-line note, present as a count with `show all` opt-in. Gate-native labels map: fidelity defect / apply → A.1 candidate (after verification); judgment call → B; noise → C.
- **Apply routing:** A.1 fixes apply inline in the orchestrator by default; **bounded** fixes (single-file/localized, no contract or interface change) may route to an Opus sub-agent; complex or subtle fixes stay with the orchestrator. No fix file, no child `claude -p`.
- **Verify (every cycle):** run the Frame-recorded tests/typecheck — every cycle, not once at the end. Failure with a clear mechanical cause → fix in-cycle (A.1). Unclear failure → probe via codex-research-style grounding (one or more targeted runs, sharpening the question) → B stop if still unclear.
- **Convergence:** stop when a cycle surfaces **no new critical findings** AND checks pass. New findings that are only nitpicks, cosmetic/style preferences, or errata in the source docs themselves are NOT grounds for another cycle — looping on them is the thrash failure mode. Hard cap: **≤2 cycles per phase**. Cap exhausted with uncleared critical findings → present the residual delta as **needs developer review** — never silently treat max-cycle exhaustion as success.

### 5. Present + phase handoff

- Per phase, present: **Applied** (each fix: location + one-line what/why), **Needs your input** (B items, each with the specific missing input that keeps it open), **Filtered as noise** (count + `show all` opt-in), verification results, and a compact **convergence record** (cycles run, new-critical count per cycle, checks status). Inspectability lives in this output — no new artifact.
- If phases remain: emit a **ready-to-run continuation prompt** carrying the settled spine decisions, intent/ACs, files touched, test/typecheck commands, gate RUN/SKIP decisions, fixes applied, the remaining phase list, and the exact next step — **never raw file contents**. Instruct the operator to compact and continue on a clean window (pure Multi-Batch pattern; no checkpoint, no new handoff format).

## Orchestration & routing

- Default: the orchestrator works in the main loop; delegation is **sequential per seam** (Agent tool), so phase N+1 sees N's output. Workflow scripts only for genuinely independent parallel phases — parallel edit lanes require `isolation: 'worktree'`. **Invoking /forge is the Workflow opt-in.**
- **HARD RULE: every spawned agent — Agent tool or Workflow `agent()` — pins `model` explicitly; none inherit.** The harness's own guidance recommends omitting `model` (inherit); under Fable that spawns a Fable swarm, so this skill counter-instructs deliberately.
- **Hierarchy:** **Fable** = the orchestrator (owns the spine design — never delegated) plus at most one build sub-agent per seam, each Fable spawn requiring a one-line announced justification (why Opus won't do). **Opus** = straightforward conform-only phases + bounded gate fixes. **Sonnet** = reads/grounding pull-in + trivial mechanical writes (stubs, boilerplate — never logic). Two-sided: contract-touching, cross-cutting, or subtle work never drifts down out of cost habit — it reverts to Fable.
- **Caps + leaf rule:** hard cap **≤4 sub-agents per phase, ≤2 concurrent**. Sub-agents are leaf — no recursion (CLAUDE.md's recursion guard) — so build and fix-apply are separate leaf dispatches the orchestrator coordinates; gate Codex runs are Bash calls from the orchestrator, not sub-agents; never sub-split one interdependent phase.
- **Leaf-write override:** CLAUDE.md § Sub-Agent Behaviors frames leaf tasks as "read, search, and report" — within this lane, explicitly dispatched build and fix sub-agents MAY write code. The rule's operative prohibitions still bind in full: no spawning further sub-agents, no following RDPI, leaf-only.

## Important notes

- No commits or pushes from this skill. Nothing persistent outside gitignored `tasks/logs/` (audit temps per codex-audit's scheme, review temps per codex-review's, kept research docs per codex-research's). Cleanup-before-present on every exit path, including failures.
- The trio stays independently runnable and unchanged; this skill reads their SKILL.md files as reference specs — it never slash-invokes them.
- Project-agnostic: serves any repo importing the playbook; argument examples stay generic.
- Not added to `/finish`'s cleanup list — no persistent artifacts to clean.
