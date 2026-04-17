# Codebase Research

Research the codebase thoroughly to answer this task:

{TASK}

## Context & Search Hints

These accelerate file discovery. They are not scope constraints — investigate beyond them.

{SEARCH_HINTS}

## What to investigate

### 1. File & Code Map
Find ALL files, functions, classes, and modules relevant to the task. For each, report:
- File path
- Key functions/classes with line numbers
- One-line description of what it does

### 2. Current Behavior
Trace how the system currently handles the area in question:
- Entry points (where does the flow start?)
- Data flow (what gets passed where?)
- Side effects (what gets written, sent, or mutated?)
- Edge cases and error handling

### 3. Design Axes
Decompose the decision into independent axes (dimensions). For each axis, surface the raw material — do NOT combine axes into full implementation approaches. That's the design phase's job.

For each axis:
- **Name the axis** — the specific decision dimension (e.g., "storage shape", "keying strategy", "where embeddings live")
- **List viable choices** — 2-4 discrete points on that axis, each grounded in codebase patterns, specs, or precedent (not general knowledge)
- **Per-axis constraints** — what every choice on this axis must respect (spec sections, existing contracts, precedent from related code)
- **Evidence** — file paths, line numbers, spec references backing each choice and constraint

Then surface **axis coupling** — when a choice on one axis constrains what's viable on another. Coupling is factual (it comes from the codebase/spec), so it belongs in research, not design. Format: "If Axis N = X → Axis M is narrowed to {A, B}" with the reason and reference.

Do NOT:
- Propose full combinations ("Option A: X + Y + Z") — let design combine
- Rank axes or recommend a choice — just enumerate what's viable and why
- Invent axes that aren't grounded in the task; if the decision has only one real axis, say so

### 4. Cross-Cutting Constraints
Identify constraints that apply to any solution regardless of axis choice:
- Interfaces and contracts (type signatures, API schemas)
- Naming conventions and code style patterns
- Dependencies and version requirements
- Test infrastructure and coverage in the area

### 5. Related Precedents
Holistic precedents only — end-to-end similar problems that span multiple axes and show how someone previously decomposed a comparable task. Report:
- Where the precedent lives (module/file paths)
- Which axes it touches and what it chose on each
- How the overall shape relates to the current task

Axis-local precedents (e.g., "this one axis was previously handled as X") belong inline under the relevant axis as Evidence in §3, not here. Skip this section if no multi-axis precedent exists.

### 6. External Knowledge Gaps
Flag anything the task requires that can't be answered from the codebase alone:
- External libraries or APIs that need documentation lookup
- Protocols, specs, or standards the implementation must follow
- Migration guides or changelog details for version upgrades
- Reference repositories or open-source implementations worth studying
- Domain knowledge not captured in the code

**Audit axes for external dependencies:** Before finishing, walk every axis from §3 and check whether each choice is evaluable from codebase+spec alone. If a choice's viability depends on external knowledge (e.g., "does library X support feature Y?", "what's the behavior of API Z in version N?"), that's a mandatory external-research target — not optional. For each such gap, name which axis/choice it blocks so the downstream researcher can prioritize.

Don't research these yourself — just list what needs external research and why.

## How to report
- Be exhaustive — breadth matters more than depth
- Use specific file paths and line numbers
- Show short code snippets when they illustrate a pattern or constraint
- Organize by topic, not by discovery order
- Flag ambiguities — if something is unclear, say so
- If you discover something not covered by the search hints, report it — the hints are a starting point, not a boundary
