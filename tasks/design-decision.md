# Design: `/codex-research` skill — general-purpose Codex research/grounding (Task 20)

## Context

Build the **third** skill in the Codex trio (`/codex-review` = merit, `/codex-audit` = fidelity, `/codex-research` = grounding/second opinion) at `.claude/skills/codex-research/SKILL.md`. It is a general-purpose research/grounding command that routes per-request across three modes (codebase grounding / misc-generative / external prior-art), is **both auto-invoked and manually invocable**, runs Codex in the **background**, and — unlike its siblings — produces a **kept research document** (only the prompt tmp is cleaned).

Research established that most of the build is mechanical convention-matching against the two siblings, with two genuine novelties: (1) **auto-invocability + frequency control** (Axis 1, *zero repo precedent*), and (2) the **kept-output lifecycle inversion** (clean the prompt tmp, keep the doc). Axes 2, 3, 5, and 6 are effectively pinned by constraints; the options below therefore differ primarily on **Axis 1** (how much throttle machinery) and its coupling to **Axis 2** (state reconciliation on async completion).

**Research:** `tasks/research-codebase.md`

### Constraints held constant across all options (constraint-pinned axes)

These are not in tension between options — they are inherited from research as given:

- **Axis 2 → (a) yield-and-resume.** The proven sibling pattern: background the Codex Bash call (`run_in_background: true`), the turn yields, a completion `<task-notification>` re-invokes, then validate/read/write-doc/surface. This already satisfies AC4. "Keeps working" (continuing main-task work during the wait) is an optional ergonomic, never required. Monitor/poll rejected as overkill.
- **Axis 3 → per-mode `--search`, read-only always.** `codex -a never exec --sandbox read-only -o <doc> …` for codebase/misc; add top-level **`--search`** only when the routed mode is external. `-o` writes succeed under read-only. Always-on `--search` is rejected (violates "external is discretionary"). `model_reasoning_effort=xhigh` recommended (matches `/research-codebase`; research is a deep task).
- **Axis 4 → spec slug, kept doc.** Write directly to `tasks/logs/research/<YYYY-MM-DD>-<slug>.md` via `-o` (**never** to a `.tmp` — this structurally defuses the cleanup-asymmetry footgun: there is no output tmp to accidentally delete). `mkdir -p tasks/logs/research` first (dir doesn't exist yet). Slug is topic-based for manual invocation, OQ-based (`-oq-<short>`) when auto-fired (Axis 1→4 coupling). For auto-fired OQ docs, an existing same-day `-oq-<slug>.md` is **reused** (the dedup — see Option B), not overwritten; for a genuinely distinct manual run that collides on date+slug, append a short numeric suffix. **Validate every run with `codex-output-check.sh` before trusting/surfacing the doc** — direct `-o` avoids the cleanup footgun but a failed Codex run can leave a partial doc, so on validation failure report the path as failed/partial and never offer it for promotion *(Codex RISK)*.
- **Axis 5 → human-gated promotion.** Default doc stays local/uncommitted under gitignored `tasks/logs/research/`. When the doc becomes a cited evidence/reference trail for a design/impl/docs decision, **offer** to promote (copy) it into a committed location — the relevant component's `docs/` if one is obvious from the topic, else `docs/research/`. Never promote without developer confirmation.
- **Axis 6 → one flexible composed prompt.** A single prompt that *describes* the three modes as ideas Claude routes among (mirroring `/codex-audit`'s "compose lenses, never present a menu" philosophy) — **no fixed mode menu** (AC2). Reuse `research-guide.md`'s report-shape structure loosely, but **do not** import `/research-codebase`'s RDPI prerequisite-artifact gating or sub-agent fan-out (recursion guard, `CLAUDE.md:178`). The doc carries a small **metadata header** — `trigger: manual|auto`, `route: codebase|misc|external`, `search: yes|no`, the question, slug, date, relevant paths — which makes reuse, dedup-by-slug, and promotion safer with no added state machinery *(Codex enhancement)*.
- **Frontmatter / additivity.** Omit `disable-model-invocation` (auto-invocable), with an in-body note that the omission is a deliberate exception. Because omitting that flag *is* the auto-fire mechanism, the **`when_to_use` frontmatter must itself be narrow** — with no count/cap backstop it carries the *entire* frequency bound (the sharp weighty-OQ threshold; see Option B), not just the body *(Codex RISK)*. `argument-hint: '[topic or question]'`. Add exactly one managed-list line to `/playbook-update` (after the `.claude/skills/codex-audit/SKILL.md` line, `SKILL.md:32`); add README + quickref trio rows (recommended for trio consistency, Task-19 precedent). `/codex-review`, `/codex-audit`, `deep-research`, `/research-codebase` stay byte-for-byte unchanged (AC9).

## Options Considered

The three options share every constraint-pinned axis above and differ only on **Axis 1 (auto-fire frequency control)** and the resulting **Axis 2 reconciliation** burden.

### Option A — Pure prose judgment (Axis 1a)

**Axis choices:** 1(a) · 2(a) · 3(per-mode) · 4(spec slug) · 5(human-gated) · 6(one prompt).

The skill carries **no dedup, no cap, no state**. The auto-fire rule is a prose threshold only: "fire the Codex second opinion *only* before a weighty open question / hard judgment call / blocker — never on minor hesitation." Stale-async is handled by a prose instruction: on completion, if the triggering OQ already self-resolved or the developer moved on, fold the finding in quietly or drop it rather than interrupt. Slug follows the coupling (OQ-based when auto-fired).

- **Good:** Simplest possible — fewest moving parts, zero new mechanism, perfectly matches the "skills are stateless prose" reality (no precedent is invented). Most reversible. Axis 2 needs no state reconciliation at all.
- **Not good:** With no dedup, a recurring OQ that resurfaces across turns gets re-researched into near-duplicate docs (wasteful, and clutters `tasks/logs/research/`). The kept-doc dedup in Option B closes exactly this gap at no real cost — which is the only thing separating A from the chosen B.

### Option B — Sharp threshold + kept-doc dedup (Axis 1b, no cap, no marker file) — *recommended (chosen)*

**Axis choices:** 1(b) — sharp threshold + kept-doc dedup, **no cap** · 2(a) · 3(per-mode) · 4(spec slug) · 5(human-gated) · 6(one prompt).

The frequency bound is **qualitative, not quantitative** — it governs *how* the skill is allowed to auto-fire, not *how many* times. There is **no count and no cap**. Two rules:

- **(threshold — the bound)** Auto-fire only when the OQ is **progress-blocking** *and* materially changes architecture / API / data model / security / user-visible behavior, **or** it's a hard judgment call with **no repo precedent**. **Never** auto-fire for preferences, permissions, product intent, or trivial uncertainty. This lives in a deliberately narrow `when_to_use` (since omitting `disable-model-invocation` *is* the trigger). A sharp threshold **auto-scales** with the task: a research-heavy task fires more *because it surfaces more weighty OQs* — correct behavior, not overshoot.
- **(dedup — hygiene, not a throttle)** Before auto-firing on an OQ, derive its slug; if `tasks/logs/research/<YYYY-MM-DD>-oq-<slug>.md` already exists, **reuse that doc** instead of regenerating a near-identical one. This keys on OQ *identity*, not a running total, so it doesn't cap how many distinct weighty OQs get researched. The kept doc is a durable, file-backed signal that survives compaction — *without* inventing a session-state format (the deliverable doubles as the dedup ledger). It also covers the stale-async case (a second fire landing on an OQ already in flight) *(Codex enhancement)*.

On async completion, Claude **re-checks whether the blocker is still relevant** before surfacing (context may have compacted or the OQ self-resolved while Codex ran) — fold the finding in quietly or drop it rather than interrupt with a now-stale answer.

- **Good:** Bounds noise *at the source* (a narrow threshold) rather than with an arbitrary counter, while respecting stateless-prose reality (no invented file mechanism, no lifecycle/reset problem). The threshold auto-scales to the task; the kept-doc dedup is durable across compaction yet costs nothing extra — it reuses the deliverable. Simplest mechanism that actually addresses the overshoot risk.
- **Not good:** Bound quality rests entirely on the threshold being genuinely narrow — a sloppy `when_to_use` would let noise through with no count backstop. Mitigated by the explicit exclusion list (preferences / permissions / product intent / trivial uncertainty); accepted because Codex is cheap relative to Claude, so the occasional extra firing costs little.

### Option C — File-marker-backed throttle (Axis 1d)

**Axis choices:** 1(d) · 2(a) + state reconciliation · 3(per-mode) · 4(spec slug + marker) · 5(human-gated) · 6(one prompt).

Same throttle policy as B, but the dedup/cap state is persisted to a *dedicated* marker file under `tasks/logs/research/` (e.g. a small per-session ledger of fired OQ slugs + a count). The skill reads the marker before auto-firing and writes it after; on async completion (Axis 1→2 coupling) it reconciles against the marker.

- **Good:** Most robust count — survives compaction and turn boundaries deterministically.
- **Note (Codex CORRECTION):** A marker can record fired slugs/counts but **cannot by itself know an OQ self-resolved** — that needs a richer state-update protocol the marker doesn't provide. So C's robustness advantage is narrower than it first appears, and Option B's kept-doc dedup already captures the durable part (per-OQ dedup) with zero extra machinery.
- **Not good:** Introduces **session state with no precedent anywhere in the repo** — the single biggest departure from convention, against decision heuristic #1. "Session" has no defined boundary for a stateless prose skill: there is no session-end hook to clear the marker, so a **stale marker from a prior session would wrongly suppress firing** in a new one (a worse failure than over-firing). Most moving parts, most error-prone, least reversible. Adds read/write/reconcile steps and a marker-file format to maintain.

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)
- [x] **Axis 1 — frequency-control policy.** **Resolved → Option B** (sharp `when_to_use` threshold + kept-doc dedup; **no count, no cap, no marker file**). The bound is qualitative — *how* it may fire, not *how many* times. A numeric cap was considered (Codex proposed ~3/session) and **rejected**: see Decision § "Why no numeric cap."

### Non-blocking (can resolve during implementation)
- [x] `model_reasoning_effort=xhigh` — **yes** (research lane uses it at `research-codebase/SKILL.md:64`; this is research, not a lightweight review). Codex concurred.
- [ ] Final wording of the OQ-based vs topic-based slug rule and the same-day collision suffix.
- [ ] Promotion default-location precedence (component `docs/` detection vs `docs/research/` fallback) — prose heuristic.

## What We're NOT Doing

- Not modifying `/codex-review`, `/codex-audit`, `deep-research`, or `/research-codebase` (AC9) — purely additive beyond one `/playbook-update` managed-list line and README/quickref rows.
- Not importing `/research-codebase`'s RDPI gating or sub-agent fan-out.
- Not making `--search` always-on; not using a non-read-only sandbox.
- Not adding the kept research doc to any `/finish`/cleanup deletion list.
- Not building a Monitor/poll-based handoff (Axis 2 c/d rejected).
- Not auto-promoting/committing research docs without developer confirmation.
- Not building a dedicated marker/ledger file for throttle state (Option C rejected) — the kept doc is the dedup signal.
- **Not capping auto-fires by count** — the bound is the qualitative threshold (*how*), not a numeric limit (*how many*). A fixed N is both too strict (blocks legitimate research-heavy tasks) and too loose (allows trivial firings); Codex is cheap relative to Claude, so firing count is not the cost lever.

## Decision

**Chosen approach:** Option B — a **sharp qualitative threshold** (the frequency bound) + **kept-doc dedup** (hygiene). No count, no cap, no marker file. (Hybrid: Option B's dedup + a doc metadata header, both from Codex; the soft cap Codex proposed was considered and **dropped** — see "Why no numeric cap.")

**Rationale:** Option B wins on all three decision heuristics. **(1) Codebase patterns:** zero new mechanism — Axes 2/3/4/5/6 reuse the sibling Codex plumbing verbatim, and frequency control stays prose-judgment (the only stateless-prose-compatible choice), respecting the research finding that the repo has no session-state precedent. **(2) Simplicity:** the bound is a narrow `when_to_use` threshold, and the kept-doc dedup reuses the deliverable as its ledger — durable, compaction-surviving per-OQ dedup with no extra file, no format to maintain, and no reset-lifecycle problem. That unlock is exactly what makes Option C (a dedicated marker) unnecessary: C carries more machinery for a robustness edge that, per Codex's correction, it can't actually deliver (a marker can't detect self-resolution on its own). **(3) Reversibility:** the threshold is prose — tunable by editing the SKILL.md, no migration. Option A is the same approach minus dedup, so it re-researches recurring OQs into duplicate docs; Option C over-engineered against a non-existent precedent.

**Why no numeric cap.** Codex (and an earlier draft of this artifact) proposed a soft cap of ~3 auto-fires/session. It was dropped because a count bounds the *wrong axis*: it is simultaneously **too strict** (it kills the legitimate 4th/5th firing on a research-heavy task, exactly when grounding is most valuable) and **too loose** (it waves through 3 *trivial* firings). Since Codex is cheap relative to Claude and runs in the background, firing count was never the real cost lever. The correct bound is *qualitative* — a narrow threshold that **auto-scales** with the task (a research-heavy task fires more because it surfaces more weighty OQs, which is correct, not overshoot). Dropping the cap also deletes its residual weakness (a count that drifts under compaction) and the undefined "what is a session" problem — a net simplification.

Codex independently designed to a threshold+dedup approach before seeing the options (no anchoring), which materially reinforced the choice, and contributed the kept-doc dedup plus a metadata header (`trigger/route/search/question/slug/date/paths`) that makes reuse, dedup-by-slug, and promotion safer. Its other risk flags are absorbed: the doc is **validated before surfacing** (a failed run is reported as partial, never promoted), and the narrow threshold lives in **`when_to_use`** since omitting `disable-model-invocation` is itself the auto-fire mechanism.
