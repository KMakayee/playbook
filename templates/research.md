# Research: [Task Title]

> **Do not exceed 1000 lines.** Be specific — file paths, line numbers, actual behavior. Prefer tables and brief findings over exhaustive analysis.
> **Purpose:** This artifact persists context outside the window so the Plan phase can proceed without re-researching.

---

## Task Description

[1-3 sentences: What is being done and why. Include success criteria if known.]

---

## Located Paths

> Files identified during exploration.

| Path | Relevance |
|---|---|
| `src/example/file.ts` | [One-sentence explanation of why this path matters] |
| `src/example/other.ts` | [One-sentence explanation] |
| `tests/example/` | [One-sentence explanation] |

---

## Current Behavior Analysis

> One section per module or area.

### Module: [module/area name]

**File:** `[path/to/file]`

**Key functions/classes:**
- `functionName` (L42–L78) — [What it does, inputs, outputs]
- `ClassName` (L80–L150) — [What it does, key methods]

**Current behavior:**
[Describe what this module actually does today — not what you think it should do. Reference specific line numbers.]

**Dependencies:**
- Imports from: [list modules/packages]
- Imported by: [list consumers]

**Gotchas:**
- [Anything surprising, fragile, or non-obvious discovered during analysis]

### Module: [next module/area name]

[Repeat the structure above for each relevant module.]

---

## Codebase Patterns & Conventions

> Patterns observed in the codebase.

**Naming:**
- Files: [e.g., kebab-case, PascalCase]
- Functions: [e.g., camelCase]
- Types/Interfaces: [e.g., PascalCase, prefixed with I]

**Testing:**
- Framework: [e.g., Vitest]
- File location: [e.g., co-located `*.test.ts`]
- Patterns observed: [e.g., describe/it blocks, factory helpers, test fixtures in `__fixtures__/`]

**Error handling:**
- [e.g., custom Error subclasses, Result types, try/catch at boundaries]

**Architectural patterns:**
- [e.g., repository pattern, dependency injection, event-driven]

---

## Integration Points

| Integration | Direction | Notes |
|---|---|---|
| [Service/API/DB] | [reads from / writes to / both] | [Relevant details for the planned change] |

---

## Risks & Open Questions

- **Risk:** [Description of a risk discovered during research]
- **Open question:** [Something that needs human input or further investigation]

---

## Summary

[3-5 sentences: What was found, what the current state is, and what the implications are for planning. This section is what gets read first when starting the Plan phase.]
