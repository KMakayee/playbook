# Create Plan

Create a detailed implementation plan from the finalized design in `tasks/design-decision.md` and the research in `tasks/research-codebase.md`. Produce a step-by-step execution plan that a fresh context window can follow.

## Steps:

1. **Check prerequisites:**
   - Verify `tasks/research-codebase.md` exists. If not, stop and tell the developer to run `/research-codebase` first.
   - Verify `tasks/design-decision.md` exists. If not, stop and tell the developer to run `/design` first.
   - Check that the design is finalized — it should NOT say "Status: Awaiting decision". If it does, stop and tell the developer the design needs to be evaluated and finalized first.

2. **Read artifacts fully:**
   - Read `tasks/research-codebase.md` FULLY — use the Read tool WITHOUT limit/offset parameters.
   - Read `tasks/design-decision.md` FULLY — use the Read tool WITHOUT limit/offset parameters.
   - If `tasks/research-patterns.md` exists, read it FULLY — it contains external best practices for the chosen approach.
   - Understand the chosen approach, the reasoning behind it, and the research findings that support it.

3. **Create structure outline:**
   - Based on the chosen design approach and research findings, outline the high-level implementation phases.
   - Each phase should be independently testable and leave the codebase in a working state.
   - Order phases so later phases build on earlier ones.
   - If more than 5 phases are needed, the task is probably too big — recommend breaking it into separate tasks.

4. **Write detailed plan per phase:**
   - For each phase, specify the exact files to change with line references from research.
   - Describe what changes are needed and why (traceable to the design decision).
   - Write success criteria: commands the agent can run to verify the phase works.
   - If you encounter something unclear, stop and re-research that specific sub-problem using a sub-agent — do not guess.

5. **Write the plan artifact** to `tasks/plan.md`:
   - Structure the plan however best fits the task — there's no rigid template. Use Claude's native planning format.
   - The plan must include these elements (in whatever structure makes sense):
     - **Design decision reference** — which approach was chosen and why, with a pointer to `tasks/design-decision.md`
     - **Scope boundaries** — what we're NOT doing, to prevent drift during implementation
     - **Phased breakdown** — implementation broken into phases that can be verified independently
     - **File-level specifics** — which files change, what changes, with line references from research
     - **Success criteria per phase** — commands the agent can run to verify each phase works
     - **Artifact references** — pointers to `tasks/research-codebase.md` and `tasks/design-decision.md`

6. **Present summary to the developer:**
   - List the phases with one-line descriptions
   - Highlight any areas where research was thin and you had to make judgment calls
   - Note the plan is ready for review and approval before implementation begins

## Important notes:
- This command produces a plan artifact — it does NOT implement anything.
- Always read `tasks/research-codebase.md`, `tasks/design-decision.md`, and `tasks/research-patterns.md` (if it exists) FULLY before planning. Do not plan from memory.
- The design decision is already made. Do not revisit or re-evaluate options — plan the execution of the chosen approach.
- Be skeptical of research references. If research says a function exists at a specific line, verify it before building the plan around it. Code changes between research and planning.
- Open questions are fine — surface them clearly so the codex/human reviewer can resolve them before implementation.
- Every changed file needs a reason traceable to the design decision. If you can't explain why a file is changing, remove it from the plan.
- Success criteria should be automated — commands the agent can run to verify. The implementation agent will execute these after each phase.
- **Sub-agents are optional**: Planning usually happens in the main context from the artifacts. If you need to verify that a specific function or file still exists, spawn a sub-agent to check.
- **File reading**: Always read mentioned files FULLY (no limit/offset) before any planning.
