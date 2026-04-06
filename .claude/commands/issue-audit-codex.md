# Issue Audit (Codex)

Audit the plan for issue **#$ARGUMENTS** against research findings and acceptance criteria, using OpenAI Codex for the core analysis.

---

## Steps

1. **Read all inputs.** Read `tasks/plan.md`, `tasks/research-issue-$ARGUMENTS.md`, and issue `#$ARGUMENTS` from `tasks/issues.md`. If any are missing, stop and tell the developer what's needed.

2. **Prepare audit input.** Write the contents of `tasks/plan.md`, `tasks/research-issue-$ARGUMENTS.md`, and the issue's Description + Acceptance Criteria into `tasks/audit-input.tmp`, clearly delimited:

   ```
   === PLAN ===
   [contents of tasks/plan.md]

   === RESEARCH ===
   [contents of tasks/research-issue-$ARGUMENTS.md]

   === ISSUE #$ARGUMENTS ===
   [issue Description, Acceptance Criteria, and Notes]
   ```

3. **Run Codex audit.** Run the following Bash command:

   ```bash
   codex exec \
     --sandbox read-only \
     -o tasks/audit-output.tmp \
     "You are auditing a software implementation plan against research findings and acceptance criteria. Read tasks/audit-input.tmp, then perform these checks:

   1. ACCEPTANCE CRITERIA COVERAGE: For each acceptance criterion in the ISSUE section, verify the plan includes steps that address it. Mark each as Covered (with plan step reference) or Missing.

   2. OPEN QUESTIONS: Review the Risks & Open Questions section of the RESEARCH. For each item, determine if it is: Resolved in the plan (state how), Explicitly out of scope (acceptable), or Still unresolved (flag as blocker).

   3. EXCLUDED AREAS: Review the Excluded/Deprioritized section of the RESEARCH. Flag if the plan touches files or modules that research dismissed.

   4. PLAN-RESEARCH ALIGNMENT: Flag any mismatches:
      - Plan references files or functions not mentioned in research
      - Plan assumes behavior that contradicts research findings
      - Plan modifies code that research identified as fragile or high-risk without acknowledging the risk

   Output a structured report with these four sections. Be specific — reference exact plan steps, research sections, and criteria by name."
   ```

4. **Read Codex output.** Read `tasks/audit-output.tmp` and use it as the basis for your findings.

5. **Handle deferred items.** If the plan or research mentions items explicitly deferred or out of scope:
   - Create or append to `tasks/deferred.md` using the structure from `templates/deferred.md`
   - Group entries under the current issue number
   - Include: what was deferred, why, and suggested future action

6. **Clean up.** Delete `tasks/audit-input.tmp` and `tasks/audit-output.tmp`.

7. **Update issue status.** In `tasks/issues.md`, change issue #$ARGUMENTS status to `In Review`.

8. **Present findings.** Report in three sections:
   - **Solid:** What's well-covered and ready
   - **Needs revision:** Gaps, mismatches, or unresolved questions (with specific recommendations)
   - **Blockers:** Anything that must be resolved before implementation can start

---

## Rules

- This is a review, not a rewrite. Point out problems — don't fix the plan yourself.
- Separate automated checks (file existence, criterion coverage) from judgment calls (is this approach sound?) so the developer knows which findings need their input.
- If everything checks out, say so clearly — don't invent issues.
- If the `codex` command is not found or fails, tell the developer and suggest using `/issue-audit` (the Claude variant) instead.
