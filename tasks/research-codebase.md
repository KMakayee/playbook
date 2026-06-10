# Research: Add `/codex-audit` skill — source-grounded fidelity + completeness audit (Task 19)

## Research Question

**Goal.** Add a new standalone playbook skill, `/codex-audit` (`.claude/skills/codex-audit/SKILL.md`), that runs a Codex subprocess checking a *target* (file / diff / artifact / description) **against the source(s) it was built from** for **fidelity** (faithful restatement of what the source means), **completeness** (load-bearing facts the target dropped), and **precision** (correct names / IDs / sections). This is the relational `target ↔ source` verification that `/codex-review` structurally cannot do — `/codex-review` reads the target in isolation and critiques its merit, so it only catches what is *present and wrong*, never what is *absent* relative to a ground-truth source. `/codex-audit` is the sibling that fills that gap (review = opinion on merit; audit = verification against source). `/codex-review` must stay byte-for-byte unchanged. Prior art is the Omakase `codex-source-audit.md`, which proves the looped source-fidelity pattern but is hardwired to one doc set (fp-rebuild); this task generalizes it. Downstream, `/codex-audit` is the hard critical-path dependency for `/forge` (task 21), whose fidelity gate needs exactly this capability.

### Upfront spec (four-field intake — all supplied explicitly in task 19)

- **Intent.** Create `.claude/skills/codex-audit/SKILL.md` — a Codex pass checking a target against its source(s) for fidelity, completeness, and precision. The relational check `/codex-review` can't do. `/codex-review` stays as-is. Generalizes the hardwired Omakase `codex-source-audit.md`.
- **Constraints (firm, pre-RDPI-settled).**
  - Standalone skill: no persistent artifact, reads no RDPI prerequisites — same boundary as `/codex-review`. Distinct from `/code-review` / `/security-review` PR workflows.
  - Sources are **Claude-injected**, never a user CLI argument — Codex (`codex exec`) can't see the chat, so Claude composes the source(s) into the prompt. Confirm with developer only when the source of truth is genuinely ambiguous.
  - Lenses are **derived per-target by Claude**, never a fixed menu. Structure = always-on **core** (fidelity, completeness, precision) + Claude-composed **secondary** lenses. The prompt may offer *example* lens sets but must never present "pick a lens."
  - **No hardcoded loop.** Default = single pass; looping opt-in via a `passes` argument (replaces the fork's baked-in 3×).
  - **Manual invocation** (`disable-model-invocation: true`) — it's a side-effecting workflow skill (may edit the target).
- **Acceptance criteria.** (1) skill exists with frontmatter, `disable-model-invocation: true`, `argument-hint: '[file | diff | artifact | "description"] [passes]'`; (2) composed prompt runs the relational fidelity+completeness+precision audit, NOT the three-lens merit review; (3) lenses derived per-target, example sets only, no fixed menu; (4) `passes` parsed from trailing integer, default 1, each pass `review → triage → apply` with next pass seeing corrected on-disk state; (5) reuses established Codex plumbing (safe tmp-compose, `codex -a never exec --sandbox read-only`, `codex-output-check.sh`, cleanup-before-present); (6) `/codex-review` unchanged; (7) `/playbook-update` managed-file list accounts for the new skill.
- **Relevant paths.** New: `.claude/skills/codex-audit/SKILL.md`. Prior art: `~/Projects/Omakase/omk-core/.claude/commands/codex-source-audit.md`. Conventions: `.claude/skills/codex-review/SKILL.md`, `.claude/scripts/codex-output-check.sh`. Managed list: `.claude/skills/playbook-update/SKILL.md`. Related: task 13 `/triage` (inline its bucket logic — not yet on disk).

## Summary

This is a **two-file required change** plus optional discoverability polish: create `.claude/skills/codex-audit/SKILL.md`, and add that path to the **enumerated** managed-file list in `playbook-update/SKILL.md` (AC7). README.md / quickref.md updates are nice-to-have, not in the ACs.

The skill is a near-merge of two existing precedents: it inherits **all the plumbing and presentation conventions from `/codex-review`** (target resolution, safe tmp-compose, `-a never --sandbox read-only` invocation, `codex-output-check.sh`, cleanup-before-present, "Codex confidence is not evidence," sub-agent recursion guard) and inherits the **relational/looped audit semantics from Omakase `codex-source-audit.md`** (source-vs-target checking, fidelity-defect vs judgment-call classification, the `review → triage → apply` loop with later passes seeing corrected state). The work of "generalizing" is: replacing the Omakase command's *three hardwired things* — fixed source paths, baked-in lineage lenses, fixed 3× pass count — with **Claude-composed, per-target** equivalents (injected sources, derived secondary lenses, a `passes` argument defaulting to 1).

The genuinely contested design space is small and almost entirely internal to the skill's instructions (it's Markdown + spec, no code). The **single most important open decision** is the **apply policy** — does a single pass *recommend* (like `/codex-review`) or *apply* (like Omakase)? The task's own #1 OQ proposes coupling it to `passes` (multi-pass *must* apply so pass N+1 reads corrected state; single pass *could* default to recommend-only). Codex folded this into its "apply mechanism" axis; this synthesis splits them apart because **policy** (recommend vs apply) and **mechanism** (inline vs child) are independent decisions, and mechanism is already steered to *inline* by issue #7.

**No external research is required** — every axis is evaluable from the spec + local playbook/Omakase precedent. Codex confirmed this and I concur; there is no library/API/protocol viability question anywhere in the decision tree.

## Detailed Findings

### `/codex-review` — the convention source (`.claude/skills/codex-review/SKILL.md`)
The skill `/codex-audit` should structurally clone. Verified line-by-line during reading:
- **Frontmatter (lines 1-6):** `name`, `description`, `argument-hint`, `when_to_use` — **no `disable-model-invocation`**, so it is auto-invocable. This is the key contrast: `/codex-review` is read-only on the target (recommend-only, never writes files), so auto-firing is safe. `/codex-audit` *may edit the target*, so it must be `disable-model-invocation: true` (AC1, and consistent with the [[feedback_skill_manual_invocation]] convention — side-effecting workflow skills stay manual).
- **Target resolution (lines 12-17):** two modes — explicit `$ARGUMENTS`, else infer from conversation; ask one clarifying question only if genuinely ambiguous. Directly reusable for `/codex-audit`'s target (the *source* resolution is the new, additional concern).
- **Safe tmp-compose (lines 33-63):** write the prompt body to `tasks/codex-review-prompt.tmp`, then `"$(cat ...)"` — avoids shell-quoting hazards when the target contains quotes/backticks/newlines. Mandatory pattern (AC5).
- **Codex invocation (lines 65-76):** `codex -a never exec --sandbox read-only -o <out> "$(cat <prompt>)" </dev/null`, run with the Bash tool's `run_in_background: true`. AC5 pins exactly this flag set.
- **Output verification + confidence caveat (lines 78-84):** `bash .claude/scripts/codex-output-check.sh <out> 5`; "Codex's confidence is not evidence" — weigh findings on merit, not assertiveness. Carry this caveat into `/codex-audit` verbatim.
- **Cleanup-before-present (lines 86-94):** delete temp files *before* the user-facing turn, because the turn ends in an interactive prompt — late cleanup would strand temps on an unanswered offer.
- **Recommend-only presentation (lines 96-128):** present raw findings → offer opt-in triage → on accept, label apply/judgment-call/noise, collapse noise to a count, **never auto-apply**. This is the recommend-only end of the apply-policy axis.

### Omakase `codex-source-audit.md` — the relational/looped semantics to generalize
- **Hardwired sources + lenses (lines 38-69):** fixed three fp-rebuild docs, a baked-in lineage/supersession table, and per-step "lanes." **This is exactly what must become Claude-composed per-target.** Do not copy these literals.
- **Classification (lines 76-95):** every finding cites *source file:line* next to the *target entry ID it contradicts* — "no citation → downgrade to judgment-call or drop." Two buckets: `fidelity defect` (clear, verifiable against source → apply) vs `judgment call` (ambiguous → carry, don't auto-apply). "When target and source conflict, source wins."
- **`review → triage → apply` loop (lines 99-122):** Codex runs, Claude triages+applies verified defects to the target *immediately*, then **regenerates** the prompt with a fresh `## ALREADY APPLIED` + `## OPEN QUESTIONS TO MATURE` block so pass N+1 reads corrected on-disk state and hunts what earlier passes missed. AC4 mirrors this exactly. Critical detail: **regenerate, never append** — appending leaks stale pass-1 state into pass-3.
- **Apply-by-default presentation (lines 132-140):** reports *what was applied* (done, not proposed) + a short "needs your input" survivor list + noise as a count. This is the apply end of the apply-policy axis.
- **Plumbing gaps to NOT copy (line 108):** the Omakase invocation lacks `-a never` and never runs `codex-output-check.sh`. Codex flagged this; verified. `/codex-audit` must use the playbook's hardened plumbing, not Omakase's.

### `/playbook-update` managed list (`.claude/skills/playbook-update/SKILL.md:15-53`)
The list is **enumerated, not globbed** — each skill path is spelled out (`/codex-review` is line 31). AC7 therefore requires literally adding `.claude/skills/codex-audit/SKILL.md` to this list. Without it, `/playbook-update` will treat an installed `codex-audit` as a local addition (line 120: "exists in project but not in latest → do nothing") and never propagate upstream changes.

### Triage bucket logic must be **inlined** (task 13 `/triage` not yet on disk)
Verified: `.claude/skills/triage/` does not exist. Playbook skills **cannot programmatically invoke another slash command** (`checkpoint/SKILL.md:180`), so even once task 13 lands, "reuse `/triage`" means *inline its bucket logic*, with the `/triage` skill as the reference spec — not a runtime call. The two existing inline-triage references:
- `/codex-review` Step 6 (lines 110-122): apply / judgment-call / noise.
- Omakase `codex-source-audit` Step 3 (lines 113-116): fidelity-defect → apply; judgment-call/boundary/open-question → carry; noise → drop.
- (`/implement` Step 7, `implement/SKILL.md:112-141`, uses Fix/Skip/Flag, but writes a fix-instruction tmp for a *child process* — a mechanism being deprecated, see issue #7.)

### Name-collision caught (Codex missed this)
`.claude/templates/audit-report.md` exists and is in the managed list — but it is the **output template for `/playbook-audit`** (a config health-check skill: `disable-model-invocation: true`, writes `tasks/audit-report.md`). It has **nothing to do with `/codex-audit`**, which (like `/codex-review`) produces **no persistent artifact**. Design must not reach for this template by name association. Codex's sweep did not surface this collision.

## Code References
- `.claude/skills/codex-review/SKILL.md:1-6` — frontmatter shape; absence of `disable-model-invocation` = auto-invocable (the contrast point).
- `.claude/skills/codex-review/SKILL.md:12-17` — target resolution (explicit vs inferred).
- `.claude/skills/codex-review/SKILL.md:33-76` — safe tmp-compose + `-a never --sandbox read-only` invocation.
- `.claude/skills/codex-review/SKILL.md:78-94` — output-check, confidence caveat, cleanup-before-present.
- `.claude/skills/codex-review/SKILL.md:96-128, 135` — recommend-only triage + sub-agent recursion guard.
- `~/Projects/Omakase/omk-core/.claude/commands/codex-source-audit.md:38-69` — hardwired sources/lenses (the thing to generalize).
- `~/Projects/Omakase/omk-core/.claude/commands/codex-source-audit.md:76-95` — classification + citation contract.
- `~/Projects/Omakase/omk-core/.claude/commands/codex-source-audit.md:99-140` — review→triage→apply loop + apply-by-default presentation.
- `.claude/scripts/codex-output-check.sh:8-22` — existence + min-lines gate (weak substance check only).
- `.claude/skills/playbook-update/SKILL.md:15-53` — enumerated managed-file list (AC7 target).
- `.claude/skills/research-codebase/SKILL.md:43-72` — second safe-tmp/Codex precedent (uses `-c model_reasoning_effort=xhigh --search`).
- `.claude/skills/implement/SKILL.md:112-156` — Fix/Skip/Flag triage + child-process apply (deprecating per issue #7).
- `.claude/skills/issue-implement/SKILL.md:121-160` — inline-apply precedent (no child process).
- `tasks/new-issues.md:164-203` — issue #6: fixed tmp-names collide on concurrent runs; explicitly names `/codex-audit`.
- `tasks/new-issues.md:205-229` — issue #7: deprecate `--dangerously-skip-permissions` child apply → inline apply in parent.
- `.claude/templates/audit-report.md:1-4` — `/playbook-audit`'s artifact template (name collision; NOT for `/codex-audit`).
- `README.md:76`, `quickref.md:49` — `/codex-review` listed; `/codex-audit` absent (Axis 9).

## Architecture Analysis
- **Why two sibling Codex tools instead of one.** A blind pass over a target can critique merit but cannot see omissions — absence is invisible without the source. So review (merit, target-only) and audit (fidelity, target↔source) are *structurally* different passes, not modes of one command. This is the load-bearing rationale and should be stated up front in the skill.
- **Why `/codex-review` auto-fires but `/codex-audit` is manual.** The split tracks side-effects, not topic: `/codex-review` never writes the target (recommend-only), so auto-invocation is safe; `/codex-audit` may *edit* the target, so it stays manual per [[feedback_skill_manual_invocation]]. Same reasoning that keeps `/playbook-update`, `/playbook-audit`, and the implement/plan skills manual.
- **Why the apply mechanism is settling to *inline*.** Three convergent signals: (a) issue #7 is actively ripping the `claude -p --dangerously-skip-permissions` child out of `/implement`/`/implement-codex` because the parent already holds context and the child re-reads cold + bypasses permissions; (b) `/issue-implement` already applies inline with no child; (c) `/codex-audit` is *standalone with no persistent artifact*, so there is no fix-instruction tmp to hand a child anyway. The Omakase prior art also applies inline. Mechanism is effectively decided; the *policy* (whether to apply at all on a single pass) is the live question.
- **The loop's regenerate-not-append discipline** is the subtle correctness invariant inherited from Omakase: each pass's prompt carries one fresh current-state block, or stale state leaks forward.

## Design Axes

### Axis 1: Target resolution
- **Choices:** (A) require an explicit target, stop if blank (Omakase style); (B) mirror `/codex-review` — explicit `$ARGUMENTS` else infer from conversation, ask one question only if ambiguous.
- **Per-axis constraints:** target is separate from sources (sources are never a user arg). Because the skill may *edit* the target, the cost of guessing wrong is higher than for `/codex-review`.
- **Evidence:** `codex-review/SKILL.md:12-17` (infer); `codex-source-audit.md:7` (require). **Lean (B)** for convention-consistency, with the higher edit-cost as the only reason to consider (A).

### Axis 2: Source injection (the genuinely new mechanism)
- **Choices:** (A) prompt lists on-disk source *paths* for Codex to open; (B) prompt *embeds* source excerpts/full text (for chat-only or non-file sources); (C) hybrid — list disk paths + Claude-composed excerpts for non-file context.
- **Per-axis constraints:** the Codex subprocess cannot see the chat, so Claude must inject the source set into the prompt; if the source of truth is ambiguous, confirm with the developer (constraint, not a guess).
- **Evidence:** `codex-source-audit.md:38-43` (path-list precedent). The constraint that sources may be *chat-only* (spec) means path-list-only is insufficient in general → hybrid (C) is the robust default. **Lean (C).**

### Axis 3: Secondary-lens structure (core is fixed)
- **Choices:** (A) always-on core (fidelity/completeness/precision) + a Claude-filled free-form secondary-lens block; (B) core + named *authority rules* the secondary block can carry (e.g., lineage / newest-wins, or "code is authority for current-state claims"); (C) core-only when no target-specific secondary lens is justified.
- **Per-axis constraints:** core is always on; **no fixed menu** — examples may inspire, must never ask the user to "pick a lens" (explicit anti-pattern, out of scope). (A) and (B) are not exclusive — (B) is really "what *kinds* of secondary lenses the prompt illustrates."
- **Evidence:** `codex-source-audit.md:55-69` (lineage/boundary lenses as the fp-rebuild secondary set — the thing being generalized into examples). The **lineage/supersession lens is a specific OQ** (see Open Questions): core, or conditional-secondary? Task lean: secondary, conditional on the sources carrying a supersession order.

### Axis 4: Apply **policy** (recommend-only vs apply-by-default) — *the central decision; Codex bundled this into mechanism*
- **Choices:** (A) recommend-only always (like `/codex-review` — never writes the target); (B) apply-by-default always (like Omakase — applies verified fidelity-defects); (C) **couple to `passes`** — single pass defaults to recommend-only, multi-pass (`passes > 1`) *must* apply between iterations (so pass N+1 reads corrected state), with an optional explicit `--no-apply` escape.
- **Per-axis constraints:** AC4 says each pass is `review → triage → apply` and the next pass sees corrected on-disk state — which *forces* apply when `passes > 1`. Only *fidelity-defects* may ever auto-apply; judgment-calls/boundary-notes never do. Edits confined to the target; sources never edited.
- **Evidence:** task 19 OQ #1 (proposes the `passes`-coupling); `codex-review/SKILL.md:124` (recommend-only contract); `codex-source-audit.md:140` (apply-by-default contract). **Lean (C)** — it is the only choice consistent with AC4's "next pass sees corrected state" *and* preserves a low-blast-radius single-pass default. Decide whether `--no-apply` is needed.

### Axis 5: Apply **mechanism** (largely settled)
- **Choices:** (A) inline parent-session edits; (B) parent-triages / child-applies via `claude -p --dangerously-skip-permissions`.
- **Per-axis constraints:** no persistent artifact (so no fix-instruction tmp to hand a child); next pass must read the corrected target.
- **Evidence:** issue #7 (`new-issues.md:205-229`) is *removing* (B) from the implement skills as unsafe/lower-quality; `issue-implement/SKILL.md:152` applies inline; Omakase applies inline. **Effectively decided: (A) inline.** Listed for completeness; not a live debate.

### Axis 6: Triage bucket vocabulary
- **Choices:** (A) Codex emits `fidelity defect` / `judgment call`; Claude maps to apply / judgment-call / noise (matches both precedents *today*); (B) adopt the future `/triage` `A.1 / A.2 / B / C` vocabulary inline now.
- **Per-axis constraints:** `/triage` doesn't exist and can't be invoked — vocabulary must be inlined either way. Carry the "Codex confidence is not evidence" caveat into the triage step.
- **Evidence:** `codex-source-audit.md:76`, `codex-review/SKILL.md:110`; task 13 spec at `todo.md:25, 68` (prefers `A.1/A.2/B/C`). **Lean (A)** for now (both live precedents use it; avoids pre-committing to task-13 naming before task 13 lands); revisit when task 13 standardizes the vocabulary.

### Axis 7: Codex flags
- **Choices:** (A) mirror `/codex-review` exactly — `codex -a never exec --sandbox read-only`; (B) add `-c model_reasoning_effort=xhigh`; (C) add `--search`.
- **Per-axis constraints:** AC5 pins `-a never exec --sandbox read-only`. Sources are injected/local, so web access is not needed → `--search` is unjustified.
- **Evidence:** `research-codebase/SKILL.md:64`, `create-plan/SKILL.md:63` (xhigh for heavy sweeps); `design/SKILL.md:207` (`--search` reserved for external research). **Lean (A), optionally +xhigh (B)** for audit depth; **not (C).**

### Axis 8: Temp-file naming
- **Choices:** (A) fixed names (like `/codex-review`); (B) fixed prompt + per-pass outputs (Omakase `codex-audit-${i}.tmp`); (C) per-run-unique names (PID / timestamp / target-hash suffix).
- **Per-axis constraints:** must keep safe tmp-compose, output-check, cleanup-before-present. **Known active defect:** issue #6 (`new-issues.md:164-203`) says fixed names collide on concurrent runs and *explicitly names `/codex-audit`*, preferring a fix that generalizes across all Codex skills.
- **Evidence:** issue #6; multi-pass requires at least per-pass output names → (B) minimum. **Lean (B) now** (per-pass, matching siblings) and let issue #6 deliver the unique-naming generalization across all Codex skills — but (C) is worth considering if implementing #6's fix here first is cheap. Don't solve #6 inside this task unless trivial.

### Axis 9: Discoverability docs (minor)
- **Choices:** (A) required only — add to `/playbook-update` managed list (AC7); (B) also add `/codex-audit` rows to README.md and quickref.md utility tables.
- **Per-axis constraints:** AC7 names only `/playbook-update`; README/quickref are out-of-AC polish.
- **Evidence:** `README.md:76`, `quickref.md:49` (codex-review listed, codex-audit absent). **Lean (B)** as a cheap, obviously-correct addition, but it's not blocking.

## Axis Coupling
- **Axis 4 (policy) ↔ Axis 5 (mechanism) ↔ `passes`:** if `passes > 1`, policy *cannot* be recommend-only (AC4 requires corrected state between passes) and mechanism must be inline-apply. This is the core coupling — it's why Axis 4 = (C) `passes`-coupled is the natural resolution.
- **Axis 2 (source injection):** if a source is chat-only / not on disk → Axis 2 narrows to (B) embed or (C) hybrid; path-list-only (A) would leave Codex blind. Confirmed by the spec's "sources may be chat-only" framing.
- **Axis 1 (target) → Axis 2 (source):** if the target is *inferred* (Axis 1=B), the sources likely also need inference/confirmation → Axis 2 must handle inferred sources or ask one clarifying question.
- **Axis 8 (naming) ↔ passes:** multi-pass needs per-pass-distinct output names (rules out naive single-fixed-output); if Axis 8=(C) unique, every output-check/read/cleanup line must thread the generated names consistently.
- **Axis 6 ↔ task 13:** if (B) `A.1/A.2/B/C` is chosen, the skill must define those buckets inline because `/triage` is absent — extra prose cost with no runtime backing yet.

## Cross-Cutting Constraints
- Frontmatter must include `name`, `description`, `argument-hint` (exactly `'[file | diff | artifact | "description"] [passes]'`), and `disable-model-invocation: true` (AC1).
- `/codex-review` must remain byte-for-byte unchanged (AC6) — `/codex-audit` is additive, never a refactor of the sibling.
- Standalone: no RDPI prerequisites; no writes to `tasks/issues.md` / `tasks/todo.md`; no persistent artifact (the only on-disk effect is target edits when policy=apply).
- The skill may edit the **target**; **source docs are ground truth and must never be edited** (Omakase guardrail).
- Every fidelity finding must cite *source file:line* + the *target location it contradicts* — source-only verification can't prove the relation; deference to Codex confidence is the failure mode.
- Cleanup-before-present (interactive final turn would otherwise strand temps).
- `codex-output-check.sh` only checks existence + line count — Claude must still read the output fully and verify claims.
- Sub-agents must not be spawned (recursion guard — both precedents carry it).
- Do **not** reuse `.claude/templates/audit-report.md` — it belongs to `/playbook-audit`.

## External Research
**None required.** Every axis is evaluable from the spec plus local playbook/Omakase precedent — Codex CLI invocation shape, skill frontmatter conventions, the `codex-output-check.sh` contract, and the no-nested-slash-command limitation are all in local files. No axis's viability depends on external library/API/protocol behavior (audited each of the 9 axes; the `--search` question in Axis 7 is a *do-we-need-web* decision, not an external-knowledge gap). Codex (run with `--search`) independently reported the same.

## Risk Analysis
- **Apply-policy default is the highest-stakes call.** Wrong default = either a surprising side-effecting command (apply-by-default on a single pass) or a multi-pass loop that can't converge (recommend-only with `passes > 1` violates AC4). The `passes`-coupled resolution (Axis 4=C) threads both; get it explicitly right.
- **Argument-parse ambiguity (real, from task OQ).** A freeform target legitimately ending in a number (e.g., `/codex-audit "step 2"`) vs the trailing-integer `passes`. **Lean rule:** the last whitespace token, *if* it parses as a small positive int *and* a non-empty target remains after removing it, is `passes`; otherwise it's part of the target. Validate `passes` as a positive int (reject 0/negative). Document the rule and an escape (quote the target, or a `--passes N` form) in the skill.
- **Concurrency collision (issue #6, active).** Fixed tmp names + backgrounded Codex + shared `tasks/` (parallel runs or worktrees) clobber each other. Issue #6 names `/codex-audit` specifically. At minimum use per-pass-distinct output names; ideally don't bake in a naming scheme that fights #6's eventual generalization.
- **Stranded temps on the background path.** `run_in_background: true` + a developer who never returns = orphaned `.tmp` (also issue #6). Keep cleanup on every exit path (success, Codex-not-found, output-check fail, declined offer).
- **Plumbing-copy hazard.** The Omakase invocation (`codex-source-audit.md:108`) lacks `-a never` and the output-check — copying it verbatim would regress the playbook's hardening. Compose plumbing from `/codex-review`, semantics from Omakase.
- **Passes runaway.** `/codex-audit x 99` with no cap. Lean: a small max-pass guard (task OQ).
- **`/codex-review` drift.** The two skills share most plumbing; a future edit "to both" risks violating AC6. Keep `/codex-audit` self-contained; do not factor shared text out of `/codex-review`.

## Open Questions
*(Task-19 OQs are accepted-and-deferred design prompts per `todo.md:21` — listed here with the synthesis's lean for /design to settle, not as blocking gates.)*

1. **Recommend-only vs apply-by-default (task OQ #1).** Lean: couple to `passes` (Axis 4=C) — single pass recommend-only, multi-pass applies between iterations. Decide whether an explicit `--no-apply` escape is also needed.
2. **Argument-parsing rule (task OQ #2).** Lean: last whitespace token is `passes` iff it parses as a small positive int and a non-empty target remains; else part of the target. Confirm and document the escape.
3. **Lineage/supersession lens (task OQ #3).** Lean: secondary + conditional (only when the injected sources carry a supersession order), not a 4th core lens — keeps the core minimal and general.
4. **Default `passes` cap (task OQ #4).** Lean: yes, a small guard (e.g., ≤5) to stop `/codex-audit x 99`.
5. **Triage vocabulary now vs task-13 alignment (Axis 6).** Lean: use apply/judgment-call/noise now (both live precedents); migrate to `A.1/A.2/B/C` if/when task 13 standardizes it.
6. **Tackle issue #6's unique-naming here or defer?** Lean: defer the generalized fix to issue #6; use per-pass-distinct names locally so this task doesn't regress concurrency further. Reconsider only if #6's fix is trivial to land inline.
7. **README/quickref rows (Axis 9).** Out-of-AC; lean: include them (cheap, correct) but they don't block.
