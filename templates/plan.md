# Plan: [Task Title]

> **Prerequisites:** `research.md` exists and has been read. Context has been compacted after the Research phase.
> **Rule:** Do not implement until this plan is reviewed and approved by a human.

```yaml
issue: "#N"
branch: [current branch]
commit: [HEAD short hash at time of planning]
created: [YYYY-MM-DD]
```

---

## Objective

[1-2 sentences: What this plan accomplishes. Ties back to the task description in research.md.]

---

## Changes

### Step 1: [Short description of change]

**Files:**
- `path/to/file.ts` (L42–L78) — [What changes and why]
- `path/to/other.ts` (L10–L15) — [What changes and why]

**Tests:**
- [ ] [Test to add or update, with file path]

**Verification:**
- [ ] [How to confirm this step worked — e.g., "run `npm test -- file.test.ts`"]

### Step 2: [Short description of change]

**Files:**
- `path/to/file.ts` (L100–L120) — [What changes and why]

**Tests:**
- [ ] [Test to add or update, with file path]

**Verification:**
- [ ] [How to confirm this step worked]

[Continue for each step. Keep steps small enough to verify independently.]

---

## Testing Strategy

**New tests:**
- [List of new test cases to write, with file paths]

**Modified tests:**
- [List of existing tests that need updating, with file paths and reason]

**Manual verification:**
- [Any manual checks needed beyond automated tests]

---

## Rollback Strategy

[How to undo this change if something goes wrong. Be specific:
- Git revert? Which commits?
- Feature flag to disable?
- Database migration to reverse?]

---

## Dependencies

[What must be completed before this change can be made? What other systems or tasks depend on this change?
- Prerequisite changes (e.g., migrations must run first)
- Downstream effects (e.g., API consumers need to update)
- External coordination (e.g., environment variable deployment)]

---

## Out of Scope

[Explicitly list related things this plan does NOT address. Prevents scope creep during implementation.]
- [Item 1]
- [Item 2]
