# Design: Issue #2 — `</dev/null` discipline for `codex exec` / `claude -p` call sites

## Context

Backgrounded `codex exec` and `claude -p` invocations in QRSPI commands hang indefinitely because the harness retains a writer-side fd on the child's stdin pipe; the child's `read()` blocks waiting for input that never arrives. Issue #2 patches the seven mandatory backgrounded sites and two `claude -p` sites in `auto-issues.md` and proposes a regression guard.

The user's open question: **should `</dev/null` extend to the ~10 other long-running `codex exec` / `claude -p` sites in the playbook, or stay narrowly co-located with the backgrounded fixes?**

**2026-05-02 empirical update (this session):** the research's premise that foreground sites are not vulnerable today is falsified. Two reinforcing observations:

1. Claude invoked `codex exec` (the foreground call defined at `.claude/commands/design.md:87`) for this very design phase via the Bash tool *without* `run_in_background:true` and *without* `</dev/null`. The harness backgrounded it automatically and it hung indefinitely (had to be killed; exit 144).
2. The user reports the harness is non-deterministic — sometimes a long-running command runs foreground, sometimes the harness backgrounds it. There is no way to predict from the command spec which mode the runtime will pick.

Together these falsify the "foreground sites are safe" assumption that Issue #2's narrow scope rests on. Every long-running `codex exec` / `claude -p` site is vulnerable in practice, because the harness can choose to background it independently of how the spec is written. This makes the extra coverage **operational risk mitigation**, not "defensive prophylaxis."

Axes 1a, 2, and 3 are locked by research evidence (mandatory sites, no CLI-flag alternative, chained-line placement rule). The live decisions are Axis 1b (coverage scope), Axis 4 (regression-guard scope, coupled to 1b), and Axis 5 (where the guard lives). The empirical update collapses Axis 1b heavily toward C.

**Research:** `tasks/research-codebase.md`

## Options Considered

### Option A — Hotfix as scoped (Issue #2 status quo)

**Axis combination:**
- Axis 1a = locked (7 backgrounded sites)
- Axis 1b = **B** (two `claude -p` sites in `auto-issues.md` Phases 4–5 only)
- Axis 2 = A (per-call-site `</dev/null`)
- Axis 3 = A (attach to simple command, not chain front)
- Axis 4 = **A** (marker-aware backgrounded-only regression guard)
- Axis 5 = **A** (standalone script in `.claude/scripts/`)

**Coupling check:** Axis 1b=B keeps the asymmetry, so Axis 4=A is required to avoid false positives on the 10 untouched call sites. Coupling respected.

**How it works:** Edit the 9 sites Issue #2 already enumerates. Add a marker-aware guard script (`.claude/scripts/lint-stdin-discipline.sh`) that detects `Run with run_in_background` adjacent to a `codex exec` or `claude -p` snippet and requires `</dev/null` on the call. The other 10 long-running sites stay untouched.

**Pros:**
- Matches Issue #2 scope exactly — reviewable in isolation, no scope creep argument.
- Smallest PR (~9 site edits + 1 script).

**Cons:**
- **Falsified by 2026-05-02 finding.** Relies on the assumption that foreground sites are safe; that assumption is wrong. The 10 untouched sites can still hang whenever the harness backgrounds them.
- Marker-aware guard couples to the marker text "Run with `run_in_background`"; if marker phrasing drifts or the harness's auto-background decision diverges from the marker, the guard misses sites.
- Two-tier mental model (backgrounded gets the redirect, foreground doesn't) is harder to teach than a uniform rule and no longer reflects runtime behavior.

### Option B — Uniform coverage (chosen, hybrid with Codex's refinement)

**Axis combination:**
- Axis 1a = locked (7 backgrounded sites)
- Axis 1b = **C** (all ~10 additional long-running sites: `research-codebase.md:43`, `design.md:87/137/195`, `create-plan.md:55`, `issue-research.md:43`, `issue-plan.md:61`, `codex-review.md:58`, `implement.md:39`, `issue-implement.md:46`)
- Axis 2 = A (per-call-site `</dev/null`)
- Axis 3 = A (attach to simple command, not chain front)
- Axis 4 = **B** (marker-free guard: any long-running `codex exec` / `claude -p` requires `</dev/null`)
- Axis 5 = **A** (standalone script in `.claude/scripts/`)

**Coupling check:** Axis 1b=C makes uniform `</dev/null` the rule; Axis 4=B follows naturally — guard inspects executable shell across `.claude/commands/*.md` and requires `</dev/null` on every long-running invocation, no marker context needed. Coupling respected and simplified.

**How it works:** Apply `</dev/null` to all 19 sites (7 mandatory + 12 covered). Guard is a standalone script that walks `.claude/commands/*.md`, parses fenced ```` ```bash ```` blocks (Codex's refinement — avoids matching prose mentions like `auto-issues.md:139`), looks for `codex .*exec` or `claude -p` invocations, and asserts `</dev/null` is present on the same simple command (handles `&& claude -p ...` chains too). Failures must report file:line and the matched snippet so an intentional exception is reviewable.

**Pros:**
- One rule, runtime-correct: every long-running `codex exec` / `claude -p` gets `</dev/null`, regardless of which mode the harness picks.
- Eliminates the asymmetry that the 2026-05-02 finding falsified.
- Future-proofs Task 10 — when sites flip to explicit backgrounded mode, no further `</dev/null` work needed.
- Mechanically simpler regression guard once anchored to bash fences (no marker dependency, no prose allow-list).
- Teachable rule for new contributors.

**Cons:**
- ~10 additional edits beyond Issue #2's scope; reviewers may flag scope creep ("hotfix bundled with broader coverage"). Mitigation: the 2026-05-02 finding makes those edits hotfix material too — frame the PR description to lead with the empirical update.
- Marker-free guard would reject a future intentionally stdin-coupled `codex exec` / `claude -p` snippet. Acceptable since command-spec invocations are non-interactive by design, but the guard must fail with a clear message so any intentional exception is explicitly reviewed.
- Task 11 (rewrites of `auto-issues.md` / `issue-implement.md`) could drop the discipline if the lint isn't re-run; mitigation is the lint script itself plus mentioning it in those tasks' acceptance criteria.

### Option C — Minimal hotfix + documentation only

**Axis combination:**
- Axis 1a = locked (7 backgrounded sites)
- Axis 1b = **A** (none — drop the 2 covered edits in `auto-issues.md` that Issue #2 currently includes)
- Axis 2 = A (per-call-site `</dev/null`)
- Axis 3 = A (attach to simple command, not chain front)
- Axis 4 = **A** (marker-aware backgrounded-only guard, doc only)
- Axis 5 = **B** (documentation note, no automated guard)

**How it works:** Touch only the 7 backgrounded sites. Add a short note to `tasks/errors.md` describing the `</dev/null` rule. No regression-guard script.

**Pros:**
- Absolute minimum diff — 7 edits, no new files.

**Cons:**
- Falsified by the same 2026-05-02 finding as Option A — leaves the 12 unprotected sites that the harness can still hang.
- Drops the 2 covered `claude -p` edits Issue #2 already wrote, contradicting the issue's existing scope.
- No automated regression guard means the next backgrounded site silently regresses until it hangs in production.
- Documentation-only enforcement has the worst track record for sustained discipline.

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)

*(All resolved.)*

- ~~**Axis 1b decision** — A, B, or C?~~ **Resolved: C.** The 2026-05-02 empirical finding falsifies the "foreground is safe" premise that A and B rely on. Uniform coverage is the only runtime-correct choice.
- ~~**Axis 5 decision** — script (A), documentation (B), or pre-commit hook (C)?~~ **Resolved: A.** Standalone bash script matches existing convention (`.claude/scripts/codex-output-check.sh`, `.claude/scripts/pipeline-eval.sh`). Documentation alone is too weak; pre-commit adds infra the repo doesn't currently use.

### Non-blocking (can resolve during implementation)

- [ ] Issue body wording: change "open pipe with no writer" to "writer-side fd held open by the harness" (POSIX-accurate) and broaden trigger framing from `run_in_background:true` to "long-running calls the harness may auto-background." Cosmetic but worth doing while the issue is being touched.
- [ ] `/codex-review` doesn't call `codex-output-check.sh` (reads output directly per `codex-review.md:66-68`). Tangential to Issue #2; flag if a follow-up tightens the Codex-call pattern uniformly.
- [ ] Run `codex exec --help | rg -i stdin` once during implementation as a final check for an undocumented stdin-suppress flag. **Spot-check this session:** local `codex exec --help` shows only `stdin is appended as a <stdin> block` documentation — no flag. Resolution preview: Axis 2=C remains dead.

## What We're NOT Doing

- **No centralized wrapper** (Axis 2=B). Issue #2 explicitly defers this; per-call-site is the lowest-blast-radius option for now.
- **No CLI-flag alternative** (Axis 2=C). Confirmed via local `codex exec --help` and Claude CLI docs that no `--no-stdin` flag exists.
- **No edits to `CLAUDE.md`'s top half or QRSPI rules.** Hotfix scope is `.claude/commands/*.md` and `.claude/scripts/`.
- **No marker-text changes.** `Run with run_in_background` and `Timeout: 600000ms` markers stay verbatim.
- **No bundling Task 10 mode flips into this PR.** Task 10 remains separate work — uniform `</dev/null` coverage is what makes Task 10 a clean mode flip later.
- **No pre-commit hook.** The standalone script matches existing convention; pre-commit infra would be a new pattern.

## Decision

**Chosen approach:** Option B — uniform `</dev/null` coverage with marker-free, bash-fence-anchored regression guard.

**Rationale:**
1. **Runtime correctness** trumps spec-level intent. The 2026-05-02 finding (and the user's report of harness non-determinism) falsifies the foreground-safe premise. Only a uniform rule survives the harness's auto-background behavior.
2. **Simplicity heuristic favors it.** One rule for all long-running CLI invocations is simpler to teach, audit, and lint than the marker-aware two-tier model in Options A and C — even though it touches more files.
3. **Codebase-pattern heuristic favors a standalone bash script** at `.claude/scripts/lint-stdin-discipline.sh` (matches `codex-output-check.sh`, `pipeline-eval.sh`).
4. **Codex's cross-check materially refined the guard** from raw text grep (which would need a prose allow-list) to bash-fence-aware parsing — keeps Axis 4=B clean without an allow-list maintenance surface.
5. **Reversibility is preserved** — the redirect is a single token per site; removing it is trivial if the harness ever closes the writer fd. The guard script is a single file; deletion reverts the discipline.

The trade-off is PR scope (~19 sites vs. ~9). The 2026-05-02 update reframes the extra 10 from "defensive coverage" to "operational hotfix material that the original scoping missed because the foreground-safe assumption was wrong." Lead with that framing in the PR description and the scope-creep concern dissolves.
