# Research: Task 5 — Enforce upfront specs for Research

## Research Question

Task 5 (`tasks/todo.md:36`) — Define four mandatory fields that must accompany any non-trivial task (**intent, constraints, acceptance criteria, relevant paths**) and propagate them across four surfaces:

- **(a)** `/research-codebase` — capture acceptance criteria alongside intent in the `{TASK}` block passed to Codex; ask the user once when any of the four fields is missing rather than invoking Codex with thin hints.
- **(b)** the `CLAUDE.md` Pre-Edit Gate — require the same four fields before a non-trivial task enters Research, as a safety net for prompts that bypass the command.
- **(c)** `templates/new-issues.md` — grow explicit `Constraints` and `Relevant paths` sections alongside the existing `Acceptance Criteria`.
- **(d)** `.claude/prompts/research-guide.md` §2 "Current Behavior" — emphasize data-flow tracing (entry points, what gets passed where, side effects) so the research artifact surfaces how data moves through the touched area.

(a)-(c) are the four-field **intake** layer (supplied upfront by the engineer). (d) is the research-**output** layer (data flow is discovered by the Codex sweep). A known-critical data flow belongs in the Constraints field (intake), not Relevant paths.

## Summary

This is a Markdown-only "codebase" — the playbook is a set of slash-command specs, shared Codex prompt templates, and project rules. Task 5 names four surfaces, but the research surfaced **two propagation surfaces the spec does not name** that break if ignored:

1. **`templates/playbook-sections.md:60-71` carries a second copy of the Pre-Edit Gate.** `/playbook-setup` appends this fragment verbatim into a new project's `CLAUDE.md` (`playbook-setup.md:25`), and `/playbook-update` treats the bottom half of `CLAUDE.md` as managed. Editing only `CLAUDE.md` (surface b) silently leaves every *new* install on the old two-line gate. Updating `playbook-sections.md` in lockstep is effectively mandatory, not optional.
2. **Surface (c) as written makes the new issue fields decorative.** `/issue-research` already reads `### Description` / `### Acceptance Criteria` / `### Notes` and folds acceptance criteria into `{TASK}` — but it has no instruction to read a `### Constraints` or `### Relevant paths` section. Growing the template without teaching `/issue-research` to consume the new sections means they are logged and then ignored. The catch: `/auto-issues` Phase 1 runs `/issue-research` **non-interactively** (`auto-issues.md:53`, "do not ask questions"), so the issue flow can *read* the new fields but must never gain the interactive "ask when missing" behavior that surface (a) adds to `/research-codebase`.

The intake mechanics are clean: the four fields map naturally onto the existing `{TASK}` / `{SEARCH_HINTS}` placeholder contract. `relevant paths` is already what `{SEARCH_HINTS}` → "Key files to start from" expresses; `intent` + `acceptance criteria` + `constraints` belong in `{TASK}` (constraints are scope-bearing, and `research-guide.md:9` explicitly says `{SEARCH_HINTS}` are *not* scope constraints). No external research is required — every decision is evaluable from the repo.

The surfaces are largely independent and could land as one change or be split; the only hard ordering constraint inside the task is that surface (b)'s gate edit and the `playbook-sections.md` mirror edit must be identical.

## Detailed Findings

### Surface (a) — `/research-codebase` intake (`.claude/commands/research-codebase.md`)

Current flow: the command rejects only a blank `$ARGUMENTS` (`:5`), runs a "Readiness preflight" scanning `tasks/todo.md` for unresolved OQs/blockers (`:7`), checks for prior artifacts (`:17-19`), reads any directly mentioned files (§2, `:21-24`), then composes Codex input (§3, `:26-54`).

- The `{TASK}` block is composed at `:30-33`: "goal and why it matters", "referenced docs", and an explicit "Do NOT decompose the task into sub-steps or list implementation approaches." It does **not** mention acceptance criteria or constraints.
- The `{SEARCH_HINTS}` block is composed at `:34-38` with three sub-sections: "Key files to start from", "Known interfaces/APIs involved", "Fixed params/constraints from prior work".
- There is **no missing-field check anywhere** — a one-line prompt sails straight to Codex.
- Side effects begin at §3 (writes `tasks/codex-prompt.tmp`, runs Codex, writes `tasks/codex-research.tmp`). A missing-field ask must fire *before* these.
- The research artifact schema (§5, `:96-152`) has `## Research Question` = `[Task description from $ARGUMENTS]` — this section is the carrier that propagates the `{TASK}` content into the artifact. If `{TASK}` carries the four fields, `## Research Question` echoes them; no schema change is strictly required, though an explicit labeled sub-block would harden propagation.

`CORRECTION` (Codex): in the singleton flow `{TASK}` has no guaranteed acceptance criteria — confirmed at `:30-33`.

### Surface (b) — `CLAUDE.md` Pre-Edit Gate (+ the unnamed mirror)

The Pre-Edit Gate in this repo's `CLAUDE.md` is a code-block "TRIVIAL / NON-TRIVIAL" classifier. It blocks `Edit`/`Write` on source files until the task is trivial or RDPI artifacts exist. It does **not** require the four fields.

- **The gate is duplicated.** `templates/playbook-sections.md:60-71` holds the same gate (rendered as a Markdown table instead of a code block — same content: same TRIVIAL/NON-TRIVIAL criteria, same "If uncertain", same "Bug fix mode" paragraph).
- `/playbook-setup` Step 0B appends `templates/playbook-sections.md` *verbatim* to an existing project's `CLAUDE.md` (`playbook-setup.md:21-26`). `/playbook-update` (`:114-135`) re-syncs the managed bottom half. **Any four-field requirement added to `CLAUDE.md`'s gate must be added identically to `playbook-sections.md` or new/updated installs regress to the old gate.**
- **Bug-fix-mode interaction.** The gate's "Bug fix mode" paragraph says "diagnose it autonomously. Do not ask the user to identify the root cause." A blunt "require all four fields" rule collides with this: a bug report often arrives without explicit constraints or relevant paths. The gate wording must reconcile — for a bug fix, intent = the reported symptom, acceptance criteria = expected correct behavior, and constraints/paths may legitimately be "unknown — discover during diagnosis." This is a real wording hazard, not a hypothetical.

### Surface (c) — issue format template (`templates/new-issues.md`)

The canonical issue format is the fenced block at `templates/new-issues.md:13-36`: `**Status/Priority/Created**`, `### Description`, `### Acceptance Criteria`, `### Notes`, `### Impacts`. It has `Acceptance Criteria` but no `Constraints` or `Relevant paths`.

- The **same format block is copied** into `tasks/new-issues.md:9-36` (working triage inbox) and `tasks/issues.md:9-36` (tracked board). The header/comment of both files is identical to the template — `templates/new-issues.md` *is* the issue board header. Editing the template alone leaves the two live copies stale.
- `tasks/new-issues.md` has a live draft, Issue #3 (`:44-71`), already using the old four-section shape.
- `/issue-research.md:20` reads `### Description`, `### Acceptance Criteria`, `### Notes` — there is **no read of `### Constraints` or `### Relevant paths`**, because they do not exist yet. Adding them to the template without updating `/issue-research` makes them decorative (see Risk Analysis).
- Downstream the issue flow already treats acceptance criteria as factual: `/issue-plan` checks acceptance-criteria coverage (`issue-plan.md:88-89`), `/issue-implement` verifies them (`issue-implement.md:104-105`).

### Surface (d) — `research-guide.md` §2 data-flow emphasis

`.claude/prompts/research-guide.md` is the **shared** Codex prompt template — both `/research-codebase` (`:29`) and `/issue-research` (`:28`) fill its `{TASK}`/`{SEARCH_HINTS}` placeholders. A change to §2 therefore lands in both flows automatically; no separate issue-flow edit is needed for (d).

§2 "Current Behavior" today (`:24-29`) lists four bullets: entry points, data flow ("what gets passed where?"), side effects, edge cases/error handling. The data-flow line exists but is light — one phrase. Task 5 (d) wants it strengthened into an explicit tracing checklist so the artifact reliably surfaces how data moves (payloads/arguments, call handoffs, state writes, artifacts produced, failure paths) — enough that downstream `/design` and `/create-plan` don't mis-wire components.

### Downstream propagation (why intake matters)

- `/design` §2.1 (`design.md:22-28`) extracts the research artifact's **axes, coupling, cross-cutting constraints, external research** — it does *not* extract "intent" or "acceptance criteria" as named fields.
- `/create-plan` §2.1 (`create-plan.md:23-28`) derives "Acceptance criteria *implied by the design*" — acceptance criteria reach the plan only by double inference (research → design → plan), never as a carried first-class field.
- Putting acceptance criteria into `{TASK}` (surface a) makes them explicit in the research artifact's `## Research Question`. Whether they then reliably reach the plan depends on the artifact carrying them visibly (see Axis 2 / Axis 6 sub-decisions). This is the core motivation: thin intake → design and plan invent intent and criteria.

## Code References

- `.claude/commands/research-codebase.md:5-7` — blank-arg reject + readiness preflight
- `.claude/commands/research-codebase.md:21-24` — §2 read directly mentioned files
- `.claude/commands/research-codebase.md:30-33` — compose `{TASK}` (no acceptance criteria today)
- `.claude/commands/research-codebase.md:34-38` — compose `{SEARCH_HINTS}` (3 sub-sections)
- `.claude/commands/research-codebase.md:96-152` — research artifact schema (`## Research Question`)
- `CLAUDE.md` "## Pre-Edit Gate" — TRIVIAL/NON-TRIVIAL classifier + Bug fix mode paragraph
- `templates/playbook-sections.md:60-71` — duplicate Pre-Edit Gate (table form)
- `templates/new-issues.md:13-36` — canonical issue format block
- `tasks/new-issues.md:9-36`, `tasks/issues.md:9-36` — live copies of the issue format
- `.claude/prompts/research-guide.md:24-29` — §2 "Current Behavior" (data-flow line to strengthen)
- `.claude/prompts/research-guide.md:5,11` — `{TASK}` / `{SEARCH_HINTS}` placeholders
- `.claude/commands/issue-research.md:20` — reads Description/Acceptance Criteria/Notes; `:29-32` folds them into `{TASK}`
- `.claude/commands/auto-issues.md:53` — Phase 1 runs `/issue-research` non-interactively ("do not ask questions")
- `.claude/commands/playbook-setup.md:21-26` — appends `playbook-sections.md` to existing `CLAUDE.md`
- `.claude/commands/playbook-update.md:114-135` — managed bottom-half sync
- `.claude/commands/design.md:22-28`, `.claude/commands/create-plan.md:23-28` — downstream consumers
- `.claude/commands/create-todo.md:28-33` — abstraction discipline (avoids file paths in tasks)
- `quickref.md` "## Pre-Edit Gate" + "## Starting a New Task" — human cheat-sheet, "input/output/success criteria" framing

## Architecture Analysis

- **Two-stage research, placeholder contract.** `/research-codebase` and `/issue-research` both compose `{TASK}` + `{SEARCH_HINTS}`, substitute them into the shared `research-guide.md`, and run Codex. The four fields must be expressed *within* this existing contract — there is no third channel.
- **Intake asymmetry.** The issue flow is partly ahead of the singleton flow: `/issue-research` already carries acceptance criteria into `{TASK}` because the issue *template* has an Acceptance Criteria section. The singleton flow has no template — `$ARGUMENTS` is free text — so it has nothing structured to carry. Task 5 (a) closes that gap with a missing-field ask; Task 5 (c) extends the issue template's structure.
- **Managed-file duplication is deliberate.** The Pre-Edit Gate exists twice on purpose: `CLAUDE.md` is the live rule, `playbook-sections.md` is the install/update source. They are kept byte-consistent by convention, not tooling — so an edit to one is an implicit edit to the other.
- **No test infrastructure.** These are Markdown contracts. Verification is grep + read-through; `codex-output-check.sh` only checks Codex temp output existence/length.

## Design Axes

### Axis 1 — `/research-codebase` missing-field gate: location
- **Choices:** (A) new Step 2.5, after §2 "read directly mentioned files" (`:21-24`) and before §3 Codex composition; (B) inside §3 step 2, immediately before composing `{TASK}`; (C) fold into the top preflight near the blank-arg / readiness checks (`:5-7`).
- **Per-axis constraints:** must ask once, batched; must fire before any §3 side effect (temp-file writes, Codex run); should let fields be satisfied by docs read in §2.
- **Evidence:** `research-codebase.md:5-7, 21-24, 26-40`.

### Axis 2 — Four-field → placeholder mapping
- **Choices:** (A) `{TASK}` carries intent + constraints + acceptance criteria; `{SEARCH_HINTS}` "Key files to start from" carries relevant paths. (B) `{TASK}` carries all four; relevant paths *also* duplicated into `{SEARCH_HINTS}`. (C) a dedicated labeled "Upfront spec" sub-block inside `{TASK}` holding all four verbatim, `{SEARCH_HINTS}` unchanged as discovery accelerators.
- **Per-axis constraints:** Task 5 (a) explicitly says acceptance criteria go "alongside intent" in `{TASK}`; `research-guide.md:9` says `{SEARCH_HINTS}` are "not scope constraints" so the *constraints* field must be in `{TASK}`; known-critical data flow → Constraints, not Relevant paths.
- **Evidence:** `tasks/todo.md:36`, `research-guide.md:9`, `research-codebase.md:30-38`.

### Axis 3 — What counts as "missing"
- **Choices:** (A) strict — require explicit labels (`Intent` / `Constraints` / `Acceptance criteria` / `Relevant paths`). (B) semantic — extract from prose + referenced docs, ask only when genuinely absent. (C) hybrid — accept explicit labels or obvious equivalents, ask once when ambiguous.
- **Per-axis constraints:** field names fixed by `tasks/todo.md:36`; an explicit "none" / "no constraints" must count as a satisfied field (else the ask loops on legitimately-empty tasks); "relevant paths" may be files, globs, docs, or doc sections.
- **Evidence:** `tasks/todo.md:36`, `research-codebase.md:21-24`.

### Axis 4 — Pre-Edit Gate propagation scope
- **Choices:** (A) root `CLAUDE.md` only. (B) `CLAUDE.md` + `templates/playbook-sections.md` (the install/update source). (C) B plus `quickref.md` (human cheat-sheet, whose "Pre-Edit Gate" and "Starting a New Task: input/output/success criteria" framing would otherwise contradict the new gate).
- **Per-axis constraints:** Task 5 (b) names only `CLAUDE.md`; but `playbook-setup.md:25` / `playbook-update.md:114-135` make `playbook-sections.md` a real propagation surface. The two gate copies must stay byte-consistent. `quickref.md` is human-only, not loaded by Claude.
- **Evidence:** `templates/playbook-sections.md:60-71`, `playbook-setup.md:21-26`, `playbook-update.md:114-135`, `quickref.md` Pre-Edit Gate / Starting a New Task.

### Axis 5 — Issue-flow consumption depth
- **Choices:** (A) update only `templates/new-issues.md` + the live format blocks in `tasks/new-issues.md` and `tasks/issues.md`. (B) also update `/issue-research` to *read* `### Constraints` / `### Relevant paths` and route constraints into `{TASK}`, paths into `{SEARCH_HINTS}`. (C) B plus backfilling blank `### Constraints` / `### Relevant paths` into existing draft issues (e.g. `tasks/new-issues.md` Issue #3).
- **Per-axis constraints:** Task 5 (c) names only `templates/new-issues.md`. Any `/issue-research` change must be **read-only consumption** — never an interactive "ask when missing" — because `/auto-issues` Phase 1 runs it non-interactively (`auto-issues.md:53`).
- **Evidence:** `templates/new-issues.md:13-36`, `tasks/new-issues.md:9-36,44-71`, `tasks/issues.md:9-36`, `issue-research.md:20,29-32`, `auto-issues.md:53`.

### Axis 6 — `research-guide.md` §2 data-flow: depth and spread
- **Choices:** (A) strengthen only `research-guide.md` §2 into an explicit tracing checklist (entry points, payloads/arguments, call handoffs, state writes/artifacts, failure paths). (B) A plus an explicit "Data Flow" subsection in the research artifact schemas (`research-codebase.md` §5 and `issue-research.md` §5). (C) B plus updating `/design` and `/create-plan` to consume the data-flow findings explicitly.
- **Per-axis constraints:** Task 5 (d) names *only* `research-guide.md` §2. `research-guide.md` is shared, so an §2 edit reaches both research flows automatically. Data flow is discovered output, not upfront intake.
- **Evidence:** `research-guide.md:24-29`, `research-codebase.md:96-152`, `issue-research.md` §5.

### Axis 7 — `/create-todo` as an upstream intake source
- **Choices:** (A) leave `/create-todo` unchanged — `/research-codebase` enforces the four fields at kickoff. (B) make `/create-todo` emit the four fields per task. (C) a lighter reminder in the `tasks/todo.md` output.
- **Per-axis constraints:** `create-todo.md:28-33` deliberately keeps tasks at the capability/outcome level and explicitly avoids specific file paths — emitting per-task "relevant paths" conflicts with that discipline. Task 5 names only four surfaces; `/create-todo` is not one.
- **Evidence:** `create-todo.md:15-24,28-33,50-62`.

## Axis Coupling

- **Axis 3 → Axis 1:** If field satisfaction may come from referenced docs (Axis 3 = B or C), the gate must run *after* §2 file reads → Axis 1 narrowed to {A, B}, choice C (top preflight, runs before §2) is ruled out. If Axis 3 = A (strict labels in `$ARGUMENTS` only), Axis 1 = C becomes viable again.
- **Axis 4 floor:** Axis 4 = A (CLAUDE.md only) is unstable — it guarantees gate drift on every `/playbook-setup` / `/playbook-update` install. B is effectively the minimum viable choice; the real decision is B vs C.
- **Axis 5 → interactivity:** If Axis 5 = B or C (touch `/issue-research`), the change is constrained to passive reading — adding an interactive ask there breaks `/auto-issues` non-interactive Phase 1 (`auto-issues.md:53`).
- **Axis 6 B without C:** If the artifact schema gains a Data Flow section (Axis 6 = B) but downstream consumers aren't updated (not C), the section is produced but under-consumed by `/design` and `/create-plan`.

## Cross-Cutting Constraints

- The four mandatory fields are exactly: **intent, constraints, acceptance criteria, relevant paths** (`tasks/todo.md:36`).
- `/research-codebase` must ask **once, batched**, when any field is missing — not field-by-field.
- No command-to-skill port in this task; original `.claude/commands/*.md` files stay in place (`tasks/todo.md:7-12`).
- Intake vs. output stays distinct: data flow is *discovered* in research (surface d), never supplied as a Relevant paths value.
- Preserve existing Codex invocation discipline in command specs — `run_in_background` + `</dev/null` (`research-codebase.md:43-50`).
- Verification is by grep / read-through only — no automated tests for these Markdown contracts.
- The "ask when missing" behavior is interactive and safe only in interactive commands. `/research-codebase` is interactive; `/issue-research` is run non-interactively by `/auto-issues` — enforcement there cannot use an interactive ask.

## External Research

None required. Every axis is fully evaluable from the repository specs and the Task 5 source text — no external libraries, APIs, protocols, or version behavior gates any choice (confirmed by Codex's `--search` sweep, §6: "None required").

## Risk Analysis

- **Decorative issue fields (Axis 5 = A).** Growing `templates/new-issues.md` with `Constraints` / `Relevant paths` while `/issue-research` still reads only Description/Acceptance Criteria/Notes means the new fields are logged and never consumed. A strict reading of Task 5 (c) lands exactly here.
- **Gate drift (Axis 4 = A).** Editing only `CLAUDE.md` leaves `templates/playbook-sections.md` stale; every subsequent `/playbook-setup` or `/playbook-update` reinstalls the old gate, silently undoing surface (b) for new adopters.
- **Bug-fix-mode collision.** A blunt four-field requirement in the Pre-Edit Gate contradicts the gate's existing "diagnose autonomously, don't ask the user for root cause" clause. The wording must allow "unknown — discover during diagnosis" for constraints/paths on bug fixes.
- **Interactive ask in the issue flow.** Extending the missing-field ask to `/issue-research` would hang `/auto-issues` Phase 1, which explicitly forbids questions.
- **Strict-label friction / loop (Axis 3 = A).** Requiring verbatim labels could force ceremony on near-trivial tasks and loop forever on tasks that genuinely have no constraints unless an explicit "none" is accepted as a satisfied field.
- **`/create-todo` abstraction conflict (Axis 7 = B/C).** Emitting per-task "relevant paths" fights `create-todo.md`'s deliberate rule against file paths in task descriptions.
- **Readiness preflight vs. four-field gate.** `/research-codebase` already has a top-of-file "Readiness preflight" (`:7`). The new four-field gate is a sibling check but cannot merge into the same location if it must run after §2 (Axis 3 coupling) — two separate checks is the likely outcome; design should state this explicitly to avoid an awkward merge.

## Open Questions

1. **Is the issue flow in scope beyond the template?** Task 5 (c) names only `templates/new-issues.md`. Updating `/issue-research` to *read* the new sections is the only way the fields aren't decorative — but it is strictly an extra surface. Recommend design treat "update `/issue-research` to passively consume `### Constraints` / `### Relevant paths`" as in-scope (it is the minimum that makes (c) meaningful) and flag it for developer confirmation. The interactive-ask behavior stays singleton-only regardless.
2. **Does the research artifact schema need an explicit four-field block** (`research-codebase.md` §5), or does `## Research Question` faithfully echoing the enriched `{TASK}` suffice for downstream propagation? (Axis 2 / Axis 6 sub-decision.)
3. **Axis 6 spread** — strengthen `research-guide.md` §2 only (Task 5's literal scope), or also add a Data Flow section to artifact schemas and/or downstream consumers? Task 5 (d) names only §2; B/C are scope expansions.
4. **`quickref.md` (Axis 4 = C)** — update the human cheat-sheet's "input/output/success criteria" framing to match the new four-field gate, or leave it (out of Task 5's named scope, but it will visibly contradict the new gate)?
