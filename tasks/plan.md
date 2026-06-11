# Plan: Task 21 — /forge skill (slim single-pass build lane, Fable window)

## Design decision reference

**Chosen approach:** Option A — Disposable Reference Spine (`tasks/design-decision.md` § Decision), as amended after Codex cross-check and two developer-review rounds: task-13 bucket vocabulary, managed-list-only registration, per-cycle verification, probe-then-stop escape hatches, rule-grade convergence stop cues, two-sided routing justification, project-agnostic text.

**Inputs:** `tasks/research-codebase.md` (ground truth), `tasks/design-decision.md` (axis choices), `tasks/research-patterns.md` (prior-art corroboration), spec at `tasks/todo.md:392-467` (13 ACs at `tasks/todo.md:429-442`).

## Scope

Two file changes, both verified against the current tree:

1. **NEW** `.claude/skills/forge/SKILL.md` — the entire lane (no `forge/` dir exists yet; verified).
2. **One line added** to `.claude/skills/playbook-update/SKILL.md` managed-files list (currently lines 19-55; enumerated, no globs). This is the only edit to an existing file, and it is AC8-mandated (the managed list must account for the new skill) — it does not breach "every existing skill unchanged," which is about behavior.

### What we're NOT doing (from design — drift guards)

- No edits to CLAUDE.md, the RDPI rules block, or any trio skill. No README.md or quickref.md rows (managed-list-only registration is the decided choice — do not "helpfully" add discoverability rows).
- No new handoff format, no task-13 or task-17 landing as side effects, no `tasks/forge-*.tmp` scheme, no persistent artifacts outside gitignored `tasks/logs/`.
- No consumer-project references anywhere in the skill (confidential; the file propagates via `/playbook-update`). Argument examples use generic placeholders only.
- No commits/pushes from inside the skill itself.

---

## Phase 1 — Write `.claude/skills/forge/SKILL.md`

Create the directory and file. Target **≤110 lines total**; treat >120 as a flag to condense (the ~50-line constraint is a forcing function per design; "thin" is the AC). Write terse, rule-grade prose in the trio's idiom. Section-by-section specification:

### 1a. Frontmatter (verbatim shape)

```yaml
---
name: forge
description: TEMPORARY slim single-pass build lane for the strong-model window — collapses RDPI into one model-led Frame → Build → gate → verify pass for wide generative pieces. Archived on revert to Opus.
argument-hint: '[piece — source path or "description"]'
disable-model-invocation: true
when_to_use: 'Manual only: use when the developer invokes /forge on a blueprint piece during the strong-model window.'
---
```

`disable-model-invocation: true` is required (side-effecting workflow skill, 22-of-24 convention). `when_to_use` is menu documentation, mirroring `codex-audit/SKILL.md:6`.

### 1b. Header block (AC1, Axis 12)

- One-line identity: temporary build lane that collapses Research/Design/Plan/Implement into one model-led pass for wide, generative pieces; governing principle (scaffolding scales inversely with model strength).
- **Temporary note (AC1):** built for the strong-model window (Fable, ~through 2026-06-24); archived from the playbook *source* repo on revert to Opus — delete this skill dir, drop its managed-list line in `playbook-update/SKILL.md`, add a `.claude/playbook-removals.md` entry (propagation via `/playbook-update` is the delivery mechanism, so the removals entry is required). Not folded into RDPI.
- **Pre-Edit Gate override (Axis 12a), rule-grade and explicit:** explicit developer invocation of `/forge` IS the authorization for this lane — for the named piece, Frame + Build replace the RDPI artifact prerequisites of the **Pre-Edit Gate** in CLAUDE.md's RDPI Workflow Rules (the "Do not call Edit or Write on source files until…" rule). Sessions must not refuse edits for missing `tasks/plan.md` and must not silently start RDPI while this skill runs. Cite the gate by **section name + quoted operative phrase**, not bare line number — see Judgment Call 3.

### 1c. Lane overview (~3 lines)

Frame → Build → optional design-confirm pause → gate cycle(s) (audit → review → triage → apply → verify) → present. Wide pieces split at natural seams; one phase per prompt with compaction + continuation prompt between (Multi-Batch pattern, `CLAUDE.md` § Multi-Batch Plans).

### 1d. Step: Frame (AC2 intake, no Codex)

- Read the source piece FULLY plus directly-referenced files. No Codex in Frame.
- Produce in conversation (no artifact): 3-line intent + acceptance criteria; the target repo's **test/typecheck commands** (discovered now — verify needs them later, AC6); the **seam plan** for wide pieces (natural seams = contract group / module / doc boundaries discovered here), each phase independently buildable + verifiable.
- Classify the piece: **load-bearing** = defines or changes a contract/interface other pieces depend on; **conform-only** = implements against settled contracts (design's classification sentence, verbatim).
- Announce the control decisions as one-line judgment calls: design-confirm pause ON/OFF (default ON for load-bearing) and per-phase gate RUN/SKIP plan (cues, not a table: contract-defining → both gates; conform-only → audit-only or none; trivial → none).

### 1e. Step: Build (AC2, AC3)

- One freeform model-led pass — design and code together, **no axis/option matrix**.
- **Bounded-surface rule:** direct-read while the surface fits comfortably in context; a sprawling surface → self-summon grounding by reading `.claude/skills/codex-research/SKILL.md` and applying its steps inline (no slash invocation). Its kept doc under `tasks/logs/research/` persists — later phases re-read it instead of re-summoning. No fixed front-of-lane Codex sweep.
- **Mid-Build escape hatch (probe-then-stop):** contradictory sources, a piece wider than Framed, or an unsettleable unknown → first probe with targeted codex-research-style runs (iterate with sharper questions); B-stop for developer input only if a genuine tradeoff/contradiction survives the probes.
- **Ask-when-unclear posture:** when guessing or in uncomfortable territory, surface the question to the developer rather than pressing on; do not suppress `/codex-research`'s own auto-fire gate (it already triggers exactly at progress-blocking, materially-architectural questions).

### 1f. Step: Design-confirm pause (AC4)

- Fires **once per piece**, when the spine/contracts settle (typically before phase 1's code): state the contract shapes/boundaries in a few lines, wait for yes/no. Default ON for load-bearing, OFF for conform-only — announced at Frame.
- Conform-only later phases do not re-pause; a later phase that forces a contract change triggers a fresh pause (or B-stop).
- The pause is a main-loop interaction — **never inside a Workflow script** (workflows take no mid-run user input).

### 1g. Step: Gate cycle (AC5, AC13 — the heart of the skill)

Per phase, run the combined convergence loop. One cycle = audit → review → triage → apply → verify:

- **Gate 1 — fidelity (RUN/SKIP per Frame):** read `.claude/skills/codex-audit/SKILL.md` and apply its Steps 1–4 (run token + temp dir under `tasks/logs/audits/` → safe prompt compose → invoke → output-check + relation spot-check) with these deltas: target = the code just built; sources = the spine docs + settled contracts (injected per its source-block rules); **single Codex pass per cycle** (`passes = 1` — the /forge cycle loop supersedes its native multi-pass mechanic, so its Steps 5–7 triage/present are replaced by the cycle's shared triage below); clean its temps with its Step 6 `find … -delete` command before presenting.
- **Gate 2 — merit (RUN/SKIP per Frame):** read `.claude/skills/codex-review/SKILL.md` and apply its Steps 1–5 (pre-delete fixed tmps → safe compose → invoke → spot-check → cleanup) with this delta: findings flow into the cycle's shared triage instead of Step 6's recommend-only presentation. Its fixed tmp names are safe here only because gates run **strictly sequentially** (audit → review ordering is fixed). Its Step 1 pre-delete and cleanup-on-failure discipline are part of the referenced range — they are the self-heal for temps stranded by an interrupted run (the fixed tmps live at `tasks/` top level, NOT under gitignored `tasks/logs/`), so the skill must not elide them when summarizing the delta.
- **Shared triage — task-13 buckets (AC5):** verify each finding against the actual code first ("Codex's confidence is not evidence" — carry the caveat verbatim). **A.1** auto-fix (clear right answer, contained scope, no behavioral change) → apply now; **A.2** verified no-op → record, no edit; **B** tradeoff → STOP for developer input; **C** not legit → drop, keep a one-line note, present as a count with `show all` opt-in. Gate-native label mapping: fidelity defect / apply → A.1 candidate (after verification); judgment call → B; noise → C.
- **Apply routing:** A.1 fixes apply inline in the orchestrator by default; **bounded** fixes (single-file/localized, no contract or interface change) may route to an Opus sub-agent; complex/subtle fixes stay with the orchestrator. No fix file, no child `claude -p`.
- **Verify (AC6, per cycle):** run the Frame-recorded tests/typecheck **every cycle**, not once at the end. Failure with a clear mechanical cause → fix in-cycle (A.1); unclear failure → probe via codex-research-style grounding (one or more targeted runs, sharpening the question) → B-stop if still unclear.
- **Convergence (AC13), rule-grade wording:** stop when a cycle surfaces **no new critical findings** AND checks pass. State emphatically: new findings that are only nitpicks, cosmetic/style preferences, or errata in the source docs themselves are NOT grounds for another cycle — looping on them is the thrash failure mode. Hard cap: **≤2 cycles per phase**. Cap exhaustion with uncleared critical findings → present the residual delta as **needs developer review — never silently treat max-cycle exhaustion as success**.

### 1h. Step: Present + phase handoff (AC9)

- Per phase, present outcomes: **Applied** (each fix: location + one-line what/why), **Needs your input** (B items, each with the specific missing input), **Filtered as noise** (count + `show all` opt-in), verification results, and a compact **convergence record** (cycles run, new-critical count per cycle, checks status) — inspectability lives in the present output, no new artifact.
- If phases remain: emit a **ready-to-run continuation prompt** carrying settled spine decisions, intent/AC, files touched, commands, gate RUN/SKIP decisions, fixes applied, remaining phase list, and the exact next step — **never raw file contents**. Instruct the operator to compact and continue on a clean window (pure Multi-Batch pattern; no checkpoint, no new format).

### 1i. Orchestration & routing (AC10, AC11, AC12)

- Default: the orchestrator works in the main loop; delegation is **sequential per seam** (Agent tool), so phase N+1 sees N's output. Workflow scripts only for genuinely independent parallel phases — parallel edit lanes require `isolation: 'worktree'`. **Invoking /forge is the Workflow opt-in.**
- **HARD RULE with rationale (AC10):** every spawned agent — Agent tool or Workflow `agent()` — pins `model` explicitly; **none inherit**. The harness's own guidance recommends omitting `model` (inherit); under Fable that spawns a Fable swarm, so this skill counter-instructs deliberately.
- **Hierarchy with concrete cues (AC11):** **Fable** = the orchestrator (owns spine design — never delegated) plus at most **one build sub-agent per seam**, each Fable spawn requiring a one-line announced justification (why Opus won't do); **Opus** = straightforward conform-only phases + bounded gate fixes; **Sonnet** = reads/grounding pull-in + trivial mechanical writes (stubs, boilerplate — never logic). Two-sided: contract-touching, cross-cutting, or subtle work never drifts down out of cost habit — it reverts to Fable.
- **Caps + leaf rule (AC12):** hard cap **≤4 sub-agents per phase, ≤2 concurrent**; sub-agents are leaf — no recursion (`CLAUDE.md` recursion guard) — so build and fix-apply are separate leaf dispatches the orchestrator coordinates; gate Codex runs are Bash calls from the orchestrator, not sub-agents; never sub-split one interdependent phase.
- **Leaf-write override (explicit, Codex CORRECTION):** CLAUDE.md § Sub-Agent Behaviors frames leaf tasks as "read, search, and report" — /forge's build/fix sub-agents write code, so the skill must state the override explicitly (same skill-text-as-override pattern as the Pre-Edit Gate, 1b): within this lane, explicitly dispatched build and fix sub-agents MAY write code; the rule's operative prohibitions still bind in full — no spawning further sub-agents, no following RDPI, leaf-only. Without this sentence, AC11/AC12 conflict with the loaded playbook rule.

### 1j. Important notes (closing block)

- No commits or pushes from the skill. Nothing persistent outside gitignored `tasks/logs/` (audit temps per codex-audit's scheme, review temps per codex-review's, kept research docs per codex-research's). Cleanup-before-present on every exit path, including failures.
- The trio stays independently runnable and unchanged; this skill reads their SKILL.md files as canonical reference specs at runtime (file reads are legal; slash invocation is not).
- Project-agnostic: serves any repo importing the playbook; argument examples are generic.
- Not added to `/finish`'s cleanup list (no persistent artifacts to clean).

**Success criteria (Phase 1):**

```bash
test -f .claude/skills/forge/SKILL.md && echo OK
head -8 .claude/skills/forge/SKILL.md   # frontmatter: name: forge, disable-model-invocation: true, argument-hint
wc -l .claude/skills/forge/SKILL.md     # ≤110 target; >120 = condense before proceeding
grep -c 'TEMPORARY\|temporary' .claude/skills/forge/SKILL.md          # ≥1 (AC1)
grep -ciE 'omk|omakase|fp-rebuild|docs/blueprint|contracts\.md' .claude/skills/forge/SKILL.md   # MUST be 0 (project-agnostic + no stale target paths)
grep -c 'pins\? .*model\|model.*explicit' .claude/skills/forge/SKILL.md  # ≥1 (AC10)
grep -c 'A\.1' .claude/skills/forge/SKILL.md                          # ≥1 (AC5 buckets)
grep -c "worktree" .claude/skills/forge/SKILL.md                      # ≥1 (AC10 parallel isolation)
```

Plus a manual read-through: every 1b–1j element present, no slash-invocation of the trio anywhere (reference-reads only).

- [x] Phase 1 complete — file written at 70 lines; all grep criteria pass (temporary 2, confidentiality 0, model-pin 1, A.1 3, worktree 1); manual 1b–1j read-through done. Note: commit deferred to Phase 3 step 4 per this plan's single-commit instruction (supersedes /implement's per-phase-commit default).

---

## Phase 2 — Register in `/playbook-update` managed list

Edit `.claude/skills/playbook-update/SKILL.md`: insert one line

```
.claude/skills/forge/SKILL.md
```

immediately after `.claude/skills/codex-research/SKILL.md` (currently line 33), keeping the codex/build-lane skills grouped. No other changes to the file.

**Success criteria (Phase 2):**

```bash
grep -n 'forge' .claude/skills/playbook-update/SKILL.md   # exactly one hit, inside the Managed files block (lines ~19-56)
git diff --stat .claude/skills/playbook-update/SKILL.md   # exactly +1 line
```

- [x] Phase 2 complete — one hit at line 34, diff exactly +1 line.

---

## Phase 3 — Acceptance sweep + final verification

1. **AC sweep** — read the finished skill end-to-end and check off all 13 ACs (`tasks/todo.md:429-442`) against the text:

| AC | Satisfied by |
|---|---|
| 1 exists, thin, temporary note | 1a/1b + `wc -l` |
| 2 single pass, no matrix, source read fully | 1d/1e |
| 3 self-summon research, no fixed sweep | 1e |
| 4 design-confirm pause, default ON load-bearing | 1d/1f |
| 5 inline audit→review gates, RUN/SKIP, task-13 triage | 1d/1g |
| 6 verify tests/typecheck | 1d/1g (per cycle) |
| 7 shared plumbing reuse, no duplicated machinery | 1g (reference-reads, trio's own temp schemes/commands) |
| 8 RDPI + skills unchanged; managed list accounts | Phase 2 + git-diff check below |
| 9 seam split, continuation prompt, no new format | 1d/1h |
| 10 Workflow allowed, every agent pins model, invoke = opt-in | 1i |
| 11 routing hierarchy by orchestrator judgment | 1i |
| 12 hard agent cap, leaf-only | 1i |
| 13 gate loop convergence + max-passes cap | 1g |

2. **Purely-additive check (enumerated, not loose):**

```bash
git status --porcelain   # ONLY: ?? .claude/skills/forge/, M .claude/skills/playbook-update/SKILL.md,
                         # and the four named RDPI artifacts (?? tasks/research-codebase.md,
                         # design-decision.md, research-patterns.md, plan.md). Anything else — investigate.
git diff --name-only     # must NOT include CLAUDE.md, codex-audit, codex-review, codex-research, or any other skill
ls tasks/*.tmp 2>/dev/null   # MUST be empty — no stranded gate/review temps
```

3. **Confidentiality re-check:** `grep -rciE 'omk|omakase|fp-rebuild|docs/blueprint|contracts\.md' .claude/skills/forge/` → 0.

4. Commit (conventional, matching task-19/20 style): `feat(skills): add /forge temporary slim build lane for strong-model window (Task 21)`.

- [x] Phase 3 complete — all 13 ACs verified against the text; purely-additive check clean (only forge dir + playbook-update +1 line + the four RDPI artifacts); no stranded tmps; confidentiality grep 0; committed.

---

## Judgment Calls

1. **Line budget ≤110, flag at >120.** Design says ~60–90 plausible; 13 ACs of content make ≤90 unlikely without losing the rule-grade wording the developer explicitly asked for (stop cues, two-sided routing). The ~50-line constraint stays a forcing function, not a pass/fail check.
2. **Gate references name trio steps by number + title** (e.g., "codex-audit Steps 1–4 (run token → output-check + spot-check)") so a future trio renumbering is detectable at read time rather than silently misapplied. Accepts the design's noted runtime-dependency risk (2-week window).
3. **Pre-Edit Gate cited by section name + quoted phrase, not line number** — refines the design's "cite the gate by line" mitigation: the skill propagates to consumer repos where CLAUDE.md's team-filled top half shifts line numbers, so `CLAUDE.md:98` is wrong everywhere but here. Section name + operative quote keeps the design's intent (unambiguous reference) portably.
4. **Managed-list insertion after `codex-research` (line 33)** — groups the lane with its reference specs; the list has no enforced ordering.
5. **Agent caps fixed at ≤4 per phase / ≤2 concurrent** — resolves the design's one non-blocking open question at its stated starting point; fixed-N works under both Agent and Workflow vehicles (budget-scaled would require Workflow-always).
6. **Audit gate runs `passes = 1` per cycle** — the combined /forge cycle (Axis 5b) supersedes codex-audit's native multi-pass loop; running both loops would nest convergence mechanics. The editable-target guard is moot (the target is always on-disk built code).
7. **Convergence record goes in the present output** — answers the patterns-research inspectability concern (auditable record per pass) without creating an artifact or new format.
8. **`when_to_use` included in frontmatter** — pure menu documentation, parity with codex-audit; harmless under `disable-model-invocation: true`.
9. **Pause barred from Workflow scripts** — patterns research: workflows take no mid-run user input; making this explicit prevents a Workflow-enthusiastic session from burying the lane's only human gate.

## Risks folded into the plan

- **Gate-loop thrash** → 2-cycle cap + rule-grade stop cues + exhaustion-is-handoff-not-success (1g).
- **Model-pin erosion** → hard rule stated with its rationale in the skill text (1i).
- **Trio drift during the window** → step number + title references (JC2); accepted per design.
- **Skill-text override failing in a future session** → explicit, quoted, rule-grade override wording (1b).
- **Stale `contracts.md` path / confidentiality** → generic argument examples only; grep checks in Phases 1 and 3, broadened per Codex review to cover stale target paths (`fp-rebuild`, `docs/blueprint`, `contracts.md`).
- **`codex-output-check.sh` false-passes (issue #5)** → inherited mitigation: the trio's spot-check steps are part of the referenced step ranges (audit Step 4, review Step 4) — the skill never skips them.
- **Sub-agent rule conflict (Codex CORRECTION, absorbed)** → CLAUDE.md § Sub-Agent Behaviors says leaf tasks "read, search, and report"; the skill states an explicit leaf-write override for dispatched build/fix agents while keeping the recursion guard in full (1i).
- **Stranded Gate-2 temps on interruption (Codex RISK, absorbed)** → keep codex-review's Step 1 pre-delete + cleanup-on-failure in the referenced delta (1g); Phase 3 adds an explicit `ls tasks/*.tmp` empty check and an enumerated git-status allowance.

## Artifact references

- `tasks/research-codebase.md` — located paths, trio behavior, lifecycle surfaces
- `tasks/design-decision.md` — Option A axis table, refinements, scope
- `tasks/research-patterns.md` — prior-art corroboration (single owner, explicit tiering, capped repair loops, compact handoffs)
