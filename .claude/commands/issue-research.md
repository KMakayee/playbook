# Issue Research

Research issue **#$ARGUMENTS** from the issue board for implementation. Codex sweeps the codebase against the issue's description and acceptance criteria; Claude synthesizes, fills gaps, and recommends an approach. Produces `tasks/research-issue-$ARGUMENTS.md`.

If `$ARGUMENTS` is empty or blank, stop and tell the developer to re-invoke with an issue number (e.g., `/issue-research 12`).

This command uses a two-stage research process:
1. **Codex** does the broad sweep — maps files, enumerates options, establishes constraints
2. **Claude** synthesizes — adds the diagnostic layer (why, not just what), fills gaps, connects the dots, and picks the recommended approach (the issue flow has no `/design` phase)

---

## Steps

### 1. Check prerequisites
- Read `tasks/issues.md` and locate issue `#$ARGUMENTS`. If the issue doesn't exist, stop and tell the developer.
- If `tasks/research-issue-$ARGUMENTS.md` already exists, **stop. Do not overwrite.** Tell the developer to manually remove the existing artifact (or rename it) before re-running. Do NOT prompt for confirmation — `/auto-issues` runs children with `--dangerously-skip-permissions`, and a non-interactive child instructed to "ask" may interpret the failure to ask as license to proceed. Hard stop.

### 2. Read issue context and any directly mentioned files
- Read the issue's `### Description`, `### Acceptance Criteria`, and `### Notes` sections from `tasks/issues.md`. These scope the research.
- If the issue body references specific files, tickets, docs, or configs, read them FULLY first.
- **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files.
- **CRITICAL**: Read these files yourself in the main context before proceeding — they give Claude the context to verify Codex's findings later.

### 3. Run Codex research
Codex leads the exploration. It maps the codebase, enumerates the solution space, and establishes constraints.

1. Read the prompt template from `.claude/prompts/research-guide.md`.
2. Compose the `{TASK}` block from the issue body:
   - The issue description (the goal and why it matters)
   - The acceptance criteria (what the implementation must achieve)
   - The Notes section (prior context, decisions, links)
   - Do NOT decompose the task into sub-steps or list implementation approaches — Codex forms its own understanding from the issue and the codebase.
3. Compose the `{SEARCH_HINTS}` block with three sub-sections, populated from concrete references in the issue body:
   - **Key files to start from:** file paths and glob patterns named in the issue (or implied by acceptance criteria)
   - **Known interfaces/APIs involved:** type names, function signatures, external APIs the issue mentions
   - **Fixed params/constraints from prior work:** locked values, version pins, or decisions referenced in the issue's Notes
   Only include concrete facts (paths, names, values). Do not include analysis, opinions, or suggested approaches.
4. Replace `{TASK}` and `{SEARCH_HINTS}` in the template. Do NOT modify the investigation sections — they stay generic.
5. Write the composed prompt to `tasks/codex-issue-prompt-$ARGUMENTS.tmp`.
6. Run:
   ```bash
   codex -c model_reasoning_effort=xhigh --search exec \
     --sandbox read-only \
     -o tasks/codex-issue-research-$ARGUMENTS.tmp \
     "$(cat tasks/codex-issue-prompt-$ARGUMENTS.tmp)"
   ```
   Use a 10-minute timeout (600000ms) — Codex may take a while on large codebases.
7. Verify the output before reading: `bash .claude/scripts/codex-output-check.sh tasks/codex-issue-research-$ARGUMENTS.tmp 20`. If the check fails, stop and tell the developer.
8. After Codex finishes, read `tasks/codex-issue-research-$ARGUMENTS.tmp` FULLY.

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
- Sub-agents MUST NOT spawn further sub-agents (recursion guard).

**Research beyond the codebase:**
- **Audit axes for external dependencies first:** Walk every axis in the synthesized artifact. For each choice, ask: is its viability fully evaluable from codebase+issue alone? If not (e.g., "does library X support feature Y?", "what's the protocol behavior in version N?"), external research is required — not optional. Do not park these as risks; they block axis evaluation in the recommendation step.
- **Codex's broad sweep already did the first pass** — `--search` was enabled, so its §6 "External Research" output should contain source URLs and `Unblocks: Axis N, choice X` labels. Inspect this section in `tasks/codex-issue-research-$ARGUMENTS.tmp` before spawning any sub-agents.
- **Spawn web research sub-agents only as a fallback** when an external-research gap remains after Codex's first pass — either because Codex's coverage is thin (fewer than 2 distinct sources for an axis whose viability requires external evidence), its findings contradict each other, or the axis audit (line above) surfaced a gap Codex didn't address. Each fallback sub-agent fills one specific unresolved gap — do not re-do work Codex already covered.
- Prefer official docs and release notes over blog posts and tutorials. Return source URLs with all external findings.
- For every external finding (Codex's or sub-agent's), link it to the specific axis/choice it unblocks so the recommendation step can use it directly.
- If external research contradicts what the codebase does, document both.

**Add the diagnostic layer:**
- **Why** — Why is the code structured this way? What design decisions led here?
- **Cross-component connections** — How do the pieces Codex found relate to each other and to the broader system?
- **Novel/orthogonal ideas** — Axes or choices Codex missed, orthogonal framings that reshape the axis list, or couplings Codex didn't catch.
- **Risk analysis** — What could go wrong? What's fragile? What assumptions does the current code make?

**Pick the Recommended Approach** (issue flow's substitute for `/design`):
- The issue workflow has no `/design` phase, so Claude's synthesis layer must close the loop and pick a winner.
- Walk every axis in the synthesized artifact. For each axis, choose the highest-merit option grounded in the codebase, the issue's acceptance criteria, and any external research surfaced above.
- Write a `## Recommended Approach` section that names the chosen axis-choice combination the implementer should follow, with one short paragraph of rationale per axis.
- Honor any axis couplings — the recommended combination must be internally consistent.

### 5. Write research artifact
Write the synthesized research to `tasks/research-issue-$ARGUMENTS.md` (max 1000 lines):

```markdown
# Research: Issue #$ARGUMENTS — [Title]

## Research Question
[Issue description, acceptance criteria, and notes from tasks/issues.md]

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
[Decompose the decision into independent axes. For each axis, list viable choices grounded in codebase/issue.]

### Axis: [name of decision dimension]
- **Choices:** [2-4 discrete points on this axis]
- **Per-axis constraints:** [what every choice here must respect — issue acceptance criteria, contracts, precedent]
- **Evidence:** [file:line references]

### Axis: [name of decision dimension 2]
...

## Axis Coupling
[Dependencies between axes — list each coupling in "If Axis N = X → Axis M is narrowed to {A, B}" format with reason and reference. Omit this section if axes are fully independent.]

## Cross-Cutting Constraints
[Constraints that apply to any solution regardless of axis choice — type signatures, naming conventions, test infra, deps]

## External Research
[Required whenever an axis choice's viability depends on external knowledge. Skip only if every axis is fully evaluable from codebase+issue alone.]
- Finding (with source URL)
- **Unblocks:** Axis N, choice X (name the specific axis/choice the finding establishes or rules out)
- How the finding relates to the current codebase
- Any divergences between external docs and current implementation

## Risk Analysis
[What could go wrong, fragile assumptions, edge cases to watch.]

## Recommended Approach
[Pick the highest-merit axis-choice combination from the axes above. Name the chosen combination, with one short paragraph of rationale per axis. The implementer follows this in `/issue-plan`.]

## Verification Notes
[What was spot-checked, what was confirmed, what was corrected.]

## Open Questions
[Any areas that need further investigation.]
```

### 6. Update issue status
In `tasks/issues.md`, change issue #$ARGUMENTS status from its current value to `In Research`.

### 7. Clean up
Delete `tasks/codex-issue-prompt-$ARGUMENTS.tmp` and `tasks/codex-issue-research-$ARGUMENTS.tmp`.

### 8. Present findings
- Present a concise summary of findings to the developer.
- Include key file references for easy navigation.
- Highlight anything surprising or non-obvious that Claude's synthesis uncovered.
- State the recommended approach in one paragraph.
- Suggest next step: "Run `/issue-plan $ARGUMENTS` next."
- Ask if they have follow-up questions.

### 9. Handle follow-up questions
- If the developer has follow-up questions, append to the same research document.
- Add a new section: `## Follow-up Research [timestamp]`
- Spawn new sub-agents as needed for additional investigation (recursion guard still applies).

---

## Important notes
- **Codex leads, Claude synthesizes.** Don't restate Codex's file mapping — extend it with connections, reasoning, gap-filling, and the recommended approach.
- **Verify before trusting.** Spot-check Codex's file paths and line numbers. Flag inaccuracies.
- Sub-agents are for targeted gap-filling, not broad re-exploration.
- Keep the research artifact under 1000 lines.
- Sub-agents MUST NOT spawn further sub-agents (recursion guard).
- If context utilization is above 30% after writing the artifact, compact before finishing.
