# Design

Evaluate design options based on the research in `tasks/research-codebase.md`.

## Steps:

1. **Check prerequisites:**
   - Verify `tasks/research-codebase.md` exists. If not, stop and tell the developer to run `/research-codebase` first.
   - Read `tasks/research-codebase.md` FULLY — use the Read tool WITHOUT limit/offset parameters.

2. **Extract design-relevant facts from research:**
   - Identify codebase patterns and conventions that constrain the approach
   - Note existing implementations of similar features (if any)
   - Catalog integration points and dependencies
   - List any risks or open questions surfaced during research

3. **Identify viable approaches:**
   - Each approach must be grounded in research findings — no approaches based on assumptions or general knowledge
   - If only one approach is viable, explain why alternatives were ruled out
   - If more than 3 approaches exist, narrow to the strongest 3 and briefly note what was excluded

4. **Consider these criteria for each approach:**
   - **Complexity** — Fewer moving parts, fewer files changed, fewer new abstractions
   - **Consistency** — How well it matches existing codebase patterns and conventions
   - **Risk** — Blast radius, reversibility, what could go wrong
   - **Testability** — How easy it is to verify the approach works

5. **Surface open questions:**
   - Identify decisions that cannot be made from research alone
   - Flag assumptions that need validation
   - Note areas where the research was incomplete or ambiguous
   - Separate questions into: blocking (must answer before implementing) vs non-blocking (can resolve during implementation)

6. **Write the design artifact** to `tasks/design-decision.md`:

     ```markdown
     # Design: [Task/Question Title]

     ## Context
     [What problem is being solved and what constraints exist. Reference the research artifact.]

     **Research:** `tasks/research-codebase.md`

     ## Options Considered
     [Present each viable option with its trade-offs. Structure each option however best fits the problem — there's no rigid format. Just make sure each option is grounded in research findings and clearly describes how it works, what's good about it, and what's not.]

     ## Decision Heuristics

     For reference, these are the priorities for choosing an approach:
     1. Match existing codebase patterns over introducing novel approaches
     2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
     3. Reversible over optimal — prefer approaches that can be easily changed later

     ## Open Questions

     ### Blocking (must resolve before implementation)
     - [ ] [Question that affects which option to choose]

     ### Non-blocking (can resolve during implementation)
     - [ ] [Question that affects implementation details but not the overall approach]

     ## What We're NOT Doing
     [Explicit scope boundaries — what's out of scope for this task]

     ---

     **Status:** Awaiting decision
     **Next step:** Evaluate options and update this document with the chosen approach
     ```

7. **Present summary to the developer:**
   - List the options with one-line summaries
   - Highlight the most significant trade-off
   - List any blocking open questions
   - Note that the next step is design evaluation (codex picks the approach)

## Important notes:
- This command evaluates and presents — it does NOT decide. The decision comes from a separate evaluation step.
- Always read `tasks/research-codebase.md` FULLY before evaluating. Do not evaluate from memory or general knowledge.
- Ground every option in research findings. If an approach isn't supported by the research, it shouldn't be listed.
- Keep options genuinely distinct. "Do X with library A" vs "Do X with library B" is not two options — it's one option with a sub-choice.
- If only one approach is viable, still document why alternatives were ruled out.
- Do not include implementation details (specific code, file-level changes) — that belongs in the plan phase.
- The "Status: Awaiting decision" footer signals that the artifact is ready for the evaluation step.
- **Sub-agents are optional**: Design evaluation usually happens in the main context, but if you need deeper research on a specific option or technical question, spawn sub-agents as needed.
- **File reading**: Always read mentioned files FULLY (no limit/offset) before any analysis.
