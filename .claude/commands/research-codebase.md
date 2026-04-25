# Research Codebase

Research the codebase for the task described by the user: **$ARGUMENTS**

If `$ARGUMENTS` is empty or blank, stop and tell the user to re-invoke with a short prompt describing the research target (e.g., `/research-codebase add retry logic to the ingest worker`). Do not auto-pick from `tasks/todo.md` — the caller is responsible for selecting a task that is dependency- and OQ-ready.

**Readiness preflight.** Before kicking off Codex, scan `tasks/todo.md` and any linked spec/OQ doc for entries that match the target. If the target references or depends on unresolved Open Questions, blocked-by markers, or pre-registrations, stop and list the unresolved gates to the user. Do not start research until the caller either resolves the gates or explicitly confirms they want to proceed anyway.

This command uses a two-stage research process:
1. **Codex** does the broad sweep — maps files, enumerates options, establishes constraints
2. **Claude** synthesizes — adds the diagnostic layer (why, not just what), fills gaps, connects the dots

---

## Steps

### 1. Check for prior artifacts
- If any of `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/research-patterns.md`, or `tasks/plan.md` exist, stop. List which files are present and tell the developer to finalize the prior task (e.g., via `/finish`) or manually remove the artifacts before starting new research.
- Do not proceed until the `tasks/` directory is free of these four files.

### 2. Read any directly mentioned files first
- If the user mentions specific files (tickets, docs, JSON), read them FULLY first.
- **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files.
- **CRITICAL**: Read these files yourself in the main context before proceeding.

### 3. Run Codex research
Codex leads the exploration. It maps the codebase, enumerates the solution space, and establishes constraints.

1. Read the prompt template from `.claude/prompts/research-guide.md`.
2. Compose the `{TASK}` block:
   - Describe the goal and why it matters (1-2 paragraphs)
   - Reference key docs the task depends on (strategy files, specs, checkpoints)
   - Do NOT decompose the task into sub-steps or list implementation approaches — Codex forms its own understanding from the docs
3. Compose the `{SEARCH_HINTS}` block with three sub-sections:
   - **Key files to start from:** file paths and glob patterns relevant to the task (found by reading the task description and referenced docs)
   - **Known interfaces/APIs involved:** type names, function signatures, external APIs the task touches
   - **Fixed params/constraints from prior work:** locked values, version pins, or decisions from earlier phases that the task inherits
   Only include concrete facts (paths, names, values). Do not include analysis, opinions, or suggested approaches.
4. Replace `{TASK}` and `{SEARCH_HINTS}` in the template. Do NOT modify the investigation sections (1-7) — they stay generic.
5. Write the composed prompt to `tasks/codex-prompt.tmp`.
6. Run:
   ```bash
   codex -c model_reasoning_effort=xhigh --search exec \
     --sandbox read-only \
     -o tasks/codex-research.tmp \
     "$(cat tasks/codex-prompt.tmp)"
   ```
   Use a 10-minute timeout (600000ms) — Codex may take a while on large codebases.
7. Verify the output before reading: `bash .claude/scripts/codex-output-check.sh tasks/codex-research.tmp 20`. If the check fails, stop and tell the developer.
8. After Codex finishes, read `tasks/codex-research.tmp` FULLY.

If the `codex` command is not found or fails, stop and tell the developer to fix it before proceeding.

### 4. Claude synthesizes
Claude reads Codex's raw findings and adds the analytical layer. Do NOT duplicate what Codex already covered — build on it.

**Spot-check Codex's work:**
- Verify a sample of file paths and line numbers Codex reported — do they exist and match?
- For each external finding, ask: would a wrong claim flip an axis choice? If yes, WebFetch the cited URL to verify. If no (version pins, defaults, background context), skip. Usually a few per run.
- Flag any claims that don't hold up.

**Normalize Codex's output to axes:**
- Codex's training priors push it toward flat "Option A / Option B / Option C" combinations even when instructed to produce axes. If that happened, decompose its options into axes during synthesis — identify the dimensions each option varies on, extract the distinct choices, and rewrite as per-axis entries. Don't treat it as a Codex failure; it's expected.
- **Axis coupling is Codex's weakest spot** — it requires reasoning across sections, which Codex does poorly. Expect to derive most couplings yourself during synthesis by cross-referencing the axes Codex surfaced. Verify any couplings Codex did propose against the cited evidence.
- **Watch for bundled axes** — an axis that mixes two dimensions (shape + timing, shape + scope, shape + ownership) forces design to pick both at once, producing awkward hybrid choices. Split into separate axes so each expresses one dimension.
- If an axis seems thin (fewer than 2 real choices, or choices not grounded in codebase/spec), either drop it or flag it as a gap to fill below.

**Fill the gaps Codex left:**
- Spawn sub-agents to investigate areas where Codex's findings are thin, ambiguous, or where connections are missing.
- Keep sub-agents focused and parallel — each explores one specific gap.

**Research beyond the codebase:**
- **Audit axes for external dependencies first:** Walk every axis in the synthesized artifact. For each choice, ask: is its viability fully evaluable from codebase+spec alone? If not (e.g., "does PGlite support GENERATED STORED columns?", "what's the protocol behavior in version N?"), external research is required — not optional. Do not park these as risks; they block axis evaluation in /design.
- **Codex's broad sweep already did the first pass** — `--search` was enabled, so its §6 "External Research" output should contain source URLs and `Unblocks: Axis N, choice X` labels. Inspect this section in `tasks/codex-research.tmp` before spawning any sub-agents.
- **Spawn web research sub-agents only as a fallback** when an external-research gap remains after Codex's first pass — either because Codex's coverage is thin (fewer than 2 distinct sources for an axis whose viability requires external evidence), its findings contradict each other, or the axis audit (line above) surfaced a gap Codex didn't address. Each fallback sub-agent fills one specific unresolved gap — do not re-do work Codex already covered.
- Prefer official docs and release notes over blog posts and tutorials. Return source URLs with all external findings.
- For every external finding (Codex's or sub-agent's), link it to the specific axis/choice it unblocks so /design can use it directly.
- If external research contradicts what the codebase does, document both.

**Add the diagnostic layer:**
- **Why** — Why is the code structured this way? What design decisions led here?
- **Cross-component connections** — How do the pieces Codex found relate to each other and to the broader system?
- **Novel/orthogonal ideas** — Axes or choices Codex missed, orthogonal framings that reshape the axis list, or couplings Codex didn't catch. Do NOT introduce full implementation combinations — that's for /design.
- **Risk analysis** — What could go wrong? What's fragile? What assumptions does the current code make?

### 5. Write research artifact
Write the synthesized research to `tasks/research-codebase.md` (max 1000 lines):

```markdown
# Research: [Task/Question]

## Research Question
[Task description from $ARGUMENTS]

## Summary
[High-level synthesis — the "so what" layer. What did we learn and what does it mean for implementation?]

## Detailed Findings

### [Component/Area 1]
- What exists and where ([file.ext:line](link))
- How it connects to other components
- Why it's structured this way
- Current implementation details

### [Component/Area 2]
...

## Code References
- `path/to/file.py:123` - Description of what's there
- `another/file.ts:45-67` - Description of the code block

## Architecture Analysis
[Current patterns, conventions, and design decisions — with reasoning about why they exist]

## Design Axes
[Decompose the decision into independent axes. For each axis, list viable choices grounded in codebase/spec — do NOT combine axes into full approaches. That's for /design.]

### Axis: [name of decision dimension]
- **Choices:** [2-4 discrete points on this axis]
- **Per-axis constraints:** [what every choice here must respect — spec sections, contracts, precedent]
- **Evidence:** [file:line references, spec §]

### Axis: [name of decision dimension 2]
...

## Axis Coupling
[Dependencies between axes — list each coupling in "If Axis N = X → Axis M is narrowed to {A, B}" format with reason and reference. Omit this section if axes are fully independent.]

## Cross-Cutting Constraints
[Constraints that apply to any solution regardless of axis choice — type signatures, naming conventions, test infra, deps]

## External Research
[Required whenever an axis choice's viability depends on external knowledge. Skip only if every axis is fully evaluable from codebase+spec alone.]
- Finding (with source URL)
- **Unblocks:** Axis N, choice X (name the specific axis/choice the finding establishes or rules out)
- How the finding relates to the current codebase
- Any divergences between external docs and current implementation

## Risk Analysis
[What could go wrong, fragile assumptions, edge cases to watch. Do NOT park external-research gaps here — those are resolved in External Research, not parked as risks.]

## Open Questions
[Any areas that need further investigation]
```

### 6. Clean up
Delete `tasks/codex-prompt.tmp` and `tasks/codex-research.tmp`.

### 7. Present findings
- Present a concise summary of findings to the user.
- Include key file references for easy navigation.
- Highlight anything surprising or non-obvious that Claude's synthesis uncovered.
- Ask if they have follow-up questions.

### 8. Handle follow-up questions
- If the user has follow-up questions, append to the same research document.
- Add a new section: `## Follow-up Research [timestamp]`
- Spawn new sub-agents as needed for additional investigation.

---

## Important notes
- **Codex leads, Claude synthesizes.** Don't restate Codex's file mapping — extend it with connections, reasoning, and gap-filling.
- **Verify before trusting.** Spot-check Codex's file paths and line numbers. Flag inaccuracies.
- Sub-agents are for targeted gap-filling, not broad re-exploration.
- Keep the research artifact under 1000 lines.
- Sub-agents MUST NOT spawn further sub-agents (recursion guard).
