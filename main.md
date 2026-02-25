# No Vibes Allowed
## Implementation Guide for AI-Assisted Engineering in Complex Codebases
*Based on Dex Horthy's talk — AI Engineer Code Summit*

---

> **What This Guide Is For:** This guide operationalizes the key strategies from Dex Horthy's "No Vibes Allowed" talk into a concrete process your team can adopt. The central thesis: AI coding agents fail in complex codebases not because of model quality, but because of poor context management. The solution is disciplined context engineering and the RPI (Research, Plan, Implement) workflow.

---

## Table of Contents

1. [Understanding the Problem](#part-1-understanding-the-problem)
2. [The Dumb Zone — Why Context Is Everything](#part-2-the-dumb-zone--why-context-is-everything)
3. [The Architecture — Sub-Agents and research.md](#part-3-the-architecture--sub-agents-and-researchmd)
4. [The RPI Workflow — Research, Plan, Implement](#part-4-the-rpi-workflow--research-plan-implement)
5. [How to Implement This at Your Team](#part-5-how-to-implement-this-at-your-team)
6. [Quick Reference — The No Vibes Checklist](#part-6-quick-reference--the-no-vibes-checklist)
7. [Common Pitfalls and How to Avoid Them](#part-7-common-pitfalls-and-how-to-avoid-them)
8. [Behavioral Standards — The Layer Above Process](#part-8-behavioral-standards--the-layer-above-process)
9. [Key Takeaways](#key-takeaways)

---

## Part 1: Understanding the Problem

### Why AI Fails in Complex Codebases

A GitHub survey of 100,000 developers found a consistent pattern: AI tools excel on simple, greenfield projects but collapse on complex, legacy (brownfield) codebases. Teams see pull request counts triple, code churn explode, and rework skyrocket — but net productivity stays flat.

> *"Most of the time you use AI for software engineering you're doing a lot of rework, a lot of codebase churn, and it doesn't really work well for complex tasks and brownfield codebases."*
> — Dex Horthy, HumanLayer

The root cause is not the model. It is what you put in the context window.

### The Staff Engineer Divide

A predictable split emerges in teams that adopt AI tools without discipline:

- **Senior engineers avoid AI tools** — they spend more time cleaning up slop than the tools save them.
- **Junior and mid-level engineers adopt AI heavily** — it fills skill gaps but also produces low-quality code that creates technical debt.
- **The net result:** seniors become human linters for AI-generated code, rather than building features.

> *"Staff engineers don't adopt AI because it doesn't make them that much faster. Junior and mid-level engineers use it a lot because it fills in skill gaps — and then it also produces some slop."*
> — Dex Horthy, HumanLayer

---

## Part 2: The Dumb Zone — Why Context Is Everything

### What Is the Dumb Zone?

LLMs don't perform uniformly across their context window. Performance degrades significantly as the context fills up — this is the **"Dumb Zone."** Research from Stanford and UC Berkeley documents this as the "Lost in the Middle" phenomenon: models struggle to use information that appears in the middle of long contexts.

| Zone | Context Utilization | Behavior |
|---|---|---|
| **Smart Zone** | Under ~40% | Model reasons well, produces high-quality code, follows architecture |
| **Dumb Zone** | Over ~40% | Reasoning degrades, hallucinations increase, output becomes slop |

### Intentional Compaction

The practice of keeping the AI in the Smart Zone is called **Intentional Compaction**. This means actively reducing and reorganizing what's in the context window before it fills up — not after the model starts producing bad output.

Key compaction techniques:

- **Compress file contents:** instead of pasting entire files, summarize the relevant portions into concise descriptions.
- **Compact conversation history:** periodically summarize the conversation so far rather than carrying the entire chat forward.
- **Use sub-agents for research:** have separate agent calls gather information, then pass only their summary output to the main agent.
- **Write intermediate artifacts:** use files like `research.md` to persist context externally rather than inflating the window.

> *"The hardest problem you can solve — the ceiling goes up the more context engineering compaction you're willing to do."*
> — Dex Horthy, HumanLayer

---

## Part 3: The Architecture — Sub-Agents and research.md

When the agent receives a task like `/research_codebase ...`, instead of dumping the entire codebase into the context, it spawns specialized sub-agents. Each sub-agent handles a narrow slice of the codebase — keeping its own context small — and writes its findings to a shared file.

### The Sub-Agent Stack

```
┌─────────────────────────────────────────┐
│           System Instructions            │
│   CLAUDE.md · Built-in Tools · MCP Tools │
├─────────────────────────────────────────┤
│              User Message                │
│        /research_codebase ...            │
├─────────────────────────────────────────┤
│     subagent: codebase-explorer          │
│  (locate + analyze + patterns in 1 pass) │
├─────────────────────────────────────────┤
│                 Write()                  │
└──────────────────────┬──────────────────┘
                       │
                       ▼
             ┌─────────────────┐
             │   research.md   │
             │  max 1000 lines │
             └─────────────────┘
                  ~20% context used
```

### Layer-by-Layer Breakdown

| Layer | Description |
|---|---|
| **System Instructions** | `CLAUDE.md`, built-in tools, MCP tools — the persistent harness that defines how the agent operates in your codebase. |
| **User Message** | The task prompt, e.g. `/research_codebase` — kicks off the workflow with minimal context used. |
| **codebase-explorer** | A single sub-agent that locates relevant files, analyzes each area, and identifies codebase patterns — all in one pass. Cannot spawn further sub-agents (recursion guard). |
| **Write()** | Main agent writes all findings to `research.md` — an artifact (max 1000 lines) that lives outside the context window. |
| **research.md output** | The final deliverable of the Research phase. Consumed in the Plan phase without re-doing all the work. |

> **Key Efficiency Insight:** The diagram shows "~20% context used" at the bottom. By consolidating research into a single sub-agent and writing concise findings to `research.md`, the main agent's context window stays well within the Smart Zone for the most important part of the job: planning and implementing changes.

---

## Part 4: The RPI Workflow — Research, Plan, Implement

The RPI workflow is the top-level process that governs how your team (and your agents) approach any non-trivial task in a complex codebase. It enforces deliberate, systematic thinking before any code is written.

---

### [R] Phase 1: Research

Before any code is touched, the agent investigates the codebase to understand the system. The goal is to gather ground truth — not to make changes.

**What happens in Research:**
- A single `codebase-explorer` sub-agent locates relevant files, reads and analyzes each area, and identifies codebase patterns — all in one pass.
- Only split into multiple agents for genuinely large tasks (15+ files across multiple unrelated domains).
- All findings are written to `research.md` (do not exceed 1000 lines).

**What research.md should contain:**
- Specific file paths and line numbers relevant to the task.
- Existing patterns and conventions in the codebase (naming, structure, testing).
- Dependencies and integration points that will be affected.
- Known constraints or gotchas discovered during research.
- A summary of the system's current behavior in the relevant area.

> **Why This Matters:** Skipping research is the primary cause of slop. Agents that go straight to implementation hallucinate structure, miss existing patterns, and produce code that doesn't fit the codebase — requiring expensive rework.

---

### [P] Phase 2: Plan

Using the `research.md` artifact, the agent (or human) generates a detailed markdown plan. This is the most important step for maintaining human oversight without slowing down velocity.

**What a good plan contains:**
- Exact file names and line numbers for every change.
- Step-by-step description of what will be modified and why.
- Testing strategy — what tests will be added or modified.
- Rollback strategy — how to undo the change if something goes wrong.
- Dependencies — what must be done before this change, what depends on it.

**Mental Alignment: The purpose of the Plan phase**

The plan serves a specific function beyond just organizing work: it creates **mental alignment** between the human engineer and the AI agent. Reviewing a plan is how you maintain oversight without doing a deep code review of every line.

> *"Mental alignment replaces deep code review. Humans review the intent, not thousands of lines of generated code — allowing faster velocity without losing control."*
> — Dex Horthy, HumanLayer

> **Critical Rule:** Do not outsource your thinking to the plan phase. AI amplifies existing thought processes but cannot replace engineering judgment. If a plan looks wrong to you, it is wrong. Stop, correct it, and then implement. Never implement a plan you haven't actually read.

---

### [I] Phase 3: Implement

With research complete and a reviewed plan in hand, the agent implements the changes. At this point, the context window contains only what matters: the plan and the specific files to change. The research is already captured in `research.md` and doesn't need to be re-loaded.

**Implementation principles:**
- Follow the plan exactly. Deviations require a plan update, not an improvisation.
- Keep changes minimal — only modify what the plan specifies.
- Run tests after each logical unit of change, not just at the end.
- If the agent encounters something unexpected, stop and return to the Research phase for that sub-problem.
- Commit frequently with descriptive messages tied to plan steps.

---

## Part 5: How to Implement This at Your Team

### Step 1: Establish Your Harness Engineering

"Harness engineering" is the upfront work of integrating AI agents with your specific codebase, tools, and workflows. Generic prompts fail. Custom integrations scale.

Your `CLAUDE.md` (or equivalent system instructions file) should contain:
- A description of your codebase's top-level architecture.
- Directory structure and what lives where.
- Naming conventions and coding standards.
- Testing patterns and frameworks in use.
- How to run the test suite and linting locally.
- Key integration points (APIs, services, databases).
- What NOT to change without human review (critical paths, security-sensitive code).

### Step 2: Define Your Sub-Agent Prompts

Create reusable prompt templates for each sub-agent role. These should be tuned to your codebase:

| Sub-Agent | Core Prompt Instruction |
|---|---|
| **codebase-explorer** | *Given this task: [TASK], do the following in a single pass: (1) Identify all relevant files, directories, and modules. (2) Read each relevant file and summarize: current behavior, key functions/classes, dependencies, and gotchas. Be specific with line numbers. (3) Identify naming conventions, testing patterns, error handling patterns, and architectural decisions. Return a structured report covering all three areas. Do NOT spawn sub-agents.* |

**Recursion guard:** Sub-agents MUST NOT spawn further sub-agents or follow RPI. They are leaf tasks: read, search, and report.

### Step 3: Establish Compaction Triggers

Define clear rules for when to compact. Don't wait until the model starts degrading. Compact proactively:

- After every Research phase, before starting the Plan phase.
- Whenever context utilization exceeds 30–35% (before hitting the Dumb Zone).
- When switching from one sub-problem to another within a large task.
- At the start of each new conversation — never carry forward a previous session's full context.

### Step 4: Code Review the Plan, Not Just the Code

Change your team's code review culture. The most valuable review happens at the Plan phase, not after implementation:

- Every non-trivial task should produce a `plan.md` before any code is written.
- Plans are reviewed asynchronously — they're readable in minutes, unlike PRs that take hours.
- Reviewers should focus on: Does this plan make sense architecturally? Are the file targets correct? Is the testing strategy sufficient?
- If the plan passes review, implementation is usually fast and correct. If it fails, the cost is low — no code was written yet.

### Step 5: Measure Outcome Metrics, Not Activity Metrics

The classic failure mode is optimizing for PRs merged instead of features shipped. Measure:

- **Rework cycles** — how often does a change need to be revisited within 2 weeks?
- **Slop rate** — what percentage of AI-generated code gets reverted or heavily rewritten?
- **Plan accuracy** — how often does implementation match the plan without deviations?
- **Time-to-merge for complex changes**, not just simple ones.

---

## Part 6: Quick Reference — The No Vibes Checklist

### Pre-Task
- [ ] Ensure `CLAUDE.md` / system instructions are up to date with recent codebase changes.
- [ ] Start a fresh context window — do not continue from a previous long conversation.
- [ ] Define the task clearly: what is the expected input, output, and success criteria?
- [ ] If 2+ files or architectural decisions → begin RPI.

### Research Phase
- [ ] Run a single `codebase-explorer` sub-agent to locate, analyze, and identify patterns in one pass.
- [ ] Write all findings to `research.md` (do not exceed 1000 lines).
- [ ] Check: is context still under ~35%? If not, compact before proceeding.

### Plan Phase
- [ ] Generate `plan.md` from `research.md` — do NOT start from scratch or from memory.
- [ ] Plan must include: specific file paths, line numbers, testing strategy.
- [ ] Human reviews the plan before any code is written.
- [ ] If plan looks wrong, return to Research — do not proceed on a bad plan.

### Implement Phase
- [ ] Implement exactly what the plan says.
- [ ] Run tests after each logical unit of change.
- [ ] If something unexpected appears, stop and update the plan.
- [ ] Commit with messages that reference plan steps.
- [ ] Final review: does the implementation match the plan?

---

## Part 7: Common Pitfalls and How to Avoid Them

### ❌ Pitfall: Vibe Coding
**Problem:** Skipping Research and Plan, going straight to "just ask Claude to fix it."
**Fix:** If the task touches 2+ files or involves architectural decisions, run full RPI — no shortcuts.

---

### ❌ Pitfall: Context Ballooning
**Problem:** Letting a conversation run too long, accumulating test output, file dumps, and back-and-forth.
**Fix:** Set a compaction trigger at 30% context. Start fresh conversations for new sub-tasks.

---

### ❌ Pitfall: Outsourcing Judgment
**Problem:** Approving a plan without actually reading it because "the AI probably got it right."
**Fix:** Read every plan. If you can't explain what it does, it hasn't been reviewed.

---

### ❌ Pitfall: Generic System Instructions
**Problem:** Using a boilerplate `CLAUDE.md` that doesn't reflect your actual codebase.
**Fix:** Invest time in harness engineering. Update `CLAUDE.md` when you make architectural changes.

---

### ❌ Pitfall: Measuring PRs Not Outcomes
**Problem:** Celebrating that the team merged 3x more PRs, while ignoring that rework also tripled.
**Fix:** Track rework cycles and slop rate. Slow down and fix process before scaling output.

---

## Part 8: Behavioral Standards — The Layer Above Process

The RPI workflow handles *what* the agent does. This section addresses *how well* it does it. These six principles emerged from real-world experience with AI coding agents and address the most common failure modes that survive even when RPI is followed correctly.

---

### Quality Standards: Why "Prove It Works" Beats "Tests Pass"

Running tests is necessary but not sufficient. A test suite can pass while the actual behavior is broken — stale fixtures, mocked-away dependencies, or tests that don't cover the change. The quality bar is: **can you show evidence that the change works as intended?**

This means:
- Diffing output against expected behavior, not just checking exit codes.
- Verifying the fix addresses the *reported* symptom, not just the *test-covered* code path.
- Applying senior-engineer judgment: "Does this look right?" is a valid and necessary check.

The "surgical changes" principle reinforces this. Every changed line should trace back to the plan. Drive-by refactors, style fixes in adjacent code, and "while I'm here" improvements all increase risk without increasing value. They also make code review harder because reviewers can't distinguish intentional changes from noise.

The elegance check — "is there a simpler way?" — is intentionally limited to non-trivial changes. For a one-line typo fix, the question is a waste of time. For a new abstraction that touches 8 files, it's the most important question you can ask. The dividing line is judgment, not a rule.

---

### Self-Improvement Loop: Why Correction Capture Compounds Over Time

Without a persistent record of mistakes, the same corrections recur across sessions. The agent has no memory of what went wrong last time. A `lessons.md` file solves this by making corrections durable.

The key design decisions:
- **Entries require a root cause and prevention rule**, not just "what happened." A lesson that says "I edited a file without reading it" is useless. A lesson that says "Always read a file before editing — no exceptions, even for obvious changes" is actionable.
- **Same mistake twice = lesson is too weak.** If the prevention rule didn't prevent the mistake, the rule needs rewriting. This creates a ratchet: lessons get stronger over time.
- **Session-start review** is critical. The lessons only work if they're loaded into context before work begins. This is why the file lives in `tasks/` (project-local) rather than a global location — lessons are codebase-specific.

Over weeks of use, a well-maintained `lessons.md` becomes a project-specific behavioral profile that makes the agent measurably better at working in *this* codebase.

---

### Autonomous Bug Fixing: Why the Agent Should Diagnose, Not the Human

The most common waste of human attention in AI-assisted workflows is the human diagnosing problems for the agent. When a user receives a bug report and passes it to the agent, the agent should:

1. Read the error log or bug report
2. Trace from symptoms to root cause (using Research phase if multi-file)
3. Fix the root cause
4. Verify the fix
5. Report what it did and why

Asking the user "what do you think is wrong?" or "which file should I look at?" defeats the purpose. The agent has access to the codebase, the error logs, and the ability to search — it should use them.

This doesn't mean skipping RPI. A bug that spans multiple files still needs Research → Plan → Implement. The autonomy is about *initiative and diagnosis*, not about skipping process. The agent should arrive at the plan on its own, then present it for approval as usual.

---

### Task Progress Tracking: Why Visibility Reduces Anxiety and Improves Debugging

When an agent is implementing a 6-step plan, silence is the enemy. The human doesn't know if the agent is on step 2 or step 5, whether something failed, or whether the agent quietly deviated from the plan.

`tasks/todo.md` solves this by providing:
- **Real-time visibility** — the human can check progress at any point without interrupting the agent.
- **Result summaries** — each completed step records what actually happened, not just that it was done. This is critical for debugging when a later step fails.
- **Separation from the plan** — `plan.md` is the approved spec and should not be modified during implementation. `todo.md` is the live tracker. This distinction prevents the plan from becoming a moving target.

The overhead is minimal — updating a checkbox and writing one line of result text per step — but the payoff in transparency and debuggability is significant.

---

To implement this successfully, keep these principles front and center:

1. **Context is the only lever you have.** LLMs are stateless — the only thing you control is what goes in the context window. Treat it as a scarce resource.

2. **The RPI workflow is not optional for complex tasks.** Research first, plan second, implement third — always, without shortcuts.

3. **40% is the cliff.** Keep context utilization under 35–40% to stay in the Smart Zone. Compact proactively.

4. **Sub-agents keep the main context lean.** Use a single `codebase-explorer` to do all research in one pass, then aggregate into `research.md`.

5. **Plans are for humans, not just agents.** The Plan phase exists to give you mental alignment and oversight without deep code review.

6. **Harness engineering is the multiplier.** The more your system instructions reflect your actual codebase, the better every agent call performs.

> *"The organizational ceiling isn't technical — it's contextual. Teams that solve context engineering sustain AI gains. Those that don't ship slop faster."*

---

*Full talk: [youtube.com/watch?v=rmvDxxNubIg](https://www.youtube.com/watch?v=rmvDxxNubIg) · [humanlayer.dev/nva](https://humanlayer.dev/nva)*
