# Plan: Task 23 — Multi-model workflow routing (CLAUDE.md Workflow section + recursion-guard upgrade + /forge rewrite)

**Design decision:** Option B — builder-aligned with the uniform-tools amendment (`tasks/design-decision.md` § Decision). 13-axis shared spine + all three agent templates gain `Edit, Write, LSP, WebFetch, WebSearch` + routing-aware description amendment + docs scope 16(c).
**Research:** `tasks/research-codebase.md`.
**Branch:** `worktree-task-23`. Commit after each phase (conventional commits); phases 1–4 each leave the repo internally consistent **at their commit boundary** — within a phase, make all file edits in one tight batch and run the phase's success criteria immediately after. The criteria double as resume detectors: when resuming mid-task, run the current phase's success criteria first to locate which edits landed (e.g., CLAUDE.md edited but mirror not yet).

## Corrections to input artifacts (verified against live files, 2026-06-11)

1. **`codex-xhigh.md` has no explicit-request clause.** Research Finding 6b and the design's "append to the existing explicit-request clause" mechanism rest on the claim that all three templates' descriptions end with "Use only when explicitly requested…". Verified false for `codex-xhigh.md:3`, which ends "Use for hard analysis/synthesis leaves; slower and heavier on quota than codex." — the append mechanism cannot apply to that file. **Resolution (per Codex plan review):** honor the design's all-three intent with a tailored amendment — `codex.md` and `gemini-flash.md` get the designed append; `codex-xhigh.md` gets a rewritten use-sentence that adds routing awareness AND fixes a second staleness the review caught: "analysis/synthesis leaves" no longer describes its role once the routing table sends deep-reasoning/contract-defining **build** seams to it. Exact wording in Phase 2b.
2. **Developer guard text drops the RDPI prohibition.** The current guard says "MUST NOT spawn further sub-agents **or follow RDPI**"; the replacement text covers only spawning. Skills and forge (`forge/SKILL.md:61` "no following RDPI") rely on the RDPI prohibition. **Resolution:** minimal adaptation reinstates it as an absolute (the orchestrator grant exempts only spawning, never RDPI) — see the Phase 1 drafted text.

## Scope boundaries (from `tasks/design-decision.md` § What We're NOT Doing)

- Trio skills untouched — gates stay on Bash `codex exec`; no `codex-invoke` contract.
- No RDPI skill edits (AC6) — their guard restatements describe the ungranted default, which remains true; inheritance is by reading CLAUDE.md, governed by the precedence sentence. **/implement must not "fix" them.**
- No env sniffing, no settings `env`, no auto-relaying; no relay/launcher/doctor changes; agent-type names and model IDs frozen.
- No new shipped files — `playbook-update` managed list unchanged. No `playbook-setup/SKILL.md` edit.
- No orchestration/interaction tools (Agent, Skill, AskUserQuestion, Task\*) and no NotebookEdit on any template. Template body prompts unchanged.
- Forge's Step 4 triage-bucket wording untouched beyond the per-type Verify change (task 13 soft collision — independent sections).
- README edits serve the playbook repo only; consumers own theirs.

---

## Phase 1 — CLAUDE.md routing layer + mirror

**Files:** `CLAUDE.md` (Sub-Agent Behaviors block at `:178-190`; insertion point after the `---` at `:191`), `.claude/templates/playbook-sections.md` (same block at `:137-148`; insertion after the `---` at `:150`).

### 1a. Replace the recursion guard (both files)

Replace the single guard line (`CLAUDE.md:180` / `playbook-sections.md:139`):

> **Recursion guard:** Sub-agents are leaf tasks (read, search, report): they MUST NOT follow RDPI, and MUST NOT spawn sub-agents unless their spawn prompt explicitly grants the orchestrator role. The grant is non-transitive: an orchestrator spawns leaves only (max depth: parent → orchestrator → leaf).
>
> Grant the role only for adaptive investigation — when each next spawn depends on the previous result and the lead's accumulated context doesn't serialize well (deep debugging, unfamiliar-code archaeology). If the fan-out is plannable up front, don't grant: have the lead return a work-list as structured output and spawn its items from the parent or workflow script.

Adaptations from the developer text, both minimal: (i) RDPI prohibition reinstated as an absolute (Correction 2); (ii) restructured so the grant clause unambiguously exempts only spawning.

### 1b. Fix the intra-block self-reference (both files)

`CLAUDE.md:189` / `playbook-sections.md:148` — change "(recursion guard at `CLAUDE.md:178`)" to "(the recursion guard above)". Line refs are best-effort in consumer repos; we're editing the block anyway (Axis 5b).

### 1c. Insert the `# Workflow` section (both files)

Top-level sibling immediately **after** the Sub-Agent Behaviors block's closing `---` (before the Quality Standards block — in CLAUDE.md that block is wrapped in `<important if="completing a task">`; the new section is NOT wrapped, matching its sibling Sub-Agent Behaviors). End the new section with its own `---` separator. Identical text in both files. Drafted text (final wording — small copyedits during /implement are fine; every named rule must survive):

```markdown
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
```

### Success criteria (Phase 1)

```bash
# Old guard text gone from both files
grep -rn "MUST NOT spawn further sub-agents or follow RDPI" CLAUDE.md .claude/templates/playbook-sections.md   # → no matches
# Line-ref self-reference replaced in both
grep -rn "recursion guard at" CLAUDE.md .claude/templates/playbook-sections.md                                  # → no matches
# Section present with required elements, both files
grep -c "agentType" CLAUDE.md .claude/templates/playbook-sections.md       # ≥4 each
grep -n "Freedom clause\|Standing request\|Skill precedence\|Writer grant\|Per-lane fallback\|Reviewer ≠ author\|authoring chain" CLAUDE.md .claude/templates/playbook-sections.md
# Mirror equality: Sub-Agent Behaviors → end of Workflow section identical in both files
# (strip the <important> wrapper and blank lines, which differ legitimately around Quality Standards)
diff <(sed -n '/^# Sub-Agent Behaviors/,/^# Quality Standards/p' CLAUDE.md | grep -v '^<\/\?important' | grep -v '^$') \
     <(sed -n '/^# Sub-Agent Behaviors/,/^# Quality Standards/p' .claude/templates/playbook-sections.md | grep -v '^$')   # → empty
# AC2 sweep: list every guard restatement; confirm each describes the ungranted default (no edits needed outside forge)
grep -rn -i "recursion guard\|must not spawn" .claude/skills/*/SKILL.md
```

The AC2 sweep is a read-and-confirm step: every hit outside `forge/SKILL.md` restates "sub-agents must not spawn sub-agents," which remains the true ungranted default — leave them. Only forge contradicts (fixed in Phase 3).

**Commit:** `feat(claude-md): add Workflow routing section + orchestrator-grant recursion guard (+ mirror)` — ✅ done, all criteria pass (mirror diff empty; AC2 sweep confirmed read-only)

---

## Phase 2 — Agent templates (uniform tools + routing-aware descriptions)

**Files:** `.claude/templates/native-agents/agents/codex.md`, `codex-xhigh.md`, `gemini-flash.md` (frontmatter only; body prompts unchanged).

### 2a. Tools line — identical on all three (line 5 in each)

```
tools: Read, Edit, Write, Glob, Grep, LSP, WebFetch, WebSearch, Bash
```

### 2b. Description amendments — all three (Correction 1 applies)

- `codex.md:3` — final clause becomes: "Use only when explicitly requested for codex-powered workflow agents, or routed by a project's CLAUDE.md Workflow/routing section."
- `gemini-flash.md:3` — final clause becomes: "Use only when explicitly requested for gemini-powered workflow agents, or routed by a project's CLAUDE.md Workflow/routing section."
- `codex-xhigh.md:3` — no explicit-request clause exists to append to; its use-sentence is rewritten routing-aware instead (and un-staled — the routing table now sends deep-reasoning **build** seams here, not just analysis/synthesis): "Use for hard analysis/synthesis leaves and deep-reasoning or contract-defining build seams — e.g. routed by a project's CLAUDE.md Workflow/routing section; slower and heavier on quota than codex."
- All three keep the relayed-session requirement and contained-error warning verbatim (the doctor relies on that framing).

### Success criteria (Phase 2)

```bash
# Explicit per-file loop — fails loudly on any single template, never masked by the others
for f in codex codex-xhigh gemini-flash; do
  t=.claude/templates/native-agents/agents/$f.md
  grep -q "^tools: Read, Edit, Write, Glob, Grep, LSP, WebFetch, WebSearch, Bash$" "$t" || echo "FAIL tools: $f"
  grep -q "CLAUDE.md Workflow/routing section" "$t"                                     || echo "FAIL routing-clause: $f"
  grep -q "Requires a relayed session" "$t"                                             || echo "FAIL relay-warning: $f"
  grep -q "contained model error" "$t"                                                  || echo "FAIL error-warning: $f"
done   # → no FAIL lines
# No other site quotes the old tools line or contradicts the new one (doctor/drift-checklist check)
grep -rn "Read, Glob, Grep, Bash" .claude/ README.md quickref.md   # → no remaining references to the old line
grep -n "tools" .claude/skills/native-agents/SKILL.md              # → read hits; confirm none asserts the old tools list
```

**Commit:** `feat(native-agents): uniform builder tools + routing-aware descriptions on agent templates` — ✅ done, all criteria pass (no FAIL lines; no stale old-tools refs)

---

## Phase 3 — `/forge` rewrite (piece-agnostic, dispatch-led)

**File:** `.claude/skills/forge/SKILL.md`. A section-by-section rewrite — the structural survivors (Pre-Edit Gate override `:13`, design-confirm pause `:35-37`, gate cycle on `codex exec` `:41-44`, shared triage `:45` (wording untouched — task 13), convergence rules `:48`, present/continuation discipline `:50-53`, Important notes `:63-68`) keep their content with only the deltas below.

### 3a. Frontmatter + intro

- `description:` (line 3) → "Piece-agnostic single-pass build lane — Frame the piece (code or artifact), dispatch Build per the CLAUDE.md Workflow routing (Codex workers build code; artifacts follow the authoring chain), then run the Codex gate cycle and per-type verify."
- `when_to_use:` (line 6) → "Manual only: use when the developer invokes /forge on a piece — code or artifact."
- Intro (line 11) → rewrite: collapses RDPI into **one dispatch-led pass** — the orchestrator frames, composes the dispatch, coordinates seams, and reviews; workers build. Keep: "for the piece: **$ARGUMENTS**", the governing principle (re-grounded: scaffolding scales inversely with model strength — here the strength is the orchestrator plus routed frontier workers), and "RDPI itself is unchanged and runs alongside this lane."
- Add one sentence (intro or Important notes): chained runs — `/forge` a spec today, `/forge` the code from it later, run 1's output as run 2's source — are one common pattern, an emergent usage, never a prescribed two-step or one internal authorship pipeline (AC7).
- Lane shape (line 15) → "Frame → compose dispatch → Build (dispatched) → optional design-confirm pause → gate cycle(s) (audit → review → triage → apply → verify) → present." Seam/phase splitting sentence survives.

### 3b. Step 1 Frame — second classification dimension + per-type verify plan + composition

Keep intent/ACs and load-bearing/conform-only. Add:
- **Deliverable type:** code / artifact (spec, doc, plan) / other. Open list — an "other" piece gets a Frame-declared verify plan rather than a forced fit.
- **Per-type verify plan recorded at Frame:** code → the repo's test/typecheck commands (as today); artifact → the upstream source list (Gate 1's fidelity audit needs it) plus an internal-consistency/cross-reference check plan; other → declared explicitly.
- **Dispatch composition (Frame's call, announced as a one-line judgment call):** sequential seams / parallel lanes / single worker (mechanics in 3e). For artifact pieces, announce the authoring-chain ideation RUN/SKIP alongside the existing gate RUN/SKIP plan.

### 3c. Step 2 Build — dispatched, not model-led

Rewrite around dispatch; the orchestrator does not write the deliverable (non-relayed fallback excepted):
- **Code pieces:** each seam goes to a Codex worker (`agentType: codex`; deep-reasoning or contract-defining seams → `codex-xhigh`) per the Frame composition. The **seam brief** is the load-bearing serialization: intent + ACs, settled contracts, files in scope, test commands, and the acceptance contract (citations; flag contradictions). Workers MAY write the files their brief names (writer grant).
- **Artifact pieces:** the authoring chain — ideation dump RUN/SKIP per Frame (RUN: apply `codex-research`'s SKILL.md inline; kept doc under `tasks/logs/research/`; `codex-xhigh` for hard strategy) → **Opus authors** (`model: opus`) the deliverable from the dump + sources → the orchestrator reviews in the main loop. Reviewer ≠ author at every link; both gates still run on the Opus-authored artifact.
- **Survivors, re-aimed at the orchestrator:** bounded-surface rule (`:31` — grounding reads feed seam briefs), mid-Build escape hatch (`:32`), and the codex-research auto-fire note (`:33`) stay as orchestrator behaviors.

### 3d. Step 4 deltas — per-type Verify; convergence per type

- Gates unchanged (Bash `codex exec`, trio specs inline, deltas as written). Triage bucket text untouched.
  > **Deviation (post-review):** "deltas as written" left Gate 1's delta code-narrowed ("target = the code just built"), contradicting per-type Verify for artifact pieces. Codex code review caught it; fixed to per-type target/sources (and "phase 1's code" → "phase 1's build" in Step 3) in `fix: apply code review revisions`. The shared-triage "actual code first" wording stays byte-identical per the task-13 constraint — flagged to the developer instead.
- Apply routing (`:46`): keep — A.1 inline by default; bounded fixes may route to an Opus sub-agent (`model: opus`).
- **Verify (`:47`) becomes per-type:** code → Frame-recorded tests/typecheck every cycle (as today). Artifact → Gate 1's fidelity audit doubles as the source-fidelity verify (never run a second Codex audit for Verify); Verify proper = the orchestrator-run internal-consistency/cross-reference pass from the Frame plan. Other → run the Frame-declared plan. Unclear-failure escalation path survives.
- Convergence (`:48`): "checks pass" = the piece's per-type verify passing; cap and residual-delta rules unchanged.

### 3e. Orchestration & routing — full replacement of `:55-61`

Replacement text (final wording; copyedits fine, every named rule must survive):

```markdown
## Orchestration & routing

- Routing inherits CLAUDE.md § Workflow — the role table allocates; this section states only forge-specific deltas. **HARD RULE: every spawned agent — Agent tool or Workflow `agent()` — pins `agentType` or `model` explicitly; none inherit.** The harness default inherits the main-loop model; under a top-tier session that silently spawns a session-model swarm.
- **Composition (Frame's call, per piece):** sequential seams via the Agent tool (phase N+1 sees N's output — the default); parallel Workflow lanes ONLY for genuinely independent seams touching disjoint file sets, each lane with `isolation: 'worktree'`; a single worker for narrow pieces. **Merge-back is orchestrator-owned:** nothing merges lane worktrees automatically — the orchestrator merges each lane's branch back before any gate runs.
- **Hierarchy:** the orchestrator (session model) owns the spine — Frame, composition, design-confirm, gates, triage, merge-back, presentation — and is never spawned as a worker. **Codex** builds all code seams (`agentType: codex`; deep-reasoning or contract-defining seams → `codex-xhigh`). **Opus** (`model: opus`) takes delegated review legwork on Codex output and bounded gate fixes. **Gemini Flash** (`agentType: gemini-flash`) takes small/repetitive support work and fetching. **Sonnet** (`model: sonnet`) only with a named harness need. Two-sided: contract-touching or subtle work never drifts down a tier out of cost habit — it goes to `codex-xhigh` and back through orchestrator review.
- **Caps + leaf rule:** hard cap ≤4 sub-agents per phase, ≤2 concurrent — coordination bounds: workers are cheap, the cap bounds chaos and review bandwidth, not spend. `codex-xhigh` counts double toward the concurrency cap. Sub-agents are leaves (CLAUDE.md's recursion guard — forge grants no orchestrator roles); gate Codex runs are Bash calls from the orchestrator, not sub-agents; gates run strictly sequentially in the main loop even when build lanes parallelize (codex-review's fixed `tasks/`-top-level tmp names collide otherwise); never sub-split one interdependent phase.
- **Writer grant (leaf-write override):** explicitly dispatched build and fix workers are **granted writers, not granted orchestrators** — they MAY write the files their seam brief names; ordinary leaves stay read/search/report; no grant is transitive. The writer grant does not exempt a worker from the routing table.
- **Fallback (non-relayed session or lane down):** the first `agentType` spawn failing fast (contained model error) marks that lane down for the session. With the codex lane down, forge degrades to its previous shape — the orchestrator builds in the main loop, Opus takes straightforward conform-only seams and bounded fixes, Sonnet takes trivial mechanical writes (stubs, boilerplate — never logic). Gates are unaffected: they run on Bash `codex exec`, which does not depend on the relay. Note the degraded shape in the phase presentation.
```

### 3f. Step 5 — continuation prompt carries routing state

Extend the carried-state list (`:53`) with: the dispatch composition, the seam → worker map (which seams went to which `agentType`/`model`), any open parallel-lane worktree status (merged or pending), and any lanes marked down. Still never raw file contents.

### Success criteria (Phase 3)

```bash
grep -n "Fable" .claude/skills/forge/SKILL.md                 # → no Fable-spawn allowance; at most "session model" phrasing
grep -n "model-led" .claude/skills/forge/SKILL.md             # → no matches
grep -n "pins \`agentType\` or \`model\`" .claude/skills/forge/SKILL.md   # → present (HARD RULE covers both keys)
grep -n "agentType: codex\|codex-xhigh\|gemini-flash" .claude/skills/forge/SKILL.md   # → hierarchy present
grep -n "deliverable type\|authoring chain\|writer grant\|merge" .claude/skills/forge/SKILL.md -i   # → all present
grep -n "isolation: 'worktree'" .claude/skills/forge/SKILL.md  # → parallel-lane rule present
grep -n "degrades\|lane down" .claude/skills/forge/SKILL.md    # → fallback paragraph present
grep -n "codex exec" .claude/skills/forge/SKILL.md             # → gates still exec-based
git diff --stat                                                # → only forge/SKILL.md changed this phase
```

Plus a full read of the rewritten skill end-to-end: lane shape ↔ steps ↔ orchestration consistent; triage wording byte-identical to before (task 13).

**Commit:** `feat(skills): rewrite /forge as piece-agnostic dispatch-led orchestration` — ✅ done, all criteria pass (triage byte-identical; full-read consistency confirmed). Minor adaptation: continuation prompt's "test/typecheck commands" generalized to "the Frame-recorded per-type verify plan" for piece-agnostic consistency (3f extends, 3b/3d define per-type).

---

## Phase 4 — Docs sweep

**Files:** `README.md`, `quickref.md`.

- `README.md:47` `/forge` row → "Piece-agnostic build lane — Frame → dispatch-led Build (Codex workers build code; artifacts follow the authoring chain) → Codex gate cycle (audit → review → triage → per-type verify)".
- `README.md:100` workflow blurb — replace the "two-agent handshake" sentence: keep "Every phase pairs Claude's synthesis with an independent Codex cross-check"; recast the handshake as the author-never-reviews-own-work rule and add: "With `/native-agents` installed, CLAUDE.md's Workflow section extends it to a three-family allocation — Codex builds, Claude audits and synthesizes, Gemini Flash takes volume work and third-family verification."
- `README.md:86` (native-agents section) — append one cross-ref sentence: "Once installed, CLAUDE.md's Workflow section routes delegated work across the lanes by default (Codex = coding, Opus = audit/synthesis, Gemini Flash = volume/fetch); stock sessions fall back to Claude-only routing per the same section."
- `quickref.md:28` `/forge` row → "Piece-agnostic build lane: Frame → dispatched Build (Codex workers / authoring chain) → Codex gate cycle → per-type verify".

### Success criteria (Phase 4)

```bash
grep -n "two-agent handshake" README.md                        # → no matches (recast)
grep -n "single-pass build lane built for the strong-model window" README.md quickref.md   # → no matches
grep -n "Workflow section" README.md                           # → blurb + native-agents cross-ref present
grep -rn -i "handshake\|recursion\|model-led" quickref.md      # → no stale hits needing rewording
```

**Commit:** `docs: update /forge rows and workflow blurb for three-family routing` — ✅ done, all criteria pass

---

## Phase 5 — Local propagation + end-to-end verification (no repo diff)

Machine-local exercise of the propagation chain (design Coupling 2). No commit.

> ✅ Phase 5 run 2026-06-11. Whole-diff audit clean vs merge base ae6a168 (main moved ahead 3 docs commits — new-issues/todo deltas are main-side). AC map verified. **Deviation:** the agent-copy `cp` was denied by the auto-mode classifier (agent-config self-modification); read-only classification confirmed all 6 installed copies are STOCK — developer runs the sync command (handed off in the present step).

1. **Sync installed agent copies — diff-gated, never blind** (matches install's diff-and-confirm posture: project copies per `native-agents/SKILL.md:79,84`; user-level copies are classify-per-file, never silently overwritten, per `:86-88,194-198`). A copy is overwritten only if it matches the **stock prior template** (i.e., it is install-owned and unmodified); anything else is reported to the developer with its diff, decision theirs:
   ```bash
   for f in codex codex-xhigh gemini-flash; do
     for dest in ~/.claude/agents /Users/chief/Projects/Tools/playbook/.claude/agents; do
       [ -f "$dest/$f.md" ] || continue
       if diff -q <(git show main:.claude/templates/native-agents/agents/$f.md) "$dest/$f.md" >/dev/null 2>&1; then
         cp ".claude/templates/native-agents/agents/$f.md" "$dest/$f.md" && echo "UPDATED: $dest/$f.md"
       else
         echo "CUSTOMIZED — left untouched, ask developer: $dest/$f.md"
       fi
     done
   done
   # Post-sync: every updated copy matches the new template exactly
   for f in codex codex-xhigh gemini-flash; do
     for dest in ~/.claude/agents /Users/chief/Projects/Tools/playbook/.claude/agents; do
       [ -f "$dest/$f.md" ] && { diff -q ".claude/templates/native-agents/agents/$f.md" "$dest/$f.md" >/dev/null 2>&1 || echo "DIVERGENT: $dest/$f.md"; }
     done
   done   # → DIVERGENT only for copies deliberately left customized
   ```
   Notes: both locations are gitignored machine-local config; updates reversible via `git show main:...`. Agent types register at session start (`native-agents/SKILL.md:128`), so the running session won't reflect the new tools — the live check is a `/native-agents doctor` run in a fresh relayed session, post-merge (user-run; out of this plan's scope). Consumers get the change via `/playbook-update`'s re-install nudge (`playbook-update/SKILL.md:133`) — already in place, no edit needed.
2. **Whole-diff audit:** `git diff main --stat` → exactly: `CLAUDE.md`, `.claude/templates/playbook-sections.md`, 3 × `.claude/templates/native-agents/agents/*.md`, `.claude/skills/forge/SKILL.md`, `README.md`, `quickref.md` (plus `tasks/` artifacts). Anything else violates AC6/surgical-changes — revert it.
3. **Acceptance-criteria read-through** (map below) + full read of both edited CLAUDE.md blocks and the forge skill.

### AC coverage map

| AC | Where satisfied |
|---|---|
| AC1 — Workflow section, all named elements | Phase 1c (role table + cues, authoring chain, never-spawn rule, reviewer≠author, explicit-pin, fast-fail fallback, freedom clause, trio pointer) |
| AC2 — guard replaced; no contradicting refs | Phase 1a/1b + sweep; forge re-derivation in Phase 3e |
| AC3 — both edits mirrored | Phase 1 (identical text both files; diff check) |
| AC4 — forge dispatch-led: composition, Codex build w/ xhigh split, no Fable spawns, Opus audit/bounded-fix, Gemini/Sonnet slots, main-loop pause+verify, in-skill fallback | Phase 3c/3d/3e |
| AC5 — frontmatter/description + README row | Phase 3a + Phase 4 |
| AC6 — no other skill touched | Scope boundaries + Phase 5 whole-diff audit |
| AC7 — piece-agnostic: deliverable-type Frame, authoring chain w/ gates intact, per-type Verify, chained-runs as example | Phase 3a/3b/3c/3d |
| Design Option B — uniform tools line + routing-aware descriptions on all three templates | Phase 2a (tools) + 2b (descriptions, incl. tailored codex-xhigh) |

---

## Judgment Calls

1. **Full text drafted in-plan for CLAUDE.md** (Workflow section + guard) — the highest-drift-risk wording is pinned at plan time; forge sections are specced as deltas with the contract-heavy Orchestration & routing drafted verbatim. Alternative: directive-only specs throughout (rejected — wording IS the deliverable here).
2. **`codex-xhigh.md` gets a tailored routing-aware rewrite, not the append** (Correction 1, revised per Codex plan review) — the file has no explicit-request clause to append to, and its "analysis/synthesis leaves" use-sentence is stale once the routing table sends deep-reasoning build seams to it. All three descriptions end routing-aware, honoring the design's all-three intent.
3. **RDPI prohibition reinstated in the guard** (Correction 2) — kept absolute; the grant exempts only spawning.
4. **Section heading is `# Workflow`**, unwrapped (no `<important if=…>`), matching its sibling Sub-Agent Behaviors. Alternative `# Workflow Routing` is more grep-distinct from "# RDPI Workflow Rules" but deviates from the design's chosen name.
5. **Writer-grant bullet added at routing level** (not only in forge) — the table routes write-work to Codex globally, so the guard's "read, search, report" framing needed the bridge where dispatch is defined; forge's leaf-write override becomes an application of it (Coupling 9 vocabulary).
6. **Propagation done by diff-gated `cp`**, not a `/native-agents install` re-run (skills aren't slash-invoked mid-task) and not a blind copy — install's own posture is diff-and-confirm with customization-aware handling of user-level copies (`native-agents/SKILL.md:79,86-88,194-198`); only stock install-owned copies are overwritten, customized ones are surfaced to the developer.
7. **Phase order CLAUDE.md → templates → forge → docs** — forge cites the new section/guard, docs describe the rewritten forge; each phase leaves the repo consistent.
8. **Template body prompts unchanged** ("return your result as plain text… Do not spawn sub-agents") — still correct for writers (final message is text; leaves stay leaves); design scoped templates to frontmatter only.

## Risks folded into the plan

- **Undocumented `model:` passthrough breaks** → fallback worded first-class in both CLAUDE.md (per-lane bullet) and forge (3e fallback paragraph); doctor remains the detector.
- **Accidental session-model swarms** → explicit-pin promoted to CLAUDE.md (1c) and kept as forge's HARD RULE covering both keys (3e); forge's Fable-spawn allowance removed.
- **Skill pins vs the table** → precedence sentence (1c) answers OQ2 "yes".
- **Per-lane partial degradation misread as broken install** → per-lane wording in both sites; lanes named independent.
- **Continuation prompts strand a lane** → routing state added to the carried list (3f).
- **Unowned worktree merge-back** → orchestrator-owned, before gates, stated in 3e.
- **Same-family review regression** → reviewer≠author stated in the table where dispatch happens.
- **Task 13 collision** → triage wording byte-identical (Phase 3 success criterion).
- **WebSearch through the relay unverified** → ships anyway per design; contained per-lane failure; doctor probe is a deferred follow-up (not in this plan).

## Artifact references

- `tasks/research-codebase.md` — axes, couplings, findings, guard-reference inventory
- `tasks/design-decision.md` — Option B + uniform-tools amendment; What We're NOT Doing
