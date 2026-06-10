# Design: `/codex-audit` skill — apply-policy and skill structure (Task 19)

## Context

Add a new standalone playbook skill `.claude/skills/codex-audit/SKILL.md` that runs a Codex subprocess checking a **target** (file / diff / artifact / description) against the **source(s)** it was built from, for **fidelity** (faithful restatement), **completeness** (load-bearing facts dropped), and **precision** (correct names / IDs / sections). This is the relational `target ↔ source` verification `/codex-review` structurally cannot do (review reads the target in isolation; audit verifies it against ground-truth source). `/codex-review` must stay byte-for-byte unchanged. The skill generalizes the hardwired Omakase `codex-source-audit.md` and is the hard dependency for `/forge` (task 21).

The work is Markdown-and-spec, not code: it merges `/codex-review`'s **plumbing** (target resolution, safe tmp-compose, `-a never --sandbox read-only`, `codex-output-check.sh`, cleanup-before-present, the "confidence is not evidence" caveat, the recursion guard) with Omakase's **relational/looped semantics** (source-vs-target checking, fidelity-defect vs judgment-call classification, the `review → triage → apply` loop where later passes read corrected state). "Generalizing" means replacing Omakase's three hardwired things — fixed source paths, baked-in lineage lenses, fixed 3× pass count — with Claude-composed, per-target equivalents.

**Research:** `tasks/research-codebase.md`

Of the 9 design axes in research, eight are settled by constraint or precedent (see below). The single contested decision is **Axis 4 — apply policy**. The options differ only on Axis 4; every other axis choice is shared.

### Settled axes (shared by all options)

| Axis | Choice | Why |
|---|---|---|
| 1 — Target resolution | **B** mirror `/codex-review` (explicit `$ARGUMENTS` else infer, ask once if ambiguous) | Convention-consistency; higher edit-cost mitigated by the one-question fallback. |
| 2 — Source injection | **C** hybrid (list on-disk source paths + embed Claude-composed excerpts for chat-only/non-file context) | Spec allows chat-only sources → path-list-only would leave Codex blind. |
| 3 — Secondary lenses | **A** always-on core (fidelity/completeness/precision) + Claude-filled free-form secondary block; lineage/supersession is a *conditional secondary* lens, only when sources carry a supersession order | No fixed menu (anti-pattern). Keeps core minimal and general (resolves OQ3). |
| 5 — Apply mechanism | **A** inline parent-session edits | Issue #7 is removing child-apply; `/issue-implement` + Omakase both inline; no fix-tmp to hand a child. |
| 6 — Triage vocabulary | **A** Codex emits `fidelity defect` / `judgment call`; Claude maps to apply / judgment-call / noise | Both live precedents use it; avoids pre-committing to task-13's `A.1/A.2/B/C` before task 13 lands (resolves OQ5). |
| 7 — Codex flags | **A** mirror `/codex-review` exactly (`-a never exec --sandbox read-only`); **not** `--search`. `xhigh` is optional, added only if the implementer accepts the latency/token cost | AC5 pins the flag set; sources are local/injected so no web. (Codex cross-check: xhigh is not load-bearing — default to the exact sibling flags.) |
| 8 — Temp-file location + naming | **Gitignored `tasks/logs/audits/`** + per-pass output names carrying a per-run-unique token, e.g. `tasks/logs/audits/<run>-prompt.tmp` and `tasks/logs/audits/<run>-<i>.tmp` (token is a literal Claude fixes once, **not** a bare `$$` — `$$` is not stable across separate Bash tool calls). | Multi-pass needs per-pass-distinct outputs; a per-run-unique token avoids concurrency collisions. **Developer decision (2026-06-10): write under the already-gitignored `tasks/logs/` tree (`.gitignore:6`) in a dedicated `audits/` subdir, not the tracked `tasks/` root.** This makes the no-committed-artifact boundary structural (git can't see the temps) rather than dependent on cleanup discipline, neutralizes issue #6's "orphaned `.tmp`" concern for this skill by construction, and aligns with the sibling `/codex-research` (task 20 → `tasks/logs/research/`) and the checkpoint redesign (tasks 17/18 → `tasks/logs/checkpoints/`). Temps are still deleted on every exit path (disk hygiene). Supersedes the earlier "mirror `/codex-review`'s tracked-root `tasks/codex-audit-$$-<n>.tmp`" reading; resolves OQ6 and is forward-compatible with issue #6's eventual cross-skill generalization. |
| 9 — Discoverability docs | **B** AC7 managed-list entry **plus** README.md + quickref.md rows | AC7 requires the managed list; README/quickref are cheap, obviously-correct (resolves OQ7). |

### Cross-cutting constraint surfaced by Codex cross-check: editable-target guard

AC4 requires the next pass to read **corrected on-disk state**. But the target may be a chat-only `"description"` (per the `argument-hint`), which has no on-disk file to edit and re-read. Therefore: **`passes > 1` requires an on-disk, editable target.** If the target does not map to a file (chat-only description, or a diff/artifact with no writable backing), multi-pass is meaningless — the skill must either run a single recommend-only pass or stop and ask for an editable target. Both options must honor this; it is folded in below (it is not an apply-policy difference). This was missed by the initial options and added from Codex's Phase-2 cross-check.

### Option 1 — Passes-coupled apply *(Axis 4 = C)*

**How it works.** `passes` defaults to 1. A **single pass is recommend-only** — Codex audits, Claude presents findings and offers opt-in triage, but never writes the target (identical end-behavior to `/codex-review`). When `passes > 1`, the skill **applies** verified fidelity-defects inline between iterations, then regenerates the prompt with a fresh `## ALREADY APPLIED` + `## OPEN QUESTIONS` block so pass N+1 reads corrected on-disk state. `passes` is capped (≤5, resolves OQ4). No separate `--no-apply` flag: `passes=1` *is* the preview/no-write mode, so the escape hatch already exists as the default.

- **Good:** Lowest single-pass blast radius — the default invocation never surprises the user with edits, matching the dominant playbook pattern (`/codex-review` is recommend-only). Satisfies AC4 **as OQ1 resolves it** — OQ1 (`todo.md:425`) names single-pass-recommend-only as the candidate resolution and asks RDPI to "Confirm"; the loop body that runs on an apply iteration *is* `review → triage → apply`, and `passes=1` is the documented recommend-only default. Most reversible: the user can always run `passes=1` to preview before committing to a looped apply. The recommend/apply split falls out of one conditional. **Degrades gracefully on the editable-target guard:** a chat-only/non-file target naturally runs as a single recommend-only pass — exactly the right behavior when there's nothing on disk to correct.
- **Not:** One conditional branch in the apply step (single-pass vs multi-pass behavior diverges), so the skill prose must clearly document two modes. A user who wants a one-shot *fix* must pass `2` (or higher) to trigger applying — single-pass-with-apply is not directly expressible. The literal AC4 wording ("each pass is `review → triage → apply`") must be reconciled in the SKILL.md prose so an AC-checker sees `passes=1` as the OQ1-confirmed recommend-only default, not a skipped step.
- **Coupling honored:** Axis 4=C ↔ Axis 5=A ↔ `passes`: when `passes>1`, policy cannot be recommend-only (AC4) and mechanism must be inline. This is the natural resolution of the core coupling (research §Axis Coupling).

### Option 2 — Apply-always *(Axis 4 = B)*

**How it works.** Every pass — including a single pass — applies verified fidelity-defects inline (Omakase's contract). `passes` still controls iteration count, but there is no behavioral branch on its value: pass 1 applies, pass 2 applies, etc. Presentation reports *what was applied* (done, not proposed) on every run.

- **Good:** Simplest control flow — no recommend-vs-apply branch, one uniform loop body. Conceptually closest to the Omakase prior art it generalizes. `passes` becomes purely "how many refinement rounds," not a mode switch.
- **Not:** A single `/codex-audit` invocation silently edits the target by default — the highest-stakes risk in research (§Risk: "surprising side-effecting command"). Diverges from the playbook's recommend-only convention for standalone target-reading Codex tools. Less reversible: there is no zero-write invocation; every run mutates unless the user remembers an opt-out. To make it safe you must *add* a `--no-apply`/`--dry-run` flag — which re-introduces the branch Option 1 already has, but with the unsafe default (so its "simpler uniform loop" edge largely evaporates once made safe). **Handles the editable-target guard worse:** apply-always has nothing to apply for a chat-only/non-file target, so it needs an explicit special-case (vs Option 1, where the default single recommend-only pass already covers that case).
- **Coupling honored:** Axis 5=A inline; satisfies AC4 trivially (every pass applies).

### Option 3 — Recommend-only-always *(Axis 4 = A)* — **ruled out, not viable**

Never writes the target; multi-pass would re-audit while Claude annotates progress only in-prompt. **Excluded by AC4**, which requires "each pass `review → triage → apply`" with "next pass seeing corrected **on-disk** state." Without applying, pass N+1 reads the same uncorrected target and re-finds the same defects — the loop cannot converge. In-prompt-only annotation is explicitly not "corrected on-disk state." Listed for completeness; not carried as a real contender (per research §Axis 4, this violates AC4 when `passes>1`).

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)
- [x] **Apply policy (OQ1):** Option 1 (passes-coupled, recommend single / apply multi) vs Option 2 (apply-always). **Resolved → Option 1** in `## Decision` below (Codex independently favored Option 2; rationale for choosing Option 1 anyway is in the Decision).

### Non-blocking (can resolve during implementation)
- [x] **Editable-target guard (from Codex cross-check):** `passes > 1` requires an on-disk editable target; a chat-only/non-file target runs as a single recommend-only pass or stops and asks. Folded into both options as a cross-cutting constraint above.
- [ ] **Argument-parsing rule (OQ2):** the last whitespace token is `passes` iff it parses as a small positive int **and** a non-empty target remains after removing it; otherwise it is part of the target. Validate `passes` as a positive int (reject 0/negative). Document an escape (quote the target). Folds into both options identically. (Codex Phase-2 confirmed this rule, adding "and within the cap.")
- [ ] **Passes cap (OQ4):** small max-pass guard (lean ≤5) to stop `/codex-audit x 99`. Applies to both options. (Codex confirmed ≤5.)

## What We're NOT Doing

- **Not** modifying `/codex-review` in any way (AC6 — byte-for-byte unchanged). `/codex-audit` is additive; shared plumbing is copied, never factored out of the sibling.
- **Not** copying Omakase's literals — fixed source paths, the fp-rebuild lineage table, the baked-in 3× loop. Those become Claude-composed/per-target.
- **Not** copying Omakase's plumbing gaps — its invocation lacks `-a never` and never runs `codex-output-check.sh`. Plumbing comes from `/codex-review`.
- **Not** reusing `.claude/templates/audit-report.md` — it belongs to `/playbook-audit`; `/codex-audit` produces no persistent artifact (only target edits when policy applies).
- **Not** solving issue #6's cross-skill unique-naming generalization here — use per-run-unique names locally and let #6 generalize across all Codex skills. (The gitignored `tasks/logs/audits/` location does *locally* neutralize issue #6's "orphaned `.tmp` gets committed" concern for `/codex-audit` by construction, but the broader fixed-name collision across the five sibling skills remains #6's job.)
- **Not** adopting task-13's `A.1/A.2/B/C` triage vocabulary yet — `/triage` is not on disk; inline apply/judgment-call/noise.
- **Not** spawning sub-agents (recursion guard, carried from both precedents).
- **Not** editing source docs — sources are ground truth; only the target may be written.

## Decision

**Chosen approach:** **Option 1 — Passes-coupled apply** (single pass recommend-only; `passes > 1` applies verified fidelity-defects inline between iterations), **plus two refinements absorbed from the Codex cross-check**: (a) the **editable-target guard** — multi-pass requires an on-disk editable target, and a chat-only/non-file target runs as a single recommend-only pass; (b) **per-run-unique tmp names**, and — **per the 2026-06-10 developer decision (Axis 8)** — those temps live under the **gitignored `tasks/logs/audits/`** subdir (e.g. `tasks/logs/audits/<run>-<i>.tmp`), not the tracked `tasks/` root, with a literal run-token in place of `$$`. All other axes per the settled-axis table.

**Rationale.**
- **Patterns (heuristic 1) → Option 1.** Within the playbook, the closest sibling — `/codex-review`, the explicit convention source for this skill's plumbing — is recommend-only. The dominant pattern for a standalone, manually-invoked, target-reading Codex tool is "show me, don't silently rewrite." Omakase's apply-by-default is precedent from a *different* codebase. The skill's `disable-model-invocation: true` is justified by the fact that it *may* edit (constraint `todo.md:401` — "may edit the target"), which Option 1 fully satisfies via its multi-pass apply; it does not require single-pass edits.
- **Simplicity (heuristic 2) → roughly even, slight Option 1.** Option 2's uniform loop is marginally simpler in isolation, but its silent-edit default is a footgun; making it safe means adding a `--no-apply`/`--dry-run` flag, which re-introduces a branch *and* an extra argument. Option 1 gets the safe default and the apply capability from one conditional with **no extra flag** — `passes=1` *is* the dry run.
- **Reversibility (heuristic 3) → Option 1.** The default invocation never writes, so the user can always preview before committing to a looped apply.
- **The editable-target guard reinforces Option 1.** A chat-only/non-file target has nothing to correct on disk; Option 1 degrades to a single recommend-only pass automatically, while Option 2 needs a special-case to avoid an impossible apply.

**On the Codex cross-check.** Codex independently converged on Option 2 (apply-always) as its base and recommended it "better than all proposed options as written." Its load-bearing argument was a `CORRECTION` that Option 1 violates AC4 ("each pass is `review → triage → apply`", default 1). On verification against the source, this is **overstated, not a violation**: OQ1 (`todo.md:425`) explicitly names single-pass-recommend-only as the candidate resolution and asks RDPI to "Confirm" — the spec delegates exactly this decision here, so reading AC4 in isolation as settled is the error. Codex's confident Phase-3 phrasing is expected output of the recommend-assertively prompt, not evidence. Where Codex *did* move the design: its two substantive findings — the editable-target guard and per-run-unique tmp naming — were both correct, were absorbed above, and both happen to **strengthen Option 1** rather than Option 2. Net: the cross-check sharpened the design without changing the winner.

**Implementation footprint (unchanged by the decision):** two required files — create `.claude/skills/codex-audit/SKILL.md`, and add that path to the enumerated managed list in `.claude/skills/playbook-update/SKILL.md` adjacent to line 31 (AC7). README.md / quickref.md rows are cheap, non-AC polish (Axis 9).
