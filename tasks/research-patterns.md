# Patterns Research: Orchestrator-led multi-agent build lanes for LLM coding agents

**Design decision:** `tasks/design-decision.md`

> Produced by Codex (`--search`, xhigh) for task 21 (`/forge`); parent session spot-checked the Anthropic article and both OpenAI Codex pages against their cited claims (all held, 2026-06-10). arXiv papers and Claude Code docs are established sources; the Claude Code docs were independently fetched during `/research-codebase`.

## Sources Studied

### Anthropic — "Building effective agents", article, https://www.anthropic.com/engineering/building-effective-agents
- **Why this source:** Canonical production-pattern writeup for LLM workflows, including routing, parallelization, orchestrator-workers, evaluator-optimizer loops, coding agents, tests, human checkpoints, and max-iteration controls.
- **What we learned:** Strong signal for simple, composable workflows over heavy frameworks. It separates predictable workflows from model-directed agents, names orchestrator-workers as the fit for complex coding tasks, and evaluator-optimizer as the fit when clear criteria and iterative feedback exist. It also explicitly notes coding agents benefit from tests as objective feedback while still needing human review for broader requirements.
- **Applicable to us:** Supports Option A's thin spine: Fable keeps the design spine, delegates only bounded leaf work, uses audit/review as evaluator passes, then uses tests/typecheck as ground-truth verification. Also supports max-cycle caps and optional human pause for judgment-heavy checkpoints.

### OpenAI Codex docs/cookbook — Subagents, iterative repair loops, compaction, docs/cookbook, https://developers.openai.com/codex/concepts/subagents, https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex, https://developers.openai.com/api/docs/guides/compaction
- **Why this source:** Closest official prior art to the target: coding-agent subagents, model-tiered workers, review-repair-validate loops, and long-running context compaction.
- **What we learned:** Codex subagent docs recommend moving noisy work off the main thread, using parallel agents first for read-heavy work, being careful with parallel write-heavy workflows, and returning distilled summaries. The model guidance distinguishes strong models for ambiguous multi-step work from faster mini models for scans/review/supporting docs. The iterative repair loop uses Review → Repair → Validate, structured handoffs, records per pass, and production stop conditions: validation passes, max attempts reached, remaining delta stops changing, or human review is needed. The compaction docs emphasize preserving state needed for subsequent turns and continuing from the compacted context.
- **Applicable to us:** Strongly validates explicit model routing, leaf-only agents, hard caps, audit-before-fix separation, validation-driven convergence, and continuation prompts that carry only decisions, deltas, commands, and next goal. It also reinforces that cap and "delta is shrinking" matter more than whether the model made edits.

### Claude Code docs — Subagents, workflows, worktrees, skills, commands, docs, https://code.claude.com/docs/en/sub-agents, https://code.claude.com/docs/en/workflows, https://code.claude.com/docs/en/worktrees, https://code.claude.com/docs/en/skills, https://code.claude.com/docs/en/commands
- **Why this source:** Official implementation reference for the exact substrate `/forge` composes: skills, subagents, Workflow, model fields, worktree isolation, and compaction.
- **What we learned:** Subagents run in separate contexts and can limit tools, but model defaults can inherit unless explicitly set. Built-in examples route cheap read-only exploration to Haiku and heavier tasks to stronger/inherited models. Workflows move orchestration into script variables, are suited for dozens/hundreds of agents, have no mid-run user input, and enforce runtime caps. Worktrees isolate parallel edits. Skills should keep bodies concise because loaded content remains in context.
- **Applicable to us:** Confirms the design's explicit model pinning rule is necessary, not decorative. It also supports hybrid orchestration: plain sequential subagents for seam work, Workflow only for genuine parallelism, with worktree isolation for concurrent edits. The "no mid-run user input" Workflow constraint supports keeping the design-confirm pause outside a workflow stage.

### Aider — Architect mode and editor model, docs, https://aider.chat/docs/usage/modes.html
- **Why this source:** Mature coding-agent tool with an explicit architect/editor split and model selection for each role.
- **What we learned:** Architect mode sends a request first to a main model that proposes the solution, then to an editor model that turns that proposal into concrete edits. Aider supports an explicit `--editor-model`, has defaults, and notes that two requests can improve outcomes but increase latency/cost. The ask/code flow is a lighter human-confirm variant: discuss plan, then say "go ahead" to execute.
- **Applicable to us:** Validates the pattern of separating coherent design ownership from bounded edit execution, while warning that extra staged calls are a real cost. `/forge` deliberately keeps the architect/editor split thinner: one model-led pass, optional human confirm only for contract-defining work, then verifier gates.

### Self-Refine — "Iterative Refinement with Self-Feedback", paper, https://arxiv.org/abs/2303.17651
- **Why this source:** Foundational paper for generate → feedback → refine convergence without training.
- **What we learned:** The loop generates an initial output, asks for feedback, refines, and repeats until a stopping condition or max iteration. Feedback quality matters: actionable and specific feedback beats generic feedback. Gains show diminishing returns and can be non-monotonic when multiple quality dimensions trade off. The paper used up to 4 iterations and notes external signals can improve verifier reliability.
- **Applicable to us:** Supports a capped audit/review loop, but also supports keeping feedback concrete and triaged. `/forge` should treat "new critical findings" and tests/typecheck as convergence signals, stop on tradeoffs, and avoid chasing generic style feedback.

### SWE-agent — "Agent-Computer Interfaces Enable Automated Software Engineering", paper/docs, https://arxiv.org/abs/2405.15793, https://swe-agent.com/latest/
- **Why this source:** Empirical coding-agent reference focused on repository edits, execution feedback, tool design, context management, and tests.
- **What we learned:** SWE-agent improves over non-interactive generation by letting the model inspect, edit, run commands, and receive concise feedback. Its ACI principles are simple actions, compact/informative feedback, guardrails, and context management. It shows full-file/noisy context can hurt, lint/edit guardrails help, and pass/fail tests are the main success metric. It also bounds spend with per-instance budgets.
- **Applicable to us:** Reinforces the verify step as mandatory, not cleanup. It supports keeping gate outputs concise, using local guardrails like typecheck/tests after fixes, and avoiding large noisy context dumps between phases.

## Coverage Assessment
- **Source count:** 6 strong sources / 9 total searched.
- **Read depth per source:** Anthropic article: deep; OpenAI Codex docs/cookbook: deep on relevant sections; Claude Code docs: moderate on relevant sections; Aider docs: moderate; Self-Refine paper: moderate-deep on algorithm/eval/analysis; SWE-agent paper/docs: moderate-deep on ACI, loop, context, results.
- **Confidence:** HIGH. The sources agree on the core pattern: strong central ownership, bounded workers, explicit routing, verification loops with objective feedback, and hard stop conditions.

## Synthesized Patterns

- **Single owner for coherence.** Across Anthropic, OpenAI, Aider, and Claude Code, the safest multi-agent shape keeps one orchestrator/manager responsible for the global design and synthesis. Handoff-style control is more flexible, but agent-as-tool/subagent leaf delegation preserves a single thread of control.

- **Delegate bounded leaf work, not spine decisions.** Subagents are strongest for read-heavy exploration, scans, tests, logs, or isolated implementation seams. Parallel write-heavy work is repeatedly flagged as coordination-risky unless isolated by worktrees and partitioned by ownership.

- **Model tiering must be explicit.** Docs commonly allow inheritance or automatic routing, but the design's objective requires explicit pinning. Strong models own ambiguous multi-step contract work; cheaper/pinned models handle read-heavy scans, straightforward conforming phases, and local fixes.

- **Generate freely, verify structurally.** The common loop is: generate/repair, evaluate against clear criteria, apply focused fixes, validate, repeat. Convergence is judged by passing validation, no critical/new findings, or shrinking remaining delta. Stop when the delta stalls, max cycles are reached, or the next decision is a human tradeoff.

- **Feedback must be actionable.** Generic "improve quality" feedback causes drift. Effective verifier output is specific, evidenced, severity-labeled, and directly mappable to repair work. This matches A.1/A.2/B/C triage.

- **Context handoff should be compact and stateful.** The useful state is settled contracts, acceptance criteria, changed files, verifier findings/fixes, validation commands/results, unresolved blockers, and the next concrete goal. Raw logs and full transcripts should stay out of the main thread unless needed.

## Recommendations for Our Implementation

- Keep Option A's disposable reference spine. External prior art supports a thin skill that composes existing gates instead of embedding a large framework.

- State the hierarchy plainly: Fable owns contracts, design spine, synthesis, and subtle fixes; Opus handles conform-only bounded phases; Sonnet handles reads/trivial/local work. Every spawned agent must name its model explicitly.

- Use plain sequential delegation by default. Use Workflow only when there are genuinely independent parallel lanes, and require worktree isolation for any parallel edit lane.

- Define the gate cycle as one unit: audit → review → triage → inline fixes → tests/typecheck. Stop when no new critical findings appear. Cap at 2 cycles; if the remaining delta is not shrinking or a B tradeoff appears, stop for developer input.

- Require verifier findings to be evidenced and actionable before applying A.1 fixes. Treat broad preferences, style churn, or low-confidence concerns as B/C rather than loop fuel.

- Emit continuation prompts at seams with only the compact state needed for the next phase: intent/AC, settled contracts, files touched, commands run, gate decisions, fixes applied, remaining work, and exact next step.

## Concerns for Developer Review

- The strongest repair-loop source recommends keeping an auditable record per pass. Option A should avoid a new handoff format, but it should still preserve enough gate/fix/validation summary in existing logs or final output to make convergence inspectable.

- A 2-cycle cap is lower than some prior-art examples that use 3-4 passes. That is reasonable for a thin temporary lane, but the skill should explicitly turn an uncleared final delta into a human-review handoff rather than silently treating max-cycle exhaustion as success.
