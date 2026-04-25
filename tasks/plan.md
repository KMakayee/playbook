# Plan: Tighten subagent guidance across QRSPI commands (Task 4)

**Design decision reference:** `tasks/design-decision.md` — Option C (Central + per-site full restatement, with Codex-surfaced refinements: A1=4 per-surface split, A8 split per-site, per-site restatement capped at 6 lines).

**Research artifact:** `tasks/research-codebase.md` (no `tasks/research-patterns.md` — pattern research SKIP'd in design Phase 6; chosen approach extends the `78c4ec2` precedent already documented in research, no external standards / new orchestration involved).

**Plan shape:** single-batch — total diff is 6 markdown files, ~80–120 lines added/changed across documentation. Multi-batch threshold (≥6 fix batches per `CLAUDE.md:140-146`) does not apply. All phases run in one `/implement` cycle.

---

## Goals (acceptance criteria from design)

1. Add a `## Sub-Agent Use` subsection under `# Sub-Agent Behaviors` in `CLAUDE.md` and mirror it to `templates/playbook-sections.md`. Subsection contains four rules: split test, batch instruction, acceptance contract, parent-only fallback. (Closes design gaps a, b, c at the central layer.)
2. At each of the 5 QRSPI spawn sites, restate the executable parts of those rules inline (3–6 lines per site). Each restatement covers: site-specific trigger → split test → batch wording (only at fan-out sites) → acceptance criteria → fallback → subagent type assignment per Axis 6.
3. Resolve the "Sub-agents are optional" formula:
   - `design.md:226` — replace with explicit conditional ("Required when [trigger]; otherwise not used").
   - `create-plan.md:123` — replace with explicit conditional.
   - `implement.md:174` — remove entirely (Codex took over structural debug per commit `cce1867`; no remaining sub-agent path in this command).
4. Preserve the recursion guard at `CLAUDE.md:178` and its mirror at `templates/playbook-sections.md:137` exactly as-is.
5. Maintain consistency with the `78c4ec2` precedent: every change to `CLAUDE.md`'s sub-agent guidance lands in `templates/playbook-sections.md` in the same shape.

## Scope boundaries (from design "What We're NOT Doing")

- **Not editing issue-flow commands** (`issue-research-codex.md`, `issue-plan.md`, `issue-implement.md`) — paused under Task 6.
- **Not editing non-QRSPI commands** (`playbook-setup.md`, `playbook-audit.md`, `codex-review.md`).
- **Not introducing a `subagent-output-check.sh` script.** Sub-agent output goes to the parent's context, not a temp file — verification is parent-side.
- **Not changing the recursion guard** at `CLAUDE.md:178` / `templates/playbook-sections.md:137`.
- **Not adding a retry mechanism.** Axis 4 = Choice 1 (parent direct verification, retry cap = 0). The recursion guard forecloses sub-agent-driven retry.

---

## Phase 1 — Add central "Sub-Agent Use" rules to `CLAUDE.md` and mirror

**Files changed:** `CLAUDE.md`, `templates/playbook-sections.md` (managed-file mirror).

**What changes:**

Insert a new `## Sub-Agent Use` subsection immediately after the recursion-guard line in both files. The recursion guard stays at the top of `# Sub-Agent Behaviors`; the new subsection sits beneath it. Keep the rules terse (one bullet per rule) so the central placement honors the "CLAUDE.md stays concise" constraint.

- In `CLAUDE.md`, insert after line 178 (between the recursion guard and the trailing `---` separator at line 180).
- In `templates/playbook-sections.md`, insert after line 137 (between the recursion guard and the trailing `---` at line 139).

**Proposed text** (identical in both files; wordsmithing OK during implementation as long as the four rules survive):

```markdown
## Sub-Agent Use

When spawning sub-agents in QRSPI commands:

- **Split test:** Spawn N sub-agents only if you can write N independent prompts where each result is usable without the others. If a gap can't be split this way, use one sub-agent.
- **Batch parallel calls:** When spawning ≥2 sub-agents, send all `Agent` calls in a single message (one tool-use batch). "In parallel" alone is not enough — explicit batching is the steering signal.
- **Acceptance contract:** Each spawn prompt must require file:line citations (for code reads) or source URLs (for web reads), and must instruct the sub-agent to flag any contradictions with prior findings.
- **Parent-only fallback:** If output is missing citations/URLs or contradicts prior findings, the parent reads the relevant files/sources directly to fill the gap. Do not re-spawn for the same gap (recursion guard at `CLAUDE.md:178`).
```

**Why these four rules:**

- *Split test* and *batch parallel calls* close design gaps (a) and (c) — testable split heuristic + explicit batch wording for Opus 4.7 literalism.
- *Acceptance contract* and *parent-only fallback* close gap (b) — output verification + recursion-safe fallback. The acceptance contract is in the parent's spawn prompt, per the cross-cutting constraint that sub-agent prompts are self-contained.

**Success criteria:**

- [x] `grep -n "## Sub-Agent Use" CLAUDE.md` returns one match in the `# Sub-Agent Behaviors` section.
- [x] `grep -n "## Sub-Agent Use" templates/playbook-sections.md` returns one match in the same section.
- [x] `grep -n "Recursion guard" CLAUDE.md templates/playbook-sections.md` still returns the original recursion-guard text in both files (preserved verbatim).
- [x] All four rules present in `CLAUDE.md`: `grep -c -E "Split test:|Batch parallel calls:|Acceptance contract:|Parent-only fallback:" CLAUDE.md` returns 4.
- [x] All four rules present in `templates/playbook-sections.md`: same `grep -c` returns 4.
- [x] `diff <(awk '/^## Sub-Agent Use/,/^---/' CLAUDE.md) <(awk '/^## Sub-Agent Use/,/^---/' templates/playbook-sections.md)` shows no semantic differences (the two subsections are identical content; whitespace is acceptable).

---

## Phase 2 — Per-site restatements in `.claude/commands/research-codebase.md`

**Files changed:** `.claude/commands/research-codebase.md`.

This file has three QRSPI spawn sites. Each gets a per-site restatement capped at 6 lines.

### 2a. Gap-fill spawn — replace lines 68–70

Current text (verbatim, verified at lines 68–70):

```markdown
**Fill the gaps Codex left:**
- Spawn sub-agents to investigate areas where Codex's findings are thin, ambiguous, or where connections are missing.
- Keep sub-agents focused and parallel — each explores one specific gap.
```

Replace with (Axis 2 = gap-inventory; Axis 3 = explicit batch; Axis 5 = citations; Axis 4 = parent direct-verification; Axis 6 = `Explore` for code reads):

```markdown
**Fill the gaps Codex left:**
- Spawn one Agent per *independent* gap — independent means each gap's prompt and result must be usable without the others (split test, see `CLAUDE.md` § Sub-Agent Use).
- When spawning ≥2 sub-agents, send all `Agent` calls in a single message. Use `subagent_type: "Explore"` for code-only gaps.
- Each spawn prompt must require file:line citations and instruct the sub-agent to flag any contradictions with Codex's findings.
- If output lacks citations or contradicts Codex, reject it: the parent reads the relevant files directly to fill the gap — do not re-spawn for the same gap.
```

### 2b. External-research fallback spawn — modify lines 72–78

Current text (verbatim at lines 72–78) keeps its trigger-condition structure. Change *only* the spawn-mechanics sentence at line 75 and add an acceptance/fallback bullet. Preserve lines 73–74 (axis-audit + Codex-first-pass) and lines 76–78 (preferences/linking) unchanged.

Replace line 75 (the "Spawn web research sub-agents only as a fallback…" single bullet) with three short bullets — keeps the trigger conditions intact, splits out the spawn mechanics so the per-site restatement reads as discrete rules:

```markdown
- **Spawn web research sub-agents only as a fallback** when an external-research gap remains after Codex's first pass — either Codex's coverage is thin (fewer than 2 distinct sources for an axis whose viability requires external evidence), its findings contradict each other, or the axis audit surfaced a gap Codex didn't address.
- One sub-agent per unresolved source gap (split test, see `CLAUDE.md` § Sub-Agent Use). When spawning ≥2, send all `Agent` calls in a single message.
- Use the default/general-purpose subagent type so web fetches work — `Explore` is read-only and lacks web tools. Do not re-do work Codex already covered.
```

Then insert a new bullet immediately after the "Prefer official docs…" line (current line 76):

```markdown
- Each spawn prompt must require source URLs and instruct the sub-agent to flag contradictions with Codex's findings. If output lacks URLs or contradicts Codex, the parent reads the relevant sources directly to fill the gap — do not re-spawn.
```

### 2c. Follow-up question spawns — modify lines 156–160

Current text (verbatim at lines 156–160):

```markdown
### 8. Handle follow-up questions
- If the user has follow-up questions, append to the same research document.
- Add a new section: `## Follow-up Research [timestamp]`
- Spawn new sub-agents as needed for additional investigation.
```

Replace the third bullet ("Spawn new sub-agents as needed…") with:

```markdown
- Spawn new sub-agents as needed for additional investigation — one Agent per *independent* follow-up gap (split test, see `CLAUDE.md` § Sub-Agent Use). When spawning ≥2, send all `Agent` calls in a single message; use `subagent_type: "Explore"` for code-only follow-ups, default/general-purpose for follow-ups requiring web fetches.
- Each spawn prompt must require file:line citations (or source URLs for web reads) and instruct the sub-agent to flag contradictions with prior findings. If output lacks citations/URLs or contradicts prior findings, the parent reads the relevant file/source directly to fill the gap — do not re-spawn.
```

### 2d. Important notes — preserve as-is

Do **not** edit lines 163–168 (the `## Important notes` block in `research-codebase.md`). The recursion-guard line at line 168 is correct and needs no change. Lines 164–167 are not "Sub-agents are optional" formulas — they're separate hygiene notes (Codex-leads, Verify-before-trusting, sub-agent scope, line ceiling).

**Success criteria:**

- [x] `grep -n "CLAUDE.md § Sub-Agent Use" .claude/commands/research-codebase.md` returns three matches (one per spawn site: gap-fill, external, follow-up).
- [x] `grep -c "single message" .claude/commands/research-codebase.md` returns 3.
- [x] `grep -c "do not re-spawn" .claude/commands/research-codebase.md` returns 3.
- [x] `grep -c "flag contradictions\|flag any contradictions" .claude/commands/research-codebase.md` returns at least 3 (one per spawn site).
- [x] `grep -c "to fill the gap" .claude/commands/research-codebase.md` returns at least 3 (the parent-fallback target wording).
- [x] Type assignment present at code-only sites: `grep -c "subagent_type: \"Explore\"" .claude/commands/research-codebase.md` returns at least 2 (gap-fill, follow-up).
- [x] Type assignment present at web-fetch sites: `grep -c "default/general-purpose" .claude/commands/research-codebase.md` returns at least 2 (external-research, follow-up).
- [x] `grep -n "Sub-agents MUST NOT spawn further sub-agents" .claude/commands/research-codebase.md` still returns the recursion-guard line at the (now-shifted) "Important notes" position (verify it's preserved).
- [x] Each per-site restatement is ≤ 6 lines long (visual inspection during implementation).

---

## Phase 3 — Per-site restatement + optional-formula resolution in `.claude/commands/design.md`

**Files changed:** `.claude/commands/design.md`.

### 3a. Pattern-research fallback spawn — restructure line 205

Line 205 is currently a single dense bullet (the "Fallback (only if Codex's coverage is thin…)" item). Restructure it to keep the trigger conditions intact while extracting per-site restatement into sub-bullets. Keep the trigger conditions (a)–(d) verbatim — they're the strongest existing trigger gate in the codebase.

Current text (verbatim at line 205):

```markdown
5. **Fallback (only if Codex's coverage is thin or spot-check fails):** read the `## Coverage Assessment` section that Codex produced. Spawn Claude sub-agents in parallel — one per source gap — to deep-read individual sources if **any** of the following hold: (a) source count < 2 strong sources, (b) confidence is LOW, (c) any source's read depth is "superficial" on a topic critical to the chosen approach, or (d) the step-4 spot-check surfaced dead URLs, sources that didn't exist, or claims that didn't hold up against the cited source. Each sub-agent fetches one source and returns a per-source findings dump. Sub-agents MUST NOT spawn further sub-agents (recursion guard at `CLAUDE.md:178`). If Codex's coverage assessment shows ≥2 strong sources at MEDIUM or HIGH confidence with no superficial reads AND the step-4 spot-check passed, skip this step.
```

Replace with:

```markdown
5. **Fallback (only if Codex's coverage is thin or spot-check fails):** read the `## Coverage Assessment` section that Codex produced. Spawn Claude sub-agents to deep-read individual sources if **any** of the following hold: (a) source count < 2 strong sources, (b) confidence is LOW, (c) any source's read depth is "superficial" on a topic critical to the chosen approach, or (d) the step-4 spot-check surfaced dead URLs, sources that didn't exist, or claims that didn't hold up against the cited source. If Codex's coverage assessment shows ≥2 strong sources at MEDIUM or HIGH confidence with no superficial reads AND the step-4 spot-check passed, skip this step.

   When spawning, follow `CLAUDE.md` § Sub-Agent Use restated for this site:
   - One sub-agent per source gap (split test specialized to source-count). When spawning ≥2, send all `Agent` calls in a single message.
   - Use the default/general-purpose subagent type so web fetches work — `Explore` is read-only and lacks web tools.
   - Each spawn prompt must require source URLs in the per-source findings dump and instruct the sub-agent to flag contradictions with Codex's coverage assessment.
   - If output lacks URLs or contradicts Codex, the parent reads the relevant sources directly to fill the gap — do not re-spawn. Sub-agents MUST NOT spawn further sub-agents (recursion guard at `CLAUDE.md:178`).
```

### 3b. Optional formula — replace line 226

Current text (verbatim at line 226):

```markdown
- **Sub-agents are optional** for deep research on a specific technical question, but MUST NOT spawn further sub-agents (recursion guard).
```

Replace with (Axis 8 = Choice 2, conditional required/forbidden):

```markdown
- **Sub-agents:** Required for the pattern-research fallback when the Step 6 trigger conditions hold (see Step 6, item 5). Otherwise not used in this command. Sub-agents MUST NOT spawn further sub-agents (recursion guard).
```

**Success criteria:**

- [x] `grep -n "CLAUDE.md § Sub-Agent Use" .claude/commands/design.md` returns one match (in the Step 6 fallback block).
- [x] `grep -c "single message" .claude/commands/design.md` returns 1.
- [x] `grep -c "do not re-spawn" .claude/commands/design.md` returns 1.
- [x] `grep -c "default/general-purpose" .claude/commands/design.md` returns 1 (web-fetch type assignment).
- [x] `grep -c "flag contradictions" .claude/commands/design.md` returns 1 (acceptance contract).
- [x] `grep -c "to fill the gap" .claude/commands/design.md` returns 1 (parent-fallback target wording).
- [x] `grep -c "Sub-agents are optional" .claude/commands/design.md` returns 0.
- [x] `grep -n "Sub-agents:" .claude/commands/design.md` returns the new conditional line in `## Important notes`.
- [x] Trigger conditions (a)–(d) at the fallback site are preserved verbatim.
- [x] Recursion-guard reference (`CLAUDE.md:178`) still appears in the fallback block.

---

## Phase 4 — Per-site restatement + optional-formula resolution in `.claude/commands/create-plan.md`

**Files changed:** `.claude/commands/create-plan.md`.

### 4a. Re-research-on-unclear spawn — replace line 37

Current text (verbatim at line 37):

```markdown
   - If you encounter something unclear, stop and re-research that specific sub-problem using a sub-agent — do not guess.
```

Replace with a main bullet plus three nested sub-bullets (single-agent shape per Axis 3 = Choice 4 at single-agent sites; omit batch wording):

```markdown
   - If you encounter something unclear, stop and re-research that specific sub-problem using a single sub-agent — do not guess. Follow `CLAUDE.md` § Sub-Agent Use, restated here for this site:
     - Use `subagent_type: "Explore"` for code-only checks (verifying a function or file exists, reading a small section).
     - The spawn prompt must require file:line citations and instruct the sub-agent to flag any contradictions with the plan's premise.
     - If output lacks citations or doesn't resolve the question, the parent reads the relevant files directly to answer it — do not re-spawn.
```

### 4b. Optional formula — replace line 123

Current text (verbatim at line 123):

```markdown
- **Sub-agents are optional** for verifying a specific function or file still exists, but MUST NOT spawn further sub-agents (recursion guard).
```

Replace with (Axis 8 = Choice 2, conditional):

```markdown
- **Sub-agents:** Required when re-researching an unclear sub-problem during plan drafting (see Step 2, item 3). Otherwise not used in this command. Sub-agents MUST NOT spawn further sub-agents (recursion guard).
```

**Success criteria:**

- [ ] `grep -n "CLAUDE.md § Sub-Agent Use" .claude/commands/create-plan.md` returns one match.
- [ ] `grep -c "subagent_type: \"Explore\"" .claude/commands/create-plan.md` returns 1 (code-only type assignment).
- [ ] `grep -c "flag any contradictions\|flag contradictions" .claude/commands/create-plan.md` returns 1 (acceptance contract at the spawn site).
- [ ] `grep -c "to answer it" .claude/commands/create-plan.md` returns 1 (parent-fallback target at this site — phrased as "answer the question" since the trigger is "unclear sub-problem").
- [ ] `grep -c "Sub-agents are optional" .claude/commands/create-plan.md` returns 0.
- [ ] `grep -n "Sub-agents:" .claude/commands/create-plan.md` returns the new conditional in `## Important notes`.
- [ ] No "single message" / batch wording present (single-agent site, per design Axis 3 = Choice 4 at this site).

---

## Phase 5 — Remove vestigial optional-formula in `.claude/commands/implement.md`

**Files changed:** `.claude/commands/implement.md`.

### 5a. Remove line 174 entirely

Current text (verbatim at line 174):

```markdown
- **Sub-agents are optional**: Use them sparingly for targeted debugging, never for broad exploration during implementation.
```

**Action:** Delete this bullet entirely. (Axis 8 = Choice 3 at this one site.) Rationale: per commit `cce1867`, `implement.md:35-53` replaced the sub-agent debug call with a top-level Codex call, and line 52 explicitly says "Sub-agents are no longer used here." The residual line 174 is documentation drift that conflicts with the explicit Codex routing two screens above. Removing it eliminates the contradiction.

After removal, the surrounding bullets at lines 172, 175–177 close up:

```markdown
## Important notes

- **Triage is the key step.** The parent session decides *what* to fix. The child process decides *how*. Write precise fix instructions — vague instructions produce vague fixes.
- Codex reviews, Claude triages, child fixes. Not everything Codex flags needs fixing — use judgment. When in doubt, flag rather than fix.
- If `codex` or `claude` is not found or fails, stop and tell the developer to fix it before proceeding.
```

**No other edits to `implement.md`.** Lines 35–53 (the Codex structural-mismatch block, including line 52's "Sub-agents are no longer used here") stay untouched — they already encode the correct behavior.

**Success criteria:**

- [ ] `grep -c "Sub-agents are optional" .claude/commands/implement.md` returns 0.
- [ ] `grep -n "Sub-agents are no longer used here" .claude/commands/implement.md` still returns the line at (approximately) line 52 — preserved.
- [ ] `grep -n "## Important notes" .claude/commands/implement.md` still returns one match.
- [ ] No new sub-agent wording added (this phase only removes).

---

## Cross-phase verification (run after Phase 5)

These checks confirm the four design goals hold across all touched files.

- [ ] **Optional formula eliminated from QRSPI commands:** `grep -rn "Sub-agents are optional" .claude/commands/research-codebase.md .claude/commands/design.md .claude/commands/create-plan.md .claude/commands/implement.md` returns 0 matches.
- [ ] **Issue-flow files untouched:** `git diff --name-only main -- .claude/commands/issue-research-codex.md .claude/commands/issue-plan.md .claude/commands/issue-implement.md` returns no output. (These are paused under Task 6.)
- [ ] **Non-QRSPI files untouched:** `git diff --name-only main -- .claude/commands/playbook-setup.md .claude/commands/playbook-audit.md .claude/commands/codex-review.md` returns no output.
- [ ] **Recursion guard preserved verbatim:** `grep -n "Sub-agents MUST NOT spawn further sub-agents or follow QRSPI" CLAUDE.md templates/playbook-sections.md` returns one match in each file.
- [ ] **Central rule mirrored:** the `## Sub-Agent Use` subsection is present in both `CLAUDE.md` and `templates/playbook-sections.md` with the same four rules (visual diff during implementation).
- [ ] **Per-site restatements present at all 5 spawn sites:** `grep -rn "CLAUDE.md § Sub-Agent Use" .claude/commands/research-codebase.md .claude/commands/design.md .claude/commands/create-plan.md` returns 5 matches total (3 in research-codebase.md, 1 in design.md, 1 in create-plan.md).
- [ ] **Per-site rule-presence audit (manual, ≤ 5 minutes).** For each of the 5 spawn sites, read the inserted block and confirm all four rule elements are present in proximity to the spawn-site trigger:
  1. **Split test** — restated or referenced ("one Agent per independent gap", "one sub-agent per source gap", "single sub-agent", or `CLAUDE.md` § Sub-Agent Use reference).
  2. **Batch wording** — `single message` (omit at the single-agent site `create-plan.md:37`).
  3. **Acceptance contract** — citations/URLs requirement AND contradiction-flagging instruction, both stated in the spawn prompt.
  4. **Parent-only fallback** — `do not re-spawn` AND a fallback target ("the parent reads … directly to fill the gap" or "to answer it").
  Sites: `research-codebase.md` gap-fill (lines ~68–72), `research-codebase.md` external-research (lines ~72–80), `research-codebase.md` follow-up (lines ~156–162), `design.md` pattern-research fallback (lines ~205–214), `create-plan.md` re-research (lines ~37–41).
- [ ] **No `subagent-output-check.sh` script created:** `ls .claude/scripts/subagent-output-check.sh 2>/dev/null` returns nothing (out-of-scope item per design).
- [ ] **No new files created** outside the 6 listed: `git status --short` shows changes only to `CLAUDE.md`, `templates/playbook-sections.md`, `.claude/commands/research-codebase.md`, `.claude/commands/design.md`, `.claude/commands/create-plan.md`, `.claude/commands/implement.md`, plus the `tasks/` artifacts.

---

## Pre-PR check (per design Open Question Q3)

Before opening the PR for this task, run `git fetch origin main && git log --oneline origin/main ^HEAD -- .claude/commands/issue-*.md` to check whether Task 6 (issue-flow consolidation) has merged on `main` while Task 4 was in flight.

- **If Task 6 has not landed:** the QRSPI-only scope holds; proceed to PR.
- **If Task 6 has landed:** STOP and update this plan to add a new phase covering the integrated issue commands (with its own file-level specifics, success criteria, and stale-reference audit). Do NOT extend the pattern on the fly during the PR window — the design's scope was QRSPI-only, and silently expanding it bypasses the per-site verification this plan relies on.

---

## Judgment Calls

These are choices the plan made where an alternative was viable. Each is traceable to a specific design axis or constraint, but Codex review should evaluate them on independent technical merit.

1. **Phasing by file, not by axis.** I split phases per *file touched* (Phases 1–5 = central + 4 command files) rather than per *design axis* (e.g., one phase for "all split-test changes," one for "all batch-wording changes"). Per-file phasing keeps each commit minimal and self-contained, and matches the implementation reality that each spawn site needs all 4 rules restated together. Per-axis phasing would touch many files in each phase and produce broken intermediate states (e.g., after a "split test only" phase, sites would have new split rules but no fallback).

2. **Mirror placement in `templates/playbook-sections.md`.** I placed the new `## Sub-Agent Use` subsection inside the existing `# Sub-Agent Behaviors` block in both `CLAUDE.md` and `templates/playbook-sections.md`. Alternative: a top-level `# Sub-Agent Use` heading. The subsection placement matches the `78c4ec2` precedent (recursion guard nested under the same header) and avoids fragmenting sub-agent rules across two top-level sections.

3. **`subagent_type` assignment per site (Axis 6 = Choice 3).** Used `Explore` for code-only sites (research-codebase.md gap-fill, create-plan.md re-research) and default/general-purpose for sites that may need web fetches (research-codebase.md external-research, research-codebase.md follow-ups when web is needed, design.md pattern-research fallback). Alternative: leave type unspecified and let the implementer pick at spawn time. Specifying per-site removes a recurring micro-decision and rules out the failure mode where someone picks `Explore` for a web-fetch site (it lacks web tools per Anthropic docs cited in research line 237–238).

4. **Per-site restatement length cap = 6 lines.** Inherited from design's working ceiling. All 5 sites fit within the cap as drafted (gap-fill: 4 bullets; external-research: 3 replacement bullets + 1 new bullet, all short lines; follow-up: 2 bullets; design pattern-research: 4 sub-bullets; create-plan re-research: 1 main bullet + 3 nested sub-bullets). Alternative: drop the cap, allow longer per-site blocks. Keeping the cap limits drift between the central rule and per-site restatements, which is the main maintenance risk identified in design.

5. **Phase 1 lands first.** Central edits happen before per-site restatements so the per-site `CLAUDE.md § Sub-Agent Use` references resolve to a real subsection at every intermediate state. Alternative: per-site first, central last. The chosen ordering ensures each commit leaves the codebase coherent.

6. **`implement.md:174` is removed in its own phase, not folded into Phase 1's central edit.** Removal is a per-site Axis 8 decision that's logically independent of the central addition. Keeping it as Phase 5 makes the diff more reviewable (one phase, one file, one logical change).

7. **No `subagent-output-check.sh` script.** Already declared out-of-scope in the design (the asymmetry with Codex is real but doesn't justify a new script — sub-agent output goes to the parent's context, so verification is parent-side reading, not a temp-file gate).

8. **Single-batch plan, not multi-batch.** Total diff is ~80–120 lines across 6 documentation files. The multi-batch threshold (per `CLAUDE.md:140-146`) is for cases like "code review with 6 fix batches" where each batch is a separate unit of work. This plan's phases are sequential, file-scoped, and small — one `/implement` cycle is appropriate.

9. **Pre-PR Task 6 check is in this plan, not deferred to a separate step.** Per design Q3. The check is two `git` commands; including it here ensures it's not forgotten at PR time.
