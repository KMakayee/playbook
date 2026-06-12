# Todo

> Active task list. Completed tasks archived to `tasks/completed.md`.

> **Adding tasks here manually?** Follow the `/create-todo` ideology (`.claude/skills/create-todo/SKILL.md`): each task is a self-contained unit of work for its own RDPI cycle, written at the capability/outcome level — scope *and* deliverables say WHAT the task produces, not HOW. Keep implementation mechanisms (method signatures, file-path-level commands, library calls) out of acceptance criteria; those choices are decided inside each task's research/design/plan. Surface open questions; don't pre-solve them.

> **TEMPORARY — remove when issue #8 closes.** `/create-todo` does not yet emit the patterns this backlog relies on: the four-field intake (Intent / Constraints / Acceptance criteria / Relevant paths), per-task open-questions with the non-blocking-preflight note (see the RDPI note below), and a per-task "Design notes for RDPI to review" block. Until issue #8 (`tasks/new-issues.md`) lands those into the skill, add them by hand when manually creating a task here. Issue #8 includes deleting this note as a cleanup step.

## Dependencies & pickup order

Numbering is reference-only, not execution order. The backlog splits into three roughly-independent fronts; pick within a front in dependency order.

- **Codex-trio + forge — front complete.** `19`, `20`, and `21` (`/forge`) all landed 2026-06-10 (archived to `tasks/completed.md`).
- **Triage-rooted chain (13 → 14/15 → 16).** `13` (`/triage`) is the root: `14` (`/codex-goal`), `15` (RDPI structural), and `16` (inference-reduction) all hard-depend on it. `16` additionally depends on `15`.
- **Checkpoint pair (17 → 18).** `18` (auto-rehydrate hook) consumes `17`'s (`/checkpoint` redesign) output, so `17` lands first. Independent of the other two fronts.
- **Native-agents pair (22 → 23).** `22` (install/auto-boot lane) landed 2026-06-11 as PR #33 (archived to `tasks/completed.md`) — the `codex`/`codex-xhigh`/`gemini-flash` agent types, relay, and `claude-native` launcher `23` routes to are installable. `23` (workflow model routing + `/forge` rewrite) is unblocked. One soft collision: `23` edits `/forge`, which task `13` also touches (bucket-vocabulary sweep) — independent sections, coordinate if both are in flight.

Cross-front: the landed `19`/`21` inline `13`'s bucket logic; if `13` later refines it, updating them is an enhancement, not a blocker.

## Tasks

> **Note for RDPI:** The "Open questions for RDPI" sections in each task below are non-blocking design prompts to be resolved during Research/Design — NOT preflight gates. `/research-codebase`'s readiness preflight (`research-codebase/SKILL.md:14`) stops on unresolved open questions, so when kicking off research for one of these tasks, treat its open-question list as accepted-and-deferred unless the developer explicitly flags an item as blocking.

### 13. Port /triage skill + wire into Codex/cross-context review touchpoints

**Intent.** Port the `triage.md` placeholder command from `~/Projects/Omakase/omk-core/.claude/commands/triage.md` into the playbook as a new skill (`.claude/skills/triage/SKILL.md`), with improvements identified during design. Then wire it into every place a Codex (or cross-context) review pass currently produces findings that Claude has to absorb ad-hoc, replacing the ad-hoc absorb steps with a structured `/triage` call. The skill verifies each claim, sorts into buckets (A.1 auto-fix / A.2 verified no-op / B tradeoff stop / C not legit), auto-applies A.1 mechanical fixes, stops at B tradeoffs for developer input. Also add a CLAUDE.md rule to harden invocation across non-RDPI contexts (freeform paste, sub-agent reports, etc.).

**Constraints.**
- Skill must follow `disable-model-invocation: true` convention per established memory (side-effect workflow skills stay manual-invoke).
- Must support two execution modes: `inline-apply` (default — parent triages + applies A.1) and `parent-triages-child-applies` (parent triages, returns fix-instruction file for caller to spawn a child) — the latter is load-bearing for `implement` / `implement-codex` per their existing "parent decides *what*, child decides *how*" separation.
- Must preserve structured input when called from `codex-review` (lens headers, classification labels) — don't flatten to a list.
- No commits / pushes from the skill itself (matches omk-core guardrails and playbook's commit-ownership conventions).
- Existing `tasks/code-review-fixes*.tmp` artifact contract: must remain compatible with `implement` / `implement-codex` / `issue-implement` expectations during the transition; rip out only if RDPI confirms it's safe. **Glob must cover both names** — `/implement` writes the unsuffixed `tasks/code-review-fixes.tmp` (`implement/SKILL.md:125`, `implement/SKILL.md:168`), while `/implement-codex` and `/issue-implement` write suffixed variants (`-implement`, `-issue-N`). `code-review-fixes-*.tmp` does NOT match the unsuffixed file; use `code-review-fixes*.tmp`.
- **Inline contract, not nested invocation.** Playbook skills cannot programmatically invoke another slash command (`checkpoint/SKILL.md:180`). Throughout these four tasks, "wire into" / "delegate to" / "hands off to" / "routed through" `/triage` means the calling skill applies the triage bucket logic *inline* — the `/triage` skill is the reference spec for that logic, not a runtime call target. The standalone `/triage` skill exists for direct user invocation and freeform paste. No skill literally invokes `/triage`.

**Acceptance criteria.**
1. `.claude/skills/triage/SKILL.md` exists with skill frontmatter, manual invocation, and two-mode execution (`inline-apply` / `parent-triages-child-applies`).
2. `codex-review` Step 6b is replaced with inline triage logic. Whether it auto-applies A.1 by default or stays recommend-only (as today — `codex-review/SKILL.md:124`) is deferred to RDPI; see open questions below.
3. `implement` Step 7, `implement-codex` Step 7, `issue-implement` Step 7 all delegate the "Claude triages Codex findings" decision to `/triage`. The downstream apply mechanism (child for `implement`/`implement-codex`, inline for `issue-implement`) is preserved.
4. `create-plan` Step 4 and `issue-plan` Step 4 ("Claude absorbs findings") delegate to `/triage`. A.1 edits the plan file directly; B stops before plan is finalized.
5. `design` Codex cross-check / tiebreaker output is routed through `/triage` before `tasks/design-decision.md` is finalized.
6. CLAUDE.md gains the cross-context triage rule (text below). **The same rule is mirrored into `.claude/templates/playbook-sections.md`** — existing-project setup appends that template to CLAUDE.md (`playbook-setup/SKILL.md:31`), so a CLAUDE.md-only edit would be lost on fresh installs.
7. All existing skill tests / docs that reference the old triage step are updated; no dangling references to the replaced steps.
8. `/playbook-update`'s managed-file list (`playbook-update/SKILL.md:15`) accounts for the new `.claude/skills/triage/SKILL.md` — verify whether that list enumerates individual skills or globs `.claude/skills/`; if enumerated, add the new skill.

**Relevant paths.**
- Source: `~/Projects/Omakase/omk-core/.claude/commands/triage.md` (placeholder being ported)
- New skill: `.claude/skills/triage/SKILL.md`
- Skills to modify: `.claude/skills/codex-review/SKILL.md`, `.claude/skills/implement/SKILL.md`, `.claude/skills/implement-codex/SKILL.md`, `.claude/skills/issue-implement/SKILL.md`, `.claude/skills/create-plan/SKILL.md`, `.claude/skills/issue-plan/SKILL.md`, `.claude/skills/design/SKILL.md`, `.claude/skills/codex-audit/SKILL.md` (added by task 19 — see note added 2026-06-10 below)
- Project rules: `CLAUDE.md` (RDPI workflow rules section)
- Reference conventions: `.claude/skills/research-codebase/SKILL.md` (tmp-file pattern), `.claude/skills/codex-review/SKILL.md` (target-resolution pattern, cleanup-before-present convention)

**CLAUDE.md rule to add** (under RDPI workflow rules):
> **Triage out-of-context findings before acting.** When findings come from outside the current reasoning context — Codex review, a sub-agent report, paste from another chat, test logs, external reviewer comments — invoke `/triage` to verify before applying.

---

**Design notes for RDPI to review (candidate improvements over the omk-core placeholder):**

These were surfaced during pre-RDPI design discussion. RDPI Research/Design phases should evaluate each and decide what to include — they're not pre-committed.

1. **Collapsed-by-default Bucket C** — borrow the *"N findings filtered as noise — say `show all` to see them"* pattern from current `codex-review` Step 6b instead of always enumerating C. Avoids long C sections for chunks with many noise items.
2. **Verification budget for large chunks** — cap detailed verifications at N (e.g., 15); sample the rest; flag sampled-only items as `(low confidence)` which defaults them to Bucket B.
3. **Step 7 re-emit format spec** — omk-core says "brief implementation summary" but doesn't specify whether the original bucket report stays or gets superseded. Spell it out.
4. **Expand A.1 examples or replace with principle** — current list misses common mechanical cases (stale test fixture, unused import removal Codex flagged, contained rename). Either expand or state the principle: *"clear right answer, contained scope, no behavioral change."*
5. **Skip Step 0 misroute check when invoked from a known triage caller** — the implementation-vs-triage pre-check is for freeform invocation. When `codex-review` / `implement` etc. hand off, the chunk is known to be review findings; the pre-check is friction.
6. **Carry forward "Codex confidence is not evidence"** — codex-review SKILL has this caveat. Restate in triage: bucket weight = evidence, not how assertively the source stated the finding.
7. **Memory + project-state consultation** — omk-core mentions auto-memory for prior project state (e.g., "Task 12c"). In playbook, the equivalent is `tasks/issues.md` issue numbers and `tasks/plan.md` phase numbers; tell triage to consult those when chunks reference them.
8. **Bucket naming reconciliation** — codex-review 6b uses `apply` / `judgment call` / `noise`; omk-core triage uses `A.1` / `A.2` / `B` / `C`. Pick one. *(Deferred from task 23, fold into this sweep: forge's shared-triage line still says "verify each finding against the actual code first" — generalize "code" → "target" now that forge is piece-agnostic; task 23 deliberately kept the line byte-identical to avoid colliding with this task.)* Preference: `A.1/A.2/B/C` (separates auto-fix from no-op, more precise) — RDPI to confirm. **Also sweep in `/codex-audit`** (task 19) — its between-pass triage step uses the same interim `apply / judgment-call / noise` vocabulary, chosen deliberately to avoid pre-committing to `A.1/A.2/B/C` before this task lands (task 19 Axis 6 / OQ5, see `tasks/design-decision.md`). When standardizing the vocabulary, reconcile `/codex-audit` alongside the rest and align it to the `/triage` reference spec inline (per the "Inline contract, not nested invocation" constraint above — no runtime `/triage` call). *(Note added 2026-06-10: `/codex-audit` postdates this task's original AC list, so it is not enumerated in ACs 2–5; treat it as an additional inline-triage wiring point of the same kind.)*
9. **Tmp file naming aligned with playbook** — rename omk-core's `tasks/triage-input.tmp` → `tasks/triage-chunk.tmp`; add `tasks/triage-fixes.tmp` for `parent-triages-child-applies` mode.
10. **Caller-handoff contract** — formalize what each caller passes to `/triage` (chunk format, lens metadata, mode flag). Without this, integrations drift.

**Open questions for RDPI:**

- Does `/triage` need an explicit `--no-apply` / recommend-only mode flag, separate from the two execution modes? (E.g., a "just bucket and report, don't auto-edit" mode for cases where the caller wants triage as analysis without mutation.)
- Should `/codex-review`'s embedded triage auto-apply A.1, or stay recommend-only like today (`codex-review/SKILL.md:124`)? This is the `--no-apply` question above applied to `/codex-review`'s specific read-only identity: `/codex-review` is currently a look-only second opinion that never writes files, so auto-apply would change that contract. Decide alongside the `--no-apply` flag — if that flag exists, `/codex-review` may simply default to it.
- Should the legacy `tasks/code-review-fixes-*.tmp` artifact pattern survive, or be ripped out as part of this change?
- For `design`: should triage run after every Codex pass (cross-check AND tiebreaker), or only after the final Codex pass before `design-decision.md` is finalized?
- Should the CLAUDE.md rule live in the RDPI workflow rules block (where it's loaded with workflow context) or in a broader "review handling" block above it (since it applies outside RDPI too)?

---

### 14. Add /codex-goal skill — Codex `/goal` bookend wrapper with adversarial Claude judge

**Intent.** Add a new skill (`.claude/skills/codex-goal/SKILL.md`) that wraps Codex CLI's native `/goal` feature (introduced in v0.128.0, stable in 0.133.0) as a two-phase bookend workflow. The skill itself never invokes `/goal` — that runs in the user's Codex TUI session. Instead, Claude composes a structured goal spec upfront (Bookend 1), the user pastes one prepared `/goal` command into their Codex TUI and lets Codex run autonomously for minutes-to-hours, then Claude verifies on return (Bookend 2): runs the `DONE_WHEN` checks, spawns an adversarial cross-model judge to audit Codex's diff, hands judge findings to `/triage` for verification + bucketed action. Sibling of `/codex-do`, but for long-tail persistent objectives rather than one-shot tasks.

**Context — why this shape:** `codex exec --goal` does NOT exist as of CLI 0.133.0 (verified locally: `codex exec --help` has no goal flag; the `goals` feature flag is stable but TUI-only). A bash-loop emulator would be fragile and would re-implement what `/goal` already does well (persistence, compaction, runtime continuation). The bookend pattern reuses the real `/goal` feature where it lives (Codex TUI) and adds the missing piece (adversarial validation before declaring done) on the Claude side.

**Constraints.**
- Skill must follow `disable-model-invocation: true` (side-effect workflow skill, per established memory).
- Skill must NOT attempt to invoke `codex exec --goal` — that flag doesn't exist. Hand-off to user's TUI is the only interaction mode.
- Single skill, two modes — detected via presence of `tasks/codex-goal-spec.md`:
  - Spec missing → Bookend 1 (compose spec, emit paste-ready `/goal` command).
  - Spec present → Bookend 2 (verify completion, run judge, hand off to `/triage`).
  - Or explicit subcommand form: `/codex-goal new <intent>` / `/codex-goal verify` (matches `/checkpoint resume|discard|replace` convention — RDPI to pick).
- No commits / pushes from the skill. User reviews diff after triage and commits separately.
- The judge step is internal to Bookend 2 — NOT extracted as a separate `/claude-review` skill. Extract later if/when needed elsewhere (YAGNI).
- Depends on `/triage` skill landing first (handoff contract from judge findings → triage chunk).

**Acceptance criteria.**
1. `.claude/skills/codex-goal/SKILL.md` exists with skill frontmatter and `disable-model-invocation: true`.
2. **Bookend 1** (`/codex-goal new <intent>` or invoked with no existing spec):
   a. Composes `tasks/codex-goal-spec.md` — a structured spec that gives Codex enough to run unsupervised: the objective, what to read first, machine-verifiable done criteria (with exact check commands), guardrails/anti-patterns, when to bail and hand back, and an empty progress trail Codex updates as it works. Candidate section schema brainstormed pre-RDPI (RDPI to adopt or adjust, not a fixed gate): `OBJECTIVE`, `READING LIST`, `DONE_WHEN`, `WORKING RULES`, `BAIL CONDITIONS`, `PROGRESS LOG`.
   b. Snapshots baseline: writes current commit SHA to `tasks/codex-goal-baseline.tmp` so Bookend 2 can diff against it.
   c. Emits a single copy-pasteable `/goal` command for the user — a one-liner pointing Codex at the spec file (e.g., *"Copy this into Codex TUI: `/goal Execute the goal contract in tasks/codex-goal-spec.md. Read it fully first, follow the DONE_WHEN criteria, update PROGRESS LOG as you work, signal TASK_COMPLETE when all criteria pass.`"*).
   d. Stops cleanly. Tells the user to run `/codex-goal verify` when Codex is done.
3. **Bookend 2** (`/codex-goal verify` or invoked when spec exists):
   a. Reads `tasks/codex-goal-spec.md` + `tasks/codex-goal-baseline.tmp`.
   b. Runs each `DONE_WHEN` check command, produces a pass/fail table.
   c. Computes the diff of Codex's work against the baseline, capturing all changes whether committed or not (Codex's `/goal` work may be left uncommitted), and excluding the skill's own tmp/spec files. (Proposed mechanism in design note 9 below.)
   d. Spawns adversarial judge subagent (Claude, in this session — cross-model w.r.t. Codex). Judge prompt receives: the diff, the spec, the PROGRESS LOG, and a specific attack angle (rotated per run: correctness / edge cases / regression / security). Judge returns `ACCEPT` (no findings) or `REJECT` with structured findings (file:line + claim + severity).
   e. If judge returns findings → applies the triage contract inline (per the "Inline contract, not nested invocation" constraint in the `/triage` task — the `/triage` skill is the reference spec, not a runtime call). Verifies each claim, buckets into A.1 (auto-fix) / A.2 (verified no-op) / B (tradeoff) / C (not legit), auto-applies A.1. Bucket B items do NOT halt Bookend 2 — cleanup (g) and the summary (h) still run; B items are reported as "awaiting your call" and resolved in follow-up conversation (the diff is already in context, so the spec/baseline files are not needed to resolve them).
   f. If judge returns ACCEPT → skip the triage step.
   g. Cleans up `tasks/codex-goal-spec.md` and `tasks/codex-goal-baseline.tmp` before final presentation.
   h. Reports final summary: DONE_WHEN pass/fail table, judge verdict + attack angle used, triage results (A.1 applied, B awaiting, C dismissed), and a recommended next action (commit / re-goal with feedback / address tradeoff).
4. `/playbook-update`'s managed-file list (`playbook-update/SKILL.md:15`) accounts for the new `.claude/skills/codex-goal/SKILL.md` — verify enumerate-vs-glob and add if enumerated.

**Relevant paths.**
- New skill: `.claude/skills/codex-goal/SKILL.md`
- Reference source: `~/Projects/Omakase/omk-core/.claude/commands/codex-do.md` (sibling skill pattern — arg parsing, baseline snapshot, bail clause, cleanup-then-present)
- Reference conventions: `.claude/skills/codex-review/SKILL.md` (target-resolution, codex-output-check), `.claude/skills/checkpoint/SKILL.md` (two-mode-via-state pattern), `.claude/skills/research-codebase/SKILL.md` (tmp-file naming)
- Dependency: `.claude/skills/triage/SKILL.md` (must land first — see preceding task)
- Tmp artifacts (cleaned in Bookend 2): `tasks/codex-goal-spec.md`, `tasks/codex-goal-baseline.tmp`

---

**Design notes for RDPI to review (candidate refinements):**

These were surfaced during pre-RDPI design discussion. RDPI Research/Design phases should evaluate each — they're not pre-committed.

1. **One-skill-two-modes vs explicit subcommands** — auto-detect mode via spec file existence, OR require `/codex-goal new <intent>` / `/codex-goal verify`. Subcommand form is more explicit (matches `/checkpoint`); auto-detect form is fewer keystrokes. RDPI to pick.
2. **Adversarial attack-angle rotation** — currently proposed: rotate angle per run (correctness / edge cases / regression / security). Alternative: let user specify with a flag (`/codex-goal verify --angle security`), or run all four angles in parallel with consensus voting (Generator/Judge pattern from Ralph-loop adversarial-review research). Consensus is more thorough but ~Nx cost.
3. **`DONE_WHEN` check format spec** — need a strict format so Bookend 2 can execute checks programmatically. Candidates: shell command per criterion (e.g., `npm test`, `grep -q "foo" src/x.ts`), exit-code-based pass/fail; or pseudo-DSL parsed by the skill. Shell-command-per-criterion is simpler — RDPI to confirm.
4. **`PROGRESS LOG` integration with judge** — Codex updates a `PROGRESS LOG` section in the spec file as it works. The judge should read this trail when evaluating (helps judge understand Codex's reasoning, not just the diff). Worth confirming the judge prompt actually uses it.
5. **Skill ergonomics — what if user comes back and the spec doesn't match the diff?** E.g., user ran `/codex-goal new`, but then never pasted the `/goal` command into Codex (or Codex bailed early). Bookend 2 should detect "no diff vs baseline" and surface that cleanly rather than running judge on an empty diff.
6. **What if Codex modifies files outside the implied scope?** E.g., spec says "modernize src/api/v2", Codex edits 30 other files. Judge angle should include scope drift detection. Worth an explicit attack angle: `scope drift`.
7. **Baseline tracking edge case** — the working-tree diff (see design note 9) captures Codex's work whether committed or not, which is the goal. Residual edge: if the *user* makes an unrelated commit during the run, it lands in the diff too. Probably acceptable; RDPI to decide whether to detect-and-warn.
8. **Spec file naming for parallel goals** — current design uses singleton `tasks/codex-goal-spec.md`. If user wants two goals in flight (different branches, different terminals), would need `tasks/codex-goal-spec-<name>.md`. RDPI to decide whether to support parallel goals or single-goal-only.
9. **Proposed working-tree diff mechanism (for AC3c).** Sketch RDPI can adopt or replace: `git diff <baseline>` for tracked changes plus untracked files via `git status --porcelain --untracked-files=all`, excluding `tasks/codex-goal-*.tmp` and `tasks/codex-goal-spec.md`. Working-tree diff (NOT `<baseline>..HEAD`) because the skill makes no commits and Codex's `/goal` work may be left uncommitted, so a commit-to-commit diff would miss it. Mirrors the working-tree review pattern at `issue-implement/SKILL.md:92`. RDPI confirms the exact commands.

**Open questions for RDPI:**

- Should the judge run on a different Claude model (e.g., Haiku 4.5 for cost) or the same model as the parent session? Cross-model is the high-signal angle, but Codex-vs-Claude is already cross-model — Haiku-vs-Opus on the Claude side might be diminishing returns.
- Should `/codex-goal verify` fail closed (don't proceed if any `DONE_WHEN` check fails) or fail open (proceed to judge step anyway, report failures in summary)? Fail-open is more informative; fail-closed is more disciplined.
- Should Bookend 2's judge step be opt-out via a flag? Some goals are simple enough that judge-then-triage is overkill (e.g., a one-file rename loop).
- Does the skill need a `cancel` mode for "Codex bailed, just clean up the spec and baseline files"? Or is that just a manual `rm` and a fresh `/codex-goal new` call?
- Should this skill integrate with `/finish` for end-of-task cleanup, or stay outside it like `/codex-do` and `/codex-review`?

---

### 15. RDPI structural improvements — R₂, hybrid synthesis, Codex-review on research

**Intent.** Close three concrete gaps in the current RDPI information flow that force `/create-plan` and `/implement` to infer implementation details about the chosen option. Specifically: (1) add a deep-research-on-chosen-option step (R₂) inside `/design`, scoped narrowly to the chosen direction; (2) make hybrid synthesis an explicit, conditional step in `/design` — synthesized only when a blend genuinely beats every single option, never forced — rather than an implicit fudge ("Option B with A's error handling and C's API shape"); (3) add a Codex review pass on `tasks/research-codebase.md` after Claude synthesizes it (mirrors the existing Codex review passes in `/design`, `/create-plan`, `/implement`). All three changes give Plan a complete picture of the chosen direction before implementation starts.

**Context.** Today's RDPI: R (option space) → D (pick) → P (plan) → I (implement). The user observed empirically (a) Plan is under-informed because R was scoped to comparing options, not deep-diving the chosen one; (b) Design always produces an implicit hybrid in practice but the hybrid is never independently evaluated; (c) Research has no Codex review pass, so its inferences cascade into D and P unchecked.

**Constraints.**
- R₂ stays inside `/design` as a sub-step (not a new skill) — `/design` is light enough to absorb it; keeping it together preserves single-skill design cohesion.
- R₂ is Codex-driven sweep + Claude synthesis (same model split as the original Research), but NO axis structure — axes were for option comparison; R₂ is option-already-chosen.
- R₂ uses an inline RUN/SKIP gate (same shape as `/design`'s existing `research-patterns.md` gate). Default to RUN; SKIP only when the hybrid touches code R₁ already covered deeply or is purely mechanical.
- Hybrid synthesis is a single one-shot — if R₂ surfaces a blocker that can't be folded into the existing hybrid, stop and surface to user; do NOT loop back to re-synthesize automatically.
- Codex review on `research-codebase.md` mirrors the existing pass in `/create-plan` — findings flow through `/triage` (depends on the `/triage` task landing first).
- All three changes preserve the synth-and-write-artifact *pattern* (Claude synthesizes, writes to existing `tasks/` artifacts). The design doc DOES gain new sections (`## Hybrid`, `## Chosen-Option Research`) — that's a section-shape change, not a pattern change. Whether R₂ output stays inline in `tasks/design-decision.md` or moves to a new `tasks/research-chosen-option.md` file is an open question (design note #1); if a new file is chosen, lifecycle commands MUST be updated (see acceptance criterion below) — `/finish` (`finish/SKILL.md:31`), `/checkpoint` (`checkpoint/SKILL.md:117`), and `/playbook-audit` (`playbook-audit/SKILL.md:60`) only know the existing singleton artifacts.

**Acceptance criteria.**
1. `/design` gains hybrid synthesis and R₂ deep-research, producing a decision where:
   a. **Synthesis evaluates the full decision space; hybrid is considered but never forced.** Claude weighs every candidate — the single options AND any hybrid, whether proposed by Codex (its cross-check often recommends a blend — `design/SKILL.md:111`) or originated by Claude — and actively checks whether a blend beats every single option on the same heuristics. Scenarios it must handle: (1) a single option wins outright (no hybrid); (2) adopt Codex's proposed hybrid as-is; (3) build a better hybrid on top of Codex's; (4) reject Codex's hybrid as not worth it and fall back to a single option or Claude's own blend; (5) originate a hybrid Codex didn't propose. Codex's hybrid is weighed on merit, never deferred to (same posture as "Codex's confidence is not evidence" — `design/SKILL.md:137`). When a hybrid wins, write it as an explicit `## Hybrid` section, independently evaluated against the same heuristics as the original options. When a single option wins, that option is the decision and NO `## Hybrid` section is written — a clean single-option pick is a first-class result, not a fallback the flow avoids.
   b. **R₂ deep-research runs on the chosen option** (whether a single option or a hybrid) via Codex sweep + Claude synthesis (no axes), and Claude finalizes the design doc folding R₂ findings in. Output appended to `tasks/design-decision.md` as `## Chosen-Option Research` section (or written to a separate `tasks/research-chosen-option.md` — RDPI to pick).
   The exact step ordering within `/design` is RDPI's to design (proposed sequence in design note 7 below).
2. RUN/SKIP gate for R₂ in `/design`: documented criteria (RUN if external/unfamiliar pieces; SKIP if codebase already covered).
3. `/research-codebase` skill updated to run a Codex review pass on `tasks/research-codebase.md` after Claude synthesis. Findings flow through `/triage`.
4. CLAUDE.md Phase 1 description updated to mention the Codex review pass.
5. CLAUDE.md Phase 2 description updated to mention the hybrid synthesis + R₂ steps inside `/design`.
6. The Phase 1 / Phase 2 CLAUDE.md edits are mirrored into `.claude/templates/playbook-sections.md` (`playbook-setup/SKILL.md:31` appends it on existing-project setup, so CLAUDE.md-only edits are lost on fresh installs).

**Relevant paths.**
- Skills to modify: `.claude/skills/design/SKILL.md`, `.claude/skills/research-codebase/SKILL.md`
- Possibly: `.claude/skills/issue-research/SKILL.md` (issue-flow counterpart — RDPI to decide whether to mirror or leave alone)
- Project rules: `CLAUDE.md` (Phase 1, Phase 2 descriptions)
- Reference conventions: `.claude/skills/design/SKILL.md` (existing pattern-research RUN/SKIP gate — model for R₂'s gate), `.claude/skills/create-plan/SKILL.md` (existing Codex review pattern — model for the Research Codex review)
- Dependency: `.claude/skills/triage/SKILL.md` (must land first — Codex review on research synth feeds through /triage)

---

**Design notes for RDPI to review:**

1. **Where R₂ output lives** — append to `tasks/design-decision.md` as a section, OR write to separate `tasks/research-chosen-option.md`. Trade: separate file is cleaner for `/create-plan` to consume (one artifact per concern); inline section keeps everything under `/design`'s single output AND avoids the lifecycle-update cost — a new artifact file is invisible to `/finish`, `/checkpoint`, and `/playbook-audit` until each is taught about it, so the separate-file path carries that extra surface. Inline is the lower-moving-parts default unless RDPI proves a separate artifact is necessary. RDPI to pick.
2. **Two Codex calls in `/design` now** — option review (existing) + R₂ deep research (new). Both async/background-able, but worth knowing it's heavier. If wall-clock impact is significant, consider whether they can run in parallel (they're independent — option review evaluates A/B/C; R₂ deep-dives the hybrid that hasn't been synthesized yet, so they're sequential, not parallel).
3. **R₂ "no axes" structure spec** — needs an explicit replacement structure (not just "no axes"). Candidate sections: `Touched code (files + behavior)`, `External APIs / libraries / patterns referenced`, `Integration points`, `Risks specific to this option`, `Open questions surfaced during deep dive`.
4. **Issue-flow counterpart** — `/issue-research` is the issue-flow's research step. Does it need the same Codex review pass? Probably yes for consistency, but the issue flow is lighter; RDPI to confirm whether it's in scope.
5. **Hybrid evaluation rigor** — should the hybrid be evaluated on the SAME heuristics as A/B/C (apples-to-apples), or be allowed to introduce new heuristics that emerged from the critique? Same-heuristics keeps comparison clean; new-heuristics captures genuine learnings. Same-heuristics is probably right but flag for RDPI.
6. **Hybrid must be conditional, never forced — and Codex is a hybrid source.** Forcing a blended option on every decision is bad design. The gate is NOT "obvious winner vs hybrid" — it's "does combining options beat every single option on the heuristics?" Codex's cross-check often proposes a hybrid itself; Claude may adopt it, improve on it, reject it, or originate its own when Codex offered none. If a single option is strongest — whether clearly, or after absorbing Codex's critique — that single option is the decision: skip hybrid synthesis and proceed to R₂ on it directly. A clean single-option pick is a first-class result, not a fallback the flow avoids.
7. **Proposed `/design` step sequence (for AC1).** Pre-RDPI sketch RDPI can adopt or restructure: (a) Claude proposes options [existing]; (b) Codex reviews options [existing]; (c) synthesis evaluates the full decision space and decides whether a hybrid beats every single option; (d) R₂ deep-research on the chosen option; (e) Claude finalizes the design doc, folding R₂ findings in. Ordering is partly forced — R₂ can only run once an option is chosen, so (c) precedes (d) — but where synthesis sits relative to the Codex option-review, and whether R₂ output is inline vs. a separate file (note 1), are open. RDPI owns the final step structure.

**Open questions for RDPI:**

- Does `/research-codebase` Codex review get an output-format spec (lens headers like `/codex-review`?), or is it freeform-with-citations like other RDPI Codex passes?
- Should the issue-flow (`/issue-research`, `/issue-plan`) mirror these changes, or is the issue flow's lightness a feature worth preserving (and these changes are for the heavyweight singleton flow only)?
- If R₂ surfaces a finding that invalidates the hybrid (e.g., library doesn't expose the assumed API), the one-shot rule says "stop and surface." Does the skill need an explicit handoff for this — e.g., write to `tasks/design-blocked.tmp` and return control to user with a recovery prompt? Or just stop in conversation?

---

### 16. Inference-reduction principles + output style — workflow-wide

**Intent.** Promote the triage Bucket-B posture ("stop and ask, don't infer") from a single skill into a workflow-wide principle across all R/D/P phases. Codify (a) when phases must surface judgment calls rather than silently choosing; (b) how judgment calls are formatted in artifacts and summaries; (c) an output style spec that fixes the "Claude dumbs down with analogies / ELI5 / code-block-spam / variable-name-spam" failure mode. This is a habit-shaping change — touches CLAUDE.md, all synth-producing skills, and adds a new style reference doc. Sister task to the RDPI structural improvements task above; ships AFTER it so the new R₂/hybrid steps get the question-asking discipline retrofitted.

**Context.** Today, R/D/P phases silently make load-bearing choices that should surface as user questions. The user noted: *"AI does this a lot, especially during research, design, plan — we need to ask questions to us."* Triage's Bucket B is the canonical "don't infer, ask" gate; its criteria and format are battle-tested through user's daily use. Separately, Claude's summaries after synth steps drift into ELI5 / analogies / massive code blocks / raw variable-name spam — user wants human-readable technical writing, NOT dumbed-down explanations. Filler / structure / bullets are fine; metaphors and code-dumps are not.

**Constraints.**
- Reuse triage Bucket-B criteria verbatim for the workflow-wide rule — don't invent a parallel heuristic. Criteria source: `.claude/skills/triage/SKILL.md` (after the `/triage` port task lands).
- Strict question budget — phases must NOT generate >3 judgment-call questions per artifact except in genuine edge cases. Question fatigue is the failure mode.
- Per-phase shape: Research surfaces intent/constraint gaps; Design surfaces option tradeoffs (highest-density question phase); Plan surfaces structure decisions, NOT implementation details.
- Judgment Calls surface at END of phase (in the artifact's final section), NOT mid-phase, UNLESS the question is blocking (i.e., the phase literally cannot proceed without an answer).
- Output style applies to summaries Claude shows the user after R/D/P/I — NOT to the artifacts themselves (artifacts already follow their own conventions).
- Output style is mandatory for summaries, NOT for raw artifact contents.

**Acceptance criteria.**
1. CLAUDE.md gains an "Ask, don't infer" rule near the existing triage rule. Text candidate:
   > **Surface judgment calls; don't silently choose.** In Research, Design, and Plan, when a load-bearing choice has multiple defensible options, stop and ask. Criteria for what qualifies are the same as triage Bucket B (multiple viable cost/risk profiles, scope/methodology choices, downstream/contract implications, user-visible behavior changes, low-confidence verifications). Cap at 3 questions per phase except in genuine edge cases. Surface at the end of the phase in a "Judgment Calls" section unless blocking.
2. `.claude/templates/output-style.md` exists with the style spec. Rules:
   - No ELI5, no analogies, no metaphors ("the bouncer at the door" etc.)
   - No giant code blocks in summaries — reference precisely via `file_path:line_number` and describe narratively
   - No variable-name spam — describe by named concept ("the auth middleware") not raw identifier; reference identifiers only when precision matters
   - Filler / structure / bullets / paragraphs — fine, use whatever fits the content
   - Mandatory for summaries shown to user after R/D/P/I phases
3. `/research-codebase` produces an end-of-artifact "Judgment Calls" section listing surfaced intent/constraint gaps (or "no judgment calls" if none).
4. `/design` produces an end-of-artifact "Judgment Calls" section listing surfaced option tradeoffs before declaring the hybrid winner. (Specifically: Design's question-density is highest because tradeoffs ARE the work; the section enumerates real disagreements between options, not bookkeeping.)
5. `/create-plan` produces an end-of-artifact "Judgment Calls" section listing surfaced plan-structure decisions (NOT implementation details).
6. Every skill with a user-facing final-summary step references `.claude/templates/output-style.md`, since the style mandate covers R/D/P/**I**: the synth-step skills (`/research-codebase`, `/design`, `/create-plan`) AND the implement skills (`/implement` at `SKILL.md:171`, `/implement-codex` at `SKILL.md:490`, `/issue-implement` at `SKILL.md:179`). Issue-flow synth counterparts (`/issue-research`, `/issue-plan`) are governed by the issue-flow scope open question — include them only if that question resolves to "yes."
7. The "Judgment Calls" section uses triage Bucket-B format: `Title / What was verified / Why it's a tradeoff / Path A pros-cons / Path B pros-cons / (My read, but not a decision)`.
8. The new CLAUDE.md "Ask, don't infer" rule is mirrored into `.claude/templates/playbook-sections.md` (`playbook-setup/SKILL.md:31`). `/playbook-update`'s managed-file list (`playbook-update/SKILL.md:15`) accounts for the new `.claude/templates/output-style.md` — verify enumerate-vs-glob as in the triage task.

**Relevant paths.**
- New template: `.claude/templates/output-style.md`
- Skills to modify: `.claude/skills/research-codebase/SKILL.md`, `.claude/skills/design/SKILL.md`, `.claude/skills/create-plan/SKILL.md`, `.claude/skills/implement/SKILL.md`, `.claude/skills/implement-codex/SKILL.md`, `.claude/skills/issue-implement/SKILL.md` (the three implement skills get the output-style reference in their "Present results" step, not a Judgment Calls section), possibly `.claude/skills/issue-research/SKILL.md`, `.claude/skills/issue-plan/SKILL.md`
- Project rules: `CLAUDE.md` (new "Ask, don't infer" rule)
- Reference source: `.claude/skills/triage/SKILL.md` (Bucket B criteria + format — must exist first)
- Dependency: Both `/triage` port task AND RDPI structural improvements task (above) should land first — this task retrofits the question-asking discipline onto the existing + new steps.

---

**Design notes for RDPI to review:**

1. **Question-budget enforcement** — how does the LLM actually obey "cap at 3"? Plain text rule may not stick. Options: (a) ask LLM to pre-rank candidate questions by Bucket-B-criterion-match strength and emit only top 3; (b) hard cap in the skill prompt with explicit "if you have >3 candidates, drop the 3 least load-bearing"; (c) accept that 3 is aspirational and don't try to hard-enforce. RDPI to pick.
2. **Style doc length** — should be one dense page. Anti-pattern: a 5-page style guide nobody reads. Reference Stripe docs / Google SWE handbook tone as exemplars.
3. **Style research-or-not** — user asked whether we research what good technical writing looks like before drafting the style doc. Recommendation: skip the research, draft directly from principles — the rules are well-trodden. Flag for RDPI to override if needed.
4. **Output-style enforcement is hard.** Telling Claude "no analogies" doesn't always stick. Mitigation: include 3-5 concrete bad-example / good-example pairs in the style doc so the LLM has a pattern to match. Bad: *"It's like a vending machine — when you `auth_check(...)` it..."* Good: *"The auth check runs in strict mode (`auth.ts:88`) — fails closed on missing tokens."*
5. **"Judgment Calls" section visibility** — section at end of artifact means user has to read to the bottom. Mitigation: also surface a count at the top (e.g., *"3 judgment calls flagged — see end of artifact"*).
6. **Critical questions surfacing mid-phase** — the rule allows blocking questions mid-phase. Need a definition of "blocking" — probably: "the phase literally cannot produce a coherent artifact without this answer" (vs "would be nice to know"). Worth spelling out so the LLM doesn't abuse the escape hatch.
7. **How does this interact with Auto Mode?** Auto Mode says "bias toward working without stopping for clarifying questions." Judgment Calls is the opposite. Reconciliation: Auto Mode applies to *micro-decisions during implementation*; Judgment Calls apply to *load-bearing choices in R/D/P*. Worth a one-liner in CLAUDE.md to reconcile.

**Open questions for RDPI:**

- Should the question-budget cap be enforced per-skill (research caps at 3, design caps at 3, plan caps at 3, total 9) OR per-phase-pass (full RDPI cycle caps at total N)? Per-skill is simpler; per-phase-pass keeps the user from being overwhelmed across the cycle.
- Where does the style doc live in the load order — referenced from CLAUDE.md (always loaded) or only from the synth-step skills (loaded just-in-time)? Just-in-time is leaner but may not stick across the conversation; always-loaded is safer but uses context.
- Does `/implement` also need a "Judgment Calls" section, or is implementation deterministic enough (it follows the plan) that no judgment calls should be needed? If `/implement` is encountering judgment calls, that's a sign the plan was incomplete — escalate to plan-update, not surface in implement.
- Does the issue-flow (lighter weight) get the same retrofit, or is the issue-flow's simplicity worth preserving?

---

### 17. Redesign /checkpoint into a lightweight session-handoff brief

**Intent.** Replace the current heavy git-snapshot `/checkpoint` with a lightweight continuation-handoff. The current skill (`.claude/skills/checkpoint/SKILL.md`, 243 lines) commits `tasks/checkpoint.md` with a full embedded diff and derives "What's next" mechanically from the plan's first unchecked checkbox — so it's slow to create and rehydrate, bloated, and never produces a real continuation: on resume it doesn't know what happened in the prior session. The redesign: at **create** time the agent curates the live conversation into a slim, prompt-shaped continuation brief written to a gitignored `tasks/logs/checkpoints/<timestamp>.log`; on **resume** it reads that brief as its prompt and continues. No git commit. Operating principle: **smart save, dumb resume** — all judgment happens at create while the conversation is live; resume just reads a ready-to-act prompt.

**Context — why this shape.**
- The current checkpoint conflates two jobs: a *git-recoverable snapshot* (heavy — the YAML-escaping rules, four-backtick fence escalation, binary detection, byte/line caps, `base_head` ancestry, and the save/consume/discard/replace commits all exist to serve this) and a *session-continuation cue* (light — what's actually wanted). The heavy machinery is the bulk of the skill and serves a recovery role the user has never needed. Resume even reads the full embedded diff (no size cap) then deliberately ignores it (`SKILL.md:199`) — pure token waste.
- The real value of checkpoint is **handoff to a cold recipient**: a fresh session after a context clear, a post-`/compact` session, or (aspirationally) a spawned sub-agent. All want the same artifact — the minimum state needed to continue.
- The user's actual workflow is **checkpoint → clear context** (not `/compact`). **Clear ≠ reset**: clearing wipes the conversation but leaves the worktree (dirty changes) on disk, so code state always survives — the brief only needs to *point at* the live worktree, never carry a copy. The embedded diff only ever mattered when the worktree itself vanishes (hard reset, different machine), which isn't this workflow. That is the load-bearing justification for "no diff, no commit." And because a clear leaves *no* conversational residue, the brief being self-contained is a hard requirement, not a nicety.

**Constraints.**
- Skill stays manual-invoke (`disable-model-invocation: true`) per established convention.
- No git commits/pushes from the skill. The checkpoint is a gitignored file under `tasks/logs/checkpoints/` (`tasks/logs/` is already in `.gitignore`). Removing the commits deletes the current consume/discard/replace commit machinery — and with it the commit-flag-ordering bug we were about to log as draft issue #6, which this task **supersedes** (#6 was held off for this reason).
- Smart save / dumb resume: curation and judgment happen at create; resume does the minimum (read the brief, cheap branch+worktree sanity check, act). Resume must NOT re-read the RDPI artifacts to reconstruct context. **Resume is now mostly automatic** via the SessionStart hook (task 18); `/checkpoint resume` is kept as a *manual* trigger of the same rehydrate+title+consume logic — for agent-orchestration handoffs where you pick up a checkpoint on demand rather than wait for a session restart.
- The brief is self-contained: if continuing needs a fact from research/design/plan, create copies it into the brief. After a context clear there is no other surviving state.
- File is slim AND skill is slim: the `.log` carries only continuation-relevant content (slimness *is* the selectivity); the SKILL.md itself drops from 243 lines to a tight create checklist + short resume steps (target well under 100 lines).
- Format: line-oriented `key: value` header (everything after the first `: ` is the value, to end of line — no quoting, no escaping) + a prose continuation brief. No YAML frontmatter, no markdown/backtick fences, no escaping rules. Filename `<timestamp>-checkpoint-<NAME>-<ID>.log` — `<NAME>` is a kebab subject slug (from what was discussed/completed), `<ID>` is the session id — so the folder doubles as a grep-able subject→session index.
- **Git-state-agnostic (item 2).** Checkpoint never inspects, warns about, or blocks on git commit/staging/untracked state — not on create, not on resume. With parallel work the index is naturally messy, and anyone running checkpoint has already committed what matters; the nag is pure friction and sometimes a hard block. The only git it reads is branch + worktree for the header; a mismatch is a non-blocking note, never a gate. (Removes the old untracked-file caps + RDPI-artifact "go git add" refusals on create, and the `base_head` ancestry confirmation-gate on resume.)
- **Subject slug** is generated once at create and reused three ways: `<NAME>` in the filename, the session title (set by the hook — task 18), and the brief's opening line.
- **Session id** (`<ID>`): the skill needs its own session id for the filename — likely the newest `.jsonl` in `~/.claude/projects/<dir>/` (the live transcript), or an env var if one exists. Confirm in RDPI.
- The forcing function for brief quality lives in the skill instructions (a required create checklist), not in the artifact format — the artifact stays prose-slim while the skill enforces coverage.

**Acceptance criteria.**
1. `/checkpoint` (or `/checkpoint light`) creates a checkpoint: one timestamped `.log` in `tasks/logs/checkpoints/`, no git commit. Creating when one already exists just adds a newer `.log` — selection at pickup is the hook's / `/checkpoint resume`'s job (task 18), not an overwrite.
2. Create performs three behaviors: (a) **gate** — judge whether the work is continuable; default yes, but detect the no-continuation case (e.g., work complete → nudge to `/finish`) instead of fabricating a continuation; (b) **curate** — review the live conversation, select only continuation-relevant content (decisions, dead-ends ruled out + why, gotchas); (c) **distill** — write a prompt-shaped, self-contained brief.
3. The brief is self-contained — a fresh, zero-context session can act on it without opening any RDPI artifact. Skill-enforced coverage: goal, current state, what was tried + what failed and why, the single concrete next action, gotchas/constraints, **reading order** (what to open first and what NOT to re-read), and **decisions/verdicts already settled** (so the resumer doesn't re-litigate them). The last two come from a real checkpoint that lost exactly those — see design note 5.
4. The `.log` uses a line-oriented `key: value` header (kind, created, session, branch, worktree, phase, plan, cursor) + prose brief. No YAML, no fences, no escaping.
5. Resume — automatic via the SessionStart hook (task 18), or manual via `/checkpoint resume` — reads the brief, runs a cheap branch+worktree sanity note (warn on mismatch, never block), and presents the brief as the working prompt. No reconstruction-reads of RDPI artifacts. Bare `/checkpoint` is *not* a resume path — it creates (AC 1).
6. Consuming a checkpoint never deletes or commits — it `mv`s the `.log` to `tasks/logs/checkpoints/consumed/` (retained for reference, never re-injected; task 18). When several are pending, selection is session-id-matched with an ask-on-ambiguity fallback (task 18), not a blind newest-wins.
7. The "recommend `/compact`" step is removed (`SKILL.md:174–180`) — the closing guidance no longer points at `/compact`; it reflects "you can clear context / start fresh now; run `/checkpoint` to continue." (This is just cutting a recommendation prompt, not a structural change.)
8. SKILL.md is materially slimmer (target well under 100 lines): the YAML-escaping, fence-escalation, binary-detection, byte/line-cap, and `base_head`-ancestry sections go with the commit mechanism.
9. Lifecycle references to the old `tasks/checkpoint.md` are reconciled to the new location/behavior: `CLAUDE.md:213` (session-start active-checkpoint check), `.claude/skills/finish/SKILL.md:39` (cleanup — no longer needs `git rm` since the file is gitignored), `.claude/skills/playbook-audit/SKILL.md:65` (artifact list), `.claude/skills/playbook-update/SKILL.md:267` (maintainer-artifact check), `.claude/skills/playbook-setup/SKILL.md:151`, and the mirrored `.claude/templates/playbook-sections.md:168` (the CLAUDE.md session-start text is appended from this template on existing-project setup, so a CLAUDE.md-only edit is lost on fresh installs).

**Relevant paths.**
- Skill to redesign: `.claude/skills/checkpoint/SKILL.md` (243 lines).
- New artifact location: `tasks/logs/checkpoints/<timestamp>-checkpoint-<NAME>-<ID>.log` (`tasks/logs/` already gitignored — `.gitignore`); consumed checkpoints move to `tasks/logs/checkpoints/consumed/`.
- Lifecycle refs to reconcile: `CLAUDE.md:213`, `.claude/skills/finish/SKILL.md:39`, `.claude/skills/playbook-audit/SKILL.md:65`, `.claude/skills/playbook-update/SKILL.md:267`, `.claude/skills/playbook-setup/SKILL.md:151`, `.claude/templates/playbook-sections.md:168`.
- Supersedes: draft issue #6 in `tasks/new-issues.md` (commit-flag-ordering bug — moot once commits are gone).
- Reference: the current skill's two-mode-via-state pattern (keyword args `resume`/`discard`/`replace`) — decide which keywords survive.

**Example artifact** (`tasks/logs/checkpoints/2026-06-08T1432-checkpoint-config-loader-hardening-b9c0c9b9.log`):

```
kind: light
created: 2026-06-08T14:32:00Z
session: b9c0c9b9-2e41-4597-ad56-789699d7931f
branch: main
worktree: /Users/chief/Projects/Tools/playbook
phase: implement
plan: tasks/plan.md
cursor: - [ ] Add guard clause to resolveConfig()

You're continuing the config-loader hardening. resolveConfig() (src/config.ts:40)
crashes on a missing env file instead of falling back to defaults.

Done: added the defaults map and the fallback path. Mid-way through the guard clause.
Tried throwing a typed ConfigError first — reverted, it broke the CLI's top-level
handler which expects undefined, not a throw. So we guard-and-default instead.

Next action: add the `if (!raw) return DEFAULTS` guard at the top of resolveConfig()
(src/config.ts:41), then run `npm test -- config`.

Watch out: loadEnv() (src/env.ts:12) returns null (not undefined) on miss — the guard
must check both.
```

A fresh session reads only that and continues — no SKILL.md, no artifacts.

---

**Design notes for RDPI to review:**
1. **Light is the fast track — question whether `normal` is even needed.** Developer steer: `light` = a no-commit, minimal-curation quick save whose entire point is speed and low effort (save the brief, continue or clear, done — no commit required). Since the redesign already makes *every* checkpoint commitless and log-based (no diff, no git), the old basis for a `normal`/`light` split is largely gone. RDPI should first ask whether `normal` is warranted at all — `light` may simply be the only mode — and only if it stays, define what it adds (candidates: a richer brief / phase-cursor-plan pointers, or an optional embedded uncommitted diff as a recovery extra). Auto-rehydrate + rename (task 18) are mode-agnostic regardless of the answer. Do not preserve a two-mode split for its own sake; if it collapses to one mode, the `kind:` header field and `/checkpoint light` alias fall out with it.
2. **Consumed-checkpoint lifecycle.** Resolved in task 18: consume = atomic `mv` to `tasks/logs/checkpoints/consumed/` (retained, never re-injected); pickup is session-id-matched with ask-on-ambiguity, not blind newest-wins. Residual question: long-term cleanup/retention of the `consumed/` archive (gitignored, so disk hygiene, not repo bloat).
3. **Mode keyword set.** Current skill: `resume`/`discard`/`delete`/`remove`/`replace`. With light-by-default + auto-detect-resume, which survive? Likely `light` (explicit create), bare (create-or-resume), maybe `discard` (just `rm` now — no commit). `replace` is probably redundant (re-running create overwrites).
4. **Sub-agent / cross-session handoff.** *Manual* handoff is now supported: `/checkpoint resume` (task 18) lets one session/agent pick up another's checkpoint on demand — the session id in the filename makes the target explicit. That's the orchestration lever the user wanted. Sub-agents (Agent tool) remain leaf tasks (`CLAUDE.md:178`) and don't auto-rehydrate; *fully-automatic* pipeline handoff between agents stays a follow-up.
5. **Brief-quality forcing function.** The whole value is the create-step prompt reliably producing a *complete* brief, not a lazy "continue the implementation." A real checkpoint screenshot from the user showed exactly what gets lost: reading order / what-not-to-re-read, already-settled verdicts (e.g. "the codex review was absorbed — don't re-open it"), easy-to-miss process steps (a rename workflow), and a high-impact framing one-liner. The required checklist should force these: concrete next action; what-was-tried + why-it-failed; reading order; decisions-already-settled. This is where the skill earns its keep.
6. **Worktree mismatch handling.** A checkpoint created in `.claude/worktrees/<x>` resumed from `main` should warn. Warn-and-proceed (consistent with the current branch-mismatch posture) vs. refuse — RDPI to pick.
7. **Header fields for non-implement checkpoints.** `phase`/`plan`/`cursor` are useful for an RDPI-implement checkpoint and empty for a standalone one. Confirm they stay optional header fields rather than required.
8. **Auto-trigger (parked).** Auto-firing `/checkpoint` based on context utilization was considered and parked: it tensions with `disable-model-invocation: true`, and a skill can't reliably read its own context %. The continuability *gate* (AC 2a) is the create-time judgment kept instead.

**Open questions for RDPI:**
- Is `normal` mode warranted at all now that every checkpoint is commitless + log-based, or does `light` become the only mode? If `normal` stays, what does it add over `light`? (Design note 1 — `light` is the fast-track quick save; the hook is mode-agnostic.)
- Should resume open the live plan file (`tasks/plan.md`) for the current checklist, even though it won't open research/design? The plan is the live task list, not reconstruction context — probably yes; confirm the self-containment boundary (brief = context; plan = task list).
- Long-term retention/cleanup of the `consumed/` archive (the consume mechanism itself is settled in task 18 — `mv` to `consumed/`). (Design note 2.)
- Confirm bare `/checkpoint` always *creates* (resume is the hook's / `/checkpoint resume`'s job) — i.e., no "resume on bare invocation" path, and creating alongside an existing checkpoint is fine (task 18 selects at pickup).
- Confirm the worktree always survives the user's "clear" (clear ≠ reset) so dropping the diff is safe in every supported workflow — and whether there's any case where a user wants the diff captured anyway (e.g., before an intentional `git reset`).

---

### 18. Auto-rehydrate + auto-title checkpoints via a gated SessionStart hook

**Intent.** A checkpoint-gated `SessionStart` hook that, when a session resumes/clears with a pending checkpoint, automatically (a) rehydrates the continuation brief into context, (b) sets the session title from the checkpoint subject, and (c) consumes the checkpoint — so the developer never has to run a manual resume. Depends on task 17 (consumes its `tasks/logs/checkpoints/<…>.log` output). Together, 17 + 18 make checkpoint resume effectively automatic, while `/checkpoint resume` stays as the manual trigger of the same logic.

**Context.** A skill cannot invoke a slash command, so it can't auto-`/rename` or auto-rehydrate itself (the same wall that makes today's skill only *recommend* `/compact`). The supported automatic lever is a `SessionStart` hook: `additionalContext` is silently injected into the new session (= rehydrate, no visible turn), and `sessionTitle` renames the session (persists as a `custom-title` entry — schema `{"type":"custom-title","customTitle":"<subject>","sessionId":"<id>"}` — findable in `/resume`). `SessionStart` fires on `startup|resume|clear|compact`, receives `session_id` + `source` on stdin, runs in the project cwd, and can do filesystem checks — so it decides at runtime whether to act. (Verified against Claude Code hooks docs; precedent: `learning-output-style` plugin injects context via SessionStart; `warp` plugin uses matcher discrimination.)

**Constraints.**
- One gated hook, one script: rehydrate (`additionalContext`) + title (`sessionTitle`) + consume (atomic `mv` of the `.log` to a `consumed/` subdir — retained for reference, never re-injected).
- **Matcher `resume|clear|compact` only — never `startup`.** This is the core parallel-safety property: those are same-session-id continuations, so a session can only ever rehydrate *its own* checkpoint; a fresh startup never auto-grabs a stray one.
- **Gated:** no pending checkpoint for this session/worktree → silent no-op (`exit 0`). Clearing without a checkpoint does nothing.
- **Parallel-safety (hard requirement — parallel worktrees / sub-agent handoffs):**
  - Worktree/cwd isolation — each worktree has its own `tasks/logs/checkpoints/`; the hook only sees that worktree's.
  - Session-id match — rehydrate only the checkpoint whose `<ID>` matches the resuming `session_id`.
  - Atomic consume — `mv` to `consumed/` so two pickups of the same checkpoint cannot happen.
  - Sub-agents (Agent tool) do NOT fire `SessionStart`, so the brief is injected only into the top-level session, never duplicated across sub-agents.
- **Multiple unconsumed checkpoints → ask, don't guess.** Exactly one pending → auto-rehydrate. Several valid unconsumed ones visible to a pickup (several made in one worktree, or a sub-agent-handoff pile-up — realistically 3–4 max, but could spike in a heavy workflow) → do NOT auto-pick; surface a numbered menu ("N pending: 1) … 2) … 3) — which?") and let the developer choose, or defer to `/checkpoint resume`.
- **Robustness (fail-open):** a hook that errors or emits malformed JSON blocks session start — the script must wrap everything and `exit 0` on any failure. A broken hook must never prevent a session from starting.
- **Shared logic with `/checkpoint resume`:** the rehydrate+title+consume logic is one script that BOTH the hook (automatic) and `/checkpoint resume` (manual) invoke. `/checkpoint resume` doesn't literally fire the hook, but runs the same logic on demand — the explicit handoff lever for agent orchestration.

**Acceptance criteria.**
1. A `SessionStart` hook (matcher `resume|clear|compact`) runs a script that detects a pending checkpoint for the current session/worktree, injects its brief via `additionalContext`, sets `sessionTitle` from its subject, and atomically moves the `.log` to `consumed/`.
2. No pending checkpoint → silent no-op.
3. Multiple unconsumed valid checkpoints → numbered menu, developer chooses; never an auto-pick of the wrong one.
4. The hook never rehydrates another session's checkpoint (session-id match + matcher excludes `startup`), and never injects into sub-agents.
5. A malformed/erroring hook never blocks session start (fail-open, `exit 0`).
6. `/checkpoint resume` invokes the same rehydrate+title+consume logic on demand, and is the disambiguation path when several are pending.
7. Works for both `light` and `normal` checkpoints (mode-agnostic — injects whatever brief the `.log` carries).

**Relevant paths.**
- New hook script + `SessionStart` settings entry (placement per the hooks convention — `.claude/settings.json` `hooks.SessionStart` + a script under `.claude/scripts/` or `~/.claude/hooks/`; RDPI to place).
- Consumes `tasks/logs/checkpoints/<timestamp>-checkpoint-<NAME>-<ID>.log` (task 17 output) → `tasks/logs/checkpoints/consumed/`.
- Shared rehydrate logic also called by `/checkpoint resume` (`.claude/skills/checkpoint/SKILL.md`).
- Precedent: `learning-output-style` plugin (SessionStart context injection), `warp` plugin (matcher discrimination).
- Depends on: task 17 (must land first — defines the `.log` format/filename/subject).

**Open questions for RDPI.**
- Disambiguation UX when multiple pending: a hook-injected numbered menu, or always defer to `/checkpoint resume` (i.e., inject "multiple pending — run `/checkpoint resume` to pick")? Can a SessionStart hook realistically present a choice mid-startup?
- Settings placement: project `.claude/settings.json` (team-shared) vs. user settings (machine-local). The hook is developer-workflow (leans local) but checkpoints are project artifacts. Decide.
- Consume timing: `mv` to `consumed/` on inject — what if the session is abandoned right after (brief effectively lost)? Acceptable, or keep until the first real turn?
- Does the hook's `sessionTitle` reliably persist to `/resume` (writing a `custom-title` entry)? 30-sec confirm; if not, the script appends the `custom-title` line directly (confirmed schema above).
- `compact` trigger: the user doesn't compact, but the hook fires on it — confirm consume-on-first-inject prevents double-injection across a compact.

---

### 23. Multi-model workflow routing — CLAUDE.md Workflow section + recursion-guard upgrade + /forge rewrite

**Intent.** Add a model-routing layer for delegated work, now that Codex and Gemini run as native subagent types (task 22). Three pieces. (1) A new **Workflow** section in CLAUDE.md governing ALL agent dispatch — Workflow-tool scripts AND plain Agent-tool spawns: when work is delegated, the orchestrator allocates the model by role. Role defaults: **Codex = coding** — essentially all of it, including small code changes; **Opus = auditing Codex output, synthesis, review**; **Gemini Flash = small/minor tasks, repetitive and high-volume/high-frequency work, and fetching**; **Sonnet = trivial fan-out work that specifically relies on the Claude harness** (reliability, harness tooling, longer context — volume alone goes to Gemini); **the session model (Fable) = orchestrator only, never spawned as a sub-agent**. The role defaults compose into a standing **artifact authoring chain** for non-code deliverables (specs, docs, plans, strategy): Codex = upstream generative work (knowledge dump, ideation, strategy, mockups); Opus = authors the deliverable from that raw material; the orchestrator = reviews in the main loop — stated here at the routing level so every dispatching workflow inherits it, not just `/forge`. Written as cue-based soft guidance — guardrails plus stated-reason freedom, not a rigid matrix (workflows hit millions of scenarios; the section steers defaults, it doesn't forbid judgment). (2) Replace the recursion guard with the orchestrator-grant version (text below). (3) Rewrite `/forge` — the only existing workflow-touching skill — into a dispatch-led orchestration lane on the new allocation. Three developer decisions (2026-06-11): **Codex builds all code** — even the main build pass dispatches to Codex workers; the orchestrator frames, coordinates seams, and reviews rather than writing the code itself. **Forge is piece-agnostic and task-shaped**: the piece may be a non-code deliverable (spec, design doc, plan) just as well as code, and the orchestration is composed per piece (sequential seams, parallel Workflow lanes, a single worker — whatever the piece's shape calls for) rather than one fixed linear pass. **Artifact pieces follow the authoring chain** defined at the routing level in (1) — Codex ideation/knowledge-dump → Opus authors → orchestrator reviews; reviewer≠author holds at every link, and the Codex gates still run on the Opus-authored artifact. Forge applies the chain; it does not define it. Invocation stays `/forge <piece>` with no implied pairing or sequence: forge whatever the piece is — specs only for a while, code from a spec forged weeks ago, a doc, a plan, something else entirely. Chained runs (`/forge` the spec, later `/forge` the code from it) are one common pattern where run 1's output becomes run 2's source — an emergent usage, not a prescribed two-step, and never one internal authorship pipeline.

**Constraints.**
- Routing is guidance with guardrails: recognition cues + default allocations + an explicit freedom clause (deviate with a one-line stated reason). Per established feedback: concrete cues over "best judgment" — every role gets recognition cues, not adjectives.
- The session model is never spawned as a sub-agent. Orchestration, spine decisions, and user interaction stay in the main loop.
- Acknowledge the Opus/Codex overlap (both review and synthesize well) with a cross-model cue: **reviewer ≠ author** — Codex-written code is audited by Opus/Claude; Claude-written artifacts get Codex review (the existing playbook handshake). Don't pretend the roles are disjoint. Escalation layer: on high-stakes items, add a **Gemini verification pass** as a third perspective family-independent of both Codex/GPT and Claude — an additional vote on top of the handshake, never a replacement for the primary reviewer.
- **Graceful degradation, no env sniffing:** in a non-relayed session, `agentType: codex` / `gemini-flash` fails fast with a distinctive error (~440ms — codex doc §7b); that fast-fail IS the installed-or-not detector. Fallback routing is Claude-only (Opus takes coding, Sonnet/Haiku take small tasks), and `/forge` falls back to its current orchestrator-builds-in-main-loop shape. The playbook must remain fully usable without task 22's install.
- Mechanics stated correctly: the Workflow tool's `model:` opt is a closed enum (`sonnet|opus|haiku|fable`) — Codex/Gemini route via `agentType`; Claude tiers via `model`. Cite the agent-type names task 22 ships.
- The trio (`/codex-research`, `/codex-review`, `/codex-audit`) stays on `codex exec` — explicitly out of scope (codex doc §7b remains design-only).
- Recursion-guard replacement is the developer-supplied orchestrator-grant text (below) — adapt wording minimally; the grant is non-transitive (max depth: parent → orchestrator → leaf); granted only for adaptive investigation; plannable fan-out returns a work-list as structured output instead.
- `/forge`'s leaf-write override, sub-agent caps, and "every spawn pins model explicitly" rule must be reconciled with both the new guard and the new builder routing — not deleted, re-derived.
- Non-code pieces are first-class, not incidental: Frame classifies **deliverable type** alongside load-bearing/conform-only, and Verify gets a defined per-type form — tests/typecheck for code; fidelity audit against upstream sources + internal-consistency pass for artifacts (specs, docs, plans). The type list is open: a piece that is neither gets a Frame-declared verify plan rather than a forced fit. Today an artifact piece silently loses its verify loop (`forge/SKILL.md:47` hard-codes tests/typecheck) — that silent degradation is the bug this constraint fixes.
- CLAUDE.md edits (Workflow section AND new guard) are mirrored into `.claude/templates/playbook-sections.md` (`playbook-setup/SKILL.md:31` appends it on existing-project setup; a CLAUDE.md-only edit is lost on fresh installs).
- Depends on task 22 (the agent types and relay this section routes to must be installable first).

**Replacement recursion-guard text** (developer-supplied; adapt minimally):
> **Recursion guard:** Sub-agents are leaf tasks (read, search, report) and MUST NOT spawn sub-agents unless their spawn prompt explicitly grants the orchestrator role. The grant is non-transitive: an orchestrator spawns leaves only (max depth: parent → orchestrator → leaf).
> Grant the role only for adaptive investigation — when each next spawn depends on the previous result and the lead's accumulated context doesn't serialize well (deep debugging, unfamiliar-code archaeology). If the fan-out is plannable up front, don't grant: have the lead return a work-list as structured output and spawn its items from the parent or workflow script.

**Acceptance criteria.**
1. CLAUDE.md gains a **Workflow** routing section (placed near Sub-Agent Behaviors; exact placement RDPI's) covering all agent dispatch: the role table with recognition cues, the artifact authoring chain (Codex ideation/knowledge-dump → Opus authors → orchestrator reviews), the never-spawn-the-session-model rule, the reviewer≠author cross-model cue, the explicit-pin rule (every dispatch names `agentType` or `model`; never inherit), the fast-fail fallback rule, the freedom clause, and a pointer naming the codex trio SKILL.md specs as the canonical execution path for the research/fidelity-audit roles (skills cannot be slash-invoked from workflow subagents — the orchestrator applies the spec inline, forge's existing pattern).
2. The recursion guard in CLAUDE.md is replaced with the orchestrator-grant version; no skill references the old wording in a way that now contradicts it (e.g., `forge/SKILL.md:60` cites the guard).
3. Both edits are mirrored in `.claude/templates/playbook-sections.md`.
4. `/forge` is rewritten as task-shaped orchestration: the orchestrator composes the dispatch per piece (sequential seams, parallel Workflow lanes with `isolation: 'worktree'`, or a single worker) instead of one fixed linear lane; code Build dispatches to Codex workers (`codex-xhigh` for deep-reasoning seams); the Orchestration & routing hierarchy is rewritten with no Fable spawns; Opus keeps audit/bounded-fix roles; Gemini/Sonnet slots per the new table; design-confirm pause and verify cycles stay orchestrator-run in the main loop; the non-relayed fallback (current main-loop build) is documented in-skill.
5. `/forge`'s frontmatter/description and the README `/forge` row are reworded where "model-led single pass" no longer matches the dispatch-led shape.
6. No other skill is touched: the trio unchanged, RDPI skills unchanged (their sub-agent spawns inherit the CLAUDE.md section by reading it, not by per-skill edits).
7. `/forge` is deliverable-agnostic: `/forge <piece>` accepts any piece type with no implied pairing; Frame classifies deliverable type; artifact pieces follow the decided authoring chain (Codex ideation/knowledge-dump → Opus authors → orchestrator reviews) with both gates intact; Verify has a defined form per type (and a Frame-declared plan for unlisted types); the chained spec-run → code-run flow is documented in-skill as one example pattern, not a prescribed sequence.

**Relevant paths.**
- Project rules: `CLAUDE.md` (Sub-Agent Behaviors — guard replacement; new Workflow section)
- Mirror: `.claude/templates/playbook-sections.md:137` (Sub-Agent Behaviors block)
- Skill to rewrite: `.claude/skills/forge/SKILL.md` (Steps 1–4 — Frame gains deliverable-type classification; Build/Verify per type — plus Orchestration & routing, frontmatter)
- Docs: `README.md` (`/forge` row, workflow blurb)
- Research seeds: `tasks/codex-native-agents.md` (§4 usage, §6 constraints, §7b fallback protocol), `tasks/gemini-native-agents.md`
- Dependency: task 22 (agent types + relay installable). Soft collision: task 13's bucket-vocabulary sweep also edits `/forge` — independent sections.

---

**Design notes for RDPI to review:**

1. **Role table candidate rows** (RDPI drafts the final cues): coding of any size — feature, fix, small mechanical code change — → `codex`; hard analysis/synthesis leaf needing deep reasoning → `codex-xhigh`; audit/review of Codex-written code, multi-source synthesis → `opus` (or Codex when Claude authored the inputs — reviewer≠author); upstream ideation/knowledge-dump/strategy mockups for artifact pieces → `codex`/`codex-xhigh` (raw material — Opus authors the deliverable); fetch/lookup/format/small mechanical non-code, repetitive or high-volume/high-frequency tasks (the same small operation, many times), plus research support (bulk source-fetching/collation alongside a Codex research pass) and a cross-family verification vote on high-stakes items (reviewer≠author constraint) → `gemini-flash`; bulk fan-out reads where Claude-harness strengths or longer context are specifically needed → `sonnet` (volume alone routes to `gemini-flash` — note 2); orchestration → main loop, never spawned.
2. **Sonnet vs Gemini Flash boundary (developer-tilted 2026-06-11: Gemini is the default)** — both are "small-task" tiers, but the allocation is asymmetric: small, repetitive, high-volume, and high-frequency work routes to Gemini Flash unless the task specifically relies on the Claude harness (reliability, harness tooling, longer context) — that harness need is Sonnet's recognition cue, and routing small work to Sonnet deserves the stated one-line reason. Repetition and volume are the distinguishing signals, not just task size; economics drive the tilt (note 4). RDPI sharpens the wording, not the direction.
3. **Haiku's slot** — the user named Opus/Codex/Gemini/Sonnet only. Haiku remains in the Workflow `model:` enum; decide whether it gets a row (cheapest Claude tier) or is folded under Sonnet's, and what the Claude-only fallback table uses for the small tier.
4. **Where the cost posture lands** — established feedback: Codex calls are cheap, Claude agent spend is dear; and Gemini Flash is a frontier-tier model at a fraction of Claude prices — near-Opus real-world quality, on-par on benchmarks, with ample capacity (developer note 2026-06-11) — which is why repetitive/high-volume work defaults there instead of Sonnet. The routing section can encode this as the economic rationale line (it explains WHY coding defaults to Codex and volume defaults to Gemini), but keep it one line — cues carry the behavior.
5. **Forge gate mechanics: exec vs native** — forge's gates currently apply the trio specs via Bash `codex exec`. With native codex agents available, gates could become native spawns (`schema` structured findings kill the temp-file plumbing). But the shared `codex-invoke` contract (codex doc §7b) is explicitly out of scope, and changing gate mechanics inside forge only would fork the trio specs' semantics. Default: gates stay on exec this task; revisit when §7b is promoted. RDPI may override with reasons.
6. **Dispatch-led forge implications** — with Codex building all code: seam briefs become the load-bearing artifact (the orchestrator must serialize intent/contracts per seam — forge's continuation-prompt discipline already does this between phases; reuse the shape); parallel independent seams become natural Workflow + `isolation: 'worktree'` candidates; the per-phase sub-agent caps (≤4, ≤2 concurrent) need re-deriving for Codex workers (they're cheap — but the cap also bounds coordination chaos, not just cost); and the design-confirm pause stays main-loop (workflows take no mid-run input).
7. **Reconcile with the existing Sub-Agent Use section** — CLAUDE.md already has spawn rules (split test, batching, acceptance contract, parent-only fallback). The Workflow section is a sibling concern (WHICH model) vs Sub-Agent Use (HOW to spawn). Keep them adjacent and cross-referenced; don't merge into one mega-section — but do reconcile the acceptance-contract wording with non-Claude leaves (Codex/Gemini agents must also return citations).
8. **Orchestrator-grant interplay with routing** — an orchestrator-granted sub-agent (adaptive investigation) picks models for ITS leaf spawns by the same table. State this explicitly so the grant doesn't read as exempting the grantee from routing.
9. **Artifact authoring chain (developer decision 2026-06-11; routing-level, not forge-only)** — Codex generates the raw material (knowledge dump, ideation, strategy, spec mockup — generative breadth, per the Codex-researches/Claude-synthesizes feedback); Opus authors the deliverable from it; the orchestrator reviews in the main loop. The chain lives in the CLAUDE.md Workflow section; forge and any future artifact-producing workflow apply it. RDPI sharpens the mechanics, not the allocation: when the Codex ideation pass runs vs is skipped (wide/unfamiliar territory → run; narrow conform-only doc → skip), whether `codex-xhigh` takes the ideation slot for hard-strategy pieces, and how the dump is handed to Opus (a kept doc under `tasks/logs/research/` is the existing shape).
10. **Artifact-Verify vs Gate 1 overlap** — for an artifact piece, the fidelity audit (Gate 1) and Verify both reduce to "check the piece against its sources." Decide whether artifact-Verify is a distinct internal-consistency/cross-reference pass or whether Gate 1 doubles as Verify — don't run the same Codex audit twice per cycle under two names.
11. **Trio specs ↔ routing roles** — the research and fidelity-audit rows are already encoded as skills (`/codex-research`, `/codex-audit`), and skills can't be slash-invoked from workflow subagents. The execution pattern is forge's: the orchestrator reads the SKILL.md and applies it inline via Bash `codex exec`, or serializes the spec's steps into a `codex` worker's prompt. The Workflow section gets one pointer line, not duplicated mechanics — consistent with the trio-on-exec constraint and note 5. Gemini's research-support slot (fetching/collation alongside a Codex research pass) is a cue on the `gemini-flash` row, not a new role.
12. **Gemini as cross-family verifier (developer decision 2026-06-11)** — on super-important items, add a Gemini Flash verification pass as a third perspective that shares lineage with neither Codex/GPT nor Claude. RDPI drafts the "high-stakes" recognition cues (candidates: load-bearing contracts, security-sensitive changes, irreversible/outward-facing actions) and decides where it executes (a verifier lens in workflow adversarial-verify panels; an extra vote in forge's gate cycle on load-bearing pieces). Weighting: Flash is a frontier-tier model — on par with Opus on benchmarks, slightly below in real-world use, significantly cheaper (developer note 2026-06-11) — so its verdicts carry substantive weight, not just diversity value. Still vote-not-veto, but for arbitration reasons, not capability ones: any single verifier's objection escalates to the orchestrator rather than hard-blocking on its own.

**Open questions for RDPI:**

- Should the fallback (non-relayed) routing table be spelled out in CLAUDE.md, or is "fall back to Claude tiers by the same role logic" one line enough? (Full second table risks doubling the section's length for the uninstalled case.)
- Does the Workflow section bind RDPI-phase sub-agent spawns (e.g., `/research-codebase` parallel readers) immediately, or is RDPI-skill alignment a follow-up sweep? AC6 says no per-skill edits — confirm reading-CLAUDE.md inheritance is actually sufficient in practice.
- `/forge` naming after the rewrite: "single-pass" still holds (one Frame → Build → gate pass); does "built for the strong-model window" framing survive when the strong model no longer writes the code, or does the skill description get re-grounded on orchestration quality? Relatedly, "build lane" and "wide generative pieces" read code-only — the rewording sweep (AC5) should make artifact pieces legible from the frontmatter alone.
- Where exactly does the Workflow section live — inside the fixed RDPI Workflow Rules block (always loaded with workflow context) or as its own top-level block near Sub-Agent Behaviors? (Same placement question pattern as task 13's CLAUDE.md rule.)

