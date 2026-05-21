# Design: Task 5 — Enforce upfront specs for Research

## Context

Task 5 (`tasks/todo.md:36`) requires four mandatory fields — **intent, constraints, acceptance criteria, relevant paths** — to accompany any non-trivial task, propagated across four named surfaces:

- **(a)** `/research-codebase` — capture the fields in the `{TASK}` block passed to Codex. When any field is missing, **infer** it from the prompt and referenced docs, then present all four to the developer in one batched message (marking which were inferred vs. supplied) for approval or revision — do not present a blank ask.
- **(b)** the `CLAUDE.md` Pre-Edit Gate — require the same four fields before a non-trivial task enters Research.
- **(c)** `templates/new-issues.md` — add two **optional** sections, `### Constraints` and `### Relevant paths`, to the single shared issue format (intent → `### Description` and acceptance criteria → `### Acceptance Criteria` already exist). Optional, not mandatory: an issue can sit on the board for weeks, so a path captured at logging time may go stale — and on the board these feed `{SEARCH_HINTS}`, which `research-guide.md:9` treats as non-scoping hints anyway, so a blank or stale entry is harmless. `/issue-research` is updated to passively consume the two sections when present.
- **(d)** `.claude/prompts/research-guide.md` §2 "Current Behavior" — strengthen data-flow tracing.

Research surfaced two propagation surfaces Task 5 does not name but that break if ignored: `templates/playbook-sections.md:60-71` carries a duplicate Pre-Edit Gate that `/playbook-setup` and `/playbook-update` install, and `/issue-research` consumes issue sections — so growing the issue template without teaching `/issue-research` to read the new sections makes them decorative. These are the central scope decisions.

**Research:** `tasks/research-codebase.md`

## Options Considered

### Option A — Literal scope (minimal)

Touch only the four surfaces Task 5 names, plus the one mandatory mirror (`playbook-sections.md`).

| Axis | Choice |
|---|---|
| 1 — gate location | A: new Step 2.5, after §2 file reads, before §3 Codex composition |
| 2 — field → placeholder mapping | A: `{TASK}` carries intent + constraints + acceptance criteria; `{SEARCH_HINTS}` "Key files to start from" carries relevant paths |
| 3 — what counts as "missing" | C: hybrid — accept explicit labels or obvious equivalents, ask once when ambiguous; explicit "none" satisfies a field |
| 4 — gate propagation | B: `CLAUDE.md` + `templates/playbook-sections.md` |
| 5 — issue-flow consumption | A: update `templates/new-issues.md` + live copies in `tasks/new-issues.md` / `tasks/issues.md` only |
| 6 — `research-guide.md` §2 | A: strengthen §2 into a tracing checklist only |
| 7 — `/create-todo` | A: unchanged |

**How it works:** `/research-codebase` gains a Step 2.5 missing-field check; the four fields flow into the existing `{TASK}`/`{SEARCH_HINTS}` placeholders as prose. Both gate copies get an identical four-field requirement. The issue template grows two sections. `research-guide.md` §2 becomes a checklist.

**Good:** Smallest blast radius; matches the literal wording of Task 5; every edit is to a surface the task explicitly names (plus the unavoidable `playbook-sections.md` mirror — Axis 4=A is ruled out by the gate-drift risk). Fully reversible.

**Not good:** Hits the **decorative-fields risk** head-on (`research-codebase.md:156`). `/issue-research` reads only `### Description` / `### Acceptance Criteria` / `### Notes` (`issue-research.md:20`) — adding `### Constraints` / `### Relevant paths` to the template without teaching `/issue-research` to read them means the new issue fields are logged and then ignored. Strictly satisfies Task 5(c) on paper while defeating its intent.

### Option B — Functional scope (recommended)

Option A plus the one extra surface that makes the issue fields actually consumed, and a hardened field-carrier in `{TASK}`.

| Axis | Choice |
|---|---|
| 1 — gate location | A: new Step 2.5 |
| 2 — field → placeholder mapping | C: dedicated labeled "Upfront spec" sub-block inside `{TASK}` holding all four fields verbatim; when relevant paths are concrete, they also seed `{SEARCH_HINTS}` "Key files to start from" |
| 3 — what counts as "missing" | C: hybrid |
| 4 — gate propagation | B: `CLAUDE.md` + `templates/playbook-sections.md` |
| 5 — issue-flow consumption | B (refined): add `### Constraints` / `### Relevant paths` as **optional** sections to `templates/new-issues.md`; update `/issue-research` to passively read them **when present** — constraints into `{TASK}`, paths into `{SEARCH_HINTS}` |
| 6 — `research-guide.md` §2 | A: strengthen §2 into a tracing checklist only |
| 7 — `/create-todo` | A: unchanged |

**How it works:** Same as A, except (1) the four fields land in `{TASK}` as an explicitly labeled "Upfront spec" sub-block, so the research artifact's `## Research Question` echoes them as a recognizable block — hardening downstream propagation to `/design` and `/create-plan` without any artifact-schema change (resolves OQ#2). When relevant paths are concrete files/globs/docs, they additionally seed `{SEARCH_HINTS}` "Key files to start from" so they accelerate discovery — kept non-scoping per `research-guide.md:9`. (2) `templates/new-issues.md` — the single shared issue-format template — gains two **optional** sections, `### Constraints` and `### Relevant paths` (intent and acceptance criteria already have homes in `### Description` / `### Acceptance Criteria`). `/issue-research` is taught to passively read the two new sections **when present**, routing constraints into `{TASK}` and relevant paths into `{SEARCH_HINTS}`, so the fields are consumed, not decorative. The sections are optional, not mandatory: an issue can sit on the board long enough for a logged path to go stale, and as `{SEARCH_HINTS}` they are non-scoping hints (`research-guide.md:9`), so a blank or stale entry is harmless. `/issue-research` never flags a missing section and never asks interactively — it runs non-interactively under `/auto-issues` (`auto-issues.md:53`). No separate board template and no inbox→board enforcement command — promotion stays manual.

**Step 2.5 — infer-then-confirm flow:** When any of the four fields is absent from `$ARGUMENTS` and the §2 referenced-doc reads, Step 2.5 does **not** present a blank ask. Claude first *infers* the missing field(s) to the best of its ability from the prompt and the files it just read, then presents all four fields to the developer in a single batched message — each labeled *supplied* or *inferred (not provided)* — and asks the developer to approve or revise. Only the developer's confirmed/revised values are written into the `{TASK}` "Upfront spec" block. Where Claude genuinely has no signal for a field, it says so explicitly rather than guessing (and for bug fixes, an inferred `unknown — discover during diagnosis` is a legitimate value for `constraints` / `relevant paths`). This keeps the interaction to one batched exchange while sparing the developer from authoring fields from scratch.

**Bug-fix-mode wording:** The Pre-Edit Gate edit (Axis 4) must be worded so a bug fix can satisfy `constraints` / `relevant paths` with an explicit `unknown — discover during diagnosis`, while still requiring `intent` and `acceptance criteria`. A blunt "require all four" rule collides with the gate's existing "diagnose autonomously, don't ask the user for root cause" clause (`CLAUDE.md` Bug fix mode paragraph). This wording requirement applies to all three options, since all edit the gate.

**Coupling honored:** Axis 5=B is constrained to **read-only** consumption — no interactive "ask when missing" in `/issue-research`, because `/auto-issues` Phase 1 runs it non-interactively (`auto-issues.md:53`). The interactive ask stays singleton-only (`/research-codebase`).

**Good:** Eliminates the decorative-fields risk — the minimum that makes Task 5(c) meaningful (OQ#1 recommends exactly this). The labeled sub-block resolves OQ#2 without touching artifact schemas. Still small: one surface beyond A, all reversible.

**Not good:** Adds `/issue-research` — a surface Task 5 does not name (mitigated: it is a strictly passive read, flagged for developer confirmation). Slightly more wording in the `{TASK}` composition.

### Option C — Full propagation (maximal)

Option B plus every downstream and human-facing surface wired end-to-end.

| Axis | Choice |
|---|---|
| 1 — gate location | A: new Step 2.5 |
| 2 — field → placeholder mapping | C: labeled "Upfront spec" sub-block |
| 3 — what counts as "missing" | C: hybrid |
| 4 — gate propagation | C: `CLAUDE.md` + `playbook-sections.md` + `quickref.md` |
| 5 — issue-flow consumption | C: B plus backfilling blank `### Constraints` / `### Relevant paths` into existing draft issues (e.g. `tasks/new-issues.md` Issue #3) |
| 6 — `research-guide.md` §2 | C: strengthen §2 **plus** add a "Data Flow" section to artifact schemas (`research-codebase.md` §5, `issue-research.md` §5) **plus** update `/design` and `/create-plan` to consume it |
| 7 — `/create-todo` | C: lighter reminder in the `tasks/todo.md` output |

**How it works:** Everything in B, extended: `quickref.md`'s human cheat-sheet is reworded to match the new gate; existing draft issues are backfilled; data-flow findings get a first-class artifact section and explicit downstream consumers; `/create-todo` emits a four-field reminder.

**Good:** No surface left contradicting the new gate; data-flow output is consumed end-to-end (closes the "Axis 6 B without C" under-consumption gap).

**Not good:** Largest blast radius — touches `/design`, `/create-plan`, `/create-todo`, artifact schemas, and a human-only file, none named by Task 5. Axis 6=C is a clear scope expansion (OQ#3). Axis 7=C fights `create-todo.md:28-33`'s deliberate rule against file paths in task descriptions (`research-codebase.md:161`). More edits, more reversibility cost, more review surface.

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)

_None._ Scope questions OQ#1–#3 are resolved by the chosen option and Codex's cross-check (folded into the options above).

### Non-blocking (can resolve during implementation)

- [ ] **OQ#4 — `quickref.md` update?** Out of the chosen scope (Option C only). `quickref.md:88-98` and `:179-184` still use the older "input/output/success criteria" framing and will visibly contradict the new four-field gate. Codex confirmed this is a real but deferrable contradiction — `quickref.md` is human-facing only and not loaded by Claude. Recommend a follow-up issue rather than expanding Task 5's scope.
- [ ] **OQ#5 — live `tasks/` issue files vs. template consistency.** The two new optional sections land in `templates/new-issues.md`. The live `tasks/new-issues.md` and `tasks/issues.md` carry their own copies of the issue-format block; research notes the convention is to keep them byte-consistent with the template (`research-codebase.md:51`). Implementation detail for `/create-plan`: update both live format blocks to match the template (recommended — the sections are optional, so the inbox is not burdened), and decide whether to backfill the live Issue #3. Non-blocking — it does not change the approach.

## What We're NOT Doing

- No interactive "ask when missing" in `/issue-research` — it would hang `/auto-issues` non-interactive Phase 1.
- No mandatory four-field requirement on the issue board — `### Constraints` / `### Relevant paths` are **optional** sections. Mandatory enforcement is singleton-only: `/research-codebase` Step 2.5 + the Pre-Edit Gate.
- No separate board template (`templates/issues.md`) and no inbox→board promotion or enforcement command — promotion stays manual; `templates/new-issues.md` remains the single shared issue-format template.
- No length cap or rough-format rewrite of the inbox — `tasks/new-issues.md` keeps its current structure; the only change reaching it is the two new optional sections inherited from the shared template.
- No command-to-skill port — original `.claude/commands/*.md` files stay in place.
- No new third channel for the four fields — they ride the existing `{TASK}` / `{SEARCH_HINTS}` placeholder contract.
- No supplying data flow as upfront intake — data flow is discovered research output (surface d), never a "Relevant paths" value.

## Decision

**Chosen approach:** Option B — Functional scope.

**Rationale:** Option B wins on all three decision heuristics. It is the smallest scope that satisfies the *intent* of Task 5 rather than just its letter: Option A strictly satisfies Task 5(c) by growing the issue template but, because `/issue-research` reads only `### Description` / `### Acceptance Criteria` / `### Notes` (`issue-research.md:20`), the new `Constraints` / `Relevant paths` sections are logged and never consumed — decorative fields, the dominant risk in research (`research-codebase.md:156`). Option B adds exactly one surface beyond A — a strictly *passive read* in `/issue-research` — to close that gap, and keeps the interactive ask singleton-only so `/auto-issues`' non-interactive Phase 1 is unaffected. Option C expands into `/design`, `/create-plan`, `/create-todo`, artifact schemas, and `quickref.md` — none named by Task 5, and Axis 7=C directly fights `create-todo.md`'s deliberate no-file-paths rule — so it loses on simplicity and reversibility for no gain the task requires.

Axis 2=C (a labeled "Upfront spec" sub-block in `{TASK}`) carries all four fields into the existing placeholder contract and makes the research artifact's `## Research Question` echo them as a recognizable block — resolving OQ#2 without any artifact-schema change. Every edit is reversible and confined to slash-command specs / prompt templates.

**Per-surface enforcement is intentionally asymmetric** (developer-directed refinement during design): the four fields are *mandatory* on the singleton/gate path — `/research-codebase` Step 2.5 enforces them via infer-then-confirm, and the Pre-Edit Gate requires them — but on the *issue board* the two new sections (`### Constraints` / `### Relevant paths`) are **optional**. Rationale: issues can sit on the board for weeks, so a logged path may go stale before research runs; and on the board these feed `{SEARCH_HINTS}`, which is non-scoping by definition (`research-guide.md:9`), so a blank or stale entry causes no harm. `/issue-research` still consumes the sections when present — that read is what keeps them from being decorative — but never enforces or prompts.

Codex's independent design converged on the identical axis combination (`1=A, 2=C, 3=C, 4=B, 5=B, 6=A, 7=A`) — it did not shift the decision, but it reinforced it and contributed two implementation refinements now folded into Option B: (1) concrete relevant paths additionally seed `{SEARCH_HINTS}` "Key files to start from" (non-scoping per `research-guide.md:9`), and (2) the Pre-Edit Gate must let bug fixes satisfy `constraints` / `relevant paths` with `unknown — discover during diagnosis` while still requiring `intent` and `acceptance criteria`.
