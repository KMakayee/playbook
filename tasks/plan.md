# Plan: Migrate long-running Codex / `claude -p` calls to background-by-default (Task 10)

## Design decision reference

Implements **Option B — Hardened scoped migration** from `tasks/design-decision.md` (with the optional two-site `-a never` cleanup and the single stray-timeout deletion folded in). Axis choices: 1a (11 foreground sites only) · 2a (uniform bold callout) · 3 moot (no timeout value carried) · 4a (`-o tasks/*.tmp` only, no Codex log redirect) · 5b (`-a never` on every newly-backgrounded Codex site) · 6 (harness notification + `codex-output-check.sh` for end-of-step sites, explicit wait for mid-loop sites).

Research: `tasks/research-codebase.md`. Design: `tasks/design-decision.md`.

This is a **prose-spec migration** of `.claude/commands/*.md` — fenced bash blocks plus the directive prose around them. No application/source code changes.

## Scope boundaries (what we are NOT doing)

- Not changing application/source code — `.claude/commands/*.md` prose edits only.
- Not centralizing the `run_in_background` / `</dev/null` rules in `CLAUDE.md` — both stay at each invocation site.
- Not migrating short / stdin-coupled foreground git ops (`git merge` in `catchup.md`, `git fetch --unshallow` in `playbook-update.md`).
- Not migrating `/auto-issues` Phase 5 or `/issue-implement` Step 8 — both are inline post-Task 11 (stale spec text).
- Not removing `--search` from the research / pattern-research Codex sites.
- Not normalizing the already-backgrounded sites' prose shape, flags, or log redirection — **except** Phase 6's targeted cleanups: the two-site `-a never` addition and the stray-timeout deletions in `issue-implement.md` and `implement-codex.md` (dead-prose removal only — see Judgment Call #8).
- Not adding `> tasks/logs/…log 2>&1` redirects to Codex sites (Axis 4a — keep `-o tasks/*.tmp` only).
- Not adding any `timeout` value to migrated-site prose — a `timeout` parameter is inert on a `run_in_background: true` call, which returns immediately.

## The 11 verified migration targets (fresh grep, 2026-05-20)

| # | File | Codex/`claude -p` line | Timeout-sentence line | Type |
|---|------|------------------------|------------------------|------|
| 1 | `research-codebase.md` | 43 (`codex … --search exec`) | 48 | end-of-step |
| 2 | `design.md` | 87 (`codex … exec`) | 84 | end-of-step |
| 3 | `design.md` | 137 (`codex … exec`, tiebreaker) | 134 | conditional mid-loop |
| 4 | `design.md` | 195 (`codex … --search exec`) | 192 | end-of-step (conditional RUN/SKIP) |
| 5 | `create-plan.md` | 55 (`codex … exec`) | 52 | end-of-step |
| 6 | `issue-research.md` | 43 (`codex … --search exec`) | 48 | end-of-step |
| 7 | `issue-plan.md` | 61 (`codex … exec`) | 58 | end-of-step |
| 8 | `codex-review.md` | 58 (`codex exec`) | 55 | end-of-step (+ new output-check) |
| 9 | `implement.md` | 39 (`codex … exec`, re-research) | 52 | conditional mid-loop |
| 10 | `issue-implement.md` | 46 (`codex … exec`, re-research) | 59 | conditional mid-loop |
| 11 | `auto-issues.md` | 89 (`claude -p`, Phase 4 Update) | 86 (`**Timeout: 600000ms.**`) | `claude -p` end-of-step |

Sites #1–#10 are `codex exec` → get `-a never`. Site #11 is `claude -p` → no `-a never` (already has `--permission-mode auto`).

Line numbers are pre-edit and shift as edits land. The implementer must Read each file before editing (per `CLAUDE.md` Quality Standards) and locate sites by content, not by frozen line number.

## Canonical prose shapes

**Background callout — end-of-step Codex sites (#1, #2, #4, #5, #6, #7, #8):** a bold line immediately above the ` ```bash ` fence:

> `**Run with `run_in_background: true` — this is a Bash-tool parameter (set it when you call the Bash tool), not shell syntax. Codex phase, may take 10+ minutes.**`

**Background callout — conditional mid-loop Codex sites (#3, #9, #10):** same, with an added wait clause:

> `**Run with `run_in_background: true` — this is a Bash-tool parameter (set it when you call the Bash tool), not shell syntax. Codex phase, may take 10+ minutes. This fires mid-loop: wait for the completion notification and finish the output check below before resuming.**`

**Background callout — `claude -p` site (#11):** same shape, no "Codex phase" wording:

> `**Run with `run_in_background: true` — this is a Bash-tool parameter (set it when you call the Bash tool), not shell syntax. May take 10+ minutes.**`

**`-a never` placement:** insert `-a never` immediately before the `exec` subcommand, matching `implement-codex.md:124`:
- `codex -c model_reasoning_effort=xhigh exec` → `codex -c model_reasoning_effort=xhigh -a never exec`
- `codex -c model_reasoning_effort=xhigh --search exec` → `codex -c model_reasoning_effort=xhigh --search -a never exec`
- `codex exec` (codex-review.md only) → `codex -a never exec`

**Constants at every touched site:** `</dev/null` is preserved verbatim (attached to the `codex`/`claude -p` simple command, before any redirection). The "Use a 10-minute timeout (600000ms)…" sentence is **deleted, not replaced** with another value.

---

## Phase 1 — Empirical smoke-test gate (no file edits)

**This phase is a go/no-go gate. If it fails, STOP and revisit the task premise with the developer — do not proceed to Phase 2.** The entire migration's value rests on backgrounded Bash commands escaping the foreground timeout ceiling (Open Question 2, design line 82, research Risk Analysis).

1. **Capture the `</dev/null` baseline** for the regression check in Phase 7. Expected current total across `.claude/commands/*.md` is **23** (auto-issues 4, codex-review 1, create-plan 1, design 3, implement-codex 6, implement 3, issue-implement 2, issue-plan 1, issue-research 1, research-codebase 1). Re-confirm:
   ```bash
   for f in .claude/commands/*.md; do c=$(grep -c '</dev/null' "$f"); [ "$c" -gt 0 ] && echo "$(basename "$f"): $c"; done; echo "total: $(grep -rh '</dev/null' .claude/commands/*.md | wc -l | tr -d ' ')"
   ```
2. **Run the deterministic background timeout test.** Issue this command via the Bash tool with `run_in_background: true` and `timeout: 600000` (the documented 600000ms maximum). The command sleeps ~650s — well past both the 120000ms foreground default and the 600000ms ceiling:
   ```bash
   rm -f /tmp/pb-bg-smoke.txt && date +%s > /tmp/pb-bg-smoke.txt && sleep 650 && date +%s >> /tmp/pb-bg-smoke.txt && echo SMOKE_OK >> /tmp/pb-bg-smoke.txt
   ```
3. **Do not poll.** Wait for the harness completion notification for the background task.
4. **Evaluate the result** once notified — read `/tmp/pb-bg-smoke.txt`:
   - **PASS** if the file contains `SMOKE_OK` and the two epoch timestamps differ by ≥ ~640s. This proves a backgrounded Bash command is not killed at the timeout ceiling → the migration is sound → proceed to Phase 2.
   - **FAIL** if the file is missing `SMOKE_OK`, the timestamps are < ~640s apart, or the task was reported killed/timed-out. STOP. Report to the developer that backgrounding does not exempt a command from the timeout cap and the Task 10 premise needs revisiting.
5. **Note the `/codex-review` liveness observation** (design Open Question / line 83): record whether background output was visible live or only after completion. This is documentation-only — the implementation prose must NOT promise live streaming. No artifact change results unless live streaming is observed to be promised somewhere (it is not in current `codex-review.md`).
6. Clean up: `rm -f /tmp/pb-bg-smoke.txt`.

**Success criteria:**
- Smoke test PASSED (per step 4). If FAILED, the plan halts here by design.
- Baseline `</dev/null` total recorded (expected 23).

---

## Phase 2 — Migrate end-of-step Codex sites (#1, #2, #4, #5, #6, #7)

Six sites across five files: `research-codebase.md` (#1), `design.md` (#2 and #4), `create-plan.md` (#5), `issue-research.md` (#6), `issue-plan.md` (#7).

For **each** of the six sites, apply three changes **in this order** — additions first, deletion last — so a site interrupted mid-edit never loses guidance (at worst it briefly carries both the old timeout sentence and the new callout, which is harmless; the reverse would leave a site with neither):
1. **Add the end-of-step background callout** (canonical shape above) as a bold line immediately above the ` ```bash ` fence. For sites inside numbered-list items (#1 item 6, #6 item 6) indent the callout to the list item's content column so the fence and callout stay in the same item.
2. **Add `-a never`** to the `codex` command inside the bash block (placement rules above). #1, #4, #6 are `--search` sites → `--search -a never exec`. #2, #5, #7 → `-c model_reasoning_effort=xhigh -a never exec`.
3. **Delete the timeout sentence.** Remove `Use a 10-minute timeout (600000ms) — Codex may take a while on large codebases.` (and equivalents). Sites:
   - `research-codebase.md:48`
   - `design.md:84` — the sentence is the trailing clause of `2. Run Codex. Use a 10-minute timeout (600000ms) — …:`; reduce that line to `2. Run Codex:`.
   - `design.md:192` — currently `2. Run Codex with `--search` (foreground, 10-minute timeout / 600000ms — matches the other RDPI Codex calls):`. Replace the whole parenthetical; reduce to `2. Run Codex with `--search`:`. The "foreground … matches the other RDPI Codex calls" rationale is now inverted and must go (research site #4 / line 28).
   - `create-plan.md:52` — line is `Run Codex against the drafted plan. Use a 10-minute timeout (600000ms) — …:`; reduce to `Run Codex against the drafted plan:`.
   - `issue-research.md:48`
   - `issue-plan.md:58` — same shape as create-plan.md:52.

Do **not** touch the `codex-output-check.sh` verify step or the "After Codex finishes, read … FULLY" line at any of these sites — they remain correct for background execution (the completion notification precedes them). Do **not** touch the "If the `codex` command is not found or fails…" fallback line. Preserve `</dev/null`.

**Success criteria:**
```bash
grep -c "10-minute timeout" .claude/commands/research-codebase.md   # expect 0
grep -c "10-minute timeout" .claude/commands/create-plan.md         # expect 0
grep -c "10-minute timeout" .claude/commands/issue-research.md      # expect 0
grep -c "10-minute timeout" .claude/commands/issue-plan.md          # expect 0
grep -c "10-minute timeout" .claude/commands/design.md              # expect 1 (only the #3 tiebreaker, removed in Phase 4)
grep -c "run_in_background: true" .claude/commands/research-codebase.md  # expect 1
grep -c "run_in_background: true" .claude/commands/design.md             # expect 2 (#2 and #4)
grep -c "run_in_background: true" .claude/commands/create-plan.md        # expect 1
grep -c "run_in_background: true" .claude/commands/issue-research.md     # expect 1
grep -c "run_in_background: true" .claude/commands/issue-plan.md         # expect 1
grep -n "a never exec" .claude/commands/research-codebase.md .claude/commands/create-plan.md .claude/commands/issue-research.md .claude/commands/issue-plan.md  # one hit each
grep -c "a never exec" .claude/commands/design.md                   # expect 2 (#2 and #4)
# </dev/null preserved:
grep -c '</dev/null' .claude/commands/research-codebase.md  # expect 1
grep -c '</dev/null' .claude/commands/design.md             # expect 3
grep -c '</dev/null' .claude/commands/create-plan.md        # expect 1
grep -c '</dev/null' .claude/commands/issue-research.md     # expect 1
grep -c '</dev/null' .claude/commands/issue-plan.md         # expect 1
```
Then read each of the five files' edited regions to confirm the callout sits directly above the fence and the bash block is still well-formed.

Commit: `feat(task-10): background-by-default for end-of-step Codex sweep/review sites`.

---

## Phase 3 — Migrate `/codex-review` (#8) with paired output-check

`codex-review.md` (#8) needs the standard migration **plus** a new output-verification step, because Step 4 currently reads `tasks/codex-review.tmp` directly and a backgrounded resume can land on a missing/short file (design cross-cutting constant; research Axis Coupling).

Apply additions before deletions (same interruption-safety reasoning as Phase 2):
1. **Add the end-of-step background callout** (canonical shape) immediately above the ` ```bash ` fence at line 57.
2. **Add `-a never`:** `codex exec` → `codex -a never exec` at line 58. Preserve `</dev/null` at line 61.
3. **Add a `codex-output-check.sh` gate at the start of Step 4** ("Spot-check Codex's claims", currently line 66–68). Before "Read `tasks/codex-review.tmp` FULLY", insert:
   > Verify the output first: `bash .claude/scripts/codex-output-check.sh tasks/codex-review.tmp 5`. If the check fails, run `rm -f tasks/codex-review.tmp tasks/codex-review-prompt.tmp`, then stop and tell the developer — the cleanup must run before the stop so the no-persistent-artifact boundary holds even on failure.
   The `rm -f` on failure mirrors the existing discipline at `codex-review.md:64`. Min-lines `5` matches `codex-output-check.sh`'s documented default (`codex-output-check.sh:9`) and tolerates a terse `_no findings_` report.
4. **Delete the timeout sentence** at `codex-review.md:55` (`Run with a 10-minute timeout (600000ms) — Codex may take a while on larger targets:`). Reduce Step 3's lead-in to `Run Codex:` or fold it into the callout.
5. Leave the existing Step 3 fallback line (`If the `codex` command is not found or fails, run `rm -f …`, then stop…`) unchanged — it remains the failure path for a Codex binary that is absent entirely.
6. Implementation prose must **not** claim background mode streams output live (design Open Question / line 83).

**Success criteria:**
```bash
grep -c "10-minute timeout" .claude/commands/codex-review.md   # expect 0
grep -c "run_in_background: true" .claude/commands/codex-review.md  # expect 1
grep -c "a never exec" .claude/commands/codex-review.md        # expect 1
grep -c "codex-output-check.sh tasks/codex-review.tmp" .claude/commands/codex-review.md  # expect 1
grep -c '</dev/null' .claude/commands/codex-review.md          # expect 1
```
Read Steps 3–5 of `codex-review.md` end-to-end to confirm: callout above the fence, output-check before the tmp is read, failure path cleans up both tmp files before stopping.

Commit: `feat(task-10): background /codex-review with paired output verification`.

---

## Phase 4 — Migrate conditional mid-loop Codex sites (#3, #9, #10)

Three sites that fire *inside* a decision/phase loop, not at a clean step boundary: `design.md` #3 (tiebreaker), `implement.md` #9 (structural-mismatch re-research), `issue-implement.md` #10 (structural-mismatch re-research). They get the **mid-loop callout** (with the wait clause) so the agent does not resume the loop before the background result lands.

For **each** site, apply additions before the deletion (same interruption-safety reasoning as Phase 2):
1. **Add the mid-loop background callout** (canonical mid-loop shape, with the wait clause) immediately above the ` ```bash ` fence:
   - `design.md` above line 136
   - `implement.md` above line 39 (indent to the `c.` sub-item content column — the block is nested under "c. Handle mismatches")
   - `issue-implement.md` above line 46 (same nested indentation)
2. **Add `-a never`:** all three are `codex -c model_reasoning_effort=xhigh exec` → `codex -c model_reasoning_effort=xhigh -a never exec`. Preserve `</dev/null`.
3. **Delete the timeout sentence:**
   - `design.md:134` — remove the `Use a 10-minute timeout (600000ms) — Codex may take a while on large codebases.` sentence from the end of the paragraph that begins `**Before running, replace `{SPECIFIC_QUESTION}`…**`. Keep the rest of that paragraph.
   - `implement.md:52` — remove `Use a 10-minute timeout (600000ms). ` from the start of the line; keep `Read the output, adapt the plan, and continue. (Sub-agents are no longer used here …)`.
   - `issue-implement.md:59` — same as implement.md:52.

Leave each site's existing `codex-output-check.sh` verify line intact (`design.md:147`, `implement.md:50`, `issue-implement.md:57`) — the wait clause in the callout tells the agent to finish that check before resuming the loop.

**Success criteria:**
```bash
grep -c "10-minute timeout" .claude/commands/design.md          # expect 0 (both #2/#4 from Phase 2 and #3 now gone)
grep -c "10-minute timeout" .claude/commands/implement.md       # expect 0
grep -c "10-minute timeout" .claude/commands/issue-implement.md # expect 1 (only the stray Step-6 line, removed in Phase 6)
grep -c "run_in_background: true" .claude/commands/design.md          # expect 3 (#2, #4, #3)
grep -c "run_in_background: true" .claude/commands/implement.md       # expect 1 (the #9 mid-loop callout)
grep -c "run_in_background: true" .claude/commands/issue-implement.md # expect 1 (the #10 mid-loop callout)
grep -c "wait for the completion notification" .claude/commands/design.md .claude/commands/implement.md .claude/commands/issue-implement.md  # one hit each file
grep -c "a never exec" .claude/commands/design.md          # expect 3 (#2, #4, #3)
grep -c "a never exec" .claude/commands/implement.md       # expect 1 (the #9 mid-loop site)
grep -c "a never exec" .claude/commands/issue-implement.md # expect 1 (the #10 mid-loop site)
grep -c '</dev/null' .claude/commands/design.md          # expect 3
grep -c '</dev/null' .claude/commands/implement.md       # expect 3
grep -c '</dev/null' .claude/commands/issue-implement.md # expect 2
```
Read the edited regions of all three files to confirm the mid-loop callout (with wait clause) sits above each fence and the bash blocks are well-formed.

Commit: `feat(task-10): background-by-default for conditional mid-loop Codex sites`.

---

## Phase 5 — Migrate `/auto-issues` Phase 4 (#11, `claude -p`)

`auto-issues.md` Phase 4 (the Update phase) is the lone foreground `claude -p` child; Phases 1–3 are already backgrounded.

1. **Replace** `**Timeout: 600000ms.**` at `auto-issues.md:86` with the **`claude -p` background callout** (canonical shape, no "Codex phase" wording).
2. Do not touch the bash block at line 89 — `claude -p` already carries `--permission-mode auto` (the non-interactive guarantee; no `-a never` equivalent applies) and `</dev/null`.
3. Do not touch Phases 1–3 callouts or Phase 5 (inline commit) — out of scope.

**Success criteria:**
```bash
grep -c "Timeout: 600000ms" .claude/commands/auto-issues.md      # expect 0
grep -c "run_in_background" .claude/commands/auto-issues.md      # expect 4 (Phases 1-3 short form + Phase 4 new)
grep -c "run_in_background: true" .claude/commands/auto-issues.md # expect 1 (Phase 4 only — Phases 1-3 keep their existing short form)
grep -c '</dev/null' .claude/commands/auto-issues.md             # expect 4
```
Read the Phase 4 region to confirm the callout sits above the bash block.

Commit: `feat(task-10): background-by-default for /auto-issues Phase 4 update child`.

---

## Phase 6 — Option B extension: `-a never` cleanup + stray-timeout deletions on already-backgrounded sites

The design folds in `-a never` and stray-timeout cleanups on already-backgrounded (compliant) sites (design lines 49, 51). This phase also extends the stray-timeout deletion to `/implement-codex` (Task 12): items 4–5 below remove two timeout sentences that sit on `run_in_background: true` calls and are therefore inert by the design's own logic (a `timeout` value is meaningless on a call that returns immediately — design Constants, line 19). The design declared `/implement-codex` a "no-op target" without auditing it for stray timeout prose; that audit found two. Deleting them is the *identical* dead-prose deletion the design already sanctioned for `issue-implement.md:109` ("NOT Option C scope creep — a single-line deletion of dead prose"), not the prose-shape/flag normalization Option C was rejected for. Kept as a separate phase so the commit boundary is clean and trivially revertable.

1. **`-a never` on the already-backgrounded `/implement` Step 6 Codex review** — `implement.md:76`: `codex -c model_reasoning_effort=xhigh exec` → `codex -c model_reasoning_effort=xhigh -a never exec`. Flag only; no prose change.
2. **`-a never` on the already-backgrounded `/issue-implement` Step 6 Codex review** — `issue-implement.md:80`: same change.
3. **Delete the stray inert timeout line** at `issue-implement.md:109` — the standalone line `Use a 10-minute timeout (600000ms).` This site is already backgrounded (callout at `issue-implement.md:77`); the timeout sentence is dead/misleading prose. Delete the whole line.
4. **Delete the stray inert timeout clause** at `implement-codex.md:119` — the line currently reads `**Invoke Codex.** Run with `run_in_background: true` (the Bash tool's parameter — required by the design's cross-cutting constraint). Use a 30-minute timeout (1800000ms) for safety on larger phases:`. Remove ` Use a 30-minute timeout (1800000ms) for safety on larger phases` so the line becomes `**Invoke Codex.** Run with `run_in_background: true` (the Bash tool's parameter — required by the design's cross-cutting constraint):` — the trailing colon is preserved so it still introduces the bash block. No flag or callout change (`/implement-codex` already carries `-a never` and the explicit `run_in_background: true` wording).
5. **Delete the stray inert timeout clause** at `implement-codex.md:306` — the line currently reads `   Use a 10-minute timeout (600000ms). Run with `run_in_background: true`. Verify: …`. Remove the leading `Use a 10-minute timeout (600000ms). ` so the line becomes `   Run with `run_in_background: true`. Verify: …`. Keep the rest of the line intact.

**Success criteria:**
```bash
grep -c "10-minute timeout" .claude/commands/issue-implement.md  # expect 0 (stray line now gone)
grep -c "a never exec" .claude/commands/implement.md       # expect 2 (Step 6 + #9 from Phase 4)
grep -c "a never exec" .claude/commands/issue-implement.md # expect 2 (Step 6 + #10 from Phase 4)
grep -rc "10-minute timeout\|600000\|1800000\|Timeout: 600000" .claude/commands/implement-codex.md  # expect 0
grep -c '</dev/null' .claude/commands/implement.md         # expect 3
grep -c '</dev/null' .claude/commands/issue-implement.md   # expect 2
grep -c '</dev/null' .claude/commands/implement-codex.md   # expect 6
```

Commit: `chore(task-10): add -a never to backgrounded Codex review sites; drop stray timeout lines`.

---

## Phase 7 — Final acceptance verification (no file edits)

Repo-wide checks confirming the migration is complete and the `</dev/null` discipline (Issue #2) survived.

1. **No orphaned foreground-timeout prose anywhere in the command specs:**
   ```bash
   grep -rn "10-minute timeout\|30-minute timeout\|600000\|1800000\|Timeout:" .claude/commands/*.md
   ```
   Expected: **zero hits.** Every timeout reference is removed — the 11 migrated sites (Phases 2–5), the stray `issue-implement.md:109` line, and `implement-codex.md`'s two inert clauses (Phase 6). Any hit is a failure.
2. **`</dev/null` regression check** — total must equal the Phase 1 baseline of **23**:
   ```bash
   echo "total: $(grep -rh '</dev/null' .claude/commands/*.md | wc -l | tr -d ' ')"   # expect 23
   ```
   Per-file expected: auto-issues 4, codex-review 1, create-plan 1, design 3, implement-codex 6, implement 3, issue-implement 2, issue-plan 1, issue-research 1, research-codebase 1.
3. **All 11 targets carry the background parameter** — `grep -rn "run_in_background: true" .claude/commands/*.md` shows the 11 new callouts plus the pre-existing `implement-codex.md` ones; `auto-issues.md` Phases 1–3 keep their pre-existing short-form `run_in_background` callouts (unchanged).
4. **`-a never` on all 12 expected Codex calls** — the 10 migrated `codex exec` sites + the 2 Phase 6 extension sites:
   ```bash
   grep -rn "a never exec" .claude/commands/{research-codebase,design,create-plan,issue-research,issue-plan,codex-review,implement,issue-implement}.md
   ```
   Expected count: research-codebase 1, design 3, create-plan 1, issue-research 1, issue-plan 1, codex-review 1, implement 2, issue-implement 2 = **12**.
5. **Bash blocks well-formed** — read each migrated block once more; confirm every fenced block opens and closes and `</dev/null` is attached to the `codex`/`claude -p` simple command before any redirection.
6. **Out-of-scope foreground git ops untouched** — confirm `catchup.md` `git merge` and `playbook-update.md` `git fetch --unshallow` are unchanged.

**Success criteria:** all six checks pass. If any fails, return to the owning phase and fix.

No commit (verification only). If a fix is needed it lands in the relevant phase's follow-up commit.

---

## Interruption safety

Each phase is one commit and leaves the repo in a working state — a partially-migrated command set is just a mix of foreground and background sites, which is the pre-existing repo condition (6 sites were already backgrounded before this task). No phase can leave a command spec syntactically broken if it follows the per-phase success criteria.

**Phases must run in numbered order.** Phase 1 (smoke-test gate) must pass before any edits. The later phases' success criteria are order-dependent: Phase 4's `design.md` expectations (`10-minute timeout` count → 0, `run_in_background: true` count → 3) assume Phase 2's `design.md` edits have already landed; Phase 6's `implement.md` / `issue-implement.md` `a never exec` counts (→ 2 each) assume Phase 4's mid-loop `-a never` edits have already landed. Do not run Phases 2–6 out of order.

## Judgment Calls

1. **Smoke test is Phase 1, not the final phase.** It makes no edits but gates the whole migration. Running it first means a FAIL stops work before any file is touched — matching design line 105 ("implementation must stop and the task premise be revisited"). Alternative (smoke test last) would migrate 9 files before discovering the premise is false.
2. **All 11 migrated sites use the explicit callout form** (`run_in_background: true` + "Bash-tool parameter, not shell syntax"), including `auto-issues.md` Phase 4 — even though its in-file siblings (Phases 1–3) use the older short form. Rationale: the design's cross-cutting constant (design line 20) mandates the explicit wording at every touched site; the 11 migrated sites are uniform *with each other*; Phases 1–3 are already-backgrounded sites the design explicitly declines to normalize (design lines 46–47, 93). Alternative (match Phase 4 to its short-form siblings) was rejected — it would violate the explicit constant to chase intra-file uniformity the design already accepts as deferred.
3. **`-a never` placed immediately before `exec`.** Matches `implement-codex.md:124`'s relative position. Flag order before the `exec` subcommand is functionally irrelevant; consistency with the canonical Task 12 command is the tiebreaker.
4. **`codex-review.md` output-check uses min-lines `5`.** Matches `codex-output-check.sh`'s documented default and tolerates a terse `_no findings_` review report. Larger values (10–20, used by content-rich sweeps) would risk false failures on a legitimately short review.
5. **Phase 6 (the Option B extension) is a separate phase/commit** rather than folded into Phase 4. It touches already-*compliant* sites — isolating it keeps the commit boundary honest and the cleanup trivially revertable (design heuristic: reversibility). Codex's review flagged folding it into Phase 4 as the simpler execution path; the decision is held — the extension is a conceptually distinct risk class (editing compliant sites, not migrating foreground ones), and the design itself describes it as a distinct optional cleanup (design lines 49, 51).
6. **No timeout value carried in any migrated-site prose.** The `timeout` Bash parameter is inert on a `run_in_background: true` call (the call returns immediately). Carrying `600000ms` would be misleading; carrying `1800000ms` (the `/implement-codex` value) exceeds the documented 600000ms maximum. Removal — not replacement — is correct (design Constants, line 19).
7. **End-of-step verify/read steps left unchanged.** The existing "Verify the output before reading…" and "After Codex finishes, read… FULLY" lines remain correct under background execution (the completion notification precedes them). Editing them would widen the diff for no behavioral gain.
8. **`/implement-codex`'s two inert timeout clauses are deleted (Phase 6 items 4–5)** — a developer-approved extension beyond the literal Option B scope. The design declared `/implement-codex` a "no-op target" and excluded it, but did not audit it for stray timeout prose; the audit found `1800000ms` (`:119`) and `600000ms` (`:306`) clauses both sitting on `run_in_background: true` calls, where a timeout value is inert. Deleting them is the same dead-prose removal the design explicitly sanctioned for `issue-implement.md:109`, not the prose-shape/flag/log normalization that got Option C rejected. The alternative (leave them) would force Phase 7's timeout sweep to carry a permanent exception and leave the repo asserting a misleading `1800000ms` value that exceeds the documented 600000ms maximum.

## Areas where research was thin / implementer judgment needed

- **`/codex-review` liveness** (design Open Question, line 83) — docs do not confirm whether background Bash output streams live. Phase 1 step 5 records the observed behavior; the only hard rule is that prose must not *promise* live streaming. Current `codex-review.md` makes no such promise, so no removal is expected — but the implementer should re-confirm while editing Phase 3.
- **Exact callout indentation inside numbered/lettered list items** (#1, #6, #9, #10) — the plan specifies the callout sits directly above the fence at the list item's content column; the implementer applies the file's existing indentation convention when editing.

## Artifact references

- Research: `tasks/research-codebase.md`
- Design: `tasks/design-decision.md`
