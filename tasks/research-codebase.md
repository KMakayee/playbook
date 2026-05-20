# Research: Migrate long-running Codex / `claude -p` calls to background-by-default (Task 10)

## Research Question

Migrate every long-running Codex (`codex exec`) and `claude -p` invocation in the playbook's slash-command specs (`.claude/commands/*.md`) from foreground execution to background-by-default execution, so the harness's 10-minute foreground Bash-timeout cap stops being a silent failure mode. Bake `</dev/null` into every backgrounded site (already present repo-wide per Issue #2 — must be preserved). Leave genuinely short / stdin-coupled commands (`git merge`, `git fetch --unshallow`) foreground. Both rules live at each call site, not in `CLAUDE.md`. Full authoritative scope: `tasks/todo.md` task 10.

## Summary

This is a **prose-spec migration**, not a code change. The "invocation site" is a fenced bash block plus the directive prose around it (timeout wording, `run_in_background` callouts, output-verification steps). A migration edits both.

The repo already has a working background precedent — `/implement` Step 6/8, `/issue-implement` Step 6, `/auto-issues` Phases 1-3, and the whole of `/implement-codex` (Task 12) — so the target shape is established and in-repo, not invented. The job is to make backgrounding **uniform** across the ~11 still-foreground long-running sites and to normalize the prose so the pattern is consistent everywhere.

**The migration's entire value rests on one unverified assumption: that a backgrounded Bash command is NOT killed by the 10-minute timeout ceiling.** Official Claude Code docs confirm background tasks return immediately, write output to a file, and fire a completion notification — but do not explicitly state that backgrounding exempts a process from the timeout cap. If it doesn't, the migration is cosmetic. Task 10 itself flags this as a required empirical check; it must be an acceptance criterion, not an assumption baked silently into the edits.

Two scope items in the Task 10 spec text are **stale** and must not be implemented as written: `/auto-issues` Phase 5 is no longer a `claude -p` child (Task 11 made it inline), and `/issue-implement` Step 8 is now inline (no `claude -p`). The only `claude -p` site still needing migration in the issue pipeline is `/auto-issues` Phase 4.

## Detailed Findings

### Foreground long-running sites needing migration (the migration targets)

All verified by direct read. Each is a `codex exec` or `claude -p` call currently run foreground with 10-minute-timeout prose.

| # | Site | Call | Output | Has `codex-output-check`? | Notes |
|---|------|------|--------|---------------------------|-------|
| 1 | `research-codebase.md:43-48` | `codex --search exec` | `-o tasks/codex-research.tmp` | Yes (`:49`) | First substantive step — Claude has nothing concurrent to do during the wait (see Risk) |
| 2 | `design.md:84-108` | `codex exec` (Phase 1-3 design review) | `-o tasks/codex-design-review.tmp` | Yes (`:107`) | |
| 3 | `design.md:131-149` | `codex exec` (tiebreaker) | `-o tasks/codex-design-tiebreaker.tmp` | Yes (`:147`) | **Conditional** — runs at most once, only when the decision is still blocked |
| 4 | `design.md:190-203` | `codex --search exec` (pattern research) | `-o tasks/codex-patterns-research.tmp` | Yes (`:201`) | **Conditional** (RUN/SKIP gate). Line 192 prose explicitly says "foreground … matches the other RDPI Codex calls" — that rationale **inverts** once siblings migrate |
| 5 | `create-plan.md:52-87` | `codex exec` (plan review) | `-o tasks/codex-plan-review.tmp` | Yes (`:89`) | |
| 6 | `issue-research.md:43-48` | `codex --search exec` | `-o tasks/codex-issue-research-$ARGUMENTS.tmp` | Yes (`:49`) | |
| 7 | `issue-plan.md:58-92` | `codex exec` (plan review) | `-o tasks/codex-issue-plan-review-$ARGUMENTS.tmp` | Yes (`:95`) | |
| 8 | `codex-review.md:53-61` | `codex exec` | `-o tasks/codex-review.tmp` | **No** — Step 4 reads the tmp directly | Migration must also add an output check (see Coupling) |
| 9 | `implement.md:37-52` | `codex exec` (structural-mismatch re-research) | `-o tasks/codex-debug-{phase}.tmp` | Yes (`:50`) | **Conditional** — fires mid-loop only on a structural mismatch |
| 10 | `issue-implement.md:44-59` | `codex exec` (structural-mismatch re-research) | `-o tasks/codex-debug-issue-$ARGUMENTS-{phase}.tmp` | Yes (`:57`) | **Conditional** — same as #9 |
| 11 | `auto-issues.md:84-89` | `claude -p` (Phase 4 Update child) | log file `tasks/logs/auto-issue-N-4-update-$TIMESTAMP.log` | n/a (`claude -p`, no `-o`) | Lone foreground child; Phases 1-3 are already backgrounded |

That is **11 verified foreground sites**. Codex's sweep reported "12" — the discrepancy is unresolved and small; `/design` should re-enumerate before planning rather than trust either count (Open Question 1).

### Already-backgrounded sites (NOT migration targets — reference precedent / consistency candidates)

- `implement.md:71-101` — Step 6 Codex code review. Backgrounded via the bold callout `implement.md:73`. **Lacks `-a never`** (relevant to Axis 5).
- `implement.md:134-151` — Step 8 `claude -p` fix-applier child. Backgrounded via callout `:136`. Uses `--dangerously-skip-permissions`.
- `issue-implement.md:75-111` — Step 6 Codex code review. Backgrounded via callout `:77`.
- `auto-issues.md` Phases 1-3 (`:48-82`) — backgrounded `claude -p` children, callouts at `:50, :62, :74`.
- `implement-codex.md` (Task 12) — **the strongest precedent**: per-phase Codex (`:119-135`), structural-mismatch re-research (`:294-306`), Step 6 review (`:368-371`), Step 8 child (`:437-447`) all backgrounded with `-a never`, `--json`, `</dev/null`, log redirection, and a 30-minute (1800000ms) timeout. Already compliant — a no-op target.

### Two established background-prose shapes in the repo

1. **Bold callout above the bash block** — `implement.md:73` / `issue-implement.md:77` / `auto-issues.md:50`: `**Run with `run_in_background` — Codex phase, may take 10+ minutes.**`
2. **Inline sentence inside the directive** — `implement-codex.md:119`: "Run with `run_in_background: true` (the Bash tool's parameter …)".

`run_in_background` is a **Bash-tool parameter**, not shell syntax — it never appears inside the fenced bash block; the spec signals it in prose so the executing agent sets the parameter when it calls Bash.

### Output capture: two existing conventions

- **Codex sites** write final content via `-o tasks/*.tmp` and verify with `bash .claude/scripts/codex-output-check.sh <path> <min-lines>` (exists / min-line-count check; does **not** wait for a process — `codex-output-check.sh:1-23`).
- **`claude -p` sites** have no `-o`; they redirect combined stdout+stderr into `tasks/logs/*.log` for failure diagnosis.
- `implement-codex.md` does **both** for its backgrounded Codex calls (`-o` tmp **and** `> tasks/logs/…log 2>&1`) because it also uses `--json` and audits the event log.
- `tasks/logs/` is gitignored (`.gitignore:6`) — adding log redirects creates no tracked-file churn.

## Code References

- `tasks/todo.md:55-62` — Task 10 authoritative scope, target list, sequencing, discipline-preservation
- `tasks/issues.md` Issue #2 — `</dev/null` discipline (shipped 2026-05-03, 19 long-running sites)
- `tasks/errors.md:12-17` — older "10-minute timeout" guidance, superseded for long Codex calls by Task 10's motivation
- `.claude/scripts/codex-output-check.sh:1-23` — post-run output verifier (no active waiting)
- `.claude/scripts/pipeline-eval.sh` — `/auto-issues` integrity checker; expects Phase 1-4 child logs only (consistent with Phase 5 being inline)
- `CLAUDE.md` — RDPI workflow rules; Task 10 explicitly forbids putting the background/`</dev/null` rules here
- `catchup.md:88` (`git merge`), `playbook-update.md:81` (`git fetch --unshallow`) — out-of-scope foreground git ops

## Architecture Analysis

The playbook delegates heavy read-only sweeps and reviews to Codex (`codex exec`) and delegates fix-application / pipeline phases to nested Claude sessions (`claude -p`). Foreground calls block the orchestrating conversation for the call's full duration and are subject to the harness's Bash-tool timeout. Backgrounded calls return a task ID immediately, run asynchronously, write output to a file, and fire a completion notification the orchestrator picks up — letting the conversation stay responsive and (the premise) escaping the timeout cap.

The repo migrated the *highest-pain* sites first (implementation/review phases that reliably run long), leaving the research/design/plan sweeps and conditional re-research calls foreground. Task 10 finishes the job. The pattern is mature: `implement-codex.md` already encodes the full target shape including verification and crash diagnosis.

**In-session empirical data point:** this very research run was executed backgrounded. The `codex --search exec` call ran ~7+ minutes and the harness delivered a completion notification on exit. This confirms the **completion-notification / auto-resume mechanism works** for a backgrounded Codex call — but the run was under 10 minutes, so it does **not** confirm timeout-exemption (see Risk Analysis).

## Design Axes

### Axis 1: Edit scope on already-compliant sites
- **Choices:** (a) edit only the 11 foreground sites, leave already-backgrounded sites untouched; (b) also normalize the already-backgrounded sites (prose shape, add `-a never`) so every site in the repo is uniform after this task.
- **Per-axis constraints:** Task 10's stated goal is *uniformity*; `/implement` Step 6 currently lacks `-a never` while `/implement-codex` mandates it — a real inconsistency. But touching compliant sites widens blast radius and risks merge churn with Task 7.
- **Evidence:** `tasks/todo.md:55-61`; `implement.md:76` (no `-a never`); `implement-codex.md:135`.

### Axis 2: Invocation-site prose shape for the migrated sites
- **Choices:** (a) bold callout above the block (`implement.md:73` style); (b) inline sentence inside the directive (`implement-codex.md:119` style); (c) keep the existing "10-minute timeout (600000ms)" sentence and append background wording.
- **Per-axis constraints:** the rule must live at the call site, not `CLAUDE.md` (`tasks/todo.md:55`); the wording must make clear `run_in_background` is a Bash-tool parameter; the existing "10-minute timeout" sentences should not be left stating a now-misleading cap.
- **Evidence:** `implement.md:73`, `implement-codex.md:119`, the "10-minute timeout (600000ms)" prose at all 11 sites.

### Axis 3: Timeout value after migration
- **Choices:** (a) keep the `600000ms` wording; (b) adopt `1800000ms` like `/implement-codex`; (c) tune per site by expected workload.
- **Per-axis constraints:** the Bash tool documents a **600000ms maximum** for the `timeout` parameter (see External Research). `/implement-codex:119` already instructs `1800000ms`, which exceeds that documented max — so either background processes are timeout-exempt (and the value is moot) or the value is silently clamped. The choice here is coupled to whether backgrounding escapes the cap at all.
- **Evidence:** `tasks/errors.md:15-17` (600000ms); `implement-codex.md:119` (1800000ms); Bash tool schema (max 600000ms).

### Axis 4: Output capture for backgrounded Codex sites
- **Choices:** (a) keep `-o tasks/*.tmp` only (current Codex convention); (b) add `> tasks/logs/…log 2>&1` stdout/stderr redirection to every backgrounded Codex site (the `/implement-codex` shape); (c) add the log redirect only where a separate event log is needed.
- **Per-axis constraints:** `claude -p` sites already need the log redirect for diagnosis; Codex `-o` + `codex-output-check.sh` is the existing Codex contract; `/implement` Step 6 is a backgrounded Codex site that does **not** redirect stdout to a log — so the current backgrounded-Codex precedent is itself split. `tasks/logs/` is gitignored, so log redirects are free of tracked-file churn.
- **Evidence:** `implement.md:76` (no redirect), `implement-codex.md:130` (redirect), `.gitignore:6`.

### Axis 5: `-a never` on newly-backgrounded Codex sites
- **Choices:** (a) leave existing flags untouched; (b) add `-a never` to every newly-backgrounded Codex site; (c) add it only where Codex could plausibly hit an interactive prompt.
- **Per-axis constraints:** `/implement-codex` states `-a never` is **required** for background Codex because background mode cannot answer interactive approval prompts (`implement-codex.md:135`); `--sandbox read-only` reduces but does not provably eliminate prompt surface; the existing backgrounded `/implement` Step 6 Codex omits `-a never` and has not been reported to hang — weak evidence either way.
- **Evidence:** `implement-codex.md:135,398`; `implement.md:76`.

### Axis 6: Completion / resume verification
- **Choices:** (a) rely on the harness completion notification, then run the existing `codex-output-check.sh` at the next step; (b) add an explicit completion-poll/wait step in the prose before the next step reads the output; (c) treat the in-conversation notification as sufficient and add only a one-time acceptance smoke test.
- **Per-axis constraints:** Task 10 requires *empirical* auto-resume verification before declaring the pattern uniform (`tasks/todo.md:58`); `codex-output-check.sh` validates only *after* completion — it is not a wait/poll mechanism; the conditional mid-loop sites (#3, #9, #10) must not let the implementation loop race ahead of an unfinished background process.
- **Evidence:** `tasks/todo.md:58`; `codex-output-check.sh:1-23`.

## Axis Coupling

- **If Axis 6 = (a) notification-only → an acceptance smoke test is still mandatory.** Repo scripts prove nothing about auto-resume; Task 10 explicitly demands the empirical check (`tasks/todo.md:58`). Notification-only without a smoke test leaves the premise unverified.
- **If migrating site #8 (`/codex-review`) → an output-verification step must be added.** `codex-review.md` Step 4 currently reads `tasks/codex-review.tmp` directly with no existence/substance check. A backgrounded call that the orchestrator resumes from can land on a missing/short tmp; backgrounding #8 forces a paired `codex-output-check.sh` (or equivalent) edit.
- **If Axis 3 = (b) 1800000ms → behavior depends on whether background escapes the timeout cap.** If background is timeout-exempt the value is cosmetic; if not, 1800000ms exceeds the documented 600000ms max and is unreliable. Axis 3 cannot be resolved independently of the timeout-exemption question (Open Question 2).
- **If Axis 4 = (b) add Codex logs → cleanup/staging lists must exclude the new log paths.** `tasks/logs/` is gitignored so commits are unaffected, but each command's `## Clean up` step and any `.tmp`-deletion logic should not be confused by the new files. `/implement-codex` already handles this; the migrated sites would need the same care.
- **Conditional mid-loop sites (#3 tiebreaker, #9/#10 structural-mismatch) couple Axis 2 to Axis 6.** These fire *inside* a phase/decision loop, not at a clean step boundary. Their migrated prose must explicitly tell the agent to wait for the background result before resuming the loop — a plain "run in background" callout designed for end-of-step calls is insufficient framing here.

## Cross-Cutting Constraints

- **Preserve `</dev/null` at every touched site** (Issue #2). For chained commands it attaches to the `codex`/`claude -p` simple command *before* any stdout redirection. No automated lint exists — verify by grep sweep + a smoke run.
- **Do not centralize the rule in `CLAUDE.md`** — both the `run_in_background` and `</dev/null` rules stay at each invocation site (`tasks/todo.md:55`).
- **Keep `--search`** on the research / pattern-research Codex sites (#1, #4, #6).
- **Leave out-of-scope foreground git ops alone** — `git merge` (`catchup.md`), `git fetch --unshallow` (`playbook-update.md`).
- **The "10-minute timeout (600000ms)" sentence appears verbatim at most sites** — migration should not leave that sentence asserting a cap that the new pattern is meant to make irrelevant; the prose edit and the background callout are a single coordinated change.
- **Land before Task 7** (skill port) so the port reflects the new pattern; **after Task 11** (done); lean **before Task 5** (which also edits `research-codebase.md` and `CLAUDE.md` — overlap risk).

## External Research

- **Background Bash exists and is asynchronous.** Background commands return a task ID immediately, run asynchronously, and write output to a file readable via `Read`; background tasks are cleaned up on session exit and killed if output exceeds 5GB. Source: https://code.claude.com/docs/en/interactive-mode — **Unblocks:** Axis 6 (notification/output-file choices).
- **The Bash tool exposes `run_in_background`, `timeout`, and a background `shellId`.** The `timeout` parameter's documented maximum is **600000ms**. Sources: https://code.claude.com/docs/en/agent-sdk/python , https://code.claude.com/docs/en/tools-reference — **Unblocks:** Axis 2 (parameter, not shell syntax), Axis 3 (600000ms ceiling). **Divergence from codebase:** `implement-codex.md:119` instructs `1800000ms`, exceeding this documented max — flagged as a Risk.
- **Completion notifications fire for background tasks.** SDK docs define `TaskStartedMessage`, `TaskProgressMessage`, and `TaskNotificationMessage`; notifications fire when a background task completes/fails/stops and include `output_file`. Source: https://code.claude.com/docs/en/agent-sdk/python — **Unblocks:** Axis 6. **Caveat:** this confirms a *notification* fires; it does not by itself prove a slash-command spec will always auto-continue to the next prose step without an empirical smoke test.
- **Live streaming of background Bash output to Claude is not clearly documented.** Docs state background output is written to a *file*; the separate Monitor tool is what streams stdout *line events*. Source: https://code.claude.com/docs/en/tools-reference — **Unblocks:** Axis 4. **Contradiction with the Task 10 spec:** Task 10's `/codex-review` rationale asserts "background mode still streams output (in the compact shell card)". The docs do not confirm live streaming for background Bash. The dev-facing liveness of a backgrounded `/codex-review` may be weaker than the spec assumes — see Risk Analysis.
- **`</dev/null` semantics.** `<word` redirects fd 0 (stdin) for a simple command; redirections are processed as shell syntax before command execution, so `</dev/null` belongs on the simple command, before any `> log 2>&1`. Source: https://www.gnu.org/software/bash/manual/html_node/Redirections.html.
- **Not resolvable from research — implementation acceptance step:** whether a backgrounded Bash command is exempt from the `timeout` ceiling cannot be confirmed from docs or a read-only environment. Codex could not run the smoke tests. This is the load-bearing unknown (Open Question 2) and must be an explicit acceptance criterion in the plan.

## Risk Analysis

- **The migration is cosmetic if backgrounded processes are still killed at the timeout cap.** The whole task premise ("backgrounding makes the 10-min cap stop mattering") is unverified by docs. If background tasks inherit the 600000ms ceiling, nothing improves. Mitigation: a mandatory smoke test running a backgrounded Codex sweep past 10 minutes (or a deliberately long synthetic command) before declaring the migration done.
- **`/codex-review` liveness regression.** Task 10 justifies migrating `/codex-review` on the claim that background mode "still streams output." Docs suggest background output goes to a *file*, not a live stream. If the developer relied on watching `/codex-review` progress live, backgrounding may degrade that UX — the opposite of the spec's stated assumption. Worth confirming during the smoke test and documenting honestly.
- **Conditional mid-loop sites can race.** The tiebreaker (#3) and structural-mismatch re-research (#9, #10) fire mid-flow. If migrated with end-of-step "run in background" framing, the agent could resume the phase/decision loop before the background result lands. Their prose needs an explicit "wait for completion before continuing" instruction.
- **`/codex-review` missing output check becomes load-bearing once backgrounded.** Reading a possibly-missing tmp after a background resume is fragile; the paired `codex-output-check.sh` edit is not optional.
- **Issue #2 discipline regression.** Re-writing bash blocks risks dropping `</dev/null`. No lint guards this. Every touched block must be grep-verified post-edit.
- **Stale Task 10 spec text.** The spec names `/auto-issues` Phase 5 (`claude -p`) and implies `/issue-implement` Step 8 as background-relevant; both are now inline (Task 11). Implementing the spec literally would target nonexistent call sites.
- **Merge churn with Task 5 / Task 7.** Task 5 edits `research-codebase.md` and `CLAUDE.md`; Task 7 ports every command to a skill. Landing Task 10 first (per its own sequencing note) minimizes this, but the migration touches ~11 files — coordinate.

## Open Questions

1. **Exact foreground-site count.** This research verified 11 foreground long-running sites; Codex's sweep reported 12. `/design` (or `/create-plan`) should re-enumerate via a fresh grep of `'10-minute timeout'` / `600000` / `codex exec` / `claude -p` against `.claude/commands/*.md` and reconcile before planning, so no site is silently missed.
2. **Does `run_in_background: true` exempt a Bash command from the `timeout` ceiling?** Load-bearing — see Risk Analysis. Must be settled empirically and made an acceptance criterion. If background is *not* exempt, the task's scope/value needs to be revisited with the developer.
3. **Should the migration also normalize the already-backgrounded sites** (Axis 1) — e.g., add `-a never` to `/implement` Step 6, unify prose shape — or stay strictly within the foreground-site set? Trade-off: uniformity vs. blast radius / Task 7 merge churn.
4. **One prose shape or context-dependent shapes?** End-of-step sites and conditional mid-loop sites have different resume semantics (Axis 2 × Axis 6 coupling); a single callout template may not fit both.
