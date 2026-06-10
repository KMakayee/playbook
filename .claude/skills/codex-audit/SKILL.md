---
name: codex-audit
description: A source-grounded Codex audit of a target (file, diff, artifact, or description) against the source(s) it was built from, for fidelity, completeness, and precision.
argument-hint: '[file | diff | artifact | "description"] [passes]'
disable-model-invocation: true
when_to_use: 'Use when asked to "have codex audit X against its source", "check this is faithful to the spec/source", or to verify a synthesized doc dropped nothing load-bearing.'
---

# Codex Audit

A source-grounded, optionally multi-pass Codex audit of an arbitrary target — file, diff, artifact, or freeform string — against the source(s) it was built from, for the target: **$ARGUMENTS**.

**Why this is a separate pass from `/codex-review`:** a blind pass over a target alone can critique its merit but cannot see its omissions — absence is invisible without the source. **Review** (technical merit, target-only — use `/codex-review`) and **audit** (fidelity to source, target↔source — this skill) are structurally different passes. Also distinct from any `/code-review` or `/security-review` plugin commands, which run full PR-review workflows.

This skill produces no persistent artifact, reads no RDPI prerequisite artifacts, and writes nothing to `tasks/issues.md` or `tasks/todo.md`. Its only on-disk effect is **edits to the target itself when `passes > 1`**; a single pass (the default) is recommend-only, with end-behavior identical to `/codex-review`.

**Target resolution.** Two entry modes, mirroring `/codex-review`:

- **Explicit target** — `$ARGUMENTS` is non-empty after stripping the trailing `passes` token (see Argument parsing below). Audit that target unchanged.
- **No explicit target** — `$ARGUMENTS` is empty or blank. Infer the target from conversational context — the artifact just synthesized, or whatever the chat instruction tagged. If the target is genuinely ambiguous, ask one clarifying question rather than guessing — this skill may edit the target, so a wrong guess is costlier here than in `/codex-review`.

Wherever the steps below reference the target, use the resolved target — the explicit `$ARGUMENTS` value (with the `passes` token stripped), or the inferred description when no argument was supplied.

**Argument parsing — `passes`.** `$ARGUMENTS` carries the target plus an optional trailing pass count:

- The **last whitespace-delimited token** is `passes` **iff** it parses as a positive integer **and** a non-empty target remains after removing it. Otherwise the token is part of the target (e.g. `/codex-audit "step 2"` → target `step 2`, `passes` defaults to 1).
- `passes` defaults to 1. The parsed value must be a positive integer — 0 and negatives are rejected, never silently accepted. Then apply the cap: `passes` is capped at 5. The cap is not a parse condition — a trailing `99` still parses as `passes`, then gets clamped to 5 with a note to the developer that it was clamped; treating the cap as a parse condition would silently fold the number back into the target.
- **Escape hatch:** quote the target to force a trailing number into it — `/codex-audit "fix step 2"` audits the literal phrase `fix step 2` with `passes = 1`. Document a wrong split by re-invoking with quotes.

**Source resolution.** The source set is **never a CLI argument** — Claude determines it from the conversation, the target's own citations, or what the developer has named, and injects it into the composed prompt (Step 2). If the source of truth is genuinely ambiguous, confirm with the developer (one question) before composing — a guessed source corrupts the entire audit.

---

## Steps

### 1. Choose a run token, make the temp dir, pre-delete stale temps

All temp files for one run live under the **gitignored** `tasks/logs/audits/` and share a single **run token**: `tasks/logs/audits/<run>-prompt.tmp` (the composed prompt) and `tasks/logs/audits/<run>-<i>.tmp` (the pass-`i` output).

- **Choose `<run>` once, as a literal string** (e.g. a short slug of the target plus a few extra characters: `spec-sync-k3`), and thread it **verbatim** into every temp path for the rest of the run. Do **not** use a bare `$$` or a command substitution in the temp names — each Bash tool call is a separate shell, so a value computed inside one call does not survive into the next, and the compose → invoke → cleanup calls would each name different files.
- Create the dir and defensively clear anything matching this run's token:

```bash
mkdir -p tasks/logs/audits
find tasks/logs/audits -maxdepth 1 -name '<run>-*.tmp' -delete 2>/dev/null
```

The `find … -delete` form is the cleanup command for **every** exit path in this skill — "clean this run's temps" below always means this command. It is glob-safe: the session shell is zsh, where an unmatched glob errors out before `rm` even runs, while `find` matches zero files silently; the `2>/dev/null` swallows the error if the dir doesn't exist yet. Because `tasks/logs/` is gitignored, even a temp stranded by a crashed run can never be committed — but delete anyway for disk hygiene.

### 2. Compose the audit prompt safely

Write the composed prompt body to `tasks/logs/audits/<run>-prompt.tmp` first — the target and embedded source excerpts may contain quotes, backticks, or newlines, and writing to a tmp file then reading via `"$(cat ...)"` avoids shell-quoting hazards. This mirrors `/codex-review`.

Interpolate the **resolved target** verbatim — the only preprocessing allowed is stripping the parsed `passes` token; do not otherwise rewrite, classify, or summarize the target text.

The prompt body must contain (the two `<Claude-composed …>` blocks are filled per the guidance after the template):

```
Target to audit: <resolved target>

You are running a SOURCE-FIDELITY audit. This is NOT a technical-merit or style review. Verify, entry by entry / claim by claim, that the TARGET faithfully represents its SOURCE(s). The target is the object under audit — it is NOT authoritative over its sources.

## Sources of truth (open them; do not trust the target's paraphrase)
<Claude-composed source block — on-disk paths to open, plus embedded text for any non-file source>

## For EVERY entry / claim in the target, open the cited source(s) and check:
1. Fidelity. Does the entry represent what the source MEANS, or reproduce a surface phrase while missing the actual principle? No distortion, over-claim, or invention.
2. Completeness. Does the target drop a load-bearing fact the source carries? Absence is exactly what a blind pass over the target alone cannot see — read the source and name what is missing.
3. Precision. Correct names, IDs, and section/line references — a right claim attached to the wrong identifier is still a defect.

<Claude-composed secondary-lens block — zero or more additional numbered checks for THIS target/source pair; omitted when none apply>

## Open questions (only if an "OPEN QUESTIONS TO MATURE" section is appended below)
Treat each listed open question as a claim to adjudicate against source: can it be resolved by what the sources actually say (cite file:line), or is it genuinely unresolved? Report per question: RESOLVED (with the source that settles it) or STILL-OPEN (naming the specific missing input that keeps it open).

## Classify each finding
- fidelity defect — verifiable against source (misstatement, omitted load-bearing fact, wrong name/ID/reference). Clear right answer.
- judgment call — ambiguous source, defensible-either-way reading, or a boundary/scope question.

## Rules
- EVERY fidelity defect MUST cite the source file:line that proves it (what the source actually says), next to the target location it contradicts. No citation → downgrade to judgment call or drop.
- When the target and a source conflict, the source wins.
- Be exhaustive on completeness — omission is the one thing a blind pass over the target cannot catch.
- If an "ALREADY APPLIED BY PRIOR PASSES" section is appended below, those entries are already corrected on disk; do NOT re-report them — spend the pass finding what they MISSED.

## Output
Headers: ## Fidelity · ## Completeness · ## Precision, plus one header per secondary lens supplied above, plus ## Open questions (only if some were supplied). Under each, bullets prefixed **fidelity defect:** or **judgment call:**, each with the target location + the source file:line. Empty category → _no findings_.
```

**Composing the source block.** Hybrid injection — Codex cannot see the chat, so Claude supplies the sources in the prompt:

- For each on-disk source: a bullet with the path and a one-line note on what it is authoritative for. Codex opens these itself — instruct it to read the source, not the target's paraphrase of it.
- For each chat-only or non-file source (a decision made in conversation, a spec pasted into chat): a sub-heading with the Claude-composed excerpt or full text embedded inline.

**Composing the secondary-lens block.** Derive zero or more secondary lenses from the specific target/source pair and write them as additional numbered checks continuing the list. The fidelity / completeness / precision core is always on; secondary lenses are the extras this particular audit needs. Examples: a lineage/supersession lens when the sources carry a supersession order ("the evolved form is live; a superseded form carried as live is a defect"); a code-is-authority lens when the target makes claims about current code behavior. These are examples, not a menu — never present a fixed lens list to the developer, and never make lens derivation the developer's job; it is Claude's.

### 3. Editable-target guard, then invoke Codex

Resolve `effective_passes` before looping — `passes > 1` requires an **on-disk editable target**:

- The target maps to a writable on-disk file → `effective_passes = passes`.
- The target is chat-only, a non-file "description", or a diff/artifact with no writable backing, **and** `passes > 1` → set `effective_passes = 1` and tell the developer the run was downgraded to a single recommend-only pass: there is nothing on disk to correct between iterations.

Then, for iteration `i = 1 … effective_passes`:

**Run with `run_in_background: true` — this is a Bash-tool parameter (set it when you call the Bash tool), not shell syntax. Codex phase, may take 10+ minutes.**

```bash
codex -a never exec \
  --sandbox read-only \
  -o tasks/logs/audits/<run>-<i>.tmp \
  "$(cat tasks/logs/audits/<run>-prompt.tmp)" </dev/null
```

If the `codex` command is not found or fails, clean this run's temps (the `find … -delete` command from Step 1), then stop and tell the developer to fix it before proceeding. Cleanup must run before the stop so the no-persistent-artifact boundary holds even on failure.

### 4. Verify the output + spot-check the relation

Verify the output first: `bash .claude/scripts/codex-output-check.sh tasks/logs/audits/<run>-<i>.tmp 5`. If the check fails, clean this run's temps, then stop and tell the developer — cleanup before the stop, as in Step 3.

Read the output FULLY (no limit/offset). **Spot-check the relation, not just the source:** for each fidelity defect, re-read from disk **both** the cited source `file:line` **and** the target location it contradicts — a fidelity defect is a relation between the two, and source-only checking can't confirm Codex read the target correctly.

**Codex's confidence is not evidence.** Codex tends to phrase findings assertively regardless of how solid they are. Weigh each finding on technical merit independent of how confidently Codex states it — deference to Codex's confidence is the failure mode here.

### 5. Triage — and apply when multi-pass

Map Codex's two buckets onto **apply / judgment call / noise**:

- **Single pass (`effective_passes = 1`) — recommend-only.** Do **not** write the target. Triage labels are computed but nothing is applied; skip to Step 6, and present per Step 7's single-pass flow.
- **Multi-pass (`effective_passes > 1`) — apply on every pass**, including the final one (each pass is `review → triage → apply`; the prompt regeneration in 5c is the only between-passes-only step). For each finding:
  - **Clear, verified fidelity defect → apply the minimal faithful edit to the TARGET now**, inline in this session. Record it in a running **applied-fixes** list. The fix lands on disk, so the next pass's Codex re-reads the corrected target — it won't re-flag it, and may catch any error the edit introduced.
  - **Judgment call, boundary note, or still-open question → do NOT edit.** Keep it on a **carry-forward** list. A fix you are not confident enough to apply is by definition a judgment call — carry it, don't force it.
  - **Noise → drop.**
  - **Guardrails:** only fidelity defects auto-apply, and edits are confined to the **target** — sources are ground truth and are never edited.

  **5c. Regenerate the prompt — only when another pass remains** (`i < effective_passes`). Rewrite `tasks/logs/audits/<run>-prompt.tmp` as the base body (Step 2) **plus ONE fresh current-state block**:

  ```
  ## ALREADY APPLIED BY PRIOR PASSES (do NOT re-report; find what these MISSED)
  <the running applied-fixes list: target location — one-line fix note (source: file:line)>

  ## OPEN QUESTIONS TO MATURE
  <the current carry-forward list — drop what got resolved or applied; keep only what is still open>
  ```

  **Regenerate, never append** — appending onto the prior block leaks stale earlier-pass state into later passes. Then loop back to Step 3 for pass `i + 1`. After the final pass (`i = effective_passes`), do not regenerate — proceed to Step 6.

### 6. Spot-check applied edits + clean up

Multi-pass only: re-verify a sample of the highest-impact applied edits — re-read each changed location against its source `file:line` to confirm the correction is faithful and introduced no new error. An over-eager edit is itself a defect.

Then (every run, single- or multi-pass) clean this run's temps — the prompt plus all per-pass outputs in one match:

```bash
find tasks/logs/audits -maxdepth 1 -name '<run>-*.tmp' -delete 2>/dev/null
```

Cleanup runs *before* the user-facing presentation because Step 7 can end in an interactive offer — a late cleanup would strand temps on an unanswered prompt. Triage operates on output already loaded into context plus on-demand re-reads of the cited files; the temps are not needed again.

### 7. Present

**Single pass (recommend-only)** — one user-facing turn that does two things, mirroring `/codex-review`:

a. **Present the raw findings**, grouped by lens header and classification label as Codex emitted them, with Step 4's spot-check caveats applied (note any cited locations that didn't hold up).

b. **Offer opt-in triage** at the end of the same response: *"Want me to triage these? I'll re-verify each against the sources, mark them as **apply** / **judgment call** / **noise**, and give you my read. I won't make changes."*

If the developer declines or ignores, the skill is done. If the developer accepts (follow-up turn): re-read every cited source line and target location in full (deeper than Step 4's sample), label each finding, and present a recommend-only view — **Recommendations** (apply-labeled findings, each with a one-line direction), **Needs your input** (judgment calls), **Filtered as noise** (count only; enumerate on `show all`). Do **not** apply anything on a single pass — even apply-labeled items are the developer's to act on. If Codex returned no findings, still make the offer; on accept, answer "no findings to triage" and end.

**Multi-pass (applied)** — report outcomes, not a to-do list:

- **Applied** — each correction folded into the target across the loop: target location, the source `file:line` that justified it, and a one-line note on what changed. State it as done, not proposed.
- **Needs your input** — the genuine survivors only: judgment calls and open questions the loop could not settle against source, each with the specific missing input that keeps it open.
- **Filtered as noise** — a count only ("N findings filtered as noise — say `show all` to see them").

---

## Important notes

- **One-shot shortcut, relational.** Produces no persistent artifact, reads no RDPI prerequisite artifacts, and writes nothing to `tasks/issues.md` or `tasks/todo.md`. The only on-disk effect is edits to the target when `passes > 1`. Technical-merit review → `/codex-review`; PR review → `/code-review` / `/security-review`.
- **Sources are ground truth.** Source docs are never edited — only the target may be written, and only on multi-pass runs.
- **Sub-agents must not be spawned** (recursion guard).
- This skill does NOT add itself to `/finish`'s cleanup list — its temps are deleted in Step 6, and they live under the gitignored `tasks/logs/audits/`, so even a stranded temp is never committed.
