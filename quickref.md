# RPI Quick Reference

> Scan in 60 seconds. Keep this open while working.

---

## The Rule

RPI applies to any task that touches 2+ files or involves architectural decisions. When RPI runs, all three phases execute — no skipping.

**Bug fix mode:** Bug reports, error logs, failing tests → diagnose and fix autonomously. Don't ask the user to diagnose.

---

## Research Phase (Full RPI)

1. **Explore** — single Explore sub-agent (`max_turns: 15`) locates, reads, analyzes, and identifies patterns in one pass
2. **Write `research.md`** — aggregate findings (do not exceed 1000 lines)
3. **Check context** — if above 30%, compact now
4. **Compact** — summarize and drop raw content before moving on

## Plan Phase

1. **Read `research.md`** — plan from the artifact, not from memory
2. **Write `plan.md`** — every change gets: file path, line numbers, reason
3. **Include tests** — what tests to add/modify, where they live
4. **Include rollback** — how to undo if things go wrong
5. **Include out-of-scope** — prevent scope creep explicitly
6. **Get human approval** — do NOT implement until plan is reviewed

> The plan creates **mental alignment** between you and the agent. Review the *intent*, not every line of generated code.

## Implement Phase

1. **Follow the plan exactly** — deviations require a plan update first
2. **Change only what's specified** — no drive-by refactors or "improvements"
3. **Test after each step** — not just at the end
4. **Stop if surprised** — unexpected behavior → return to Research
5. **Commit per step** — reference plan steps in commit messages
6. **Track progress** — update `tasks/todo.md` with checkable items and result summaries

---

## Compaction Triggers

| When | Action |
|---|---|
| Context hits 30–35% | Compact immediately |
| Research phase done | Compact before Plan |
| Switching sub-problems | Compact before pivoting |
| New conversation | Start clean — never carry full prior context |

---

## Quality Standards

- **Verify before completing** — prove it works (tests, logs, diff). Not "I think it works."
- **Find root causes** — no band-aids. Trace to source, fix the real problem.
- **Surgical changes** — every changed line needs a reason. Can't explain it? Revert it.
- **Demand elegance** — "Is there a simpler way?" (skip for mechanical fixes)
- **Self-assess** — "Would a staff engineer approve this?" If no, revise first.

---

## Self-Improvement

- User correction or failed verification → add entry to `tasks/lessons.md`
- Start of session → read `tasks/lessons.md` before working
- Same mistake twice → rewrite the lesson with a stronger rule

---

## Red Flags

- Skipping Research ("I already know this codebase") → slop
- Planning from memory instead of research.md → hallucinated structure
- Approving a plan you didn't read or think through → outsourced judgment
- Context window growing unchecked → entering the Dumb Zone
- Measuring PRs merged instead of rework rate → false productivity
- Completing a step without verifying it works → false progress
- Same correction from the user twice → lesson not captured or too weak
- Asking the user to diagnose a bug for you → wasted human attention

---

## Outcome Metrics

Track these to know if the workflow is actually helping:

- **Rework cycles** — how often is a change revisited within 2 weeks?
- **Slop rate** — what % of AI-generated code gets reverted or heavily rewritten?
- **Plan accuracy** — how often does implementation match the plan without deviations?
- **Time-to-merge** — for complex changes, not just simple ones
- **Correction repeat rate** — how often does the user give the same feedback twice?

---

## Starting a New Task

```
1. Fresh context window (or compact fully)
2. Define the task: input, output, success criteria
3. If 2+ files or architectural decisions → begin RPI
```

---

## Maintenance

Run `/playbook-update` to fetch the latest playbook version and apply updates interactively. Your team-specific CLAUDE.md sections are never touched.

Run `/playbook-audit` periodically to keep the playbook healthy.

**What it does:**
1. Compares each CLAUDE.md section against the actual codebase — flags stale or unconfigured sections
2. Reviews `tasks/lessons.md` — graduates old entries, consolidates duplicates, flags high-severity for manual review
3. Cleans up leftover task artifacts (`research.md`, `plan.md`, `todo.md`)
4. Generates a health report in `tasks/audit-report.md`

**When to run it:**
- Every 2–4 weeks as routine maintenance
- After major refactors that change tech stack, directory structure, or conventions
- When `tasks/lessons.md` grows past ~25 entries
- When Claude makes outdated assumptions about your codebase
