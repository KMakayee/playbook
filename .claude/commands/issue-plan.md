# Issue Plan

Generate a detailed implementation plan for issue **#$ARGUMENTS** from research findings. Produce a step-by-step execution plan that a fresh context window can follow.

---

## Steps

1. **Check prerequisites:**
   - Verify `tasks/research-issue-$ARGUMENTS.md` exists. If not, stop and tell the developer to run `/issue-research-codex $ARGUMENTS` first.
   - Locate issue `#$ARGUMENTS` in `tasks/issues.md`. Confirm the research covers this issue.
   - If `tasks/design-decision.md` exists, check that the design is finalized — it should NOT say "Status: Awaiting decision". If it does, stop and tell the developer the design needs to be evaluated and finalized first.

2. **Read artifacts fully:**
   - Read `tasks/research-issue-$ARGUMENTS.md` FULLY — use the Read tool WITHOUT limit/offset parameters.
   - Read issue `#$ARGUMENTS` from `tasks/issues.md`.
   - If `tasks/design-decision.md` exists, read it FULLY — the plan should execute the chosen approach.
   - If `tasks/research-patterns.md` exists, read it FULLY — it contains external best practices for the chosen approach.

3. **Create structure outline:**
   - Based on the research findings (and design approach, if available), outline the high-level implementation phases.
   - Each phase should be independently testable and leave the codebase in a working state.
   - Order phases so later phases build on earlier ones.
   - If more than 5 phases are needed, the task is probably too big — recommend breaking it into separate issues.

4. **Structure-first for large plans.** If the plan has more than 5 steps, present a numbered outline first and ask the developer to confirm the approach before writing the detailed plan.

5. **Write detailed plan per phase:**
   - For each phase, specify the exact files to change with line references from research.
   - Describe what changes are needed and why (traceable to the design decision or acceptance criteria).
   - Write success criteria: commands the agent can run to verify the phase works.
   - If you encounter something unclear, stop and re-research that specific sub-problem using a sub-agent — do not guess.

6. **Identify batches.** If the plan contains multiple independent batches, list them explicitly. Each batch will be executed in its own prompt during implementation.

7. **Write the plan artifact** to `tasks/plan.md`:
   - Title it "Plan: Issue #$ARGUMENTS — [Title]".
   - Structure the plan however best fits the task — there's no rigid template. Use Claude's native planning format.
   - The plan must include these elements (in whatever structure makes sense):
     - **Issue reference** — issue number, description, and acceptance criteria from `tasks/issues.md`
     - **Design decision reference** (if applicable) — which approach was chosen and why, with a pointer to `tasks/design-decision.md`
     - **Scope boundaries** — what we're NOT doing, to prevent drift during implementation
     - **Phased breakdown** — implementation broken into phases that can be verified independently
     - **File-level specifics** — which files change, what changes, with line references from research
     - **Success criteria per phase** — commands the agent can run to verify each phase works
     - **Artifact references** — pointers to `tasks/research-issue-$ARGUMENTS.md` and `tasks/design-decision.md` (if it exists)

8. **Verify the draft plan:**
   - Cross-check against ALL acceptance criteria in the issue — every criterion should be addressed by at least one plan step.
   - If `tasks/design-decision.md` exists, cross-check against its review section (missed risks, corrections, open question answers). Every item flagged there should either appear in the plan or be noted as intentionally deferred with reasoning.
   - Verify all file paths used in success criteria are correct relative to the repo root.
   - If the plan claims backward compatibility, verify by checking existing test fixtures for the changed types.

9. **Update issue status.** In `tasks/issues.md`, change issue #$ARGUMENTS status to `In Planning`.

10. **Present summary to the developer:**
    - List the phases with one-line descriptions
    - Highlight any areas where research was thin and you had to make judgment calls
    - Note the plan is ready for review and approval before implementation begins
    - Do NOT implement until the plan is approved. If rejected or revised, update `tasks/plan.md` before proceeding.

---

## Rules

- Plan from `tasks/research-issue-$ARGUMENTS.md` — do not re-research or plan from memory.
- The design decision (if it exists) is already made. Do not revisit or re-evaluate options — plan the execution of the chosen approach.
- Be skeptical of research references. If research says a function exists at a specific line, verify it before building the plan around it. Code changes between research and planning.
- Every changed file needs a reason traceable to the design decision or acceptance criteria. If you can't explain why a file is changing, remove it from the plan.
- Success criteria should be automated — commands the agent can run to verify. The implementation agent will execute these after each phase.
- Open questions are fine — surface them clearly so the reviewer can resolve them before implementation.
- If `tasks/plan.md` already exists from a different issue, warn the developer and ask whether to overwrite or abort.
- **Sub-agents are optional**: Planning usually happens in the main context from the artifacts. If you need to verify that a specific function or file still exists, spawn a sub-agent to check.
- **File reading**: Always read mentioned files FULLY (no limit/offset) before any planning.
- This command produces a plan artifact — it does NOT implement anything.
