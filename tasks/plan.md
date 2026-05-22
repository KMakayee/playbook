# Plan: Task 7 — Port all playbook slash commands to skills

## Design decision reference

Implements **Option C, refined** from `tasks/design-decision.md`: direct-port each of the 22
`.claude/commands/<name>.md` files into `.claude/skills/<name>/SKILL.md`, co-locate the 3
genuinely-private supporting assets, relocate `templates/` whole to `.claude/templates/`, and
update every cross-reference. Research: `tasks/research-codebase.md`.

Axis choices (fixed by design): 1 = direct port · 2 = hybrid locality (refined) · 3 = split by
weight · 4 = convert injection · 5 = repoint /auto-issues handoff · 6 = keep singleton RDPI
artifacts · 7 = install skills to `~/.claude/skills/`.

## Implementation Status

> **Updated 2026-05-22 — `/implement`, first invocation (pre-restart half).**
>
> - **Phases 1–4: COMPLETE** (all file work done — 22 SKILL.md scaffolded + ported,
>   cross-references updated, behavioral changes applied, assets relocated via `git mv`).
> - **Phase 5 step 1 (static pre-restart completeness check): PASSED** — 22 well-formed
>   SKILL.md; `</dev/null` total 23 across the same 10 skills; `run_in_background` in the
>   same 10 skills.
> - **All changes are UNCOMMITTED** — intentional, per the single-commit model (Phase 5
>   step 6). The pre-restart tree is in the expected transient state.
>
> **NEXT — post-restart resume:** the developer must **restart Claude Code** so the new
> top-level `.claude/skills/` directory is discoverable (Phase 5 step 2). After the restart,
> re-invoke `/implement`: it will read this plan, see this status block, and **resume Phase 5
> from step 3** (verify → step 4 `tasks/todo.md` edits → **step 5 Codex code review, run
> explicitly** → step 6 single commit). Do not restart Phases 1–4.

## Scope boundaries — what we are NOT doing

- **Not deleting `.claude/commands/*.md`.** The 22 originals stay untouched. Same-name
  precedence makes the new skills shadow them once discovered; deletion is a separate
  out-of-scope pass. The originals will carry stale asset paths after Phase 4 — harmless,
  because they are shadowed.
- **Not restructuring RDPI artifacts** (Axis 6 = keep singleton `tasks/*.md`).
- **Not adopting** `allowed-tools`, `context: fork`, `agent`, `hooks`, `effort`/`model`
  overrides, named `arguments`, or `paths` (Skill-Feature Audit Tier 2/3).
- **Not splitting `implement-codex` body** into supporting files. Its SKILL.md will sit at
  ~505 lines with frontmatter — the docs' "under 500 lines" is a soft Tip, accepted as-is
  (design OQ2).
- **No behavioral change** beyond the 3 authorized exceptions: the Axis 3 frontmatter flag,
  the Axis 4 injection-syntax conversion, and the `codex-review` target-resolution rewrite.

## Sequencing constraint (design OQ1)

Creating the top-level `.claude/skills/` directory requires a **Claude Code restart** before
any skill is discoverable. Therefore:

- Phases 1–4 are all file work, done in one `/implement` cycle. **Do not commit between
  phases** — the pre-restart tree is intentionally in a transient state (Phase 4 moves assets
  out from under the still-live original commands; Phase 4 is ordered last specifically so
  that broken-window is one phase wide).
- Phase 5 begins with a static completeness check, then a **developer-driven restart**, then
  verification, then **`/implement`'s Codex code review repositioned to post-restart**, then
  a **single commit**. SKILL.md files persist across a restart regardless of commit state, so
  committing last is safe and is what design OQ1 mandates.
- This overrides `CLAUDE.md`'s default "commit after each phase" — the restart boundary makes
  one commit-after-verification the correct model here. The restart also splits `/implement`'s
  built-in execute→review→commit cycle: the Codex code review is repositioned to a named
  Phase 5 step (step 5) so it runs against the settled, verified skill surface rather than
  the transient pre-restart tree — and so it is not silently skipped (see Phase 5).

---

## Phase 1 — Scaffold skill directories and port all 22 bodies

**Goal:** every command exists as a faithful skill, with frontmatter, before any reference or
behavioral edits.

1. Create `.claude/skills/` and 22 subdirectories (one per command basename). Also create
   `.claude/skills/auto-issues/scripts/` (target for `pipeline-eval.sh` in Phase 4).
2. For each `.claude/commands/<name>.md`, write `.claude/skills/<name>/SKILL.md` =
   **YAML frontmatter + the command body copied verbatim.** Do not touch asset paths inside
   the body in this phase.
3. Frontmatter per skill:

   ```yaml
   ---
   name: <basename>
   description: <one concise line — derived from the command's purpose / H1>
   argument-hint: <hint>            # the 12 argument-taking skills, see below
   disable-model-invocation: true   # all 21 skills EXCEPT codex-review
   ---
   ```

   - **`codex-review` is the exception:** omit `disable-model-invocation` (defaults to
     `false` → auto-invocable) and instead add `when_to_use:` with natural phrasings —
     "have codex review", "get codex's opinion", "codex review this". Keep it natural, not
     tight (design Axis 3).
   - **`argument-hint`** applies to **12 skills**. Eleven reference the `$ARGUMENTS` token
     (`grep -rl ARGUMENTS .claude/commands/`): `catchup`, `checkpoint`, `codex-review`,
     `issue-research`, `issue-plan`, `issue-implement`, `issue-update`, `issue-finish`,
     `push-pr`, `push-pr-light`, `research-codebase`. The 12th, `create-todo`, takes an
     argument via prose ("the provided file", `create-todo.md:5,7`) without using the
     `$ARGUMENTS` token — a grep-only list misses it, but it still warrants a hint.
     Suggested hints — `issue-*` → `[issue-number]`; `codex-review` →
     `[file | diff | artifact | "description"]`; `checkpoint` →
     `[save | resume | discard | replace]`; `research-codebase` → `[task-description]`;
     `create-todo` → `[design-doc path(s) + optional instructions]` (it accepts a doc path
     and/or free-form instructions, and extra files for cross-refs);
     `push-pr`/`push-pr-light`/`catchup` → derive from each body's `$ARGUMENTS` usage. Hints
     are UX-only — **no body change**; `create-todo`'s body is ported verbatim and the
     missing-`$ARGUMENTS` fallback (Claude Code appends `ARGUMENTS: <value>`) already
     delivers free-form input to it. Refine wording against the body if it diverges.

**Success criteria:**
- `ls .claude/skills/ | wc -l` → `22`.
- `for f in .claude/commands/*.md; do n=$(basename "$f" .md); test -f ".claude/skills/$n/SKILL.md" || echo "MISSING $n"; done` → no output.
- Each `SKILL.md` opens with a `---` frontmatter block containing at least `name` and
  `description`; exactly one skill (`codex-review`) lacks `disable-model-invocation: true`.
- **Tier 1 frontmatter present:** each of the 12 argument-taking skills (`catchup`,
  `checkpoint`, `codex-review`, `create-todo`, `issue-research`, `issue-plan`,
  `issue-implement`, `issue-update`, `issue-finish`, `push-pr`, `push-pr-light`,
  `research-codebase`) has an `argument-hint` field, and `codex-review/SKILL.md` has a
  `when_to_use` field. Verify by parsing frontmatter, not just grep.
- For each skill, the content after the closing frontmatter `---` is byte-identical to its
  source `.claude/commands/<name>.md` (verify by diffing the body region).

## Phase 2 — Update all cross-references

**Goal:** repoint every reference to a (to-be-)moved asset or a command path. All edits here
are mechanical reference fixes (the design's "Reference updates this triggers" items 1–6, 8).
**Asset relocation itself happens in Phase 4** — these edits point references at the
post-move locations (the correct end state). Editing the not-yet-live skill files before the
assets move keeps the original commands working until the last pre-restart phase.

Edit inside the **SKILL.md files** (not the originals):

1. **Co-located assets → `${CLAUDE_SKILL_DIR}/…`:**
   - `design/SKILL.md` (was `design.md:195`): `.claude/prompts/research-patterns-guide.md`
     → `${CLAUDE_SKILL_DIR}/research-patterns-guide.md`.
   - `implement-codex/SKILL.md` (was `implement-codex.md:85`):
     `.claude/prompts/implement-codex-phase-brief.md` →
     `${CLAUDE_SKILL_DIR}/implement-codex-phase-brief.md`.
   - `auto-issues/SKILL.md` (was `auto-issues.md:130`): `.claude/scripts/pipeline-eval.sh`
     → `${CLAUDE_SKILL_DIR}/scripts/pipeline-eval.sh`.
2. **Template references → `.claude/templates/…`** in the SKILL.md of every consumer:
   `playbook-audit` (`audit-report.md` ×3), `issue-plan` (`deferred.md`), `commit`,
   `push-pr`, `push-pr-light`, `catchup` (`error-report.md`), `playbook-setup`
   (`playbook-sections.md`, and the generic `templates/` directory mention at the old
   `playbook-setup.md:142`).
3. **`auto-issues/SKILL.md` child-spawn directives** (was `auto-issues.md:53,65,77,89`):
   each `Read .claude/commands/issue-<phase>.md and follow its instructions` →
   `Read .claude/skills/issue-<phase>/SKILL.md and follow its instructions`. Add to each
   directive that the child should **follow the Markdown body and ignore the leading YAML
   frontmatter** — the child reads the file as plain text (slash invocation is intentionally
   blocked for these manual-only skills, so the child cannot invoke them; it executes the
   body). **Line 77 cites `issue-implement.md` twice** (the spawn directive + the
   structural-mismatch clause) — update both occurrences.
4. **`playbook-update/SKILL.md`:**
   - Rewrite the fenced "Managed files" list: the 22 `.claude/commands/<name>.md` paths →
     `.claude/skills/<name>/SKILL.md`; `templates/*.md` → `.claude/templates/*.md`;
     `.claude/prompts/research-patterns-guide.md` →
     `.claude/skills/design/research-patterns-guide.md`;
     `.claude/prompts/implement-codex-phase-brief.md` →
     `.claude/skills/implement-codex/implement-codex-phase-brief.md`;
     `.claude/scripts/pipeline-eval.sh` →
     `.claude/skills/auto-issues/scripts/pipeline-eval.sh`. Leave
     `.claude/prompts/research-guide.md` and `.claude/scripts/codex-output-check.sh`
     unchanged. (The list points only at the live skill surface — old command paths are
     dropped, not retained.)
   - Fix the summary-table example (was `playbook-update.md:170`):
     `templates/playbook-sections.md` → `.claude/templates/playbook-sections.md`.
   - **OQ5 — parent-dir creation:** in Category A (around the old `playbook-update.md:107`
     "Replace the project file" step), add an explicit instruction that before writing any
     managed file the install step must ensure the target's parent directory exists
     (`mkdir -p` the dirname) — required now that managed files live at nested paths
     (`.claude/skills/<name>/SKILL.md`, `.claude/templates/*.md`).
5. **`playbook-setup/SKILL.md` Step 3B** (was `playbook-setup.md:94-114`): change the
   global-install target from `~/.claude/commands/` to `~/.claude/skills/<name>/SKILL.md`
   and the source list from `.claude/commands/{commit,push-pr,push-pr-light,catchup}.md` to
   `.claude/skills/<name>/SKILL.md`. Update the Step 0-style prose ("Install `/[name]`
   globally…") to say skills. (`playbook-setup.md:25` `templates/playbook-sections.md` is
   covered by item 2.) **Per-skill parent dirs:** the current Step 3B only ensures the single
   flat `~/.claude/commands/` exists (`playbook-setup.md:98`); the skill layout is nested, so
   the edit must `mkdir -p ~/.claude/skills/<name>` for each skill before its
   existence-check / copy. (This is the `/playbook-setup` analogue of OQ5's parent-dir fix
   for `/playbook-update`.) **OQ4 caveat:** add one informational sentence to the install offer
   noting that all four globally installed utility skills — `commit`, `push-pr`,
   `push-pr-light`, **and `catchup`** (each reads `error-report.md`) — reference
   `.claude/templates/error-report.md` by repo-relative path, so the global skill's
   reflection step does not resolve that template outside a playbook workspace —
   pre-existing behavior, surfaced so the developer is not surprised. (Informational prose
   only — not a behavior change.)
6. **`codex-review/SKILL.md`** (was `codex-review.md:23,82`): the prose convention anchors
   `.claude/commands/research-codebase.md`, `design.md`, `create-plan.md` →
   `.claude/skills/<name>/SKILL.md`. The `:40` line number on the `research-codebase`
   reference will drift once frontmatter is added — **drop the line number**, keep just the
   path reference.
7. **CLAUDE.md** (`CLAUDE.md:28,30`): `templates/new-issues.md` →
   `.claude/templates/new-issues.md`.
8. **Doc-accuracy sweep — all playbook-owned docs.** Scan `README.md`, `quickref.md`,
   `CLAUDE.md`, and every `templates/*.md` file (still at repo-root `templates/` at this
   point — they relocate in Phase 4). Apply this **classification rule** to each "command"
   occurrence:
   - **Stale path / structural references → MUST fix.** `README.md:107` `templates/*` row
     → `.claude/templates/*`; `README.md:108` `.claude/commands/*` row → `.claude/skills/*`;
     `README.md:21` backup-note `templates/` → `.claude/templates/`. (`CLAUDE.md:28,30`
     `templates/new-issues.md` is item 7.)
   - **Playbook-surface terminology in `README.md` + `quickref.md` → update to "skills"**
     (design-mandated): `README.md` "Commands" section header / table headers
     (lines ~31,35,39,50,61,69) and `quickref.md` headers (lines ~7,11,19,30,41).
   - **Generic "slash command" prose → stays** — skills are still invoked as slash
     commands, so the word is not wrong. This covers `CLAUDE.md` ("RDPI commands",
     `CLAUDE.md:184`), `templates/playbook-sections.md` (the CLAUDE.md fragment, same
     wording), `templates/new-issues.md:3,5`, `templates/audit-report.md:4`, and
     `playbook-setup` Step 4 prose ("RDPI commands will create artifacts",
     `playbook-setup.md:144`). These were scanned and confirmed to carry **no stale path
     reference** — they need no edit. Documented here so the implementer neither misses a
     real breakage nor over-edits generic prose.

**Success criteria:**
- `grep -rn 'templates/' .claude/skills/ CLAUDE.md README.md quickref.md` → every hit is
  `.claude/templates/` (no bare `templates/`).
- `grep -rn '\.claude/commands/' .claude/skills/` → no output.
- `grep -rn 'prompts/research-patterns-guide\|prompts/implement-codex-phase-brief\|\.claude/scripts/pipeline-eval' .claude/skills/`
  → no output (all repointed). Note the pipeline-eval pattern is anchored to the **stale**
  repo-relative path `.claude/scripts/pipeline-eval`; the new
  `${CLAUDE_SKILL_DIR}/scripts/pipeline-eval.sh` path also contains the substring
  `scripts/pipeline-eval`, so an unanchored pattern would false-positive on the correct
  result. The remaining valid references — `.claude/prompts/research-guide.md` and
  `.claude/scripts/codex-output-check.sh` — are expected to stay.
- `grep -rn '\.claude/commands/' README.md` → no output.

## Phase 3 — Apply the two body-level authorized behavioral changes

(The Axis 3 frontmatter flag was applied in Phase 1.)

1. **Axis 4 — shell-injection conversion.** In the 5 git-preloading skills (`commit`,
   `finish`, `issue-finish`, `push-pr`, `push-pr-light`), each has exactly two consecutive
   bare `!git …` lines. Convert each pair to one documented fenced injection block:

   ````
   ```!
   git status
   git diff
   ```
   ````

   (Use the actual two commands per file — `push-pr`/`push-pr-light` use `git status` +
   `git log --oneline -3`.)
2. **`codex-review` target resolution.** Replace the current no-target hard-stop (was
   `codex-review.md:5`, "If `$ARGUMENTS` is empty or blank, stop…") with the two-entry-mode
   behavior: (i) explicit target supplied → review it unchanged; (ii) no explicit target
   (auto-fired or bare `/codex-review`) → infer the target from conversational context;
   if genuinely ambiguous, ask one clarifying question rather than hard-stopping or
   guessing. This is the design-authorized consequence of `codex-review` being the one
   auto-invocable skill.

**Success criteria:**
- `grep -rn '^!' .claude/skills/` → no output (no bare line-start injection remains).
- `grep -rln '```!' .claude/skills/` → the 5 git-preloading skills.
- `codex-review/SKILL.md` no longer contains the "stop and tell the developer to re-invoke"
  hard-stop; it describes the two entry modes.

## Phase 4 — Relocate supporting assets

**Goal:** move only the genuinely-private assets and the whole `templates/` set; leave the
two shared assets in place. **This is the last file-work phase before the restart** — the
asset move is the single action that breaks the still-live original commands (their bodies
still point at the old paths), so it is deliberately ordered last to keep that broken-window
one phase wide. The new skills already carry the post-move references (Phase 2), so after
this move the skill surface is fully consistent.

Use `git mv` for all moves (preserves history):

1. `.claude/prompts/research-patterns-guide.md` → `.claude/skills/design/research-patterns-guide.md`
2. `.claude/prompts/implement-codex-phase-brief.md` → `.claude/skills/implement-codex/implement-codex-phase-brief.md`
3. `.claude/scripts/pipeline-eval.sh` → `.claude/skills/auto-issues/scripts/pipeline-eval.sh`
4. `templates/` (all 5 files: `audit-report.md`, `deferred.md`, `error-report.md`,
   `new-issues.md`, `playbook-sections.md`) → `.claude/templates/`
5. **Leave in place:** `.claude/prompts/research-guide.md` (shared by `research-codebase` +
   `issue-research`) and `.claude/scripts/codex-output-check.sh` (shared by 9 skills).

**Success criteria:**
- `ls .claude/templates/` → 5 files; `test -d templates` → fails (root `templates/` gone).
- `.claude/skills/design/research-patterns-guide.md`,
  `.claude/skills/implement-codex/implement-codex-phase-brief.md`, and
  `.claude/skills/auto-issues/scripts/pipeline-eval.sh` all exist.
- `ls .claude/prompts/` → only `research-guide.md`; `ls .claude/scripts/` → only
  `codex-output-check.sh`.

## Phase 5 — Static check, restart, verify, review, commit

1. **Static pre-restart completeness check** (same-name precedence means a half-ported skill
   instantly shadows its working command — verify completeness *before* the restart):
   - All 22 `SKILL.md` present and well-formed (frontmatter parses, body intact).
   - **Discipline preserved:** `grep -rc '</dev/null' .claude/skills/` totals **23**
     occurrences across the same 10 skills as the originals;
     `grep -rl 'run_in_background' .claude/skills/` lists the same 10 skills. Spot-check
     each long-running Codex / `claude -p` site survived the port intact.
2. **Restart Claude Code** (developer action — `.claude/skills/` is newly created this
   session, so skills are not discoverable until a restart). The plan **stops here** for the
   first `/implement` invocation; the post-restart session resumes Phase 5 from step 3
   (verify → Codex review → commit). **Whoever resumes must run the step 5 Codex review
   explicitly** — it does not fire automatically, because the halted `/implement` invocation
   never reached its own built-in review step.
3. **Verify** post-restart. **This plan refines the design's literal acceptance wording.**
   `tasks/design-decision.md:5` says each skill is "verified by invoking `/<name>`." A
   literal fire-everything sweep is unsafe — many skills mutate the repo — so verification
   is **tiered**, but it goes well beyond a single smoke test: every skill that can be
   exercised reversibly *is* exercised. Tiers:
   - **All 22 — structural verification (gating baseline):** the skill is discoverable in
     the post-restart skill registry; `/<name>` resolves to the new skill (same-name
     precedence over the original command); frontmatter parses; the body matches the source
     command modulo the three expected edit classes — the Phase 1 frontmatter block, the
     Phase 2 reference rewrites, and the Phase 3 behavioral changes. (Not byte-identical —
     Phase 2 intentionally rewrites references.)
   - **Tier A — direct invocation (read-only):** `codex-review`. Invoke `/codex-review` on a
     trivial target, confirm it runs end-to-end; this also exercises the Phase 3
     target-resolution rewrite.
   - **Tier B — bench invocation (local + reversible, 12 skills).** Exercise the skill
     against a disposable scratch bench — a throwaway test file, a simulated trivial task,
     or a simulated test issue — then reset the scratch state so the working tree returns to
     the verified port. Members: `create-todo`, `checkpoint`, `playbook-audit`, and the
     RDPI / issue skills (`research-codebase`, `design`, `create-plan`, `implement`,
     `implement-codex`, `issue-research`, `issue-plan`, `issue-implement`, `issue-update`)
     run against a simulated task / issue. **Artifact isolation (no worktree needed):** the
     RDPI / issue skills read and write singleton `tasks/*.md` state, and
     `/research-codebase` hard-stops if RDPI artifacts already exist
     (`research-codebase.md:17`). Before bench-running them, **temporarily rename this
     task's live RDPI artifacts** — `tasks/research-codebase.md`, `tasks/design-decision.md`,
     `tasks/plan.md` (and `tasks/todo.md` for the `create-todo` bench) — out of the way
     (e.g. add a `.bak` suffix) so the guards do not false-fire and the real artifacts are
     not clobbered; **restore them immediately after, including on a bench-test error.**
     **Bench depth is a judgment call:** the Codex-driven RDPI skills cost 10+ min per run,
     so a lighter exercise (invoke, confirm it loads and starts its first real step
     correctly, then abort before it writes or implements) is acceptable for those;
     `create-todo` and the cheap skills get a full run.
   - **Tier C — verified through real end-of-workflow use (9 skills).** `commit`, `push-pr`,
     `push-pr-light`, `catchup`, `finish`, `issue-finish`, `auto-issues`, `playbook-update`,
     `playbook-setup` push to the remote, merge `main`, open PRs, overwrite managed files, or
     edit `~/.claude`. (`commit` is in Tier C by developer choice: it **pushes** —
     `commit.md:12` — and although that push targets this task's own topic branch
     `worktree-todo-7`, so a bench run *would* be reversible via a force-push or a disposable
     scratch branch, the developer opted to verify `commit` through real use rather than
     stand up that isolation. A scoping choice, not a hard blocker.) These skills are not
     fired purely to test — the developer exercises them **manually** in the natural course
     of finishing this task and subsequent work, and that real use is their verification.
     The plan records this coverage but does not gate on it. (Developer-confirmed,
     2026-05-22.)
   - **Bench cleanup:** all Tier B scratch state (test files, test commits, simulated
     task / issue artifacts) is reset / removed and the renamed-aside artifacts restored
     before step 5, so the Codex review and the final single commit see only the port.
4. **Record OQ3 — explicit `tasks/todo.md` edits.**
   (a) Annotate the Deferred item at `tasks/todo.md:144` ("Enable skill auto-invocation") as
   **resolved — NO**, with a one-line rationale (side-effect workflow skills should stay
   manual-invoke; the Axis 6 artifact restructure was investigated and not pursued).
   (b) Correct the two known-false constraint lines — `tasks/todo.md:9` ("Skills default to
   `disable-model-invocation: true`") and `tasks/todo.md:16` ("Flipping
   `disable-model-invocation` to `false` … blocked on artifact restructure"). The real
   default is `false` (research Summary CORRECTION, `tasks/research-codebase.md:18`), and the
   Axis 3 decision is split-by-weight. Mark both lines **superseded** with a brief pointer to
   the Axis 3 outcome rather than deleting them — they sit in the board's active "Upstream
   constraints" / "Out of scope" sections, so leaving outright-false claims standing would
   mislead future work.
5. **Codex code review of the final skill surface.** `/implement`'s built-in flow is one
   cycle — execute → Codex code review → apply triaged fixes → commit — but this plan's
   restart boundary splits it: the first `/implement` invocation halts at step 2 (restart)
   before reaching its own review step. So run the review **explicitly here** — post-restart,
   over the settled `.claude/skills/` tree + moved assets + doc edits, after verification
   (step 3) and before the commit (step 6). Reviewing the pre-restart tree would be
   low-value (it is transient and unverified). Triage the findings and apply corrections.
   For a mechanical port the review is lighter-weight than for net-new logic — Phase 5
   step 1's static checks already cover frontmatter / reference / discipline correctness —
   but it must not be silently skipped.
   **Re-verification gate:** if the review applies *any* fix, the step 3 verification is now
   stale — re-run the affected step 1 static checks and Tier A / B exercises against the
   changed skills before proceeding to step 6. This mirrors `/implement`'s own post-review
   final-verification step (`implement.md` §9, "Final verification"). Do not commit on stale
   verification. (This is a sequencing change to the plan only — it touches no skill file.)
6. **Commit once** — a single conventional commit covering all of Phases 1–4 (including the
   Phase 4 `git mv` moves) plus any fixes applied by the step 5 review, after verification
   passes.

**Success criteria:**
- 22 skills listed in the post-restart skill registry.
- For each `/<name>`, the skill (not the shadowed original command) is what resolves.
- Tier A: `/codex-review` runs end-to-end on a trivial target.
- Tier B: every bench-tested skill ran against its scratch bench; the temporarily-renamed
  RDPI artifacts were restored and all scratch state reset (working tree shows only the
  port).
- Tier C: no automated gate — verification is the developer's manual end-of-workflow
  responsibility (developer-confirmed); the plan records this and does not block on it.
- `tasks/todo.md:144` Deferred item is annotated resolved-NO.
- Codex code review (step 5) completed, triaged fixes applied, and — if any fix landed — the
  affected checks re-run before the commit.
- `git status` clean after the final commit. (The step-6 commit is the **port commit only**;
  wrapping the task — `/finish`, push, PR — is the normal post-plan flow, out of this plan's
  scope. `/finish` makes its own commits, so it is not part of this plan's single-commit
  model.)

---

## Judgment Calls

1. **Two-pass port (Phase 1 verbatim → Phases 2–3 edits)** rather than writing each
   SKILL.md final-once. Chosen for reviewability: Phase 1 output diffs cleanly against the
   source commands, and Phases 2–3 become a small, auditable set of deliberate edits.
2. **Asset relocation is the last file-work phase (Phase 4)**, after reference edits
   (Phase 2) and behavioral edits (Phase 3). The asset move is the single action that breaks
   the still-live original commands; ordering it last shrinks the broken-originals window to
   one phase before the restart cutover. Reference edits land on the not-yet-live skill
   files first, so they cost the originals nothing. (An earlier draft moved assets first for
   "verify the target exists" convenience — reversed after the second Codex review flagged
   the avoidable interruption window.)
3. **Co-located assets referenced via `${CLAUDE_SKILL_DIR}/…`** rather than a repo-relative
   path. Per design Axis 2 — the cwd-independent, docs-sanctioned mechanism for assets
   bundled inside a skill directory.
4. **One commit after verification**, overriding `CLAUDE.md`'s per-phase-commit default.
   Forced by the restart boundary and mandated by design OQ1.
5. **Verification = a tiered matrix, refining the design's literal acceptance wording.**
   `tasks/design-decision.md:5` says "verified by invoking `/<name>`"; a literal
   fire-everything sweep is unsafe, so verification is tiered — but it exercises every skill
   that can be run reversibly, not just a single smoke test: structural verification for all
   22 (baseline); Tier A direct invocation (`codex-review`, 1 skill); Tier B bench invocation
   against disposable scratch state with the live RDPI artifacts temporarily renamed aside
   (12 skills — `create-todo`, the cheap skills, the RDPI/issue skills); Tier C — the 9
   genuinely destructive skills (`commit`, `push-pr`, `push-pr-light`, `catchup`, `finish`,
   `issue-finish`, `auto-issues`, `playbook-update`, `playbook-setup`) verified through real
   end-of-workflow use, which the developer confirmed is acceptable coverage. `commit` is
   Tier C because it pushes (`commit.md:12`). See Phase 5 step 3.
6. **Injection: consecutive bare `!git` lines → a single ```` ```! ```` fenced block** (vs.
   per-line inline `` !`git …` ``). Per design Axis 4's "multi-line groups → fenced blocks";
   all 5 files have exactly a 2-line group.
7. **OQ4 (global-install self-containment) — surfaced with one informational sentence.**
   The globally installed utility skills reference `error-report.md` by repo-relative path,
   which will not resolve outside a playbook workspace — pre-existing parity with today's
   global *commands*, not a regression. Codex's review judged a one-line caveat in the
   install offer worth the near-zero cost; adopted (Phase 2 item 5). It is informational
   prose, not a behavior change, so it stays inside the mechanical-port constraint.
8. **`playbook-update` managed-files list drops the old command paths** entirely rather than
   listing both commands and skills. The list names the live managed surface; the originals
   are unmanaged orphans pending the out-of-scope deletion pass.
9. **`/implement`'s Codex code review is repositioned to a named post-restart step** (Phase 5
   step 5) rather than left to `/implement`'s built-in placement. The restart boundary splits
   `/implement`'s execute→review→commit cycle — its built-in review would otherwise run
   against the transient pre-restart tree or be skipped entirely (the halted first invocation
   never reaches it). Pinning it as an explicit step makes it run on the settled, verified
   surface and guarantees it is not silently dropped.

## Risks folded into the plan

- **Transient broken pre-restart state.** Phase 4's asset moves break the still-live original
  commands; the new skills are not discoverable until restart. Mitigation: Phase 4 is ordered
  last (asset move is the only originals-breaking action, so the window is one phase wide);
  no commit and no restart until all of Phases 1–4 are done; "working state" is restored at
  the restart cutover and proven before the single commit (Phase 5). Pre-restart phase
  success criteria are deliberately static checks (file existence, grep), not "commands
  still run."
- **Half-ported skill shadows its command.** Mitigation: Phase 5 step 1 static completeness
  check gates the restart.
- **`/auto-issues` running stale logic.** Mitigation: Phase 2 item 3 repoints all 4
  child-spawn directives (including the doubled reference on old line 77) and instructs the
  child to follow the Markdown body, ignoring the SKILL.md YAML frontmatter.
- **Discipline regression** (`</dev/null`, `run_in_background`). No lint guards these.
  Mitigation: Phase 5 step 1 explicit count check (23 `</dev/null`, 10 `run_in_background`
  skills).
- **`implement-codex` SKILL.md > 500 lines.** Accepted — the limit is a soft Tip (design
  OQ2); splitting the body risks the no-behavioral-change constraint.
- **Codex code review silently skipped, or committed on stale verification.** The restart
  splits `/implement`'s execute→review→commit cycle, so its built-in review could fail to
  run; and a review that *does* run applies fixes after step 3's verification, leaving it
  stale. Mitigation: the review is a named, mandatory Phase 5 step (step 5) with its own
  success criterion; Phase 5 step 2 explicitly tells whoever resumes post-restart to run it;
  and step 5's re-verification gate re-runs the affected checks before the step 6 commit.
- **Tier B bench run clobbers this task's live artifacts.** The RDPI / issue skills read and
  write singleton `tasks/*.md`, and `/research-codebase`'s hard-stop would false-fire.
  Mitigation: Phase 5 step 3 Tier B temporarily renames the live RDPI artifacts aside before
  bench-running and restores them after — including on a bench-test error.

## Artifact references

- Research: `tasks/research-codebase.md`
- Design: `tasks/design-decision.md`
