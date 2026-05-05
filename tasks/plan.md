# Plan: `/implement-codex` — Codex drives, Claude verifies per-phase

> **Single-batch plan.** This plan ships one new command (`/implement-codex`) and one new prompt template, executed in five phases within a single `/implement` invocation. There is no inter-batch boundary.

## Design decision reference

- **Chosen approach:** Option 4 — Defense-in-Depth (pre-edit stop + post-diff verify), Steps 6-8 reused unchanged from `/implement`.
- **Source artifacts:** `tasks/design-decision.md` (full axis decisions + rationale), `tasks/research-codebase.md` (codebase ground truth).
- **No `tasks/research-patterns.md`** — pattern research was determined unnecessary during `/design`.

The nine-axis design is settled. This plan executes it; it does not revisit it.

## Scope boundaries — what we are NOT doing

- **Not modifying `/implement`.** Production path stays untouched.
- **Not building `/issue-implement-codex`.** Deferred follow-up per Task 12.
- **Not enabling network in the default sandbox.** Phases needing `npm install` / `pip install` / fetch fall back to `/implement`.
- **Not auto-committing from Codex.** `.git` is sandbox-protected.
- **Not modifying Step 6's review prompt** (Option 4 = choice A on the independence-mitigation axis; the weakening is documented as a known experimental cost, not papered over).
- **Not running the experiment.** Promotion criteria require ≥10 invocations covering ≥25 phases — that data accumulates in subsequent dogfooding tasks. Task 12 lands the artifact only. Phase 5's CLI dry-run does NOT count toward promotion data — it validates the artifact's CLI assumptions, doesn't seed `tasks/implement-codex-metrics.md`, and reverts via `git checkout`.
- **Not adding `.gitignore` entries** for `tasks/logs/` or `tasks/implement-codex-metrics.md`. Retention policy is the open non-blocking question (`tasks/design-decision.md:200`); deferred to first promotion review.
- **Not writing tests for the command file.** `.claude/commands/*.md` are prompt files, not code; the playbook has no test infrastructure for them. Verification is by manual read-through, grep checks against the written artifacts, and a single isolated Codex-CLI dry-run in Phase 5.

## File-naming conventions used by this plan

Established up-front so every phase references the same names. Names follow the existing playbook convention (`tasks/codex-*.tmp` prefix for Codex-produced artifacts; `code-review-fixes-*.tmp` for fix-instruction handoffs; mirror `/issue-implement`'s infix pattern for command-scope distinction).

| Purpose | Path |
|---|---|
| Phase brief template (static) | `.claude/prompts/implement-codex-phase-brief.md` |
| Per-phase composed prompt | `tasks/codex-implement-phase-{N}-prompt.tmp` |
| Per-phase Codex `-o` final message | `tasks/codex-implement-phase-{N}.tmp` |
| Per-phase Codex `--json` event log | `tasks/logs/codex-implement-phase-{N}-{TIMESTAMP}-attempt{K}.log` |
| Per-phase mismatch signal | `tasks/codex-mismatch-{N}.tmp` |
| Per-phase blocked signal | `tasks/codex-blocked-{N}.tmp` |
| Step 4c structural re-research output (per phase) | `tasks/codex-debug-{N}.tmp` (matches `/implement`) |
| Step 6 Codex review output | `tasks/codex-implement-code-review.tmp` |
| Step 7 fix instructions for child | `tasks/code-review-fixes-implement.tmp` |
| Step 8 child-process log | `tasks/logs/code-review-fixes-implement-{TIMESTAMP}.log` |
| Persistent metrics file | `tasks/implement-codex-metrics.md` |

`{TIMESTAMP}` is `$(date +%Y%m%d-%H%M%S)` — seconds-granularity, required by the design's collision-safety on rapid retries (`tasks/design-decision.md:32`). Existing playbook timestamps use minute-granularity; this command intentionally diverges for the per-phase log only.

`{N}` is the integer phase index from `tasks/plan.md` (1-indexed). `{K}` is the attempt counter (1 on first attempt; 2 only on a partial-recoverable retry; cap = 1 retry per phase per the crashed-state contract).

## Phase 1 — Phase brief template

**Goal.** Write `.claude/prompts/implement-codex-phase-brief.md` containing the static framing every per-phase Codex invocation reuses. Static = no per-phase variation; variable slots are appended by Claude in Step 4 of the command.

**Why a separate file.** The design (`tasks/design-decision.md:154,199`) requires factoring the framing out so per-phase Claude work is ~5 lines of slot-filling rather than ~60-100 inline. The convention precedent is `.claude/prompts/research-guide.md` and `.claude/prompts/research-patterns-guide.md`; `.claude/templates/` does not exist and was rejected by `/design`.

**File contents** (sections must appear in this order so the brief reads coherently top-to-bottom):

1. **Header + role framing** — one paragraph: "You are implementing one phase of an approved plan in tasks/plan.md. The plan was authored by Claude after research and design phases. Your job is to apply the surgical edits this phase prescribes — nothing more, nothing less."

2. **Surgical-changes rule** — quote the rule verbatim from `CLAUDE.md` § Quality Standards (the line beginning "Surgical changes — every changed line needs a reason traceable to the plan…"). Add a one-sentence emphasis: "Adjacent code that *looks improvable* is out of scope. Improvements that the plan does not specify are scope drift, even if they would be net wins."

3. **Edit allow-list rule** — "Edit ONLY the files listed below in §Variable Slots → file_allow_list. Do not modify any file outside that list, including tests, docs, configs, or comments in adjacent code. If the plan's premise is wrong and the right edit lives outside the allow-list, follow the §Mismatch contract instead — do not edit out-of-list files."

4. **Test-ownership rule** — "Do NOT run tests, lint, type checks, build commands, or any verification command. Do NOT execute scripts. Edit source files, write the §Output schema final message, and exit. Claude will run all verification after you return. Rationale: Claude needs direct test evidence to gate the per-phase commit."

5. **Network constraint** — "Network is disabled in this sandbox (`workspace-write` default). If your edits require `npm install`, `pip install`, fetching a package, or any network call, STOP and follow the §Blocked contract — do not attempt the network call."

6. **Mismatch contract** — "Before editing, read the plan-cited files (Variable Slots → plan_lines and file_allow_list). If the actual code structure does not match what the plan's premise assumes (e.g., the plan says 'add a parameter to function X' but X has been deleted or relocated; or 'edit the foo() block at file.ts:47' but lines 40-60 are unrelated), DO NOT edit. Instead: write `tasks/codex-mismatch-{N}.tmp` (replace `{N}` with §Variable Slots → phase_number) containing (a) what the plan assumed, (b) what you found, (c) the file:line evidence, and (d) the smallest delta you'd need to proceed. Then exit without making any source edits. Claude will re-research and adapt the plan."

7. **Blocked contract** — "If you hit a wall that is not a structural mismatch (you reached an ambiguity the plan does not resolve, your model wall on the language/framework, the phase needs network access, etc.), DO NOT guess and DO NOT half-implement. Instead: write `tasks/codex-blocked-{N}.tmp` containing (a) what you tried, (b) where you stopped, (c) what input you'd need to proceed. Then exit without making source edits. Claude will take over and complete the phase."

8. **Output schema** — exact format the `-o` final message MUST contain:
   ```
   STATUS: done | mismatch | blocked
   FILES_MODIFIED:
   - path/to/file1.ext
   - path/to/file2.ext
   FILES_CREATED:
   - path/to/new-file.ext
   SUMMARY: <one-line description of what was done in this phase>
   NOTES: <any non-blocking observations; "none" if nothing>
   ```
   Add: "If STATUS is `mismatch` or `blocked`, you must still emit this block — `FILES_MODIFIED` and `FILES_CREATED` should be empty under those states. Claude cross-checks your file enumeration against `git diff --name-only`; mismatches between your list and the actual diff are findings."

9. **Variable Slots section** — at the end of the template, a clearly-delimited markdown section Claude fills in per-phase. Use a visible markdown subsection header (NOT HTML comments — those would invite Codex to ignore the slot content):
   ```markdown
   ## Variable Slots

   Phase number: {N}
   Plan excerpt: tasks/plan.md lines {start}-{end} (read these before editing)
   File allow-list:
   - path/a
   - path/b
   Success criteria (informational; Claude will run these — do NOT execute them):
   - command 1
   - command 2
   ```
   The static template ends right before the `## Variable Slots` header. Claude appends the header + filled slot block when composing `tasks/codex-implement-phase-{N}-prompt.tmp`. Codex sees the fully-rendered slots as visible markdown.

**Verification (Phase 1 success criteria):**
- [x] `test -f .claude/prompts/implement-codex-phase-brief.md` returns 0.
- [x] `grep -q "Surgical-changes rule" .claude/prompts/implement-codex-phase-brief.md` returns 0 (or substring match for the rule's distinctive wording).
- [x] `grep -q "Mismatch contract" .claude/prompts/implement-codex-phase-brief.md` returns 0.
- [x] `grep -q "Blocked contract" .claude/prompts/implement-codex-phase-brief.md` returns 0.
- [x] `grep -q "Test-ownership" .claude/prompts/implement-codex-phase-brief.md` returns 0.
- [x] `grep -q "Output schema" .claude/prompts/implement-codex-phase-brief.md` returns 0.
- [x] `grep -q "Variable Slots" .claude/prompts/implement-codex-phase-brief.md` returns 0.
- [x] Manual read-through: the file flows top-to-bottom as a coherent brief; every pronoun has a clear antecedent.

## Phase 2 — Command skeleton (Steps 1-3, 5-11)

**Goal.** Create `.claude/commands/implement-codex.md` with the preamble and every step that mirrors `/implement` directly. Step 4 is left as a stub (`see phase-loop sections below`) to be filled in Phases 3 and 4.

**Why this ordering.** Steps 5-11 reuse `/implement`'s shape line-for-line with renamed artifacts. Locking them in early prevents Step 4's design (which produces the artifacts those steps consume) from drifting away from a known-good consumer.

**Preamble (top of file, before Steps).** Three short paragraphs:

1. **Command summary** — one-paragraph description: experimental sibling of `/implement`. Codex writes per-phase under `--sandbox workspace-write`; Claude verifies plan adherence + diff scope + cross-phase coherence + success criteria; Steps 6-8 (Codex review + Claude triage + child fix application) reuse `/implement` unchanged.

2. **Experimental status** — explicit callout: "This command is experimental. `/implement` is the production path. Promotion criteria are tracked in `tasks/implement-codex-metrics.md`. Until promotion, prefer `/implement` for any phase that needs network access (install, fetch) or that touches critical paths flagged in `tasks/research-codebase.md`."

3. **Known experimental cost** — one paragraph: "Final-review independence is weakened. The Step 6 Codex review now reviews Codex-written code (same agent family — distinct sessions and stateless invocations, but shared training distribution). Per-phase Claude verify is the partial compensation. Whether this is sufficient is a measurable hypothesis the experiment must answer; do not paper over it by injecting Claude's per-phase findings into Step 6."

**Step 1 — Check prerequisites** (mirror `.claude/commands/implement.md:9-14`):
- Verify `tasks/plan.md` exists; stop with "run `/create-plan` first" if not.
- Verify the plan has no unresolved blocking questions; stop if any remain.
- Verify `tasks/research-codebase.md` exists.
- **New (vs. `/implement`):** Verify `codex` is on PATH (`command -v codex >/dev/null` — stop with the documented "tell the developer to fix it" error if absent). `/implement` doesn't need this until Step 6; `/implement-codex` needs it from Step 4.

**Step 2 — Read the plan fully** (mirror `.claude/commands/implement.md:15-19`):
- Read `tasks/plan.md` FULLY (no limit/offset).
- Read `tasks/research-codebase.md` and `tasks/design-decision.md` for reference. (Same as `/implement`.)

**Step 3 — Check for resume** (mirror `.claude/commands/implement.md:21-25`):
- Look for `- [x]` checkmarks; pick up from the first unchecked phase.
- Trust completed phases.
- **New (vs. `/implement`):** Pre-delete signal tmps for **all** phases at the start, not just the resume target. A leftover `tasks/codex-mismatch-{N}.tmp` from a previous run could poison the state check on a clean retry. Use `rm -f tasks/codex-mismatch-*.tmp tasks/codex-blocked-*.tmp tasks/codex-implement-phase-*-prompt.tmp tasks/codex-implement-phase-*.tmp`. Do NOT delete `tasks/codex-debug-*.tmp` here — those are produced by the structural-mismatch re-research and are cleaned in Step 10.

**Step 4 — Execute phase-by-phase** — STUB: "See §Phase loop below for the full per-phase contract." (Phases 3 and 4 of this plan fill it in.)

**Step 5 — Post-implementation verification** (mirror `.claude/commands/implement.md:67-69` line-for-line). Same scoped-failure rule: failures in plan-touched files must be fixed; pre-existing drift is noted, not fixed.

**Step 6 — Run Codex code review** (mirror `.claude/commands/implement.md:71-101` semantically, with three intentional deltas):
- Output path: `tasks/codex-implement-code-review.tmp` (was `tasks/codex-code-review.tmp`).
- Verification: `bash .claude/scripts/codex-output-check.sh tasks/codex-implement-code-review.tmp 10` (was the same script with the old path).
- **Add `-a never`** to the Codex invocation: `codex -c model_reasoning_effort=xhigh -a never exec --sandbox read-only ...`. Per the design's cross-cutting constraint at `tasks/design-decision.md:24`, every backgrounded `codex exec` needs `-a never`. The source `/implement` invocation lacks it (pre-existing discipline gap, unrelated to Task 12). The new command closes the gap. This is **not** a violation of "Steps 6-8 unchanged" — it's an across-the-board cross-cutting discipline that applies regardless of which command. The prompt body itself remains byte-for-byte identical to `/implement`'s.
- The prompt body itself is **identical** to `/implement`'s — Option 4 = choice A on independence mitigation; no prelude, no findings injection, no model_reasoning_effort change.
- Backgrounded with `</dev/null` — same as `/implement`.

**Step 7 — Triage findings** (mirror `.claude/commands/implement.md:103-132` line-for-line, with input/output paths renamed):
- Input: `tasks/codex-implement-code-review.tmp`
- Output: `tasks/code-review-fixes-implement.tmp`
- Same triage taxonomy (fix/skip/flag); same fix-instruction format; same "skip to Step 10 if no fixes" branch.

**Step 8 — Apply fixes via child process** (mirror `.claude/commands/implement.md:134-147` line-for-line, with input/log paths renamed):
- Input: `tasks/code-review-fixes-implement.tmp`
- Log path: `tasks/logs/code-review-fixes-implement-$TIMESTAMP.log` where `TIMESTAMP=$(date +%Y%m%d-%H%M)` (minute-granularity is fine here — no rapid-retry concern; matches the existing `/implement` pattern).
- Backgrounded with `</dev/null`.
- `--dangerously-skip-permissions` — same flag as `/implement` (the auto-mode caveat is in the existing `/implement` and is inherited here).

**Step 9 — Final verification** (mirror `.claude/commands/implement.md:149-153` line-for-line). Final commit message: `fix: apply code review revisions` — identical to `/implement`.

**Step 10 — Clean up** (extended list — Step 10 of `/implement` deletes 2 patterns; here we delete more):
- `tasks/codex-implement-code-review.tmp`
- `tasks/code-review-fixes-implement.tmp`
- All `tasks/codex-debug-*.tmp` (same as `/implement`)
- All `tasks/codex-implement-phase-*.tmp` (per-phase Codex `-o` outputs)
- All `tasks/codex-implement-phase-*-prompt.tmp` (per-phase composed briefs)
- All `tasks/codex-mismatch-*.tmp` and `tasks/codex-blocked-*.tmp` (signals — will already be deleted on success but are listed for safety after partial runs)
- **Do NOT delete:** `tasks/implement-codex-metrics.md` (persistent), `tasks/logs/codex-implement-phase-*.log` (per design's open question — kept until promotion review).

**Step 11 — Present results** (extended vs. `/implement` Step 11):
- Implemented: phases completed and commits made (same as `/implement`).
- Fixed: what Codex found and the child fixed (same as `/implement`).
- Flagged for review: same as `/implement`.
- How to test: same as `/implement`.
- **New: Experiment metrics** — one-paragraph summary derived from the metrics rows appended this run: total phases, clean-pass count, mismatch count, blocked count, crashed/retried count, observed Claude rewrite ratio, prompt-contract violations (test-execution findings from JSON-log audit). Cross-link to `tasks/implement-codex-metrics.md` for the full table.

**Verification (Phase 2 success criteria):**
- [x] `test -f .claude/commands/implement-codex.md` returns 0.
- [x] `grep -q "Step 1 — Check prerequisites\|Check prerequisites" .claude/commands/implement-codex.md` (header pattern).
- [x] `grep -c "^### " .claude/commands/implement-codex.md` returns 11 (one per Step + preamble = 11 H3s, depending on heading depth — adjust per chosen markdown structure; key invariant is 11 step-level sections plus the preamble). *(Returns 13, matching `/implement.md`'s 13 — both files include `### Fix 1` / `### Fix 2` inside a fenced markdown code-block example, which grep counts. 11 step-level sections is the structural invariant and is met.)*
- [x] `grep -q "tasks/codex-implement-code-review.tmp" .claude/commands/implement-codex.md` returns 0 (renamed Step 6 output present).
- [x] `grep -q "tasks/code-review-fixes-implement.tmp" .claude/commands/implement-codex.md` returns 0 (renamed Step 7 output present).
- [x] `! grep -q "tasks/codex-code-review.tmp" .claude/commands/implement-codex.md` returns 0 (the un-renamed `/implement` artifact is NOT referenced — collision-safety).
- [x] `grep -E "tasks/code-review-fixes\.tmp(\b|[^-])" .claude/commands/implement-codex.md` returns non-zero (no bare `code-review-fixes.tmp` references — only `code-review-fixes-implement.tmp`, the renamed form, should appear).
- [x] Manual diff: open `.claude/commands/implement.md` and the new file side-by-side; Steps 5, 9, 11 should be near-identical except for the renamed artifact references and the new "Experiment metrics" sub-bullet in Step 11.
- [x] Step 4 contains a stub pointer to the phase-loop sections that Phases 3 and 4 will fill.

**Commit:** `feat(implement-codex): add command skeleton with Steps 1-3 and 5-11 mirroring /implement` (or similar conventional message).

## Phase 3 — Step 4 phase loop, "done" path only

**Goal.** Implement the full per-phase loop assuming Codex returns in the `done` state. The `mismatch`, `blocked`, and `crashed` branches are STUB pointers added in Phase 4. After Phase 3, `/implement-codex` is invocable on a plan that goes cleanly — every phase succeeds, every commit lands, metrics get recorded — but unhappy paths are unhandled.

**Why split done from the unhappy paths.** The done path establishes the per-phase rhythm: brief composition, Codex invocation, output verification, file enumeration cross-check, Claude-side success-criteria run, diff-scope check, cross-phase coherence check, metrics-line append, commit. That rhythm is the same regardless of state — the unhappy paths are *additional branches* before the done sequence runs. Building the done path first lets Phase 4 add branches without touching the rhythm.

**Step 4 structure (final, after both Phases 3 and 4):**

```
ATTEMPT=1   # outer-loop variable, NOT inside Step 4e
For each unchecked phase N in tasks/plan.md:
  4a. Read all plan-cited files for phase N (no limit/offset)
  4b. Pre-flight network check — HARD-STOP entire invocation if phase mentions
      install/pip/npm/fetch/curl (per design's network-out-of-scope posture)
  4c. Compose phase brief → tasks/codex-implement-phase-{N}-prompt.tmp
  4d. Pre-delete signal tmps: rm -f tasks/codex-mismatch-{N}.tmp tasks/codex-blocked-{N}.tmp
  4e. Capture pre-Codex baseline (git status --porcelain, git diff --name-only)
      Invoke Codex (backgrounded, --sandbox workspace-write, -a never, --json log + -o)
  4f. State check (order matches tasks/design-decision.md:33-38, with STATUS-line cross-check):
      Step 1: detect "ambiguous-signal" first (always wins):
        - both signal files present → CRASHED (Phase 4)
        - either signal file present AND zero-bytes → CRASHED (Phase 4)
      Step 2: only mismatch signal present (non-empty) → MISMATCH (Phase 4)
      Step 3: only blocked signal present (non-empty) → BLOCKED (Phase 4)
      Step 4: both signals absent → run codex-output-check.sh on -o tmp:
          fail → CRASHED (Phase 4)
          pass → read STATUS line from -o:
            STATUS: done → DONE
            STATUS: mismatch → treat as if mismatch signal were present → MISMATCH
            STATUS: blocked → treat as if blocked signal were present → BLOCKED
            STATUS line missing or unrecognized → CRASHED (Phase 4) — output contract violated
  4g. (DONE path) Compute "real diff" = post-Codex git state minus 4e baseline,
      filtered to exclude command-owned tmp/log/metrics artifacts.
      Cross-check Codex's FILES_MODIFIED + FILES_CREATED against the real diff.
      Mismatches are findings (not blocking).
  4h. (DONE path) JSON-log audit: parseability (jq -c) + grep for test/lint/build/script execution
      in tasks/logs/codex-implement-phase-{N}-*.log (Phase 4 enrichment).
  4i. (DONE path) Run plan-specified success criteria for phase N.
  4j. (DONE path) Diff-scope check on the real-diff set:
      - file in plan-cited list → in-scope
      - minor + on-pattern out-of-scope edit → patch in-session, log "scope drift caught (minor)"
      - structural / large out-of-scope edit → STOP and escalate to developer
        (do NOT auto-route to MISMATCH — working tree is dirty, retry would be contaminated)
  4k. (DONE path) Cross-phase coherence check: pattern coherence with prior phases, cumulative
      scope drift. Read commits made by prior phases on this branch.
  4l. (DONE path) Mark plan checkboxes done (- [x]).
  4m. (DONE path) Append metrics line to tasks/implement-codex-metrics.md
      (initialize file with header if missing).
  4n. (DONE path) Commit phase: explicit `git add <real-diff source files> tasks/plan.md
      tasks/implement-codex-metrics.md` then conventional commit. Never `git add -A`.
```

Phase 3 implements 4a-4g (skipping the JSON-log audit detail in 4h — that's Phase 4) and 4i-4n. Phase 4 implements 4h fully and adds the MISMATCH / BLOCKED / CRASHED branches off 4f.

### Step 4a — Read plan-cited files

For phase N:
- Identify the file paths cited in the phase's plan section.
- Read each FULLY (no limit/offset) using the Read tool.
- Hold them in conversation context for the verification steps later.

### Step 4b — Pre-flight network check

**Hard-stop on detection** — design (`tasks/design-decision.md:29`) and scope boundary (this plan, line 17) put network-required phases out-of-scope by default. Grep the phase content for tokens that imply network: `npm install`, `pip install`, `yarn add`, `cargo add`, `gem install`, `go get`, `curl`, `wget`, `fetch`, `requests.get`. If any match, **stop the entire `/implement-codex` invocation** with this message: "Phase {N} appears to need network access ('{matched-token}' detected). The default `workspace-write` sandbox has network disabled. Run `/implement` instead for this batch, or remove the network step from the plan." Do not prompt for confirmation — the design's hard-stop posture trumps developer override at the per-invocation level. (If the developer wants to override, they edit the plan to remove the network step or run `/implement` directly.) Heuristic false positives are acceptable — the cost of a false stop is one developer re-read of the plan; the cost of a false proceed is a wasted Codex invocation that returns `blocked` and then needs Claude takeover.

### Step 4c — Compose the phase brief

Write `tasks/codex-implement-phase-{N}-prompt.tmp` containing:
1. The full contents of `.claude/prompts/implement-codex-phase-brief.md` (cat'd in).
2. Filled `## Variable Slots` section with: phase_number=N, plan_lines=`tasks/plan.md` line range for phase N, file_allow_list=bulleted list of plan-cited files, success_criteria=bulleted list of phase N's automated checks (informational only — labelled "DO NOT execute").

Use a Write tool call (Claude in-session) — not a shell heredoc — so the file is reproducible.

### Step 4d — Pre-delete signal tmps

```bash
rm -f tasks/codex-mismatch-{N}.tmp tasks/codex-blocked-{N}.tmp
```

This guards against leftover signals from a prior aborted attempt at the same phase. Step 3's session-start cleanup catches the cross-phase case; this catches the same-phase retry case.

### Step 4e — Capture baseline + invoke Codex

**Capture pre-Codex baseline** so post-Codex enumeration is a delta, not an absolute (Codex's correction #3). Snapshot in conversation context (Claude tool memory — no persistent file):
- `git status --porcelain` — captures modified-tracked + untracked + ignored files
- `git diff --name-only` — tracked-only diff against HEAD

These baselines are the "before" state. Step 4g computes "after - before" and filters out command-owned artifacts (`tasks/codex-implement-phase-*.tmp`, `tasks/codex-implement-phase-*-prompt.tmp`, `tasks/logs/codex-implement-phase-*.log`, `tasks/codex-mismatch-*.tmp`, `tasks/codex-blocked-*.tmp`, `tasks/codex-debug-*.tmp`, `tasks/implement-codex-metrics.md`) — the "real diff" is what Codex changed.

**Initialize ATTEMPT only on first entry to phase N.** Define ATTEMPT at the outer per-phase loop, not inside Step 4e — re-entry from MISMATCH retry or partial-recoverable retry must NOT reset ATTEMPT. Pseudocode:

```
For each phase N:
  ATTEMPT=1
  goto step_4c   # compose brief, etc.
  ... up through Step 4e invocation
  ... if MISMATCH or partial-recoverable retry: ATTEMPT=2; goto step_4c
  ... else: continue down DONE / BLOCKED / CRASHED branches
```

**Invocation.** Run with `run_in_background: true` (the harness directive — the Bash tool's `run_in_background` parameter — required by the design's cross-cutting constraints). Use a 30-minute timeout (1800000ms) for safety on larger phases:

```bash
mkdir -p tasks/logs && \
TIMESTAMP=$(date +%Y%m%d-%H%M%S) && \
codex -c model_reasoning_effort=xhigh -a never exec \
  --sandbox workspace-write \
  --json \
  -o tasks/codex-implement-phase-{N}.tmp \
  "$(cat tasks/codex-implement-phase-{N}-prompt.tmp)" \
  </dev/null \
  > tasks/logs/codex-implement-phase-{N}-${TIMESTAMP}-attempt${ATTEMPT}.log 2>&1
```

`ATTEMPT` is read from the outer loop variable — Step 4e does NOT initialize it.

**Verify the flag set against Codex CLI** before writing this into the command file: confirm `-a never` is the correct top-level flag (per `tasks/design-decision.md:24`, verified locally — `--ask-for-approval` is top-level, not on `exec`); confirm `--json` is accepted on `codex exec`; confirm `--sandbox workspace-write` is accepted. If any flag has changed since the design was written, update the plan and re-research before proceeding.

### Step 4f — State check

Order is load-bearing — see `tasks/design-decision.md:33-38`. After Codex returns, check signal tmps **before** running `codex-output-check.sh`. Phase 4 fills in the MISMATCH / BLOCKED / CRASHED arms; Phase 3 only handles the DONE arm.

### Step 4g — File enumeration cross-check (DONE path)

1. `bash .claude/scripts/codex-output-check.sh tasks/codex-implement-phase-{N}.tmp 5` — verify 5+ lines (the output schema has STATUS / FILES_MODIFIED / FILES_CREATED / SUMMARY / NOTES = at least 5 lines for a minimal pass).
2. Read `tasks/codex-implement-phase-{N}.tmp` FULLY. Parse the `STATUS` line (verified ≠ `mismatch` / `blocked` / unknown by Step 4f), `FILES_MODIFIED` and `FILES_CREATED` lists.
3. Run `git status --porcelain` and `git diff --name-only` (post-Codex state).
4. **Compute the "real diff"** — files Codex changed = (post-state) minus (pre-Codex baseline from Step 4e), filtered to exclude command-owned artifacts: `tasks/codex-implement-phase-*.tmp`, `tasks/codex-implement-phase-*-prompt.tmp`, `tasks/logs/codex-implement-phase-*.log`, `tasks/codex-mismatch-*.tmp`, `tasks/codex-blocked-*.tmp`, `tasks/codex-debug-*.tmp`, and `tasks/implement-codex-metrics.md`. The result is the authoritative "what Codex actually edited" set.
5. Cross-check: every file Codex enumerated in `FILES_MODIFIED` + `FILES_CREATED` must appear in the real diff, AND every file in the real diff must appear in Codex's enumeration. Mismatches are findings — record in metrics (4m) but do not auto-block. The real-diff set **is** the diff-scope check input for 4j.

### Step 4i — Run plan-specified success criteria

Execute the automated success-criteria commands the plan specifies for phase N. Apply the standard scoping rule (`/implement` Step 4d, mirrored): failures in plan-touched files block the phase; pre-existing drift in unrelated files is noted for Step 11.

If success criteria fail and the failure is in plan-touched files, attempt up to 2 in-session patches (mirroring `/implement` Step 4c "Tests fail after 2 fix attempts" rule). On the third failure, stop and ask the developer.

### Step 4j — Diff-scope check

For each file in the "real diff" set (from Step 4g, post-baseline subtraction):
- Is it in the phase's plan-cited file list?
- If yes → in scope.
- If no → out-of-scope edit. Classify:
  - **Minor and on-pattern** (e.g., a one-line import update in a sibling file required by the phase's edit): patch in-session if needed, log as "scope drift caught (minor)" in metrics, continue.
  - **Structural or large** (a refactor, an unrelated file, a deleted file): **STOP and escalate to the developer.** Do NOT auto-route to the MISMATCH branch — MISMATCH assumes Codex made no source edits (the pre-edit stop contract), but post-diff structural drift means Codex did make edits, so the working tree is dirty. Auto-routing to MISMATCH would contaminate the retry. Report to the developer: list the bulldozed files, the diff, and the plan-cited file list. Developer decides whether to revert (`git checkout -- <files>`), patch in-session, or drop the phase. (Codex's RISK #12.)

### Step 4k — Cross-phase coherence check

Read `git log --oneline` for commits on the current branch since the plan started (use the first phase's commit as the baseline if known; otherwise read since the branch diverged from `main`). Read the diff of the last 1-2 prior phases. Check:
- Does this phase's edit pattern match prior phases' patterns? (e.g., consistent error-handling style, consistent naming conventions established in earlier phases)
- Cumulative scope drift: are total changed files trending past what the plan implied?
- Plan coverage: does this phase build on the prior phases as the plan intended, or has it skipped or duplicated something?

If a coherence concern is significant, halt and ask the developer rather than auto-patching — coherence violations are subjective by nature.

### Step 4l — Update plan checkmarks

Mark phase N's success-criteria items as `- [x]` in `tasks/plan.md`. Include `tasks/plan.md` in the phase's commit (Step 4n).

### Step 4m — Append metrics line

If `tasks/implement-codex-metrics.md` does not exist, create it with this header:

```markdown
# /implement-codex experiment metrics

One row per phase. Used to compute promotion criteria — see `tasks/design-decision.md` § Open Questions for thresholds.

| Date | Run | Phase | State | Codex LOC | Files written | Claude patch (lines) | Drift caught | Test-violation | Step 6 severe (Codex-attrib) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

Then append one row for this phase. Field semantics (the Codex LOC and Step 6 severe columns are added per Codex's correction #7 — promotion criteria require active-work and review-independence data, not just counts):
- **Date:** `$(date +%Y-%m-%d)`.
- **Run:** the `TIMESTAMP` from Step 4e (matches the phase log filename).
- **Phase:** N.
- **State:** `done` | `mismatch` | `blocked` | `crashed` (Phase 3 only writes `done`; Phase 4 adds the rest).
- **Codex LOC:** count of lines Codex wrote in this phase, computed from the "real diff" (Step 4g item 4) using `git diff --shortstat` summed across the real-diff files (or 0 for `mismatch` / `blocked` states where Codex didn't edit). This is the active-work numerator: the design's "≥25% Claude active-work reduction" gate compares this against `/implement` baseline runs (which the developer must capture separately — out of scope for this command, but the column makes it computable).
- **Files written:** count of distinct files in the "real diff" set (Step 4g item 4). Use this, not Codex's `FILES_MODIFIED + FILES_CREATED` count, because the real diff is authoritative.
- **Claude patch (lines):** total lines Claude modified in this phase post-Codex (in-session patches from 4i, plus blocked-state takeover from Phase 4). 0 if Codex landed clean and Claude didn't patch.
- **Drift caught:** `yes` (out-of-scope file caught — minor patched, structural escalated) | `no`.
- **Test-violation:** `yes` (JSON-log audit found Codex ran a test/lint/build command despite the brief) | `no`. Phase 3 writes `no` unconditionally; Phase 4 implements the audit logic.
- **Step 6 severe (Codex-attrib):** Filled retroactively by Step 7 triage — count of severe Step 6 findings whose offending code came from Codex's edits in this phase. Initial value at row-write time: `pending`. Updated to integer count after Step 7 completes. Best-effort attribution: triage step (Phase 4) tags each severe finding with the phase that introduced the code, then Step 7 closes the loop.
- **Notes:** one short string — anything noteworthy (e.g., "minor patch: import reorder in sibling file"; "crash-recovered (effectively-done)"; or Codex's mismatch/blocked summary truncated to 80 chars).

### Step 4n — Commit the phase

Stage explicitly — never `git add -A` or `git add .` (those would sweep up command-owned tmp/log artifacts):

```bash
# Source files: every path in the "real diff" set from Step 4g item 4
git add <real-diff source files>
# Plan + metrics (always):
git add tasks/plan.md tasks/implement-codex-metrics.md
git commit -m "<conventional message describing this phase>"
```

Use the same conventional-commit style as `/implement` Step 4f. Include `tasks/plan.md` (checkmarks updated) and `tasks/implement-codex-metrics.md` (new metrics row). **Do not stage** `tasks/codex-implement-phase-*.tmp`, `tasks/codex-implement-phase-*-prompt.tmp`, `tasks/logs/codex-implement-phase-*.log`, signal tmps, or debug tmps — these are command-owned and either cleaned in Step 10 or kept untracked per the open log-retention question.

**Verification (Phase 3 success criteria):**
- [x] `.claude/commands/implement-codex.md` Step 4 contains substeps 4a-4g and 4i-4n with concrete bash commands and prose. (4h is a stub.)
- [x] `grep -q "rm -f tasks/codex-mismatch-{N}.tmp" .claude/commands/implement-codex.md` (or equivalent placeholder convention) — pre-delete present.
- [x] `grep -q "codex -c model_reasoning_effort=xhigh -a never exec" .claude/commands/implement-codex.md` — Codex invocation present with correct flags.
- [x] `grep -q "\-\-sandbox workspace-write" .claude/commands/implement-codex.md` — sandbox flag present.
- [x] `grep -q "\-\-json" .claude/commands/implement-codex.md` — JSON event log enabled.
- [x] `grep -q "</dev/null" .claude/commands/implement-codex.md` — Issue #2 discipline preserved (verify it appears on the Codex invocation line).
- [x] `grep -q "run_in_background" .claude/commands/implement-codex.md` — Task 10 pattern applied manually (the directive comment, since Task 10 hasn't shipped).
- [x] `grep -q "tasks/implement-codex-metrics.md" .claude/commands/implement-codex.md` — metrics file referenced.
- [x] Manual review: the DONE-path commit happens before any STUB pointer to MISMATCH/BLOCKED/CRASHED — the rhythm is whole even if the unhappy branches are unimplemented.

**Commit:** `feat(implement-codex): add Step 4 phase loop done-path with metrics + per-phase commit`.

## Phase 4 — Step 4 unhappy paths (mismatch / blocked / crashed) + JSON-log audit

**Goal.** Fill in the three unhappy branches off Step 4f, plus the JSON-log audit at Step 4h. After this phase, `/implement-codex.md` is fully written and internally consistent on paper. Phase 5 then validates the CLI-level assumptions empirically before Task 12 closes.

### Step 4f.MISMATCH branch

Trigger: state classified as MISMATCH per Step 4f's order — only the mismatch signal present non-empty, OR the `-o` STATUS line says `mismatch`.

**Pre-retry sanity check.** The MISMATCH branch assumes Codex made no source edits (the pre-edit stop contract). Before proceeding, compute the "real diff" (Step 4g item 4) — files Codex touched, filtered to exclude command-owned artifacts. If the real diff is non-empty, Codex violated the pre-edit stop contract. **STOP and escalate to the developer** with the file list — do not auto-retry, the working tree is dirty (same handling as Step 4j structural-drift escalation).

Sub-flow (real diff is empty — pre-edit stop contract held):
1. Read `tasks/codex-mismatch-{N}.tmp` FULLY. It should contain (a) what the plan assumed, (b) what Codex found, (c) file:line evidence, (d) the smallest delta needed.
2. Append a metrics row with State=`mismatch`, Codex LOC=0, Files written=0, Claude patch lines=0, Drift caught=`no`, Test-violation=`no`, Step 6 severe (Codex-attrib)=`pending`, Notes=Codex's mismatch summary truncated to 80 chars.
3. Run the existing `/implement` Step 4c structural-mismatch top-level Codex re-research (read-only) — same prompt template, output goes to `tasks/codex-debug-{N}.tmp`. Mirror `.claude/commands/implement.md:35-54` semantically, but **add `-a never`** to the invocation per the design's cross-cutting constraint at `tasks/design-decision.md:24` (the source `/implement` invocation lacks `-a never` — that is a pre-existing discipline gap; the new command must close it). Use the same 10-minute timeout and `codex-output-check.sh` verification with `min-lines=5`.
4. Read `tasks/codex-debug-{N}.tmp`; update `tasks/plan.md` to reflect the actual structure (the plan's premise was wrong, not Codex's edit).
5. Delete the mismatch signal: `rm -f tasks/codex-mismatch-{N}.tmp`.
6. Increment `ATTEMPT` (outer-loop variable, see Step 4e) and **retry the phase from Step 4c** (recompose the brief — the file_allow_list and plan_lines may have changed). Cap = 1 retry total per phase across both partial-recoverable and mismatch branches (rationale: if the second attempt also fails the same way, the plan needs deeper rework, not another auto-retry; ATTEMPT max = 2).
7. If the retry also returns `mismatch`, stop and report to the developer. Do not auto-restore the working tree — the developer inspects.

### Step 4f.BLOCKED branch

Trigger: state classified as BLOCKED per Step 4f's order — only the blocked signal present non-empty, OR the `-o` STATUS line says `blocked`.

**Pre-takeover sanity check.** Same as MISMATCH: Codex's blocked contract says "exit without making source edits." Compute the real diff; if non-empty, escalate to developer (working tree is dirty, partial Codex edits compromise Claude's clean takeover).

Sub-flow (real diff is empty):
1. Read `tasks/codex-blocked-{N}.tmp` FULLY.
2. Append a metrics row with State=`blocked`, Codex LOC=0, Files written=0 (Codex didn't edit), Claude patch lines=`<placeholder, updated below>`, Drift caught=`no`, Test-violation=`no`, Step 6 severe (Codex-attrib)=`n/a` (no Codex code), Notes=Codex's blocked summary truncated to 80 chars.
3. **Claude takes over the phase.** Use normal Edit/Write tools to apply the surgical edits the plan specified, exactly as `/implement` Step 4 would handle the phase. Run the success criteria. Mark plan checkmarks. Commit.
4. After commit, update the metrics row in-place: Claude patch lines = `git diff --shortstat HEAD~1` line count for the takeover commit.
5. Delete the blocked signal: `rm -f tasks/codex-blocked-{N}.tmp`.
6. **Do NOT retry Codex on this phase.** Blocked = "Codex hit a wall, hand back to Claude" — the phase is finished by Claude, not retried under Codex. ATTEMPT does NOT increment for blocked-state takeover.

### Step 4f.CRASHED branch

Trigger: state classified as CRASHED per Step 4f's order — output-check fail AND no signal tmps; OR both signal tmps present; OR any signal file zero-bytes; OR `-o` STATUS line missing or unrecognized (per `tasks/design-decision.md:36-38`).

Sub-flow (the three-step diagnosis from `tasks/design-decision.md:42-46`):

**Diagnosis step 1 — Read the JSON event log.**
- Path: the most recent `tasks/logs/codex-implement-phase-{N}-*-attempt{ATTEMPT}.log` (the file Step 4e wrote).
- Verify the file is non-empty: `test -s tasks/logs/codex-implement-phase-{N}-*-attempt{ATTEMPT}.log`.
- **Parseability check** (per `tasks/design-decision.md:32`): each line should be parseable JSON when `--json` is enabled. Run `jq -c . <log-file> > /dev/null 2>&1`; if it fails, record a parseability finding in metrics Notes (`json-log-unparseable`) but do not block diagnosis — the textual content is still inspectable. (`jq` is a standard developer-environment tool; if absent, fall back to `python3 -c "import json,sys; [json.loads(l) for l in open('<log>')]"` or skip the check with a metrics note.)
- If empty (process died before any event): record as `crashed` ambiguous, escalate.
- Otherwise, read the last ~50 lines (`tail -n 50`) to identify the last action Codex took. Look for `tool_use` events (file edits) and any `error` events.

**Diagnosis step 2 — Read git state.**
- `git status --porcelain` (captures both modified-tracked and untracked files; `--porcelain` is more grep-friendly than `--short`).
- `git diff` (full content, not `--name-only` — the design says semantic content matters).
- Enumerate untracked AND ignored files explicitly with `git ls-files --others` (no `--exclude-standard` — ignored files matter per `tasks/design-decision.md:43`; Codex may have created a file matching a `.gitignore` pattern that would otherwise be invisible). For partial-credit reporting, also run `git ls-files --others --exclude-standard` separately to distinguish "untracked-not-ignored" from "untracked-but-ignored."

**Diagnosis step 3 — Classify into one of three sub-states:**

(a) **Effectively done** — all plan-cited files are in the diff, edits look coherent (compared against the plan), AND Claude-run success criteria pass.
- Action: treat as DONE. Run Step 4g onwards (using the post-Codex git state as the "real diff" input — the baseline subtraction still works). Commit with a message noting "Codex crashed post-edits but pre-summary; verified manually."
- Metrics row: State=`done` (since the work is done); Notes=`crash-recovered (effectively-done)`.

(b) **Partial but recoverable** — log shows Codex got partway through the file list before dying (transient: network blip, model timeout); OR success criteria fail with a coherent partial diff.
- Action: retry with a *resume brief*. Increment ATTEMPT (outer-loop variable) to 2 — cap is 2 (one retry total per phase across mismatch + partial-recoverable; if ATTEMPT is already 2, escalate to (c)). The resume brief is the same template + slot block, with an additional appended note: "Files X, Y already edited and look correct based on the prior attempt. Please complete Z only."
- Re-run Step 4e (now ATTEMPT=2; the log filename suffix updates accordingly).
- If the retry also crashes, escalate to (c).
- Metrics rows: original attempt → State=`crashed`, Notes=`partial-recoverable, attempt 1`. Retry on success → State=`done`, Notes=`crash-recovered (resumed, attempt 2)`.

(c) **Ambiguous or repeated crash** — diff doesn't match the plan cleanly; untracked/ignored files don't fit the phase scope; both signal tmps present; or this is the second crash on the same phase (ATTEMPT == 2).
- Action: STOP. Report to the developer with: log excerpt (last 50 lines), `git status --porcelain` output, summary of the diff, untracked+ignored file list, and one paragraph of Claude's diagnosis. **No auto-restore of the working tree** — the developer decides whether to roll back, patch, or drop the phase.
- Metrics row: State=`crashed`, Notes=`ambiguous` or `repeated`.

### Step 4h — JSON-log audit (test-execution violations + parseability)

After every DONE-path completion (whether direct or via crash-recovery), audit the phase's JSON event log:

**Audit 1 — parseability** (per `tasks/design-decision.md:32`):
```bash
jq -c . tasks/logs/codex-implement-phase-{N}-*-attempt*.log > /dev/null 2>&1
```
If `jq` exits non-zero: log a parseability finding in metrics Notes (`json-log-unparseable`). Do not block — the textual log is still inspectable for the test-execution audit.

**Audit 2 — test-execution violations** (per `tasks/design-decision.md:31` test-ownership rule):
```bash
grep -E '"name":"(bash|shell)"|"command":"(npm test|pytest|cargo test|jest|vitest|tsc|eslint|prettier|go test|make|bash)' tasks/logs/codex-implement-phase-{N}-*-attempt*.log
```

If any match: Codex ran a verification command despite the brief telling it not to. Record in metrics: Test-violation=`yes`. Add a note to the row identifying which command. **Do not block the commit** — the violation has already happened; the metrics gate (zero violations in last 5 runs per `tasks/design-decision.md:193`) is what tracks recurrence.

If no match: Test-violation=`no`.

The audit grep pattern is best-effort. The actual JSON event schema may differ — refine the pattern empirically against the first real `/implement-codex` runs (subsequent dogfood task; out of scope here).

**Verification (Phase 4 success criteria):**
- [x] Step 4f's MISMATCH / BLOCKED / CRASHED arms are all present in `.claude/commands/implement-codex.md` with concrete sub-flows (not stubs).
- [x] `grep -q "Effectively done\|partial-recoverable\|ambiguous" .claude/commands/implement-codex.md` — three crash sub-states are documented.
- [x] `grep -q "JSON-log audit\|grep.*npm test\|test-execution\|jq -c" .claude/commands/implement-codex.md` — JSON audit logic (parseability + test-execution) is documented.
- [x] `grep -q "tasks/codex-debug-{N}.tmp\|tasks/codex-debug-" .claude/commands/implement-codex.md` — Step 4c structural re-research output path present.
- [x] `grep -q "git ls-files --others" .claude/commands/implement-codex.md` AND the line that does NOT include `--exclude-standard` (or includes both forms — see crash diagnosis step 2) — ignored-file enumeration is present per design.
- [x] `grep -c "\-a never" .claude/commands/implement-codex.md` — at least 2 occurrences (the per-phase Codex invoke + the structural-mismatch re-research; Step 6 is a third). *(Returns 6 — well above the threshold.)*
- [x] Manual end-to-end read of `.claude/commands/implement-codex.md` from line 1 to end: every state branch returns to a consistent end (commit + metrics row + plan checkmark, or escalation+stop). No orphan branches.
- [x] Manual diff against `.claude/commands/implement.md`: Steps 1-3 differ only in the new prereq (`codex` on PATH check) and the new pre-delete signals; Steps 5, 9 are identical except for renamed artifact paths; Steps 6-8 are identical in semantics, with renamed artifact paths AND `-a never` added per cross-cutting constraint (deviation documented as design-required); Step 10 is extended; Step 11 has the new metrics-summary section. All diffs are intentional and traceable to the design. *(Step 6 and Step 8 prompt bodies verified byte-for-byte identical to `/implement.md` via diff after path normalization.)*

**Commit:** `feat(implement-codex): add unhappy-path branches and JSON-log audit`.

## Phase 5 — Codex-CLI dry-run (artifact validation, not experiment execution)

**Goal.** Empirically validate the CLI-level assumptions baked into the command file: flag acceptance, brief rendering, output-schema emission, JSON event-log shape (so the Step 4h audit grep matches reality). This is NOT an end-to-end `/implement-codex` invocation — it's a single isolated `codex exec` call against a synthetic brief, reverted via `git checkout` after validation.

**Why this is in scope despite "Task 12 lands the artifact only".** The dry-run validates the artifact, not the experiment. It catches errors that artifact-level grep can't:
- CLI flag drift (e.g., `--json` may have been renamed in a Codex CLI update; `--sandbox workspace-write` may behave differently than docs say)
- Output schema renders differently than the brief asks for (Codex emits an off-schema STATUS line, or skips FILES_CREATED when nothing was created)
- JSON event log shape differs from the audit grep pattern in Step 4h (real events use different keys than `"name":"bash"` etc.)

If any surface, fix in `.claude/commands/implement-codex.md` (or `.claude/prompts/implement-codex-phase-brief.md`) before Task 12 closes. If nothing surfaces, Phase 5 is a no-op gate.

**Steps:**

1. **Create a throwaway target file.** Add `tasks/smoke-target.md` with a single line `# smoke target` and commit it as a scaffold:
   ```bash
   echo "# smoke target" > tasks/smoke-target.md
   git add tasks/smoke-target.md && git commit -m "chore(implement-codex): smoke-test scaffold (Phase 5)"
   ```
   The scaffold commit makes the post-dry-run revert mechanical (`git checkout HEAD -- tasks/smoke-target.md`) and the eventual cleanup a single `git rm`.

2. **Compose the synthetic phase brief.** Write `tasks/codex-smoke-prompt.tmp` containing:
   - The full contents of `.claude/prompts/implement-codex-phase-brief.md` (cat'd in).
   - A `## Variable Slots` block with: `Phase number: 0`, `Plan excerpt: tasks/smoke-target.md (read its content before editing)`, `File allow-list: - tasks/smoke-target.md`, `Success criteria: - test -f tasks/smoke-target.md` (informational; do NOT execute).
   - At the end, an explicit task line: "Append a single comment line `<!-- smoke -->` to tasks/smoke-target.md. Do nothing else. Then emit the §Output schema block."

3. **Pre-delete potential signal tmps.**
   ```bash
   rm -f tasks/codex-mismatch-0.tmp tasks/codex-blocked-0.tmp tasks/codex-smoke.tmp
   ```

4. **Invoke Codex** with the same flags `/implement-codex` will use, backgrounded, 10-minute timeout:
   ```bash
   mkdir -p tasks/logs && \
   TIMESTAMP=$(date +%Y%m%d-%H%M%S) && \
   codex -c model_reasoning_effort=xhigh -a never exec \
     --sandbox workspace-write \
     --json \
     -o tasks/codex-smoke.tmp \
     "$(cat tasks/codex-smoke-prompt.tmp)" \
     </dev/null \
     > tasks/logs/codex-smoke-${TIMESTAMP}.log 2>&1
   ```
   `run_in_background: true`.

5. **Validate the result.** After Codex returns, check each in turn — any failure means the command file or template needs a fix:
   - **Output check:** `bash .claude/scripts/codex-output-check.sh tasks/codex-smoke.tmp 5` returns OK.
   - **Output schema renders:** `tasks/codex-smoke.tmp` contains literal `STATUS:`, `FILES_MODIFIED:`, `FILES_CREATED:`, `SUMMARY:`, `NOTES:` lines.
   - **STATUS is `done`:** the smoke task has no mismatch path.
   - **File enumeration matches reality:** `FILES_MODIFIED` lists `tasks/smoke-target.md`; `git diff --name-only` shows the same single file (no other files touched besides command-owned tmp/log artifacts that we filter out).
   - **No bulldozing:** the only non-command-owned file in `git diff --name-only` is `tasks/smoke-target.md`.
   - **JSON log non-empty + parseable:** `test -s tasks/logs/codex-smoke-*.log` AND `jq -c . tasks/logs/codex-smoke-*.log > /dev/null`. If `jq` fails, record the parseability failure but don't block — the textual log is still inspectable.
   - **Audit grep pattern matches event shape:** Inspect a few events from the smoke log. The Step 4h grep is `grep -E '"name":"(bash|shell)"|"command":"(npm test|...)"'`. Verify against real events: do `tool_use` events for shell calls actually use the `"name":"bash"` / `"name":"shell"` keys the grep assumes? If the real schema differs (e.g., `"tool_name":"bash"`, `"action":"shell"`), refine the grep pattern in `.claude/commands/implement-codex.md` Step 4h to match.
   - **Smoke run did not violate the test-ownership rule.** The audit grep should return zero matches against the smoke log — if it matches, Codex ran a verification command despite the brief's prohibition, which is a finding to investigate (the brief wording may need strengthening).

6. **Revert the smoke edit and clean up tmp artifacts.**
   ```bash
   git checkout HEAD -- tasks/smoke-target.md
   git rm tasks/smoke-target.md
   git commit -m "chore(implement-codex): drop smoke-test scaffold (Phase 5)"
   rm -f tasks/codex-smoke.tmp tasks/codex-smoke-prompt.tmp tasks/logs/codex-smoke-*.log
   ```
   The two scaffold commits (add + drop) bracket the dry-run cleanly in git history.

7. **Commit refinements (if any).** If Step 5 surfaced needed fixes in `.claude/commands/implement-codex.md` or `.claude/prompts/implement-codex-phase-brief.md`, commit them: `fix(implement-codex): refine <what> based on dry-run`. If no refinements were needed, Phase 5 produces only the two scaffold commits (add + drop), which net-zero the working tree.

**Verification (Phase 5 success criteria):**
1. The Codex invocation completed and produced `tasks/codex-smoke.tmp` matching the output schema.
2. JSON log is parseable AND its event shape matches the Step 4h audit grep pattern (or the grep was refined to match — committed under Step 7 of this phase).
3. `git status --porcelain` after revert + cleanup shows clean tree (no leftover smoke artifacts).
4. If any refinements were committed, they're traceable to specific Step 5 findings.

**Failure handling.** If Step 4 (Codex invocation) fails with a CLI error before producing any output, Phase 5 produces a finding: the assumed flag set is wrong. Fix in `.claude/commands/implement-codex.md` Step 4e and Step 6 (which uses the same invocation pattern) and re-run Phase 5. If Codex returns but emits a malformed schema, fix the template wording in `.claude/prompts/implement-codex-phase-brief.md` and re-run. Cap at 2 dry-run iterations — if the third iteration still fails, stop and report to the developer; something deeper is wrong with the design's CLI assumptions.

## Judgment Calls

Specific choices made in this plan where an alternative was viable. Each is open to revision before implementation begins.

1. **Phase brief template format.** I chose visible markdown headers (`## Variable Slots`) over HTML-comment fences for the slot block (Phase 1, item 9). Alternative: HTML comments (`<!-- -->`). Reasoning: visible markdown is unambiguous to Codex and easier to spot when filling slots; HTML comments invite Codex to ignore the block.

2. **Artifact naming for renamed Steps 6-8.** Chose `tasks/codex-implement-code-review.tmp` and `tasks/code-review-fixes-implement.tmp` (codex-review-flagged). Alternative: longer forms with `-codex` suffix (e.g., `tasks/codex-implement-codex-code-review.tmp`). Reasoning: the shorter form follows `/issue-implement`'s prefix-`codex-` + command-infix pattern; "implement-codex" infix would repeat the command name redundantly. The "implement" infix is briefly ambiguous to a reader who doesn't know the command, but in practice this file is only produced/consumed by `/implement-codex.md`, so ambiguity has no operational consequence.

3. **Timestamp granularity for per-phase log files.** Chose seconds (`%Y%m%d-%H%M%S`) for per-phase logs only — diverging from the existing minute-granularity (`%Y%m%d-%H%M`) playbook standard. Alternative: keep minute-granularity uniform. Reasoning: design (`tasks/design-decision.md:32`) explicitly calls for seconds + attempt suffix to prevent collisions on rapid same-phase retries. Other timestamps in the new file (Step 8 child log) keep minute-granularity since rapid retries are not a concern there.

4. **Pre-flight network detection — hard-stop, not heuristic warn** (revised after codex-review). Phase 3 Step 4b stops the entire `/implement-codex` invocation on detection. Alternative: soft warn with developer Y/n. Reasoning: design (`tasks/design-decision.md:29`) puts network-required phases out-of-scope by default; the right posture is hard-stop with a clear fallback message (run `/implement` instead), not interactive override. False positives cost one developer plan-re-read; false proceed costs a wasted Codex invocation.

5. **Phase 5 narrow Codex-CLI dry-run, not full end-to-end smoke** (revised twice). Original draft had a full smoke (run `/implement-codex` against a throwaway plan) — Codex flagged scope contradiction + runnability issues (`tasks/plan.md` hardcoded). First revision dropped the smoke entirely. Final revision (after developer feedback): added Phase 5 as a *narrow* dry-run that invokes `codex exec` directly with the phase brief — no `/implement-codex` end-to-end execution, no `tasks/plan.md` swap, no metrics seeding. This empirically validates CLI flag acceptance, output-schema rendering, and JSON event-log shape (catches errors that artifact-level grep can't), while staying within the "artifact only" scope. Alternatives weighed: (a) defer dry-run to a follow-up — Codex flag drift would slip to dogfood time, costing one wasted real run; (b) full end-to-end smoke — runnability problem unchanged. The narrow form gets ~80% of the value at ~20% of the scope cost.

6. **Crash retry cap = 1 across both partial-recoverable and mismatch retries.** Design `:45` says cap = 1 for partial-recoverable. Reasoning extended to mismatch retries by analogy: if the second attempt also returns mismatch, the plan needs deeper work, not another auto-retry. Alternative: distinct caps per branch. Reasoning: uniform cap is simpler and the "second-failure escalates" rule applies symmetrically. ATTEMPT is initialized once per phase at the outer-loop level, NOT inside Step 4e (codex-review correction #9).

7. **Metrics file format — markdown table.** Alternative: append-only CSV; YAML log; structured JSONL. Reasoning: human-readable for promotion review; tool-parseable with simple awk; no new dependencies; matches `tasks/issues.md` pattern in the playbook (markdown table for tracked work).

8. **First-run metrics-file initialization at Step 4m, not Step 1.** Alternative: initialize on prereq check. Reasoning: lazy initialization avoids creating an empty file when prereqs fail; the metrics file should only exist if a real run produced data.

9. **Step 11 includes a new "Experiment metrics" sub-section.** Alternative: keep Step 11 identical to `/implement` and let the developer manually inspect `tasks/implement-codex-metrics.md`. Reasoning: surfacing the metrics in the post-run report is what makes the experiment observable in the workflow; otherwise developers will forget to check the file.

10. **No `.gitignore` entry for `tasks/logs/` or `tasks/implement-codex-metrics.md`.** Alternative: ignore logs to prevent repo bloat. Reasoning: the design's open question on log retention is unresolved; deferring `.gitignore` decisions to first promotion review keeps options open. Logs are local-only by default (no `/finish` cleanup, no commit step) — they accumulate in the worktree but don't pollute history unless explicitly committed.

11. **Phase 2 verification check #6 (negative grep for old artifact name).** Alternative: rely on manual review only. Reasoning: a stray `tasks/codex-code-review.tmp` reference would create a runtime collision with `/implement` if both commands ever ran on the same plan in adjacent batches; explicit negative grep catches this cheaply.

## Artifact references

- `tasks/research-codebase.md` — the codebase-grounded research (axes, coupling, risks).
- `tasks/design-decision.md` — the finalized design (Option 4 + axis choices + open-question resolutions).
- `.claude/commands/implement.md` — the production command being mirrored. Steps 1-3 (lines 9-25), Step 4 (lines 27-65), Step 5 (lines 67-69), Steps 6-8 (lines 71-147), Steps 9-11 (lines 149-168).
- `.claude/commands/issue-implement.md` — sibling-command precedent for artifact naming pattern.
- `.claude/commands/codex-review.md:55-62` — tmp-file prompt-delivery precedent.
- `.claude/scripts/codex-output-check.sh` — output verification helper (5+ lines minimum, default).
- `.claude/prompts/research-guide.md`, `.claude/prompts/research-patterns-guide.md` — `.claude/prompts/` precedent for static templates.
- `tasks/todo.md:117-140` — Task 12 spec.
- `CLAUDE.md` § Quality Standards (surgical-changes rule), § Multi-Batch Plans, § Pre-Edit Gate.

## End-to-end success criteria (cross-phase)

After all five phases, the following must all hold:
- `.claude/commands/implement-codex.md` exists and is internally consistent (every artifact path referenced in one section appears in the cleanup list in Step 10).
- `.claude/prompts/implement-codex-phase-brief.md` exists and contains every required section.
- Every `codex exec` invocation in the new file has all three: `-a never`, `</dev/null` (Issue #2), and the `run_in_background: true` directive comment (Task 10 pattern, manually applied per `tasks/design-decision.md:24`).
- Every `claude -p` invocation has `</dev/null` and is backgrounded.
- The negative-grep checks (Phase 2 #6, #7) pass — no `/implement`-only artifact references remain in the new file.
- Steps 6-8's **prompt bodies** (the heredoc content of the Codex review prompt and the child fix prompt) in `.claude/commands/implement-codex.md` are byte-for-byte identical to `.claude/commands/implement.md`'s. Verify with `diff` after extracting the prompt blocks. The Codex *invocation flags* differ (new file adds `-a never`); the prompt body stays unchanged.
- The metrics file header in `tasks/implement-codex-metrics.md` (when first created at runtime) includes all 11 columns: Date, Run, Phase, State, Codex LOC, Files written, Claude patch (lines), Drift caught, Test-violation, Step 6 severe (Codex-attrib), Notes. (Verified by reading the header literal in `.claude/commands/implement-codex.md` Step 4m.)
- Phase 5's Codex-CLI dry-run completed: Codex emitted the output schema, JSON log was parseable, and the audit grep pattern matched the real event shape (or was refined to match and committed). Working tree is clean post-Phase-5; the two scaffold commits (add + drop `tasks/smoke-target.md`) net zero net file changes.
