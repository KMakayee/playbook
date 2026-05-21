# Plan: Task 5 — Enforce upfront specs for Research

## Design decision reference

Chosen approach: **Option B — Functional scope** (`tasks/design-decision.md:114`). Propagate four mandatory fields — **intent, constraints, acceptance criteria, relevant paths** — across the four surfaces Task 5 names, plus the two unnamed propagation surfaces research surfaced that break if ignored (`templates/playbook-sections.md` gate mirror, `/issue-research` consumption).

Artifacts: `tasks/research-codebase.md`, `tasks/design-decision.md`. (No `tasks/research-patterns.md` — `/design` skipped pattern research; no novel external patterns.)

## Execution model

**This is a single `/implement` cycle, NOT a multi-batch plan.** Task 5 is one coherent change; the four phases below mostly touch different files and are commit boundaries within one run, not separate prompts. Each phase ends with a conventional-commit checkpoint. **Phase order is not free: Phase 1 must precede Phase 2**, because the Phase 2 gate paragraph references `/research-codebase` Step 2.5, which Phase 1 creates. Phases 3 and 4 have no ordering dependency and follow for traceability against Task 5's named order (a, b, c, d).

Verification is grep + read-through only — these are Markdown contracts with no test infrastructure (`tasks/research-codebase.md:94`).

## Scope boundaries (what we are NOT doing)

- No interactive "ask when missing" in `/issue-research` — it runs non-interactively under `/auto-issues` Phase 1 (`auto-issues.md:53`). Consumption there is strictly passive.
- No mandatory four-field requirement on the issue board — `### Constraints` / `### Relevant paths` are **optional** sections. Enforcement is singleton-only (`/research-codebase` Step 2.5 + Pre-Edit Gate).
- No backfill of existing draft issues (e.g. `tasks/new-issues.md` Issue #3) — the new sections are optional, so absence is valid. (Backfill was Option C only.)
- No separate board template, no inbox→board promotion command — `templates/new-issues.md` stays the single shared issue-format template.
- No `quickref.md` edit, no `/design` / `/create-plan` / `/create-todo` edits, no artifact-schema "Data Flow" section — all Option C, out of scope. `quickref.md` contradiction is deferred to a follow-up issue (OQ#4).
- No new third channel for the four fields — they ride the existing `{TASK}` / `{SEARCH_HINTS}` placeholder contract.
- The `/issue-research` change does NOT emit a labeled "Upfront spec" sub-block — that block is surface (a) only. `/issue-research` routes constraints into its existing `{TASK}` composition and paths into `{SEARCH_HINTS}` (design Axis 5=B).

---

## Phase 1 — Surface (a): `/research-codebase` four-field intake

**File:** `.claude/commands/research-codebase.md`

### 1a. Insert a new "Step 2.5" between Step 2 (`:21-24`) and Step 3 (`:26`)

Add `### 2.5. Capture the four-field upfront spec` — an infer-then-confirm gate:

- **Fields:** the four mandatory fields are **intent, constraints, acceptance criteria, relevant paths**.
- **What counts as supplied (Axis 3=C, hybrid):** a field is satisfied if it appears under an explicit label OR as an obvious prose/doc equivalent in `$ARGUMENTS` or the §2 referenced-doc reads. An explicit "none" / "no constraints" counts as satisfied — do not loop on legitimately-empty fields.
- **Infer-then-confirm:** for any field not clearly supplied, Claude *infers* it from the prompt + §2 files. Where there is genuinely no signal, Claude says so explicitly rather than guessing. For bug fixes, `unknown — discover during diagnosis` is a legitimate inferred value for `constraints` / `relevant paths`.
- **One batched message:** present all four fields to the developer in a single message, each labeled *supplied* or *inferred (not provided)*; ask the developer to approve or revise. Ask once, batched — never field-by-field.
- **No-prompt path:** if all four fields are clearly supplied (explicit labels or obvious equivalents in `$ARGUMENTS` / §2 docs), skip the confirmation message and proceed straight to Step 3. The batched confirm fires only when at least one field is missing or had to be inferred (design `tasks/design-decision.md:7` — "when any of the four fields is missing").
- **Ordering:** Step 2.5 must run *after* §2 file reads (docs can satisfy fields) and *before* any §3 side effect (temp-file write, Codex run). State explicitly that Step 2.5 is a **separate check** from the top-of-file Readiness preflight (`:7`) — they cannot merge because Step 2.5 must run after §2 (`tasks/research-codebase.md:162`).
- Only the developer's confirmed/revised values are carried into Step 3.

### 1b. Amend Step 3 §2 `{TASK}` composition (`:30-33`)

Add a bullet instructing the composer to include a labeled **"Upfront spec"** sub-block inside `{TASK}` holding the four confirmed fields verbatim (intent / constraints / acceptance criteria / relevant paths). This makes the research artifact's `## Research Question` echo the four fields as a recognizable block (`research-guide.md:5` substitutes `{TASK}`; `research-codebase.md:100` carries it into the artifact) — resolves OQ#2 with no artifact-schema change.

### 1c. Amend Step 3 §3 `{SEARCH_HINTS}` "Key files to start from" (`:34-36`)

Add a note: when the Upfront spec's `relevant paths` are concrete files/globs/docs, additionally seed them into "Key files to start from" as discovery accelerators — kept non-scoping per `research-guide.md:9`.

**Success criteria:**
- `grep -n "2.5" .claude/commands/research-codebase.md` shows the new step header between Step 2 and Step 3.
- `grep -n "Upfront spec" .claude/commands/research-codebase.md` shows it in both Step 2.5 and Step 3 §2.
- Four separate greps against `.claude/commands/research-codebase.md` — `grep -ni "intent"`, `grep -ni "constraints"`, `grep -ni "acceptance criteria"`, `grep -ni "relevant paths"` — each returns a hit (a single OR grep would pass on one term alone and is insufficient).
- Read-through: Step 2.5 sits after §2 file reads, before §3; mentions infer-then-confirm, one batched message, the no-prompt path when all four are supplied, hybrid "missing", explicit-"none"-satisfies, and the separate-from-preflight note.

---

## Phase 2 — Surface (b): Pre-Edit Gate four-field requirement

**Files:** `CLAUDE.md` (live rule), `templates/playbook-sections.md` (install/update source — `:60-71`).

Both copies of the Pre-Edit Gate must gain an **identical** four-field paragraph. `/playbook-setup` appends `playbook-sections.md` verbatim to new installs (`playbook-setup.md:21-26`) and `/playbook-update` re-syncs the managed bottom half (`playbook-update.md:114-135`); editing only `CLAUDE.md` regresses every new/updated install (`tasks/research-codebase.md:157`).

### 2a. `CLAUDE.md` Pre-Edit Gate

Add a four-field paragraph after the "If uncertain..." line and before "**Bug fix mode:**". Content (this exact prose is the byte-identical text for 2b):

> **Four-field intake (non-trivial tasks).** Before a non-trivial task enters Research it must carry four fields: **intent, constraints, acceptance criteria, relevant paths**. In the singleton flow, `/research-codebase` Step 2.5 captures and confirms them. In the issue workflow, intake is satisfied by the issue board: `### Description` (intent) and `### Acceptance Criteria` are mandatory, while `### Constraints` and `### Relevant paths` are optional — a missing optional section does not block `/issue-implement` or `/auto-issues`. For a bug fix, `intent` (the reported symptom) and `acceptance criteria` (expected correct behavior) are always required; `constraints` and `relevant paths` may be `unknown — discover during diagnosis`.

Two reconciliations are deliberate: (1) the issue-flow sentence keeps the gate from over-enforcing — the design makes the two new issue sections **optional** (`tasks/design-decision.md:9,120`), and a blanket "require four fields" rule would otherwise block non-interactive `/auto-issues` / `/issue-implement` runs (Codex review CORRECTION). (2) the bug-fix sentence reconciles with the existing "Bug fix mode" clause ("diagnose autonomously, don't ask the user for root cause") — a bug fix is never blocked for missing constraints/paths (`tasks/research-codebase.md:158`, `tasks/design-decision.md:56`).

### 2b. `templates/playbook-sections.md` Pre-Edit Gate (`:60-71`)

Insert the **byte-identical** paragraph from 2a, in the same position — after the "If uncertain..." line (`:69`), before "**Bug fix mode:**" (`:71`). The TRIVIAL/NON-TRIVIAL classifier differs in form (code block in `CLAUDE.md`, table in `playbook-sections.md`) but the prose paragraphs are kept byte-consistent by convention (`tasks/research-codebase.md:93`); the new paragraph must match exactly.

**Success criteria:**
- `grep -nE "Four-field intake" CLAUDE.md templates/playbook-sections.md` shows the paragraph in both files.
- Extract the new paragraph from each file and `diff` them — must be byte-identical.
- `grep -n "unknown — discover during diagnosis" CLAUDE.md templates/playbook-sections.md` confirms the bug-fix escape hatch in both.
- Read-through: paragraph sits between "If uncertain" and "Bug fix mode" in both files.

---

## Phase 3 — Surface (c): issue template + live copies + `/issue-research` consumption

### 3a. `templates/new-issues.md` issue-format block (`:13-36`)

Add two **optional** sections to the fenced format block, placed after `### Acceptance Criteria` (`:24-27`) and before `### Notes` (`:29`):

```
### Constraints

[Optional. Scope boundaries, locked decisions, behavior the implementation must not break. Omit if none.]

### Relevant paths

[Optional. Files, globs, or docs likely relevant — discovery accelerators, not scope. May go stale on the board; omit if unsure.]
```

Intent already maps to `### Description` and acceptance criteria to `### Acceptance Criteria` — only constraints and relevant paths are new.

### 3b. `tasks/new-issues.md` live format block (`:13-36`)

Add the same two sections, identically, to the live copy of the format block. Do **not** modify Issue #3 (`:44-71`) — the sections are optional.

### 3c. `tasks/issues.md` live format block (`:13-36`)

Add the same two sections, identically, to this live copy.

### 3d. `.claude/commands/issue-research.md` — passive consumption

Three edits, all strictly read-only (no flagging a missing section, no interactive ask — the command runs non-interactively under `/auto-issues`):

- **Step 2 (`:20`)** — extend the read list: "Read the issue's `### Description`, `### Acceptance Criteria`, and `### Notes` sections" → also read `### Constraints` and `### Relevant paths` **when present**.
- **Step 3 §2 `{TASK}` composition (`:29-33`)** — add a bullet: include the `### Constraints` content in the `{TASK}` block when present.
- **Step 3 §3 `{SEARCH_HINTS}` "Key files to start from" (`:35`)** — add: also seed from the `### Relevant paths` section when present.

**Success criteria:**
- `grep -rn "### Constraints" templates/new-issues.md tasks/new-issues.md tasks/issues.md` shows it in all three.
- `grep -rn "### Relevant paths" templates/new-issues.md tasks/new-issues.md tasks/issues.md` shows it in all three.
- Diff the format block across the three files — the two new sections must be identical text.
- `grep -n "Constraints" .claude/commands/issue-research.md` and `grep -n "Relevant paths" .claude/commands/issue-research.md` (run separately) each show the new reads in Step 2 and the routing in Step 3.
- `grep -niE "when present" .claude/commands/issue-research.md` confirms the passive/optional wording.
- Read-through: no interactive ask or missing-section flag was added to `/issue-research`.

---

## Phase 4 — Surface (d): `research-guide.md` §2 data-flow checklist

**File:** `.claude/prompts/research-guide.md` §2 "Current Behavior" (`:24-30`)

Strengthen the single "Data flow (what gets passed where?)" bullet (`:27`) into an explicit tracing checklist. Keep the surrounding bullets (entry points, side effects, edge cases) intact. Replace the lone data-flow line with a sub-checklist covering: payloads/arguments entering each entry point, call handoffs between components (call boundaries, return values), state writes / artifacts produced along the way, and failure paths (where the flow errors or short-circuits and what happens to in-flight data).

`research-guide.md` is the shared template — both `/research-codebase` and `/issue-research` read it (`research-codebase.md:29`, `issue-research.md:28`) and substitute `{TASK}` / `{SEARCH_HINTS}` into it (`research-codebase.md:39`, `issue-research.md:39`), so this single edit reaches both flows (`tasks/research-codebase.md:58`). No per-flow edit needed.

**Success criteria:**
- Read §2 of `.claude/prompts/research-guide.md`: the data-flow bullet is now a multi-item checklist (payloads, handoffs, state writes/artifacts, failure paths).
- The other three bullets (entry points, side effects, edge cases) are unchanged.
- Investigation sections 1, 3–7 are untouched.

---

## Judgment Calls

1. **Single `/implement` cycle, not multi-batch.** Task 5 is one coherent change with small Markdown edits across independent files. Multi-batch is reserved for genuinely separable units of work (e.g. code-review fix batches). Phases are commit boundaries within one run. Alternative — split into 4 prompts — adds ceremony for no benefit at this size.
2. **Phase order = Task-5-named order (a, b, c, d), with Phase 1 before Phase 2 as a hard dependency.** The Phase 2 gate paragraph names `/research-codebase` Step 2.5, which Phase 1 creates — so Phase 1 must land first. Phases 3 and 4 have no ordering dependency on the others (Phase 4 edits the shared template that Phases 1/3 reference, but the `{TASK}`/`{SEARCH_HINTS}` composition changes are orthogonal to §2's content); their order is cosmetic and follows the task text.
3. **Issue #3 not backfilled.** The new sections are optional, so its absence is valid. Backfill was an Option C item the chosen Option B excludes (`tasks/design-decision.md:74`).
4. **`/issue-research` does not emit a labeled "Upfront spec" sub-block.** The labeled block is surface (a) only. The issue flow routes constraints into its existing `{TASK}` composition and paths into `{SEARCH_HINTS}` — design Axis 5=B verbatim. Adding the labeled block to `/issue-research` would be scope the design did not choose.
5. **New issue sections placed after `### Acceptance Criteria`, before `### Notes`.** Keeps the four upfront-spec-relevant sections (Description, Acceptance Criteria, Constraints, Relevant paths) grouped ahead of the workflow-accumulator sections (Notes, Impacts).
6. **`Step 2.5` numbering rather than renumbering Steps 3–8.** Inserting "Step 2.5" avoids cascading renumbers across the rest of `research-codebase.md` and its internal cross-references. Lower blast radius than a full renumber.

## Risks folded into the plan

- **Gate drift** — addressed by Phase 2 editing both gate copies with a byte-identical paragraph; success criteria include a `diff` check.
- **Decorative issue fields** — addressed by Phase 3d teaching `/issue-research` to consume the new sections; without 3d, 3a–3c would be decorative (`tasks/research-codebase.md:156`).
- **Bug-fix-mode collision** — addressed by the explicit `unknown — discover during diagnosis` escape hatch in the Phase 2 wording.
- **Interactive ask leaking into the issue flow** — Phase 3d is constrained to passive reads; success criteria explicitly verify no ask/flag was added.
- **Preflight vs. Step 2.5 confusion** — Phase 1a explicitly states Step 2.5 is a separate check from the Readiness preflight.

## Artifact references

- Research: `tasks/research-codebase.md`
- Design: `tasks/design-decision.md`
