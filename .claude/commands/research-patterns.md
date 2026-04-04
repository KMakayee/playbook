# Research Patterns

Find well-maintained production repos that implement the chosen design approach, study their structure and behavior patterns, and document applicable best practices.

---

## Steps

1. **Check prerequisites.**
   - Verify `tasks/design-decision.md` exists and is finalized (should NOT say "Status: Awaiting decision"). If not finalized, stop and tell the developer to run `/design` and get it reviewed first.
   - Read `tasks/design-decision.md` FULLY to understand the chosen approach.
   - Read `tasks/research-codebase.md` FULLY for codebase context.

2. **Identify what to search for.**
   - Extract the core pattern or feature type from the design decision (e.g., "event-driven pub/sub", "role-based access control", "file upload with chunked streaming").
   - Identify the language/framework constraints from the codebase research.
   - Formulate specific search queries — target production-grade implementations, not tutorials or toy examples.

3. **Find production repos.**
   - Web-search for well-maintained open source repos that implement this pattern in a similar stack.
   - Prioritize repos that are: actively maintained, used in production, well-tested, and similar in scale/complexity to what's being built.
   - Aim for 2-3 strong examples. Quality over quantity — one well-studied repo beats five skimmed ones.

4. **Study the implementations.**
   - For each repo, use sub-agents to deep-read the relevant parts:
     - How is the feature structured? (file organization, module boundaries)
     - What are the key abstractions and interfaces?
     - How is error handling done?
     - How is it tested?
     - What patterns would translate well to our codebase?
   - Focus on structure and behavior, not line-by-line code copying.

5. **Write the patterns artifact** to `tasks/research-patterns.md`:

   ```markdown
   # Patterns Research: [Feature/Pattern Type]

   ## Design Context
   [Brief description of what we're building and which design approach was chosen]

   **Design decision:** `tasks/design-decision.md`

   ## Repos Studied

   ### [Repo 1 — name and link]
   - **Why this repo:** [Why it's a good reference — scale, maintenance, similarity]
   - **How they structure it:** [File organization, module boundaries]
   - **Key patterns:** [Abstractions, interfaces, conventions worth noting]
   - **Error handling:** [How they handle failures in this feature area]
   - **Testing approach:** [How they test this feature]
   - **Applicable to us:** [What specifically translates to our codebase and approach]

   ### [Repo 2 — name and link]
   ...

   ## Synthesized Patterns
   [Cross-cutting patterns that appeared across multiple repos — these are the strongest signals]

   ## Recommendations for Our Implementation
   [Specific patterns to adopt, adapted to our codebase conventions and chosen design approach]
   ```

6. **Report.** Summarize key patterns found and how they apply to the planned implementation. Note if any patterns suggest adjustments to the design (but don't change the design — flag it for the developer).

---

## Rules

- This is research, not design revision. If patterns suggest a fundamentally different approach, flag it — don't change the design decision.
- Prioritize repos with real production usage. Ignore tutorial repos, starter templates, and unmaintained projects.
- Focus on the specific feature/pattern — don't document entire repo architectures.
- The output feeds into `/create-plan`, so emphasize actionable patterns over theoretical best practices.
- If web search yields nothing useful (niche stack, novel problem), document what was searched and recommend proceeding with the design as-is.
