# Issue Audit

Audit the plan for issue **#$ARGUMENTS** against research findings and acceptance criteria.

---

## Steps

1. **Read all inputs.** Read `tasks/plan.md`, `tasks/research.md`, and issue `#$ARGUMENTS` from `tasks/new-issues.md`. If any are missing, stop and tell the developer what's needed.

2. **Check acceptance criteria coverage.** For each acceptance criterion in the issue, verify the plan includes steps that address it. Report:
   - Covered: criterion is addressed by specific plan step(s)
   - Missing: criterion is not addressed — flag as a gap

3. **Check open questions.** Review the "Risks & Open Questions" section of `tasks/research.md`. For each item, verify it is either:
   - Resolved in the plan (state how)
   - Explicitly listed as out of scope (acceptable)
   - Still unresolved (flag as a blocker)

4. **Check plan-research alignment.** Flag any mismatches:
   - Plan references files or functions not mentioned in research
   - Plan assumes behavior that contradicts research findings
   - Plan modifies code that research identified as fragile or high-risk without acknowledging the risk

5. **Handle deferred items.** If the plan or research mentions items explicitly deferred or out of scope:
   - Create or append to `tasks/deferred.md` using the structure from `templates/deferred.md`
   - Group entries under the current issue number
   - Include: what was deferred, why, and suggested future action

6. **Update issue status.** In `tasks/new-issues.md`, change issue #$ARGUMENTS status to `In Review`.

7. **Present findings.** Report in three sections:
   - **Solid:** What's well-covered and ready
   - **Needs revision:** Gaps, mismatches, or unresolved questions (with specific recommendations)
   - **Blockers:** Anything that must be resolved before implementation can start

---

## Rules

- This is a review, not a rewrite. Point out problems — don't fix the plan yourself.
- Separate automated checks (file existence, criterion coverage) from judgment calls (is this approach sound?) so the developer knows which findings need their input.
- If everything checks out, say so clearly — don't invent issues.
