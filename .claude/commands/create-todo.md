# Create Todo

Break down the finalized design in `tasks/design-decision.md` into a numbered task list. Each task becomes a unit of work that goes through its own research-codebase → plan → implement cycle.

## Steps:

1. **Check prerequisites:**
   - Verify `tasks/design-decision.md` exists. If not, stop and tell the developer to run `/design` first.
   - Check that the design is finalized — it should NOT say "Status: Awaiting decision". If it does, stop and tell the developer the design needs to be reviewed and finalized first.
   - Read `tasks/design-decision.md` FULLY — use the Read tool WITHOUT limit/offset parameters.

2. **Decompose the design into tasks:**
   - Identify the distinct pieces of work needed to implement the chosen approach
   - Order them so later tasks can build on earlier ones
   - Each task should be small enough for a single research → plan → implement cycle
   - Group related changes into the same task — don't split a logical unit across tasks

3. **Write the todo artifact** to `tasks/todo.md`:
   - Title references the design
   - Source line pointing to `tasks/design-decision.md`
   - Numbered list — each task gets a number, bold title, brief description, and status (`pending` / `in progress` / `done`)
   - The description should be enough context for `/research-codebase` to know what to investigate
   - Structure it however makes sense for the task — no rigid format beyond the numbered ordering

4. **Present to the developer:**
   - List the tasks with one-line summaries
   - Note any ordering dependencies (e.g., "Task 3 depends on Task 1")
   - The developer can reorder, merge, split, or remove tasks before starting

## Important notes:
- Tasks are work items, not steps in a recipe. Each task produces a meaningful change.
- If `tasks/todo.md` already exists, warn the developer and ask whether to overwrite or abort.
- The first task to work on goes through `/research-codebase` next.
