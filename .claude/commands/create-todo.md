# Create Todo

Break down a design document into a numbered task list. Each task becomes a unit of work that goes through its own QRSPI cycle (research-codebase → design → plan → implement).

**Usage:** `/create-todo <path-to-design-doc>`

If no path is provided, ask the developer which design document to use.

## Steps:

1. **Read the design document:**
   - Read the provided file FULLY — use the Read tool WITHOUT limit/offset parameters.
   - If the file doesn't exist, stop and tell the developer.

2. **Assess granularity and decompose into tasks:**
   - Understand how broad or specific the design is — this determines task size.
   - **Broad design** (high-level goals, minimal implementation detail): Create coarser tasks that each cover a logical area. These tasks will need heavier research and design phases in QRSPI.
   - **Detailed design** (specific components, interfaces, data flows): Create finer tasks that map closely to the design's own structure. These tasks may have lighter research phases.
   - Order tasks so later ones can build on earlier ones.
   - Each task should be a meaningful unit of change.
   - Group related changes into the same task.

3. **Write the todo artifact** to `tasks/todo.md`:
   - Title references the design document
   - Source line pointing to the design document path
   - Numbered list — each task gets a number, bold title, brief description, and a checkbox to mark done
   - The description should include which files to reference for more details
   - For broad designs, note what each task needs to figure out during research
   - For detailed designs, reference specific sections of the design doc

4. **Present to the developer:**
   - List the tasks with one-line summaries
   - Note any ordering dependencies (e.g., "Task 3 depends on Task 1")
   - The developer can reorder, merge, split, or remove tasks before starting

## Important notes:
- This is the **entry point** for implementation work. Each task produced here goes through the full QRSPI workflow starting with `/research-codebase`.
- Tasks are work items, not steps in a recipe. Each task produces a meaningful, commitable change.
- If `tasks/todo.md` already exists, warn the developer and ask whether to overwrite or abort.
