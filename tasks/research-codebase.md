# Research: `/implement-codex` — Codex drives, Claude verifies per-phase

## Research Question

Design a sibling command `/implement-codex` (file: `.claude/commands/implement-codex.md`) that flips the executor of `/implement`: Codex writes the code phase-by-phase under `--sandbox workspace-write`; Claude verifies each phase (plan adherence + cross-phase coherence + automated success criteria); the existing Codex code review + Claude triage + child fix application from `/implement` Steps 6-8 reuse unchanged. Ship as a separate command — `/implement` stays untouched. Source: `tasks/todo.md` Task 12 (lines 117-140).

## Summary

The new surface is the **phase loop only** (Steps 1-5 in `/implement`'s structure); Steps 6-11 mirror `/implement` line-for-line with renamed artifacts. The hard correction from Codex's research is sandbox-shaped: under `--sandbox workspace-write`, Codex **cannot stage or commit** because `.git` is protected read-only inside writable roots — so commit ownership is forced onto Claude regardless of any other choice. That single fact collapses one axis and tightens the rest of the design.

The experiment's two named risks — Codex bulldozing through structural mismatches, and weakened final-review independence (the Step 6 Codex review is now reviewing Codex-written code) — are both downstream of the same shift: Codex is now the writer, not just a reader. The compensations cluster: tighter sandbox path scope, an explicit pre-edit "stop and report" mismatch contract, broader per-phase Claude verify (diff scope + plan coverage + cross-phase coherence, not just success criteria), and per-phase verify findings injected into the final review prompt. The design decision is which compensations carry the weight.

Network is disabled by default under `workspace-write` — phases requiring `npm install` / `pip install` / fetch are not viable in the default sandbox. Either constrain the experiment to install-free phases, or document `--add-dir` / config overrides as a per-phase escape hatch.

## Detailed Findings

### Production target being mirrored: `/implement`

**Steps 1-3** (`.claude/commands/implement.md:9-26`): prereq check (plan + research artifacts exist, plan finalized), full plan read, resume detection from `- [x]` checkmarks. Mirror these unchanged — same artifacts, same resume signal.

**Step 4** (`.claude/commands/implement.md:27-65`): the per-phase loop. Phase reads files, applies edits, handles mismatches via four explicit branches (minor → adapt; structural → top-level Codex re-research with `--sandbox read-only`; plan-premise-invalidated → document & adapt; tests-fail-after-2 → stop), runs scoped automated verification, checks off items, commits each phase. **This is the surface that gets rewritten** — Claude no longer applies edits via Edit/Write; Codex does, under `workspace-write`.

**Step 5** (`.claude/commands/implement.md:67-69`): full-suite post-implementation verify with the same scoped-failure rule. Mirror unchanged.

**Steps 6-8** (`.claude/commands/implement.md:71-147`): Codex code review (background, `read-only`, full prompt), Claude triages findings into `tasks/code-review-fixes.tmp`, background `claude -p` child applies fixes. **Mirror line-for-line with renamed artifacts** (`tasks/codex-codex-code-review.tmp` or similar — naming open). Task 12 explicitly says "unchanged."

**Steps 9-11** (`.claude/commands/implement.md:149-168`): final verify + commit + cleanup + present results. Mirror unchanged.

The parallel `/issue-implement` (`.claude/commands/issue-implement.md:1-197`) confirms the sibling-command pattern: same skeleton, `$ARGUMENTS`-keyed artifact paths. Out of scope for this task — Task 12 defers `/issue-implement-codex` as a follow-up.

### Codex CLI surface

Every existing `codex exec` site uses `--sandbox read-only` (`.claude/commands/research-codebase.md:43-46`, `design.md:87-198`, `create-plan.md:55-86`, `implement.md:39-98`, `codex-review.md:58-61`, `issue-research.md:43-46`, `issue-plan.md:61-92`, `issue-implement.md:46-109`). **`/implement-codex` is the playbook's first `--sandbox workspace-write` site** — there is zero in-repo precedent.

Verified externally (Codex's web research, sources cited in §External Research below):
- `workspace-write` allows edits and shell execution within the workspace
- `.git`, resolved gitdir, `.agents`, `.codex` are protected read-only inside writable roots — **Codex cannot stage or commit**
- Network is **disabled by default** in `workspace-write`
- Additional roots can be added via `--add-dir` or config; `.gitignore` is **not** a sandbox boundary
- `codex exec` invocations are stateless unless `codex exec resume` is used explicitly
- `</dev/null` composes (just an empty stdin, no extra prompt context)
- `model_reasoning_effort` is independent of sandbox mode

Output verification: every `codex exec` call is followed by `bash .claude/scripts/codex-output-check.sh <path> <min-lines>` — except `.claude/commands/codex-review.md:58-61`, which has neither the helper nor `model_reasoning_effort=xhigh` (Codex flagged this as a CORRECTION but it's pre-existing surface unrelated to Task 12's scope).

### Background-mode and `</dev/null` discipline

Confirmed across `.claude/commands/`:
- Background sites today: `implement.md:71-98` (Step 6 Codex review), `implement.md:134-147` (Step 8 child fix), `issue-implement.md:80-109, 149-159` (parallel), `auto-issues.md:30-57` (Phases 1-3 only — Phases 4-5 are still foreground at `auto-issues.md:64-81`)
- `</dev/null` is uniform on every long-running `codex exec` and `claude -p` site (Issue #2, landed 2026-05-03)
- Task 10's `run_in_background: true` discipline must be **applied manually** in the new file because Task 10 hasn't shipped yet — every Codex write call and the final fix-applier child must be backgrounded with `</dev/null`. There is no automated lint and no later sweep that retrofits.

### `CLAUDE.md` constraints that bind

- **Surgical-changes rule** (`CLAUDE.md` § Quality Standards): every changed line traceable to the plan; no opportunistic refactors. Codex's training bias is toward "fixing things up" — the phase brief must explicitly invoke this rule.
- **Pre-Edit Gate** (`CLAUDE.md` § Pre-Edit Gate): trivial single-file ≤20 line changes can skip RDPI; non-trivial requires full RDPI. `/implement-codex` only fires under the non-trivial path (a finalized `tasks/plan.md` exists).
- **Sub-Agent Use** (`CLAUDE.md` § Sub-Agent Use): split test, single-message batching, recursion guard. `/implement-codex` itself is not a sub-agent path — Codex calls are top-level Bash tool invocations, not Agent calls — but the prohibition on Codex-from-inside-sub-agents still applies (no nested Agent → Codex paths).
- **Multi-Batch Plans** (`CLAUDE.md` § Multi-Batch Plans): one batch per `/implement-codex` invocation. Mirrors `/implement` exactly.

## Code References

- `.claude/commands/implement.md:1-176` — production target being mirrored. Steps 6-11 reuse unchanged; Steps 1-5 get the executor flipped.
- `.claude/commands/issue-implement.md:1-197` — parallel issue-flow command. Out of scope; useful as confirmation of the sibling-command pattern.
- `.claude/commands/auto-issues.md:30-86` — closest in-repo orchestration precedent (parent launches children, state moves through artifacts/logs, parent verifies between phases). Note: Phases 4-5 are still foreground (a Task 10 concern, not Task 12's).
- `.claude/scripts/codex-output-check.sh:1-22` — file-existence + min-lines check; mandatory after every Codex output.
- `CLAUDE.md` § Quality Standards — surgical-changes rule.
- `CLAUDE.md` § Multi-Batch Plans — one batch per invocation.
- `tasks/todo.md:117-140` — authoritative Task 12 spec (flow, useful context, out of scope, sequencing, discipline preservation).

## Architecture Analysis

**Why a sibling command, not a flag on `/implement`.** Task 12's `out of scope` says explicitly: don't modify `/implement`. The deeper reason: the per-phase surface is meaningfully different. `/implement` does in-session Edit/Write tool calls; `/implement-codex` shells out to `codex exec` per phase. A flag would force two divergent code paths through one file. Sibling experiment is the cleaner shape, and matches the playbook's existing pattern (the issue-flow `/issue-implement` is a sibling, not a flag).

**Why the new surface is just Steps 1-5.** The Codex-as-writer change only affects the per-phase loop. Steps 6-8 (final Codex code review + Claude triage + child fix application) operate on the *output* of the loop — they don't care who wrote the code. Reusing them unchanged is the explicit design directive in Task 12 ("`unchanged from /implement` Steps 6-8") and it preserves the existing review surface.

**Why review independence weakens.** Today: Claude writes (in-session Edit/Write), Codex reviews (Step 6 background `codex exec`). Two distinct agent families — strong independence. Under `/implement-codex`: Codex writes phase-by-phase, Claude verifies per-phase (Step 2), Codex reviews (Step 3 / Step 6 reuse). The final review is the same agent family reviewing its own writing — not the same session (each `codex exec` is stateless), but same training distribution and same biases. Per-phase Claude verify is the partial compensation; whether it's enough is a measurable hypothesis the experiment must answer.

**Why the bulldoze risk is real.** Codex's training bias rewards "completing the task" — including improving things adjacent to the explicit prompt. Under `read-only` this manifests as opinions in the output; under `workspace-write` it manifests as edits beyond the phase's plan-cited scope. The mismatch-handling axis exists because no single mitigation handles this fully — sandbox path scope, prompt framing, and post-diff Claude verification each catch a different leak.

**Why commit ownership is forced.** `--sandbox workspace-write` protects `.git` read-only. Codex *cannot* stage or commit. The "Codex auto-commits" choice on the Commit Ownership axis is not viable under the documented sandbox semantics. The remaining choices are: Claude commits per phase (mirrors `/implement`), Claude commits at the end only (loses the per-phase reviewability that `/implement` preserves), or Codex outputs a staging hint that Claude executes. This collapses the axis to "Claude commits per phase" as the default, leaving "single end-of-batch commit" as the only real alternative.

## Design Axes

### Axis: Phase Execution Unit

- **Choices:**
  - **A. One `codex exec` per unchecked phase in `tasks/plan.md`** (matches `/implement`'s phase-by-phase rhythm)
  - **B. One `codex exec` per multi-step plan section** (coarser; risks larger diffs to verify)
  - **C. One `codex exec` per whole batch** (coarsest; loses per-phase verify granularity entirely)
- **Per-axis constraints:** `CLAUDE.md` § Multi-Batch Plans says one batch per invocation; Task 12 mandates Claude verification at every phase or batch boundary; `codex exec` is stateless.
- **Evidence:** `tasks/todo.md:119-122`, `CLAUDE.md` § Multi-Batch Plans, `.claude/commands/implement.md:27-65`.

### Axis: Sandbox Path Scope

- **Choices:**
  - **A. Default `workspace-write`** — entire workspace + temp dirs writable
  - **B. `workspace-write` + `--add-dir`** — adds extra writable roots if a phase needs them
  - **C. Custom permission profile** — tighter filesystem allow/deny rules via Codex config
  - **D. Default scope + prompt-level allow-list only** — sandbox is wide; the phase brief tells Codex which files it may edit
- **Per-axis constraints:** `.git`, resolved gitdir, `.agents`, `.codex` are protected regardless of choice. Network is off by default. `.gitignore` is **not** a sandbox boundary. If Codex must write tmp signal files (e.g., `tasks/codex-mismatch-{phase}.tmp`), `tasks/` must remain writable.
- **Evidence:** OpenAI Codex security docs (https://developers.openai.com/codex/agent-approvals-security), config docs (https://developers.openai.com/codex/config-reference), local `codex exec --help`.

### Axis: Mismatch Handling Model

- **Choices:**
  - **A. Codex writes `tasks/codex-mismatch-{phase}.tmp` and refrains from editing source** when it detects a structural mismatch; Claude reads on resume.
  - **B. Codex reports mismatch in its `-o` final output only** — Claude inspects the file, Codex doesn't make a separate signal.
  - **C. Sandbox / permission allow-list mechanically prevents edits outside the phase's plan-cited file list** — Codex can't bulldoze even if it tries.
  - **D. Claude detects mismatch post-diff and rolls back / patches / re-researches** — Codex writes freely, Claude is the gate.
  - **E. Structured output status** — Codex returns one of `implemented | mismatch | blocked` via prompt-instructed schema; Claude branches on it.
- **Per-axis constraints:** `/implement` Step 4c treats structural mismatches as a stop-and-research event with a top-level `read-only` Codex re-research (`.claude/commands/implement.md:35-54`) — the new command must preserve this branch's *intent* even if the mechanism changes. There is no `codex exec` exit-code channel for "structural mismatch." Tmp-file signaling requires `tasks/` writable.
- **Evidence:** `tasks/todo.md:127`, `.claude/commands/implement.md:35-54`, OpenAI prompt guidance (https://developers.openai.com/api/docs/guides/prompt-engineering#coding).

### Axis: Mismatch Detection Responsibility

- **Choices:**
  - **A. Codex pre-edit detection and stop/report** — phase brief tells Codex to inspect first, then write
  - **B. Claude post-diff detection** — Codex writes; Claude reads the diff and decides
  - **C. Both — defense in depth** — Codex instructed to stop, Claude still verifies after
- **Per-axis constraints:** Task 12 names "Codex bulldozing" as the experiment's biggest risk. Claude must verify plan adherence and cross-phase coherence regardless. Pure-A relies on Codex's self-recognition (uncertain); pure-B accepts diff-and-rollback latency; both adds prompt cost without obvious downside.
- **Evidence:** `tasks/todo.md:121, 127-128`, `CLAUDE.md` § Pre-Edit Gate.

### Axis: Per-Phase Verification Scope

- **Choices:**
  - **A. Only the phase's automated success criteria** — mirrors `/implement` Step 4d minimally
  - **B. Plus diff-scope check** (every changed file appears in the phase's plan-cited file list)
  - **C. Plus cross-phase coherence** (pattern coherence with prior phases, cumulative scope drift, plan coverage so far) — what Task 12 explicitly mandates as broader than `/implement`'s per-phase verify
  - **D. Plus a full Codex-style code-quality review per phase** (would duplicate Step 6's final review)
- **Per-axis constraints:** Step 6 (final Codex review) reuses unchanged, so per-phase verify shouldn't duplicate it. Task 12 explicitly requires broader-than-`/implement` scope.
- **Evidence:** `.claude/commands/implement.md:56-65`, `tasks/todo.md:121`.

### Axis: Phase Brief Content (what's in the prompt)

- **Choices:**
  - **A. Verbose self-contained brief** — phase text quoted, file list, acceptance criteria, surgical-changes rule quoted, mismatch contract, output contract
  - **B. Reference-by-citation brief** — short prompt that tells Codex to read `tasks/plan.md:lines N-M` and follow it
  - **C. Hybrid** — verbose framing (rule + contract) inline, plan content by citation
- **Per-axis constraints:** `codex exec` is stateless across phases; no carried context. Surgical-changes rule must be explicit. Phase briefs that rely on file reads cost an extra Codex tool round-trip per phase.
- **Evidence:** `tasks/todo.md:125-128`, `CLAUDE.md` § Quality Standards, OpenAI prompt guidance.

### Axis: Phase Brief Delivery (how it reaches Codex)

- **Choices:**
  - **A. Inline string** in the Bash command (matches most playbook command files)
  - **B. Tmp-file + `$(cat <path>)`** (matches `.claude/commands/codex-review.md:55-62`)
- **Per-axis constraints:** Inline gets noisy with verbose briefs and risks shell escaping bugs. Tmp-file adds a write/cleanup step but isolates prompt from shell.
- **Evidence:** `.claude/commands/codex-review.md:55-62` (tmp-file precedent), all other Codex sites use inline.

### Axis: Commit Ownership

- **Choices:**
  - **A. Claude stages and commits after each verified phase** — mirrors `/implement` per-phase commit cadence
  - **B. No commits until post-implementation** — single end-of-batch commit
  - **C. Codex stages, Claude commits** — Codex outputs a staging hint (file list)
- **Per-axis constraints:** `.git` protection makes Codex auto-commit *not viable*. `/implement` commits each phase (`.claude/commands/implement.md:62-65`). Task 11's open question on staging untracked source files is a Task-11 concern, but `/implement-codex`'s phase brief should be explicit about untracked files (Codex creates them, Claude must know to stage them).
- **Evidence:** `.claude/commands/implement.md:62-65`, `tasks/todo.md:70, 84-87`, OpenAI security docs.

### Axis: Final Review Independence Mitigation

- **Choices:**
  - **A. Accept weaker independence** as a known experimental cost
  - **B. Inject Claude's per-phase verify findings into the Step 6 review prompt** as confirmed flags ("these were already noted by Claude per-phase; verify and add new findings")
  - **C. Different `model_reasoning_effort` or prompt framing** on the review pass
  - **D. Fresh `codex exec`** invocation with no carried context (already the default — `codex exec` is stateless unless `resume` is used)
- **Per-axis constraints:** Task 12 says reuse Steps 6-8 *unchanged*. Choices B and C technically modify Step 6 — design must explicitly relax "unchanged" if it picks them, or rule them out. Choice D is already the default and provides no new mitigation.
- **Evidence:** `tasks/todo.md:122, 129`, `.claude/commands/implement.md:71-147`, OpenAI Codex non-interactive docs (https://developers.openai.com/codex/noninteractive).

### Axis: Metrics Instrumentation

- **Choices:**
  - **A. Per-phase notes appended to `tasks/plan.md`** next to checkmarks (e.g., "phase 3 — Codex pass clean / Claude patched 4 lines")
  - **B. Persistent `tasks/implement-codex-metrics.md`** that survives cleanup
  - **C. Tmp `tasks/implement-codex-metrics.tmp`** summarized in Step 11's report before cleanup
  - **D. Commit-message trailers** (e.g., `Codex-rewrite-ratio: 12%`)
  - **E. `codex exec --json` event logs** captured under `tasks/logs/`
- **Per-axis constraints:** Task 12 explicitly requires observable Claude-rewrite ratio and promotion criteria. Tmp-only erases experimental data on cleanup. Commit-trailer parsing has tooling cost.
- **Evidence:** `tasks/todo.md:130, 132`, OpenAI Codex non-interactive docs.

### Axis: Promotion Criteria Definition

- **Choices:**
  - **A. Numeric thresholds upfront** (e.g., "≥10 successful runs with <20% Claude-side patch rate and ≥30% Claude token reduction")
  - **B. Qualitative thresholds upfront** (e.g., "experiment passes if developer reports it didn't introduce coordination bugs across N runs")
  - **C. Defer threshold-setting until first metrics arrive**
- **Per-axis constraints:** Task 12 says "define validation criteria up front… so the experiment doesn't drift indefinitely." Choice C technically violates that. Choice A requires picking numbers without operating data; Choice B trades measurability for executability.
- **Evidence:** `tasks/todo.md:131-132`.

### Axis: Output Contract

- **Choices:**
  - **A. Existing `-o <tmp>` final-message file** + `codex-output-check.sh` (matches every other Codex site)
  - **B. Add `--json` event logs** while preserving `-o`
  - **C. `--output-schema` for structured `{status, files_edited, mismatch_reason}` object**
- **Per-axis constraints:** Output verification expects file-existence + min-lines. A single-line JSON output may fail min-lines unless the helper is parameterized.
- **Evidence:** `.claude/scripts/codex-output-check.sh:1-22`, OpenAI non-interactive docs.

## Axis Coupling

- **If Sandbox Path Scope = A or D (broad)** → **Mismatch Handling Model = D becomes more important** because Codex can edit any writable file; Claude post-diff is the only gate.
- **If Sandbox Path Scope = C (custom profile)** → **Mismatch Handling Model = C becomes viable**; the sandbox itself enforces the allow-list.
- **If Mismatch Handling Model = A (tmp-file flag)** → **Sandbox Path Scope must keep `tasks/` writable** (rules out the strictest custom profiles).
- **If Phase Execution Unit = C (whole batch)** → **Per-Phase Verification Scope collapses** to whole-batch verify; cross-phase coherence becomes within-batch coherence.
- **If Final Review Independence Mitigation = B or C** → **conflicts with "Steps 6-8 unchanged"** — design must explicitly relax that constraint or pick A/D.
- **If Metrics Instrumentation = C (tmp only)** → **Promotion Criteria evidence may be erased on cleanup** unless Step 11 captures the summary persistently.
- **If Phase Brief Content = B (citation only)** → **Phase Brief Delivery is forced to A (inline)** — there's nothing meaningful to put in a tmp file.
- **If Commit Ownership = A (per-phase Claude commits)** → **Per-Phase Verification Scope must include diff-scope check** — Claude is now the only gate before each commit, so the commit's diff must match the phase's intent.
- **If Phase Execution Unit = A and Per-Phase Verification Scope ≥ C** → **Claude per-phase cost grows linearly with phase count** — measurable hypothesis (Task 12's instrumentation goal) must capture this to validate Codex savings net of Claude verify cost.
- **If a phase requires network** (`npm install`, `pip install`, fetch) → **default `workspace-write` is not viable**; design must either disallow such phases or specify `--add-dir` / config overrides.

## Cross-Cutting Constraints

Apply to any solution regardless of axis choice:

- **`</dev/null` on every long-running `codex exec` and `claude -p` site** (Issue #2, landed 2026-05-03). No automated lint — manual discipline only.
- **`run_in_background: true` on every long-running call** (Task 10's pattern, baked in *manually* here — Task 10 hasn't shipped). Foreground stays correct only for short interactive/stdin-coupled commands; none of `/implement-codex`'s sites qualify.
- **Output verification after every Codex output** via `bash .claude/scripts/codex-output-check.sh <path> <min-lines>`.
- **Surgical-changes rule** explicit in every phase brief — Codex's training bias toward "fixing things up" is a known leak.
- **Recursion guard:** no Agent → Codex paths; no nested sub-agent spawning.
- **One batch per `/implement-codex` invocation** (mirrors `/implement`).
- **Artifact naming follows existing conventions:** `tasks/codex-*.tmp`, `tasks/code-review-fixes*.tmp`, `tasks/codex-debug-*.tmp`, `tasks/logs/*.log`.
- **`/implement` stays unchanged.** No `/issue-implement-codex` in this task.
- **Steps 6-8 reuse from `/implement` unchanged** (subject to the Final Review Independence Mitigation axis — choices B/C technically modify Step 6 and would need to relax "unchanged").
- **`.git` protection forces commit ownership onto Claude** — Codex cannot stage or commit under default `workspace-write`.

## External Research

Sources Codex consulted (verified spot-check on key claims):

- **`codex exec --sandbox workspace-write` allows edits and shell commands within the workspace.** (https://developers.openai.com/codex/agent-approvals-security) **Unblocks: Sandbox Path Scope axis (all choices), Mismatch Handling Model (choice C viable).**
- **`.git`, resolved gitdir, `.agents`, `.codex` are protected read-only** inside writable roots. (https://developers.openai.com/codex/agent-approvals-security) **Unblocks: Commit Ownership axis (Codex auto-commit ruled out).**
- **Network is disabled by default** in `workspace-write`; can be opened via config. (https://developers.openai.com/codex/agent-approvals-security) **Unblocks: phase scope — install-/fetch-requiring phases need explicit override or are out-of-scope for the experiment.**
- **`codex exec` invocations are stateless** — no carried session unless `codex exec resume` is used. (https://developers.openai.com/codex/noninteractive) **Unblocks: Phase Brief Content (must be self-contained), Final Review Independence Mitigation (D is default; not new mitigation).**
- **`</dev/null` composes** with `codex exec` (just empty stdin, no extra prompt context). (general shell semantics, validated by every existing playbook site) **Unblocks: discipline preservation, no special handling needed under `workspace-write`.**
- **`model_reasoning_effort` is independent** of sandbox mode. (https://developers.openai.com/codex/config-reference) **Unblocks: `xhigh` reasoning carries over to write phases unchanged.**
- **`.gitignore` is NOT a sandbox boundary.** (https://developers.openai.com/codex/agent-approvals-security — no documented `.gitignore` interaction; protected paths are explicit) **Unblocks: Mismatch Handling Model — design cannot rely on `.gitignore` to block writes.**
- **No documented Codex auto-commit pattern.** Documented examples (CI autofix workflow) leave commit/PR to surrounding automation. (https://developers.openai.com/codex/learn/best-practices) **Unblocks: Commit Ownership axis (A is the documented pattern).**
- **OpenAI prompt guidance supports verbose, explicit workflow + ambiguity behavior** for code-writing tasks. (https://developers.openai.com/api/docs/guides/prompt-engineering#coding) **Unblocks: Phase Brief Content axis — verbose self-contained brief is documented best practice.**

**Unresolved external question (acknowledged, not blocking):** whether Codex respects surgical-scope instructions on file:line directives, or routinely "improves" beyond them. No public benchmark or behavior spec exists. Task 12 already flags this as a measurable hypothesis — answer empirically during the experiment.

## Risk Analysis

- **Codex training-bias toward over-editing.** Even with the surgical-changes rule explicitly invoked, Codex may "improve" adjacent code beyond the phase's plan-cited scope. Mitigation: Per-Phase Verification Scope ≥ B (diff-scope check rejects edits outside the phase's file list); design choice on Mismatch Handling Model + Sandbox Path Scope provides defense in depth.
- **First `--sandbox workspace-write` site in the playbook.** Zero operational data on edge cases (file-create vs file-edit, large-file edits, binary files, symlinks, permission errors). Mitigation: dogfood on small, well-scoped phases first; instrument generously.
- **Network-off default.** Phases requiring `npm install` / `pip install` / fetch fail silently or with confusing errors under default sandbox. Mitigation: phase brief must declare network needs upfront; Claude pre-flight checks the phase against an install-detection heuristic, falls back to `/implement` if a network step is required.
- **Weakened final review independence.** Codex reviews Codex-written code in Step 6. Per-phase Claude verify partially compensates but does not deliver the cumulative fresh-eyes pass that the production flow's Codex review provides on Claude-written code. Mitigation candidates surfaced as the Final Review Independence Mitigation axis; document the limitation honestly in the command file regardless of which mitigation lands.
- **Bulldoze-through-mismatch.** Codex may proceed past a structural mismatch (the plan assumed X; the code has Y) and produce a syntactically valid but semantically wrong edit. Claude post-diff verify catches this only if it also checks plan-coverage, not just success criteria. Mitigation: defense in depth — Mismatch Detection Responsibility = C (both Codex pre-edit + Claude post-diff).
- **Metrics-erasure risk.** Cleanup deletes tmp files; if metrics live only in `tasks/implement-codex-metrics.tmp`, promotion evidence is lost between runs. Mitigation: Metrics Instrumentation choice B or D (persistent file or commit trailer).
- **Hidden cost: linear Claude verify with phase count.** Per-phase verify scales with phase count; Codex savings per phase must exceed Claude verify cost per phase for the experiment to net out positive. If verify scope is wide (cross-phase coherence + plan coverage), Claude reads accumulate. Mitigation: instrument both sides (Codex usage and Claude verify cost) so the net is observable.
- **Approval-policy stalls.** If Codex's approval policy isn't `never` and the call is backgrounded, the process can block on an interactive prompt and the harness will sit waiting. Mitigation: phase brief explicitly sets `--ask-for-approval never` or equivalent; smoke-test the first few phases foreground before flipping to background.
- **`tasks/plan.md` schema fragility.** If a phase's plan content lacks a clean machine-extractable boundary (line range, header), the phase brief's "read these plan lines" directive may bleed into adjacent phases. Mitigation: phase brief uses both line-range AND header anchor; or compose phase briefs by parsing the plan in Claude before invoking Codex.

## Open Questions

- **Codex approval policy for backgrounded `workspace-write` calls.** `--ask-for-approval never`, `untrusted`, or default? Task 12 doesn't specify. Implicitly forced to `never` by the background-mode constraint, but the design should call this out explicitly.
- **Untracked-file staging.** When a phase creates new files, who knows? Codex (it just made them) or Claude (it inspects the diff)? Couples to Phase Brief Content (does the brief require Codex to report new files?) and Commit Ownership.
- **Output min-lines tuning.** What min-lines value for `codex-output-check.sh` after a phase write? Existing sites use 5-20 depending on output type. A clean phase pass might be 5-10 lines of summary; a mismatch report could be terse. Pick a low threshold (e.g., 3) or parameterize per-phase.
- **Resume mid-phase.** If Codex partially writes and crashes (or times out), the working tree is dirty but no checkmark exists. Does `/implement-codex` rerun the phase from scratch, or detect partial state? `/implement` Step 3 trusts `- [x]` checkmarks; the new command needs the same trust model plus a "phase aborted, working tree dirty" recovery path.
- **Promotion thresholds (numeric).** Task 12 mandates upfront definition; the design must pick numbers (e.g., ≥10 runs, <20% rewrite rate, ≥30% Claude token saved) without operating data. Either decide based on rough estimates or commit to "first 3 runs are calibration, then thresholds get set."
