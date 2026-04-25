# Design: Tighten subagent guidance across QRSPI commands (Task 4)

## Context

Three concrete gaps in QRSPI sub-agent guidance produce uneven sub-agent use in practice:

1. **Split heuristic is vague** — no testable rule for when to spawn separate sub-agents vs. one (`research-codebase.md:68-70`).
2. **No fallback behavior is documented** — when a sub-agent returns incomplete/wrong/contradictory results, Claude has no specified next step beyond the recursion guard (`CLAUDE.md:178`).
3. **Opus 4.7 does not fan out proactively** — generic "in parallel" wording is insufficient; explicit batch instructions are needed.

**Scope (load-bearing):** QRSPI surface only — `research-codebase.md`, `design.md`, `create-plan.md`, `implement.md`, `CLAUDE.md`, plus `templates/playbook-sections.md` propagation. Issue-flow commands are paused under Task 6 and inherit this work later. `playbook-setup.md` / `playbook-audit.md` use a constrained single-Explore pattern intentionally — surfaced as Open Question Q1.

**Cross-cutting constraints from research:**
- Recursion guard at `CLAUDE.md:178` is non-negotiable. Any fallback must be parent-driven.
- Codex leads research; sub-agents are gap-fillers, not primary explorers.
- `CLAUDE.md` must stay concise (every line of central guidance has weight).
- Managed-file propagation: `CLAUDE.md` changes mirror to `templates/playbook-sections.md` (commit `78c4ec2` precedent).
- Sub-agent prompts are self-contained — acceptance criteria must be in the spawn prompt, not the sub-agent.
- Sub-agent output has no verification gate today (asymmetry with Codex's `codex-output-check.sh`).
- Opus 4.7 follows local instructions strongly; distant central guidance is steering-weak.

**Research:** `tasks/research-codebase.md`

## Options Considered

### Option A — Lean central + per-site one-liner

**Axis-choice combination:** A1=3 (central + short per-site reference), A2=1 (gap-inventory split), A3=2 (explicit batch wording, central), A4=1 (parent direct verification), A5=1 (citations/line-refs required), A6=3 (Explore for code, default for web), A7=2 (QRSPI + templates), A8=1 (preserve "optional" with qualifier).

**How it works:**
- Add a new "Sub-Agent Use" subsection under `# Sub-Agent Behaviors` in `CLAUDE.md` (and mirror to `templates/playbook-sections.md`) with four rules: (i) split test ("spawn N sub-agents only if you can write N independent prompts where each result is usable without the others"); (ii) parallelism rule ("when spawning ≥2 sub-agents, send all Agent calls in a single message"); (iii) acceptance gate ("sub-agent output must include file:line citations or source URLs; reject and re-verify directly if missing"); (iv) fallback rule ("if the output is rejected, the parent reads the cited files/sources directly — never re-spawn for the same gap").
- At each QRSPI spawn site, replace the existing vague guidance with one short reference: `(See CLAUDE.md § Sub-Agent Use.)` Plus the site-specific trigger that already exists (e.g., `design.md:205`'s coverage gates).
- Resolve the "Sub-agents are optional" formula at `design.md:226`, `create-plan.md:123`, `implement.md:174` by qualifying it: "Optional in general; required when [site-specific trigger holds]."

**Trade-offs:**
- **Good:** smallest text footprint; single source of truth; easy to update; respects the "CLAUDE.md stays concise" constraint; matches the `78c4ec2` precedent of centralizing universal rules.
- **Bad:** the per-site one-liner is the weakest steering signal for Opus 4.7. Anthropic's Opus 4.7 migration docs and parallel-tool-use docs both say local prompting is the lever — a "see § X" pointer is closer to "central only" in practice than the precedent suggests, because the model has to traverse a reference rather than read the rule in place.
- **Risk:** under Opus 4.7 literalism, the spawn-site one-liner may not actually fire the central rule. Empirically, the recorded incident at `tasks/errors.md:5-10` happened despite the existence of `CLAUDE.md` — i.e., distant rules don't reliably catch misbehavior at spawn time.

### Option B — Per-site full inline, no central additions

**Axis-choice combination:** A1=2 (inline only), A2=1 applied per-site (gap-inventory at `research-codebase.md`; the source-count rule at `design.md:205` is just gap-inventory specialized to "one source URL = one gap"; `create-plan.md:37` collapses to a degenerate single-gap case), A3=3 (per-site batch block with example), A4=4 (site-specific fallback), A5=1 (citations/line-refs), A6=3 (Explore for code, default for web), A7=1 (QRSPI-only, no templates change), A8=2 (replace optional formula with conditional required/forbidden).

**How it works:**
- Leave `CLAUDE.md` and `templates/playbook-sections.md` untouched (recursion guard already covers the universal rule). No propagation overhead.
- Each QRSPI spawn site gets a self-contained block: trigger conditions → split rule → batch wording with example invocation count → acceptance criteria → fallback for that specific site.
- For example, `research-codebase.md:68-70` becomes a 6-8-line block: "Spawn one Agent per independent gap (test: each gap's prompt and result must be usable without the others). When spawning ≥2, send all Agent calls in a single message — example: 3 parallel Agent invocations in one tool-use batch. Each sub-agent must return file:line citations. If output lacks citations or contradicts Codex's findings, the parent reads the cited files directly — do not re-spawn."
- `design.md:205` gets a similar tailored block; `create-plan.md:37` gets a single-agent block (no parallelism wording).
- Replace `design.md:226` / `create-plan.md:123` / `implement.md:174` "optional" formulas with explicit conditionals.

**Trade-offs:**
- **Good:** strongest steering signal under Opus 4.7 literalism — rules are at the spawn point, no traversal needed. No `CLAUDE.md` size pressure. No templates propagation step.
- **Bad:** duplication across 4 commands. If a universal rule needs to change (e.g., the parent-verification fallback), 4 sites must be edited consistently. No central source of truth means Task 6's issue-flow port has to derive the same shape from scratch.
- **Risk:** drift over time — sites can diverge subtly. Departs from the `78c4ec2` precedent of centralizing cross-cutting rules.

### Option C — Central + per-site full restatement (redundant for Opus 4.7)

**Axis-choice combination:** A1=4 (per-surface split: QRSPI gets central + inline restatement; non-QRSPI keeps local-only), A2=1 (gap-inventory split), A3=2 (explicit batch wording, central + per-site), A4=1 (parent direct verification, retry cap = 0), A5=1+3 (citations + contradiction flag), A6=3 (Explore for code, default for web; `implement.md` keeps Codex for structural — Choice 4 applied at that one site), A7=2 (QRSPI + templates), A8=2 at `design.md:226` and `create-plan.md:123` (conditional required/forbidden) + A8=3 at `implement.md:174` (remove formula entirely — Codex now owns the structural-debug case per commit `cce1867`).

**How it works:**
- Add "Sub-Agent Use" subsection in `CLAUDE.md` + `templates/playbook-sections.md` (mirroring) with four concise central rules: split test, batch instruction, acceptance contract (citations + contradiction flag), parent-only fallback (no re-spawn).
- At each QRSPI spawn site, fully restate the executable parts in 3-6 lines — not a one-liner pointer. Sites: `research-codebase.md:68-70` (gap-fill spawn), `research-codebase.md:72-78` (external-research spawn), `research-codebase.md:156-160` (follow-up spawns), `design.md:205` (pattern-research fallback spawn), `create-plan.md:37` (re-research-on-unclear spawn — single-agent shape, omit batch wording).
- Per-site restatement covers: trigger (site-specific) → split test (restated) → batch wording (restated, only at fan-out sites) → acceptance criteria (restated) → fallback (restated). Length ceiling: 6 lines per site to limit drift.
- Resolve "optional" formula:
  - `design.md:226` and `create-plan.md:123` — replace with conditional ("Required when [trigger]; otherwise forbidden / not used.").
  - `implement.md:174` — remove entirely. Codex took over structural debug at `implement.md:35-53` per commit `cce1867`; the residual "optional" line is documentation drift that conflicts with the explicit Codex routing two screens above.
- The redundancy (central + per-site) is intentional: central rule is the source of truth for Task 6 / future commands; per-site restatement is the steering signal for Opus 4.7.

**Trade-offs:**
- **Good:** strongest steering signal AND single source of truth. Matches the `78c4ec2` precedent (centralize cross-cutting rules) AND the Opus 4.7 evidence (per-site presence steers literal-instruction-following). Future commands (Task 6 issue-flow port, Task 7 skill port) inherit the central rule without re-deriving it.
- **Bad:** more text overall — both `CLAUDE.md` (modestly) and each spawn site grow. If rules change, must update central + 5 sites consistently. Larger diff.
- **Risk:** consistency burden — the per-site restatements must stay in sync with the central rule. Mitigation: keep the central rule terse (one bullet per rule) and per-site restatement short (3-6 lines, not a paragraph) — a regenerable shape.
- **Risk (raised by Codex cross-check):** `implement.md:174` cannot just be qualified as in Option A; the underlying mechanism it gates (sub-agents for structural debug) was removed in commit `cce1867`. Qualifying it would re-introduce a vestigial path. Removal is the technically correct edit at that site, hence the per-site Axis 8 refinement.

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)
- None.

### Non-blocking (can resolve during implementation)
- [ ] **Q1 (from research):** Should `playbook-setup.md` / `playbook-audit.md` get the new fallback policy? **Resolved as out of scope** — research at `tasks/research-codebase.md:71-76` documents the single-Explore pattern as intentional, and Task 4 scope is QRSPI-only. Defer to a separate task if the developer wants to extend.
- [ ] **Q2 (from research):** **Resolved as A6=3** — `Explore` for local code reads (precedent: `playbook-setup.md:42`, `playbook-audit.md:19`), default/general-purpose for external/web reads (precedent: `research-codebase.md:74-78` already works because default has web tools).
- [ ] **Q3 (from research):** Pre-PR check — re-verify `origin/main` for Task 6 status. Local evidence (`tasks/todo.md:24` sequencing prose, `auto-issues.md` still calling `issue-*-codex` commands) confirms Task 6 has not landed. PR-time check, not a design blocker.
- [ ] **Q4 (from research):** **Resolved as retry cap = 0** — Axis 4 = Choice 1 (parent direct verification). No re-spawn, no cap needed. Direct verification beats bounded re-spawn on simplicity and recursion-guard compatibility.
- [ ] Per-site restatement length — working ceiling is 6 lines. Confirm during plan phase that all 5 spawn sites can be restated within that ceiling without omitting required parts.

## What We're NOT Doing

- **Not editing issue-flow commands** (`issue-research-codex.md`, `issue-plan.md`, `issue-implement.md`) — paused under Task 6.
- **Not editing non-QRSPI commands** (`playbook-setup.md`, `playbook-audit.md`, `codex-review.md`) unless Q1 resolves to "include." Their patterns are intentionally different.
- **Not introducing a `subagent-output-check.sh` script** as a sub-agent equivalent of `codex-output-check.sh`. Sub-agent output goes to the parent's context, not a temp file — verification is a parent-side reading task, not a script gate.
- **Not changing the recursion guard** at `CLAUDE.md:178`. The guard is correct; the design adds *around* it (split, parallelism, fallback, acceptance), not in place of it.
- **Not adding a retry mechanism.** The recursion guard forecloses sub-agent-driven retry; the design uses parent direct-verification on bad output and surfaces unresolved gaps in the artifact (Axis 4 = Choice 1).

## Decision

**Chosen approach:** Option C — Central + per-site full restatement (with the Codex-surfaced refinements absorbed: A1 re-labeled to 4, A8 split per-site, per-site restatement capped at 6 lines).

**Rationale:**

1. **Codebase pattern match.** Commit `78c4ec2` is the canonical precedent for cross-cutting sub-agent rules: it placed the recursion guard centrally in `CLAUDE.md` *and* mirrored to `templates/playbook-sections.md`. Option C extends that precedent. Option B departs from it (no central change). Option A nominally extends it but the per-site one-liner is a weaker steering signal than the precedent itself, which had no per-site reference at all (the recursion guard is a hard rule that fires unconditionally — split/parallelism/fallback are conditional and need spawn-site presence).

2. **Steering Opus 4.7 needs spawn-site presence.** Anthropic's Opus 4.7 migration docs and parallel-tool-use docs both establish that local prompting is the lever for steering tool-call behavior. Option A's one-line pointer relies on the model traversing a reference at decision time — empirically, the existing distant central guidance did not prevent the recorded incident at `tasks/errors.md:5-10`. Option C's per-site restatement removes the traversal.

3. **Single source of truth for downstream work.** Task 6 (issue-flow port), Task 7 (skill port), and any future QRSPI-adjacent commands need a canonical rule to inherit from. Option B's site-only inline rules force downstream tasks to re-derive the shape; Option C provides the central canonical version.

4. **Codex cross-check materially refined the choice.** Codex independently arrived at Option C's shape, then surfaced three corrections that improve implementability: (a) re-labeling A1 from 3→4 since full per-site restatement is per-surface split, not "central + reference"; (b) Option B's A2 label is incorrect (the named choice is gap-inventory applied per-site, not "site-specific"); (c) `implement.md:174` cannot just be qualified — its underlying mechanism was removed in commit `cce1867`, so it should be removed entirely (Axis 8=3 at that one site). All three are absorbed.

5. **Simplicity heuristic — partial loss, accepted.** Option A is text-simplest. Option C has more text overall but the per-site restatements are bounded (3-6 lines each, 5 sites). The redundancy buys steering reliability that Option A cannot deliver under Opus 4.7. Consistency burden is mitigated by the line ceiling and by keeping the central rule terse (one bullet per rule).

6. **Reversibility heuristic — neutral.** All three options are equally reversible (text edits in Markdown).

**Codex convergence note:** Codex's Phase-3 recommendation was "Option C made implementation-ready," not a different option. The convergence is a confidence signal, but the decision rests on the four prior points — the precedent fit, the Opus 4.7 evidence, downstream-inheritance needs, and the absorbed refinements.
