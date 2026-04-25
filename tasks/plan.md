# Plan: Task 6 — Collapse `-codex` variants in the issue workflow into integrated commands

## Design Decision Reference

Chosen approach: **Option A — Full QRSPI Mirror (hard rename, delete old files)** with the two amendments Codex's design cross-check surfaced (deferred-item handling carried into integrated `/issue-plan`; `pipeline-eval.sh` updated to the actual 5-log child-process shape, not 7).

Source artifacts:
- `tasks/design-decision.md` — chosen option, rationale, axis combination (1-11 = A)
- `tasks/research-codebase.md` — file map, axes, coupling, risks

## Scope Boundaries (What We're NOT Doing)

- **Not changing `/issue-update`.** Out of scope per research §1; no Codex involvement, no behavioral change.
- **Not adding multi-batch plan support to `/issue-implement` deliberately.** Mirroring `/implement` inherits the PRELUDE Codex-prompt clause as a side effect; not deliberate scope.
- **Not adding `--search` to `/issue-plan` or `/issue-implement` review steps.** QRSPI's `/create-plan` and `/implement` don't use it — review/plan steps are codebase-grounded, not external-research-grounded.
- **Not pre-empting Task 7 (skill port).** Keep the `.claude/commands/<name>.md` + `$ARGUMENTS` convention. Task 7 changes the surface; Task 6 only changes the contents.
- **Not adding new design axes or external research.** The design is finalized; the plan executes it.
- **Not adding forwarding shims for `-codex` command names.** Single-developer repo, no external automation invokes by name; design Option B was rejected.
- **Not introducing a manual-vs-auto branching mode in `/issue-implement`.** Design Option C (Choice D on Axis 4) was rejected; QRSPI's invariant is "always auto-apply."

## Cross-Cutting Invariants

These hold across every phase. Violations are bugs.

- **10-minute Codex timeout** (`tasks/errors.md:15-17`) — every `codex exec` invocation in the new commands needs 600000ms.
- **Output verification** — `bash .claude/scripts/codex-output-check.sh <tmp> <min-lines>` runs before reading any Codex output. Min-lines per QRSPI precedent: 20 for research, 10 for plan/code review, 5 for debug.
- **`$ARGUMENTS` convention** — preserved for Task 7's skill port.
- **Sub-agent recursion guard** — the integrated commands inherit `/research-codebase`'s pattern of spawning gap-filling sub-agents in the parent context (`research-codebase.md:69-71`). Per `CLAUDE.md` "Sub-Agent Behaviors", any sub-agent spawned MUST NOT spawn further sub-agents. Sub-agents in `/issue-research`, `/issue-plan`, and `/issue-implement` are leaf tasks: read, search, and report.
- **CORRECTION/TRADE-OFF/RISK taxonomy** — Codex prompts in `/issue-plan` and `/issue-implement` enforce it so Claude can triage findings systematically.
- **Per-command Codex temp-file cleanup** (Axis 8 = A) — each integrated command deletes its own `tasks/codex-issue-*-N.tmp` files at end-of-run; `/auto-issues` Phase 11 cleanup list shrinks accordingly.
- **Issue-scoped temp file naming** — to avoid collision with singleton-flow temp files (`tasks/codex-prompt.tmp`, `tasks/codex-research.tmp`, `tasks/codex-plan-review.tmp`, `tasks/codex-code-review.tmp`, `tasks/code-review-fixes.tmp`), use the `-issue-N` suffix:
  - Prompt scratch: `tasks/codex-issue-prompt-N.tmp`
  - Research output: `tasks/codex-issue-research-N.tmp` (existing name preserved)
  - Plan review output: `tasks/codex-issue-plan-review-N.tmp` (existing name preserved)
  - Code review output: `tasks/codex-issue-code-review-N.tmp` (existing name preserved)
  - Code review fixes hand-off: `tasks/code-review-fixes-issue-N.tmp` (new — design Open Question resolution)
- **Final status setter for `/issue-plan` is `In Review`** (Axis 10 = A) — preserves the absorbed setter from `issue-plan-review-codex.md:56`. `/issue-implement` continues to set `In Progress` then `Implemented`.
- **`/issue-research` keeps the Recommended Approach** — issue flow has no `/design`, so Claude's synthesis layer (Step 4 of new command) explicitly adds a `## Recommended Approach` section after Codex's axes report.

## Phased Breakdown

**Ordering rationale.** Phases 1-3 build the new integrated commands at expected paths. The new `/issue-research` is written at a NEW path (`issue-research.md`), keeping the old `issue-research-codex.md` alive so `/auto-issues` continues to work until Phase 4 swaps it. `/issue-plan` and `/issue-implement` are overwritten in place — both old and new shapes are valid for in-flight artifacts (artifact format unchanged per design §What's not). Phase 4 atomically swaps `/auto-issues` to the new surface AND updates `pipeline-eval.sh` to match — they must land in the same commit because intermediate state would have the orchestrator emitting a 5-log shape while the integrity check expects 9 logs. Phase 5 fixes documentation. Phase 6 removes the obsolete files only after nothing references them.

This means the codebase is functional after every phase: the old surface keeps working through Phases 1-3, the new pipeline + integrity check replace it atomically in Phase 4, docs catch up in Phase 5, and the dead files come out last.

---

### Phase 1 — Build integrated `/issue-research`

Create `.claude/commands/issue-research.md` (NEW file, do NOT delete `issue-research-codex.md` yet — Phase 6 handles that).

**Mirror:** `.claude/commands/research-codebase.md:1-168` (Steps 1-8 structure: prereqs → read mentioned files → Codex → verify → synthesize → write artifact → cleanup → present).

**Deviations from `/research-codebase`:**
1. `$ARGUMENTS` is the issue number, not a free-form task description.
2. Step 1 prereq check: locate issue `#$ARGUMENTS` in `tasks/issues.md`; if missing, stop. If `tasks/research-issue-$ARGUMENTS.md` already exists, **stop. Do not overwrite.** Tell the developer to manually remove the existing artifact (or rename it) before re-running. (Hard stop — do NOT phrase as "ask the developer," because `/auto-issues` runs children with `--dangerously-skip-permissions` and a non-interactive child instructed to "ask" may interpret the failure to ask as license to proceed.)
3. Step 2 reads issue body (Description, Acceptance Criteria, Notes) instead of free-form `$ARGUMENTS` files.
4. Step 3 (Codex research):
   - Read prompt template from `.claude/prompts/research-guide.md` (reused verbatim; Axis 5 = A).
   - Compose `{TASK}` from issue body (description + acceptance criteria + notes).
   - Compose `{SEARCH_HINTS}` from any file paths or symbol names mentioned in the issue body.
   - Write composed prompt to `tasks/codex-issue-prompt-$ARGUMENTS.tmp`.
   - Codex CLI (Axis 6 = A — full QRSPI shape):
     ```bash
     codex -c model_reasoning_effort=xhigh --search exec \
       --sandbox read-only \
       -o tasks/codex-issue-research-$ARGUMENTS.tmp \
       "$(cat tasks/codex-issue-prompt-$ARGUMENTS.tmp)"
     ```
     10-minute timeout (600000ms).
   - Verify: `bash .claude/scripts/codex-output-check.sh tasks/codex-issue-research-$ARGUMENTS.tmp 20`.
5. Step 4 (Claude synthesizes) — same as `/research-codebase` Step 4 (spot-check, normalize to axes, fill gaps, add diagnostic layer), PLUS one extra synthesis sub-step at the end:
   - **Add Recommended Approach.** Pick the highest-merit axis-choice combination from the synthesized axes. Write a `## Recommended Approach` section that names which axis-choice combination the implementer should follow, with one short paragraph of rationale per axis. This is the issue flow's substitute for `/design`.
6. Step 5 (write artifact) — write to `tasks/research-issue-$ARGUMENTS.md`. Same template as `/research-codebase` plus a required `## Recommended Approach` section. The `## Verification Notes` and `## Open Questions` sections carry over from the old `issue-research-codex.md:81-85` template shape (acceptance criteria themselves come from the issue body in `tasks/issues.md`, not from the research artifact's structure).
7. Step 6 (cleanup) — delete BOTH `tasks/codex-issue-prompt-$ARGUMENTS.tmp` AND `tasks/codex-issue-research-$ARGUMENTS.tmp`.
8. Step 7 (present) — same as `/research-codebase` Step 7, plus a "Run `/issue-plan $ARGUMENTS` next" hint.
9. Add a Step between current 7 and 8: **Update issue status** in `tasks/issues.md` from current value to `In Research` (carry from `issue-research-codex.md:88`).

**Files changed:** `.claude/commands/issue-research.md` (new).

**Success criteria:**
- [x] `test -f .claude/commands/issue-research.md`
- [x] `grep -q 'model_reasoning_effort=xhigh' .claude/commands/issue-research.md`
- [x] `grep -q -- '--search' .claude/commands/issue-research.md`
- [x] `grep -q 'codex-output-check.sh' .claude/commands/issue-research.md`
- [x] `grep -q '\.claude/prompts/research-guide\.md' .claude/commands/issue-research.md`
- [x] `grep -q 'Recommended Approach' .claude/commands/issue-research.md`
- [x] `grep -q 'tasks/codex-issue-prompt-\$ARGUMENTS\.tmp' .claude/commands/issue-research.md`
- [x] `grep -q 'tasks/codex-issue-research-\$ARGUMENTS\.tmp' .claude/commands/issue-research.md`
- [x] `grep -q 'In Research' .claude/commands/issue-research.md`
- [x] `grep -q '600000' .claude/commands/issue-research.md`

Commit: `feat(issue-research): integrate Codex into single command, mirror /research-codebase`

---

### Phase 2 — Rewrite `/issue-plan` to mirror `/create-plan`

Overwrite `.claude/commands/issue-plan.md` with a content rewrite. Keep the file path; replace contents.

**Mirror:** `.claude/commands/create-plan.md:1-123` (Steps 1-7: prereqs → draft → Codex review → absorb in place → verify → cleanup → present).

**Deviations from `/create-plan`:**
1. `$ARGUMENTS` is the issue number.
2. Step 1 prereqs:
   - Verify `tasks/research-issue-$ARGUMENTS.md` exists; if not, stop and tell the developer to run `/issue-research $ARGUMENTS`.
   - Locate issue `#$ARGUMENTS` in `tasks/issues.md`.
   - If `tasks/plan-issue-$ARGUMENTS.md` exists, **stop. Do not overwrite.** Tell the developer to manually remove the existing artifact before re-running. (Same non-interactive-safety rationale as `/issue-research` Step 1 above — `--dangerously-skip-permissions` children must not be told to "ask.")
   - Read `tasks/research-issue-$ARGUMENTS.md` and the issue body FULLY (no limit/offset).
   - Note: there is NO `tasks/design-decision.md` in the issue flow — the recommendation lives in the research artifact's `## Recommended Approach` section.
3. Step 2 (Claude drafts) — same shape as `/create-plan` Step 2, but extract implementation context from the research artifact's `## Recommended Approach` section instead of `tasks/design-decision.md`. Output: `tasks/plan-issue-$ARGUMENTS.md`.
4. Step 3 (Codex review) — paste in the full `/create-plan` Codex prompt (PARTS 1-6, including the CORRECTION/TRADE-OFF/RISK taxonomy block), but adapt the input file references:
   - "the research in tasks/research-issue-$ARGUMENTS.md" (not `tasks/research-codebase.md`)
   - "the recommendation in the research artifact's ## Recommended Approach section" (replaces the `tasks/design-decision.md` reference in PARTS 3 and 5)
   - Add an explicit "and the issue body in tasks/issues.md (acceptance criteria are in the issue, not a separate design doc)" pointer.
   - Output path: `tasks/codex-issue-plan-review-$ARGUMENTS.tmp`.
   - Codex CLI: `codex -c model_reasoning_effort=xhigh exec --sandbox read-only -o tasks/codex-issue-plan-review-$ARGUMENTS.tmp "..."` (no `--search`, foreground, 600000ms).
   - Verify: `bash .claude/scripts/codex-output-check.sh tasks/codex-issue-plan-review-$ARGUMENTS.tmp 10`.
5. Step 4 (absorb findings) — same as `/create-plan` Step 4 (apply CORRECTIONs in place; weigh TRADE-OFFs on merit; fold relevant RISKs).
6. **Add Step 4.5 — Handle deferred items** (carryover from `issue-plan-review-codex.md:51-55`, per design amendment):
   - If Codex's review surfaces items explicitly out of scope or deferred for the current issue, append them to `tasks/deferred.md` using the structure from `templates/deferred.md`.
   - Group entries under `### From Issue #$ARGUMENTS — [Title]`.
   - Include: what was deferred, why, and suggested future action.
7. Step 5 (verify) — same as `/create-plan` Step 5 (corrections applied, success criteria present, claims verified, plan flows end-to-end).
8. Step 6 (cleanup) — delete `tasks/codex-issue-plan-review-$ARGUMENTS.tmp`.
9. Step 7 (present) — same as `/create-plan` Step 7, plus "Run `/issue-implement $ARGUMENTS` next" hint.
10. Add a Step between cleanup and present: **Update issue status** in `tasks/issues.md` from current value to `In Review` (Axis 10 = A — carry from `issue-plan-review-codex.md:56`).

**Plan artifact format:** keep `tasks/plan-issue-$ARGUMENTS.md` title `"Plan: Issue #$ARGUMENTS — [Title]"`. The plan must include the same elements `/create-plan` requires (design-decision-reference replaced with research-artifact's-Recommended-Approach reference, plus an explicit "Issue reference" element).

**No `## Review` section, no `## Review (Resolved)` marker** — absorption happens in place, matching QRSPI (Axis 3 = A).

**Files changed:** `.claude/commands/issue-plan.md` (overwrite).

**Success criteria:**
- [x] `grep -q 'model_reasoning_effort=xhigh' .claude/commands/issue-plan.md`
- [x] `grep -q 'codex-output-check.sh' .claude/commands/issue-plan.md`
- [x] `grep -q 'CORRECTION' .claude/commands/issue-plan.md && grep -q 'TRADE-OFF' .claude/commands/issue-plan.md && grep -q 'RISK' .claude/commands/issue-plan.md`
- [x] `grep -q 'tasks/deferred.md' .claude/commands/issue-plan.md` (deferred-item handling carried)
- [x] `grep -q 'In Review' .claude/commands/issue-plan.md` (final status setter)
- [x] `grep -q 'tasks/codex-issue-plan-review-\$ARGUMENTS\.tmp' .claude/commands/issue-plan.md`
- [x] `grep -q '600000' .claude/commands/issue-plan.md`
- [x] `! grep -q '## Review (Resolved)' .claude/commands/issue-plan.md` (in-place absorption — no marker output)
- [x] `grep -q 'Recommended Approach' .claude/commands/issue-plan.md` (consumes from research artifact)
- [x] `grep -q 'PART 1' .claude/commands/issue-plan.md && grep -q 'PART 6' .claude/commands/issue-plan.md` (full QRSPI Codex prompt)

Commit: `feat(issue-plan): integrate Codex review, mirror /create-plan`

---

### Phase 3 — Rewrite `/issue-implement` to mirror `/implement`

Overwrite `.claude/commands/issue-implement.md` with a content rewrite. Keep the file path.

**Mirror:** `.claude/commands/implement.md:1-177` (Steps 1-11: prereqs → read plan → resume check → execute phase-by-phase → post-impl verify → Codex code review → triage → child-process apply → final verify → cleanup → present).

**Deviations from `/implement`:**
1. `$ARGUMENTS` is the issue number.
2. Step 1 prereqs:
   - Verify `tasks/plan-issue-$ARGUMENTS.md` exists; if not, stop.
   - Verify the plan is finalized (no unresolved blocking questions).
   - Verify `tasks/research-issue-$ARGUMENTS.md` exists for reference.
   - Read issue `#$ARGUMENTS` from `tasks/issues.md`.
3. Step 2 reads `tasks/plan-issue-$ARGUMENTS.md` and `tasks/research-issue-$ARGUMENTS.md`.
4. Step 3 (resume check) — same as `/implement`.
5. **New Step 3.5 — Update issue status to `In Progress`** in `tasks/issues.md` (carry from `issue-implement.md:25`).
6. Step 4 (execute phase-by-phase) — same as `/implement` Step 4 (a-f), with one tweak in 4f (commit message): use `feat(#$ARGUMENTS): ...` / `fix(#$ARGUMENTS): ...` convention for issue-scoped commits (carry from `issue-implement.md:44`). Structural-mismatch debug temp file: `tasks/codex-debug-issue-$ARGUMENTS-{phase}.tmp` (issue-scoped).
7. Step 5 (post-impl verification) — same as `/implement` Step 5.
8. Step 6 (Codex code review):
   - Run with `run_in_background` (Axis 7 = A — background).
   - Codex prompt: same as `/implement` Step 6 PARTS 1-2 (prelude for multi-batch only fires if applicable), but adapt input refs to `tasks/plan-issue-$ARGUMENTS.md` and `tasks/research-issue-$ARGUMENTS.md`.
   - Add a PART for "Acceptance criteria coverage" (carry from `issue-code-review-codex.md:24-27`): for each acceptance criterion in `tasks/issues.md` issue `#$ARGUMENTS`, mark it Covered or Missing.
   - Output path: `tasks/codex-issue-code-review-$ARGUMENTS.tmp`.
   - Verify: `bash .claude/scripts/codex-output-check.sh tasks/codex-issue-code-review-$ARGUMENTS.tmp 10`.
   - 600000ms timeout.
9. Step 7 (triage findings) — same as `/implement` Step 7. Output: `tasks/code-review-fixes-issue-$ARGUMENTS.tmp` (issue-scoped per design Open Question resolution).
10. Step 8 (apply via child process) — same as `/implement` Step 8 with the fix-instructions path adapted:
    ```bash
    mkdir -p tasks/logs && TIMESTAMP=$(date +%Y%m%d-%H%M) && claude -p "Read tasks/code-review-fixes-issue-$ARGUMENTS.tmp. Apply each fix listed under '## Code Review Fixes' exactly as described. ... Do NOT commit ... You are running non-interactively — do not ask questions." --dangerously-skip-permissions > tasks/logs/code-review-fixes-issue-$ARGUMENTS-$TIMESTAMP.log 2>&1
    ```
    `run_in_background`.
11. Step 9 (final verification) — same as `/implement` Step 9. Commit message: `fix(#$ARGUMENTS): apply code review revisions`.
12. Step 10 (cleanup) — delete:
    - `tasks/codex-issue-code-review-$ARGUMENTS.tmp`
    - `tasks/code-review-fixes-issue-$ARGUMENTS.tmp`
    - Any `tasks/codex-debug-issue-$ARGUMENTS-*.tmp` files
13. **New Step 10.5 — Update issue status to `Implemented`** in `tasks/issues.md` (carry from `issue-implement.md:56`).
14. Step 11 (present results) — same as `/implement` Step 11. Suggest: "Run `/issue-update $ARGUMENTS` next."

**Files changed:** `.claude/commands/issue-implement.md` (overwrite).

**Success criteria:**
- [x] `grep -q 'model_reasoning_effort=xhigh' .claude/commands/issue-implement.md`
- [x] `grep -q 'run_in_background' .claude/commands/issue-implement.md`
- [x] `grep -q 'codex-output-check.sh' .claude/commands/issue-implement.md`
- [x] `grep -q 'tasks/code-review-fixes-issue-\$ARGUMENTS\.tmp' .claude/commands/issue-implement.md`
- [x] `grep -q 'tasks/codex-issue-code-review-\$ARGUMENTS\.tmp' .claude/commands/issue-implement.md`
- [x] `grep -q -- '--dangerously-skip-permissions' .claude/commands/issue-implement.md`
- [x] `grep -q 'In Progress' .claude/commands/issue-implement.md && grep -q 'Implemented' .claude/commands/issue-implement.md`
- [x] `grep -q 'CORRECTION:' .claude/commands/issue-implement.md && grep -q 'TRADE-OFF:' .claude/commands/issue-implement.md && grep -q 'RISK:' .claude/commands/issue-implement.md`
- [x] `grep -q 'Acceptance' .claude/commands/issue-implement.md` (acceptance-criteria PART carried from old issue-code-review-codex)
- [x] `grep -q 'tasks/logs/code-review-fixes-issue-\$ARGUMENTS' .claude/commands/issue-implement.md`
- [x] `grep -q '600000' .claude/commands/issue-implement.md`

Commit: `feat(issue-implement): integrate Codex code review + child-process apply, mirror /implement`

---

### Phase 4 — Orchestrator + integrity-check update (atomic)

Phase 4 collapses `/auto-issues` to 7 contiguous phases AND updates `pipeline-eval.sh` to the new pipeline shape **in the same commit**. The two edits are co-evolving: between them, `pipeline-eval.sh` would FAIL on a real `/auto-issues` run because it expects 9-phase logs and the `## Review (Resolved)` marker that `/issue-plan` no longer writes. Atomicity eliminates that broken-state window.

Edit `.claude/commands/auto-issues.md`. Replace the 11-phase pipeline (`auto-issues.md:26-152`) with the 7-phase pipeline below. Keep the Prerequisites (lines 7-9), Setup block (lines 17-22), After All Phases section (lines 172-178), and Rules section (lines 180-188) unchanged where applicable.

**New phase shape (contiguous, Axis 9 = A):**

| New # | Old # | Command invoked | Background? | Artifact check |
|---|---|---|---|---|
| 1. Research | 1 | `/issue-research` (renamed) | yes | `tasks/research-issue-N.md` exists |
| 2. Plan | 2+3+4 | `/issue-plan` (integrated) | yes | `tasks/plan-issue-N.md` exists |
| 3. Implement | 5+6+7 | `/issue-implement` (integrated) | yes | issue status is `Implemented` |
| 4. Update | 8 | `/issue-update` (unchanged) | no, foreground | issue status is `Done` |
| 5. Commit & Push | 9 | `/commit` (unchanged) | no, foreground | working tree clean |
| 6. Evaluate | 10 | `pipeline-eval.sh` directly | no | (script exit) |
| 7. Cleanup | 11 | inline cleanup | no | — |

**Specific edits:**
1. Replace `auto-issues.md:26-36` (Phase 1: Research) — change `.claude/commands/issue-research-codex.md` → `.claude/commands/issue-research.md`. Log filename: `auto-issue-$ARGUMENTS-1-research-$TIMESTAMP.log` (unchanged).
2. Replace `auto-issues.md:38-48` (Phase 2: Plan) — keep header `### Phase 2: Plan`. Change to `run_in_background` (was `Timeout: 600000ms` foreground); the integrated `/issue-plan` runs Codex internally. Log filename: `auto-issue-$ARGUMENTS-2-plan-$TIMESTAMP.log`.
3. **Delete** `auto-issues.md:50-77` (Phases 3 + 4 — old plan-review and apply-review).
4. Replace `auto-issues.md:79-89` (Phase 5: Implement) — renumber to `### Phase 3: Implement`. Keep `run_in_background`. Log filename: `auto-issue-$ARGUMENTS-3-implement-$TIMESTAMP.log`. Artifact check: `issue #$ARGUMENTS status is Implemented`.
5. **Delete** `auto-issues.md:91-116` (Phases 6 + 7 — old code-review and apply-code-review).
6. Replace `auto-issues.md:118-128` (Phase 8: Update) — renumber to `### Phase 4: Update`. Foreground. Log filename: `auto-issue-$ARGUMENTS-4-update-$TIMESTAMP.log`.
7. Replace `auto-issues.md:130-140` (Phase 9: Commit & Push) — renumber to `### Phase 5: Commit & Push`. Foreground. Log filename: `auto-issue-$ARGUMENTS-5-commit-$TIMESTAMP.log`.
8. Replace `auto-issues.md:142-152` (Phase 10: Evaluate) — renumber to `### Phase 6: Evaluate`. No log file (mechanical script run in current session).
9. Replace `auto-issues.md:154-170` (Phase 11: Cleanup) — renumber to `### Phase 7: Cleanup`. Update the deletion list. Per Axis 8 = A the integrated commands clean their own Codex temp files at end-of-run, but Phase 7 keeps **defensive `rm -f` deletes** as belt-and-suspenders for the case where an integrated command was interrupted before its cleanup step ran. The cleanup block becomes (in shell form):

    ```bash
    rm -f tasks/research-issue-$ARGUMENTS.md
    rm -f tasks/plan-issue-$ARGUMENTS.md
    # Defensive — integrated commands clean these in normal exit, but interrupted runs leave them behind
    rm -f tasks/codex-issue-prompt-$ARGUMENTS.tmp
    rm -f tasks/codex-issue-research-$ARGUMENTS.tmp
    rm -f tasks/codex-issue-plan-review-$ARGUMENTS.tmp
    rm -f tasks/codex-issue-code-review-$ARGUMENTS.tmp
    rm -f tasks/code-review-fixes-issue-$ARGUMENTS.tmp
    rm -f tasks/codex-debug-issue-$ARGUMENTS-*.tmp
    ```

   Keep the `Do NOT delete:` block (issues.md, deferred.md, logs/). Keep the final commit + push block.

**Then, in the same phase, edit `.claude/scripts/pipeline-eval.sh`:**

10. Line 13 (log-completeness header comment) — change "all 9 logs" → "all 5 logs" (Phases 6 and 7 don't run as `claude -p` children, so they produce no logs — same as today's behavior where Phases 10/11 are also unlogged).
11. Line 14 (log-completeness `for phase in ...` loop) — replace the 9-phase list with the 5-phase list:
    ```bash
    for phase in 1-research 2-plan 3-implement 4-update 5-commit; do
    ```
12. Lines 21-22 (substance check comment + loop) — every Phase 1-5 child process now produces non-empty Claude output (no Codex-only phases at the parent level — Codex runs inside the integrated commands, not as standalone phases). Replace the substance loop to check ALL 5 phases:
    ```bash
    # All 5 phases produce substantive Claude output
    for phase in 1-research 2-plan 3-implement 4-update 5-commit; do
    ```
13. Lines 41-51 (Codex temp-file substance check) — **delete the entire block** (per Axis 8 = A, integrated commands clean their own temp files; by eval time the files don't exist; substance check is impossible).
14. Lines 53-57 (`## Review (Resolved)` marker check) — **delete the entire block** (per Axis 3 = A, integrated `/issue-plan` absorbs review in place; no marker is written).
15. Section 2 (artifact substance, lines 30-39) — unchanged. Still checks `tasks/research-issue-N.md` and `tasks/plan-issue-N.md` for ≥20 lines.
16. Section 5 (eval index append, lines 60-67) and final output (lines 69-71) — unchanged.

**Files changed:** `.claude/commands/auto-issues.md` and `.claude/scripts/pipeline-eval.sh` (both in the same commit).

**Success criteria (auto-issues):**
- [x] `! grep -q 'issue-plan-review-codex' .claude/commands/auto-issues.md`
- [x] `! grep -q 'issue-code-review-codex' .claude/commands/auto-issues.md`
- [x] `! grep -q 'issue-research-codex' .claude/commands/auto-issues.md`
- [x] `grep -q '\.claude/commands/issue-research\.md' .claude/commands/auto-issues.md`
- [x] `grep -E '^### Phase [1-7]:' .claude/commands/auto-issues.md | wc -l` returns `7`
- [x] `! grep -E '^### Phase (8|9|10|11):' .claude/commands/auto-issues.md` (no leftover phases)
- [x] `! grep -q 'apply-review\|apply-code-review' .claude/commands/auto-issues.md` (inline apply prompts gone)
- [x] `grep -q 'auto-issue-\$ARGUMENTS-1-research' .claude/commands/auto-issues.md`
- [x] `grep -q 'auto-issue-\$ARGUMENTS-3-implement' .claude/commands/auto-issues.md`
- [x] `grep -q 'auto-issue-\$ARGUMENTS-5-commit' .claude/commands/auto-issues.md`
- [x] `grep -q 'rm -f tasks/codex-issue-prompt-\$ARGUMENTS\.tmp' .claude/commands/auto-issues.md` (defensive cleanup wired in)

**Success criteria (pipeline-eval.sh):**
- [x] `bash -n .claude/scripts/pipeline-eval.sh` (syntax valid)
- [x] `grep -q '1-research 2-plan 3-implement 4-update 5-commit' .claude/scripts/pipeline-eval.sh`
- [x] `! grep -q '3-review\|4-apply-review\|6-code-review\|7-apply-code-review\|8-update\|9-commit' .claude/scripts/pipeline-eval.sh`
- [x] `! grep -q 'Review (Resolved)' .claude/scripts/pipeline-eval.sh`
- [x] `! grep -q 'tasks/codex-issue-plan-review' .claude/scripts/pipeline-eval.sh`
- [x] `! grep -q 'tasks/codex-issue-code-review' .claude/scripts/pipeline-eval.sh`
- [x] `! grep -q 'tasks/codex-issue-research' .claude/scripts/pipeline-eval.sh`
- [x] `grep -q 'tasks/research-issue-\$ISSUE\.md' .claude/scripts/pipeline-eval.sh && grep -q 'tasks/plan-issue-\$ISSUE\.md' .claude/scripts/pipeline-eval.sh` (artifact substance check preserved)

Commit: `refactor(auto-issues, pipeline-eval): collapse to 7-phase pipeline; drop obsolete review/temp-file checks`

---

### Phase 5 — Cross-reference sweep

Update the six files that advertise the split commands, plus the pre-existing `tasks/issues.md:4-5` inconsistency (Axis 11 = A, bundled).

**File-by-file edits:**

1. **`README.md:51-56`** — issue workflow command table. Replace 6 rows (3 `-codex` + 3 baseline) with 4 rows:
    ```
    | `/issue-research` | Codex sweeps issue, Claude synthesizes + recommends approach; writes `tasks/research-issue-N.md` |
    | `/issue-plan` | Draft plan, Codex reviews, absorb findings; writes `tasks/plan-issue-N.md` |
    | `/issue-implement` | Execute plan phase-by-phase, run Codex code review, apply triaged fixes via child process |
    | `/issue-update` | Check impact of completed issue on other open issues |
    ```
   Keep the `/auto-issues` row at line 57 (unchanged).

2. **`quickref.md:31-36`** — same shape as README. Replace 6 rows with 4 rows of equivalent content (formatting matches the existing column widths):
    ```
    | `/issue-research #N`    | Codex sweeps + Claude synthesizes + recommends → `tasks/research-issue-N.md` |
    | `/issue-plan #N`        | Draft plan, Codex reviews, absorb findings → `tasks/plan-issue-N.md`         |
    | `/issue-implement #N`   | Execute plan + Codex code review + child-process fixes                       |
    | `/issue-update #N`      | After completion, check impact on other open issues                          |
    ```

3. **`CLAUDE.md:32`** — replace the line:
    ```
    Use `/issue-research-codex`, `/issue-plan`, `/issue-plan-review-codex`, `/issue-implement`, `/issue-code-review-codex` to move issues through the workflow.
    ```
    with:
    ```
    Use `/issue-research`, `/issue-plan`, `/issue-implement`, `/issue-update` to move issues through the workflow.
    ```

4. **`templates/new-issues.md:5`** — replace:
    ```
    > **Commands:** `/issue-research-codex`, `/issue-plan`, `/issue-plan-review-codex`, `/issue-implement`, `/issue-code-review-codex`, `/issue-update`
    ```
    with:
    ```
    > **Commands:** `/issue-research`, `/issue-plan`, `/issue-implement`, `/issue-update`
    ```

5. **`templates/deferred.md:4`** — replace:
    ```
    > **Updated by:** `/issue-plan-review-codex` moves items here when they fall outside the current plan's scope.
    ```
    with:
    ```
    > **Updated by:** `/issue-plan` moves items here when Codex's review surfaces work that falls outside the current plan's scope.
    ```

6. **`.claude/commands/playbook-update.md:25-30`** — managed-files list. Replace these 6 lines:
    ```
    .claude/commands/issue-research-codex.md
    .claude/commands/issue-plan.md
    .claude/commands/issue-plan-review-codex.md
    .claude/commands/issue-implement.md
    .claude/commands/issue-update.md
    .claude/commands/issue-code-review-codex.md
    ```
    with these 4 lines (in issue-workflow order — research → plan → implement → update — matching the QRSPI workflow ordering used elsewhere in the managed-files list):
    ```
    .claude/commands/issue-research.md
    .claude/commands/issue-plan.md
    .claude/commands/issue-implement.md
    .claude/commands/issue-update.md
    ```

7. **`tasks/issues.md:4-5`** — fix pre-existing inconsistency (Axis 11 = A). Replace these two lines:
    ```
    > **Status flow:** `Draft` → `In Research` → `In Planning` → `In Review` → `In Progress` → `Done` | `Deferred`
    > **Commands:** `/issue-research`, `/issue-plan`, `/issue-audit`, `/issue-implement`, `/issue-update`
    ```
    with:
    ```
    > **Status flow:** `Draft` → `In Research` → `In Planning` → `In Review` → `In Progress` → `Implemented` → `Done` | `Deferred`
    > **Commands:** `/issue-research`, `/issue-plan`, `/issue-implement`, `/issue-update`
    ```
   (Adds `Implemented` to flow; removes nonexistent `/issue-audit`.)

**Files changed:** `README.md`, `quickref.md`, `CLAUDE.md`, `templates/new-issues.md`, `templates/deferred.md`, `.claude/commands/playbook-update.md`, `tasks/issues.md`.

**Success criteria:**
- [x] `! grep -rn 'issue-research-codex\|issue-plan-review-codex\|issue-code-review-codex' README.md quickref.md CLAUDE.md templates/ .claude/commands/playbook-update.md` (all references gone from these surfaces)
- [x] `grep -q '/issue-research\b' README.md && grep -q '/issue-research\b' quickref.md && grep -q '/issue-research\b' CLAUDE.md && grep -q '/issue-research\b' templates/new-issues.md`
- [x] `grep -q '/issue-plan\b' templates/deferred.md`
- [x] `grep -q 'issue-research.md' .claude/commands/playbook-update.md`
- [x] `! grep -q '/issue-audit' tasks/issues.md` (nonexistent command removed)
- [x] `grep -q 'Implemented' tasks/issues.md` (status flow includes `Implemented`)
- [x] `grep -q 'In Review.*In Progress.*Implemented' tasks/issues.md` (status flow correctly ordered — `In Review` → `In Progress` → `Implemented`)

Commit: `docs: update cross-references to integrated issue-command surface`

---

### Phase 6 — Delete obsolete command files

Now that nothing references the old `-codex` issue commands, remove them.

**Files deleted:**
- `.claude/commands/issue-research-codex.md`
- `.claude/commands/issue-plan-review-codex.md`
- `.claude/commands/issue-code-review-codex.md`

**Final consistency check (post-delete):**
- The 5 issue-related commands that exist: `issue-research.md`, `issue-plan.md`, `issue-implement.md`, `issue-update.md`, `auto-issues.md`.

**Files changed:** none (deletions only).

**Success criteria:**
- [x] `test ! -f .claude/commands/issue-research-codex.md`
- [x] `test ! -f .claude/commands/issue-plan-review-codex.md`
- [x] `test ! -f .claude/commands/issue-code-review-codex.md`
- [x] `ls .claude/commands/issue-*.md .claude/commands/auto-issues.md | wc -l` returns `5`
- [x] `! grep -rn 'issue-research-codex\|issue-plan-review-codex\|issue-code-review-codex' .claude/ README.md quickref.md CLAUDE.md templates/ tasks/issues.md` (zero hits across the entire managed surface — `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/plan.md`, and `tasks/todo.md` are excluded since they document the migration itself; `tasks/todo.md:38` describes Task 6 by quoting the old command names)

Commit: `chore: remove obsolete -codex issue command files`

---

## Final End-to-End Verification (run after Phase 6)

After all 6 phases land, do a full smoke test of the new surface.

1. **Manual path:** if a tractable issue exists in `tasks/issues.md`, run `/issue-research $N`, `/issue-plan $N`, `/issue-implement $N` end-to-end. Verify each produces the expected artifact, sets the expected status, and cleans up its temp files. (Do NOT run on a real issue without developer approval — this is a dry-run check.)
2. **Auto path (developer-driven):** the developer runs `/auto-issues $N` on a real issue and confirms the 7-phase pipeline runs end-to-end and `pipeline-eval.sh` returns PASS.
3. **Static checks (in-session):**
   - [ ] `find .claude/commands -name 'issue-*.md' | sort` lists exactly: `issue-implement.md`, `issue-plan.md`, `issue-research.md`, `issue-update.md`.
   - [ ] `! grep -rn '\bissue-research-codex\|\bissue-plan-review-codex\|\bissue-code-review-codex\b' .claude/ README.md quickref.md CLAUDE.md templates/ tasks/issues.md` (excludes `tasks/todo.md`, which legitimately quotes the old command names while describing Task 6).
   - [ ] `bash -n .claude/scripts/pipeline-eval.sh` (script syntax valid).
   - [ ] `grep -E '^### Phase [1-7]:' .claude/commands/auto-issues.md | wc -l` returns `7`.

---

## Risks (from research §Risk Analysis, applied per phase)

- **Manual-path regression on review-only ergonomics** (Axis 4 = A) — `/issue-implement` always auto-applies non-flagged code-review fixes. Mitigation: the "Flagged for review" report (Phase 3 Step 11, mirrors `/implement` Step 11) preserves the surfacing of contested fixes. Behavior change is real and intentional per design Decision §Rationale.
- **`pipeline-eval.sh` silent misreport** if it lagged the orchestrator. Mitigation: Phase 4 bundles both edits in a single commit (`auto-issues` + `pipeline-eval.sh`) — there is no intermediate state where one is updated without the other. Success criteria assert the new shape on both files.
- **Cross-reference drift** if Phase 5 misses a file. Mitigation: Phase 5 success criteria include a recursive `grep` across all 6 surfaces returning zero hits, and Phase 6's success criteria re-run the same grep across the entire managed surface as a final gate (excluding `tasks/todo.md`, which legitimately quotes the old command names while describing Task 6).
- **In-flight artifacts from old workflow** — any `tasks/plan-issue-N.md` produced by the old `/issue-plan` + `/issue-plan-review-codex` flow may contain a `## Review` or `## Review (Resolved)` section. The new `/issue-implement` reads the plan but doesn't depend on the absence of those sections (it only reads phase definitions). Compatible — no migration step needed.
- **Recommended Approach quality regression** (Axis 5 = A) — `research-guide.md` produces axes only; Claude's synthesis layer in `/issue-research` Step 4 must do the recommendation lift (the old `issue-research-codex.md:36-38` baked it into Codex's prompt). Mitigation: Phase 1 explicitly specifies the synthesis sub-step ("pick highest-merit axis-choice combination, write `## Recommended Approach` section with one paragraph per axis").
- **Multi-batch handling inheritance** — `/issue-implement` inherits `/implement`'s multi-batch PRELUDE in the Codex code-review prompt. Side effect, not deliberate scope. Safe — the PRELUDE only fires "if `tasks/plan-issue-N.md` flags itself as a multi-batch plan."
- **Squash-merge disclosure** (memory `feedback_squash_merge_default.md`) — irrelevant for this task; no PR-level changes.

## Judgment Calls

Numbered list of choices where an alternative was viable. The design fixed Axes 1-11; these are sub-choices made during plan construction.

1. **Build new `/issue-research` at new path before deleting old (Phases 1 + 6) instead of atomic file rename.** Alternative: rename `issue-research-codex.md` → `issue-research.md` in Phase 1 and update `/auto-issues` reference in the same phase. Chose split because it keeps the old surface alive through Phases 1-3, allowing partial rollback at any phase boundary if a smoke test fails. Cost: one extra file on disk for ~4 phases.
2. **Phase ordering: build commands (1-3) → swap orchestrator + integrity check atomically (4) → fix docs (5) → delete (6).** Alternative: docs-first then commands-last. Chose commands-first because each phase's success criteria can be verified against real files; docs-first would have grep assertions pass against text describing files that don't exist yet. The orchestrator + integrity-check edits are atomic in Phase 4 (single commit) because intermediate state would have `pipeline-eval.sh` failing on a real `/auto-issues` run — Codex's review explicitly flagged this as a RISK and the merge resolves it.
3. **Issue-scoped Codex prompt scratch file: `tasks/codex-issue-prompt-N.tmp`.** Alternative: reuse `tasks/codex-prompt.tmp` (singleton path used by `/research-codebase`). Chose issue-scoped to avoid collision when `/auto-issues` and a developer's manual `/research-codebase` ever ran concurrently. The singleton path is fine in practice but cheap to issue-scope.
4. **Issue-scoped code-review fixes hand-off: `tasks/code-review-fixes-issue-N.tmp`.** Per design Open Question #2 resolution. Alternative: reuse `tasks/code-review-fixes.tmp`. Chose issue-scoped to avoid collision with concurrent singleton `/implement` runs.
5. **`/issue-plan`'s Codex prompt PARTS — full QRSPI 6-PART set, plus explicit pointer to "the issue body in tasks/issues.md (acceptance criteria are in the issue, not a separate design doc)".** Alternative: drop PART 5 (acceptance-criteria coverage from `/create-plan`'s prompt — it references `tasks/design-decision.md` which doesn't exist in the issue flow). Chose to keep PART 5 with the input-pointer adapted because the issue's Acceptance Criteria block is the structural equivalent of the design's acceptance criteria; coverage check is still the right gate.
6. **`/issue-plan`'s deferred-item handling lives between Steps 4 (absorb) and 5 (verify) as Step 4.5.** Alternative: merge into Step 4. Kept separate because it operates on a different artifact (`tasks/deferred.md`, not `tasks/plan-issue-N.md`), and the existing `issue-plan-review-codex.md:51-55` shape splits them — preserves the precedent.
7. **`/issue-implement` Codex code-review prompt — adds an "Acceptance criteria coverage" PART borrowed from `issue-code-review-codex.md:24-27`.** Alternative: drop the acceptance-criteria PART (singleton `/implement` doesn't have one). Chose to keep it because the issue flow has a structured Acceptance Criteria block in `tasks/issues.md` that's the right correctness gate at code-review time; dropping it loses a real check that the old surface had.
8. **Final issue status setter for integrated `/issue-plan` is `In Review` (Axis 10 = A in design).** Alternative: `In Planning` (Axis 10 = B) or drop `In Review` from the flow (Axis 10 = C). Stayed with design's choice.
9. **`/auto-issues` Phase 7 (Cleanup) keeps defensive `rm -f` for the Codex temp files** even though the integrated commands own primary cleanup (Axis 8 = A). Alternative: strict — rely solely on commands' own cleanup. Chose belt-and-suspenders because Codex's plan review surfaced the interruption hazard (a command interrupted mid-run leaves its temp files, which then accumulate). The `rm -f` calls are 7 lines, idempotent, and don't change the meaning of Axis 8 = A — commands still own primary cleanup; the orchestrator just safety-nets it.
10. **`tasks/issues.md:4-5` fix bundled into Phase 5 (cross-reference sweep)** instead of a separate phase. Cheap collateral; bundled because the same edit batch already touches `templates/new-issues.md:4-5`'s status flow and command list.

## Artifact References

- Research: `tasks/research-codebase.md` — file map, axes (1-11), coupling, cross-cutting constraints, risks
- Design: `tasks/design-decision.md` — chosen Option A with Codex amendments, rationale, scope boundaries
