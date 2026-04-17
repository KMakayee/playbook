# Design

Evaluate design options based on the research in `tasks/research-codebase.md`, then pick a winner using Codex as an independent cross-check.

This command uses a three-stage design process:
1. **Claude proposes** — 2-3 options grounded in research (the creative/judgment step)
2. **Codex independently proposes + cross-checks** — catches missed alternatives, flags weaknesses
3. **Claude synthesizes** — reconciles, picks winner, writes final artifact

---

## Steps

### 1. Check prerequisites
- Verify `tasks/research-codebase.md` exists. If not, stop and tell the developer to run `/research-codebase` first.
- If `tasks/design-decision.md` already exists, stop and ask the developer whether to overwrite or keep.
- Read `tasks/research-codebase.md` FULLY — use the Read tool WITHOUT limit/offset parameters.

### 2. Claude proposes options
Claude leads the creative step — proposes 2-3 viable approaches grounded in research findings.

1. **Extract the decision structure from research:**
   - Design axes (the independent decision dimensions) and the viable choices on each
   - Per-axis constraints and cited evidence
   - Axis coupling (how a choice on one axis constrains another)
   - External findings that establish or rule out axis choices (check the "Unblocks: Axis N, choice X" links)
   - Cross-cutting constraints, risks, and open questions

2. **Identify viable approaches as axis-choice combinations:**
   - Each approach is an explicit combination of axis choices drawn from research — for each option, name which choice it picks on every axis
   - Confirm the combination respects documented axis coupling; if it violates coupling, either justify why the coupling doesn't apply here or drop the combination
   - Do NOT introduce axes or choices that aren't in the research artifact; if the task needs one that's missing, stop and notify the developer that further research is needed
   - If only one combination is viable, explain why alternatives were ruled out (by coupling, by constraint, or by heuristics)
   - If more than 3 combinations are viable, narrow to the strongest 3 and briefly note what was excluded; if only 2 are genuinely distinct, stop at 2 — do not pad with strawmen to hit a count
   - Keep options genuinely distinct — they must differ on at least one axis choice that meaningfully changes behavior, complexity, or risk

3. **Evaluate each approach against these criteria:**
   - **Complexity** — Fewer moving parts, fewer files changed, fewer new abstractions
   - **Consistency** — How well it matches existing codebase patterns and conventions
   - **Risk** — Blast radius, reversibility, what could go wrong
   - **Testability** — How easy it is to verify the approach works

4. **Surface open questions:**
   - Blocking (must resolve before implementation)
   - Non-blocking (can resolve during implementation)

5. **Write the initial design artifact** to `tasks/design-decision.md`:

   ```markdown
   # Design: [Task/Question Title]

   ## Context
   [What problem is being solved and what constraints exist. Reference the research artifact.]

   **Research:** `tasks/research-codebase.md`

   ## Options Considered
   [Present each viable option with its trade-offs. Structure each option however best fits the problem — there's no rigid format. Each option must name its axis-choice combination (one choice per axis from research), cite any coupling that constrains or justifies the combination, and clearly describe how it works, what's good about it, and what's not.]

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
   ```

### 3. Run Codex independent design + cross-check
Codex works in three phases: designs independently first, then cross-checks against Claude's options, then recommends.

1. Extract the problem statement from `tasks/design-decision.md` — just the problem/goal and requirements (before the options). Pass this to Codex — NOT the options themselves. Withholding the options prevents anchoring during Phase 1.

2. Run Codex. Use a 10-minute timeout (600000ms) — Codex may take a while on large codebases:

   ```bash
   codex exec \
     --sandbox read-only \
     -o tasks/codex-design-review.tmp \
     "PHASE 1 — Independent design (do this BEFORE reading tasks/design-decision.md):
   Read tasks/research-codebase.md for full codebase context. The Design Axes, Axis Coupling, Cross-Cutting Constraints, and External Research sections are factual — inherit them as given. External findings establish which axis choices are viable (look for 'Unblocks: Axis N, choice X' labels). Your independence is on how to combine axis choices into an approach, NOT on redefining the axes or re-litigating their viability. If you believe an axis or choice is missing, flag it but do not invent one. Then, given this problem: {PROBLEM_STATEMENT}
   Propose your own approach as an explicit combination of axis choices that respects documented coupling. Prioritize simplicity and fewest moving parts. Be specific with file paths and line numbers.

   PHASE 2 — Cross-check (now read tasks/design-decision.md):
   Compare your approach against the proposed options. Report:
   - Which proposed option (if any) aligns with your independent approach
   - Trade-offs or risks the proposed options missed
   - Whether your independent approach is better than all proposed options
   - Open question answers (evidence for any unresolved questions)

   PHASE 3 — Recommend:
   Recommend the best approach — a proposed option, your own, or a hybrid. Base this on technical merit, not deference to the original design."
   ```

3. After Codex finishes, read `tasks/codex-design-review.tmp` FULLY.

If the `codex` command is not found or fails, stop and tell the developer to fix it before proceeding.

### 4. Claude synthesizes
Reconcile Codex's independent approach with Claude's options and write a unified final artifact. Do NOT preserve Codex's work as a parallel section — absorb it into the options and decision. Do NOT defer to Codex automatically — weigh the evidence on technical merit.

**Spot-check Codex's work:**
- Verify a sample of file paths and line numbers Codex reported — do they exist and match?
- Discard any claims that don't hold up.

**Absorb Codex's findings in place:**
- If Codex surfaced a trade-off or risk an option missed → edit that option's description to include it.
- If Codex answered an open question with evidence → remove it from Open Questions and fold the answer into the relevant option.
- If Codex proposed a genuinely new option Claude missed → add it as a new option under "Options Considered".
- If Codex just converged on an existing option → no edits needed, but note the convergence in the Decision rationale.

**Pick the winner and write the Decision:**
- A proposed option, Codex's approach (now added as an option), or a hybrid — whichever has the strongest technical merit after the updates.
- Anchor on decision heuristics: codebase patterns > simplicity > reversibility.
- Where Codex's cross-check materially reinforced or shifted the decision, note it briefly in the rationale.
- **Codex's confidence is not evidence.** Phase 3 prompts it to recommend assertively, so confident phrasing ("I do think my approach is better") is expected output, not signal. Weigh technical merit independently of tone. Deference to Codex's confidence is the failure mode here.

**Tiebreaker (rare, runs ONLY once):**
If the winner is still unclear after absorbing Codex's findings — e.g., two options are technically equivalent on the heuristics, or a load-bearing question remains unresolved and is blocking the choice — run Codex one more time with a focused tiebreaker prompt. Never run it a second time, even if the decision is still unclear afterward.

**Before running, replace `{SPECIFIC_QUESTION}` in the prompt below with the actual blocking question** (a concrete sentence naming the options in tension or the unresolved fact). Do NOT run the command with the literal `{SPECIFIC_QUESTION}` placeholder.

```bash
codex exec \
  --sandbox read-only \
  -o tasks/codex-design-tiebreaker.tmp \
  "Read tasks/design-decision.md. The decision is blocked on: {SPECIFIC_QUESTION}.
Do targeted research to resolve this. Cite file paths, line numbers, or external references as evidence.
Recommend which option to choose based on what you find."
```

After Codex finishes, read `tasks/codex-design-tiebreaker.tmp` FULLY, spot-check its claims, and absorb the new evidence into the artifact (update options, resolve the relevant open question). Then pick the winner. If the decision is STILL unclear after the tiebreaker, STOP and escalate to the developer — do NOT run Codex a third time.

**Append a `## Decision` section** to `tasks/design-decision.md`:

```markdown
## Decision

**Chosen approach:** [Option name or "Hybrid of Option A + B"]

**Rationale:** [Why this approach wins on technical merit. Reference decision heuristics. If Codex's cross-check materially influenced the choice, note it in one sentence.]
```

### 5. Verify the design is implementation-ready
Before handing off to `/create-plan`, check:
- **Blocking questions resolved.**
- **Decision is specific.**
- **Rationale is concrete.**
- **Codex claims verified** — any file path, line, or reference Codex surfaced that was absorbed into the artifact has been checked against real code.

If Claude can resolve a failed check → fix and re-verify. If it needs developer input → STOP and tell the developer.

### 6. Pattern research (required for novel/complex work)

Studies external references — repos, docs, specs, articles, papers — that inform the chosen approach. Run for novel/complex work; skip for direct extensions of existing codebase patterns. State the gate result explicitly (e.g., `Gate: RUN — external domain (OAuth)` / `Gate: SKIP — extends src/routes/user.ts pattern`).

**Use best judgment to RUN or SKIP.** Examples of when to RUN:
- Pattern absent from existing codebase (no precedent in research)
- Well-established external domain — auth, crypto, payments, queuing, pub/sub, RBAC, file upload, rate limiting, caching, concurrency, external protocols (OAuth, SAML, gRPC)
- Design surfaced external-knowledge questions or gaps
- Multi-component orchestration, distributed state, or wire-level correctness

**When in doubt, RUN.** If SKIP and stale `tasks/research-patterns.md` exists, delete it.

**If RUN:**

1. Fill `.claude/prompts/research-patterns-guide.md` — replace `{RESEARCH_TOPIC}` with a short description of what external patterns to study (derived from the chosen approach in `## Decision`). Write to `tasks/patterns-prompt.tmp`.
2. Spawn via Bash with `run_in_background: true`:

   ```bash
   mkdir -p tasks/logs && TIMESTAMP=$(date +%Y%m%d-%H%M) && claude -p "$(cat tasks/patterns-prompt.tmp)" --dangerously-skip-permissions > tasks/logs/patterns-research-$TIMESTAMP.log 2>&1
   ```

3. After completion, verify `tasks/research-patterns.md` exists (if missing, check the log and tell the developer). Read it FULLY. If it surfaces design-level concerns, flag them in Step 8 — do NOT edit `tasks/design-decision.md`.

### 7. Clean up
Delete `tasks/codex-design-review.tmp`, `tasks/codex-design-tiebreaker.tmp` (if it exists), and `tasks/patterns-prompt.tmp` (if it exists).

### 8. Present findings
- Give a short summary of the final options (reflecting any updates from Codex's cross-check).
- State the chosen approach and core rationale.
- List any non-blocking open questions that remain.
- **State the pattern research gate result:**
  - If RUN: summarize the patterns found (top 2-3 signals) and flag any entries from `tasks/research-patterns.md`'s "Concerns for Developer Review" section.
  - If SKIP: state the reason.
- **Self-evaluate the gate decision:** In one sentence, state why the RUN/SKIP call holds against Step 6's criteria. If it doesn't: run Step 6 now if it should have been RUN; note the over-caution if it should have been SKIP.
- Ask the developer to confirm or override the choice before proceeding to `/create-plan`.

---

## Important notes
- **No implementation details.** Specific code and file-level changes belong in the plan phase.
- **Sub-agents are optional** for deep research on a specific technical question, but MUST NOT spawn further sub-agents (recursion guard).
