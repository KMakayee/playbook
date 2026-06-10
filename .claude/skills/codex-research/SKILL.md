---
name: codex-research
description: General-purpose Codex research / grounding second opinion — codebase grounding, generative is-there-a-better-way, or external prior-art — producing a KEPT research doc under tasks/logs/research/.
argument-hint: '[topic or question]'
when_to_use: 'Manual: use when asked to "codex research X", "ground this", or "get a Codex second opinion on this question". Auto-fire ONLY immediately before stopping to ask the developer about an open question that is progress-blocking AND materially changes architecture, API, data model, security, or user-visible behavior — or a hard judgment call with no repo precedent. NEVER auto-fire for preferences, permissions, product intent, or trivial uncertainty.'
---

# Codex Research

Third in the Codex trio — `/codex-review` = technical merit, `/codex-audit` = source fidelity, **`/codex-research` = grounding / second opinion** — for the topic or question: **$ARGUMENTS**.

The skill routes each request across three modes, blending them as the question demands — **never presenting a fixed mode menu** (mirroring `/codex-audit`'s compose-never-menu philosophy):

1. **Codebase grounding** — survey what exists before acting: current behavior, established patterns, precedents, constraints.
2. **Misc / generative** — novel approaches, "is there a better way."
3. **External / prior-art** — how others solved a comparable problem, from any public source (OSS code, papers, official docs, standards, engineering writeups). Only this mode runs Codex with `--search`.

Unlike its siblings, the deliverable is a **kept research document** at `tasks/logs/research/<date>-<slug>.md` — never auto-deleted; only the prompt tmp is cleaned. Distinct from `/research-codebase` (the RDPI Phase-1 lane) and the built-in `deep-research`: this is a standalone, anytime second opinion with no RDPI prerequisites.

**Intentional auto-invocation exception.** Playbook workflow skills normally lock themselves to manual invocation via a frontmatter flag; this skill — like `/codex-review` — deliberately omits that flag so Claude can fire it unprompted. That omission is not a mistake: the skill is advisory and read-only on code — it reads no RDPI artifacts, is not pre-edit-gated (its only write is a local doc under gitignored `tasks/logs/`), and spawns no sub-agents.

## Auto-fire threshold (the entire frequency bound)

Because there is no count, no cap, and no marker file, the threshold below carries the whole bound — apply it strictly:

- Auto-fire **only** when about to stop and ask the developer, and the open question is **progress-blocking** *and* materially changes architecture / API / data model / security / user-visible behavior — **or** it is a hard judgment call with **no repo precedent**.
- **Never** auto-fire for preferences, permissions, product intent, or trivial uncertainty.
- With no numeric cap, the bound **auto-scales** with the task: a research-heavy task fires more because it surfaces more weighty open questions — correct behavior, not overshoot.
- Manual invocation has no threshold — the developer asked.

---

## Steps

### 1. Resolve the question

Two entry modes, mirroring `/codex-review`:

- **Explicit** — `$ARGUMENTS` is non-empty. Use it as the topic/question unchanged — do NOT preprocess, classify, or rewrite it.
- **Empty / bare / auto-fired** — infer the question from the triggering open question or conversational context. Ask one clarifying question only if genuinely ambiguous.

Wherever the steps below reference the question, use the resolved question.

### 2. Route the mode

Pick which of the three modes fits the question — they may blend. The route **determines the `--search` flag**: external → on; codebase / misc → off. Record the chosen route and search flag for the metadata header (Step 7).

### 3. Compute the run identifier; dedup / collision pre-check

**Slug rules (load-bearing — dedup, shell-safe paths, and overwrite avoidance all depend on them).** Lowercase `[a-z0-9-]` only; collapse repeated `-`; bounded length (≤ ~40 chars). **Deterministic** for auto-fired questions — derive the same slug from the same question text every time, with **no random token** (a random suffix would defeat dedup).

Compute the literal date (`date +%F`) and the slug:

- **Manual run** → topic-based slug from the resolved topic.
- **Auto-fired run** → question-based slug, filename shape `<date>-oq-<short>.md`.

**Choose the literal `<date>-<slug>` identifier once** and thread it **verbatim** into the prompt-tmp path, the `-o` doc path, the validation command, the metadata prepend, the cleanup, and the dedup check. Each Bash tool call is a separate shell — a value computed inside one call does not survive into the next — so do not use `$$` or command substitution in the paths; write the literal string.

**Dedup / collision pre-check.** The metadata header (Step 7) is the **completion marker**: it is prepended only after validation passes, so a `.md` carrying the header is a valid, complete, kept doc, while a headerless `.md` at the canonical path is a partial/failed leftover from an interrupted run. Resolve the target path by header presence:

- **Target path free** → write there.
- **Exists *with* the metadata header** (valid kept doc):
  - **Auto-fired, same question slug** → check the stored `question:` in that doc's metadata header. If it matches the resolved question, **reuse it**: read the existing doc and fold its findings into the answer; skip regeneration entirely (jump to Step 9). If the slug matches but the stored question differs (the ≤ ~40-char slug is lossy), treat it as a collision, not a dedup hit — append a numeric suffix as below. Dedup keys on question *identity*, not a running total — it never caps how many distinct questions get researched.
  - **Manual / distinct topic** → append a numeric suffix to the slug (`-2`, `-3`, …) so the kept doc is **never overwritten** (`codex -o` would clobber an identical path). The suffixed identifier is the run identifier from here on.
- **Exists but *headerless*** (partial/failed leftover) → safe to **overwrite**: regenerate over it. Not a dedup hit; no suffix. This self-heals a poisoned canonical path.

Best-effort note: if a prior auto-fire is still in flight (its doc not yet written), a near-duplicate may occur — accepted; the narrow threshold is the primary bound.

### 4. Make the dir + compose the prompt safely

Run `mkdir -p tasks/logs/research` (the dir may not exist yet), then write the composed prompt body to `tasks/logs/research/<date>-<slug>-prompt.tmp` with the Write tool — the question may contain quotes, backticks, or newlines, and tmp-then-`"$(cat ...)"` dodges shell-quoting hazards (the `/codex-review` convention). The gitignored dir + per-run name mean no stranded-commit risk and no concurrent-run collisions.

The prompt body must contain (Claude fills the bracketed block; the angles are ideas Codex routes among — never a menu):

```
Research question: <resolved question>

You are producing a RESEARCH / GROUNDING report — a second opinion gathered before a decision. This is not a code review and not a fidelity audit. Investigate, then report what IS, with evidence.

Angles to route among as the question demands (ideas to blend, not a menu to pick from):
- Codebase grounding — what already exists in this repo that bears on the question: current behavior, established patterns, precedents, constraints. Cite file:line for every codebase claim.
- Generative — is there a better way: alternative approaches, simplifications, well-known techniques the current framing may have missed.
- External prior-art — how others solved a comparable problem: OSS code, papers, official docs, standards, engineering writeups. Cite a source URL for every external claim.

<Claude-composed context block — the triggering open question or task context, plus any relevant paths; omit what is unknown>

Report as structured markdown:
## Summary — the direct answer or grounding, in a few sentences.
## Findings — evidence-backed findings: file:line citations for codebase claims, source URLs for external claims.
## Options / Trade-offs — when the question is a decision: the viable choices and what favors each. Omit when not a decision.
## External prior-art — when relevant: what others do, with source URLs. Omit when the question is purely internal.
## Open questions — what remains genuinely unresolved, and the specific input that would resolve each.

Rules:
- Document what IS, not what should be — except inside clearly-marked generative/options content.
- Every claim carries a citation (file:line or source URL); an uncited claim must be labeled as conjecture or dropped.
- Do not invent sources or paths. If something could not be inspected, say so explicitly.
```

### 5. Invoke Codex in the background

**Run with `run_in_background: true` — this is a Bash-tool parameter (set it when you call the Bash tool), not shell syntax. Codex phase, may take 10+ minutes.** The turn yields; the completion notification re-invokes for validation and reading. Continuing other main-task work during the wait is optional, never required.

Codebase / misc mode (no `--search`):

```bash
codex -c model_reasoning_effort=xhigh -a never exec \
  --sandbox read-only \
  -o tasks/logs/research/<date>-<slug>.md \
  "$(cat tasks/logs/research/<date>-<slug>-prompt.tmp)" </dev/null
```

External / prior-art mode (top-level `--search` before `exec`):

```bash
codex -c model_reasoning_effort=xhigh --search -a never exec \
  --sandbox read-only \
  -o tasks/logs/research/<date>-<slug>.md \
  "$(cat tasks/logs/research/<date>-<slug>-prompt.tmp)" </dev/null
```

`-o` writes the kept doc directly — there is no output tmp, which structurally defuses the cleanup-asymmetry footgun. `-o` writes succeed under `--sandbox read-only`.

If the `codex` command is not found or fails, clean the prompt tmp (the Step 8 command), then stop and tell the developer to fix it before proceeding.

### 6. Validate the output

Verify before reading:

```bash
bash .claude/scripts/codex-output-check.sh tasks/logs/research/<date>-<slug>.md 20
```

Min-lines 20 matches the research lane (`/research-codebase`); the metadata header is prepended *after* this check, so the floor applies to Codex's raw report.

**On FAIL:** the doc at the canonical path is a failed/partial output. Clean the prompt tmp (the Step 8 command), report the doc path as **failed/partial** — do not surface it as trustworthy, and never offer promotion for it — then stop and inform the developer. Because the header is only prepended on success (Step 7), the failed doc is headerless, and the Step 3 resolution rule treats it as safe-to-overwrite on a future run: a failed run cannot poison dedup.

### 7. Read fully, spot-check, prepend the metadata header

Read the kept doc FULLY (no limit/offset). Spot-check a sample of cited `file:line` references and source URLs — flag any that do not hold up, and carry those caveats into Step 9's surfacing.

**Codex's confidence is not evidence.** Codex tends to phrase findings assertively regardless of how solid they are. Weigh each finding on technical merit independent of how confidently Codex states it.

Then **prepend** the metadata header to the kept doc — Claude composes it from values it already owns (trigger, route, search, question, slug, date, paths), so the prepend is deterministic:

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

Header values must keep the header parseable: write `question` (and any other free-text value) on a single line when it is plain; if it contains YAML-special characters (such as `: `, quotes, or `#`) or newlines, use a block scalar — `question: |-` with the text indented on the following lines. A malformed header would silently stop acting as the completion marker.

This is an edit to the skill's *own output doc* (not a source file; not pre-edit-gated). The header backs scannability, dedup-by-slug (it is the completion marker from Step 3), and safe promotion.

### 8. Clean the prompt tmp ONLY — keep the doc

```bash
rm -f tasks/logs/research/<date>-<slug>-prompt.tmp
```

**Footgun callout — the single most error-prone spot in this skill.** The deliverable and the prompt tmp live in the same directory, and this skill *inverts* the sibling lifecycle: the output is kept, not cleaned. The exact-path command above is glob-free and can never match the `.md` deliverable — it is the **only** deletion this skill performs. **KEEP** `tasks/logs/research/<date>-<slug>.md`. Never delete the kept doc; do NOT add it to `/finish`'s cleanup list; a copy-pasted sibling cleanup step (which deletes its output tmp before presenting) would destroy the deliverable here. The directory is gitignored, so even a prompt tmp stranded by a crashed run can never be committed.

### 9. Staleness re-check, then surface

Before surfacing — especially when auto-fired — re-check whether the triggering blocker or open question is **still relevant**: context may have compacted, or the question may have self-resolved while Codex ran. If stale → **fold the finding in quietly or drop it**; do not interrupt with a now-stale answer.

Otherwise, surface the grounding or resolution (with Step 7's spot-check caveats applied) plus the kept doc path.

### 10. Offer promotion (conditional, human-gated)

Default: the doc stays local and uncommitted under gitignored `tasks/logs/research/`.

When the doc becomes a **cited evidence / reference trail** for a design, implementation, or docs decision → **offer** to promote (copy) it into a committed location: the relevant component's `docs/` when the topic clearly maps to one component, else `docs/research/`. **Never promote without developer confirmation.** Never offer promotion for a failed/partial doc (Step 6).

---

## Important notes

- **Sub-agents must not be spawned** (recursion guard).
- Reads no RDPI prerequisite artifacts; not pre-edit-gated — its only writes are the local research doc (plus that doc's metadata header) and the prompt tmp. Writes nothing to `tasks/issues.md` or `tasks/todo.md`.
- The kept doc is never auto-deleted and is not in `/finish`'s cleanup list.
- Purely additive: `/codex-review`, `/codex-audit`, `deep-research`, and `/research-codebase` are unchanged and unaffected.
