# Research: Add a `/codex-research` skill — general-purpose Codex research (codebase + external), auto-invoked (Task 20)

## Research Question

Design a NEW playbook skill at `.claude/skills/codex-research/SKILL.md` — the **third** in the Codex trio (`/codex-review` = merit, `/codex-audit` = fidelity, `/codex-research` = grounding / second opinion). General-purpose research / grounding, whose output — unlike the other two — is a **kept research document**, not a deleted tmp. It is foundational discovery infrastructure: the `/forge` build lane (Task 21) self-summons it on demand.

### Upfront spec (four confirmed intake fields)

- **Intent.** A standalone Codex research command covering three modes Claude *routes among per request* (no fixed menu): (1) **codebase grounding** — survey what exists before acting; (2) **misc / generative** — novel approaches, "is there a better way"; (3) **external / prior-art** — how others solved a comparable problem, from any public source (OSS code, papers, official docs, standards, engineering writeups). Usable anytime, including mid-task. Output is a kept research doc.
- **Constraints.** Standalone (no RDPI prereqs; reads no RDPI artifacts; not pre-edit-gated — it edits no source). Both **auto-invoked** and manually invocable. Auto-invocation is an **intentional exception** to the playbook convention that workflow skills set `disable-model-invocation: true` (advisory / read-only-on-code). Auto-fire trigger: whenever Claude is about to **stop and ask the developer** (open question / hard judgment call / blocker) — run the Codex second opinion *first*, then surface with grounding or resolution. Run mode: **background / non-blocking** (`run_in_background: true`). Output is **kept, never auto-deleted**, at `tasks/logs/research/<YYYY-MM-DD>-<slug>.md` (under gitignored `tasks/logs/`); a **human-gated promotion path** extracts it into a committed Claude-chosen location only on developer confirmation. External mode is **broad but Claude-discretionary** — not always-on, not flag-required; it needs `--search`; codebase/misc modes stay codebase-grounded. No fixed mode menu.
- **Acceptance criteria.** (1) Skill exists, auto-invocable (no `disable-model-invocation`), with an in-skill note that the auto-invoke is a deliberate exception. (2) Documents the three modes; routes per request; external is discretionary. (3) Auto-fire wired to "about to ask the developer" moments. (4) Codex call runs in background. (5) Output kept at `tasks/logs/research/<date>-<slug>.md`, never auto-deleted. (6) Human-gated promotion path. (7) External mode runs `--search`; codebase/misc stay grounded. (8) `/playbook-update`'s managed-file list accounts for the new skill. (9) `/codex-review`, `deep-research`, `/research-codebase` unchanged.
- **Relevant paths.** New skill `.claude/skills/codex-research/SKILL.md`; reference conventions `.claude/skills/codex-review/SKILL.md`, `.claude/skills/codex-audit/SKILL.md`, `.claude/scripts/codex-output-check.sh`; storage `tasks/logs/research/` (new, under gitignored `tasks/logs/`); stay distinct from `deep-research` + `.claude/skills/research-codebase/SKILL.md`; `/playbook-update` managed list at `.claude/skills/playbook-update/SKILL.md`.

## Summary

The skill is a **blend of its two siblings**: take `/codex-review`'s auto-invocable advisory shape + Codex plumbing (target resolution, safe tmp-compose, `codex -a never exec --sandbox read-only -o … </dev/null`, output-check, "confidence is not evidence" caveat), and take `/codex-audit`'s gitignored `tasks/logs/<subdir>/` storage discipline — but **invert the output lifecycle**: the research doc is *kept*, only the prompt tmp is cleaned. Most of the build is mechanical convention-matching against established precedent.

Three findings reshape the open questions:

1. **The "background / non-blocking" requirement is already a solved pattern, not a new capability.** Codex framed existing `run_in_background` usage as "same-invocation wait/read" with no async-handoff precedent — that's imprecise. The harness backgrounds the Bash call, the turn yields, and the read happens in a **later** invocation triggered by a completion `<task-notification>` (directly observed in this very research session, and the official docs confirm `run_in_background` lets Claude "continue working while it runs"). The siblings already rely on this. So Axis 2's "true fire-and-continue" is viable and proven; the only genuinely new behavior is whether Claude does *other main-task work* during the wait (the "keeps working" aspiration) vs. simply yielding — a prompt/behavior choice, not a missing mechanism.

2. **Frequency control has zero precedent to inherit.** Playbook skills are stateless prose — there is no session-scoped state, cap, or debounce anywhere in the repo. The auto-fire throttle (the spec's #1 open question) must be invented from scratch: either prose-judgment-only ("fire only on weighty OQs"), or a lightweight file marker under `tasks/logs/`.

3. **The spec's storage analogy points at a convention that doesn't exist yet.** The spec says `tasks/logs/research/` "mirrors the `tasks/logs/checkpoints/` convention (tasks 17/18)." But tasks 17/18 are unbuilt — `tasks/logs/checkpoints/` exists only in `todo.md`. The current `/checkpoint` stores a single git-committed `tasks/checkpoint.md`. The **real existing precedent** for a `tasks/logs/<subdir>/` store is `tasks/logs/audits/` from `/codex-audit` (Task 19, done) — that is the template to mirror, with the lifecycle inverted (keep, don't delete).

## Detailed Findings

### The Codex trio — how it runs today

`/codex-review` (`.claude/skills/codex-review/SKILL.md`) — one-shot merit pass. **Target resolution** (lines 12–17): explicit `$ARGUMENTS` reviewed unchanged; if empty, infer from conversation, ask one clarifying question only if ambiguous. **Flow:** pre-delete stale temps → compose prompt into `tasks/codex-review-prompt.tmp` (safe tmp-compose dodges shell-quoting on quotes/backticks/newlines, line 33) → run Codex read-only in background (lines 69–73) → `codex-output-check.sh … 5` → read fully → spot-check cited file:line → **delete both temps before presenting** (lines 86–92, cleanup-before-present is load-bearing because Step 6 ends in an interactive offer) → present + opt-in recommend-only triage. **It is the sole skill without `disable-model-invocation: true`** — the only currently auto-invocable skill, and the precedent for AC1's "intentional exception."

`/codex-audit` (`.claude/skills/codex-audit/SKILL.md`) — source-fidelity pass, most recent sibling. Adds: a **unique per-run token** threaded verbatim into every temp path (lines 36–48; uniqueness is load-bearing because pre-delete/cleanup match `<run>-*.tmp`), temps under **gitignored `tasks/logs/audits/`**, Claude-injected source block (sources are never a CLI arg, line 30), optional multi-pass `review → triage → apply` loop with an editable-target guard. Same background-Codex pattern (line 109), same validate/read/spot-check/clean-before-present ordering.

`/research-codebase` (`.claude/skills/research-codebase/SKILL.md`) — the RDPI Phase-1 lane (distinct, must stay unchanged). Useful only as a *shape* reference for a research report and for `--search` usage (`codex -c model_reasoning_effort=xhigh --search -a never exec …`). Do **not** copy it wholesale — it carries RDPI prerequisite-artifact gating and sub-agent fan-out that `/codex-research` must not inherit.

### The `run_in_background` reality (the crux of Axis 2)

The official Claude Code tools reference states: `run_in_background: true` lets Claude "start the command as a background task and **continue working while it runs**" (`/tasks` lists/stops them). The completion path observed first-hand this session: the backgrounded Bash returns a task ID immediately; the turn yields; when the command exits, the harness emits a `<task-notification … status=completed>` that re-invokes the agent, which then validates and reads the output file. `TaskOutput` is deprecated in favor of `Read` on the output file path. The `Monitor` tool exists for line-by-line reaction but is overkill for a one-shot research doc — completion-notification fits better. **Net:** the siblings already operate via later-invocation reads on completion; `/codex-research` reuses the identical mechanism. AC4 is satisfied by backgrounding the Codex Bash call exactly as the siblings do.

### Frontmatter convention

Every skill shares YAML frontmatter: `name`, `description`, optional `argument-hint`, optional `when_to_use`, optional `disable-model-invocation: true`. Auto-invocable shape = **omit** `disable-model-invocation` (don't set it `false`), per `/codex-review`. Target for `/codex-research`:

```yaml
---
name: codex-research
description: <one-liner>
argument-hint: '[topic or question]'
when_to_use: '<advisory grounding / second-opinion triggers>'
---
```

The body must carry an explicit note that the omission is intentional (advisory / read-only-on-code) so it doesn't read as a mistake.

### `/playbook-update` managed-file list (AC8)

The managed list (`.claude/skills/playbook-update/SKILL.md:15`, paths at ~23–51) is **hard-enumerated, one path per line**, with an explicit "never expand globs, never substitute" rule (line 221). AC8 therefore requires literally adding `.claude/skills/codex-research/SKILL.md` to the list — next to the `codex-review`/`codex-audit` lines (31–32). A single new SKILL.md (the siblings inline their Codex prompt — no separate prompt file needed), so exactly one new managed-list line.

### Completeness item beyond AC8 — README / quickref rows

`README.md` (76–77) and `quickref.md` (49–50) carry **adjacent rows for `/codex-review` and `/codex-audit`**, and `/codex-audit`'s own completion note records that it added README/quickref rows. AC8 names only the `/playbook-update` list, but trio consistency + the Task-19 precedent strongly imply `/codex-research` should get a third row in both. Not in the explicit ACs — flag for design to confirm (recommended).

## Code References

- `.claude/skills/codex-review/SKILL.md:12-17` — target resolution (explicit vs inferred); reuse verbatim.
- `.claude/skills/codex-review/SKILL.md:33` — safe tmp-compose convention.
- `.claude/skills/codex-review/SKILL.md:69-73` — Codex invocation form (`-a never exec --sandbox read-only -o … </dev/null`).
- `.claude/skills/codex-review/SKILL.md:84` — "Codex's confidence is not evidence" caveat; carry into the new skill.
- `.claude/skills/codex-review/SKILL.md` frontmatter — sole skill without `disable-model-invocation`.
- `.claude/skills/codex-audit/SKILL.md:36-48` — gitignored `tasks/logs/audits/` + unique run-token mechanic (storage template).
- `.claude/skills/codex-audit/SKILL.md:106-121` — background Codex then validate/read/spot-check.
- `.claude/skills/research-codebase/SKILL.md:64` — `--search` + `model_reasoning_effort=xhigh` usage (reference only; do not import RDPI gating).
- `.claude/skills/playbook-update/SKILL.md:15,23-51,221` — enumerated managed list; "never expand globs."
- `.claude/skills/checkpoint/SKILL.md:10` — current checkpoint stores `tasks/checkpoint.md` (NOT `tasks/logs/checkpoints/`).
- `.claude/scripts/codex-output-check.sh:1-22` — validator contract `<path> [min-lines=5]`.
- `.gitignore:6` — `tasks/logs/` is gitignored.
- `CLAUDE.md` Pre-Edit Gate / `:178` recursion guard — new skill writes only a local doc (outside the gate) and must not spawn sub-agents.
- `README.md:76-77`, `quickref.md:49-50` — trio registration rows.

## Architecture Analysis

The playbook treats Codex as an interchangeable second-opinion engine behind a thin prose skill. The trio differs only in **prompt** (merit vs fidelity vs research) and **output lifecycle** (review/audit delete; research keeps). All three share: safe tmp-compose, `-a never` + `--sandbox read-only`, `codex-output-check.sh`, spot-check-then-trust, recursion guard. `/codex-research`'s only structural novelty vs the siblings is (a) **auto-invocability** (shared only with `/codex-review`) and (b) the **kept output doc** — which flips the cleanup discipline: clean the *prompt* tmp, **keep** the output doc. This asymmetry is the single most error-prone spot in the build (a copy-pasted cleanup line from a sibling would delete the deliverable).

## Design Axes

### Axis 1: Auto-fire frequency control
- **Choices:** (a) prose-judgment threshold only — fire only before *weighty* OQs / hard judgment calls / blockers, no state; (b) + debounce on the same OQ/topic (by slug or target path); (c) + a per-session cap (max N auto-fires) with manual fallback after the cap; (d) file-marker-backed debounce/cap under `tasks/logs/`.
- **Per-axis constraints:** must not fire on every minor hesitation; skills are stateless prose, so any (b)/(c) state needs a carrier (prose memory within a turn, or a file). Keep it cheap — this is advisory tooling.
- **Evidence:** No session-debounce/cap precedent exists anywhere in the repo (grep found none); implementation skills have only local retry caps; the checkpoint/session ideas in `tasks/todo.md` (17/18) are unbuilt. So there is nothing to reuse — design invents the policy.

### Axis 2: Background execution & handoff
- **Choices:** (a) background-then-read within the skill's natural yield/resume (the proven sibling pattern — turn yields, completion notification re-invokes, then read/write-doc/surface); (b) "keeps working" — Claude continues the *main task* while Codex runs, folding findings into a later turn; (c) Monitor-backed reaction (rejected — overkill for one-shot); (d) fire-and-poll.
- **Per-axis constraints:** AC4 (background, non-blocking) is satisfied by (a) already. The auto-fire intent ("second opinion *before* bothering the human") only requires that surfacing happens *after* Codex returns, not that Claude busy-works meanwhile. Must handle the stale case: OQ self-resolved or developer moved on before Codex returns.
- **Evidence:** Official docs — `run_in_background` "continue working while it runs"; first-hand `<task-notification status=completed>` re-invocation this session; siblings at `codex-review/SKILL.md:69-73` + `codex-audit/SKILL.md:106-121` already depend on completion-triggered later reads.

### Axis 3: `--search` & sandbox per mode
- **Choices:** codebase/misc → `codex -a never exec --sandbox read-only -o <doc> …` (no `--search`); external → add top-level **`--search`** (independent of sandbox — read-only filesystem still searches the web). Reject always-on `--search` (violates the "not always-on" constraint). No `workspace-write` needed — `-o` writes the output file fine under `--sandbox read-only`.
- **Per-axis constraints:** sandbox stays `read-only` in all modes; `--search` toggles strictly by mode; `-a never` always.
- **Evidence:** OpenAI Codex CLI docs (sandbox modes + web-search config); local `codex 0.137.0 --help` confirms top-level `--search` ("Enable live web search"); repo precedent — research skills use `--search`, advisory skills use read-only + `-o`. (See External Research.)

### Axis 4: Output storage & slug
- **Choices:** (a) exact spec `tasks/logs/research/YYYY-MM-DD-<descriptive-slug>.md`; (b) + a short collision token (audit-style) when same-day same-slug collisions are plausible; (c) OQ-marked slug for auto-fired docs (e.g. `YYYY-MM-DD-oq-<short>.md`); (d) add time only if date+slug collisions are judged real.
- **Per-axis constraints:** output doc is **kept, never auto-deleted**; only the prompt tmp is cleaned; filesystem-safe slug; scannable. Mirror `tasks/logs/audits/` *storage* discipline (gitignored subdir) but **invert** the cleanup (keep the doc). `mkdir -p tasks/logs/research` before writing (the dir does not exist yet).
- **Evidence:** `codex-audit/SKILL.md:36-48` (gitignored subdir + run-token); `.gitignore:6` (`tasks/logs/` gitignored); spec default at `todo.md:406`.

### Axis 5: Promotion path
- **Choices:** trigger = the research becomes a reference/evidence trail for a design/impl/docs decision → offer to promote; default committed location = the relevant component's `docs/` when one is obvious, else a fallback (`docs/research/` or another Claude-chosen committed path). Never promote without developer confirmation.
- **Per-axis constraints:** human-gated (AC6); default doc stays local/uncommitted; promotion is the *exception*, not the default; promotion is the only path by which a research doc gets committed.
- **Evidence:** spec at `todo.md:407-408` (supersedes the "scatter docs into component folders by default" idea — default = local logs, component-`docs/` is the promotion case).

### Axis 6: Mode routing & prompt shape
- **Choices:** (a) one flexible composed prompt that lets Claude route across the three modes; (b) Claude-selected mode-specific prompt fragments; (c) reuse `research-guide.md`'s section structure (file map / behavior / axes / external / index) *without* its RDPI prerequisites.
- **Per-axis constraints:** **no fixed mode menu** (AC2) — the prompt may *describe* the modes as ideas, never "pick a mode"; external is reached for at Claude's discretion; mirror `/codex-audit`'s "Claude composes lenses, never presents a menu" philosophy.
- **Evidence:** `codex-audit/SKILL.md:95` (lens-composition philosophy); `research-guide.md` (report-shape reference); spec at `todo.md:410`.

## Axis Coupling

- **Axis 6 → Axis 3.** If routed mode = external → the Codex invocation includes `--search`; if codebase/misc only → no `--search`. The mode decision *is* the flag decision. (Reason: external prior-art needs web; codebase grounding doesn't. Evidence: `todo.md:409`, `codex-review`/`research-codebase` invocation forms.)
- **Axis 1 → Axis 4.** If the doc is auto-fired from an OQ → slug may be OQ-based (`-oq-<short>`); if manually invoked → topic-based slug. (Reason: auto-fired docs key naturally to the triggering OQ for scannability.)
- **Axis 1 → Axis 2.** If frequency control uses a per-session cap/debounce → the background handoff must reconcile with that state on completion (e.g., don't re-surface a result for an OQ that already self-resolved or was already answered). (Reason: async completion can land after the triggering context changed.)

## Cross-Cutting Constraints

- **Frontmatter schema** — `name` / `description` / `argument-hint: '[topic or question]'` / `when_to_use`; **omit** `disable-model-invocation` (auto-invocable) with an in-body "intentional exception" note.
- **Codex invocation form** — `codex -a never exec --sandbox read-only -o <out> "$(cat <prompt-tmp>)" </dev/null`, run with Bash `run_in_background: true`; `--search` added only in external mode; `model_reasoning_effort=xhigh` is an optional knob (research-codebase uses it; review/audit don't — design's call).
- **Output validation** — `bash .claude/scripts/codex-output-check.sh <path> [min-lines]` before reading.
- **Cleanup asymmetry** — clean the **prompt tmp** before presenting (sibling discipline); **keep** the output doc (never auto-delete; not added to `/finish`'s cleanup list).
- **Single freeform argument** — `[topic or question]`; resolved like `/codex-review` (explicit `$ARGUMENTS`, else inferred from conversation / the triggering OQ).
- **Recursion guard** — no sub-agents (`CLAUDE.md:178`).
- **Not pre-edit-gated** — writes only a local research doc; reads no RDPI artifacts.
- **Purely additive (AC9)** — `/codex-review`, `/codex-audit`, `deep-research`, `/research-codebase` byte-for-byte unchanged; only the new skill + one managed-list line (+ likely README/quickref rows).

## External Research

- **Codex CLI flags — `--search` and `--sandbox` are independent.** OpenAI Codex CLI reference documents `codex exec`, `-o/--output-last-message`, and `--sandbox read-only|workspace-write|danger-full-access` (https://developers.openai.com/codex/cli/reference#codex-exec); config reference documents sandbox + web-search config (https://developers.openai.com/codex/config-reference#configtoml). Local `codex 0.137.0 --help` confirms a top-level `--search` ("Enable live web search") and the `--sandbox` values. So a `--sandbox read-only` run can still search the web when `--search` is passed (consistent with this repo's issue #4). **Unblocks: Axis 3** (per-mode `--search`; read-only sandbox in all modes; `-o` writes succeed under read-only).
- **Claude Code background tasks.** Tools reference (https://code.claude.com/docs/en/tools-reference) — `run_in_background: true` lets Claude "start the command as a background task and continue working while it runs"; `/tasks` lists/stops them; `TaskOutput` is deprecated in favor of `Read` on the output file. Completion-notification re-invocation observed first-hand this session. `Monitor` exists for line-by-line reaction (not needed here). **Unblocks: Axis 2** (true fire-and-continue is supported; the siblings already use completion-triggered later reads).

## Risk Analysis

- **Cleanup-asymmetry footgun (highest).** Copy-pasting a sibling's "delete output tmp before present" step would delete the kept research doc — the deliverable. The skill must explicitly clean *only the prompt tmp* and keep the output doc. (Mitigation: write the doc to its final `tasks/logs/research/…md` path directly via `-o`, never to a `.tmp`, so there is no "output tmp" to accidentally delete.)
- **Frequency-control overshoot.** With no precedent and a vague "before asking the developer" trigger, auto-fire could fire on trivial hesitations and become noise. Must be bounded (threshold + debounce/cap). Genuine open design problem (Axis 1).
- **Stale async surfacing.** A backgrounded auto-fire can complete after the OQ self-resolved or the developer moved on; surfacing logic must tolerate this (drop / fold-quietly rather than interrupt with a now-irrelevant answer). Couples Axis 1 ↔ Axis 2.
- **Importing RDPI baggage.** Copying `/research-codebase` too directly would drag in prerequisite-artifact gating and sub-agent fan-out the skill must not have. Build from the siblings, not from `/research-codebase`.
- **Always-on `--search`.** Enabling `--search` unconditionally violates the "external is discretionary, not always-on" constraint and wastes web calls on codebase-only questions. Toggle strictly by mode.
- **README/quickref drift.** If the trio rows aren't updated, `/codex-research` is discoverable as a skill but absent from the human-facing index (minor; completeness, not correctness).

## Open Questions

These map to the spec's "Open questions for RDPI" — accepted-and-deferred per `todo.md:21`; resolve in Design, not preflight:

1. **Frequency-control policy (Axis 1).** Prose-judgment-only vs file-marker debounce/cap? What threshold defines a "weighty" OQ? Per-session cap value? *No repo precedent — design defines it.*
2. **"Keeps working" semantics (Axis 2).** Does Claude actively continue the main task while Codex runs, or simply yield until the completion notification? Both are harness-supported; pick the ergonomics.
3. **Slug convention (Axis 4).** Topic-based always, or OQ-based when auto-fired? Collision token yes/no?
4. **Promotion trigger + default location (Axis 5).** What precisely flips "this is now a reference trail → offer promote," and the default committed home (component `docs/` vs `docs/research/`).
5. **Prompt shape (Axis 6).** One flexible prompt vs Claude-selected fragments; how much of `research-guide.md`'s structure to reuse.
6. **`model_reasoning_effort` knob.** Set `xhigh` (like `/research-codebase`) or leave default (like review/audit)? Minor.
7. **README/quickref rows.** Confirm whether to add them (recommended for trio consistency, though beyond AC8).
