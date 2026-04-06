# Research Codebase

Research the codebase for the task described by the user: **$ARGUMENTS**

## Steps:

1. **Read any directly mentioned files first:**
   - If the user mentions specific files (tickets, docs, JSON), read them FULLY first
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: Read these files yourself in the main context before spawning any sub-tasks
   - This ensures you have full context before decomposing the research

2. **Analyze and decompose the research question:**
   - Break down the user's query into composable research areas
   - Think deeply about the underlying patterns, connections, and architectural implications the user might be seeking
   - Identify specific components, patterns, or concepts to investigate
   - Consider which directories, files, or architectural patterns are relevant

3. **Explore the codebase:**
   - Spawn sub-agents to research the codebase however you see fit — parallelize across domains, go deep on a single module, whatever the task requires.
   - All agents are documentarians: describe what exists, don't evaluate or suggest improvements.

   **Tactical guidance:**
   - Start broad — find WHERE relevant files and components live
   - Then go deep — understand HOW specific code works
   - Look for patterns — identify conventions, testing approaches, and architecture
   - Run multiple agents in parallel when searching different domains
   - Don't over-prompt agents on HOW to search — they already know
   - Have agents document examples and usage patterns as they exist

4. **Research beyond the codebase (when needed):**
   - If the task involves external libraries, APIs, protocols, migrations, or unfamiliar error messages, spawn web research agents **in parallel with** codebase agents.
   - Prefer official docs and release notes over blog posts and tutorials.
   - Return source URLs with all external findings so they can be verified.
   - If external research contradicts what the codebase does, document **both** — don't silently prefer one over the other.

5. **Wait for all sub-agents to complete and synthesize findings:**
   - IMPORTANT: Wait for ALL sub-agent tasks to complete before proceeding
   - Compile all sub-agent results
   - Prioritize live codebase findings as primary source of truth
   - Connect findings across different components
   - Include specific file paths and line numbers for reference
   - Highlight patterns, connections, and architectural decisions
   - Answer the user's specific questions with concrete evidence

6. **Write research artifact** to `tasks/research-codebase.md`:

     ```markdown
     # Research: [Task/Question]

     ## Research Question
     [Task description from $ARGUMENTS]

     ## Summary
     [High-level documentation of what was found]

     ## Detailed Findings

     ### [Component/Area 1]
     - Description of what exists ([file.ext:line](link))
     - How it connects to other components
     - Current implementation details (without evaluation)

     ### [Component/Area 2]
     ...

     ## Code References
     - `path/to/file.py:123` - Description of what's there
     - `another/file.ts:45-67` - Description of the code block

     ## External Research
     [Only if external research was conducted]
     ### [Topic]
     - Key findings with source URLs
     - How external findings relate to the current codebase
     - Any divergences between external best practices and current implementation

     ## Architecture Documentation
     [Current patterns, conventions, and design implementations found in the codebase]

     ## Open Questions
     [Any areas that need further investigation]
     ```

7. **Present findings:**
   - Present a concise summary of findings to the user
   - Include key file references for easy navigation
   - Ask if they have follow-up questions or need clarification

8. **Handle follow-up questions:**
   - If the user has follow-up questions, append to the same research document
   - Add a new section: `## Follow-up Research [timestamp]`
   - Spawn new sub-agents as needed for additional investigation
   - Continue updating the document

## Important notes:
- Always use parallel sub-agents to maximize efficiency and minimize context usage
- Always run fresh codebase research — never rely solely on existing research documents
- Focus on finding concrete file paths and line numbers for developer reference
- Research documents should be self-contained with all necessary context
- Each sub-agent prompt should be specific and focused on read-only documentation operations
- Document cross-component connections and how systems interact
- Include temporal context (when the research was conducted)
- Keep the main agent focused on synthesis, not deep file reading
- Have sub-agents document examples and usage patterns as they exist
- **File reading**: Always read mentioned files FULLY (no limit/offset) before spawning sub-tasks
