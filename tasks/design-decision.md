# Design: `/implement-codex` — Codex drives, Claude verifies per-phase

## Context

Task 12 (`tasks/todo.md:117-140`) introduces a sibling command, `/implement-codex`, that flips `/implement`'s executor: Codex writes the code phase-by-phase under `--sandbox workspace-write`; Claude verifies each phase (plan adherence + cross-phase coherence + automated success criteria); the existing Codex code review + Claude triage + child fix application from `/implement` Steps 6-8 reuse unchanged. Ship as a separate command — `/implement` stays untouched. The two named risks are (1) Codex bulldozing through structural mismatches and (2) weakened final-review independence (the Step 6 Codex review now reviewing Codex-written code).

The hard correction from research is sandbox-shaped: under `--sandbox workspace-write`, `.git`, the resolved gitdir, `.agents`, and `.codex` are protected read-only inside writable roots — so **Codex cannot stage or commit**. Commit ownership is forced onto Claude, collapsing one axis. Network is also disabled by default in `workspace-write`, constraining phase scope to install-free / fetch-free work unless `--add-dir` or config overrides are documented.

**Research:** `tasks/research-codebase.md`

## Forced Choices (by sandbox / statelessness / `CLAUDE.md`)

These choices are not in tension across options — they're locked by documented constraints:

- **Phase Execution Unit = A** (one `codex exec` per unchecked phase) — `CLAUDE.md` § Multi-Batch Plans + Task 12's per-phase verify mandate. Choices B/C collapse per-phase verification scope and break parity with `/implement`'s rhythm.
- **Commit Ownership = A** (Claude stages and commits after each verified phase) — `.git` protection makes Codex auto-commit not viable; `/implement` already commits per phase.
- **Phase Brief Content = A or C** (self-contained or hybrid) — `codex exec` is stateless; pure citation-only briefs (B) are forced to inline delivery and offer no benefit. Coupling: Phase Brief Content = B forces Phase Brief Delivery = A.
- **`-o <tmp>` final-message file is the mandatory baseline** (verified by `codex-output-check.sh`) — every other Codex site uses this. Output Contract specifically (axis-level choice between A / B / C) is *not* forced — Option 4 picks B (add `--json` event logs alongside `-o`) because crash recovery needs the event stream.

## Cross-Cutting Constraints (apply to all options)

- **`</dev/null` on every long-running `codex exec` and `claude -p` site** (Issue #2 discipline).
- **`run_in_background: true` on every long-running call** (Task 10 pattern, applied manually here — Task 10 hasn't shipped).
- **`-a never` on every backgrounded `codex exec`** (otherwise the harness can stall on an interactive prompt). Verified locally: `--ask-for-approval` / `-a` is a *top-level* Codex flag, not a `codex exec` flag — invocations must read `codex -c model_reasoning_effort=xhigh -a never exec --sandbox workspace-write ...`.
- **Output verification after every Codex output** via `bash .claude/scripts/codex-output-check.sh <path> <min-lines>`.
- **Surgical-changes rule explicit in every phase brief** — Codex's training bias toward "fixing things up" is the bulldoze risk's root cause.
- **Recursion guard:** no Agent → Codex paths.
- **One batch per `/implement-codex` invocation** (mirrors `/implement`).
- **Network-required phases out-of-scope by default.** Phase brief must declare network needs upfront. If a phase needs `npm install` / `pip install` / fetch, the developer is told to fall back to `/implement`. (`--add-dir` is *not* a network escape hatch — it adds writable filesystem roots only. A network override requires an explicit Codex config setting; documenting that is deferred until a real phase needs it.)
- **Untracked-file enumeration:** the phase brief must require Codex to list every file it created or modified in its `-o` final message. Codex's list is *advisory* — Claude uses `git status --short` and `git diff --name-only` as authoritative input, and cross-checks the two. Mismatches are themselves a finding (Codex either edited files it didn't enumerate, or claimed edits it didn't make).
- **Test execution is Claude's job, not Codex's.** Phase brief explicitly instructs Codex: do not run tests, do not run lint, do not run any verification commands. Edit source, write the enumeration summary, exit. Claude runs all success criteria after Codex returns. Rationale: (a) Claude needs direct test evidence to gate the commit; trusting Codex's "tests passed" claim is weaker than running tests in Claude's session, (b) test output bloats Codex's context for no benefit since Codex doesn't need it to make better edits, (c) clean separation of concerns — Codex writes, Claude verifies. **Enforcement is prompt-only** — `workspace-write` does allow shell execution, so Codex *could* technically run tests despite the prompt. Claude post-phase audit of the JSON event log catches violations (any shell/test command appearing in the log is a finding); the promotion criteria below count this against the experiment.
- **JSON event logs per phase** for crash recovery. Run Codex with `--json` (events to stdout, redirected to `tasks/logs/codex-implement-phase-{N}-{timestamp}-attempt{K}.log`) while preserving `-o <tmp>` for the final message. **Filename includes seconds + attempt suffix** to prevent collisions on same-phase retry. JSON event log is *expected* to capture file actions and shell commands (verified empirically per smoke-test run before promotion). The `-o` file goes through `codex-output-check.sh`; the JSON log is separately checked for non-empty + parseable.
- **State-check order matters.** When a phase returns, check signal tmp files *before* running `codex-output-check.sh` on `-o`:
  1. `tasks/codex-mismatch-{N}.tmp` present? → mismatch path (output may be intentionally absent).
  2. `tasks/codex-blocked-{N}.tmp` present? → blocked path (output may be intentionally absent).
  3. Both signal files absent? → run `codex-output-check.sh` on `-o`. Pass → `done` path. Fail → `crashed` path.
  4. **Both signal files present, or any signal file empty/zero-bytes** → `crashed` / ambiguous; treat as crash.
  Pre-delete both signal tmps (`rm -f tasks/codex-mismatch-{N}.tmp tasks/codex-blocked-{N}.tmp`) at the start of each phase so leftover files from prior attempts don't poison the state check.
- **Codex exit-state contract.** Codex returns in one of four states; Claude branches on the state:
  - **`done`** — `-o` output present, no signal tmp files. Normal path: Claude verifies + commits.
  - **`mismatch`** — `tasks/codex-mismatch-{N}.tmp` present. Plan-vs-reality conflict. Claude triggers `/implement`-style structural re-research with `read-only` Codex, updates plan, retries phase.
  - **`blocked`** — `tasks/codex-blocked-{N}.tmp` present. Codex couldn't proceed (ambiguity, needs network, model wall). Claude takes over and completes the phase in-session using normal Edit/Write tools. Phase is *finished by Claude*, not retried.
  - **`crashed`** — `-o` output missing/check-fails AND no signal tmp file (or signal file empty / both signals present). Process died unexpectedly. Claude runs a three-step diagnosis before involving the developer: (1) read JSON event log to identify the last action Codex took, (2) read `git status --short` + full `git diff` (not just `--name-only` — semantic content matters) AND enumerate untracked/ignored files explicitly, (3) classify into one of three sub-states:
    - **Effectively done** — all plan-cited files present in the diff, edits look coherent, **AND Claude-run success criteria pass**. Codex likely crashed *after* the work but *before* the `-o` summary write. File-list match alone is *not* sufficient — semantic completeness is gated on success criteria. → If success criteria pass, verify+commit as `done`. If they don't, fall through to "Partial but recoverable."
    - **Partial but recoverable** — log shows Codex got partway through the file list before dying (transient: network blip, model timeout); or success criteria fail with a coherent partial diff. → Claude retries with a *resume brief*: same template, variable slots note "files X, Y already edited and look correct; please complete Z only." **Retry cap = 1 per phase, tracked across resumes via `-attempt{K}` suffix in log filename** — if the retry also crashes, escalate.
    - **Ambiguous or repeated crash** — diff doesn't match the plan cleanly, untracked files don't fit the phase scope, both signal tmps present, or this is the second crash on the same phase. → Stop and report to developer with log excerpt + diff summary; no auto-restore of working tree.
- **`/implement` stays unchanged.** No `/issue-implement-codex` in this task.

## Options Considered

### Option 1: Lean Trust + Post-Diff Verify

Codex runs under default `workspace-write` with no special constraints; Claude is the sole gate, reading the diff after each phase and rolling back / patching if it spots scope drift.

**Axis-choice combination:**

- Sandbox Path Scope = **A** (default `workspace-write`)
- Mismatch Handling Model = **D** (Claude post-diff detects mismatch, rolls back / patches / re-researches)
- Mismatch Detection Responsibility = **B** (Claude post-diff only; phase brief does *not* ask Codex to stop pre-edit)
- Per-Phase Verification Scope = **C** (success criteria + diff scope + cross-phase coherence) — Task 12 mandate
- Phase Brief Content = **C** (hybrid — surgical-changes rule + output contract inline; plan content by `tasks/plan.md` citation)
- Phase Brief Delivery = **A** (inline string)
- Final Review Independence Mitigation = **A** (accept the weakening; document as known experimental cost)
- Metrics Instrumentation = **B** (persistent `tasks/implement-codex-metrics.md`)
- Promotion Criteria = **A** (numeric upfront, with "first 3 runs are calibration before tuning thresholds")
- Output Contract = **A** (existing `-o` + `codex-output-check.sh`)

**How it works:** For each unchecked phase, Claude composes a phase brief inline, runs `codex exec --sandbox workspace-write -o tasks/codex-phase-{N}.tmp ...` in the background, waits, runs `codex-output-check.sh`, reads the output, then runs `git diff` to inspect the diff. Claude verifies (a) every changed file is in the phase's plan-cited file list (diff scope), (b) the change pattern is coherent with prior phases (cross-phase coherence), (c) the phase's automated success criteria pass. If any fail, Claude either patches in-session (mirrors `/implement` Step 4c "minor"), or runs the existing `/implement` Step 4c structural-mismatch top-level Codex re-research with `--sandbox read-only`, or stops if tests fail after 2 attempts. On pass, Claude stages all enumerated files, commits with a conventional message, appends a one-line metric to `tasks/implement-codex-metrics.md` (Codex pass clean / Claude patched N lines / scope drift caught Y/N), and moves on. Steps 6-8 reuse `/implement` line-for-line with renamed artifact `tasks/codex-codex-code-review.tmp`. After Step 11, the metrics file persists.

**Pros:**
- Fewest moving parts. No tmp mismatch signal lifecycle; no relaxation of "Steps 6-8 unchanged."
- Closest to `/implement`'s shape — Claude is still the verify gate, just running after Codex's edits instead of doing them.
- Zero novelty in sandbox usage beyond what's strictly required (default `workspace-write`).
- Simplest to document and reason about.

**Cons:**
- Single-layer defense against the named bulldoze risk. Codex finishes writing before Claude inspects, so a bulldozing phase wastes compute and produces a dirty working tree before rollback.
- No explicit mechanism for Codex to *stop* on a recognized mismatch — it just plows through and produces an edit, which Claude then must reverse. Worst case: a bulldoze touches files the plan didn't cite *and* succeeds the success criteria, masking the drift unless Claude's diff-scope check is reliable.
- Final-review independence weakening is unmitigated beyond the cumulative Claude per-phase verify; whether per-phase findings reach the Step 6 reviewer depends on whether Claude's per-phase notes inadvertently appear in commit messages or `tasks/plan.md` (incidental, not designed).

### Option 2: Defense-in-Depth — Pre-Edit Stop + Post-Diff Verify + Findings Injection

Codex is instructed to inspect first and stop with a tmp signal file if it detects a structural mismatch before editing; Claude verifies post-diff regardless; per-phase Claude findings are injected into the Step 6 final review prompt as confirmed flags.

**Axis-choice combination:**

- Sandbox Path Scope = **D** (default `workspace-write` filesystem scope, with the phase brief naming an edit allow-list — this is choice D under the research's axis definitions, not A; the original draft mislabeled it A)
- Mismatch Handling Model = **A** (Codex writes `tasks/codex-mismatch-{N}.tmp` and refrains from editing source when it detects a structural mismatch; Claude reads on resume)
- Mismatch Detection Responsibility = **C** (both — Codex pre-edit + Claude post-diff)
- Per-Phase Verification Scope = **C** (success criteria + diff scope + cross-phase coherence)
- Phase Brief Content = **A** (verbose self-contained brief — surgical-changes rule, output contract, mismatch contract, file list, success criteria)
- Phase Brief Delivery = **B** (tmp file via `$(cat tasks/codex-phase-{N}-prompt.tmp)`) — verbose briefs risk shell-escape bugs inline
- Final Review Independence Mitigation = **B** (inject Claude's per-phase findings into the Step 6 review prompt as confirmed flags) — explicitly relaxes "Steps 6-8 unchanged"
- Metrics Instrumentation = **B** (persistent `tasks/implement-codex-metrics.md`)
- Promotion Criteria = **A**
- Output Contract = **A**

**How it works:** Same shell as Option 1, but the phase brief is verbose and delivered via tmp file. The brief instructs Codex: (1) read the plan-cited files first; (2) if the actual code structure does not match the plan's premise, write `tasks/codex-mismatch-{N}.tmp` describing the mismatch and exit *without* making any source edits; (3) otherwise, apply only the surgical changes specified, enumerate every file changed in the `-o` final message. After Codex returns, Claude checks for the mismatch tmp file first — if present, branch to top-level `/implement` Step 4c structural re-research with `read-only` Codex; if absent, run diff-scope + cross-phase coherence + success criteria checks. Per-phase findings (rewrite ratio, scope catches, coherence notes) accumulate in `tasks/codex-perphase-notes.tmp`. At Step 6, the Codex code review prompt is augmented to include a "PRELUDE — Per-phase findings already noted by Claude" section pulled from that notes file, instructing the reviewer to verify these and add new findings rather than re-litigate. After Step 11, the perphase notes tmp is deleted; metrics persist.

**Pros:**
- Defense in depth on the named bulldoze risk. Codex stops itself when self-aware; Claude catches what Codex misses.
- Independence mitigation (B) directly addresses the second named risk by reframing Step 6 as "verify Claude's per-phase pass + add new findings" rather than a fully blind review.
- Self-contained verbose brief is the OpenAI-documented best practice for code-writing tasks (`https://developers.openai.com/api/docs/guides/prompt-engineering#coding`).
- Tmp-file delivery isolates the brief from shell-escape pitfalls (matches `.claude/commands/codex-review.md:55-62`).

**Cons:**
- More moving parts: per-phase prompt tmp, per-phase mismatch tmp, per-phase notes accumulator. Each adds an artifact lifecycle Claude must manage and clean up.
- Codex pre-edit stop relies on Codex's self-recognition — uncertain. The mitigation value comes mostly from Claude post-diff; the pre-edit stop is upside-only when it fires.
- Findings-injection (B) explicitly relaxes Task 12's "Steps 6-8 unchanged" mandate. The relaxation is small (a prompt prelude, not structural change to the review pass) but it is a divergence the design must own.
- **Independence anchoring risk** (surfaced in Codex cross-check): injecting Claude's per-phase findings into the Step 6 prompt anchors Codex's final review to flags Claude already raised, instead of preserving the cleanest remaining independent pass. This risk is in addition to the "unchanged" mandate violation — even if the mandate were relaxed, the anchoring effect is a substantive technical cost.
- Verbose tmp-file briefs cost a write/cleanup per phase.

### Option 3: Sandbox-Enforced Allow-List

Per-phase custom permission profile generated by Claude — only the plan-cited file list and `tasks/` are writable; everything else is read-only. The sandbox itself prevents bulldozing.

**Axis-choice combination:**

- Sandbox Path Scope = **C** (custom permission profile generated per phase)
- Mismatch Handling Model = **C** (sandbox mechanically prevents edits outside the phase's plan-cited file list; Codex receives a permission error and reports it)
- Mismatch Detection Responsibility = **A** (Codex pre-edit / sandbox-error; Claude inspects the report)
- Per-Phase Verification Scope = **C**
- Phase Brief Content = **A** (verbose self-contained brief — even with the sandbox enforcing scope, the surgical-changes rule and success criteria still need to be in the prompt)
- Phase Brief Delivery = **B** (tmp file)
- Final Review Independence Mitigation = **A** (accept)
- Metrics Instrumentation = **B**
- Promotion Criteria = **A**
- Output Contract = **A**

**How it works:** Before each phase, Claude generates a tmp Codex config (e.g., `tasks/codex-phase-{N}-config.toml`) that allows writes only to the plan-cited file list and `tasks/`, then invokes `codex -c <tmp-config> exec --sandbox workspace-write ...`. Bulldozing produces a permission error from Codex, which it reports in `-o` output; Claude reads, branches, and either falls back to a structural re-research or escalates. Per-phase verify scope still includes diff-scope + cross-phase coherence (the sandbox handles scope; Claude handles coherence). Cleanup deletes per-phase configs.

**Pros:**
- Strongest possible bulldoze prevention — mechanical, not prompt-dependent.
- Removes the diff-scope check from Claude's load (sandbox already enforced it).

**Cons:**
- Zero in-repo precedent for custom Codex permission profiles. The CLI surface for per-invocation profile injection is documented but novel for the playbook (`https://developers.openai.com/codex/config-reference`).
- Per-phase config generation/cleanup is a new artifact lifecycle no other command has.
- Codex's CLI flag for path-specific allow/deny rules within `workspace-write` is config-based, not flag-based — meaning the design depends on a config schema that may not be stable across Codex CLI versions. **Verified locally:** `-c` takes `key=value` overrides (e.g., `-c model="o3"`), *not* a config file path. So per-phase profiles must be injected as a sequence of `-c sandbox.writable_paths=[...] -c sandbox.readonly_paths=[...]`-style flags (or a profile selected with `-p <name>` from `~/.codex/config.toml`). Either path is more brittle than the original draft suggested.
- Permission errors mid-edit may leave a partial file write (e.g., Codex edits one of three intended files, then fails on the fourth, leaving the working tree dirty and inconsistent). Recovery requires the same rollback machinery Option 1 needs anyway, making the sandbox enforcement net-additive rather than net-replacing.
- Strict per-phase allow-list assumes the plan's file list is complete and correct — but `/implement` already accepts that the plan can be wrong (the structural-mismatch branch). Mechanical enforcement here removes Claude's ability to adapt to "the plan said file X but the function actually lives in file Y" without a sandbox-error round trip.
- Most novelty against the existing codebase patterns; least reversibility.

### Option 4: Defense-in-Depth — Pre-Edit Stop + Post-Diff Verify, Step 6 Untouched

Same shape as Option 2 except the final-review independence weakening is *accepted* rather than mitigated by injecting findings into Step 6. This option emerged from Codex's independent cross-check, which converged on Options 2's defenses but rejected Option 2's choice B.

**Axis-choice combination:**

- Sandbox Path Scope = **D** (default `workspace-write` filesystem scope + prompt-level edit allow-list)
- Mismatch Handling Model = **A + E hybrid** (tmp-file signaling for two distinct escalation states: `tasks/codex-mismatch-{N}.tmp` for plan-vs-reality conflict, `tasks/codex-blocked-{N}.tmp` for "Codex hit a wall, hand back to Claude") with **D fallback** (Claude post-diff catches what Codex missed)
- Mismatch Detection Responsibility = **C** (both — Codex pre-edit + Claude post-diff)
- Per-Phase Verification Scope = **C** (success criteria + diff scope + cross-phase coherence) — and explicitly Claude runs the success criteria, not Codex
- Phase Brief Content = **A** (verbose self-contained brief), with the static framing factored into `.claude/prompts/implement-codex-phase-brief.md` so per-phase Claude work is just slot-filling (~5 lines vs ~60-100 inline)
- Phase Brief Delivery = **B** (tmp file via `$(cat tasks/codex-implement-phase-{N}-prompt.tmp)`)
- Final Review Independence Mitigation = **A** (accept the weakening; document as known experimental cost) — preserves Steps 6-8 unchanged
- Metrics Instrumentation = **B** (persistent `tasks/implement-codex-metrics.md`)
- Promotion Criteria = **A** (numeric upfront)
- Output Contract = **B** (`-o` final-message tmp + `--json` event log redirected to `tasks/logs/codex-implement-phase-{N}-{timestamp}.log`, both verified by `codex-output-check.sh` with min-lines = 5 on the `-o` file). The JSON log enables crash-recovery by exposing every model action up to the crash point.

**How it works:** Identical to Option 2 for the per-phase loop — verbose tmp-file brief, pre-edit mismatch stop, Claude post-diff verify, persistent metrics, per-phase commits. The single divergence is at Step 6: the Codex code review prompt is reused *line-for-line* from `/implement` (no per-phase findings prelude). Steps 6-8 stay unchanged from `/implement` Task 12 mandate; the experimental cost (review independence weakening) is accepted and documented in the command file's preamble.

**Pros:**
- All of Option 2's defense-in-depth on the bulldoze risk, without the divergence from Task 12's "Steps 6-8 unchanged" mandate.
- Avoids the anchoring risk Codex flagged: the final review remains a clean pass, not pre-loaded with Claude's per-phase findings.
- Faithful to Task 12 — the experiment honestly accepts reduced independence as a measurable cost rather than papering over it with a prompt prelude.
- Minimal additional moving parts vs Option 2 (one fewer artifact: no per-phase notes accumulator).

**Cons:**
- Final-review independence weakening is unmitigated. If the experiment's first runs surface that Codex misses bugs in Codex-written code, the mitigation lever (e.g., choice B) is available as a follow-up but is *not* part of the initial design.
- All of Option 2's other cons except the "unchanged" violation: per-phase prompt tmp + per-phase mismatch tmp lifecycles; verbose brief write/cleanup per phase; pre-edit stop dependency on Codex self-recognition.

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)

*All blocking questions resolved during the Codex cross-check — see resolutions below.*

- [x] ~~**Final-review independence mitigation:**~~ **Resolved → choice A (accept).** Codex's cross-check surfaced a substantive technical objection to choice B (anchoring the final review to Claude's prior findings reduces the cleanest remaining independent pass), in addition to the "Steps 6-8 unchanged" mandate violation. Option 4 absorbs this resolution.
- [x] ~~**Promotion thresholds (numeric):**~~ **Resolved.** Concrete numbers grounded in Task 12's instrumentation goals (refined after Codex's second-pass review separated savings from recovery-noise):
  - **Volume:** ≥10 completed `/implement-codex` invocations covering ≥25 Codex-written phases (so single-phase batches don't dominate).
  - **Cleanliness:** ≥80% of Codex-written phases land clean (no escalation, no retry, no developer intervention); ≥8 of 10 invocations are entirely clean.
  - **Savings:** median Claude rewrite ratio across runs <20%; observed Claude active-work reduction ≥25% vs `/implement` baseline.
  - **Review independence:** zero severe Step 6 findings attributable to Codex-written code in the last 5 runs.
  - **Recovery noise (new gates from second-pass review):** zero ambiguous/repeated crashes in the last 5 runs; crash+retry rate <10% of phases; blocked-state rate <10% of phases; mismatch-state rate tracked separately (no threshold — informational).
  - **Prompt-contract compliance:** zero JSON-log audit findings of Codex running tests/lint/verification commands (test-ownership rule violated). One violation across the experiment is acceptable as a calibration data point; recurring violations gate promotion.

### Non-blocking (can resolve during implementation)

- [x] ~~**Codex approval policy explicit value:**~~ **Resolved → `-a never` at top level.** Verified locally — see Cross-Cutting Constraints. `untrusted` requires interactive escalation and is not viable in background mode.
- [x] ~~**Output min-lines tuning**~~ **Resolved → 5 (the helper's default).** Codex's cross-check confirmed: the phase prompt requires a multiline summary/status/files/tests block, so 5 is sufficient and matches existing playbook practice.
- [x] ~~**Reusable phase-brief template (load-bearing for the experiment's premise):**~~ **Resolved → factor static framing into `.claude/prompts/implement-codex-phase-brief.md`** (matches existing convention — `.claude/prompts/research-guide.md`, `.claude/prompts/research-patterns-guide.md` are precedent; `.claude/templates/` does not exist). Claude emits only the variable slots per phase (phase number, plan-excerpt line range, file allow-list, success criteria). Bash invocation concatenates `$(cat .claude/prompts/implement-codex-phase-brief.md)` + appended variable block. Per-phase Claude brief composition drops to ~5 lines vs ~60-100 inline. The template's exact contents (mismatch contract wording, blocked contract wording, output schema) are plan-phase work.
- [ ] **JSON event log retention policy.** Logs may contain prompts and diffs; `/finish` removes RDPI artifacts (`tasks/research-codebase.md`, `tasks/design-decision.md`, etc.) but does *not* clean `tasks/logs/`. For the experiment, logs need to persist so promotion metrics are reconstructable. Plan-phase decision: are logs kept indefinitely, rotated by age, or summarized into `tasks/implement-codex-metrics.md` then deleted? Default: keep until promotion decision; revisit then.
- [x] ~~**Resume mid-phase recovery:**~~ **Resolved.** The crashed-state diagnosis flow in Cross-Cutting Constraints (effectively-done / partial-recoverable / ambiguous-or-repeated) provides the heuristic. JSON log + `git status` are the inputs; one auto-retry is allowed for transient crashes; ambiguous or repeated crashes escalate to developer with no auto-restore.
- [x] ~~**Untracked-file staging mechanics:**~~ **Resolved.** Codex's `-o` enumeration is advisory; Claude uses `git status --short` and `git diff --name-only` as authority and cross-checks against Codex's list. Mismatches between Codex's claim and the actual diff are themselves a finding — captured in the Cross-Cutting Constraints section.

## What We're NOT Doing

- **Not modifying `/implement`.** The production flow stays untouched until the experiment promotes.
- **Not building `/issue-implement-codex`** in this task. Task 12 explicitly defers it as a follow-up.
- **Not introducing per-batch Codex execution** (one `codex exec` per whole batch). Per-phase Claude verify is mandated; per-batch unit collapses verify granularity.
- **Not enabling network in the default sandbox.** Phases requiring network are out-of-scope; the developer is instructed to fall back to `/implement`.
- **Not auto-committing from Codex.** `.git` protection rules this out regardless of design.
- **Not re-architecting Step 6's review pass beyond an optional prelude** (Option 2). The review prompt's PART 1 / PART 2 structure stays intact.

## Decision

**Chosen approach:** Option 4 — Defense-in-Depth (pre-edit stop + post-diff verify), Steps 6-8 unchanged.

**Rationale:**

Option 4 wins on technical merit across the three decision heuristics:

1. **Codebase patterns:** Reuses `/implement`'s phase-by-phase commit cadence, the `codex-review.md:55-62` tmp-file prompt delivery pattern, the existing `codex-output-check.sh` verification, and Steps 6-8 line-for-line. Only the per-phase loop is new — and even that mirrors the four-branch mismatch handling from `/implement` Step 4c. Option 3's custom permission profiles are doubly novel (no in-repo precedent + Codex CLI doesn't cleanly support per-invocation profile injection — verified locally that `-c` takes `key=value` overrides, not config-file paths).

2. **Simplicity:** Option 4 is not the *fewest* moving parts (Option 1 is) but it's the simplest design that defends both named risks AND survives second-pass scrutiny on crash recovery. Honest artifact accounting for Option 4: per phase, the design adds (a) `tasks/codex-implement-phase-{N}-prompt.tmp` brief slot file, (b) `tasks/codex-implement-phase-{N}.tmp` `-o` output, (c) `tasks/logs/codex-implement-phase-{N}-{timestamp}-attempt{K}.log` JSON event log, (d) `tasks/codex-mismatch-{N}.tmp` mismatch signal (created only on mismatch), (e) `tasks/codex-blocked-{N}.tmp` blocked signal (created only on block), and persistently (f) `tasks/implement-codex-metrics.md`. That's six artifact slots vs `/implement`'s two (`tasks/codex-code-review.tmp`, `tasks/code-review-fixes.tmp`). Option 1 would drop (a), (d), (e) but keeps the rest — it's not dramatically lighter once crash recovery is also a goal. Option 4's complexity is in service of defense-in-depth on the bulldoze risk + crash auditability; both are explicit Task 12 goals.

3. **Reversibility:** All four options ship as a sibling command — equally easy to roll back. Option 4 leaves the most levers available for follow-up tuning if the experiment surfaces new problems: the findings-injection mechanic (Option 2's choice B) remains a future option if review independence weakening proves measurable; tightening the sandbox via custom profiles (Option 3) remains a future option if prompt-side bulldoze prevention proves insufficient. Starting with the simpler Option 4 preserves these levers.

**Codex's cross-check materially shaped the decision.** Claude's initial draft framed the choice as Option 1 vs Option 2, with Option 2's choice B (findings injection) as the way to address review independence. Codex independently arrived at "Option 2 minus B" and articulated *why* B is technically wrong, not just constraint-violating: injecting Claude's per-phase findings into Step 6 anchors the final review to flags Claude already raised, *reducing* the cleanest remaining independent pass instead of strengthening it. That argument — combined with the "Steps 6-8 unchanged" mandate — promotes Option 4 over Option 2 on technical merit alone. The convergence was independent: Codex didn't see Claude's options until Phase 2.

**What's accepted, not solved:** Final-review independence weakens under any flip-the-executor design. Option 4 owns this honestly by accepting choice A and documenting the cost in the command file's preamble. If post-experiment data shows Codex reviewers systematically miss Codex-written bugs, choice B (or a fresh review by a different agent family) becomes a follow-up — not initial scope.
