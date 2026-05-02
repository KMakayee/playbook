# Research: Issue #2 — `/implement` hangs in `run_in_background` mode (codex + claude -p stdin)

## Research Question

Apply `</dev/null` to backgrounded `codex … exec` and `claude -p …` invocations in QRSPI commands so the harness's open-stdin condition stops causing indefinite hangs. Issue #2 in `tasks/issues.md:84-133` enumerates seven mandatory backgrounded sites plus two defensive foreground `claude -p` sites in `auto-issues.md`. **The user's open question:** should the fix scope expand to include foreground `codex exec` / `claude -p` call sites elsewhere in the playbook (`research-codebase.md`, `design.md` ×3, `create-plan.md`, `issue-research.md`, `issue-plan.md`, `codex-review.md`, structural-mismatch sites in `implement.md` / `issue-implement.md`), or is foreground actually safe?

## Summary

**Foreground sites are not vulnerable today.** Empirical probe in this very session confirms: `read -t 2 line < /dev/fd/0` returns exit code 1 (EOF) immediately in foreground Bash mode — no timeout. That means foreground subprocesses inherit an already-EOF stdin, so a child like `codex exec` that calls `read()` on fd 0 returns immediately with no data. The "Reading additional input from stdin..." status line still prints (it's emitted unconditionally before the read), but the read itself doesn't block.

**Backgrounded sites are vulnerable** because the harness keeps a writer-side fd open on the child's stdin pipe — POSIX semantics dictate that `read()` on a pipe blocks while any write end remains open and only returns EOF once all writers close. The `</dev/null` redirect replaces fd 0 with `/dev/null`, which gives EOF on first read regardless of what the harness does with its retained pipe end.

**The issue's current scope is correct as the operational hotfix:** the seven mandatory backgrounded sites get `</dev/null`; the two defensive foreground `claude -p` sites in `auto-issues.md` Phases 4–5 get it as forward-coupling against Task 10 flipping them to backgrounded. The real design decision the issue smuggles in unannounced is **defensive prophylaxis scope** — should *every* foreground long-running site get `</dev/null` now (so Task 10 becomes a pure mode flip), or only the two in `auto-issues.md` (closest to the backgrounded sites in the same file)? That choice is the only meaningful axis still on the table.

A few of Codex's corrections are mechanical terminology cleanups (the issue's "open pipe with no writer" wording is POSIX-inaccurate; the writer must remain open for the block to manifest). They don't change the fix, but they sharpen the regression-guard rationale and the upstream-bug framing.

## Detailed Findings

### Backgrounded call sites (mandatory fix targets)

All seven are correctly identified in Issue #2:

- `.claude/commands/implement.md:76` — `codex … exec` (Step 6 code review). Backgrounded per marker text at line 73 ("Run with `run_in_background` — Codex phase, may take 10+ minutes.").
- `.claude/commands/implement.md:141` — `claude -p …` (Step 8 fix-applier). Backgrounded per marker text at line 136. **Chained line:** `mkdir -p tasks/logs && TIMESTAMP=$(date +%Y%m%d-%H%M) && claude -p "..." --dangerously-skip-permissions > tasks/logs/code-review-fixes-$TIMESTAMP.log 2>&1`. The `</dev/null` must attach to `claude -p`, not the front of the chain.
- `.claude/commands/issue-implement.md:83` — `codex … exec` (Step 6, mirror of `implement.md`). Backgrounded per `:80`.
- `.claude/commands/issue-implement.md:154` — `claude -p …` (Step 8, mirror). Backgrounded per `:149`. Same chained-line placement rule.
- `.claude/commands/auto-issues.md:33` — `claude -p …` (Phase 1 Research). Backgrounded per `:30`.
- `.claude/commands/auto-issues.md:45` — `claude -p …` (Phase 2 Plan). Backgrounded per `:42`.
- `.claude/commands/auto-issues.md:57` — `claude -p …` (Phase 3 Implement). Backgrounded per `:54`.

### Foreground call sites (not vulnerable; defensive coverage decision)

**`claude -p` foreground (Issue #2 already covers these defensively):**
- `.claude/commands/auto-issues.md:69` — Phase 4 Update. Marker `:66` `Timeout: 600000ms` (foreground 10-min cap, not `run_in_background`).
- `.claude/commands/auto-issues.md:81` — Phase 5 Commit & Push. Marker `:78` same form.

**`codex … exec` foreground (NOT in Issue #2's current scope):**
- `.claude/commands/research-codebase.md:43` — primary research sweep. Foreground 600000ms (line 48).
- `.claude/commands/design.md:87` — primary design sweep (line 84 marks foreground 600000ms).
- `.claude/commands/design.md:137` — blocking-question deep-dive (line 134 same).
- `.claude/commands/design.md:195` — pattern research with `--search` (line 192 same).
- `.claude/commands/create-plan.md:55` — plan review (line 52 same).
- `.claude/commands/issue-research.md:43` — issue-flow research (line 48 same).
- `.claude/commands/issue-plan.md:61` — issue-flow plan review (line 58 same).
- `.claude/commands/codex-review.md:58` — generalized Codex review (line 55 same; note: this command does NOT use `codex-output-check.sh` — it reads `tasks/codex-review.tmp` directly per `codex-review.md:66-68`).
- `.claude/commands/implement.md:39` — structural-mismatch re-research (line 52 marks foreground 600000ms).
- `.claude/commands/issue-implement.md:46` — structural-mismatch mirror (line 59 same).

### Mechanism (root cause)

The issue body wording "open pipe with no writer" is POSIX-inaccurate and worth correcting in the notes. POSIX `pipe(7)` says reads from an empty pipe block while *any* write end remains open and return EOF only after *all* write ends close (see https://man7.org/linux/man-pages/man7/pipe.7.html). So the backgrounded hang implies the harness inherits a writer-side fd to the child's stdin pipe and never closes it — likely the harness keeps the write end so it could feed input later if needed. The child sees a non-empty pipe with at least one writer, so its `read()` blocks.

Foreground mode is empirically different — the probe in this session showed `read -t 2 line < /dev/fd/0` returns exit code 1 (EOF) immediately, meaning fd 0 is either `/dev/null`, a pre-closed pipe (no writers), or the read end of a pipe with the writer already closed. Codex's claim that local non-PTY foreground returns EOF on fd 0 holds.

`</dev/null` doesn't "close fd 0" — it replaces fd 0 with an open file descriptor pointing at `/dev/null`, which returns EOF on the first read. The semantic outcome is the same as a closed pipe: the child's `read()` returns 0 bytes immediately and Codex/Claude proceed without waiting.

The Codex CLI's `exec` mode is intentional about stdin handling — its source has `StdinPromptBehavior::{RequiredIfPiped, Forced, OptionalAppend}` (Codex's external research finding, citing https://github.com/openai/codex/blob/main/codex-rs/exec/src/lib.rs). When stdin contains piped data, Codex appends it as a `<stdin>` block alongside the argv prompt. There's no documented `--no-stdin` flag, so per-call-site `</dev/null` is the only first-class mitigation in current CLI versions. The `claude -p` CLI behaves similarly — `cat file | claude -p "query"` is documented to feed stdin into the prompt context, with no opt-out flag (see https://code.claude.com/docs/en/cli-reference).

The Claude Code harness itself does not document `run_in_background`'s fd 0 setup (Anthropic tool reference at https://code.claude.com/docs/en/tools-reference describes Bash and the Monitor sub-tool but is silent on fd inheritance). So the foreground-vs-background mechanism distinction stays empirical. If a future harness change ever made foreground also pass an open-pipe-with-writer fd 0, every foreground site would become vulnerable. This is the latent risk that defensive prophylaxis would harden against.

### Issue #2's defensive coverage stance

The issue applies `</dev/null` to two foreground `claude -p` sites in `auto-issues.md` (Phases 4–5) "to keep the pattern hang-proof if either is later switched to backgrounded mode" (`tasks/issues.md:117`). It does NOT extend the same logic to the ~10 foreground `codex exec` sites that would be similarly affected if backgrounded. Reading the rationale, the choice appears to be motivated by file co-location (those two are in the same file as three backgrounded sites) and personal-cost economics (two extra edits, low cost), not a principled "all foreground long-running sites" stance.

This asymmetry is the most interesting design tension. Task 10 explicitly plans to flip every foreground long-running site to backgrounded; if defensive prophylaxis were applied uniformly now, Task 10 becomes a pure mode flip with no further `</dev/null` discipline to track. If defensive prophylaxis stays asymmetric, Task 10 must add `</dev/null` per-site as it migrates each call.

### Regression-guard scope

Issue #2 (`tasks/issues.md:118`) requires a smoke check that "greps for any **backgrounded** `codex … exec` or `claude -p …` snippet in `.claude/commands/*.md` lacking `</dev/null`." Backgrounded-only scope is justified by false-positive avoidance: a guard that flags every `claude -p` (e.g., a hypothetical interactive `claude -p` smoke test) creates noise that erodes trust in the guard.

There's a real coupling here with Task 10: if Task 10 lands later and migrates a foreground site to backgrounded without `</dev/null`, the regression guard catches it — provided the guard's "backgrounded site" detection works on the *new* backgrounded site, which it should as long as the marker text "Run with `run_in_background`" sits adjacent to the call. The detection heuristic matters more than the call-site scope.

If defensive prophylaxis goes uniform (Axis 1b = all long-running), the guard naturally extends to "every long-running `codex exec` / `claude -p` lacks `</dev/null`," which removes the marker-text dependency entirely and is mechanically simpler to implement (grep for `codex .*exec` and `claude -p` without `</dev/null` anywhere in the same command line/heredoc, regardless of marker context).

### Empirical evidence inventory

- **2026-05-02 backgrounded repro** (in `tasks/issues.md:107, 123`): backgrounded `codex exec` without `</dev/null` hung indefinitely; same call with `</dev/null` completed normally. Authoritative for backgrounded behavior.
- **Foreground stdin probe (this session)**: `read -t 2 line < /dev/fd/0` returned exit 1 (EOF) immediately — confirms fd 0 returns EOF in foreground Bash. No timeout (would have been exit >128).
- **`tasks/errors.md`**: only the 2026-04-07 timeout pitfall about `codex exec` failing to write `-o` when bash 2-min default timeout fires. No foreground stdin hang record.
- **`tasks/logs/`**: empty (no historical logs in this worktree to inspect for 10-min foreground timeouts that might have masked stdin hangs).
- **Codex's own behavior in this research session**: the foreground `codex … exec` invocation that produced `tasks/codex-research.tmp` was run with `</dev/null` defensively. The first line of stdout was `Reading additional input from stdin...` — confirming the message prints unconditionally even when stdin is `/dev/null`. The run completed in expected time; without `</dev/null` the same call should also complete (per the foreground-safe finding) but I didn't run it that way in this session, so the negative case is not directly demonstrated here.

## Code References

- `.claude/commands/implement.md:39, 76, 141` — three Codex/Claude invocation sites (1 foreground structural-mismatch, 2 backgrounded).
- `.claude/commands/issue-implement.md:46, 83, 154` — issue-flow mirror, same structure.
- `.claude/commands/auto-issues.md:33, 45, 57, 69, 81` — five `claude -p` invocations: lines 33/45/57 backgrounded, lines 69/81 foreground (timeout-only).
- `.claude/commands/research-codebase.md:43` — foreground `codex exec` with `--search`.
- `.claude/commands/design.md:87, 137, 195` — three foreground `codex exec` sites.
- `.claude/commands/create-plan.md:55` — foreground `codex exec`.
- `.claude/commands/issue-research.md:43` — foreground `codex exec` with `--search`.
- `.claude/commands/issue-plan.md:61` — foreground `codex exec`.
- `.claude/commands/codex-review.md:58` — foreground `codex exec` (no `codex-output-check.sh` call follow-up).
- `.claude/scripts/codex-output-check.sh:1` — file-existence + min-line-count guard, called after most Codex invocations.
- `.claude/scripts/pipeline-eval.sh` — referenced by `auto-issues.md:95`. Expects per-phase logs at `tasks/logs/auto-issue-N-{1..5}-*-$TIMESTAMP.log`. The `</dev/null` edits must preserve the existing `> tasks/logs/...log 2>&1` redirects.
- `tasks/issues.md:84-133` — Issue #2 source of truth.
- `tasks/todo.md:55-62` — Task 10 broader migration context (preserve coherence with Issue #2's hotfix).

## Architecture Analysis

The QRSPI command surface invokes external CLIs (`codex`, `claude -p`) via the harness's Bash tool with two execution modes:

- **Foreground** — `Timeout: 600000ms` marker text. The Bash tool runs the command synchronously and returns when it exits or hits the timeout. Output streams to the conversation. Used for all primary Codex sweeps (research-codebase, design, create-plan, issue-research, issue-plan, codex-review, structural-mismatch) and for `auto-issues.md` Phases 4–5.
- **Background** — `Run with run_in_background` marker text. The Bash tool returns immediately with a task handle; the command runs in the background. Used for the long Codex code-review and the child fix-applier in `/implement` and `/issue-implement`, and for `/auto-issues` Phases 1–3 where a long-running child `claude -p` would block the parent for the full child duration if foreground.

The split is principled: backgrounded mode keeps the parent conversation responsive while a >10-minute child runs. The decision is per-call-site, encoded as marker text adjacent to the snippet, and the harness reads the marker (we assume) to choose mode. Task 10 plans to flip the mode default from foreground to background for every long-running call.

The `</dev/null` discipline is orthogonal to mode but safety-coupled: it's *needed* in backgrounded mode, *unnecessary* in foreground today, *forward-compatible* with future mode flips. Putting it everywhere is harmless; omitting it where required hangs the run.

The repo has no central wrapper for non-interactive `codex exec` or `claude -p` invocations — every call site is hand-written. Issue #2's notes (`tasks/issues.md:125`) defer centralization explicitly: "per-call-site patches are the lowest-blast-radius option for now," with longer-term mitigations being either (a) a harness-level fix that closes stdin for `run_in_background`, or (b) a repo wrapper / shell function. The regression guard is the substitute discipline until centralization lands.

## Design Axes

### Axis 1a: Mandatory fix scope (backgrounded sites)

- **Choices:** locked at the seven backgrounded sites listed above (no real alternative — these are the empirically-confirmed hang sites).
- **Per-axis constraints:** redirect must attach to the `codex` / `claude` simple command, not the front of `mkdir && TIMESTAMP=… && …` chains. Existing `> tasks/logs/...log 2>&1` redirects must be preserved.
- **Evidence:** `tasks/issues.md:112-116`, `implement.md:76, 141`, `issue-implement.md:83, 154`, `auto-issues.md:33, 45, 57`.

This is not a real axis; it's locked. Listed for completeness only.

### Axis 1b: Defensive prophylaxis scope (foreground sites)

- **Choices:**
  - **A. None.** Don't touch foreground sites. Task 10 adds `</dev/null` per-site as it migrates.
  - **B. Two foreground `claude -p` sites in `auto-issues.md` only** (current Issue #2 scope). Rationale: file co-location with three backgrounded sites; cheap.
  - **C. All ~12 foreground long-running sites** (10 `codex exec` + 2 `claude -p`). Rationale: future-proofs Task 10, makes regression guard mechanically simpler, eliminates the asymmetry.
- **Per-axis constraints:** any foreground site getting `</dev/null` must verify the existing redirect chain still parses (placement rule from Axis 3); no edits to the marker text or timeout values; preserve the foreground/background distinction itself (this axis is about the redirect, not about mode).
- **Evidence:** `tasks/issues.md:117` (current B stance), `tasks/todo.md:55-62` (Task 10 will flip foreground sites to backgrounded later), call-site list above.

### Axis 2: Stdin mitigation mechanism

- **Choices:**
  - **A. Per-call-site `</dev/null` redirect** (current Issue #2 stance). Lowest blast radius, no infra change.
  - **B. Centralized wrapper** — repo-level shell function or script that wraps `codex exec` / `claude -p` and applies the redirect plus other discipline (logging, output checks). Issue #2 notes explicitly defer this (`tasks/issues.md:125`).
  - **C. CLI-flag substitute.** No documented `--no-stdin` flag exists for either CLI today (Codex CLI source confirms; Claude CLI docs confirm). Not viable in current versions.
- **Per-axis constraints:** any chosen mechanism must work uniformly across `codex exec` and `claude -p`; the regression guard must be able to detect compliance regardless of mechanism.
- **Evidence:** `tasks/issues.md:125-129`, https://github.com/openai/codex/blob/main/codex-rs/exec/src/lib.rs, https://code.claude.com/docs/en/cli-reference.

### Axis 3: Redirect placement (chained-line nuance)

- **Choices:**
  - **A. Attach to each simple `codex`/`claude` command directly:** `claude -p "..." --dangerously-skip-permissions </dev/null > tasks/logs/...log 2>&1`. The redirect attaches to the simple command, not the chain.
  - **B. Front of chained shell line:** `</dev/null mkdir -p tasks/logs && TIMESTAMP=… && claude -p ...`. Wrong — applies to `mkdir`, not `claude -p`. Issue #2 already calls this out as the failure mode to avoid.
  - **C. Wrap subshell:** `( claude -p "..." </dev/null )`. Adds a process layer; not necessary.
- **Per-axis constraints:** `claude -p` lines in `implement.md:141` and `issue-implement.md:154` use `mkdir -p tasks/logs && TIMESTAMP=$(date +%Y%m%d-%H%M) && claude -p ...` chains, so placement matters there. Standalone `codex exec` sites are simple commands with no chain.
- **Evidence:** `tasks/issues.md:113-115`, `implement.md:141`, `issue-implement.md:154`.

### Axis 4: Regression-guard scope and detection heuristic

- **Choices:**
  - **A. Backgrounded-only, marker-aware** (current Issue #2 stance). Detect the "Run with `run_in_background`" marker adjacent to a `codex exec` / `claude -p` call and require `</dev/null` on the call. Skip everything else.
  - **B. All long-running sites, marker-free.** Grep `codex .*exec` and `claude -p` anywhere in `.claude/commands/*.md` and require `</dev/null`. Mechanically simpler; couples to Axis 1b = C.
  - **C. No regression guard.** Rely on the per-site fix and good faith. Removes a recurring discipline mechanism.
- **Per-axis constraints:** the guard must avoid flagging the inert `claude -p` mention in `auto-issues.md:139` (in the `## Rules` prose, not an executable line), the `codex exec` mention in `errors.md:15` (commentary), and any future hypothetical interactive demo invocations. Guard rule must be runnable as a shell snippet (grep + filter).
- **Evidence:** `tasks/issues.md:118`.

### Axis 5: Where the guard lives

- **Choices:**
  - **A. Standalone script in `.claude/scripts/`** (e.g., `lint-stdin-discipline.sh`). Callable manually or from CI/pre-commit.
  - **B. Documentation note in CLAUDE.md or a README.** Guidance only, no automated enforcement.
  - **C. Pre-commit hook or git-hooked script.** Catches violations at commit time.
- **Per-axis constraints:** the playbook has no CI today; pre-commit hooks would be repo-local. Existing scripts in `.claude/scripts/` (`codex-output-check.sh`, `pipeline-eval.sh`) are bash and called by command specs, suggesting the same idiom for the guard.
- **Evidence:** `.claude/scripts/codex-output-check.sh:1`, `.claude/scripts/pipeline-eval.sh`, Issue #2 says "script or doc note" without committing (`tasks/issues.md:118`).

## Axis Coupling

- **Axis 1b ↔ Axis 4.** If Axis 1b = C (all foreground long-running sites get `</dev/null`), Axis 4 = B (marker-free guard) becomes natural — detection no longer needs the `run_in_background` marker, just "long-running" semantics. If Axis 1b = A or B, Axis 4 must stay marker-aware (Axis 4 = A) to avoid false positives on foreground sites lacking the redirect.
- **Axis 1b ↔ Task 10 (forward coupling).** Whatever sites stay without `</dev/null` after Issue #2 ships become Task 10's responsibility to add the redirect when they migrate to backgrounded. Axis 1b = C eliminates that work; Axis 1b = A or B leaves it.
- **Axis 2 ↔ Axis 3.** If Axis 2 = B (wrapper), Axis 3 collapses — placement is encapsulated inside the wrapper. Issue #2's deferral of Axis 2 = B leaves Axis 3 live.
- **Axis 4 ↔ Axis 5.** Choice of Axis 5 (script vs. doc vs. hook) constrains how Axis 4's detection heuristic is expressed but not what it detects. Independent in scope, dependent in mechanics.

## Cross-Cutting Constraints

- All edits stay inside `.claude/commands/*.md`. No edits to `CLAUDE.md` (per Issue #2 implicit scope: hotfix-only).
- No edits to fixed marker text (`Run with run_in_background`, `Timeout: 600000ms`).
- Existing `> tasks/logs/...log 2>&1` and `-o tasks/*.tmp` redirects must remain attached to the same simple command.
- `codex-output-check.sh` invocations must continue to function (`</dev/null` doesn't affect the output file the check inspects).
- `pipeline-eval.sh:13-22` expects a per-phase log for every `auto-issues.md` phase including foreground Phases 4–5 — preserving `> tasks/logs/...log 2>&1` keeps this intact.
- The hotfix should be reviewable in isolation. Don't bundle Task 10 mode flips into Issue #2's PR.

## External Research

- **Codex CLI `exec` mode stdin behavior** — Codex's source has `StdinPromptBehavior::{RequiredIfPiped, Forced, OptionalAppend}`; CLI reference describes `PROMPT string | -` with no `--no-stdin` flag. When stdin contains piped data alongside an argv prompt, Codex appends it as a `<stdin>` block. The "Reading additional input from stdin..." message is printed unconditionally before the read.
  - Sources: https://developers.openai.com/codex/noninteractive#advanced-stdin-piping, https://developers.openai.com/codex/cli/reference#codex-exec, https://github.com/openai/codex/blob/main/codex-rs/exec/src/lib.rs (Codex's citation).
  - **Unblocks:** Axis 2, choice C (rules out CLI flag — none exists).
- **Claude Code CLI `-p` mode stdin behavior** — `cat file | claude -p "query"` is documented; `--input-format` exists for print mode. No documented stdin-closed flag.
  - Source: https://code.claude.com/docs/en/cli-reference.
  - **Unblocks:** Axis 2, choice C (rules out CLI flag for `claude -p` too).
- **Claude Code harness `run_in_background` fd 0 setup** — Anthropic tool reference describes Bash and the Monitor sub-tool but does not document fd inheritance for backgrounded subprocesses.
  - Source: https://code.claude.com/docs/en/tools-reference.
  - **Blocks:** a fully documented foreground/background fd comparison. Empirical evidence stands in for documentation.
- **POSIX pipe(7) read semantics** — empty pipe reads block while a writer fd remains open; reads return EOF once all writers close. This is the foundational mechanism that explains why `</dev/null` works (replaces fd 0 with a fd that always returns EOF) and why backgrounded reads block (harness keeps a writer fd open).
  - Source: https://man7.org/linux/man-pages/man7/pipe.7.html.
  - **Unblocks:** mechanism diagnosis; reframes Issue #2's "open pipe with no writer" as "open pipe with writer-side fd held open by the harness."

## Risk Analysis

- **Misapplied chained-line redirect.** Putting `</dev/null` at the front of `mkdir -p tasks/logs && TIMESTAMP=… && claude -p …` applies to `mkdir`, not `claude -p`, leaving the bug unfixed and silently. Mitigation: the issue's chained-line note (`tasks/issues.md:113`); manual line-by-line verification during implementation; a regression guard that checks for the redirect on the actual `claude -p` simple command.
- **Regression guard becomes load-bearing.** If centralization (Axis 2 = B) is deferred indefinitely and Issue #2's per-call-site stance proliferates, the guard is the only thing keeping new long-running call sites in compliance. A guard that's bypassed, edited away, or generates false positives that get suppressed loses its value. Mitigation: keep the guard mechanically simple (one grep), make it part of an automated check (script), and document its rationale at the call sites in addition to in the guard.
- **Task 10 forward coupling.** Sites that don't get defensive prophylaxis under Issue #2 (Axis 1b = A or B) need `</dev/null` added when they migrate to backgrounded. If Task 10's migration misses any of them, those become new hang sites. Mitigation: Task 10's acceptance criteria should require `</dev/null` on every site it migrates (and the regression guard must exist by then to enforce).
- **Harness fd-inheritance change.** If a future Claude Code harness release changes foreground Bash to also pass an open-pipe-with-writer fd 0, foreground sites become vulnerable retroactively. Mitigation: monitor harness behavior; if it changes, defensive prophylaxis (Axis 1b = C) becomes mandatory.
- **`</dev/null` is not a panacea.** It only addresses fd 0 reads. Hangs from `/dev/tty`, permission prompts, model/network stalls, lock contention, or sub-children with their own stdin probes are unaffected. The issue's "Verification" criterion (`tasks/issues.md:119`) already calls this out.
- **PR scope creep risk.** Axis 1b = C touches ~12 sites instead of 9. Reviewers may push back on bundling defensive coverage with the operational hotfix. Mitigation: split the PR if needed, or land Axis 1b = B as the hotfix and a follow-up PR for Axis 1b = C.

## Open Questions

1. **Axis 1b decision.** Should defensive prophylaxis cover all foreground long-running sites (C), only the two in `auto-issues.md` (B, current), or none (A)? This is the only axis with real movement in design — Axis 1a, 2, 3 are largely locked.
2. **Axis 5 decision.** Where does the regression guard live — standalone script (A), documentation only (B), or pre-commit hook (C)? The choice depends on how much enforcement the team wants.
3. **Codex internal flag.** Is there a private/undocumented Codex CLI option that suppresses the stdin probe? Worth a one-shot `codex exec --help | rg -i stdin` check during implementation; if found, that becomes the cleanest mechanism (Axis 2 = C resurrected). Codex's external research did not find one but didn't exhaustively walk the source.
4. **Should the issue body's "open pipe with no writer" wording be corrected** to "writer-side fd held open by the harness" for accuracy, or left as-is since the operational fix doesn't depend on the wording? Cosmetic; mention during implementation triage.
5. **Codex's `codex-output-check.sh` exception in `/codex-review`.** Codex flagged that `/codex-review` doesn't call `codex-output-check.sh` (it reads the output directly per `codex-review.md:66-68`). This is tangential to Issue #2 but is a CORRECTION worth noting if a follow-up tightens the guard pattern uniformly across Codex-calling commands.
