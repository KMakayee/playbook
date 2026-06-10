# Plan: Add `/codex-audit` skill — source-grounded fidelity + completeness audit (Task 19)

## Design decision reference

**Chosen approach:** Option 1 — **Passes-coupled apply** (`tasks/design-decision.md` §Decision).
Single pass is **recommend-only** (identical end-behavior to `/codex-review`); `passes > 1`
**applies** verified fidelity-defects inline between iterations, regenerating the prompt with a
fresh current-state block so pass N+1 reads corrected on-disk state. Two refinements absorbed from
the Codex cross-check are folded in: the **editable-target guard** (`passes > 1` requires an
on-disk editable target) and **per-run-unique temp names**. All other axes per the settled-axis
table in `tasks/design-decision.md` (lines 15-24).

The work is **Markdown-and-spec, not code**: author one new SKILL.md that merges `/codex-review`'s
plumbing with the Omakase `codex-source-audit.md` relational/looped semantics, then register it.

## Scope boundaries — What We're NOT doing

(from `tasks/design-decision.md` §What We're NOT Doing — restated so they bind during implementation)

- **NOT** touching `.claude/skills/codex-review/SKILL.md` — byte-for-byte unchanged (AC6). `/codex-audit`
  is additive; shared plumbing is **copied**, never factored out of the sibling.
- **NOT** copying Omakase's literals — fixed source paths, the fp-rebuild lineage table, the baked-in
  3× loop. Those become Claude-composed / per-target.
- **NOT** copying Omakase's plumbing gaps — its invocation (`codex-source-audit.md:108`) lacks `-a never`
  and never runs `codex-output-check.sh`. Plumbing comes from `/codex-review`.
- **NOT** reusing `.claude/templates/audit-report.md` — it belongs to `/playbook-audit`; `/codex-audit`
  produces **no persistent artifact** (only target edits when policy applies).
- **NOT** solving issue #6's cross-skill unique-naming generalization here — realize per-run-unique
  names locally; let #6 generalize.
- **NOT** adopting task-13's `A.1/A.2/B/C` triage vocabulary — `/triage` is not on disk; inline
  apply / judgment-call / noise (Axis 6=A).
- **NOT** spawning sub-agents (recursion guard, carried from both precedents).
- **NOT** editing source docs — sources are ground truth; only the target may be written.
- **NOT** adding `xhigh` — default to the exact `/codex-review` flag set (`-a never exec --sandbox read-only`);
  Codex cross-check confirmed xhigh is not load-bearing for this skill (Axis 7=A).

## Acceptance criteria (AC) → coverage map

From `tasks/research-codebase.md:16`. Each AC is delivered by the cited phase/step.

1. Skill exists with frontmatter, `disable-model-invocation: true`, `argument-hint: '[file | diff | artifact | "description"] [passes]'` → **Phase 1, §A**
2. Composed prompt runs the relational fidelity+completeness+precision audit, NOT the three-lens merit review → **Phase 1, §C (Step 2)**
3. Lenses derived per-target, example sets only, no fixed menu → **Phase 1, §C (Step 2) lens block**
4. `passes` parsed from trailing integer, default 1, each pass `review → triage → apply` with next pass seeing corrected on-disk state → **Phase 1, §B (parse) + §D (Steps 3–5 loop)**
5. Reuses established Codex plumbing (safe tmp-compose, `-a never exec --sandbox read-only`, `codex-output-check.sh`, cleanup-before-present) → **Phase 1, §D (Steps 1–6)**
6. `/codex-review` unchanged → **Scope boundary + Phase 1 success criteria (`git diff --quiet`)**
7. `/playbook-update` managed-file list accounts for the new skill → **Phase 2**

(AC9 / Axis 9 README + quickref rows are non-AC polish → **Phase 3**.)

---

## Phase 1 — Author `.claude/skills/codex-audit/SKILL.md`

- [x] **Phase 1 complete** — skill authored; all 24 success-criteria checks pass; manual read-checks (a) and (b) verified.

The whole deliverable. A single new Markdown file modeled section-by-section on
`.claude/skills/codex-review/SKILL.md` (verified 1-136) for **plumbing/presentation** and on
`~/Projects/Omakase/omk-core/.claude/commands/codex-source-audit.md` (verified 1-148) for
**relational/looped semantics**. Build it in the order below; each lettered sub-section maps to a
region of the final file.

### §A. Frontmatter (AC1)

```yaml
---
name: codex-audit
description: <one line — a source-grounded Codex audit of a target (file/diff/artifact/description) against the source(s) it was built from, for fidelity, completeness, and precision>
argument-hint: '[file | diff | artifact | "description"] [passes]'
disable-model-invocation: true
when_to_use: 'Use when asked to "have codex audit X against its source", "check this is faithful to the spec/source", or to verify a synthesized doc dropped nothing load-bearing.'
---
```

- `disable-model-invocation: true` is **required** (AC1) — `/codex-audit` *may edit the target*, so it
  stays manual per [[feedback_skill_manual_invocation]]. This is the deliberate contrast with
  `/codex-review`, which omits the field (auto-invocable) because it is recommend-only
  (`codex-review/SKILL.md:1-6`).
- `argument-hint` must be **exactly** `'[file | diff | artifact | "description"] [passes]'` (AC1).
- `when_to_use` included for parity/discoverability; advisory only (skill is manual).

### §B. Intro + target resolution + argument parsing

**Intro paragraph(s)** — state the load-bearing rationale up front
(`research-codebase.md:80`, "Architecture Analysis"): a blind pass over a target can critique merit
but cannot see omissions — *absence is invisible without the source*. So **review** (merit,
target-only — use `/codex-review`) and **audit** (fidelity, target↔source — this skill) are
structurally different passes. Note distinctness from `/code-review` / `/security-review` PR
workflows. State: no persistent artifact, reads no RDPI prerequisites; the only on-disk effect is
**target edits when `passes > 1`**.

**Target resolution (Axis 1=B)** — mirror `codex-review/SKILL.md:12-17`: explicit `$ARGUMENTS`
(after stripping a trailing `passes` integer, see below), else infer the target from conversation;
ask **one** clarifying question only if genuinely ambiguous (higher edit-cost than `/codex-review`
makes a wrong guess costlier — so the one-question fallback is the safeguard).

**Argument parsing (AC4 + OQ2)** — `$ARGUMENTS` carries the target and an optional trailing
`passes` integer. Rule (research-codebase.md:155, design-decision.md:64):
- The **last whitespace-delimited token** is `passes` **iff** it parses as a positive integer
  **AND** a non-empty target remains after removing it. (The cap is **not** a parse condition — see
  next bullet; a trailing `99` is still parsed *as* `passes`, then clamped, otherwise it would
  silently fall back into the target.)
- Otherwise the token is part of the target (e.g. `/codex-audit "step 2"` → target is `step 2`,
  `passes` defaults to 1).
- **Default `passes = 1`.** Validate the parsed value as a positive integer — **reject 0 / negative**.
  **Then** apply the cap (**≤5**, OQ4): if the parsed value exceeds 5, clamp to 5 and tell the
  developer it was clamped (J3 — clamp-and-note over stop-and-ask, for low friction; the note keeps it
  non-silent).
- **Escape hatch:** quote the target to force a trailing number into it (`/codex-audit "fix step 2"`).
  Document this in the skill prose.

### §C. The audit prompt — generalized from Omakase (AC2, AC3)

This is the semantic heart and the section that most diverges from `/codex-review`. The composed
prompt (written to a temp file in Step 2 below) must contain a **generalized** version of
`codex-source-audit.md:30-95`, with the three hardwired things replaced by Claude-composed,
per-target equivalents:

1. **Framing** — "You are running a SOURCE-FIDELITY audit. This is NOT a technical-merit or style
   review. Verify, entry by entry / claim by claim, that the TARGET faithfully represents its
   SOURCE(s). The target is the object under audit — it is NOT authoritative over its sources."
   (AC2 — must be the relational audit, never `/codex-review`'s three merit lenses.)

2. **Sources of truth (Axis 2=C — source injection, the new mechanism).** Codex cannot see the
   chat, so **Claude injects** the source set into the prompt — **hybrid**:
   - List on-disk source **paths** for Codex to open (the precedent at `codex-source-audit.md:38-43`,
     generalized — no hardwired fp-rebuild paths).
   - **Embed** Claude-composed excerpts / full text for any chat-only or non-file source.
   - Sources are **never a user CLI argument**. If the source of truth is genuinely ambiguous,
     **confirm with the developer** (one question) — constraint, not a guess (`research-codebase.md:94`).
   - Instruct Codex: open the cited sources; do not trust the target's paraphrase.

3. **Core lenses — always on (AC2):** **fidelity** (faithful restatement of what the source means,
   no distortion / over-claim / invention), **completeness** (load-bearing facts the target dropped —
   "absence is what a blind pass can't see; read the source and name what is missing"), **precision**
   (correct names / IDs / section references).

4. **Secondary lenses — Claude-composed per target (Axis 3=A, AC3).** A free-form block Claude fills
   for the specific target. The prompt may show **example** secondary lenses (e.g. a
   lineage/supersession lens *only when the sources carry a supersession order*; a "code is authority
   for current-state claims" lens) — but must **never present a fixed menu or ask the developer to
   "pick a lens"** (explicit anti-pattern, `research-codebase.md:99`). Lineage/supersession is a
   **conditional secondary** lens, not a 4th core lens (OQ3 resolution).

5. **Citation contract (cross-cutting constraint).** Every **fidelity defect** MUST cite the
   **source `file:line`** that proves it, next to the **target location it contradicts**. "No
   citation → downgrade to judgment-call or drop." When target and source conflict, **source wins**
   (`codex-source-audit.md:82-85`).

6. **Classification (Axis 6=A).** Codex emits two buckets: **fidelity defect** (verifiable against
   source — clear right answer) vs **judgment call** (ambiguous / defensible-either-way / boundary).

7. **Multi-pass current-state blocks (AC4).** When `passes > 1`, the regenerated prompt (Step 5c)
   carries, generalized from `codex-source-audit.md:86-88, 118-120`:
   - `## ALREADY APPLIED BY PRIOR PASSES (do NOT re-report; find what these MISSED)`
   - `## OPEN QUESTIONS TO MATURE`

8. **Output format** — headers per lens (e.g. `## Fidelity`, `## Completeness`, `## Precision`, plus
   any secondary-lens headers), bullets prefixed `**fidelity defect:**` / `**judgment call:**`, each
   with the target location + source `file:line`. Empty category → `_no findings_`.

### §D. Steps (plumbing — copied from `/codex-review`, looped per Omakase)

**Temp location (Axis 8, per the 2026-06-10 developer decision).** All temps live under the
**gitignored** `tasks/logs/audits/` subdir (`.gitignore:6` covers `tasks/logs/` — verified via
`git check-ignore`), **not** the tracked `tasks/` root. The dir does not exist yet, so Step 1 must
`mkdir -p tasks/logs/audits`. Because the location is gitignored, the no-committed-artifact boundary
is **structural** (git cannot see these files) rather than dependent on cleanup discipline — but the
temps are still deleted on every exit path for disk hygiene, and this aligns `/codex-audit` with its
trio sibling `/codex-research` (task 20 → `tasks/logs/research/`).

Use a **single literal run-token** chosen once at the start of the run, threaded **verbatim** into
every temp path: `tasks/logs/audits/<run>-prompt.tmp` and `tasks/logs/audits/<run>-<i>.tmp`.
(See Risk R1 / Judgment Call J4 — do **not** write a bare `$$` into the filenames; each Bash tool
call is a separate shell so `$$` is not stable across the compose→invoke→cleanup calls.)

**Cleanup command (referenced as "clean this run's temps" throughout §D).** Use a glob-safe form —
the session shell is zsh, where an *unmatched* glob errors (`no matches found`) **before** `rm`
runs, so a bare `rm -f tasks/logs/audits/<run>-*.tmp` can fail on the first (no-output-yet) call:

```bash
find tasks/logs/audits -maxdepth 1 -name '<run>-*.tmp' -delete 2>/dev/null
```

`find` matches zero files silently (exit 0), so it is safe on every path including the pre-delete;
`2>/dev/null` swallows the "No such file or directory" error if the dir was never created.

**Step 1 — Make the temp dir + pre-delete stale temps.** `mkdir -p tasks/logs/audits`, then run the
cleanup command above defensively before composing (mirrors `codex-review/SKILL.md:25-31`;
`find … -delete` is the zsh-safe equivalent of its `rm -f`, and the gitignored dir is the
2026-06-10 Axis-8 location).

**Step 2 — Compose the audit prompt safely.** Write the §C prompt body to
`tasks/logs/audits/<run>-prompt.tmp`, then read it via `"$(cat …)"` at invoke time — avoids
shell-quoting hazards when the target/excerpts contain quotes/backticks/newlines
(`codex-review/SKILL.md:33-63`). Interpolate the **resolved target** — `$ARGUMENTS` *after* the
trailing `passes` token (if any) has been stripped per §B — verbatim; do not otherwise rewrite,
classify, or summarize the target text. (`/codex-review` says "interpolate `$ARGUMENTS` literally"
because it has no `passes` token to strip; for `/codex-audit` the only preprocessing is removing the
parsed `passes` integer.)

**Step 3 — Editable-target guard, then invoke Codex.** Before looping, resolve an
`effective_passes` from the guard (design-decision.md:26-28): `passes > 1` **requires an on-disk
editable target**.
- If the target maps to a writable on-disk file → `effective_passes = passes`.
- If the target is chat-only / a non-file `"description"` / a diff or artifact with no writable
  backing **and** `passes > 1` → set `effective_passes = 1` and **tell the developer the run was
  downgraded to a single recommend-only pass** (there is nothing on disk to correct between
  iterations). This is Option 1 degrading gracefully — not a silent change.

Then, for iteration `i = 1 … effective_passes`, invoke with `run_in_background: true` (Codex may
take 10+ min):

```bash
codex -a never exec \
  --sandbox read-only \
  -o tasks/logs/audits/<run>-<i>.tmp \
  "$(cat tasks/logs/audits/<run>-prompt.tmp)" </dev/null
```

(Exact `/codex-review` flag set — Axis 7=A, AC5. No `xhigh`, no `--search`.) If `codex` is not found
or fails → clean this run's temps (the glob-safe command above), then **stop** and tell the developer
(cleanup before stop so the no-persistent-artifact boundary holds — `codex-review/SKILL.md:76`).

**Step 4 — Verify + spot-check.** `bash .claude/scripts/codex-output-check.sh tasks/logs/audits/<run>-<i>.tmp 5`
(verified: script takes `<path> [min-lines]`, default 5 — `codex-output-check.sh:8-9`). On fail →
clean this run's temps (glob-safe command above), **stop**. Read the output FULLY. **Spot-check the relation**: for each
fidelity defect re-read **both** the cited source `file:line` **and** the target location it
contradicts — a fidelity defect is a relation between the two; source-only checking can't confirm
Codex read the target correctly (`codex-source-audit.md:113`). Carry the
**"Codex's confidence is not evidence"** caveat verbatim (`codex-review/SKILL.md:84`).

**Step 5 — Triage + (conditional) apply.** Map Codex's buckets to **apply / judgment-call / noise**
(Axis 6=A):
- **Single pass (`effective_passes = 1`) → recommend-only.** Do **not** write the target. Behavior is
  identical to `/codex-review` Step 6: present raw findings, offer opt-in triage (Step 7a).
- **Multi-pass (`effective_passes > 1`) → apply on every pass.** For **each** pass `i = 1 …
  effective_passes` (the final pass applies too — AC4: *every* pass is `review → triage → apply`; the
  Omakase loop applies on all three passes, `codex-source-audit.md:113`):
  - **Clear, verified fidelity-defect → apply the minimal faithful edit to the TARGET now**, inline in
    this session (Axis 5=A — no child process; `issue-implement/SKILL.md:121-160` precedent). Record
    in a running **applied-fixes** list. The fix lands on disk so the next pass's Codex re-reads the
    corrected target.
  - **Judgment-call / boundary note / still-open question → do NOT edit.** Carry forward.
  - **Noise → drop.**
  - **Guardrails:** only **fidelity-defects** auto-apply; edits confined to the **target** — sources
    are **never** edited (`codex-source-audit.md:140`).
  - **Step 5c — Regenerate the prompt (never append), only when another pass remains** (`i <
    effective_passes`). Rewrite `tasks/logs/audits/<run>-prompt.tmp` as base body **+ ONE fresh
    current-state block** (`## ALREADY APPLIED …` + `## OPEN QUESTIONS TO MATURE`). **Regenerate, do
    not append** — appending leaks stale earlier-pass state into later passes
    (`codex-source-audit.md:118`, the subtle correctness invariant). Then loop back to Step 3 for pass
    `i+1`. After the **final** pass (`i = effective_passes`), do not regenerate — proceed to Step 6.

**Step 6 — Spot-check applied edits + clean up.** Multi-pass only: re-verify a sample of the
highest-impact applied edits against their source `file:line` (an over-eager edit is itself a defect —
`codex-source-audit.md:126`). Then **delete all this run's temps before** the user-facing turn —
cleanup-before-present, because Step 7 ends in an interactive prompt and a late cleanup would strand
temps on an unanswered offer (`codex-review/SKILL.md:86-94`). Run the glob-safe cleanup command (it
removes the run's prompt + all per-pass output temps in one match).

**Step 7 — Present.**
- **Single pass (recommend-only):** mirror `codex-review/SKILL.md:96-128` — present raw findings
  grouped by lens/label, then **offer opt-in triage** ("Want me to triage these? … I won't make
  changes."). On accept (follow-up turn): re-verify each, label apply / judgment-call / noise, present
  the recommend-only view (Recommendations / Needs your input / Filtered-as-noise **count**). Do **not**
  apply on a single pass.
- **Multi-pass (applied):** mirror `codex-source-audit.md:132-140` — report **what was applied**
  (done, not proposed: target location + source `file:line` + one-line note), a short **Needs your
  input** survivor list (judgment-calls / unresolved open questions, each with the missing input), and
  **Filtered as noise** as a count only.

### §E. Important notes (closing section)

- Reads no RDPI prerequisites; writes nothing to `tasks/issues.md` / `tasks/todo.md`; **no persistent
  artifact** (only target edits when `passes > 1`).
- **Sub-agents must not be spawned** (recursion guard — both precedents carry it,
  `codex-review/SKILL.md:135`).
- Does **NOT** add itself to `/finish`'s cleanup list — its temps are deleted in Step 6
  (`codex-source-audit.md:148`), **and** they live under the gitignored `tasks/logs/audits/`
  (`.gitignore:6`), so even a stranded temp is never committed.
- Source docs are ground truth and must **never** be edited; only the target may be written.

### Phase 1 success criteria

```bash
F=.claude/skills/codex-audit/SKILL.md

# AC1 — file exists with required frontmatter fields
test -f "$F"
grep -q '^name: codex-audit'                                    "$F"
grep -q '^disable-model-invocation: true'                       "$F"
grep -qF "argument-hint: '[file | diff | artifact | \"description\"] [passes]'" "$F"

# AC2 — relational audit, all THREE core lenses present (each checked separately, not an OR)
grep -qi 'fidelity'                                             "$F"
grep -qi 'completeness'                                         "$F"
grep -qi 'precision'                                            "$F"
grep -qiE 'against (its|the) source|source.fidelity|source of truth' "$F"   # relational framing
! grep -qiE 'Simplest-approach|Pattern / best-practice'        "$F"          # NOT the merit review

# AC3 — per-target lenses by example, no fixed menu (anti-pattern must be absent)
grep -qiE 'example|secondary lens'                             "$F"
! grep -qiE 'pick (a|one) lens|choose a lens|select a lens'    "$F"

# AC4 — passes default 1; apply on every multi-pass iteration; regenerate-not-append
grep -qi 'passes'                                              "$F"
grep -qiE 'default(s)? (to )?1|default 1'                      "$F"
grep -qi 'regenerat'                                           "$F"
grep -qi 'append'                                              "$F"                # the never-append invariant
grep -qiE 'editable[- ]target|on-disk editable'               "$F"                # editable-target guard
grep -qE '(≤ ?5|cap|max).{0,12}(pass|5)'                      "$F"                # pass cap present

# AC5 — established plumbing
grep -qF 'codex -a never exec'                                 "$F"
grep -qF 'codex-output-check.sh'                               "$F"

# AC6 — /codex-review byte-for-byte unchanged
git diff --quiet .claude/skills/codex-review/SKILL.md

# Temp location — gitignored tasks/logs/audits/ (Axis 8, 2026-06-10 decision), with mkdir -p
grep -qF 'tasks/logs/audits/'                                  "$F"
grep -qF 'mkdir -p tasks/logs/audits'                          "$F"
git check-ignore -q tasks/logs/audits/probe.tmp                              # location is gitignored

# Trap check — no bare $$ in any temp path (R1/J4)
! grep -qE 'logs/audits/[^ )`]*\$\$'                            "$F"
```

All `grep` checks pass; `git diff --quiet` returns 0. These are structural smoke tests — they prove
the key behaviors are *mentioned*, not that the control flow is correct. The binding verification is
still **reading the file end-to-end against the §A-§E spec**, with two manual read-checks the greps
can't make: (a) single-pass writes **nothing** to the target (R2), and (b) the multi-pass loop
**applies on the final pass** and regenerates **only** between passes (CORRECTION from Codex review).

---

## Phase 2 — Register in the `/playbook-update` managed list (AC7)

- [x] **Phase 2 complete** — bare path inserted adjacent to the codex-review entry; all criteria pass.

`.claude/skills/playbook-update/SKILL.md` carries an **enumerated** (not globbed) managed-file list;
`.claude/skills/codex-review/SKILL.md` is at **line 31** (verified). Add the new skill path on its
own line **adjacent to line 31** (immediately after the codex-review entry keeps the two Codex
siblings together). The managed list is plain path lines inside a fenced block
(`playbook-update/SKILL.md:19-53`) — the added line must be **exactly** the bare path, with no
trailing comment or annotation:

```
.claude/skills/codex-review/SKILL.md
.claude/skills/codex-audit/SKILL.md
```

(The second line is the one to insert.) Without this, `/playbook-update` treats an installed
`codex-audit` as a local addition and never propagates upstream changes (`research-codebase.md:49`).

### Phase 2 success criteria

```bash
P=.claude/skills/playbook-update/SKILL.md

# path is present...
grep -qF '.claude/skills/codex-audit/SKILL.md' "$P"

# ...and on the line immediately after the codex-review entry (proves placement inside the
# enumerated block, adjacent to its sibling — not appended loose elsewhere)
grep -A1 -F '.claude/skills/codex-review/SKILL.md' "$P" \
  | grep -qF '.claude/skills/codex-audit/SKILL.md'

# the added line is a bare path — no trailing comment/annotation
grep -nF '.claude/skills/codex-audit/SKILL.md' "$P" | grep -qvE '#|<--'
```

---

## Phase 3 — Discoverability rows (Axis 9 — non-AC polish)

- [x] **Phase 3 complete** — rows added after the codex-review rows in both tables; quickref padding matches (104 chars).

Add a `/codex-audit` row to each utility table, immediately after the `/codex-review` row:

- **`README.md`** after line 76 (verified — codex-review row in the utility-commands table, header
  `|---|---|` at line 70):
  ```
  | `/codex-audit` | Source-grounded Codex audit of a target against its source(s) for fidelity, completeness, and precision |
  ```
- **`quickref.md`** after line 49 (verified — same table; columns are space-padded for alignment, so
  pad the new row to match the surrounding `| `/codex-…` |` column widths):
  ```
  | `/codex-audit`  | Audit a target against its source(s) for fidelity, completeness, and precision     |
  ```

### Phase 3 success criteria

```bash
grep -qF '/codex-audit' README.md
grep -qF '/codex-audit' quickref.md
```

---

## Judgment Calls

1. **Phase ordering.** Author the skill (Phase 1) before registering it (Phase 2) and documenting it
   (Phase 3) — the registration/doc rows reference a path that should exist first. The three phases
   are otherwise independent and each leaves the repo in a working state. *Alternative:* fold Phases
   2–3 into Phase 1 as a single commit; kept separate so AC7 (required) is cleanly distinct from
   Axis-9 polish (optional) and each is independently verifiable.

2. **`when_to_use` in frontmatter.** Included for parity with `/codex-review` and discoverability,
   even though the skill is manual (`disable-model-invocation: true`) so the field is advisory only.
   *Alternative:* omit it (AC1 lists only name/description/argument-hint/disable-model-invocation).
   Low cost, mild benefit — keep.

3. **Pass-cap behavior on overflow (>5).** Clamp to 5 and tell the developer, rather than stopping.
   *Alternative:* stop and ask. Clamp-and-note is lower friction and still honors the cap (OQ4).

4. **Temp location + per-run-unique naming.** *Location (2026-06-10 developer decision, amends Axis
   8):* temps live under the **gitignored** `tasks/logs/audits/` subdir, not the tracked `tasks/`
   root — so the no-committed-artifact boundary is structural, the orphan-then-commit failure mode
   (issue #6) is closed by construction, and `/codex-audit` matches its trio sibling `/codex-research`
   (task 20 → `tasks/logs/research/`). *Alternatives weighed:* tracked `tasks/` root (mirrors
   `/codex-review` most literally, but leans on cleanup discipline to avoid commits) and system
   `/tmp` via `mktemp` (zero repo footprint, but diverges from every in-repo skill). *Naming:* realize
   "per-run-unique" via a **single literal run-token Claude fixes once and threads verbatim** through
   every temp path — **not** a bare `$$`. The design illustrated `$$`, but each Bash tool call is a
   separate shell, so `$$` evaluated independently in the compose, invoke, and cleanup calls would
   differ and break the `"$(cat …prompt.tmp)"` read. Existing skills only use `mktemp` *within a
   single* Bash call (`implement-codex/SKILL.md:193`); none rely on `$$` across calls. *Alternative
   considered:* compute `$(date +%s%N)`/`mktemp` once — rejected because the value still can't persist
   across separate Bash tool calls.

5. **Single-pass presentation = `/codex-review` recommend-only flow** (present raw → offer opt-in
   triage), rather than presenting a pre-triaged recommend view directly. *Rationale:* the design
   states single-pass behavior is "identical end-behavior to `/codex-review`" (design-decision.md:34),
   and reusing that exact two-turn flow is the most faithful realization.

6. **Triage vocabulary = apply / judgment-call / noise now** (Axis 6=A), not task-13's
   `A.1/A.2/B/C`. *Rationale:* `/triage` is not on disk and can't be invoked; both live precedents use
   this vocabulary. Migrate later if task 13 standardizes it.

## Risks

- **R1 — `$$`-as-literal temp-naming trap (highest implementation risk).** Baking a bare `$$` into the
  temp filenames would break across the compose→invoke→cleanup Bash calls (separate shells → different
  PIDs). Mitigation: Judgment Call J4 (single literal run-token) + the Phase-1 success-criteria trap
  check `! grep -qE 'logs/audits/[^ )`]*\$\$'`.
- **R2 — Apply-policy default is the highest-stakes *semantic* call** (`research-codebase.md:154`).
  Single pass must be zero-write; multi-pass must apply (else AC4's "next pass sees corrected state"
  fails). The Step-5 conditional pins both; verify the single-pass path writes nothing.
- **R3 — Stranded temps on the background path.** `run_in_background: true` + a developer who never
  returns = orphaned `.tmp`. Mitigation: glob-safe cleanup on **every** exit path — success (Step 6),
  codex-not-found (Step 3), output-check fail (Step 4); and the gitignored `tasks/logs/audits/`
  location (Axis 8) means even a missed temp is never committed (downgrades this from a repo-hygiene
  risk to a disk-hygiene one).
- **R4 — Plumbing-copy hazard.** Copying Omakase's invocation verbatim regresses hardening (no
  `-a never`, no output-check). Mitigation: compose plumbing from `/codex-review`, semantics from
  Omakase — enforced by the §D step-by-step citations.
- **R5 — `/codex-review` drift / AC6 violation.** The siblings share most plumbing; a future "edit
  both" risks AC6. Mitigation: keep `/codex-audit` self-contained (copy, don't factor out); Phase-1
  success criterion `git diff --quiet .claude/skills/codex-review/SKILL.md`.
- **R6 — Argument-parse ambiguity** (target ending in a number vs `passes`). Mitigation: the §B rule
  (last token is `passes` iff positive int **and** non-empty target remains — the cap is applied
  *after* parsing, by clamping, not as a parse condition) + the quote-the-target escape, both
  documented in the skill.

## Artifact references

- Research: `tasks/research-codebase.md`
- Design decision: `tasks/design-decision.md`
- (No `tasks/research-patterns.md` — design confirmed no external research required.)

## Convention sources verified during planning

- `.claude/skills/codex-review/SKILL.md` (1-136) — frontmatter shape, target resolution (12-17), safe
  tmp-compose (33-63), `-a never exec --sandbox read-only` invocation (65-76), output-check + confidence
  caveat (78-84), cleanup-before-present (86-94), recommend-only triage (96-128), recursion guard (135).
- `~/Projects/Omakase/omk-core/.claude/commands/codex-source-audit.md` (1-148) — relational audit prompt
  (30-95), citation contract (82-85), review→triage→apply loop (99-122), regenerate-not-append (118),
  apply-by-default presentation (132-140).
- `.claude/scripts/codex-output-check.sh` (1-22) — `<path> [min-lines]`, default 5.
- `.claude/skills/playbook-update/SKILL.md` (15-53) — enumerated managed list; codex-review at line 31.
- `README.md:70-76`, `quickref.md:44-49` — utility-command tables; codex-review rows.
- `.claude/skills/implement-codex/SKILL.md:193` — only existing `mktemp` use (single-call); no `$$`-across-calls precedent.
