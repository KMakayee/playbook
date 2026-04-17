# Create Todo

Break down a design document into a numbered task list. Tasks are work items, not steps in a recipe — each one becomes a unit of work that goes through its own QRSPI cycle (research-codebase → design → plan → implement).

**Usage:** `/create-todo <path-to-design-doc>`

If no path is provided, ask the developer which design document to use.

## Steps:

1. **Read the design document:**
   - Read the provided file FULLY — use the Read tool WITHOUT limit/offset parameters.
   - If the file doesn't exist, stop and tell the developer.

2. **Scan for upstream constraints:**
   - The design doc is rarely the only input. Look for references to status files, spike/gate artifacts, phase docs, prior research, or related designs.
   - Read each referenced artifact and extract **outcomes that constrain the work** (decisions already made, options ruled out, invariants that must hold).
   - Treat these as constraints the tasks must respect — NOT as signals to pre-design internals. If a gate already decided "use approach X," tasks assume X; they do not re-evaluate it.
   - If the design sits inside a multi-phase/multi-step structure, note which phase/step/unit this todo belongs to.

3. **Assess granularity and decompose into tasks:**
   - Understand how broad or specific the design is — this determines task size.
   - **Broad design** (high-level goals, minimal implementation detail): Create coarser tasks that each cover a logical area. These tasks will need heavier research and design phases in QRSPI.
   - **Detailed design** (specific components, interfaces, data flows): Create finer tasks that map closely to the design's own structure. These tasks may have lighter research phases.
   - Each task should be a meaningful unit of change.
   - Group related changes into the same task.

4. **Stay at the capability/outcome level (abstraction discipline):**
   - Tasks AND their deliverables describe WHAT the unit of work produces, not HOW it's built.
   - **Avoid in task descriptions and deliverables:** method signatures, SQL/query operators, library-specific API calls, specific file paths, parser/config formats, data-structure choices.
   - **Prefer:** the capability being added, the behavior being changed, the contract being introduced.
   - Implementation choices are decided inside each task's own research → design → plan phases, not here.
   - This discipline applies to **both scope and deliverables** — a common mistake is keeping scope abstract while letting deliverables leak implementation detail.

5. **Phase/boundary audit:**
   - If the design lives inside a multi-phase/multi-step/multi-unit structure (identified in Step 2), verify every task belongs to the intended scope.
   - Watch for tasks that actually belong downstream — **validation tasks in particular often belong to the step after the thing they validate** (e.g., Unit 1's validation is usually Step 2 work, not Step 1).
   - Remove or flag out-of-scope tasks before writing the artifact.

6. **Coverage and unresolved questions:**
   - Walk the design document's stated goals/outcomes. Verify each has at least one task that owns it. If something is missing, add a task or explicitly move it to Out of Scope — silent drops are the failure mode.
   - Scan the design for open questions, unresolved decisions, or external dependencies that would stall a task on day one of its research phase. Do NOT solve them here — surface them so the developer can decide whether to resolve before kickoff or accept the risk.
   - Keep this focused on coverage and blockers. Broader "does this fit the project" judgment belongs in design review, not here.

7. **Capture dependencies, not a waterfall:**
   - Do not impose a strict `1 → 2 → 3` ordering on iterative work.
   - Write a short **Dependencies** paragraph stating which tasks genuinely block which others, and which can proceed in parallel or be revisited.
   - Numbering is for reference only — it is not an execution order unless dependencies require it.

8. **Write the todo artifact** to `tasks/todo.md`:
   - If `tasks/todo.md` already exists, warn the developer and ask whether to overwrite or abort before writing.
   - Title references the design document
   - **Source** line pointing to the design document path
   - **Upstream constraints** section listing the artifacts scanned in Step 2 and the constraints they impose
   - **Out of Scope** section listing what this todo explicitly does NOT cover (load-bearing for preventing scope creep in later research phases — include items that were considered and deferred, and items that belong to other phases/steps)
   - **Open questions / blockers** section listing anything surfaced in Step 6 that should be resolved (or explicitly accepted) before task kickoff
   - **Dependencies** paragraph (from Step 7)
   - Numbered list — each task gets a number, bold title, brief description, and a checkbox to mark done
   - The description should include which files/sections to reference for more details
   - For broad designs, note what each task needs to figure out during research
   - For detailed designs, reference specific sections of the design doc

9. **Present to the developer:**
   - List the tasks with one-line summaries
   - Note dependencies (e.g., "Task 3 depends on Task 1; Tasks 2 and 4 are independent")
   - Surface the Out of Scope list so the developer can confirm nothing important was excluded
   - Surface open questions/blockers so the developer can resolve or accept them before research begins
   - The developer can reorder, merge, split, or remove tasks before starting
