# Todo

> Active task list. Completed tasks archived to `tasks/completed.md`.

> **Adding tasks here manually?** Follow the `/create-todo` ideology (`.claude/skills/create-todo/SKILL.md`): each task is a self-contained unit of work for its own RDPI cycle, written at the capability/outcome level — scope *and* deliverables say WHAT the task produces, not HOW. Keep implementation mechanisms (method signatures, file-path-level commands, library calls) out of acceptance criteria; those choices are decided inside each task's research/design/plan. Surface open questions; don't pre-solve them.

> **TEMPORARY — remove when issue #8 closes.** `/create-todo` does not yet emit the patterns this backlog relies on: the four-field intake (Intent / Constraints / Acceptance criteria / Relevant paths), per-task open-questions with the non-blocking-preflight note (see the RDPI note below), and a per-task "Design notes for RDPI to review" block. Until issue #8 (`tasks/new-issues.md`) lands those into the skill, add them by hand when manually creating a task here. Issue #8 includes deleting this note as a cleanup step.

## Dependencies & pickup order

Numbering is reference-only, not execution order. The backlog splits into three roughly-independent fronts; pick within a front in dependency order.

- **Codex-trio + forge (19, 20, 21) — current priority, being tackled first.** `19` (`/codex-audit`) → `21` (`/forge`) is the hard critical path: forge's fidelity gate is the one genuinely new capability it needs. `20` (`/codex-research`) is independent of `19` and can run in parallel; `21` self-summons `/codex-research`, so `20` improves `21` but doesn't block a first version. `/codex-review` already exists. All three are doable now — `19`/`21` inline triage's bucket logic rather than waiting on `13`. Net: `19` and `20` in parallel, then `21`.
- **Triage-rooted chain (13 → 14/15 → 16).** `13` (`/triage`) is the root: `14` (`/codex-goal`), `15` (RDPI structural), and `16` (inference-reduction) all hard-depend on it. `16` additionally depends on `15`.
- **Checkpoint pair (17 → 18).** `18` (auto-rehydrate hook) consumes `17`'s (`/checkpoint` redesign) output, so `17` lands first. Independent of the other two fronts.

Cross-front: `13` strengthens the apply step of `19`/`21` but isn't a hard blocker there — they inline its bucket logic.

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
- Skills to modify: `.claude/skills/codex-review/SKILL.md`, `.claude/skills/implement/SKILL.md`, `.claude/skills/implement-codex/SKILL.md`, `.claude/skills/issue-implement/SKILL.md`, `.claude/skills/create-plan/SKILL.md`, `.claude/skills/issue-plan/SKILL.md`, `.claude/skills/design/SKILL.md`
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
8. **Bucket naming reconciliation** — codex-review 6b uses `apply` / `judgment call` / `noise`; omk-core triage uses `A.1` / `A.2` / `B` / `C`. Pick one. Preference: `A.1/A.2/B/C` (separates auto-fix from no-op, more precise) — RDPI to confirm.
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

### 19. Add /codex-audit skill — source-grounded fidelity + completeness audit (Codex)

**Intent.** Create a new standalone skill `.claude/skills/codex-audit/SKILL.md` — a Codex pass that checks a target *against the source(s) it was built from* for **fidelity** (faithful restatement of what the source means), **completeness** (load-bearing facts the target dropped), and **precision** (correct names / IDs / sections). This is the relational `target ↔ source` check that `/codex-review` structurally cannot do: `/codex-review` reads the target in isolation and critiques its merit (factual / simplest-approach / pattern), so it can only surface what is *present and wrong* — never what is *absent* relative to a ground-truth source (an omission is invisible to a blind pass over the target alone). `/codex-audit` fills that gap. **`/codex-review` stays exactly as-is** — review = opinion on merit; audit = verification against source. Prior art: the Omakase `codex-source-audit.md`, which proves the pattern but is hardwired to the fp-rebuild docs — this generalizes it.

**Constraints (firm — settled in pre-RDPI discussion).**
- **Standalone skill.** No persistent artifact, reads no RDPI prerequisites — same boundary as `/codex-review`. Distinct from the `/code-review` / `/security-review` PR workflows.
- **Sources are Claude-injected, never a user argument.** Almost everything is built on something, and Claude (driving the command, in the chat) already knows the source docs — so the command must NOT require an `against <sources>` arg. But Codex (the `codex exec` subprocess) cannot see the chat, so Claude composes the relevant source(s) into the Codex prompt automatically. Confirm with the developer only when the source of truth is genuinely ambiguous.
- **Lenses are derived per-target by Claude — never a fixed menu.** The right lenses depend on what the document is about (a code-migration target wants blast-radius / right-home / fiddly-transforms / still-compiles; a synthesized design doc wants lineage / omission / restatement fidelity). The prompt may offer *example* lens sets as inspiration, but must NEVER present "here are the lenses, choose one" — that anti-pattern is explicitly out of scope. Structure = always-on **core** (fidelity, completeness, precision) + Claude-composed **secondary** lenses fitted to the specific target.
- **No hardcoded loop.** Default = a single pass. Looping is opt-in via a `passes` argument (replaces the fork's baked-in 3×).
- **Manual invocation** (`disable-model-invocation: true`) per [[feedback_skill_manual_invocation]] — it is a side-effecting workflow skill (it may edit the target), not a passive/advisory one.

**Arguments.**
- `argument-hint: '[file | diff | artifact | "description"] [passes]'`
- Leading token(s) = target (freeform: path, diff, artifact, or quoted description) — resolved the same way `/codex-review` resolves its target (explicit `$ARGUMENTS`, else inferred from conversation).
- Trailing optional integer = `passes` (number of `review → triage → apply` loops). `/codex-audit foo.md 3` → 3 passes; omitted → 1.

**Acceptance criteria.**
1. `.claude/skills/codex-audit/SKILL.md` exists with skill frontmatter, `disable-model-invocation: true`, and `argument-hint: '[file | diff | artifact | "description"] [passes]'`.
2. The composed Codex prompt runs the relational fidelity + completeness + precision audit against Claude-injected source(s) — NOT the three-lens merit review (that stays in `/codex-review`).
3. Lenses are derived per-target; the prompt offers example lens sets but presents no fixed lens menu.
4. `passes` parsed from the trailing integer; default 1; each pass is `review → triage → apply` with the next pass seeing the corrected on-disk state (mirrors `codex-source-audit.md` Step 3).
5. Reuses the established Codex plumbing: safe tmp-file prompt compose, `codex -a never exec --sandbox read-only`, `codex-output-check.sh` verification, cleanup-before-present (`codex-review/SKILL.md`).
6. `/codex-review` is unchanged.
7. `/playbook-update`'s managed-file list accounts for the new skill (same check as task 13 AC8 — enumerated vs globbed).

**Relevant paths.**
- New skill: `.claude/skills/codex-audit/SKILL.md`
- Prior art (generalize, don't copy): `~/Projects/Omakase/omk-core/.claude/commands/codex-source-audit.md`
- Reference conventions: `.claude/skills/codex-review/SKILL.md` (target resolution, safe tmp-compose, cleanup-before-present, "Codex confidence is not evidence" caveat), `.claude/scripts/codex-output-check.sh`
- `/playbook-update` managed list: `.claude/skills/playbook-update/SKILL.md`
- Related: task 13 (`/triage`) — codex-audit's between-pass triage should reuse the inline triage bucket logic, not reinvent it.

**Open questions for RDPI.**
- **Recommend-only vs apply-by-default.** `/codex-review` is recommend-only; `codex-source-audit` applies verified fidelity-defects. Candidate resolution to evaluate: couple it to `passes` — a multi-pass loop *must* apply between iterations (so pass N+1 reads corrected state), while a single pass could default to recommend-only. Confirm, and decide whether an explicit `--no-apply` escape is needed. (See [[feedback_taskspec_tradeoffs_to_rdpi]].)
- **Argument parsing edge.** Trailing-integer `passes` vs a freeform target that legitimately ends in a number. Leading-flag form (`--passes N <target>`) is unambiguous but heavier; the trailing-int form is the ergonomic one the developer wants. Decide the rule (lean: the last whitespace token, if it parses as a small int and a non-empty target remains, is `passes`).
- **Lineage / supersession lens.** It is the fp-rebuild fork's highest-value check but is source-versioning-specific. Core lens, or just one secondary lens Claude adds when the sources carry a supersession order? (Lean: secondary, conditional.)
- **Default `passes` cap.** Any upper bound to stop a runaway `/codex-audit x 99`?

---

### 20. Add /codex-research skill — general-purpose Codex research (codebase + external), auto-invoked

**Intent.** Create a new standalone skill `.claude/skills/codex-research/SKILL.md` — a general-purpose Codex research command, third in the Codex trio (`/codex-review` = merit, `/codex-audit` = fidelity, `/codex-research` = grounding / second opinion). It covers three research modes, with Claude routing to whichever the request needs (no fixed menu): (1) **codebase grounding** — survey what exists before acting; (2) **misc / generative** — novel approaches, "is there a better way"; (3) **external / prior-art** — how others tackled a comparable problem, from any public source: OSS implementations, **published research / papers**, official docs, standards, engineering writeups — not limited to source code. Usable anytime, including mid-task when stuck on an open question or to bring the developer richer grounding on a serious decision. Unlike `/codex-review` and `/codex-audit`, its output is a **kept research document**, not a deleted tmp.

**Distinct lane (settled).** Coexists with two existing tools, clear lanes — none replaced:
- `deep-research` skill — Claude-native fan-out web harness with adversarial verification. Unchanged.
- `/research-codebase` — the RDPI Phase-1 step that writes `tasks/research-codebase.md` behind an intake gate. Unchanged.
- `/codex-research` — Codex-powered, codebase + external, **no RDPI**, invokable anytime (incl. auto). The "send Codex to go dig" lane.

**Constraints (firm — settled in pre-RDPI discussion).**
- **Standalone, no RDPI prerequisites.** Reads no RDPI artifacts; not gated by the pre-edit classification (it edits no source — it only writes a research doc). Both **auto-invoked** and manually invocable as `/codex-research <topic>`.
- **Auto-invocation — intentional exception to [[feedback_skill_manual_invocation]].** Most workflow skills set `disable-model-invocation: true`; this one is deliberately auto-fireable because it is an advisory, read-only-on-code research tool. Flag the exception in the skill so it doesn't read as a mistake.
  - **Trigger:** auto-fire whenever Claude is about to stop and ask the developer — an open question, a hard judgment call, a blocker. Run the Codex second opinion *first*, then surface to the developer with that grounding (or with the question resolved). The point is a second opinion *before* bothering the human, not after.
  - **Run mode:** background / non-blocking (`run_in_background: true`). Claude keeps working; findings surface when ready. No 10-minute stall on the turn.
- **Output is a kept research doc — never auto-deleted.** Default home: `tasks/logs/research/<YYYY-MM-DD>-<descriptive-slug>.md`. `tasks/logs/` is already gitignored (`.gitignore:6`), so the default is local-only, uncommitted, and out of the working `tasks/` files — organized by date + descriptive name under a dedicated research folder (mirrors the `tasks/logs/checkpoints/` convention).
  - **Promotion path (human-gated):** when a research doc becomes a reference / supporting-evidence trail for another doc, Claude asks the developer, then extracts it into a real committed doc at a Claude-chosen location (best judgment — e.g. the relevant component's `docs/`). Only promoted docs get committed; the default never does.
  - This **supersedes** the rough-outline idea of Claude scattering docs into component folders by default. Default = the organized local logs folder; component-`docs/` placement is the *promotion* case, gated on human input, not the default.
- **External mode is broad but Claude-discretionary.** "External" = prior art from any public source (OSS code, published research / papers, official docs, standards, engineering writeups), not just repos. It is **not always-on**: codebase grounding is the common path, and Claude reaches for external only when prior art would actually help — bounded by judgment, but *not* hard-gated and *not* flag-required (don't gate it strictly; don't fire it every time). External research needs Codex web access (`--search`, cf. issue #4); codebase / misc modes stay codebase-grounded. RDPI to settle the exact flag + sandbox per mode.
- **No fixed mode menu.** Claude routes to the right research mode(s) from the request — consistent with the `/codex-audit` lens philosophy. The prompt may describe the modes as ideas, never "pick a mode."

**Arguments.**
- `argument-hint: '[topic or question]'` — a **single** freeform argument: the thing to research, phrased as a topic or a question. (Not multiple input kinds — unlike `/codex-review`'s `file | diff | artifact`, codex-research's input is always "a thing to research.")
- Resolved like `/codex-review`: explicit `$ARGUMENTS`, else inferred from conversation / the open question that triggered the auto-fire.

**Acceptance criteria.**
1. `.claude/skills/codex-research/SKILL.md` exists with skill frontmatter and `argument-hint`, and is **auto-invocable** (NOT `disable-model-invocation: true`), with an in-skill note that the auto-invoke is a deliberate exception to the manual-invoke convention.
2. The skill documents the three research modes (codebase grounding / misc-generative / external prior-art) and routes among them per request — no fixed mode menu; external is reached for at Claude's discretion, not by default.
3. Auto-fire is wired to the "about to ask the developer" moments (OQ / hard judgment / blocker): run Codex first, then surface with grounding or resolution.
4. The Codex call runs in the background (`run_in_background: true`) — non-blocking; findings surface when ready.
5. Output is written to `tasks/logs/research/<YYYY-MM-DD>-<slug>.md` (local, gitignored) and is NEVER auto-deleted.
6. A human-gated promotion path extracts a research doc into a committed Claude-chosen location only on developer confirmation, when it becomes a reference trail.
7. External mode runs Codex with web access (`--search`); codebase / misc modes stay codebase-grounded.
8. `/playbook-update`'s managed-file list accounts for the new skill (same check as task 13 AC8 — enumerated vs globbed).
9. `/codex-review` is unchanged; `deep-research` and `/research-codebase` are unchanged.

**Relevant paths.**
- New skill: `.claude/skills/codex-research/SKILL.md`
- Reference conventions: `.claude/skills/codex-review/SKILL.md` (target resolution, safe tmp-compose, Codex invocation + `run_in_background`, "Codex confidence is not evidence" caveat), `.claude/scripts/codex-output-check.sh`
- Storage: `tasks/logs/research/` (new) — under the already-gitignored `tasks/logs/` (`.gitignore:6`); mirrors `tasks/logs/checkpoints/` (tasks 17/18).
- Stay distinct from: `deep-research` skill, `.claude/skills/research-codebase/SKILL.md`.
- Related: issue #4 (Codex `--search` enablement) — external mode depends on the same flag.
- `/playbook-update` managed list: `.claude/skills/playbook-update/SKILL.md`

**Open questions for RDPI.**
- **Auto-fire frequency control.** "Before asking the developer" is the trigger, but how to keep it from firing on every minor hesitation? Need a threshold (only OQs / judgment-calls of real weight), debounce on the same OQ, and a per-session cap. Define it.
- **Background-to-foreground handoff.** When a backgrounded codex-research finishes, how does it surface — interrupt with findings, or fold into the next turn? And what if the developer has moved on or the OQ self-resolved meanwhile?
- **`--search` / sandbox per mode.** External mode needs network; codebase mode wants read-only. Settle the exact `codex exec` flags + sandbox per mode (coordinate with issue #4).
- **Promotion mechanics + default location.** What exactly triggers the "this is now a reference trail → ask to promote" prompt, and where do promoted docs land by default (component `docs/`, a top-level `docs/research/`, …)? Claude-judgment with a sensible fallback.
- **Research-slug convention.** How to name `<descriptive-slug>` so files stay scannable (topic-based, or OQ-id-based when auto-fired from an open question?).

---

### 21. Add /forge skill — slim single-pass build lane for strong models (temporary, Fable window)

**Intent.** A deliberately thin, **temporary** build lane that collapses RDPI's Research/Design/Plan/Implement-design into one model-led pass for *wide, generative* tasks (immediate use case: the omk-core fp-rebuild spine, starting with `contracts.md`), then verifies with the Codex trio. Motivated by three things: (a) full RDPI runs ~6 Codex `xhigh` sweeps (research 1 + design up-to-3 + plan 1 + implement 1) plus 4 artifacts that re-read each other — heavy token burn, calibrated for Opus; (b) a temporarily-stronger model (codename **Fable**, ~2-week window) needs less option-enumeration scaffolding and benefits from wide-lens freedom; (c) the assess→design option matrix actively *taxes* a model whose edge is wide generative design — option-enumeration is a crutch that stops a weaker model from tunneling on idea #1, which Fable doesn't need. Governing principle: **scaffolding scales inversely with model strength.** `/forge` is the lighter calibration for the strong-model window; when it reverts to Opus, full RDPI resumes unchanged. (Note the opposite vector of task 15, which *adds* scaffolding because Opus is under-informed — same curve, opposite direction.)

**Lane shape.** Frame → Build → gate → gate → verify:
1. **Frame** (no Codex) — read the source piece fully + directly-referenced files; 3-line intent + acceptance criteria. Lightweight four-field intake without the ceremony.
2. **Build** — one freeform model-led pass that designs *and* writes code together. No axis/option matrix. Front of lane is model-led: the model reads the bounded surface directly (independence belongs on verification, not input-gathering); it **self-summons `/codex-research` only when it decides it needs broader grounding** — Codex is an on-demand discovery tool here, not a fixed sweep.
3. **Optional design-confirm pause** — before writing code, the model states the contract shapes / boundaries in a few lines and waits for a yes/no. Preserves one cheap human gate (RDPI fuses design+implement, losing `/create-plan`'s approval point). Default ON for load-bearing pieces (contracts), OFF for conform-only follow-ons.
4. **Gate 1 — fidelity** (`/codex-audit`, task 19) — target ↔ blueprint; catches omissions / infidelity. Runs first: no point polishing merit on code that doesn't faithfully implement the spine.
5. **Gate 2 — merit** (`/codex-review`, exists) — diff in isolation; catches present-and-wrong.
6. **Apply** triaged fixes (classification inlined per task 13), each routed by the agent hierarchy below — Fable keeps the complex ones, cheaper tiers take the bounded/mechanical. Then **Verify** (tests / typecheck) and present.

Both gates are RUN/SKIP per piece: contracts gets both; conform-only follow-ons may get audit-only or neither. Net Codex cost ~1–2 calls vs RDPI's ~6.

**Gate convergence.** The audit + review gates may **loop until a good state by best judgment** — each pass is review → triage → apply-fix → re-check, the next pass seeing corrected on-disk state (reuses `/codex-audit`'s `passes` mechanic, task 19). Convergence ≠ zero findings: stop when a pass surfaces no *new critical* findings (residual nits are acceptable, not grounds to keep looping). Bounded by a max-passes safety cap so it can't thrash (cf. task 19's passes-cap OQ). The loop runs at the **orchestrator** level — because the recursion guard makes build / gate / fix separate leaf dispatches that something has to coordinate (see routing).

**Phased execution & operator handoff.** A wide piece must NOT build in one ever-growing context. `/forge` splits the work at *natural seams* (per contract group / module boundary it discovers during Frame), completes one phase, then **compacts and emits a ready-to-run continuation prompt for the next phase** — the operator compacts and continues on a clean window. This reuses the existing **Multi-Batch Plans** rule (`CLAUDE.md` — one batch per prompt, compact between) and the `/checkpoint` light-handoff artifact (tasks 17/18); do NOT invent a new handoff format. Each phase is independently buildable + verifiable; the continuation prompt carries forward only the settled spine decisions + remaining phase list, never raw file contents.

**Workflow & agent routing (Fable-orchestrated, ultracode).** `/forge` may use the Workflow tool — invoking the skill is itself the Workflow opt-in. Power model: **Fable orchestrates in a lean main loop (ultracode)** and owns the one thing that can never be delegated — the **spine / contract design** (the coherent whole). Everything downstream of a settled spine can be dispatched as a **leaf** task. The inherit trap stays: Workflow agents *inherit the main-loop model by default*, which under Fable spawns a swarm — so **every spawned agent pins its model explicitly; none inherit.** Agent groups:
- **Fable** — (1) the orchestrator / main loop, which owns the spine design and never delegates it; and (2) optionally a **single sub-agent per phase** that writes that phase's code against the settled spine — keeping the orchestrator context lean (raw reads + code churn live in the disposable sub-agent, only the result returns). One Fable sub-agent *per seam* — never many fanning out, never sub-splitting one interdependent phase (that's the drift the spine avoids).
- **Opus** — orchestrator's judgment call: takes a **straightforward phase** (doesn't need Fable) and the **bounded gate fixes** (quick changes). Complex fixes — e.g. a subtle bug — stay with Fable; nothing is auto-routed down by rule. Substantive-but-not-spine work.
- **Sonnet** — cheap fan-out: reads / pull-in / grounding (no logic), **plus** trivial mechanical writes only (stub a file, create a folder, boilerplate scaffold). Never real logic.

Guardrails: the **spine design** stays in the orchestrator (never delegated — this preserves coherence); **delegate at the seam, not within it** (one sub-agent per independent phase, handed the spine contract it must conform to); lean **sequential** per seam by default so phase N+1 sees N's output, parallel only for genuinely independent phases (which then need `isolation: 'worktree'`); sub-agents are leaf (no recursion — `CLAUDE.md:178`), so **build, gate-loop, and fixes are separate leaf dispatches the orchestrator coordinates** — a build sub-agent can't itself spawn the fix sub-agent; a **hard cap on concurrent + total agents** (budget-scaled — no swarms). Routing breadth + delegating phases to cheaper/disposable contexts IS the conservation mechanism that keeps ultracode affordable and the orchestrator lean: Fable's power + ultracode's orchestration, without paying Fable rates everywhere or fragmenting the spine.

**Constraints.**
- **Temporary / disposable.** Built for the ~2-week strong-model window; archived (not folded into RDPI) when it reverts to Opus. Keep it thin (~50 lines target).
- **Composition over new machinery — but inlined, not invoked.** Playbook skills cannot runtime-invoke other slash commands (`checkpoint/SKILL.md:180`; task 13 constraint at `todo.md:19`). So `/forge` **inlines** the Codex calls/logic of the trio, using those skills as the canonical reference spec — it does NOT literally call `/codex-research`, `/codex-audit`, `/codex-review`. Each trio skill stays independently runnable. Reuse the shared plumbing (safe tmp-compose, `codex -a never exec --sandbox read-only`, `codex-output-check.sh`, cleanup-before-present) — do not reinvent it.
- **Independence on verification, not input.** Do NOT force a Codex-led research sweep at the front. Model reads the bounded surface directly; Codex appears only on summon or at the two gates. (When this reverts to Opus, the "Codex leads research" calibration — [[feedback_codex_research]] — comes back, because the context-offload crutch is needed again.)
- **Bounded-surface rule.** Direct-read is correct only while the surface the piece must satisfy fits comfortably in context. A sprawling legacy surface → summon `/codex-research` to digest it (protect the model from the Dumb Zone), not because Codex is smarter.
- **Manual invocation** (`disable-model-invocation: true`) per [[feedback_skill_manual_invocation]] — side-effecting workflow skill.
- **Purely additive.** RDPI and every existing skill unchanged.

**Arguments.**
- `argument-hint: '[piece — source path or "description"]'` — the blueprint piece to build (e.g. a path to `contracts.md`).
- Defer the exact surface for gate selection + design-confirm toggle to RDPI (flags vs Claude judgment).

**Acceptance criteria.**
1. `.claude/skills/forge/SKILL.md` exists, manual-invoke, thin, with an explicit "temporary / strong-model-window / archive when reverted to Opus" note.
2. A single model-led pass collapses R/D/P/I-design+build; no axis/option matrix; source read fully up front.
3. The model can self-summon `/codex-research` during discovery; no fixed front-of-lane Codex sweep.
4. Optional design-confirm pause before code; default ON for load-bearing pieces.
5. Closing gates inline `/codex-audit` then `/codex-review` logic, each RUN/SKIP per piece; fixes applied via inline triage bucket logic (task 13).
6. Verify step runs tests / typecheck before presenting.
7. Reuses shared Codex plumbing; no duplicated/reinvented machinery beyond what the inline-not-invoke constraint forces.
8. RDPI + all existing skills unchanged. `/playbook-update`'s managed-file list accounts for the new skill (same check as task 13 AC8).
9. Wide pieces split at natural seams: complete one phase → compact → emit a continuation prompt for the next (reuses `/checkpoint` light-handoff + Multi-Batch Plans pattern; no new handoff format). Continuation prompt carries settled spine decisions + remaining phases, not raw file contents.
10. Workflow fan-out allowed; **every spawned agent pins its model explicitly (Sonnet/Opus, or Fable for a per-seam build sub-agent) — none inherit the main-loop model.** Invoking `/forge` is the Workflow opt-in.
11. Routing enforced as a hierarchy by orchestrator judgment (not a hard gate): Fable = orchestrator (owns spine design, never delegated) + optional single per-seam build sub-agent + keeps complex fixes; Opus = straightforward phases + bounded gate fixes; Sonnet = reads + trivial mechanical writes. Spine *design* stays in the orchestrator; per-phase *implementation* may delegate at the seam (never sub-split a phase).
12. Hard cap on concurrent + total sub-agents (budget-scaled, no swarms); sub-agents are leaf (no recursion, `CLAUDE.md:178`) — so build, gate-loop, and fixes are separate leaf dispatches coordinated by the orchestrator.
13. Gates may loop to convergence by best judgment — stop when a pass surfaces no new *critical* findings (residual nits OK), bounded by a max-passes safety cap.

**Relevant paths.**
- New skill: `.claude/skills/forge/SKILL.md`
- Reference specs to inline: `.claude/skills/codex-audit/SKILL.md` (task 19), `.claude/skills/codex-review/SKILL.md` (exists), `.claude/skills/codex-research/SKILL.md` (task 20), triage bucket logic (task 13)
- Shared plumbing: `.claude/scripts/codex-output-check.sh`, `codex-review/SKILL.md` (tmp-compose, cleanup-before-present)
- Phasing / handoff: `.claude/skills/checkpoint/SKILL.md` (light-handoff, tasks 17/18), `CLAUDE.md` Multi-Batch Plans rule
- Orchestration: the Workflow tool + its `model` per-agent override (Sonnet/Opus); `CLAUDE.md:178` recursion guard
- Target use case: `~/Projects/Omakase/omk-core/docs/fp-rebuild/README.md`, `omk-core/docs/blueprint/pieces/contracts.md`
- `/playbook-update` managed list: `.claude/skills/playbook-update/SKILL.md`

**Dependencies / unlock order.** Critical path **19 → 21** (the audit gate is the one genuinely new capability `/forge` needs, and it's a permanently-useful skill regardless of Fable); `/codex-review` already exists. Harden after: **13** (`/triage`) for clean apply, **20** (`/codex-research`) for summonable grounding — both improve `/forge` but neither blocks a usable first version (model reads directly; apply can be inline). Fastest self-contained fallback: build 21 alone, inlining its own audit/review Codex calls — accepts logic duplication that dies with the skill in 2 weeks. Phasing and Workflow routing add **no new task prerequisites** — `/checkpoint` already exists (tasks 17/18 only refine it) and the Workflow tool is built-in; both work against today's tree.

**Open questions for RDPI.**
- **Bounded-surface threshold.** Concrete heuristic for direct-read vs summon-`/codex-research` (e.g. fits under the ~30% context trigger?).
- **Design-confirm default.** ON for all load-bearing pieces, or developer-flagged per run? What classifies "load-bearing"?
- **Gate selection ergonomics.** How is RUN/SKIP per gate per piece expressed — flags, or Claude judgment from the piece's role?
- **Inline vs duplicate.** Given skills can't invoke each other, does `/forge` inline-reference the trio's prompts (DRY, needs 19/20 built first) or self-contain them (faster, duplicates)? Lean: inline-reference 19 (built first anyway), self-contain the rest if 20/13 lag.
- **Archive mechanism.** On revert to Opus — delete `/forge`, or move to a `.claude/skills/_archive/`? Does `/playbook-update` need to know it's transient?
- **Phase-seam heuristic.** What defines a "natural seam" for splitting (per contract group, per module, per N lines)? Is the phase plan operator-gated (like Multi-Batch) or auto-chosen, and does each seam force a compaction or only offer one?
- **Opus's boundary.** What makes a phase "straightforward" enough for an Opus build sub-agent vs. needing a Fable one — and the severity line for routing gate-fixes to Opus vs. applying mechanical A.1 fixes inline (cf. triage buckets, task 13).
- **Sub-agent cap.** Fixed N, or budget-scaled off `budget.total`? Per-phase or per-run? What's the ceiling that still feels "not a swarm"?
- **Ultracode ↔ conservation tension.** Ultracode defaults to "workflow for every substantive task, cost no constraint" — confirm the cheap-model routing policy actually holds under those defaults, so the window's conservation goal isn't silently undone.
- **Sequential vs parallel phases.** Default to sequential per-seam delegation (phase N+1 sees N's output → coherence), parallel only for genuinely independent phases (which then need `isolation: 'worktree'`). Confirm when parallelism is worth the worktree overhead vs. the coherence + lean-context win of sequential.
- **Gate-convergence judgment & cap.** How is "no new critical findings" judged across passes (diff the findings set? a severity threshold?), and what's the max-passes ceiling so the loop can't thrash? Is it one combined audit+review loop, or a separate convergence loop per gate?
- **Spine-contract handoff.** How does the orchestrator hand each build sub-agent the settled spine compactly (the contract it must conform to) without re-bloating context, and fold the result back without re-reading raw output?
