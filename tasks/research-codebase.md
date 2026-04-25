# Research: `/codex-review <target>` — generalized Codex review entry point

## Research Question

From `tasks/todo.md` Task 2:

> Ship a generalized Codex review entry point — Add a simple `/codex-review <target>` for ad-hoc second-opinion reviews. Consolidate the unbiased-review principles already encoded across the existing Codex-driven review prompts (research, plan, code review) into one generalized prompt so any target — a file, a diff, an artifact — gets the same framing. Purpose: replace ad-hoc Codex invocations that drift from the principles established elsewhere in the playbook. Keep it simple — no task-lifecycle integration, just a shortcut.

## Summary

The playbook already has seven Codex-driven review touchpoints (one per QRSPI phase plus three on the issue surface). Each was authored independently, and the unbiased-review principles they encode have drifted: spot-checking is universal but worded differently; the CORRECTION vs TRADE-OFF classification appears in plan reviews only; "Codex's confidence is not evidence" lives in `design.md` alone; the simplest-approach lens is restated three different ways. A generalized `/codex-review <target>` needs to (a) extract the consensus principles into one prompt body, (b) accept any target — file, diff, artifact, or freeform string — without per-target branching, and (c) avoid the lifecycle scaffolding that ties the existing reviews to specific QRSPI phases (artifact preconditions, status updates, follow-up `/issue-*` commands).

The command is genuinely a shortcut: input is `<target>`, output is a Codex review the developer reads. There is no preceding artifact to load, no status to mutate, no follow-on command. Most of the design surface is in the prompt content (which principles to lift, how to phrase them generically) rather than the command shell. The shell can mirror the established `codex exec --sandbox read-only -o tasks/<tmp>` → read → present → clean-up pattern with minimal variation.

## Detailed Findings

### Existing Codex-driven review surface (the seven touchpoints)

1. **Research** — [.claude/prompts/research-guide.md](.claude/prompts/research-guide.md) loaded by [.claude/commands/research-codebase.md:50-58](.claude/commands/research-codebase.md). Codex maps files, enumerates axes, surfaces external knowledge gaps. Tone: "Be exhaustive — breadth matters more than depth"; "Flag ambiguities — if something is unclear, say so".
2. **Design cross-check** — Inline in [.claude/commands/design.md:84-103](.claude/commands/design.md). Three-phase prompt: PHASE 1 independent design (explicitly "do this BEFORE reading tasks/design-decision.md" to prevent anchoring), PHASE 2 cross-check, PHASE 3 recommend. Plus a one-shot tiebreaker prompt at [.claude/commands/design.md:133-140](.claude/commands/design.md).
3. **Plan review** — Inline in [.claude/commands/create-plan.md:51-75](.claude/commands/create-plan.md). Four parts: judgment calls / feasibility / completeness / risk. Introduces the **CORRECTION vs TRADE-OFF** classification: "Do not present corrections as open questions."
4. **Code review** — Inline in [.claude/commands/implement.md:60-78](.claude/commands/implement.md). Two parts: plan adherence / independent code quality. Lens for Part 2: bugs/edge cases/error handling, simplification (unnecessary abstractions, over-engineering, redundant logic, verbose patterns), patterns/best practices (anti-patterns, misused idioms), simplest-approach.
5. **Issue research** — [.claude/commands/issue-research-codex.md:22-39](.claude/commands/issue-research-codex.md). Same structure as `research-codebase.md` but also asks Codex to propose an implementation approach (because the issue workflow skips `/design`).
6. **Issue plan review** — [.claude/commands/issue-plan-review-codex.md:13-40](.claude/commands/issue-plan-review-codex.md). Five parts: AC coverage / judgment calls / feasibility / completeness / risk. Same CORRECTION vs TRADE-OFF classification as `create-plan.md`.
7. **Issue code review** — [.claude/commands/issue-code-review-codex.md:13-35](.claude/commands/issue-code-review-codex.md). Three parts: plan adherence / acceptance criteria / independent code quality. Same independent-quality lens as `implement.md`.

### The unbiased-review principles, consolidated

Walking the seven prompts side by side, these principles are present in two or more and form the de-facto consensus:

| Principle | Where it appears | Status |
|---|---|---|
| `--sandbox read-only` | All 7 | Universal |
| 10-min timeout (600000ms) | All 7 | Universal |
| "Be specific with file paths and line numbers" | All 7 | Universal |
| Spot-check Codex's claims (consumer side) | research-codebase, design, create-plan, implement (consumer steps) | Universal in consumers |
| Evaluate on technical merit, plan-not-infallible | design, create-plan, implement, issue-plan-review, issue-code-review | 5/7 — strong consensus |
| Simplest-approach lens (fewer files/abstractions/moving parts) | design, create-plan, implement, issue-plan-review, issue-code-review | 5/7 — strong consensus |
| Independent-first (no peeking at the draft) | design Phase 1 only | 1/7 — but load-bearing where it appears |
| CORRECTION vs TRADE-OFF classification | create-plan, issue-plan-review | 2/7 — only in plan reviews |
| "Codex's confidence is not evidence" | design synthesis step | 1/7 — but applies universally |
| Identify the simplification target type (bug / over-abstraction / pattern violation) | implement, issue-code-review | 2/7 — code-review-specific framing |

### How `<target>` shows up in real usage

The task description names three target types: file, diff, artifact. Each maps to an existing Codex review:

- **File** → similar to the independent-code-quality block in `implement.md` Part 2.
- **Diff** → similar to the plan-adherence block in `implement.md` Part 1, minus the plan reference (here the diff is the entire input).
- **Artifact** (e.g., a plan, a research doc, a design doc, a freeform spec) → similar to the feasibility/completeness/risk blocks in `create-plan.md`.

The prompt should ask Codex to inspect whatever the target is on three lenses universally:

1. **Factual / correctness lens** — bugs in code, stale references in artifacts, contradictions with what's around the target.
2. **Simplest-approach lens** — over-abstraction, redundant logic, fewer-files-fewer-moving-parts, simpler tool/pattern available.
3. **Pattern / best-practice lens** — anti-patterns, misused idioms, missing established conventions.

The CORRECTION vs TRADE-OFF labels generalize cleanly if we restate them as "factual issue vs judgment call" — which is what they already mean in `create-plan.md`, just phrased against an "input document". Without an input document the labels still hold: "this line has a bug" is factual; "this could be split differently" is judgment.

### Existing command shell conventions

Reading [.claude/commands/research-codebase.md](.claude/commands/research-codebase.md), [.claude/commands/design.md](.claude/commands/design.md), [.claude/commands/create-plan.md](.claude/commands/create-plan.md), and [.claude/commands/implement.md](.claude/commands/implement.md), the consistent shell pattern is:

```
1. Compose prompt (inline or via .claude/prompts/<name>.md template substitution)
2. Write composed prompt to tasks/<name>-prompt.tmp (only when externalized)
3. Run codex exec --sandbox read-only -o tasks/<name>.tmp "<prompt>"
4. Read tasks/<name>.tmp FULLY
5. Spot-check Codex's claims
6. Present/absorb findings
7. Delete tasks/<name>.tmp (and the prompt tmp if used)
8. Codex-not-found fallback message
```

`$ARGUMENTS` is the standard arg-substitution token (used in `auto-issues.md`, all `issue-*` commands). It is the literal string the developer typed after the slash command — there's no built-in tokenization.

### Lifecycle integration the existing commands carry (and `/codex-review` should NOT)

Each existing review command has scaffolding that ties it to its phase:

- Prerequisite checks (e.g., `/design` requires `tasks/research-codebase.md`).
- Output absorbed into a downstream artifact (e.g., create-plan absorbs review findings back into `tasks/plan.md`).
- Status updates (e.g., issue commands flip status in `tasks/issues.md`).
- Follow-on command suggestions (e.g., issue research ends with "Run `/issue-plan $ARGUMENTS`").
- Cleanup tied to artifact lifecycle (e.g., `/finish` removes QRSPI artifacts).

The task explicitly excludes all of this: "Keep it simple — no task-lifecycle integration, just a shortcut." So `/codex-review`:

- Reads no prerequisite artifacts.
- Writes no persistent artifact (only the temp file, which it deletes).
- Updates no status.
- Suggests no follow-on command.
- Has no place in `/finish`'s cleanup list.

## Code References

- `.claude/commands/research-codebase.md:50-58` — Codex research invocation pattern with externalized prompt template
- `.claude/prompts/research-guide.md:1-78` — Externalized review-prompt template with `{TASK}` and `{SEARCH_HINTS}` placeholders
- `.claude/commands/design.md:84-103` — Three-phase Codex design prompt with explicit anti-anchoring instruction
- `.claude/commands/design.md:126` — "Codex's confidence is not evidence" principle
- `.claude/commands/design.md:133-140` — Tiebreaker prompt with `{SPECIFIC_QUESTION}` placeholder
- `.claude/commands/create-plan.md:51-75` — Plan-review prompt; introduces CORRECTION vs TRADE-OFF classification
- `.claude/commands/create-plan.md:60-62` — Verbatim CORRECTION vs TRADE-OFF spec
- `.claude/commands/implement.md:60-78` — Code-review prompt with two-part adherence + independent-quality structure
- `.claude/commands/implement.md:71-77` — Independent-code-quality lens (bugs, simplification, patterns, simplest approach)
- `.claude/commands/issue-research-codex.md:22-39` — Issue-flavored research review (also proposes an approach)
- `.claude/commands/issue-plan-review-codex.md:13-40` — Five-part plan review with same CORRECTION/TRADE-OFF labels
- `.claude/commands/issue-code-review-codex.md:13-35` — Three-part code review (plan adherence + AC + quality)
- `.claude/commands/auto-issues.md:24` — `$ARGUMENTS` usage convention
- `.claude/commands/checkpoint.md:1-13` — Example of a minimal command (relevant: `/codex-review` is similarly small)

## Architecture Analysis

**Why two prompt-storage patterns coexist (inline vs externalized):** Of the seven prompts, six are inlined in their `.claude/commands/*.md` and only one (`research-guide.md`) is externalized to `.claude/prompts/`. The split tracks reuse: `research-guide.md` was extracted because the same template was used by the QRSPI flow and by the issue flow (`issue-research-codex.md` does not actually reuse it today, but the shape is similar enough that extraction was anticipated). For `/codex-review`, the prompt has only one consumer and the inline pattern matches the majority precedent.

**Why `tasks/<name>.tmp` (not `<name>.md`) for Codex output:** Throughout the codebase, files ending in `.tmp` are consumed and deleted within the command run; `.md` files persist and are part of the artifact lifecycle. `/codex-review` writes nothing persistent, so its output should be a `.tmp` file — `tasks/codex-review.tmp` — that the command itself deletes after presenting.

**Why CORRECTION vs TRADE-OFF was scoped to plan reviews:** Plan reviews compare a derivative artifact (the plan) against authoritative source documents (research/design/issue). The labels separate "the plan got the input document wrong" (apply silently) from "the plan made a defensible judgment you might disagree with" (developer decides). For a freeform `/codex-review` target there's no input document to compare against, but the underlying distinction — factual issue vs judgment call — still cleanly applies. The labels can be lifted with light rewording.

**Why "Codex's confidence is not evidence" lives only in `design.md`:** Phase 3 of the design prompt explicitly instructs Codex to recommend assertively, which is exactly what triggers the warning. The same warning applies generically to any Codex output (Codex defaults to assertive prose), but it's load-bearing in design and merely useful elsewhere. A generalized command should include it as a consumer-side principle, not a Codex-side instruction.

**Why every consumer step starts with a spot-check:** Codex hallucinates file paths and line numbers in practice — confirmed in design.md:112-114, create-plan.md:81-83, implement.md:84-89. The spot-check is a stable, universal step regardless of target type.

## Design Axes

### Axis A: Target shape interpretation

How does the command interpret `<target>`?

- **Choices:**
  - **A1 — Pass-through.** The literal `<target>` string is interpolated into the Codex prompt; Codex figures out whether it's a file path, a diff command, an artifact path, or a freeform description. Claude does no preprocessing.
  - **A2 — Light classification.** Claude (parent) inspects `<target>` heuristically (does the path exist as a file? does it match a known artifact path? does it look like a diff ref?) and tailors a one-line "what kind of target this is" preface in the prompt. No branching of the review body.
  - **A3 — Strict typing.** Claude requires `<target>` to follow a typed syntax (e.g., `file:path`, `diff:ref...HEAD`, `artifact:path`). Rejects anything ambiguous.
- **Per-axis constraints:** task body says "any target — a file, a diff, an artifact" without prescribing a syntax. A3 adds friction the task explicitly avoids ("Keep it simple"). A1 and A2 are both viable; A1 is simpler, A2 produces marginally more focused Codex output.
- **Evidence:** [tasks/todo.md:32](tasks/todo.md); [.claude/commands/auto-issues.md:24](.claude/commands/auto-issues.md) — `$ARGUMENTS` is just the literal string with no built-in tokenization, matching A1 by default.

### Axis B: Prompt body structure

How is the review body organized?

- **B1 — One generalized lens block.** A single set of "review the target on these lenses" instructions (factual/correctness, simplest-approach, pattern). No branching by target type.
- **B2 — Optional per-type guidance.** Generalized lens block plus a short "if the target is code, also check X; if it's a plan-shaped artifact, also check Y" tail. The lens block applies universally; the tail only fires if the target shape happens to match.
- **B3 — Per-type prompt branches.** Three separate prompt bodies selected by target type. Not viable: explicitly contradicts the task's "one generalized prompt so any target ... gets the same framing".
- **Per-axis constraints:** task says "one generalized prompt" — B3 ruled out. B2 risks drifting back toward branching if the tail grows.
- **Evidence:** [tasks/todo.md:32](tasks/todo.md).

### Axis C: Which principles to lift into the prompt

Which of the consensus principles get baked into the generalized prompt body?

- **C1 — Universal-only (5/7+).** Lift only principles present in 5+ of the existing prompts: `--sandbox read-only`, file:line specificity, simplest-approach lens, technical-merit framing.
- **C2 — Consensus + selectively-applicable.** C1 plus principles that aren't universal but generalize cleanly: spot-checking (consumer side), CORRECTION vs TRADE-OFF reframed as factual-vs-judgment, "Codex's confidence is not evidence" (consumer side).
- **C3 — Maximal lift.** C2 plus design-specific elements like the PHASE 1/PHASE 2 anti-anchoring structure. Likely overkill for a shortcut and only meaningful when there's a Claude-authored draft to anchor on (which there isn't here).
- **Per-axis constraints:** task says "consolidate the unbiased-review principles already encoded across the existing Codex-driven review prompts" — pushes beyond C1 toward C2. C3 adds machinery (phased prompt) for an anchoring problem that doesn't exist in this command's threat model (no upstream Claude draft).
- **Evidence:** Principle audit table in §Detailed Findings; [.claude/commands/design.md:91](.claude/commands/design.md) (anti-anchoring is Phase-1-specific).

### Axis D: Output handling

What happens to Codex's output?

- **D1 — Temp file → read → present → delete.** Mirrors every other Codex command: `tasks/codex-review.tmp` is written by `codex exec -o`, read by Claude, presented to the developer, and deleted in a cleanup step.
- **D2 — Stream to stdout, no temp file.** `codex exec` without `-o` so output streams to the developer directly; Claude doesn't intermediate.
- **D3 — Persistent artifact.** Write to a stable path like `tasks/codex-review-<slug>.md` for the developer to keep. Ruled out by "no task-lifecycle integration".
- **Per-axis constraints:** D3 ruled out. D2 makes spot-checking impossible (Claude doesn't see the output). D1 is the established convention and preserves spot-check capability.
- **Evidence:** [tasks/todo.md:32](tasks/todo.md) (no lifecycle); spot-check pattern across all consumer commands (universal).

### Axis E: Synthesis depth on the consumer side

How much does Claude do with Codex's output before showing it to the developer?

- **E1 — Pass-through.** Claude reads the temp file and emits it verbatim, plus a one-line "ran Codex against `<target>`" header.
- **E2 — Spot-check + present.** Claude verifies a sample of file:line references Codex cited, flags any that don't match, then presents the findings (matches the universal spot-check pattern).
- **E3 — Triage.** Claude classifies findings into FIX / SKIP / FLAG buckets like in `implement.md` Step 7. Implies remediation; doesn't fit "ad-hoc shortcut".
- **Per-axis constraints:** spot-checking is universal in the playbook — E1 violates that consensus. E3 implies a follow-up action the task explicitly excludes. E2 fits.
- **Evidence:** spot-check appearances at [.claude/commands/research-codebase.md (synthesis step)](.claude/commands/research-codebase.md), [.claude/commands/design.md:112-114](.claude/commands/design.md), [.claude/commands/create-plan.md:81-83](.claude/commands/create-plan.md), [.claude/commands/implement.md:84-89](.claude/commands/implement.md).

### Axis F: Where the prompt template lives

- **F1 — Inline in `.claude/commands/codex-review.md`.** Matches `design.md`, `create-plan.md`, `implement.md` (4/7 of the existing review prompts).
- **F2 — Externalized to `.claude/prompts/codex-review-guide.md`.** Matches `research-guide.md` (1/7). Justified only when reused by multiple commands; this prompt has one consumer.
- **Per-axis constraints:** Task 7 (skill port) is mechanical — it copies whatever exists. Either choice survives the port. Inline matches majority precedent and avoids an unnecessary file.
- **Evidence:** existing command-vs-prompt split documented in §Architecture Analysis.

### Axis G: Multi-target vs single-target

- **G1 — Single target.** `<target>` is one string; reviewing multiple files requires multiple invocations.
- **G2 — Multi-target.** `<target>` may contain multiple space-separated entries; the prompt asks Codex to review each.
- **Per-axis constraints:** task signature is `/codex-review <target>` (singular). Multi-target is a feature increment, not a requirement, and complicates the prompt template. Defer to a single target for v1.
- **Evidence:** [tasks/todo.md:32](tasks/todo.md).

## Axis Coupling

- **B (prompt body) × A (target shape):** If A2 (light classification) is chosen, the prompt body can stay B1 (single lens block) by adding only a one-line preface. If A1 (pass-through) is chosen, B1 still works but Codex has to infer target shape from its own reading. The coupling is weak — both A1 and A2 work with B1.
- **D (output) × E (synthesis):** D2 (stdout) precludes E2 (spot-check) since Claude never sees the output. D1 + E2 is the only consistent pair.
- **C (principles) × F (location):** Principles selected at C2 and above don't change with F (location). No coupling.

## Cross-Cutting Constraints

- Codex invocation must use `codex exec --sandbox read-only` (universal across all 7 existing review commands).
- 10-minute timeout (600000ms) on the Bash call.
- Slash command name in lowercase with dashes: `codex-review` matches `research-codebase`, `create-plan`, `playbook-audit`, `push-pr-light`, `issue-plan-review-codex`.
- File path: `.claude/commands/codex-review.md` (Task 7 will move it to `.claude/skills/codex-review/` later; that's not this task's concern).
- Standard codex-not-found fallback message: "If the `codex` command is not found or fails, stop and tell the developer to fix it before proceeding."
- `$ARGUMENTS` token for the literal arg string (no built-in tokenization).
- Generalized prompt must produce file/section/line references with the same specificity as the existing prompts ("Be specific with file paths and line numbers" — universal, but for non-code targets becomes "be specific with section/heading references").
- The command must NOT add itself to any cleanup list in `/finish`, any prerequisite check in `/design`/`/create-plan`/`/implement`, or any artifact-listing in `tasks/issues.md` or `tasks/todo.md` workflows. It is a leaf command.

## External Research

None required. Every axis choice is fully evaluable from codebase + task spec alone — there are no external libraries, protocols, APIs, or standards involved. The deliverable is a Markdown command file and an embedded Codex prompt; both are entirely playbook-internal.

## Risk Analysis

- **Generalization → shallow output.** A single prompt that works for "any target" risks producing generic findings ("looks fine, no obvious bugs") when the target is shapeless. Mitigation: keep the lens block concrete (factual/correctness, simplest-approach, pattern) so Codex always has three named axes to populate, even when the target is freeform.
- **Argument ambiguity.** A bare `<target>` string has no syntax — Codex has to interpret it. If Claude doesn't classify (Axis A1), edge cases like `<target>` being a glob, an unquoted multi-word phrase, or a non-existent path will produce confused Codex output. Mitigation: A2 (light classification — does the path exist? is it inside `tasks/`? does it look like a `git diff` ref?) for marginal robustness without lifecycle weight.
- **CORRECTION/TRADE-OFF labels don't fit non-code targets.** The labels were designed against an "input document" baseline. For freeform targets the equivalent framing is "factual issue (clear right answer) vs judgment call (defensible alternatives)" — same idea, more general wording.
- **`/codex-review` semantically overlaps with `/code-review` and `/security-review`** (the latter are plugin commands listed in the available-skills section). The plugin commands are review _workflows_ over a PR; `/codex-review <target>` is a one-shot Codex pass over an arbitrary target. Mitigation: name the difference explicitly in the command's opening line so users don't reach for it when they want a full PR review.
- **Drift back to inline ad-hoc Codex calls.** The whole point of this task is to stop drift. The mitigation is the prompt itself — it must be expressive enough that developers actually use the slash command instead of typing `codex exec` by hand. Keep it short, give it a memorable name, make the principles legible.
- **Task 7 will port this to a skill.** The port is mechanical (`.claude/commands/codex-review.md` → `.claude/skills/codex-review/SKILL.md`). Keeping the prompt inline (Axis F1) makes the port a one-file move; externalization (F2) makes it a two-file move with internal references to update.

## Open Questions

- **OQ1 (non-blocking):** Should the prompt explicitly include the design-style "Codex's confidence is not evidence" warning as consumer-side guidance to Claude (the parent), or fold it into spot-checking? The principle applies universally but is currently isolated to design.md. Recommendation: include as a one-line note in the consumer-side section of the command, not in the Codex prompt body.
- **OQ2 (non-blocking):** Should the command refuse `<target>` if empty / blank, mirroring the pattern in `/research-codebase` and `/create-todo`? Recommendation: yes — emit a one-line usage hint and stop.
- **OQ3 (non-blocking):** Should `/codex-review` write its temp file under `tasks/codex-review.tmp` (matches the existing pattern) or somewhere outside `tasks/` (since the command has no lifecycle ties to QRSPI)? Recommendation: `tasks/codex-review.tmp` — `tasks/` is already where `.tmp` files live and the command deletes it before exit, so there's no lifecycle bleed.
- **OQ4 (non-blocking):** Does the prompt need a section explicitly telling Codex "do not propose a plan / do not recommend a fix sequence" to keep the output to findings only? The existing review prompts implicitly avoid this by their structure; for a generalized prompt, an explicit "report findings; do not propose remediation steps" line may be worth adding.
