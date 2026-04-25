# Patterns Research

The parent `/design` session has finalized a design decision. Study external references — repos (production, reference, or educational), official docs, specs/RFCs, engineering blogs, research papers, reference implementations — that inform the chosen approach, and document applicable patterns. Return your findings to stdout for the parent `/design` session to consume — the parent writes `tasks/research-patterns.md`. Do NOT modify the design decision.

## Research Topic

{RESEARCH_TOPIC}

## Required reading (FULL, no limit/offset)

- `tasks/design-decision.md` — design rationale and options considered
- `tasks/research-codebase.md` — codebase patterns, conventions, and constraints

## What to investigate

### 1. Candidate sources
- Web-search for external references relevant to the chosen pattern — open source repos, official docs, specs/RFCs, engineering blogs, research papers, reference implementations.
- Prioritize quality and relevance over source type. For repos, favor actively maintained and well-tested. For docs, prefer official/canonical over blog aggregations. A well-written spec or reference implementation can beat a production repo for clarity.
- Aim for 2-3 strong sources — one well-studied source beats five skimmed ones.

### 2. Per-source findings
For each source, capture the aspects that matter for the research topic. Let the topic drive the lens — e.g., performance/throughput for a rate limiter, correctness and invariants for a protocol, structure and abstractions for a general pattern, failure modes for a distributed system. Always note what specifically translates to our codebase.

### 3. Synthesized patterns
- Cross-cutting patterns that appeared across multiple sources (strongest signals).
- Patterns that conflict between sources — note the trade-off.

### 4. Recommendations
- Specific patterns to adopt, adapted to our codebase conventions.
- If a pattern suggests a fundamentally different approach than the chosen design, flag it in the "Concerns for Developer Review" section — do NOT modify `tasks/design-decision.md`.

## How to work

- Read each source thoroughly in one pass — quality over breadth.
- Focus on patterns, not line-by-line copying.
- Return source URLs with all external findings.
- If web search yields nothing useful (niche stack, novel problem), document what was searched and recommend proceeding with the design as-is.

## Output format

Return your findings as markdown using this structure (the parent `/design` session writes `tasks/research-patterns.md` from your output):

```markdown
# Patterns Research: [Research Topic]

**Design decision:** `tasks/design-decision.md`

## Sources Studied

### [Source 1 — name, type (repo/doc/spec/article/paper), link]
- **Why this source:** [relevance and quality signal]
- **What we learned:** [aspects that matter for the research topic]
- **Applicable to us:** [what specifically translates]

### [Source 2 — ...]
...

## Coverage Assessment
- **Source count:** [N strong sources / M total sources searched]
- **Read depth per source:** [for each source, one of: deep (full read), moderate (skimmed key sections), or superficial (top-level summary only). Be honest — the parent /design session uses this signal to decide whether to spawn fallback sub-agents.]
- **Confidence:** [HIGH / MEDIUM / LOW based on source quality, agreement across sources, and read depth]

## Synthesized Patterns
[Cross-cutting patterns across multiple sources]

## Recommendations for Our Implementation
[Specific patterns to adopt, adapted to our codebase conventions]

## Concerns for Developer Review
[Any findings that suggest the design should be revisited — flagged only, not changed. Omit this section if there are no concerns.]
```
