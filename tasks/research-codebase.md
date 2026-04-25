# Research: Tighten subagent guidance across QRSPI commands (Task 4)

## Research Question

Tighten subagent guidance across QRSPI commands so three concrete gaps stop producing uneven sub-agent use in practice:
1. **Split heuristic is vague** — no testable rule for when to spawn separate sub-agents vs. one (`research-codebase.md:68-70`).
2. **No fallback behavior is documented** — when a sub-agent returns incomplete/wrong/contradictory results, Claude has no specified next step beyond the recursion guard (`CLAUDE.md:178`).
3. **Opus 4.7 does not fan out proactively** — generic "in parallel" wording is insufficient; explicit batch instructions are needed.

**Scope of edits (load-bearing):** QRSPI surface only — `research-codebase.md`, `design.md`, `create-plan.md`, `implement.md`, plus `CLAUDE.md` meta-rules and `templates/playbook-sections.md` propagation. Issue-flow commands (`issue-research-codex.md`, `issue-plan.md`, `issue-implement.md`) are paused under Task 6 and inherit this work later. Non-QRSPI `playbook-setup.md` / `playbook-audit.md` use a constrained single-Explore pattern — researched as precedent, edit-eligibility surfaced as an open question (Q1).

## Summary

Sub-agent guidance today is encoded in Markdown command steps and prompt templates — not code. Across the QRSPI surface there are roughly **9 spawn-instruction sites** plus 1 central recursion guard. Every QRSPI site exhibits gaps (a) and (c); most also exhibit gap (b). The central guard at `CLAUDE.md:176-178` only forbids recursion — it does not address split, parallelism, fallback, or output acceptance.

Two structural facts shape the design space:

1. **Codex output has a verification gate (`codex-output-check.sh`); sub-agent output has none.** Codex calls in QRSPI are uniformly preceded by a check script and "spot-check Codex's claims" / "verify before trusting" guidance. Sub-agent calls have neither. The recorded incident in `tasks/errors.md:5-10` (an Explore sub-agent returned schema-wrong hooks guidance that broke a config) is the empirical motivation for closing gap (b).

2. **Opus 4.7 is more literal, follows local instructions strongly, and spawns fewer sub-agents/tool calls by default — but is steerable through explicit prompting.** This shapes both Axis 1 (centralized vs. inline placement) and Axis 3 (parallelism wording). Distant central guidance is not enough; per-site explicit batch wording is the lever. (Codex correction to research prompt: official docs do not support the absolute "Opus 4.7 never fans out" — they support the weaker "default-fewer; steerable.")

The decision space decomposes into **8 independent axes** (placement, split-heuristic shape, parallelism wording, fallback policy, output acceptance criteria, subagent type, surface coverage, treatment of the "Sub-agents are optional" formula). The strongest precedent for the placement question is the historical commit `78c4ec2` ("Optimize RPI sub-agent usage"), which added the recursion guard *both* centrally in `CLAUDE.md` *and* in `templates/playbook-sections.md` — i.e., propagation is part of the surface.

## Detailed Findings

### QRSPI meta layer — `CLAUDE.md`

- **`CLAUDE.md:176-178`** — Only sub-agent rule is the recursion guard ("Sub-agents MUST NOT spawn further sub-agents or follow QRSPI. They are leaf tasks: read, search, and report."). No split heuristic, no fallback policy, no parallelism rule, no output-acceptance gate.
- **`CLAUDE.md:200`** — Session-start validation says "no sub-agents" for the under-30-second checks (negative usage rule).
- **Why it's structured this way:** the recursion guard was added in `78c4ec2` as part of consolidating from a 3-agent research pipeline to a single codebase-explorer. That commit centralized the *only* universal rule. Per-command guidance was left at each spawn site because each command's spawn pattern was different. The result today: the central rule is too thin and per-site rules are vague.
- **Propagation:** `templates/playbook-sections.md:135-137` mirrors the recursion guard verbatim. Any centralized addition has to land in both places to keep new installs and `/playbook-update` flows consistent. Confirmed: `templates/playbook-sections.md:155` mirrors the session-start "no sub-agents" rule.

### QRSPI research — `.claude/commands/research-codebase.md`

Three spawn sites, all default `subagent_type` (no `Explore` specified):

- **`research-codebase.md:68-70`** ("Fill the gaps Codex left"): triggers when "Codex's findings are thin, ambiguous, or where connections are missing." Says "Keep sub-agents focused and parallel — each explores one specific gap." No independence test for "gap." No "single-message batch" wording. No fallback for thin sub-agent output.
- **`research-codebase.md:72-78`** ("Research beyond the codebase"): triggers when an external-research gap remains after Codex `--search`. Spawn condition is sharper here ("Codex coverage thin = fewer than 2 distinct sources" or "findings contradict each other"). Implies one sub-agent per unresolved gap. Inherits "in parallel" from the preceding paragraph but doesn't restate batch wording locally. No fallback.
- **`research-codebase.md:156-160`** (follow-up questions): "Spawn new sub-agents as needed for additional investigation." No split rule, no parallelism, no fallback.
- **`research-codebase.md:163-168`** (Important notes): "Sub-agents are for targeted gap-filling, not broad re-exploration. Sub-agents MUST NOT spawn further sub-agents (recursion guard)."
- **Why it's structured this way:** commit `7b47129` demoted Claude's web sub-agents from primary to fallback after Codex `--search` was added. That cut sub-agent volume but didn't tighten the residual gates. Result: the surviving sub-agent sites are deliberate but under-specified.

### QRSPI design — `.claude/commands/design.md`

- **`design.md:205`** ("Pattern research fallback"): the most heavily-gated spawn site in the codebase. Spawns "if any of the following hold: (a) source count < 2 strong sources, (b) confidence is LOW, (c) any source's read depth is 'superficial' on a topic critical to the chosen approach, or (d) the step-4 spot-check surfaced dead URLs, sources that didn't exist, or claims that didn't hold up." Says "in parallel — one per source gap." Rich trigger conditions; weak parallelism wording; no per-source-dump acceptance criteria; no fallback for thin sub-agent output.
- **`design.md:226`** ("Important notes"): "**Sub-agents are optional** for deep research on a specific technical question, but MUST NOT spawn further sub-agents (recursion guard)."
- **Why it's structured this way:** commit `42827de` replaced Claude's pattern-research child process with a Codex `--search` call, and then commits `7b47129` and following positioned sub-agents as a fallback. The signal-driven trigger gates (source count, confidence, read depth) are inherited from `research-patterns-guide.md:61-64` ("Coverage Assessment" emits `Source count`, `Read depth`, `Confidence`). Per-source-dump acceptance criteria are not specified.
- **Tension:** the "optional" wording at line 226 directly conflicts with the required-on-trigger gate at line 205. Under Opus 4.7's literal-instruction-following bias, this tension can resolve toward the optional reading.

### QRSPI plan — `.claude/commands/create-plan.md`

- **`create-plan.md:37`** (within Phase 3, "Write detailed plan per phase"): "If you encounter something unclear, stop and re-research that specific sub-problem using a sub-agent — do not guess." Single-agent implied; no triggers/criteria; no fallback.
- **`create-plan.md:123`** ("Important notes"): "**Sub-agents are optional** for verifying a specific function or file still exists, but MUST NOT spawn further sub-agents (recursion guard)."
- **Why it's structured this way:** planning is supposed to happen in main context from artifacts. The sub-agent path is a narrow escape hatch for "unclear" sub-problems. The "do not guess" framing implies a forced spawn but the criteria for "unclear" are absent.

### QRSPI implement — `.claude/commands/implement.md`

- **`implement.md:35-53`** (structural mismatch handling): No sub-agent. Uses a top-level Codex `--sandbox read-only` call instead. Line 52 explicitly says "(Sub-agents are no longer used here — Codex sweeps faster on read-only structural questions, and the recursion guard at `CLAUDE.md:178` foreclosed Codex-from-inside-sub-agents anyway.)" Codex output passes through `codex-output-check.sh`.
- **`implement.md:172-174`** ("Important notes"): "**Sub-agents are optional**: Use them sparingly for targeted debugging, never for broad exploration during implementation."
- **Why it's structured this way:** commit `cce1867` replaced the sub-agent debug call with a Codex debug call. This is a *site-specific removal* — strong precedent for Task 4's per-site policy decisions.
- **Tension:** the residual "optional" note at line 174 conflicts with the explicit Codex-instead-of-sub-agent decision two screens above. Same Opus-4.7 literalism risk as `design.md:226`.

### Issue-flow surface — research only, no edits this task

- **`issue-research-codex.md:48`** — sub-agent on Codex inaccuracy. No triggers. No fallback. Same gaps.
- **`issue-research-codex.md:102`** — broader fallback than QRSPI: "If the `codex` command is not found or fails, tell the developer and offer to do the research using Claude sub-agents instead." QRSPI stops on Codex failure; issue-flow offers a sub-agent alternative. Asymmetry worth noting for Task 6 carryover.
- **`issue-plan.md:29, 68`** — mirrors `create-plan.md` exactly.
- **`issue-implement.md:36, 71`** — pre-Task-3 pattern: still uses sub-agents for structural mismatch (rather than Codex). Diverges from current `implement.md` by one major commit's worth of changes.
- **Carryover note:** Task 6 will collapse the `-codex` variants and re-shape these. Whatever Task 4 lands on QRSPI, Task 6 inherits.

### Non-QRSPI precedent — playbook-setup, playbook-audit

- **`playbook-setup.md:40-61`** — single Explore subagent (`subagent_type: "Explore"`, thoroughness: "very thorough"). Prompt explicitly tells the subagent the section list and forbids it from doing anything else.
- **`playbook-audit.md:17-28`** — single Explore subagent. The prompt itself ends "Do NOT spawn sub-agents." (a prompt-side recursion guard).
- **Pattern:** both intentionally *forbid* split. They centralize all exploration into one well-scoped Explore call. Output is consumed in main context; failure mode is parent-developer interaction, not a re-spawn loop.
- **Generalization question:** does this single-Explore pattern solve any of the three Task 4 gaps for QRSPI? Partially: it makes the split decision trivial (always 1) and routes failure through the developer rather than retry logic. But QRSPI gap-filling has a different shape (variable number of independent gaps, often parallelizable), so generalizing setup/audit's pattern would over-constrain QRSPI. They're better treated as a *negative precedent* for QRSPI — confirming that "always 1" is wrong for QRSPI's use case.

### Negative precedent — codex-review

- **`codex-review.md:121`** — "**Sub-agents must not be spawned** (recursion guard)." Whole-command ban. Confirms: there's a precedent for a *forbid* policy at the command level when the work shape doesn't justify sub-agents.

### Codex-side parallels (not Claude sub-agents, but useful precedent)

- **`research-guide.md:13-14`** — Codex prompt itself says "Single-call sweep — no parallel fan-out, per the design's Axis 4 = B framing." This is the Codex-side resolution of a parallelism question. Worth noting that the prompt-template-side is already explicit when explicitness matters.
- **`research-patterns-guide.md:61-64`** — emits `Source count`, `Read depth`, `Confidence` signals. These are the upstream signals that drive `design.md:205`'s gate. Strong precedent for "structured output → trigger gate."

### Empirical evidence of the gap

- **`tasks/errors.md:5-10`** — recorded incident: an Explore sub-agent returned wrong hooks guidance ("top-level `Stop` key"), which failed schema validation. This is the empirical motivation for an output-acceptance gate (gap (b) is not theoretical).
- **`quickref.md:51`** — references `/batch` as "Decompose large changes into parallel sub-agents in isolated worktrees (built-in)." Confirms parallel sub-agents are a Claude Code capability the playbook surfaces elsewhere; just not gated/specified in QRSPI prose.

## Code References

- `CLAUDE.md:176-178` — central recursion guard ("# Sub-Agent Behaviors")
- `CLAUDE.md:200` — session-start "no sub-agents under 30 seconds" rule
- `templates/playbook-sections.md:135-137` — recursion guard mirror (propagation target)
- `templates/playbook-sections.md:155` — session-start mirror
- `.claude/commands/research-codebase.md:68-70` — gap-fill spawn (vague split, no fallback, weak parallelism)
- `.claude/commands/research-codebase.md:72-78` — external-research fallback spawn
- `.claude/commands/research-codebase.md:156-160` — follow-up spawns
- `.claude/commands/research-codebase.md:163-168` — Important notes (recursion + targeted)
- `.claude/commands/design.md:205-207` — pattern-research fallback spawn (richest trigger gate today)
- `.claude/commands/design.md:226` — "Sub-agents are optional" formula
- `.claude/commands/create-plan.md:37` — re-research-on-unclear spawn
- `.claude/commands/create-plan.md:119-123` — "Sub-agents are optional" formula
- `.claude/commands/implement.md:35-53` — Codex replaces sub-agents (precedent for site-specific removal)
- `.claude/commands/implement.md:172-174` — residual "optional" formula (tension with line 35-53)
- `.claude/commands/codex-review.md:121` — explicit forbid ("must not be spawned")
- `.claude/commands/playbook-setup.md:40-61` — single-Explore pattern with prompt-side scoping
- `.claude/commands/playbook-audit.md:17-28` — single-Explore with prompt-side recursion ban
- `.claude/prompts/research-guide.md:13-14` — Codex-side single-call sweep statement
- `.claude/prompts/research-patterns-guide.md:61-64` — Coverage Assessment signal source for `design.md:205`
- `.claude/scripts/codex-output-check.sh` — Codex output gate (no sub-agent equivalent)
- `tasks/errors.md:5-10` — recorded sub-agent bad-output incident
- `quickref.md:51` — `/batch` reference

## Architecture Analysis

The playbook treats sub-agents as **side-channel helpers** in QRSPI: Codex carries the primary research/review work, and sub-agents fill gaps Codex can't or shouldn't (web-source deep reads, code spot-checks, follow-up questions). This is by design — see `feedback_codex_research.md` in user memory ("Codex outperforms Claude at broad research; Claude synthesizes on top") and the commit history (`7b47129`, `42827de`, `cce1867`) reshaping primary research onto Codex.

The **asymmetry between Codex and sub-agent rigor** is the architectural pressure point: Codex calls have temp-file checking (`codex-output-check.sh`), explicit timeouts (10 minutes / 600000ms), prompt templates with structured output requirements, and "spot-check Codex's claims" hygiene. Sub-agent calls have *only* the recursion guard. This asymmetry is what makes gap (b) load-bearing — sub-agents look like first-class workers but ship without first-class verification.

The **placement convention** (where to put cross-cutting rules) has a clear precedent: cross-cutting rules go in `CLAUDE.md` *and* `templates/playbook-sections.md`. Per-command policy goes in the command file. Commit `78c4ec2` is the canonical example — it added the recursion guard to both files, while sub-agent split heuristics ("1-2 / 3-5 / 6+ files") were added to commands. Task 4 should respect this convention: cross-cutting elements (acceptance gate, recursion-compatible fallback, parallelism wording rule) go central; site-specific triggers stay per-site.

The **"Sub-agents are optional" formula** (`design.md:226`, `create-plan.md:123`, `implement.md:174`) is a vestige from a pre-trigger-gate era. It made sense when sub-agents were the only research path; it conflicts now that several sites have explicit *required* trigger conditions. Resolving the tension is part of Task 4's scope.

## Design Axes

### Axis 1: Where shared guidance lives

- **Choices:**
  1. Central only in `CLAUDE.md` + `templates/playbook-sections.md`
  2. Inline only at each spawn site
  3. Central rule + short per-site reference (e.g., "see CLAUDE.md § Sub-Agent Behaviors")
  4. Per-surface split: QRSPI gets central+inline; non-QRSPI keeps local-only
- **Per-axis constraints:** `CLAUDE.md` is loaded every session and must stay concise (project-instructions hint + Anthropic best-practices doc). Any centralized addition must mirror into `templates/playbook-sections.md` (`playbook-update.md:9-44, 111-132` shows how managed files propagate). Opus 4.7's literal-instruction following weakens distant central guidance — pure central placement risks site misses.
- **Evidence:** `CLAUDE.md:3` ("loaded automatically in every session"); commit `78c4ec2` precedent (recursion guard placed in both); `feedback_skill_manual_invocation.md:7-17` (skills surface, also inherits this convention); Opus 4.7 migration docs.

### Axis 2: Split heuristic shape

- **Choices:**
  1. **Gap-inventory rule** — list unresolved gaps first, spawn one sub-agent per *independent* gap, define an independence test (e.g., "gaps are independent if resolving one doesn't change the prompt for another")
  2. **Domain/file-cluster rule** — spawn separately only when gaps touch disjoint file/source clusters; otherwise consolidate
  3. **Source-count rule** (already present in `design.md:205`) — one sub-agent per source URL/source gap
  4. **Single-agent default** — always 1; failure mode is to surface the gap in the artifact rather than split
- **Per-axis constraints:** must be testable (the current "one specific gap" wording fails this). Must respect the recursion guard (`CLAUDE.md:178`) — independence cannot be delegated to sub-agents.
- **Evidence:** `research-codebase.md:68-70` (current vague rule); `design.md:205` (source-gap rule already in use); `playbook-setup.md:42` and `playbook-audit.md:19` (single-agent precedent for non-QRSPI); commit `78c4ec2` (file-count threshold "15+ files across multiple unrelated domains" was the prior precedent before recursion-guard rewrite).

### Axis 3: Parallelism wording

- **Choices:**
  1. Generic phrase ("in parallel," current state)
  2. Explicit batch instruction ("send all N Agent invocations in a single tool-call batch / single message")
  3. Per-site batch block with example invocation count
  4. No parallelism wording at single-agent sites
- **Per-axis constraints:** under Opus 4.7, "in parallel" alone is unreliable; explicit batch wording is needed. Wording must be re-statable at each spawn site (Opus 4.7 literalism + central guidance distance). For single-agent sites (e.g., `create-plan.md:37`), parallelism wording is unnecessary and may confuse.
- **Evidence:** Anthropic parallel-tool-use docs (https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use) — "targeted prompting increases likelihood; weak prompting and incorrect result formatting are causes of failed parallelism." Opus 4.7 migration guide (https://platform.claude.com/docs/en/about-claude/models/migration-guide) — fewer tool calls / sub-agents by default; steerable via prompt.

### Axis 4: Fallback policy shape

- **Choices:**
  1. **Direct verification** — parent reads the cited files/sources directly and supersedes the sub-agent's report
  2. **Bounded re-spawn** — one re-spawn with a tighter prompt; if still bad, escalate to direct verification or surface the gap
  3. **Surface-the-gap** — reject incomplete output, write the unresolved gap into the artifact, do not retry
  4. **Site-specific fallback** — different policy per site (e.g., `design.md` source reads use direct verification; `create-plan.md` file checks use re-spawn-then-direct)
- **Per-axis constraints:** recursion guard at `CLAUDE.md:178` forecloses sub-agent-driven retry chains. Any retry must be parent-driven. Must define a retry cap to prevent loops. Must define what "incomplete" means (links back to Axis 5).
- **Evidence:** `tasks/errors.md:5-10` (incident motivating fallback); QRSPI's "Verify before trusting" pattern at `research-codebase.md:164-165`, `design.md:115-117`, `create-plan.md:95-103`, `implement.md:107-110` (pattern for parent-driven verification on Codex output — directly portable to sub-agents).

### Axis 5: Output acceptance criteria

- **Choices:**
  1. **Citations + line refs** — sub-agent output must include file:line citations or source URLs, or it's rejected
  2. **Structured signals** — output must include confidence/read-depth signals like `research-patterns-guide.md:61-64`'s Coverage Assessment
  3. **Contradiction analysis** — output must explicitly reconcile or flag contradictions with prior Codex/parent findings
  4. **Minimal freeform** — current state, no acceptance gate
- **Per-axis constraints:** acceptance criteria must be defined *in the parent's spawn prompt* (recursion guard means sub-agents can't self-validate). Must be checkable by the parent without re-running the sub-agent.
- **Evidence:** `research-patterns-guide.md:61-64` (Coverage Assessment is in-codebase precedent for structured signals); `research-codebase.md:133-138` (artifact requires source URLs + Unblocks labels — same shape applies to sub-agent output).

### Axis 6: Subagent type selection

- **Choices:**
  1. **Default/general-purpose** everywhere (current state for QRSPI gap-fills)
  2. **`Explore`** for read-only codebase verification (already used in `playbook-setup.md`, `playbook-audit.md`)
  3. **Default for external/web reads, `Explore` for codebase reads** (split by work shape)
  4. **Codex (not sub-agents) for structural/debug** — already chosen for `implement.md` per commit `cce1867`
- **Per-axis constraints:** `Explore` is read-only and optimized for code search/exploration per Anthropic docs (https://code.claude.com/docs/en/sub-agents). `Explore` is *not* documented to have web-fetch; external-source-deep-read sub-agents need a type with web access. Default/general-purpose has broader tool access but may be slower for pure code reads.
- **Evidence:** `playbook-setup.md:42`, `playbook-audit.md:19` (Explore precedent for read-only code work); `research-codebase.md:74-78` (external-source-read sites currently leave type unspecified — works because default has web access).

### Axis 7: Surface coverage (which files Task 4 edits)

- **Choices:**
  1. QRSPI-only: `research-codebase.md`, `design.md`, `create-plan.md`, `implement.md`, `CLAUDE.md`
  2. QRSPI + `templates/playbook-sections.md` (propagation)
  3. QRSPI + non-QRSPI (`playbook-setup.md`, `playbook-audit.md`)
  4. Defer all and merge with Task 6
- **Per-axis constraints:** user directive scopes to QRSPI surface only for now (issue-flow paused under Task 6). `templates/playbook-sections.md` propagation is required if `CLAUDE.md` changes (commit `78c4ec2` precedent). Non-QRSPI's single-Explore pattern is intentionally different and shouldn't inherit gap-filling guidance.
- **Evidence:** `tasks/todo.md:24` (Task 6 collapses issue flow); `tasks/todo.md:40` (Task 7 ports to skills); user-directive scope note; `playbook-update.md:9-44` (managed-file propagation).

### Axis 8: Treatment of "Sub-agents are optional" formula

- **Choices:**
  1. Preserve wording but qualify with required-trigger gates (e.g., "Optional in general; required when [trigger] holds.")
  2. Replace with conditional required/forbidden rules (e.g., "Required when [trigger]; forbidden when [other trigger]; optional otherwise.")
  3. Remove the formula from `implement.md:174` since Codex now owns the structural-debug case (commit `cce1867`)
  4. Keep verbatim — accept the tension as documentation drift
- **Per-axis constraints:** the formula appears in `design.md:226`, `create-plan.md:123`, `implement.md:174`, `issue-plan.md:68`, `issue-implement.md:71`. Issue-flow occurrences are out of scope (Task 6). Tension exists between "optional" and the required-trigger gate at `design.md:205` and "do not guess" at `create-plan.md:37`.
- **Evidence:** all five spawn sites listed; Opus 4.7 literalism interaction with conflicting instructions.

## Axis Coupling

- **Axis 1 (placement) × Axis 3 (parallelism wording):** if Axis 1 = central-only, Axis 3 must use the strongest possible central phrasing *plus* a short per-site reference. Opus 4.7 literalism makes pure central placement risky for steering parallel fan-out; the reference is a re-statement that fires locally. Reference: `CLAUDE.md:3` (always loaded) + Anthropic parallel-tool-use docs.

- **Axis 2 (split shape) × Axis 3 (parallelism wording):** if Axis 2 = single-agent-default (Choice 4), Axis 3's parallelism wording is unnecessary at those sites. Conversely, if Axis 2 = gap-inventory or source-count (Choices 1 or 3), each site that *can* spawn >1 needs explicit batch wording or fan-out fails. Reference: `design.md:205` (the only site today that uses "in parallel — one per source gap" — already a partial coupling).

- **Axis 2 (split shape) × Axis 6 (subagent type):** if Axis 2 = source-count rule and the sub-agent must fetch external URLs, Axis 6 narrows away from `Explore` (which is read-only / code-focused per Anthropic docs) toward default/general-purpose. Reference: `research-codebase.md:74-78` (current external-source pattern leaves type unspecified, which works because default has web tools).

- **Axis 4 (fallback) × Axis 5 (acceptance criteria):** Axis 4 needs Axis 5 to define what "incomplete" or "wrong" means before fallback can fire. If Axis 4 = bounded re-spawn (Choice 2), Axis 5 must include a retry-cap input (otherwise the gate can loop). Reference: recursion guard at `CLAUDE.md:178` forbids sub-agent-driven retry; parent must own the cap.

- **Axis 7 (surface) × Axis 1 (placement):** if Axis 7 = QRSPI-only, the central placement (Axis 1) should still cover the universal rules (recursion-compatible fallback, parallelism wording rule, output-acceptance shape) — a non-QRSPI command picking up QRSPI guidance later (e.g., during Task 6 carryover) inherits the central rules without re-deriving them. Reference: commit `78c4ec2` precedent (recursion guard centralized even though only QRSPI commands needed it at the time).

- **Axis 7 (surface) × Axis 8 (optional formula):** if Axis 7 = QRSPI-only, Axis 8 leaves the formula in issue-flow files untouched. Task 6 inherits the resolution. Reference: `issue-plan.md:68`, `issue-implement.md:71`.

- **Axis 8 (optional formula) × Axis 2/4 (split + fallback):** if Axis 8 = preserve-with-qualifier (Choice 1), Axes 2 and 4 must define when "optional" becomes "required" by a failed gate — otherwise the optional reading wins under Opus 4.7 literalism. Reference: `design.md:205` (required gate) vs. `design.md:226` (optional formula) — current contradiction.

## Cross-Cutting Constraints

- **Recursion guard is non-negotiable.** Any fallback policy must be parent-driven, not sub-agent-driven. Reference: `CLAUDE.md:178`, `templates/playbook-sections.md:137`.
- **Codex leads research.** Sub-agents are gap-fillers on top of Codex, not primary explorers. Reference: `feedback_codex_research.md` in user memory.
- **Manual invocation only for workflow skills.** Skills carrying Task 4's guidance under Task 7 will set `disable-model-invocation: true`. Reference: `feedback_skill_manual_invocation.md`.
- **`CLAUDE.md` stays concise.** Anthropic best-practices doc — every line of central guidance has weight. Favor referenced rules over verbose central prose.
- **Managed-file propagation.** `CLAUDE.md` changes mirror to `templates/playbook-sections.md`. Command files propagate wholesale through `playbook-update.md`. Reference: `playbook-update.md:9-44, 111-132`.
- **Sub-agent prompts are self-contained.** Sub-agents start fresh and only receive the Agent prompt string per Anthropic docs. Acceptance criteria must be in the spawn prompt, not the sub-agent. Reference: https://code.claude.com/docs/en/agent-sdk/subagents.
- **Sub-agent output has no verification gate today.** Codex has `codex-output-check.sh`; sub-agents have nothing equivalent. Closing this gap is the structural goal of (b).

## External Research

- **Claude Code subagents docs** — `Explore` is read-only and optimized for file/code search; `general-purpose` is broader; subagents cannot spawn other subagents (matches our recursion guard); subagents start fresh and only receive the Agent prompt string. Source: https://code.claude.com/docs/en/sub-agents
  - **Unblocks:** Axis 6 (type selection) — confirms `Explore` vs. default trade-off; Axis 4 (fallback) — confirms parent-driven retry is the only viable shape.

- **Claude Agent SDK subagents docs** — multiple subagents can run concurrently; only channel from parent to subagent is the Agent prompt; context isolation is structural. Source: https://code.claude.com/docs/en/agent-sdk/subagents
  - **Unblocks:** Axis 3 (parallelism phrasing) — concurrency is supported by the platform; Axis 5 (acceptance criteria) — must be in the prompt because there is no other channel.

- **Claude Opus 4.7 migration guide / model docs** — Opus 4.7 follows instructions more literally, makes fewer tool calls by default, and spawns fewer subagents by default; behavior is steerable through explicit prompting. Sources: https://platform.claude.com/docs/en/about-claude/models/migration-guide and https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7
  - **Unblocks:** Axis 1 (placement) — confirms distant central guidance is risky; Axis 3 (parallelism phrasing) — confirms explicit batch wording is the lever.
  - **Correction to research prompt:** docs do not support an absolute "Opus 4.7 never fans out" — they support the weaker, more accurate "default-fewer; steerable via prompt." Task 4 plan should use the steering framing, not an absolutist one.

- **Parallel tool-use docs** — targeted prompting increases parallel-tool-call likelihood; weak prompting and incorrect result formatting are documented causes of failed parallelism. Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use
  - **Unblocks:** Axis 3 (parallelism wording) — directly supports explicit-batch over generic "in parallel."

- **Claude Code best practices** — `CLAUDE.md` is loaded each session but should stay concise; subagents help when investigation would flood main context. Source: https://code.claude.com/docs/en/best-practices
  - **Unblocks:** Axis 1 (placement) — central-vs-inline trade-off; Axis 7 (surface coverage) — subagent-vs-Codex routing context.

## Risk Analysis

- **Acceptance-gate omission is empirically validated.** `tasks/errors.md:5-10` records a wrong Explore sub-agent output that broke a config. Without an acceptance gate (Axis 5), this can recur silently — no temp-file equivalent exists.
- **Generic "in parallel" wording is likely too weak for Opus 4.7.** Multiple sites today use this wording (`research-codebase.md:69-70`, `design.md:205`). Without explicit batch wording, fan-out can degrade to sequential under Opus 4.7's default behavior — costing wall-clock time on research-heavy phases.
- **Central-only guidance can be missed at spawn sites.** Opus 4.7's literal-instruction-following weights local instructions strongly. A central rule without a per-site reference may not fire at the spawn site. (Axis 1 / Axis 3 coupling.)
- **Templates propagation is a recurring failure mode.** Editing `CLAUDE.md` without updating `templates/playbook-sections.md` leaves new installs and `/playbook-update` flows stale. Commit `78c4ec2` is precedent for getting this right (both edited together); subsequent commits have occasionally drifted.
- **Generalizing setup/audit's single-Explore pattern to QRSPI would over-constrain QRSPI.** Their work shape is fundamentally one-shot context-gathering, not gap-filling. Cross-pollination should go the other direction at most: lessons from setup/audit (always-1, prompt-side scoping) inform QRSPI's *single-agent* sites only.
- **The "Sub-agents are optional" formula's tension can resolve toward optional under Opus 4.7.** When `design.md:205` says required-on-trigger and `design.md:226` says optional, literal reading + recency bias picks the closer instruction. Axis 8 must resolve this rather than leave the contradiction in place.
- **Issue-flow asymmetry can leak into Task 6 carryover.** `issue-research-codex.md:102` ("offer to do the research using Claude sub-agents instead" if Codex fails) is broader than the QRSPI fallback. If Task 4 lands a tight fallback policy on QRSPI, Task 6's port should reconcile this asymmetry — call it out so Task 6 doesn't blindly carry the QRSPI policy without reviewing the issue-flow's more permissive fallback.

## Open Questions

1. **Should `playbook-setup.md` and `playbook-audit.md` get the new fallback policy?** Their single-Explore pattern doesn't have a fallback today either (`tasks/errors.md:5-10`'s incident is from one of these flows or a similar Explore call). User scope says QRSPI-only for now, but the fallback gap exists there too. Surface for developer to decide: include in Task 4 scope, or defer to a separate small task.

2. **Which `subagent_type` should QRSPI external-source sites use?** `research-codebase.md:74-78` currently leaves it unspecified. Default works (has web tools) but a deliberate choice (default vs. an explicit type) is part of Axis 6. Worth resolving in `/design`.

3. **Pre-PR check: has Task 6 landed in the meantime?** Per the user's directive, before opening the PR, re-check `origin/main` — if Task 6 has merged while Task 4 was in flight, extend the same guidance to the new integrated issue commands (`/issue-research`, `/issue-plan-review`, `/issue-code-review` or whatever Task 6 produced). If Task 6 is still pending, scope stays QRSPI-only.

4. **Retry cap (if Axis 4 = re-spawn):** if the design picks the bounded-re-spawn fallback, what's the cap? 1 re-spawn? 2? This is a small but load-bearing parameter for `/design` to settle.
