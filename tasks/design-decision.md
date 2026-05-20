# Design: Migrate long-running Codex / `claude -p` calls to background-by-default (Task 10)

## Context

Every long-running `codex exec` and `claude -p` invocation in the playbook's slash-command specs currently runs **foreground**, subject to the harness's 10-minute Bash-tool timeout — a silent failure mode for sweeps that legitimately run longer. Task 10 migrates these to **background-by-default** so the timeout cap stops mattering, while preserving the `</dev/null` discipline (Issue #2) and leaving genuinely short / stdin-coupled commands (`git merge`, `git fetch --unshallow`) foreground.

This is a **prose-spec migration** — editing fenced bash blocks plus the directive prose around them (timeout wording, background callouts, output-verification steps) in `.claude/commands/*.md`. No application code changes.

**Research:** `tasks/research-codebase.md`

### Constants across every option (not differentiators)

These are mandated by Cross-Cutting Constraints and Axis Coupling — they apply regardless of which option is chosen:

- **11 verified foreground sites** are the migration targets (table in research §"Foreground long-running sites"). The exact count (11 vs Codex's 12) is re-enumerated at plan time via fresh grep — Open Question 1.
- **`</dev/null` preserved** at every touched site, attached to the `codex`/`claude -p` simple command before any stdout redirection.
- **`/codex-review` (site #8) gains a `codex-output-check.sh` step.** Step 4 currently reads the tmp directly; a backgrounded resume can land on a missing/short file, so the paired output-check edit is non-optional (Axis Coupling).
- **Conditional mid-loop sites (#3 tiebreaker, #9/#10 structural-mismatch re-research) get explicit "wait for completion before resuming the loop" prose.** A plain end-of-step "run in background" callout is insufficient framing — these fire inside a phase/decision loop and could race (Axis 2 × Axis 6 coupling, Open Question 4).
- **The "10-minute timeout (600000ms)" sentence is removed (not replaced with another value)** at every migrated site — the background callout replaces it. A `timeout` value on a `run_in_background: true` call is inert: the call returns immediately, so there is nothing for `timeout` to bound. Evidence: the `/research-codebase` run for this task ran ~7+ min backgrounded (research line 77), well past the 120000ms foreground default — if `timeout` governed background processes it would have been killed at 2 min. The background callout and the timeout-sentence removal are one coordinated change.
- **The background callout must spell the parameter as `run_in_background: true` and identify it as a Bash-tool parameter** — not shell syntax. It is set when the agent calls the Bash tool; it never appears inside the fenced bash block (research §"Two established background-prose shapes").
- **An empirical smoke test is a mandatory acceptance criterion** (Open Question 2) — verify a backgrounded Codex sweep survives past 10 minutes before declaring the migration done. Required even with notification-only verification (Axis Coupling).
- **Stale spec text ignored:** `/auto-issues` Phase 5 and `/issue-implement` Step 8 are now inline (Task 11) — not migration targets.
- **Land before Task 7, lean before Task 5** (sequencing — minimizes merge churn).

## Options Considered

### Option A — Minimal-footprint migration

**Axis-choice combination:** Axis 1=(a) 11 foreground sites only · Axis 2=(a) uniform bold callout · Axis 3=(a) keep 600000ms · Axis 4=(a) `-o tasks/*.tmp` only, no Codex log redirect · Axis 5=(a) leave existing flags untouched · Axis 6=(a) harness notification + existing `codex-output-check.sh` at next step.

**How it works:** Replicate the simpler in-repo precedent — `/implement` Step 6 (`implement.md:73`). Each of the 11 sites gets the bold callout `**Run with `run_in_background` — Codex/Claude phase, may take 10+ minutes.**` above its bash block, the stale timeout sentence rewritten, `</dev/null` kept. No new flags, no log redirects on Codex sites. The `claude -p` site (#11) keeps its existing log redirect.

**Good:** Smallest possible diff — fewest changed lines per file, no new flags or redirects, lowest merge-churn surface against Tasks 5/7. Matches an existing backgrounded precedent verbatim. Most reversible.

**Not good:** Leaves backgrounded Codex calls without `-a never` — a background process **cannot answer an interactive approval prompt**, so if Codex ever hits one it hangs silently. That is precisely the silent-failure class Task 10 exists to eliminate; `--sandbox read-only` reduces but does not provably eliminate prompt surface (Axis 5 constraint). `/implement-codex` mandates `-a never` for exactly this reason.

### Option B — Hardened scoped migration

**Axis-choice combination:** Axis 1=(a) 11 foreground sites only · Axis 2=(a) bold callout, mid-loop sites get added wait wording, timeout sentence removed · Axis 3 moot — no timeout value carried in migrated-site prose · Axis 4=(a) `-o tasks/*.tmp` only · Axis 5=(b) add `-a never` to every newly-backgrounded Codex site · Axis 6=(a) notification + `codex-output-check.sh` for end-of-step sites, (b) explicit wait for mid-loop sites.

**How it works:** Option A's scope and prose shape, plus one hardening change: every newly-backgrounded Codex call gets `-a never` so it can never hang on an interactive approval prompt it cannot answer. Differs from A only on Axis 5 — but that axis materially changes the failure profile.

`-a never` is a **Codex-only** flag (`--ask-for-approval never`); it applies to the 10 `codex exec` sites among the 11 targets (#1–#10). The lone `claude -p` target — site #11, `/auto-issues` Phase 4 — has no `-a never` equivalent and does not need one: it already carries `--permission-mode auto`, the `claude -p` non-interactive guarantee. So Axis 5 touches 10 sites, not 11.

**Good:** Stays scoped to the 11 foreground sites (low blast radius, minimal Task 5/7 churn) while closing the one genuine correctness gap in Option A. `-a never` is one flag per site — cheap insurance that matches the explicit `/implement-codex` mandate (`implement-codex.md:135`). Carries no timeout value at all (the parameter is inert for background calls — see Cross-Cutting constant), so it avoids both the invalid `1800000ms` setting and any misleading number.

**Not good:** Slightly larger diff than A (one flag added per Codex site). Introduces a flag the existing `/implement` Step 6 precedent omits, so the repo's backgrounded-Codex sites stay non-uniform on `-a never` until Task 7 or a follow-up normalizes Step 6. (This non-uniformity already exists; Option B does not worsen it.) **It does not by itself prove background tasks survive past 10 minutes** — that premise still rests on the empirical smoke test, a hard acceptance gate, not a formality.

**Optional extension (Codex cross-check trade-off):** while editing `implement.md` and `issue-implement.md`, add `-a never` to their *already-backgrounded* Codex review sites (`implement.md:76`, `issue-implement.md:80`) — a two-site cleanup confined to files Option B already touches, with none of Option C's log redirects, `1800000ms`, or broad prose rewrite. Closes the same silent-hang gap on those two sites for near-zero extra churn. See the non-blocking question below.

**Stray-timeout cleanup (verified):** of the six already-backgrounded sites, five carry no timeout wording (just the bold callout) — nothing to fix. The lone exception is `/issue-implement` Step 6, which is backgrounded but still carries a stray `Use a 10-minute timeout (600000ms).` sentence after its bash block — now inert and misleading. Delete that one line. `issue-implement.md` is already in Option B's edit set, so this costs zero extra file surface. This is NOT Option C scope creep: it is a single-line deletion of dead prose, not a normalization of the compliant sites.

### Option C — Full uniformity migration

**Axis-choice combination:** Axis 1=(b) also normalize the six already-backgrounded sites (`/implement` Steps 6 & 8, `/issue-implement` Step 6, `/auto-issues` Phases 1-3 — excluding the already-canonical `/implement-codex`) · Axis 2=(b) inline sentence (the `/implement-codex` shape) everywhere · Axis 3=(b) adopt 1800000ms · Axis 4=(b) add `> tasks/logs/…log 2>&1` to every backgrounded Codex site · Axis 5=(b) `-a never` everywhere · Axis 6=(a)/(b) as Option B.

**How it works:** Treat `/implement-codex` (Task 12) as the canonical shape and converge the *entire repo* on it — migrate the 11 foreground sites **and** rewrite the already-compliant backgrounded sites (`/implement` Steps 6/8, `/issue-implement` Step 6, `/auto-issues` Phases 1-3) so prose shape, flags, timeout value, and log redirection are identical everywhere.

**Good:** Maximum consistency — after this task every long-running call in the repo looks the same, which is Task 10's stated *uniformity* goal in its strongest reading. One mental model for all future edits.

**Not good:** Largest blast radius. Touching already-compliant sites widens the diff into files Task 7 (skill port) and Task 5 also edit — research explicitly flags this merge-churn risk and recommends landing Task 10 *first* and *narrow*. Axis 3=(b) `1800000ms` **exceeds the documented 600000ms `timeout` maximum** (External Research) — either background is timeout-exempt (value is cosmetic) or it is silently clamped (value is misleading); adopting it bets on an unverified premise (Open Question 2). Axis 4=(b) adds log-redirect churn and forces every command's `## Clean up` step to account for new paths (Axis Coupling). Re-litigates the `/implement` precedent rather than extending it.

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)

_None._ The scope decision (Open Question 3 — normalize compliant sites or not) is resolved by the option choice. The prose-shape decision (Open Question 4) is resolved by the cross-cutting constant requiring mid-loop sites to get explicit wait wording.

### Resolved by Codex cross-check

- **Open Question 1 — exact foreground-site count: 11.** Codex's fresh inspection confirms 11 foreground targets; the stale "12th" was old Task 10 text naming `/auto-issues` Phase 5, which now runs inline (`auto-issues.md:96`, verified). The plan should still re-grep to lock the line numbers, but the count is settled.

### Non-blocking (can resolve during implementation)

- [ ] **Open Question 2 — does `run_in_background: true` exempt a Bash command from the `timeout` ceiling?** Cannot be settled from docs; becomes a **mandatory empirical acceptance gate** — a deterministic >10-minute background test (e.g. `sleep 610` with `run_in_background: true`, `timeout: 600000`, then output verification). If the test fails, stop and revisit the task premise with the developer. This is effectively blocking for Option C (its 1800000ms value only makes sense if exemption holds); for Options A/B it gates acceptance, not the design choice.
- [ ] **`/codex-review` liveness.** Task 10's `/codex-review` rationale claims background mode "still streams output"; docs suggest background output goes to a *file*, not a live stream. Implementation prose must NOT promise live streaming — confirm behavior during the smoke test and document honestly.
- [ ] **Two-site `-a never` cleanup (Option B optional extension).** Decide at plan time whether to add `-a never` to the already-backgrounded Codex review sites in `implement.md`/`issue-implement.md`. Recommended: yes — it is confined to files Option B already edits and closes the same silent-hang gap.

## What We're NOT Doing

- Not changing application/source code — this is a prose-spec edit of `.claude/commands/*.md` only.
- Not centralizing the `run_in_background` or `</dev/null` rules in `CLAUDE.md` — both stay at each invocation site (`tasks/todo.md:55`).
- Not migrating short / stdin-coupled foreground git ops — `git merge` (`catchup.md`), `git fetch --unshallow` (`playbook-update.md`).
- Not migrating `/auto-issues` Phase 5 or `/issue-implement` Step 8 — both are inline post-Task 11 (stale spec text).
- Not removing `--search` from the research / pattern-research Codex sites (#1, #4, #6).
- (Options A/B only) Not normalizing the already-backgrounded sites — deferred to avoid Task 5/7 merge churn. (Option B's optional extension touches only two `-a never` flags inside files already edited — not a full normalization.)

## Decision

**Chosen approach:** Option B — Hardened scoped migration (with the optional two-site `-a never` cleanup included).

**Rationale:** Option B wins on every decision heuristic. (1) *Codebase patterns* — it replicates the existing `/implement` Step 6 bold-callout precedent verbatim and adopts the `-a never` flag exactly as `/implement-codex` already mandates it; nothing is invented. (2) *Simplicity* — it stays scoped to the 11 verified foreground sites, the smallest scope that still does the job, avoiding Option C's broad normalization, log-redirect churn, and the `1800000ms` value that exceeds the documented 600000ms `timeout` maximum. (3) *Reversibility* — a per-site prose change is trivially revertable.

Option A is rejected because it leaves backgrounded Codex calls without `-a never`: a background process cannot answer an interactive approval prompt, so a hang is silent — exactly the failure class Task 10 exists to eliminate. The one-flag-per-site cost of closing that gap is negligible. Option C is rejected for over-reach: touching the six already-compliant sites widens the diff into files Task 5/7 also edit (research-flagged merge churn), and its `1800000ms` timeout bets on the unverified timeout-exemption premise.

Codex independently arrived at the same axis-choice combination as Option B (1a/2a/3a/4a/5b/6 notification+wait) before reading the options, and recommended it on technical merit — strong convergence. Codex's cross-check also corrected two artifact errors now absorbed: keeping 600000ms does *not* "sidesteps" the timeout-exemption question (it only avoids the invalid larger value — the premise still rests on the smoke test), and the callout must spell `run_in_background: true` explicitly as a Bash-tool parameter. The optional two-site `-a never` cleanup is folded into the decision because it is confined to files Option B already edits and closes the identical silent-hang gap for near-zero extra churn. The single stray-timeout deletion in `/issue-implement` Step 6 is likewise folded in — verification showed five of the six already-backgrounded sites are already clean, so this is one dead line, not a normalization pass.

The migration's value remains gated on the empirical smoke test (Open Question 2): if a >10-minute backgrounded Bash command is still killed at the timeout ceiling, implementation must stop and the task premise be revisited with the developer.
