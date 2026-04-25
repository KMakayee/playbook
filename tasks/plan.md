# Plan: `/codex-review <target>` — generalized Codex review entry point

## Design Decision Reference

**Chosen approach:** Option 2 — Consensus-consolidated, pass-through args (A1 + B1 + C2 + D1 + E2.5 + F1 + G1) with four Codex-surfaced refinements and the late-stage E2 → E2.5 widening absorbed (`tasks/design-decision.md`, Option 2 + Decision sections).

Concretely this means:
- **A1 / G1:** literal `$ARGUMENTS` interpolated into the prompt; single target per invocation; no preprocessing or classifier.
- **B1 / C2:** one generalized lens block — *factual / correctness*, *simplest-approach*, *pattern / best-practice* — with the universal principles plus the selectively-applicable ones (factual-vs-judgment classification, "report findings — no remediation plan or task sequence", "state what you could and could not inspect when the target is ambiguous").
- **D1 / E2.5:** Codex output goes to `tasks/codex-review.tmp`; Claude reads + spot-checks (Step 4), **deletes both temp files** (Step 5, before user-facing presentation — matches existing cleanup-then-present convention and avoids leaks if the user ignores the upcoming interactive prompt), then **presents findings + offers opt-in triage in a single user-facing turn** (Step 6). If the developer accepts triage in a follow-up turn, Claude does deeper re-verification + apply / judgment-call / noise labels with a one-line recommendation per finding — no action even on "apply" items.
- **F1:** prompt body inline in `.claude/commands/codex-review.md`; the `$ARGUMENTS` interpolation is done safely by writing the composed prompt to `tasks/codex-review-prompt.tmp` first (mirrors `.claude/commands/research-codebase.md:40-47`), then `codex exec ... "$(cat tasks/codex-review-prompt.tmp)"`.
- **Consumer-side guidance to Claude (the parent):** spot-check loop and the one-line "Codex's confidence is not evidence" note both live in the consumer step, not the Codex prompt body (matches `tasks/design-decision.md:71` → `.claude/commands/design.md:122-126`). The E2.5 triage step is also consumer-side — pure conversation, no temp files, no artifact mutation.

**Artifact references:**
- Research: `tasks/research-codebase.md`
- Design: `tasks/design-decision.md`

## Scope Boundaries

What this task does:
- Add one new file: `.claude/commands/codex-review.md`.

What this task explicitly does NOT do (lifted from `tasks/design-decision.md:76-86`):
- No prerequisite artifact reads (no `tasks/research-codebase.md` or similar).
- No persistent output artifact — temp files only, deleted in cleanup.
- No status updates to `tasks/issues.md` or `tasks/todo.md`.
- No follow-on command suggestions ("run `/X` next").
- No entry in `/finish`'s cleanup list (`.claude/commands/finish.md:22,30`).
- No multi-target support.
- No strict typing of `<target>` — accept the literal arg string.
- No per-target-type prompt branches.
- No skill port — Task 7 in `tasks/todo.md:42` handles that.
- No edits to any of the seven existing Codex-driven review commands. This task adds an entry point; it does not consolidate the existing prompts.

## Phased Breakdown

This task is a single new ~90-line markdown file. It does not split cleanly into independently-testable phases — each section of the file (refusal gate, prompt composition, codex call, spot-check, cleanup, combined present + opt-in triage) only makes sense as part of the whole command. The plan therefore has one execution phase plus a verification phase.

### Phase 1 — Author `.claude/commands/codex-review.md`

**File to create:** `.claude/commands/codex-review.md` (does not exist yet — confirmed via `ls .claude/commands/ | grep codex-review`).

**File structure** (in order, mirroring the layout of `.claude/commands/research-codebase.md` — title → one-line purpose → empty-arg refusal → "Steps" section → "Important notes"):

1. **Title + one-line purpose** — describe `/codex-review` directly as "a one-shot Codex second-opinion pass over an arbitrary target — file, diff, artifact, or freeform string." Add a one-sentence parenthetical *only* if the surrounding sentence reads naturally with it: "(distinct from any `/code-review` or `/security-review` plugin commands, which run full PR-review workflows)" — these plugin commands are visible in the available-skills list per `tasks/research-codebase.md:217` but are not in `.claude/commands/`, so the parenthetical is a hedge for users who have those plugins installed, not the headline framing.

2. **Empty-arg refusal** — exact pattern from `.claude/commands/research-codebase.md:5`. If `$ARGUMENTS` is empty or blank, stop and emit a one-line usage hint: `/codex-review path/to/file.ts` (or similar). Do not auto-pick a target.

3. **Steps section** with the following numbered steps:

   - **Step 1 — Pre-delete stale temp files.** Run `rm -f tasks/codex-review.tmp tasks/codex-review-prompt.tmp` so a failed previous run is not mistaken for fresh output (refinement absorbed at `tasks/design-decision.md:35`).

   - **Step 2 — Compose the Codex prompt safely.** Write the composed prompt body (with `$ARGUMENTS` interpolated literally) to `tasks/codex-review-prompt.tmp`. This handles arbitrary characters in the user's argument — quotes, backticks, newlines, shell metacharacters — without shell-quoting hazards. The mechanism mirrors `.claude/commands/research-codebase.md:40` ("Write the composed prompt to `tasks/codex-prompt.tmp`"), then invokes Codex via `"$(cat ...)"`.

     The prompt body interpolated into `tasks/codex-review-prompt.tmp` must contain (exact wording can be tuned during implementation, but every bullet below must appear):

     - **Target line** — `Target to review: $ARGUMENTS`. The literal arg string with no preprocessing.
     - **Lens block** — three named lenses Codex must populate:
       1. **Factual / correctness** — bugs in code, stale references in artifacts, contradictions with surrounding context (consolidates the universal "factual error" framing used in `.claude/commands/create-plan.md:58`).
       2. **Simplest-approach** — over-abstraction, redundant logic, fewer-files-fewer-moving-parts, simpler tool/pattern available (consolidates the simplification lens at `.claude/commands/implement.md:73,75`).
       3. **Pattern / best-practice** — anti-patterns, misused idioms, established conventions missing (consolidates the patterns lens at `.claude/commands/implement.md:74`).
     - **Classification labels** — generalized form of CORRECTION vs TRADE-OFF from `.claude/commands/create-plan.md:57-60`: each finding gets a label of either **factual issue** (clear right answer) or **judgment call** (defensible alternatives). Phrase as a generalization of the existing CORRECTION/TRADE-OFF rubric so it works without an "input document" baseline.
     - **Specificity** — "Be specific with file paths and line numbers (or section/heading references for non-code targets)." Universal across all 7 existing prompts.
     - **Technical-merit framing** — "Evaluate the target on technical merit. Do not defer to it as authoritative simply because it is the input — the target is context, not a constraint." Consolidates the 5/7 consensus principle from `tasks/research-codebase.md:37`, listed as part of the universal lift at `tasks/design-decision.md:20`.
     - **No remediation plan or task sequence** — narrow phrasing per refinement at `tasks/design-decision.md:37`. Brief one-line direction per finding is allowed; multi-step fix sequences are not.
     - **Inspectability caveat** — "If the target is ambiguous (e.g., a glob, an unquoted multi-word phrase, a non-existent path), state explicitly what you could and could not inspect, and proceed with what you have." Per refinement at `tasks/design-decision.md:38`.
     - **Output structure** — "Format findings under the lens names as section headers (e.g., `## Factual / correctness`, `## Simplest-approach`, `## Pattern / best-practice`). Within each section, list findings as bullet items prefixed with the classification label in bold (e.g., `- **factual issue:** ...` or `- **judgment call:** ...`)." Added per Codex review correction #5 — without this, the prompt body specifies the lenses but doesn't tell Codex to render them as headers, leaving Phase 2 smoke test 1's "lens names as headers" expectation unsupported.

   - **Step 3 — Invoke Codex.** Run with a 10-minute timeout (600000ms) — match `.claude/commands/research-codebase.md:48`:

     ```bash
     codex exec \
       --sandbox read-only \
       -o tasks/codex-review.tmp \
       "$(cat tasks/codex-review-prompt.tmp)"
     ```

     Standard codex-not-found fallback message immediately after, adapted from `.claude/commands/research-codebase.md:51` with explicit cleanup added so the failure path doesn't leave temp files behind: "If the `codex` command is not found or fails, run `rm -f tasks/codex-review.tmp tasks/codex-review-prompt.tmp`, then stop and tell the developer to fix it before proceeding." The cleanup must happen before the stop so the no-persistent-artifact boundary (`tasks/design-decision.md:79`) holds even on failure.

   - **Step 4 — Spot-check Codex's claims.** Read `tasks/codex-review.tmp` FULLY (no limit/offset). Verify a sample of the file paths and line numbers Codex cited; flag any that don't match. This is the universal consumer-side step from `.claude/commands/research-codebase.md:56-58`, `.claude/commands/design.md:112-114`, `.claude/commands/create-plan.md:90-93` (verification check: "any file path, line, or reference Codex surfaced... has been checked against real code"), `.claude/commands/implement.md:84-89`.

     Include a one-line note here: **"Codex's confidence is not evidence."** Phrasing copied from `.claude/commands/design.md:126`. Generalized: weigh findings on technical merit independent of how confidently Codex states them. This is consumer-side guidance to Claude, not part of the Codex prompt body (matches OQ1 resolution at `tasks/design-decision.md:71`).

   - **Step 5 — Clean up.** `rm -f tasks/codex-review.tmp tasks/codex-review-prompt.tmp`. Both files are deleted *before* the user-facing presentation in Step 6 — this matches the cleanup-then-present pattern in `.claude/commands/research-codebase.md:147,150` (cleanup at Step 6, present at Step 7), `.claude/commands/design.md:193,196` (cleanup at Step 7, present at Step 8), and `.claude/commands/create-plan.md:97,100` (cleanup at Step 6, present at Step 7). Cleanup-before-present is load-bearing here because Step 6 includes an interactive prompt; if cleanup were after, an unanswered prompt would leave temp files behind. Triage in Step 6 operates on Codex's output already loaded into Claude's context (from Step 4) plus on-demand reads of the cited source files — it does not need the temp file. The command must NOT add itself to `/finish`'s cleanup list (`.claude/commands/finish.md:22,30`).

   - **Step 6 — Present findings + offer triage.** Single user-facing turn that does two things in one response:

     a. **Present the raw findings** to the developer, grouped by lens and label as Codex emitted them. Pass through with the Step 4 spot-check caveats applied. This is the unmodified Codex output — no triage filtering yet.

     b. **Offer opt-in triage** at the end of the same response, with phrasing like:

        > *"Want me to triage these? I'll re-verify each against the code, mark them as **apply** / **judgment call** / **noise**, and give you my read. I won't make changes."*

     - **If the developer declines or ignores:** the command is done.
     - **If the developer accepts (in a follow-up turn):** for each finding, Claude:
       1. Re-reads the cited file/section in full from disk (deeper than Step 4's sample spot-check — every cited line, not a sample). The temp files are gone by now (cleaned up in Step 5), but the actual source files referenced by Codex are unchanged.
       2. Evaluates the finding against the actual code, not just Codex's framing — does it hold up? Is Codex's implied direction the simplest fix, or is there a better one?
       3. Labels the finding:
          - **apply** — factual issue, deep verification passed, fix is clear and scoped.
          - **judgment call** — defensible alternatives; needs developer input on direction.
          - **noise** — false positive, didn't survive deeper verification, or subjective style.
       4. Adds a one-line recommendation per finding ("would apply this," "would skip — Codex misread the API," "needs your call — both directions are defensible").

       Present the triaged view. Do NOT apply any changes — even on **apply** items, the developer drives action (this preserves the shortcut framing per the late-stage refinement at `tasks/design-decision.md:40-41`). If the developer asks Claude in a follow-up turn to apply a specific finding, that's a separate request outside this command.

       The triage view is pure conversation — no temp file is written for it, no artifact is mutated.

       **Edge case — Codex returned no findings:** the triage offer is still made (the developer doesn't know Codex was clean unless told), but if accepted, Claude responds with "no findings to triage" and the command ends.

4. **"Important notes" section** at the bottom (matches the convention in `.claude/commands/research-codebase.md:163-168`, `.claude/commands/design.md:208-211`, `.claude/commands/create-plan.md:108-112`). Two short notes:
   - This command produces no persistent artifact and reads no prerequisites — it is a one-shot shortcut.
   - Sub-agents must not be spawned (recursion guard, matches the convention).

**Success criteria for Phase 1:**

All criteria are command-line checks. Each must exit 0 (success) when run from the repo root after Phase 1 completes.

- [x] `test -f .claude/commands/codex-review.md` — file exists.
- [x] `[ "$(grep -c '\$ARGUMENTS' .claude/commands/codex-review.md)" -ge 2 ]` — at least 2 matches (refusal check + prompt interpolation).
- [x] `grep -q -- '--sandbox read-only' .claude/commands/codex-review.md` — sandbox flag present.
- [x] `grep -q -- '-o tasks/codex-review.tmp' .claude/commands/codex-review.md` — output redirect present.
- [x] `grep -qF '"$(cat tasks/codex-review-prompt.tmp)"' .claude/commands/codex-review.md` — Codex invocation reads prompt from tmp file (handles special chars safely).
- [x] `grep -q '600000' .claude/commands/codex-review.md` — 10-minute timeout (600000ms) explicitly stated, matching the universal Codex-call convention from `.claude/commands/research-codebase.md:48`, `.claude/commands/design.md:84`, `.claude/commands/create-plan.md:49`, `.claude/commands/implement.md:58`.
- [x] `[ "$(grep -c 'tasks/codex-review-prompt\.tmp' .claude/commands/codex-review.md)" -ge 4 ]` — at least 4 references (write in Step 2, cat-into-codex in Step 3, failure-path cleanup in Step 3, final cleanup in Step 5).
- [x] `[ "$(grep -c 'tasks/codex-review\.tmp' .claude/commands/codex-review.md)" -ge 5 ]` — at least 5 references (pre-delete in Step 1, `-o` in Step 3, read in Step 4, failure-path cleanup in Step 3, final cleanup in Step 5).
- [x] `grep -qF "Codex's confidence is not evidence" .claude/commands/codex-review.md` — verbatim line in the Step 4 spot-check.
- [x] `grep -qF 'factual issue' .claude/commands/codex-review.md` — first classification label present (in prompt body).
- [x] `grep -qF 'judgment call' .claude/commands/codex-review.md` — second classification label present (in prompt body).
- [x] `grep -qiF 'factual / correctness' .claude/commands/codex-review.md` — first lens name present.
- [x] `grep -qiF 'simplest-approach' .claude/commands/codex-review.md` — second lens name present.
- [x] `grep -qiF 'pattern / best-practice' .claude/commands/codex-review.md` — third lens name present.
- [x] `grep -qiE 'opt-in.*triage|triage.*opt-in' .claude/commands/codex-review.md` — Step 6 triage offer is opt-in, not always-on.
- [x] `grep -qiE 'apply\b' .claude/commands/codex-review.md && grep -qiE 'noise\b' .claude/commands/codex-review.md` — both **apply** and **noise** triage labels present (judgment call already verified by the earlier grep).
- [x] `grep -qiE "I won't make changes|do not apply|developer drives action" .claude/commands/codex-review.md` — Step 6 explicitly states no changes are applied even after triage. (Uses double-quoted regex so the apostrophe in `won't` doesn't need escaping.)
- [x] `grep -q 'Format findings under the lens names as section headers' .claude/commands/codex-review.md` — prompt body requires lens-as-headers output structure (added per Codex review correction #5; underwrites Phase 2 smoke test 1's lens-headers expectation).
- [x] `[ "$(grep -l 'codex-review' .claude/commands/*.md | wc -l)" -eq 1 ]` — only the new file references `codex-review`; this command is a leaf with no entries in `/finish`, `/research-codebase`, `/design`, `/create-plan`, or `/implement`.

### Phase 2 — Smoke-test the command end-to-end

Phase 1 covers structure; this phase covers behavior. The command must actually run against a real target and produce a sane review.

**Steps:**

1. **Smoke-test against an existing artifact** — run `/codex-review tasks/design-decision.md` (the design doc itself is a convenient real target with known content). Watch for:
   - The two temp files appear during execution (`tasks/codex-review.tmp`, `tasks/codex-review-prompt.tmp`).
   - Codex returns within the 10-minute timeout.
   - Codex's output follows the prompt's lens structure (named lenses appear as headers); per Codex review trade-off #5, a clean target may legitimately produce no findings — that's acceptable, the goal is to verify the mechanism.
   - Both temp files are deleted by the time the command finishes.
   - `git status` shows no new tracked files in `tasks/` after the command exits.

2. **Smoke-test the refusal gate** — run `/codex-review` with no argument. Verify the command stops with the usage hint and never invokes `codex exec`.

3. **Smoke-test ambiguous target handling** — run `/codex-review some-nonexistent-path` and verify Codex's output explicitly states what it could and could not inspect (per the inspectability caveat in the prompt).

4. **Smoke-test special-character handling in `$ARGUMENTS`** — addresses the safe-prompt-composition refinement at `tasks/design-decision.md:36`. Manual procedure (slash-command syntax does not support `$'\n'` shell escapes, so this is a hand-driven test):
   - **Quote + backtick test:** run ``/codex-review tasks/design-decision.md "stress test with \"nested\" quotes and `inline backticks` ``. While the command is mid-run (between Step 2 writing the prompt tmp and Step 5 cleaning it up), open `tasks/codex-review-prompt.tmp` in another shell and confirm: (a) the literal `"` characters appear unescaped in the target line; (b) the backticks appear unescaped; (c) Codex completes Step 3 without a shell-quoting error.
   - **Newline test (manual):** since slash commands don't accept literal newlines from the chat, simulate by hand-editing `.claude/commands/codex-review.md` to substitute a hardcoded multi-line `$ARGUMENTS` value, run once, inspect `tasks/codex-review-prompt.tmp` to confirm the newline is preserved, then revert the edit. (This is a one-time spot-check during implementation, not a recurring test.)

5. **Smoke-test opt-in triage path (both branches)** — verifies Step 6's interactive offer works in both directions:
   - **Decline branch:** run smoke test 1's invocation. When Step 6 offers triage, decline (e.g., "no thanks"). Verify the response ends with no triaged view produced. Note: cleanup already happened in Step 5 before the offer, so there are no temp files to check after the decline.
   - **Accept branch on clean target:** re-run smoke test 1's invocation; when Step 6 offers triage, accept. If Codex returned no findings on the clean target, Claude must respond "no findings to triage" and end. This is the explicit no-op path from Step 6's edge-case clause.
   - **Accept branch on a target with known findings:** create a temporary target file at `/tmp/codex-review-smoke.md` with a deliberately seeded issue (suggested content: a markdown file claiming "see line 999 of tasks/research-codebase.md" — a verifiable factual error since research-codebase.md has fewer than 999 lines, and a vague phrase like "this could be done better somehow" — a clear simplest-approach lens target). Run `/codex-review /tmp/codex-review-smoke.md`; when Step 6 offers triage, accept. Verify Claude (a) re-reads the cited file/section in full, (b) applies at least one **apply** / **judgment call** / **noise** label to a finding, (c) provides a one-line recommendation per finding, (d) does NOT write any new files (`git status` clean for the worktree, `ls tasks/` shows no new files). After the test, `rm /tmp/codex-review-smoke.md`.

**Success criteria for Phase 2:**

- [x] Smoke test 1 (real artifact): command completes within 10 minutes; Codex's output is presented to the developer with named lens sections rendered as headers (per the new "Output structure" prompt-body bullet — confirmed by visual inspection of the response). A clean target producing no findings is acceptable (the smoke test verifies the mechanism, not Codex's substantive verdict). _Verified: ran codex against `tasks/design-decision.md`; took ~2 min; output rendered three `## Factual / correctness`, `## Simplest-approach`, `## Pattern / best-practice` headers with bold-prefixed labels._
- [x] Smoke test 2 (empty arg): command refuses with a usage hint and never invokes `codex exec`. _Verified structurally: refusal language at `.claude/commands/codex-review.md:5` precedes any `codex exec` invocation in source order. Cannot drive an actual empty-arg slash invocation from inside a running command, but a future Claude session reading this command file will hit the refusal branch before reaching Step 3._
- [x] Smoke test 3 (ambiguous target): Codex output contains an explicit "what I could / could not inspect" caveat. _Verified: ran codex against `some-nonexistent-path`; first line of output reads "I could inspect only whether the target exists. I could not inspect any file, diff, or artifact content because [...] does not exist."_
- [x] Smoke test 4 (quote + backtick): mid-run inspection of `tasks/codex-review-prompt.tmp` shows literal `"` and `` ` `` unescaped; Codex Step 3 completes without a shell-quoting error. _Verified: composed prompt with embedded `"nested"` quotes and `` `inline backticks` ``; `head -2` confirmed literal chars in the tmp file; `codex exec "$(cat ...)"` completed with exit 0._
- [x] Smoke test 4 (newline manual): one-time hand-edit verification confirms newline preserved in the prompt tmp file. _Verified: composed prompt embedded a literal newline mid-target line; `head -2` confirmed the newline preserved in the file; `"$(cat ...)"` captured the multi-line content as a single shell argument; codex accepted the input without error._
- [ ] Smoke test 5 (triage decline): triage offer presented in Step 6; decline ends the command with no triaged view. _Deferred — interactive UX path that requires driving `/codex-review` in a fresh chat. The command file at `.claude/commands/codex-review.md:79-80` documents the decline branch ("If the developer declines or ignores: the command is done.") which a future Claude session will follow._
- [ ] Smoke test 5 (accept on clean target): if Codex returned no findings, Claude responds "no findings to triage" and ends. Both behaviors are valid passes for this branch. _Deferred — interactive UX path. Edge case is documented at `.claude/commands/codex-review.md:97`._
- [x] Smoke test 5 (accept on seeded target): triaged view uses at least one of the three labels (**apply** / **judgment call** / **noise**) with a one-line recommendation per finding; no files written; `git status` clean for the worktree; `ls tasks/` shows no new files. _Verified: created `/tmp/codex-review-smoke.md` with seeded errors (line 999 of research-codebase.md, fictitious `src/budget/index.ts:42`, vague "could be done better somehow"); codex returned 4 findings; deep-verified each (`wc -l tasks/research-codebase.md` → 226 lines, no `src/` dir, no `getRetryBudgetForTenant` symbol, vague-prose line confirmed); applied 2× **apply**, 1× **judgment call**, 1× **noise**; one-line recommendation per finding; no triage artifact written; `git status` showed only the expected QRSPI artifacts; `ls tasks/` showed no `codex-review*.tmp`._
- [x] `! ls tasks/ 2>/dev/null | grep -qE 'codex-review(-prompt)?\.tmp$'` exits 0 after each test (including after the deliberate failure cases) — i.e., no `codex-review*.tmp` files remain in `tasks/`. (Inverted `grep` so the success case is exit 0; per Codex review correction #4.) _Verified after each of smoke tests 1, 3, 4, 5._

## Judgment Calls

Numbered list of choices made in this plan where an alternative was viable. Codex review will scrutinize each:

1. **Single phase for authoring.** The command is one ~90-line file; splitting authoring into multiple phases would force artificial seams (e.g., "phase 1 writes the refusal gate, phase 2 writes the codex call"). Each section only makes sense as part of the whole. Alternative considered: a phase per file section. Rejected because no intermediate state is useful or testable.

2. **Two temp files instead of one.** `tasks/codex-review-prompt.tmp` (the prompt body, written by Claude) and `tasks/codex-review.tmp` (Codex's output, written by `codex exec -o`) are kept separate, mirroring `.claude/commands/research-codebase.md`'s `tasks/codex-prompt.tmp`/`tasks/codex-research.tmp` split. Alternative: heredoc the prompt directly into `codex exec` with no prompt tmp file. Rejected because $ARGUMENTS may contain quotes, backticks, or newlines (refinement at `tasks/design-decision.md:36`), and the existing convention already handles this safely.

3. **Pre-delete temp files (Step 1), failure-path cleanup (Step 3), and final cleanup (Step 5 — before the user-facing presentation in Step 6).** Three cleanup points cover three distinct failure modes: pre-delete protects against stale output from a crashed previous run, failure-path cleanup protects against codex-not-found / codex-fails (per Codex review correction #2), and final cleanup runs *before* presenting findings + offering triage in Step 6. The cleanup-before-present ordering is load-bearing — Step 6 ends in an interactive prompt, and if cleanup were after, an unanswered prompt would leave temp files behind (per the second Codex review's correction #1). Cleanup-before-present is also the established pattern in `.claude/commands/research-codebase.md:147,150`, `.claude/commands/design.md:193,196`, and `.claude/commands/create-plan.md:97,100`. Triage operates on Codex's output already in Claude's context (loaded in Step 4) plus on-demand reads of cited source files — it does not need the temp file.

4. **Lens block with three named lenses, not two or four.** Three is what the consolidated principle table in `tasks/research-codebase.md:31-43` reduces to (factual/correctness, simplest-approach, pattern). Two would lose the simplification lens (load-bearing per `.claude/commands/implement.md:73`). Four would split simplest-approach from pattern in a way the existing prompts don't.

5. **Factual issue / judgment call as labels Codex applies.** Generalizes CORRECTION vs TRADE-OFF (`.claude/commands/create-plan.md:57-60`). Alternative: keep CORRECTION/TRADE-OFF verbatim. Rejected because the existing labels assume an "input document" baseline that doesn't exist for freeform targets — the design specifies the rewording at `tasks/research-codebase.md:58` and `tasks/design-decision.md:30`.

6. **"Codex's confidence is not evidence" is consumer-side, not in the Codex prompt.** Resolves OQ1 per `tasks/design-decision.md:71`. Alternative: include in the Codex prompt as a "do not be overconfident" instruction. Rejected because confidence is an output style Codex defaults to regardless of instruction; the parent (Claude) is the one who needs to weigh it.

7. **Phase 2 (smoke-test) is part of the plan, not deferred.** A command that interpolates `$ARGUMENTS` into a prompt and shells out to a 10-minute external process — and now also offers an interactive triage step — can't be verified by static checks alone. Five concrete smoke tests cover the five risks (real target, refusal, ambiguous target, special-character `$ARGUMENTS`, opt-in triage decline + accept branches) called out in `tasks/research-codebase.md:213-218`, `tasks/design-decision.md:36`, and the late-stage E2 → E2.5 widening. The smoke tests pass even when Codex returns "no findings" on a clean target — they verify the mechanism, not the verdict (Codex review trade-off #5).

8. **No edits to `.claude/commands/finish.md` or any other command.** The design lists "no entry in `/finish`'s cleanup list" as scope boundary (`tasks/design-decision.md:82`). The command is a leaf — its temp files are deleted in its own Step 5, so `/finish` has nothing to clean up after it.

9. **Opt-in triage capped at conversational output (no file writes, no fix application).** Step 6's interactive triage offer lets Claude do deeper synthesis than the raw pass-through, but the triage view is pure conversation — no temp file is written for it, no artifact is mutated, no child process is spawned even on **apply**-labeled findings. Alternative considered: extend triage to include fix application (full E3, like `/implement`'s code-review flow). Rejected because that requires scope (which files? bounded by what?), an artifact to track fixes, and a verification loop — that's `/implement`'s territory. Also alternative: make triage always-on (no opt-in). Rejected because it removes the developer's ability to take the raw findings and act on them directly when they don't want Claude's interpretation; opt-in preserves both flows. The phrasing of the Step 6 offer deliberately makes it easy to decline ("I won't make changes") so the developer doesn't feel committed by saying yes.

10. **Lightweight prompt-body output structure (lens headers + bold-label bullets), no full schema.** The "Output structure" bullet added in Step 2 (per Codex review correction #5) requires section headers and bold labels but stops short of mandating a full structured schema (e.g., a JSON-shaped findings table with required fields per finding). Alternative considered: require Codex to emit a structured `## Findings` table with columns for *Lens / Label / File / Line / Description / Suggested direction*. Rejected because (a) the lens-header + bold-label structure already gives triage enough hooks to parse Codex's output, (b) heavier schema adds prompt ceremony without proven need, and (c) reversibility — if triage proves brittle in practice, a fuller schema can be added later without restructuring anything else. This is the resolution of the second Codex review's trade-off about output structure.

## Risks Folded In

From `tasks/research-codebase.md:213-219`:

- **Generalization → shallow output.** Mitigated by the three named lenses in the prompt body; Codex always has three axes to populate.
- **Argument ambiguity.** Mitigated by the inspectability caveat in the prompt body and verified by Phase 2 smoke test 3.
- **Special characters in `$ARGUMENTS` breaking shell quoting.** Mitigated by composing the prompt to a tmp file (judgment call #2 above) and verified by Phase 2 smoke test 4 (added per Codex review correction #4).
- **Codex-failure path leaving temp files behind.** Mitigated by the failure-path cleanup added to Step 3 (per Codex review correction #2).
- **Label mismatch for non-code targets.** Mitigated by the factual-issue / judgment-call rewording (judgment call #5 above).
- **Semantic overlap with `/code-review` and `/security-review`.** Mitigated by an optional parenthetical aside in the one-line purpose (per Codex review trade-off #6) — only added if the surrounding sentence reads naturally with it; not the headline framing, since these are plugin commands not always installed.
- **Drift back to inline ad-hoc Codex calls.** Mitigated by keeping the command short and the prompt body direct so developers actually use it. The opt-in triage step (Step 6, judgment call #9) further reduces drift by giving developers a reason to use the slash command over a raw `codex exec` — they get Claude's synthesis layer for free if they want it.
- **Triage scope creep into fix application.** Mitigated by the explicit "I won't make changes" + "developer drives action" wording in Step 6; verified by Phase 2 smoke test 5 (seeded-target accept branch must show no files written, `git status` clean).
- **Interactive Step 6 prompt leaving temp files behind.** Mitigated by reordering — Step 5 cleanup runs *before* the Step 6 user-facing presentation (per Codex review correction #1). If the developer ignores the triage offer, temp files are already gone.
- **Codex output without consistent structure makes triage parsing brittle.** Mitigated by the "Output structure" bullet in Step 2's prompt body (lens headers + bold-label bullets). If this proves insufficient in practice, a fuller findings schema can be added later (judgment call #10).
- **Task 7 will port this to a skill.** Inline prompt (F1) keeps the port a one-file move.
