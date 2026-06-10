# Plan: `/codex-research` skill — general-purpose Codex research/grounding (Task 20)

## Design decision reference

Chosen approach: **Option B** — sharp qualitative `when_to_use` threshold (the frequency bound) + kept-doc dedup (hygiene). **No count, no cap, no marker file.** See `tasks/design-decision.md`. Research: `tasks/research-codebase.md`.

The build is mostly mechanical convention-matching against the two siblings (`/codex-review`, `/codex-audit`). The two genuine novelties: **auto-invocability + a narrow frequency threshold** (zero repo precedent) and the **kept-output lifecycle inversion** (clean the prompt tmp, keep the doc).

## Scope boundaries (what we are NOT doing)

- Not modifying `/codex-review`, `/codex-audit`, `deep-research`, or `/research-codebase` (AC9) — byte-for-byte unchanged.
- Not importing `/research-codebase`'s RDPI prerequisite-artifact gating or sub-agent fan-out (recursion guard, `CLAUDE.md:180`).
- Not making `--search` always-on; not using a non-read-only sandbox; `-a never` always.
- Not adding the kept research doc to any `/finish`/cleanup deletion list.
- Not building a Monitor/poll handoff (Axis 2 yield-and-resume only).
- Not building a marker/ledger file for throttle state (Option C rejected) — the kept doc is the dedup signal.
- Not capping auto-fires by count — the bound is the qualitative threshold (*how*), not a numeric limit (*how many*).
- Not auto-promoting/committing research docs without developer confirmation.
- Not editing `.gitignore` — `tasks/logs/` is already gitignored (`.gitignore:6`), which covers the new `tasks/logs/research/` subdir.
- Not creating `tasks/logs/research/` at author time — the skill creates it at runtime via `mkdir -p`.

## Files changed

| File | Change | Phase |
|---|---|---|
| `.claude/skills/codex-research/SKILL.md` | **NEW** — the skill (frontmatter + steps) | 1 |
| `.claude/skills/playbook-update/SKILL.md` | +1 managed-list line after `:32` | 2 |
| `README.md` | +1 trio row after `:77` | 2 |
| `quickref.md` | +1 trio row after `:50` | 2 |

No other files are touched. The skill inlines its Codex prompt (no separate prompt file), so exactly one new managed-list line.

---

## Phase 1 — Author `.claude/skills/codex-research/SKILL.md`

Create the new skill file. A half-written SKILL.md is not a working state, so the whole file is authored in one phase. Structure mirrors the siblings; the content below is the authored spec.

### 1a. Frontmatter

```yaml
---
name: codex-research
description: <one-liner — general-purpose Codex research/grounding second opinion (codebase grounding, generative "is there a better way", or external prior-art), producing a KEPT research doc>
argument-hint: '[topic or question]'
when_to_use: '<NARROW auto-fire threshold — see 1c. Only before a progress-blocking open question / hard judgment call that materially changes architecture / API / data model / security / user-visible behavior, OR a hard judgment call with no repo precedent. Never for preferences, permissions, product intent, or trivial uncertainty.>'
---
```

- **OMIT `disable-model-invocation`** (do not set it `false`) — omitting it *is* the auto-fire mechanism. This is the only skill besides `/codex-review` that omits it (`codex-review/SKILL.md` frontmatter is the precedent).
- Because there is **no count/cap backstop**, the `when_to_use` line carries the *entire* frequency bound — it must be genuinely narrow (Codex RISK from design). The body (1c) restates the same threshold.

### 1b. Title + framing paragraph (body open)

- Third in the Codex trio: `/codex-review` = merit, `/codex-audit` = fidelity, **`/codex-research` = grounding / second opinion**.
- Routes per request across three modes — **(1) codebase grounding**, **(2) misc / generative** ("is there a better way"), **(3) external / prior-art** (`--search`) — with **no fixed mode menu** (AC2). Mirror `/codex-audit`'s "compose, never present a menu" philosophy (`codex-audit/SKILL.md:95`).
- Output is a **KEPT research doc**, not a deleted tmp — this is the lifecycle inversion vs the siblings.
- In-body **intentional-exception note**: auto-invoke is deliberate (advisory / read-only-on-code), not a mistake. Reads no RDPI artifacts; not pre-edit-gated (writes only a local doc); no sub-agents (recursion guard).

### 1c. Auto-fire threshold (the frequency bound — restate in body)

- Auto-fire **only** when the OQ is **progress-blocking** *and* materially changes architecture / API / data model / security / user-visible behavior, **or** it is a hard judgment call with **no repo precedent**.
- **Never** auto-fire for preferences, permissions, product intent, or trivial uncertainty (explicit exclusion list).
- **No count, no cap** — the threshold is the bound and **auto-scales** with the task (a research-heavy task fires more *because it surfaces more weighty OQs* — correct, not overshoot).
- Manual invocation has no threshold (the developer asked).

### 1d. Question/target resolution (mirror `codex-review/SKILL.md:12-17`)

- **Explicit** `$ARGUMENTS` → use as the topic/question unchanged (no preprocessing).
- **Empty / bare / auto-fired** → infer the question from the triggering OQ / conversational context. One clarifying question only if genuinely ambiguous.

### 1e. Route the mode (per request)

- Claude picks which of the three modes fits (may blend). The route **determines `--search`**: external → `--search` on; codebase/misc → off (Axis 6→3 coupling).
- Record the chosen route + search flag for the metadata header (1k).

### 1f. Slug rules + dedup / collision pre-check (Option B hygiene)

**Slug format (load-bearing — dedup, shell-safe paths, and overwrite avoidance all depend on it; Codex RISK).** Lowercase `[a-z0-9-]` only, collapse repeated `-`, bounded length (≤ ~40 chars). **Deterministic** for auto-fired OQs — derive the same slug from the same OQ text every time, with **no random token** (a random suffix would defeat dedup).

- Compute the literal `<date>` (`date +%F`) and the slug:
  - **Manual** run → **topic-based** slug from `$ARGUMENTS`/topic.
  - **Auto-fired** run → **OQ-based** slug, filename form `<date>-oq-<short>.md`.

**The metadata header is the completion marker.** It is prepended *only after validation passes* (1k), so a `.md` that carries the header is a **valid, complete, kept** doc, while a **headerless** `.md` at the canonical path is a **partial/failed leftover** from an interrupted run. Resolve the target path by header presence (Codex RISK — failed-output poisoning + manual overwrite):

- **Target path free** → write there.
- **Exists *with* metadata header** (valid kept doc):
  - **Auto-fired, same OQ slug** → **reuse** it (read + fold its findings; skip regeneration). Dedup keys on OQ *identity*, not a running total — it does not cap distinct OQs.
  - **Manual / distinct topic** → append a numeric suffix (`-2`, `-3`, …) so the kept doc is **never overwritten** (`codex -o` would otherwise clobber an identical path).
- **Exists but *headerless*** (partial/failed leftover) → safe to **overwrite** (regenerate over it); do **not** treat as a dedup hit and do **not** suffix. This self-heals a poisoned canonical path.

Best-effort note: if a prior auto-fire is still in flight (file not yet written), a near-dup may occur — accepted; the narrow threshold is the primary bound.

### 1g. Choose the run identifier + make the dir

- **Choose the literal `<date>-<slug>` string once** and thread it **verbatim** into the prompt-tmp path, the `-o` doc path, validation, the metadata prepend, cleanup, and the dedup check. Each Bash tool call is a separate shell, so a value computed inside one call does not survive into the next — do **not** use `$$`/command substitution in the paths (same load-bearing warning as `codex-audit/SKILL.md:40`).
- `mkdir -p tasks/logs/research` (the dir does not exist yet).

### 1h. Compose the prompt safely

- Write the composed prompt body to **`tasks/logs/research/<date>-<slug>-prompt.tmp`** via the Write tool (the question may contain quotes/backticks/newlines; tmp-then-`"$(cat …)"` dodges shell-quoting — `codex-review/SKILL.md:33` convention). Gitignored dir + unique name → no stranded-commit risk and no concurrent-run collision.
- Prompt content — **one flexible composed prompt** that *describes* the three modes as ideas to route among (never "pick a mode"). Instruct Codex to produce a structured **research report** loosely mirroring `research-guide.md`'s shape (findings with citations; where relevant: options/axes, external prior-art **with source URLs**, open questions) — **without** RDPI prerequisite gating or sub-agent fan-out. Carry the **"Codex's confidence is not evidence"** caveat (`codex-review/SKILL.md:84`).

### 1i. Invoke Codex in the background

**Run with `run_in_background: true` — a Bash-tool parameter, not shell syntax. Codex phase, may take 10+ minutes.** The turn yields; a completion `<task-notification>` re-invokes for validation/read (Axis 2 yield-and-resume). Continuing other main-task work during the wait is *optional*, never required.

Codebase / misc mode (no `--search`):

```bash
codex -c model_reasoning_effort=xhigh -a never exec \
  --sandbox read-only \
  -o tasks/logs/research/<date>-<slug>.md \
  "$(cat tasks/logs/research/<date>-<slug>-prompt.tmp)" </dev/null
```

External / prior-art mode (top-level `--search` before `exec`, mirroring `research-codebase/SKILL.md:64`):

```bash
codex -c model_reasoning_effort=xhigh --search -a never exec \
  --sandbox read-only \
  -o tasks/logs/research/<date>-<slug>.md \
  "$(cat tasks/logs/research/<date>-<slug>-prompt.tmp)" </dev/null
```

- `-o` writes the `.md` directly (no output tmp — this structurally defuses the cleanup-asymmetry footgun). `-o` succeeds under `--sandbox read-only` (design Axis 3).
- On `codex` not-found / failure → `rm -f tasks/logs/research/<date>-<slug>-prompt.tmp`, then stop and tell the developer.

### 1j. On completion — validate first

- `bash .claude/scripts/codex-output-check.sh tasks/logs/research/<date>-<slug>.md 20` (min-lines 20, matching the research lane `research-codebase/SKILL.md:69`; the prepended header is added *after* this check, so 20 applies to Codex's raw report).
- **On FAIL:** report the doc path as **failed/partial**, do **not** surface it as trustworthy, **never offer promotion** (Codex RISK from design). Clean the prompt tmp, then stop/inform. Because the failed `-o` write sits at the canonical `.md` path but is **headerless** (the header is only prepended on success, 1k), the resolution rule in 1f treats it as safe-to-overwrite — a failed run cannot poison future dedup.

### 1k. Read fully + spot-check + prepend metadata header

- Read the kept doc **FULLY** (no limit/offset). Spot-check a sample of cited `file:line` / source URLs — flag any that do not hold up.
- **Prepend** the metadata header to the kept doc (Claude composes it from values it owns — deterministic):

```
---
trigger: manual | auto
route: codebase | misc | external
search: yes | no
question: <resolved question>
slug: <slug>
date: <YYYY-MM-DD>
relevant_paths: <paths, if any>
---
```

This is an edit to the skill's *own output doc* (not a source file; not pre-edit-gated). The header backs scannability, dedup-by-slug, and safe promotion (Codex enhancement).

### 1l. Clean the prompt tmp ONLY — keep the `.md` doc

```bash
rm -f tasks/logs/research/<date>-<slug>-prompt.tmp
```

- Exact path, glob-free — it can **never** match the `.md` deliverable. **KEEP** `tasks/logs/research/<date>-<slug>.md`.
- **Footgun callout in the skill body:** never delete the `.md`; do NOT add it to `/finish`'s cleanup list; it is gitignored so even a stranded prompt tmp can never be committed. This is the single most error-prone spot — a copy-pasted sibling cleanup line would delete the deliverable.

### 1m. Staleness re-check, then surface

- Before surfacing (especially when auto-fired): re-check whether the triggering blocker/OQ is **still relevant** (context may have compacted or the OQ self-resolved while Codex ran). If stale → **fold the finding in quietly or drop it**, do not interrupt with a now-stale answer (Axis 1↔2).
- Otherwise surface the grounding/resolution + the kept doc path.

### 1n. Human-gated promotion (offer, conditional)

- Default: the doc stays local/uncommitted under gitignored `tasks/logs/research/`.
- When the doc becomes a **cited evidence/reference trail** for a design / impl / docs decision → **offer** to promote (copy) it into a committed location: the relevant component's `docs/` **when the topic clearly maps to one component**, else `docs/research/`. **Never promote without developer confirmation.** Never offer for a failed/partial doc (1j).

### 1o. Important notes (skill footer)

- Sub-agents must not be spawned (recursion guard).
- Reads no RDPI prerequisite artifacts; not pre-edit-gated (writes only a local doc).
- Kept doc is never auto-deleted and is not in `/finish`'s cleanup list.
- Purely additive (AC9): `/codex-review`, `/codex-audit`, `deep-research`, `/research-codebase` stay byte-for-byte unchanged.

### Phase 1 success criteria

```bash
test -f .claude/skills/codex-research/SKILL.md && echo "skill exists"
# Frontmatter omits disable-model-invocation (auto-invocable):
! grep -q 'disable-model-invocation' .claude/skills/codex-research/SKILL.md && echo "auto-invocable OK"
# Both Codex invocation forms present, read-only, -a never, -o to the .md:
grep -q 'sandbox read-only' .claude/skills/codex-research/SKILL.md && echo "read-only OK"
grep -q '\-\-search' .claude/skills/codex-research/SKILL.md && echo "external --search OK"
grep -q 'tasks/logs/research/' .claude/skills/codex-research/SKILL.md && echo "kept-doc path OK"
# No cleanup line performs a broad/destructive delete under tasks/logs/research (footgun guard — must catch rm *.md, rm -rf, and find -delete):
! grep -nE 'rm .*tasks/logs/research/.*\.md|rm -rf .*tasks/logs/research|find .*tasks/logs/research.*-delete' .claude/skills/codex-research/SKILL.md && echo "no destructive delete of kept docs OK"
```

Manual read-through: frontmatter valid YAML; threshold present in both `when_to_use` and body; three modes described with no fixed menu; background note present; metadata header block present; footgun callout present; the **only** deletion line is the exact-path prompt-tmp `rm -f` (1l) — confirm by eye, since a grep cannot prove a negative across all phrasings.

---

## Phase 2 — Register the skill (managed list + human-facing index)

Three single-line insertions. Each is independently verifiable and leaves the repo working.

### 2a. `/playbook-update` managed list (AC8)

Insert after `.claude/skills/codex-audit/SKILL.md` (`playbook-update/SKILL.md:32`), before `.claude/skills/create-todo/SKILL.md` (`:33`):

```
.claude/skills/codex-research/SKILL.md
```

The list is hard-enumerated, one path per line ("never expand globs" — `playbook-update/SKILL.md:221`), so this is a literal one-line add next to the sibling lines (31–32).

### 2b. `README.md` trio row

Insert after the `/codex-audit` row (`README.md:77`), before the `/finish` row (`:78`):

```
| `/codex-research` | General-purpose Codex research / grounding (codebase, generative, or external prior-art) producing a kept research doc |
```

### 2c. `quickref.md` trio row

Insert after the `/codex-audit` row (`quickref.md:50`), before the `/simplify` row (`:51`). Match the surrounding column padding:

```
| `/codex-research`| Codex research / grounding — codebase, generative, or external prior-art (kept doc) |
```

### Phase 2 success criteria

```bash
grep -n 'codex-research/SKILL.md' .claude/skills/playbook-update/SKILL.md   # appears once, line 33
grep -n 'codex-research' README.md quickref.md                              # one row each
# The sibling skills remain byte-for-byte unchanged (AC9):
git diff --quiet -- .claude/skills/codex-review/SKILL.md .claude/skills/codex-audit/SKILL.md .claude/skills/research-codebase/SKILL.md && echo "siblings unchanged"
# Note: deep-research is a built-in skill, NOT a tracked file in this repo (`git ls-files | grep deep-research` → empty),
# so AC9's "deep-research unchanged" is trivially satisfied — nothing here can touch it. Phase 3's name-only diff is the authoritative guard.
```

---

## Phase 3 — Acceptance verification

No new edits — a final pass confirming every acceptance criterion and that nothing outside scope changed.

### Acceptance-criteria checklist (from `tasks/research-codebase.md` / `tasks/design-decision.md`)

| AC | What | Where verified |
|---|---|---|
| AC1 | Skill exists, auto-invocable (no `disable-model-invocation`), in-body exception note | Phase 1a/1b |
| AC2 | Three modes documented, routed per request, external discretionary, **no fixed menu** | Phase 1b/1e |
| AC3 | Auto-fire wired to weighty-OQ threshold | Phase 1a/1c |
| AC4 | Codex call runs in background | Phase 1i |
| AC5 | Output kept at `tasks/logs/research/<date>-<slug>.md`, never auto-deleted | Phase 1i/1l |
| AC6 | Human-gated promotion path | Phase 1n |
| AC7 | External mode runs `--search`; codebase/misc stay grounded | Phase 1i |
| AC8 | `/playbook-update` managed list accounts for the new skill | Phase 2a |
| AC9 | `/codex-review`, `/codex-audit`, `/research-codebase` byte-for-byte unchanged (`deep-research` is a built-in, not a repo file — trivially unchanged) | Phase 2 + Phase 3 name-only diff |
| — | README + quickref trio rows (beyond AC8, design-confirmed) | Phase 2b/2c |

### Phase 3 success criteria

```bash
# Only the four intended files differ (new SKILL.md is untracked):
git status --porcelain
# Expect: ?? .claude/skills/codex-research/SKILL.md  (+ existing tasks/* artifacts)
#          M .claude/skills/playbook-update/SKILL.md
#          M README.md
#          M quickref.md
# No unintended source edits; deep-research untouched:
git diff --name-only   # must NOT list codex-review, codex-audit, research-codebase, or deep-research
```

---

## Judgment Calls

1. **Prompt-tmp location + naming → `tasks/logs/research/<date>-<slug>-prompt.tmp`.** Gitignored dir + unique-per-run name (vs `/codex-review`'s top-level `tasks/codex-review-prompt.tmp`). Chosen to avoid stranded-commit risk (top-level tmp is not gitignored) and concurrent-run collisions (an auto-fire landing while another is in flight). Alternative: a fixed top-level name like the simplest sibling.

2. **Metadata header authorship → Claude prepends after validation** (Phase 1k), rather than instructing Codex to emit it. Claude owns the values (`trigger`/`route`/`search`/`slug`/`date`), so prepending is deterministic and avoids Codex reformatting a header that backs dedup/promotion. Cost: one targeted edit to the doc Claude already read fully. Alternative: a single `-o` write with Codex emitting the header.

3. **Validation min-lines → 20** (Phase 1j), matching the research lane (`research-codebase`) on the design's own "this is research, not a lightweight review" reasoning. Alternative: 5 (the `/codex-review` + `/codex-audit` floor) — more permissive, less likely to false-fail a terse-but-valid doc, but weaker truncation detection. 20 is judged safe because Codex at `xhigh` produces structured reports well over 20 lines and the prepended header is excluded from the count.

4. **Cleanup mechanism → exact-path `rm -f <date>-<slug>-prompt.tmp`** (Phase 1l), not `/codex-audit`'s `find -name '<run>-*.tmp' -delete`. There is exactly one prompt tmp per run, and an exact path is glob-free — it can never match the `.md` deliverable, which is the maximally footgun-safe choice for the lifecycle-inversion risk.

5. **`model_reasoning_effort=xhigh`** — resolved in design (non-blocking OQ, Codex concurred). Restated, not re-litigated.

6. **Phase granularity → SKILL.md authored whole in Phase 1.** A half-written skill is not an independently-working state; splitting authoring across phases buys nothing.

## Where research was thin (judgment applied)

The design left two **non-blocking** OQs, resolved here:

- **Slug rule + collision suffix** → deterministic lowercase `[a-z0-9-]` slug (topic-based for manual, `-oq-<short>` for auto-fired); reuse/overwrite/suffix gated by the **metadata-header completion marker** so a failed/partial doc can't poison dedup and a kept doc is never overwritten (Phase 1f).
- **Promotion default-location precedence** → prefer the relevant component's `docs/` when the topic clearly maps to one component, else `docs/research/` (Phase 1n).

## Artifact references

- Research: `tasks/research-codebase.md`
- Design: `tasks/design-decision.md`
- Sibling skills (templates): `.claude/skills/codex-review/SKILL.md`, `.claude/skills/codex-audit/SKILL.md`
- Validator: `.claude/scripts/codex-output-check.sh` (`<path> [min-lines=5]`)
- `--search` reference form: `.claude/skills/research-codebase/SKILL.md:64`
