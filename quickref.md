# RDPI Quick Reference

> Scan in 60 seconds. Keep this open while working.

---

## Skills

**Playbook**

| Skill               | What it does                                                     |
|---------------------|------------------------------------------------------------------|
| `/playbook-setup`   | Configure CLAUDE.md for your codebase                            |
| `/playbook-update`  | Fetch and apply latest playbook version                          |
| `/playbook-audit`   | Health check — stale config, leftover artifacts                  |
| `/native-agents`    | Install GPT/Gemini native subagent types via local relay (macOS) |

**RDPI Workflow**

| Skill                    | What it does                                                                   |
|--------------------------|--------------------------------------------------------------------------------|
| `/create-todo`           | Turn a rough goal into a structured task backlog → `tasks/todo.md`             |
| `/research-codebase` | Investigate the codebase before writing code — current behavior, relevant paths, patterns, risks → `tasks/research-codebase.md` |
| `/design`            | Evaluate implementation options, cross-check them with a second model, and pick a winner → `tasks/design-decision.md` |
| `/create-plan`       | Turn the finalized design into a reviewed, step-by-step implementation plan for your approval → `tasks/plan.md` |
| `/implement`         | Execute the approved plan phase-by-phase, then code-review the result and apply the fixes |
| `/implement-codex`   | *Experimental.* Like `/implement`, but Codex writes the code and Claude verifies each phase |
| `/forge`             | Build one named piece (code, doc, spec, …) end-to-end: define its contract, build it, then review-and-fix until it passes |

**Issue Board**

| Skill                            | What it does                                              |
|----------------------------------|-----------------------------------------------------------|
| `/issue-research N`    | Investigate issue N and recommend an approach → `tasks/research-issue-N.md` |
| `/issue-plan N`        | Write a reviewed implementation plan for issue N → `tasks/plan-issue-N.md`   |
| `/issue-implement N`   | Execute issue N's plan, then code-review the result and apply the fixes      |
| `/issue-update N`      | After completion, check impact on other open issues                          |
| `/auto-issues`         | Run research → plan → implement for one issue end-to-end (derives N from the `worktree-issue-N` branch) |
| `/issue-finish [N]`    | Commit remaining work + clean up issue artifacts (N optional — overrides branch) |

**Code Quality**

| Skill           | What it does                                                                     |
|-----------------|----------------------------------------------------------------------------------|
| `/finish`       | Wrap up the current task — mark it done, commit all remaining work and artifacts |
| `/commit`       | Stage, commit, and push to current branch                                        |
| `/push-pr`      | Push, open PR, code review, squash-merge if passing                              |
| `/push-pr-light`| Push, open PR, light diff review, squash-merge if passing                        |
| `/catchup`      | Catch a feature branch up to its default base — fetch, merge, surface conflicts  |
| `/checkpoint`   | Save / resume / discard work state in `tasks/checkpoint.md` (auto-detects RDPI phase + cursor) |
| `/codex-review` | Get a second-opinion review of a file, diff, or artifact from a different model    |
| `/codex-audit`  | Check that a derived artifact faithfully matches its source(s) — fidelity, completeness, precision |
| `/codex-research`| Research a question — in the codebase, externally, or "is there a better way" — and keep the findings → `tasks/logs/research/` |

**Built-in (Anthropic-maintained)**

Default-installed in Claude Code and maintained by Anthropic — recommended alongside the playbook skills above.

| Command          | What it does                                                                     |
|------------------|----------------------------------------------------------------------------------|
| `/simplify`      | Review changed code for reuse, quality, and efficiency                          |
| `/batch`         | Decompose large changes into parallel sub-agents in isolated worktrees          |
| `/loop`          | Run a prompt on a recurring interval, e.g. `/loop 5m check deploy`              |
| `/deep-research` | Fan out web searches, verify claims across sources, synthesize a cited research report |
| `/goal`          | Set a persistent objective the agent keeps working toward until done            |
| `/workflows`     | Watch and manage running multi-agent workflows (spawn one by including `ultracode` in your prompt) |
| `/fork`          | Spawn a subagent with a copy of the current context, give it its own instruction — its result comes back to the main chat |

---

## LSP Setup (Code Navigation)

LSP gives Claude instant, accurate code navigation — definitions, references, type info, and diagnostics after edits.

**Setup (pick the language(s) your codebase uses):**

1. Install the language server binary (see table below)
2. Install the plugin: `/plugin install <name>@claude-plugins-official`
3. Restart Claude Code

**Supported languages:**

| Language   | Plugin                 | Binary to install                                  |
|------------|------------------------|----------------------------------------------------|
| Python     | `pyright-lsp`          | `pip install pyright`                               |
| TypeScript | `typescript-lsp`       | `npm install -g typescript-language-server`         |
| Go         | `gopls-lsp`            | `go install golang.org/x/tools/gopls@latest`       |
| Rust       | `rust-analyzer-lsp`    | `rustup component add rust-analyzer`               |
| Java       | `jdtls-lsp`            | `jdtls`                                            |
| C/C++      | `clangd-lsp`           | `clangd` (via LLVM)                                |
| C#         | `csharp-lsp`           | `dotnet tool install csharp-ls`                    |
| PHP        | `php-lsp`              | `npm install -g intelephense`                      |
| Kotlin     | `kotlin-lsp`           | `kotlin-language-server`                            |
| Swift      | `swift-lsp`            | `sourcekit-lsp` (included with Xcode)              |
| Lua        | `lua-lsp`              | `lua-language-server`                              |

**When to use what:**
- **LSP:** definitions, references, type info, diagnostics after edits
- **Grep/Glob:** discovery, finding files, searching patterns

---

## Pre-Edit Gate

Before asking the agent to change code, classify the task:

- **Trivial** — single file, under ~20 lines, no new abstractions or interfaces → just ask for the change directly
- **Non-trivial** — 2+ files, OR new/changed abstractions, interfaces, or cross-module control flow → run the RDPI cycle

If uncertain, treat it as non-trivial. For bugs: hand the agent the symptom and let it diagnose — don't do the root-cause hunt yourself.

---

## The RDPI Cycle

**1. Research** — run `/research-codebase` with the task description → `tasks/research-codebase.md` (relevant paths, current behavior, risks).

**2. Design** — run `/design` → `tasks/design-decision.md`. Check the chosen option before moving on.

**3. Plan** — run `/create-plan` → `tasks/plan.md`. **Read and approve the plan before anything is implemented** — the plan is your alignment point with the agent; review the intent, not every line.

**4. Implement** — run `/implement`. Executes the approved plan phase-by-phase with a code review at the end. If the plan lists independent batches, run one batch per prompt.

---

## Compaction Triggers

| When                     | Action                                          |
|--------------------------|-------------------------------------------------|
| Context hits 30–35%      | Compact immediately                             |
| Research phase done      | Compact before Plan                             |
| Switching sub-problems   | Compact before pivoting                         |
| New conversation         | Start clean — never carry full prior context    |

---

## Quality Standards

- **Verify before completing** — prove it works (tests, logs, diff). Not "I think it works."
- **Find root causes** — no band-aids. Trace to source, fix the real problem.
- **Surgical changes** — minimal diffs, scoped to the task. No drive-by refactors or "improvements."
- **Demand elegance** — "Is there a simpler way?" (skip for mechanical fixes)

---

## Red Flags

- Calling Edit/Write before classifying the task → pre-edit gate violation
- Skipping Research ("I already know this codebase") → slop
- Planning from memory instead of research-codebase.md → hallucinated structure
- Approving a plan you didn't read or think through → outsourced judgment
- Context window growing unchecked → entering the Dumb Zone
- Measuring PRs merged instead of rework rate → false productivity
- Completing a step without verifying it works → false progress
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

## Maintenance

- `/playbook-update` — fetch and apply the latest playbook version; your CLAUDE.md customizations are preserved.
- `/playbook-audit` — run every 2–4 weeks, after major refactors, or when Claude's assumptions feel stale: flags outdated CLAUDE.md sections, cleans leftover artifacts, writes `tasks/audit-report.md`.
