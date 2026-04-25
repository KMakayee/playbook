# Codex Review

A one-shot Codex second-opinion pass over an arbitrary target — file, diff, artifact, or freeform string — for the target: **$ARGUMENTS** (distinct from any `/code-review` or `/security-review` plugin commands, which run full PR-review workflows).

If `$ARGUMENTS` is empty or blank, stop and tell the developer to re-invoke with a target (e.g., `/codex-review path/to/file.ts`, `/codex-review tasks/design-decision.md`, or `/codex-review "the retry-budget assumption in the ingest worker"`). Do not auto-pick a target.

This command produces no persistent artifact, reads no prerequisite artifacts, and writes nothing to `tasks/issues.md` or `tasks/todo.md`. It is a one-shot shortcut for a Codex pass with optional Claude triage on top.

---

## Steps

### 1. Pre-delete stale temp files

A failed previous run can leave temp files behind that look like fresh output. Run:

```bash
rm -f tasks/codex-review.tmp tasks/codex-review-prompt.tmp
```

### 2. Compose the Codex prompt safely

Write the composed prompt body to `tasks/codex-review-prompt.tmp` first — `$ARGUMENTS` may contain quotes, backticks, or newlines, and writing to a tmp file then reading via `"$(cat ...)"` avoids shell-quoting hazards. This mirrors the convention in `.claude/commands/research-codebase.md:40`.

The prompt body interpolated into `tasks/codex-review-prompt.tmp` must contain (interpolate `$ARGUMENTS` literally — do NOT preprocess, classify, or rewrite it):

```
Target to review: $ARGUMENTS

You are doing a one-shot second-opinion pass over the target above. The target may be a file path, a diff, an artifact (e.g., a markdown plan or design doc), or a freeform description.

Evaluate the target on technical merit. Do not defer to it as authoritative simply because it is the input — the target is context, not a constraint.

Apply three lenses:

1. Factual / correctness — bugs in code, stale references in artifacts, contradictions with surrounding context, claims that do not hold up against the actual codebase.
2. Simplest-approach — over-abstraction, redundant logic, fewer-files-fewer-moving-parts wins, simpler tool / pattern / technique that would solve the problem better.
3. Pattern / best-practice — anti-patterns, misused idioms, established conventions the target ignores, places where a well-known pattern would be a better fit.

Classify each finding as either:
- **factual issue** — clear right answer; the finding is a bug, stale reference, or unambiguous error.
- **judgment call** — defensible alternatives exist; reasonable people could disagree on direction.

Be specific with file paths and line numbers (or section / heading references for non-code targets). Without a precise location, the finding is not actionable.

Report findings only — no remediation plan or task sequence. A brief one-line direction per finding (what to change or which way to go) is fine; multi-step fix sequences are not.

If the target is ambiguous (e.g., a glob, an unquoted multi-word phrase, a non-existent path), state explicitly what you could and could not inspect, and proceed with what you have. Do not invent a target.

Format findings under the lens names as section headers (e.g., `## Factual / correctness`, `## Simplest-approach`, `## Pattern / best-practice`). Within each section, list findings as bullet items prefixed with the classification label in bold (e.g., `- **factual issue:** ...` or `- **judgment call:** ...`). If a lens has no findings, write `_no findings_` under that header.
```

### 3. Invoke Codex

Run with a 10-minute timeout (600000ms) — Codex may take a while on larger targets:

```bash
codex exec \
  --sandbox read-only \
  -o tasks/codex-review.tmp \
  "$(cat tasks/codex-review-prompt.tmp)"
```

If the `codex` command is not found or fails, run `rm -f tasks/codex-review.tmp tasks/codex-review-prompt.tmp`, then stop and tell the developer to fix it before proceeding. Cleanup must run before the stop so the no-persistent-artifact boundary holds even on failure.

### 4. Spot-check Codex's claims

Read `tasks/codex-review.tmp` FULLY (no limit/offset). Verify a sample of the file paths and line numbers Codex cited — do they exist and match what Codex described? Flag any that don't hold up; carry the caveats forward into Step 6.

**Codex's confidence is not evidence.** Codex tends to phrase findings assertively regardless of how solid they are. Weigh each finding on technical merit independent of how confidently Codex states it — deference to Codex's confidence is the failure mode here.

### 5. Clean up

Both temp files are deleted *before* the user-facing presentation in Step 6:

```bash
rm -f tasks/codex-review.tmp tasks/codex-review-prompt.tmp
```

This matches the cleanup-then-present convention in `.claude/commands/research-codebase.md`, `.claude/commands/design.md`, and `.claude/commands/create-plan.md`. Cleanup-before-present is load-bearing here because Step 6 ends in an interactive prompt — if cleanup were after, an unanswered offer would leave temp files behind. Triage in Step 6 operates on Codex's output already loaded into Claude's context (from Step 4) plus on-demand reads of the cited source files; it does not need the temp file. This command does NOT add itself to `/finish`'s cleanup list — its temp files are deleted in this step.

### 6. Present findings + offer triage

Single user-facing turn that does two things in one response:

a. **Present the raw findings** to the developer, grouped by lens and classification label as Codex emitted them. Pass through with the Step 4 spot-check caveats applied (note any cited paths/lines that didn't hold up). This is the unmodified Codex output — no triage filtering yet.

b. **Offer opt-in triage** at the end of the same response, with phrasing along these lines:

   > *"Want me to triage these? I'll re-verify each against the code, mark them as **apply** / **judgment call** / **noise**, and give you my read. I won't make changes."*

- **If the developer declines or ignores:** the command is done.
- **If the developer accepts (in a follow-up turn):** for each finding, Claude:
  1. Re-reads the cited file/section in full from disk (deeper than Step 4's sample spot-check — every cited line, not a sample). The temp files are gone by now (cleaned up in Step 5), but the actual source files referenced by Codex are unchanged.
  2. Evaluates the finding against the actual code, not just Codex's framing — does it hold up? Is Codex's implied direction the simplest fix, or is there a better one?
  3. Labels the finding:
     - **apply** — factual issue; deep verification passed; fix is clear and scoped.
     - **judgment call** — defensible alternatives; needs developer input on direction.
     - **noise** — false positive, didn't survive deeper verification, or subjective style.
  4. Adds a one-line recommendation per finding ("would apply this," "would skip — Codex misread the API," "needs your call — both directions are defensible").

  Present a **recommend-only view** — the triage labels are computed internally but the output is filtered to the items worth surfacing:

  - **Recommendations** — list each **apply** finding as an actual recommendation Claude is willing to defend, with the one-line direction inline. These are the items Claude believes are worth acting on.
  - **Needs your input** — list each **judgment call** finding under this subsection; defensible alternatives exist and the developer should weigh in. Include the one-line "needs your call — both directions are defensible" framing.
  - **Filtered as noise** — collapse to a count only (e.g., *"3 findings filtered as noise — say `show all` to see them"*). Do NOT enumerate noise items by default.

  If the developer asks for `show all` (or equivalent — "show noise," "list them") in a follow-up turn, present the noise items with their one-line "would skip — ..." recommendations. Otherwise, the noise bucket stays collapsed.

  Do NOT apply any changes — even on **apply** items, the developer drives action. This preserves the shortcut framing of the command. If the developer asks Claude in a follow-up turn to apply a specific finding, that's a separate request outside this command.

  The triage view is pure conversation — no temp file is written for it, no artifact is mutated.

  **Edge case — Codex returned no findings:** the triage offer is still made (the developer doesn't know Codex was clean unless told), but if accepted, Claude responds with "no findings to triage" and the command ends.

---

## Important notes

- **One-shot shortcut.** This command produces no persistent artifact and reads no prerequisites. It does not integrate with `/research-codebase`, `/design`, `/create-plan`, `/implement`, or `/finish`.
- **Sub-agents must not be spawned** (recursion guard).
