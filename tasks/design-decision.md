# Design: Task 7 — Port all playbook slash commands to skills

## Context

Port every playbook slash command (`.claude/commands/<name>.md`, 22 files) into a Claude Code skill (`.claude/skills/<name>/SKILL.md`), relocate or keep the supporting assets each command depends on, and update every internal cross-reference so nothing breaks. Each skill is verified by invoking `/<name>`.

Research established the port is **mechanical and low-risk**: commands and skills share body format, frontmatter, `$ARGUMENTS` substitution, and shell injection. The official docs state a command and a same-named skill "work the same way."

**Most axes are already developer-decided** (research, 2026-05-21) and enter `/design` as fixed inputs:

- **Axis 3 (invocation policy) = split by weight.** `codex-review` ships auto-invocable; the other 21 skills ship `disable-model-invocation: true`.
- **Axis 4 (shell injection) = convert.** Bare `!git …` lines → documented `` !`git …` `` inline form (multi-line groups → ```` ```! ```` fenced blocks). Affects `commit`, `finish`, `issue-finish`, `push-pr`, `push-pr-light`.
- **Axis 5 (/auto-issues handoff) = repoint to skill files.** The 4 child-spawn directives (`auto-issues.md:53,65,77,89`) → `Read .claude/skills/issue-<phase>/SKILL.md and follow its instructions`.
- **Frontmatter richness = adopt Tier 1 only.** `argument-hint` + `description` on every skill (+ `when_to_use` for `codex-review`). Do NOT adopt `allowed-tools` or any Tier 2/3 feature.
- **`codex-review` target resolution** — two entry modes (explicit target / infer-from-context-then-ask), superseding the current no-target hard-stop.

**This design decides the still-open axes:** Axis 1 (skill body shape), Axis 2 (supporting-asset locality), Axis 6 (RDPI-artifact storage — the Deferred investigation), Axis 7 (global-install target).

**Research:** `tasks/research-codebase.md`

## Pre-resolved axes (not in tension)

Two open axes have only one viable choice and are not split across the options below:

- **Axis 1 = Direct port.** `SKILL.md` = optional frontmatter + the command body verbatim. The docs say command and skill bodies "work the same way," so a direct port is sufficient and intended. Choice (b) wrapper and (c) transitional wrapper add indirection for no gain; (c) additionally would run skills through the old command bodies, blocking eventual command deletion.
- **Axis 6 = Keep singleton files (Deferred item resolves NO).** Task-scoped directories or hybrid storage require new decisions on task-dir naming, an active-task pointer, scratch/`logs/` isolation, a `checkpoint.md` schema migration, `/finish` + `/issue-finish` cleanup rewrites, `/playbook-audit` rewrites, and touch 200+ singleton-reference sites. The restructure's only payoff — safe broad auto-invocation — is something side-effect workflow skills **should not have anyway** (Axis 3 already gives every singleton-writing skill `disable-model-invocation: true`). Not a prerequisite for Task 7; stays deferred.

## Options Considered

The three options differ on **Axis 2 (supporting-asset locality)** — how the shared `.claude/prompts/`, `.claude/scripts/`, and `templates/` assets relate to the new skill directories. All three use Axis 1 = direct port and Axis 7 = install skills to `~/.claude/skills/` (the docs-confirmed personal-skill location; keeping the old command install would leave a format split, and dropping it is an unrelated scope cut).

### Option A — Minimal port, keep root layout (Axis 2 = c)

Create the 22 `.claude/skills/<name>/SKILL.md` files; leave `.claude/prompts/`, `.claude/scripts/`, and `templates/` exactly where they are. Every supporting-asset reference is already repo-relative and resolves from the repo root regardless of where `SKILL.md` sits, so **no asset moves and no asset-reference edits are needed**.

- **Good:** Simplest — fewest files touched, lowest blast radius, fully reversible.
- **Not good:** Skill folders are empty shells (`SKILL.md` only) — diverges from Anthropic's documented skill structure, in which a skill is a self-contained folder bundling its private `scripts/`/`references/`. Leaves `templates/` cluttering the repo root.

### Option B — Fully self-contained skills, co-locate everything (Axis 2 = a)

Copy every asset into every skill directory that uses it; rewrite references to `${CLAUDE_SKILL_DIR}/…`. `codex-output-check.sh` gets copied into 9 skill dirs; `research-guide.md` into 2; `error-report.md` into 4.

- **Good:** Each skill directory literally bundles its dependencies.
- **Not good:** Per-skill duplication forces `playbook-update.md`'s managed-files list to enumerate every duplicate copy and creates a real sync-drift hazard (research Risk Analysis). Largest diff; hardest to reverse. **Ruled out.**

### Option C — Hybrid locality: co-locate single-use, share multi-use (Axis 2 = b)

Co-locate each genuinely single-consumer asset into its one skill; keep a shared location for multi-consumer assets. No duplication. As originally framed, Option C also fragmented the single-use *templates* (`audit-report.md`, `deferred.md`, `playbook-sections.md`) out into three separate skill folders.

- **Good:** No duplication; private assets bundle with their skill, matching Anthropic's intended structure.
- **Not good (as originally framed):** Scattering single-use templates across three skill folders breaks the coherence of `templates/` — a unified set of output-format blueprints. The refined decision below fixes this.

## Decision Heuristics

1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Decision

**Chosen approach:** **Option C, refined** — co-locate genuinely-private (single-consumer) prompt/script assets into their skill folders, but keep `templates/` as one coherent directory and relocate it whole to `.claude/templates/`.

Axis choices: **1 = direct port**, **2 = hybrid locality (refined)**, 3 = split by weight *(fixed)*, 4 = convert injection *(fixed)*, 5 = repoint /auto-issues handoff *(fixed)*, **6 = keep singleton RDPI artifacts**, **7 = install skills to `~/.claude/skills/`**.

**Rationale:**

The initial Codex cross-check converged on Option A (simplest). The developer's design review then shifted the decision, on these grounds:

1. **Anthropic's documented skill structure** (verified against the official Claude Code skills docs and the Anthropic skill-authoring best-practices doc) treats a skill as a *self-contained folder* that bundles its private assets in `scripts/` / `references/` subdirectories. Co-locating the **3 genuinely-private assets** — each with exactly one consumer — aligns with that standard at near-zero cost: there is no shared-asset coupling and no group coherence to break.
2. **`templates/` is a coherent set** — five output-format blueprints for files the playbook generates. Fragmenting it across skill folders (plain Option C) destroys that coherence and makes the set hard to find and manage. Keeping it whole, and relocating it to `.claude/templates/`, preserves the set, clears repo-root clutter, and sits it consistently beside `.claude/prompts/` and `.claude/scripts/`. The developer's condition — that templates are not user working state — is verified true: `templates/` holds static blueprints, not `tasks/` content, so the `rm -rf tasks` install step does not touch them.
3. **Option A reconsidered and not chosen** — it leaves skill folders as empty shells and leaves `templates/` at the repo root; it satisfies simplicity but not the codebase-pattern heuristic (Anthropic's intended structure). **Option B stays ruled out** — duplication causes sync drift and managed-files bloat.

This decision overrides the earlier Codex-converged Option A; the convergence was on simplicity alone, and the design review weighed codebase/platform-pattern alignment higher for the three private assets.

## Final Design — Directory Layout

```
project root/
├── .claude/
│   ├── commands/                          # 22 ORIGINALS — untouched, stay until all
│   │   └── (auto-issues.md … 22 files)    #   skills verified; deletion is out of scope
│   ├── skills/                            # NEW top-level dir — 22 skill folders
│   │   ├── design/
│   │   │   ├── SKILL.md
│   │   │   └── research-patterns-guide.md         ← from .claude/prompts/
│   │   ├── implement-codex/
│   │   │   ├── SKILL.md
│   │   │   └── implement-codex-phase-brief.md     ← from .claude/prompts/
│   │   ├── auto-issues/
│   │   │   ├── SKILL.md
│   │   │   └── scripts/
│   │   │       └── pipeline-eval.sh               ← from .claude/scripts/
│   │   └── (19 more skills = SKILL.md only):
│   │       research-codebase, create-plan, implement, create-todo, finish,
│   │       issue-research, issue-plan, issue-implement, issue-update, issue-finish,
│   │       commit, push-pr, push-pr-light, catchup, checkpoint, codex-review,
│   │       playbook-setup, playbook-update, playbook-audit
│   ├── prompts/
│   │   └── research-guide.md              # SHARED (research-codebase + issue-research)
│   ├── scripts/
│   │   └── codex-output-check.sh          # SHARED (9 skills)
│   └── templates/                         # MOVED here whole from repo root — all 5 files
│       ├── audit-report.md
│       ├── deferred.md
│       ├── error-report.md
│       ├── new-issues.md
│       └── playbook-sections.md
├── CLAUDE.md                              # templates/ refs updated → .claude/templates/
├── README.md                              # doc-accuracy sweep + templates/ path update
└── quickref.md                            # doc-accuracy sweep
```

### Supporting-asset inventory and disposition

| Asset | Type | Consumer(s) | Disposition |
|---|---|---|---|
| `research-guide.md` | prompt | `research-codebase`, `issue-research` | **shared** → stays `.claude/prompts/` |
| `research-patterns-guide.md` | prompt | `design` | **private** → `.claude/skills/design/` |
| `implement-codex-phase-brief.md` | prompt | `implement-codex` | **private** → `.claude/skills/implement-codex/` |
| `codex-output-check.sh` | script | 9 skills (functional invocations; a 10th textual mention is `playbook-update.md:45`'s managed-files list) | **shared** → stays `.claude/scripts/` |
| `pipeline-eval.sh` | script | `auto-issues` | **private** → `.claude/skills/auto-issues/scripts/` |
| `audit-report.md` | template | `playbook-audit` | → `.claude/templates/` (set kept whole) |
| `deferred.md` | template | `issue-plan` | → `.claude/templates/` |
| `error-report.md` | template | `commit`, `push-pr`, `push-pr-light`, `catchup` | → `.claude/templates/` |
| `new-issues.md` | template | `CLAUDE.md` instruction | → `.claude/templates/` |
| `playbook-sections.md` | template | `playbook-setup` | → `.claude/templates/` |

**Corrections to the research artifact** absorbed here:
- `research-codebase.md:56` claims `playbook-sections.md` is "referenced by `CLAUDE.md` itself (`CLAUDE.md:28,30`)." **Wrong** — `CLAUDE.md:28,30` reference only `new-issues.md`. `playbook-sections.md`'s sole functional consumer is `/playbook-setup` (`playbook-setup.md:25` reads it and appends its contents into CLAUDE.md). `playbook-update` *manages* it but does not consume it as a template. It is single-use; it is kept in `.claude/templates/` only because the template set is held together, not because it is multi-consumer.
- `error-report.md` is **not** a pure format snippet — it carries a *Reflection Prompt* (an instructional checklist) that `commit`/`push-pr`/`push-pr-light`/`catchup` scan, alongside two entry-format templates.

### Reference updates this triggers

_(Items 3, 4, and the second half of items 2 and 6 were added after the Codex review of this design — see `## Codex Review` below.)_

1. **3 co-located assets** → referenced via `${CLAUDE_SKILL_DIR}/…` in their owning `SKILL.md`.
2. **`templates/` → `.claude/templates/`** — two kinds of reference:
   - Per-file `templates/X.md` references in `playbook-audit`, `issue-plan`, `commit`, `push-pr`, `push-pr-light`, `catchup`, `playbook-setup`, plus `CLAUDE.md`.
   - Generic `templates/` *directory* references — `playbook-setup.md:142` ("if the project doesn't have the `templates/` directory"), and `README.md:21` (backup note) + `README.md:107` (the `templates/*` structure row).
3. **`playbook-setup` global-install block** (`playbook-setup.md:96-107`, Step 3B) — Axis 7: the install target changes from `~/.claude/commands/` to `~/.claude/skills/<name>/SKILL.md`, and the source list from `.claude/commands/*.md` to `.claude/skills/<name>/SKILL.md`.
4. **`codex-review` internal convention anchors** (`codex-review.md:23,82`) — prose references to `.claude/commands/research-codebase.md` / `design.md` / `create-plan.md` → `.claude/skills/<name>/SKILL.md`. `codex-review.md:23` also carries a line number (`:40`) that will drift once the body gains frontmatter — drop the line number or accept drift.
5. **`auto-issues` child-spawn directives** (`auto-issues.md:53,65,77,89`) → `Read .claude/skills/issue-<phase>/SKILL.md …`. Note `auto-issues.md:77` references `.claude/commands/issue-implement.md` **twice** on the one line (the spawn directive + the structural-mismatch clause) — both occurrences must be updated.
6. **`playbook-update.md` managed-files list AND its summary table** — the fenced managed-files block: 22 command paths → skill paths, asset paths → new locations (`.claude/templates/`, the 3 co-located assets); AND the summary-table example at `playbook-update.md:170`, which still names `templates/playbook-sections.md`.
7. **Bare `!git …`** → `` !`git …` `` inline form in the 5 git-preloading skills (`commit`, `finish`, `issue-finish`, `push-pr`, `push-pr-light`).
8. **Doc-accuracy sweep** — `README.md` and `quickref.md` "commands" terminology / structure rows updated to describe skills.

## Open Questions

### Blocking (must resolve before implementation)

_(none — all axes are decided or pre-resolved above)_

### Non-blocking (can resolve during implementation)

- [ ] **OQ1 — Restart/session-boundary sequencing.** Creating `.claude/skills/` for the first time requires a Claude Code restart before any skill is discoverable. `/create-plan` must structure the plan: (1) write all SKILL.md files + asset/reference updates; (2) **static pre-restart completeness check** — all 22 `SKILL.md` files present and well-formed *before* the restart, because same-name precedence means a half-ported skill immediately shadows its still-working command (`research-codebase.md:205`); (3) restart Claude Code / cross a session boundary; (4) verify each `/<name>`; (5) **then** commit. Verify *before* the final commit — SKILL.md files persist across a restart regardless of commit state.
- [ ] **OQ2 — `implement-codex` SKILL.md size.** `implement-codex.md` is ~499 lines; with frontmatter it exceeds the docs' soft *"under 500 lines"* Tip. Recommendation: **accept as-is** — the limit is a soft Tip; splitting body content risks the no-behavioral-change constraint for zero functional gain.
- [ ] **OQ3 — Formally close the Deferred item?** Recommendation: close the "Enable skill auto-invocation" Deferred item, citing the Axis 3 + Axis 6 rationale (auto-invocation is not desired for side-effect workflow skills).
- [ ] **OQ4 — Global-install self-containment caveat.** The four globally installed utility skills (`commit`, `push-pr`, `push-pr-light`, `catchup`) reference `error-report.md` via a repo-relative path. Installing only `SKILL.md` into `~/.claude/skills/` does not bundle that template, so the reference does not resolve in a non-playbook workspace. **Pre-existing behavior** — the global *commands* installed today have the identical gap — so Axis 7 = install-skills is parity, not a regression. `/create-plan` should make the non-playbook-workspace limitation explicit. Not a blocker.
- [ ] **OQ5 — `/playbook-update` parent-directory creation.** `/playbook-update`'s install step (`playbook-update.md:100-113`) does not explicitly create parent directories before writing files. After this port it must install at new nested paths (`.claude/skills/<name>/SKILL.md`, `.claude/templates/*.md`). The plan **must** make `/playbook-update`'s install step explicitly check whether each target's parent directory exists and create it (`mkdir -p`) if not, before writing a new nested file. Not a blocker, but a required plan item.

  **Resolved separately (not tracked as an issue):** the related concern — existing installs keeping a stale root `templates/` after the move (`/playbook-update` does nothing when a project file exists but the source dropped it, `playbook-update.md:113`) — is **out of scope**. The developer will remove the old `templates/` folder manually as part of separate future work.

## What We're NOT Doing

- **Not deleting `.claude/commands/*.md`.** They stay until all skills are verified; deletion is a separate out-of-scope cleanup pass. Same-name precedence makes coexistence harmless.
- **Not restructuring RDPI artifacts** (Axis 6 = keep singleton).
- **Not eliminating `templates/` by seeding files into `tasks/` and reworking the install contract.** This idea surfaced during design review. It is a genuine workflow redesign — it changes the public install contract (`rm -rf tasks` exists to wipe maintainer state; removing it requires *more* complex selective-cleanup logic, not less), it does not eliminate the template files (seed content must still live somewhere), `audit-report.md` (regenerated wholesale) and `playbook-sections.md` (a CLAUDE.md fragment) do not fit a `tasks/`-seed model, and it overlaps the deferred Axis 6 work. The developer will handle removal of the root `templates/` folder separately, out of band — **not tracked as an issue**.
- **Not adopting `allowed-tools`, `context: fork`, `agent`, `hooks`, `effort`/`model` overrides, named `arguments`, or `paths`** (Skill-Feature Adoption Audit Tier 2/3).
- **Not changing command behavior** beyond the three authorized exceptions (Axis 3 flag, Axis 4 injection-syntax conversion, `codex-review` target resolution).
- **Not splitting `implement-codex` body content** into supporting files (pending OQ2 confirmation).

## Codex Review

An independent Codex review of this finalized design ran 2026-05-21. All 8 findings were spot-checked against the actual repository and **every one verified as legit**; each was absorbed in place:

- **CORRECTION ×4 — missed reference-update sites.** The `playbook-setup` global-install block (`playbook-setup.md:96-107`), `codex-review`'s internal convention anchors (`codex-review.md:23,82`), generic `templates/` *directory* references (`playbook-setup.md:142`, `README.md:21,107`), and `playbook-update.md:170`'s summary-table example were all absent from the original "Reference updates this triggers" list. → Folded in as items 2–4, 6.
- **RISK — existing-install migration.** Moving `templates/` strands stale root `templates/*` files on existing installs. → New OQ5.
- **RISK — no parent-dir creation in `/playbook-update`.** → Folded into OQ5.
- **RISK — half-ported skill shadows its command after restart.** → OQ1 now includes a static pre-restart completeness check.
- **RISK — OQ4 is real, not theoretical.** → OQ4 reworded to require the plan make the non-playbook-workspace limit explicit.

Codex's "checks that hold": the 22-skill list matches `.claude/commands/` exactly; the asset inventory is correct except `codex-output-check.sh` is **9** functional consumers (the 10th is a managed-files-list mention) — corrected in the inventory table; both research-artifact corrections (`playbook-sections.md` not CLAUDE.md-referenced; `error-report.md` carries a reflection prompt) verified.
