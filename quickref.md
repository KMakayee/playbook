# RPI Quick Reference

> Scan in 60 seconds. Keep this open while working.

---

## Commands

**Playbook**

```
| Command             | What it does                                                     |
|---------------------|------------------------------------------------------------------|
| `/playbook-setup`   | Configure CLAUDE.md for your codebase                            |
| `/playbook-update`  | Fetch and apply latest playbook version                          |
| `/playbook-audit`   | Health check — stale config, leftover artifacts                  |
| `/fix-tables`       | Wrap bare markdown tables in fenced code blocks                  |
```

**Issue Board**

```
| Command              | What it does                                              |
|----------------------|-----------------------------------------------------------|
| `/issue-research #N` | Research issue #N → produce `tasks/research.md`           |
| `/issue-plan #N`     | Generate `tasks/plan.md` from research findings           |
| `/issue-audit #N`    | Audit plan against research and acceptance criteria       |
| `/issue-implement #N`| Execute the approved plan                                 |
| `/issue-update #N`   | After completion, check impact on other open issues       |
```

**Code Quality**

```
| Command        | What it does                                                                     |
|----------------|----------------------------------------------------------------------------------|
| `/commit`      | Stage, commit, and push to current branch                                        |
| `/push-pr`     | Push, open PR, code review, and merge if passing                                 |
| `/push-pr-light`| Push, open PR, light diff review, and merge if passing                           |
| `/simplify`    | Review changed code for reuse, quality, and efficiency (built-in)                |
| `/batch`       | Decompose large changes into parallel sub-agents in isolated worktrees (built-in)|
| `/loop`        | Run a prompt on a recurring interval, e.g. `/loop 5m check deploy` (built-in)   |
```

---

## LSP Setup (Code Navigation)

LSP gives Claude instant, accurate code navigation — definitions, references, type info, and diagnostics after edits.

**Setup (pick the language(s) your codebase uses):**

1. Install the language server binary (see table below)
2. Install the plugin: `/plugin install <name>@claude-plugins-official`
3. Restart Claude Code

**Supported languages:**

```
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
```

**When to use what:**
- **LSP:** definitions, references, type info, diagnostics after edits
- **Grep/Glob:** discovery, finding files, searching patterns

---

## Pre-Edit Gate

**Before calling Edit or Write, classify the task:**

- **Trivial:** single file, under ~20 changed lines, no new abstractions, no changed interfaces → implement directly
- **Non-trivial:** 2+ files, OR new/changed abstractions, OR modified interfaces/contracts → **full RPI required**

If uncertain, it is non-trivial. Do not Edit/Write source files until the task is trivial OR `plan.md` is approved.

**Bug fix mode:** Diagnose autonomously — don't ask the user to identify root cause. Non-trivial bug fixes still require full RPI.

---

## Research Phase (Full RPI)

1. **Explore** — single Explore sub-agent locates, reads, analyzes, and identifies patterns in one pass. Only split into multiple agents when the task spans multiple unrelated domains.
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
7. **One batch per prompt** — if the plan has independent batches, execute each in its own prompt (pre-edit gate applies per-batch)

---

## Compaction Triggers

```
| When                     | Action                                          |
|--------------------------|-------------------------------------------------|
| Context hits 30–35%      | Compact immediately                             |
| Research phase done      | Compact before Plan                             |
| Switching sub-problems   | Compact before pivoting                         |
| New conversation         | Start clean — never carry full prior context    |
```

---

## Quality Standards

- **Verify before completing** — prove it works (tests, logs, diff). Not "I think it works."
- **Find root causes** — no band-aids. Trace to source, fix the real problem.
- **Surgical changes** — every changed line needs a reason. Can't explain it? Revert it.
- **Demand elegance** — "Is there a simpler way?" (skip for mechanical fixes)
- **Self-assess** — "Would a staff engineer approve this?" If no, revise first.

---

## Red Flags

- Calling Edit/Write before classifying the task → pre-edit gate violation
- Skipping Research ("I already know this codebase") → slop
- Planning from memory instead of research.md → hallucinated structure
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

## Starting a New Task

```
1. Fresh context window (or compact fully)
2. Define the task: input, output, success criteria
3. If non-trivial (see Pre-Edit Gate) → begin RPI
```

---

## Maintenance

Run `/playbook-update` to fetch the latest playbook version and apply updates interactively. Your project-specific CLAUDE.md customizations are preserved during updates.

Run `/playbook-audit` periodically to keep the playbook healthy.

**What it does:**
1. Compares each CLAUDE.md section against the actual codebase — flags stale or unconfigured sections
2. Cleans up leftover task artifacts (`research.md`, `plan.md`, `todo.md`)
3. Generates a health report in `tasks/audit-report.md`

**When to run it:**
- Every 2–4 weeks as routine maintenance
- After major refactors that change tech stack, directory structure, or conventions
- When Claude makes outdated assumptions about your codebase
