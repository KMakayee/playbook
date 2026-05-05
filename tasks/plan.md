# Plan: Mock test for /implement-codex

> **MOCK ARTIFACT** — replaces the real Task 12 plan at HEAD `4bebf29`. Restore via `git checkout 4bebf29 -- tasks/plan.md tasks/research-codebase.md tasks/design-decision.md` after the test.
>
> **Single-batch plan.** Two small phases. Used to dry-run `/implement-codex` end-to-end against a real Codex CLI invocation, with neither phase requiring network access nor touching critical code.

## Design decision reference

- **Source artifacts:** `tasks/design-decision.md`, `tasks/research-codebase.md` (both stubs — this is a mock test).

## Scope boundaries — what we are NOT doing

- Not editing any file other than `tasks/mock-target.md`.
- Not introducing new abstractions, configs, or dependencies.
- Not running the test/lint suite (the playbook has no such suite for command files).

## Phase 1 — Create `tasks/mock-target.md`

**Goal.** Create `tasks/mock-target.md` with a single H1 heading and nothing else.

**Why a separate file.** This is a mock test. The file is the synthetic edit target.

**File allow-list:**
- `tasks/mock-target.md`

**Edit instructions.** Create the file with **exactly** this content (one line of content followed by a single trailing newline):

```
# Mock target
```

Do not add any comments, blank lines beyond the trailing newline, or other content. The file should be three lines total when viewed, but only one line of meaningful content (`# Mock target`).

**Verification (Phase 1 success criteria):**
- [x] `test -f tasks/mock-target.md` returns 0.
- [x] `grep -q '^# Mock target' tasks/mock-target.md` returns 0.
- [x] `wc -l tasks/mock-target.md` reports 1 line (or 2 if trailing newline counts as a line per `wc`).

**Commit:** `feat(mock): create tasks/mock-target.md scaffold (Phase 1)`.

## Phase 2 — Append a checklist item

**Goal.** Append a single GitHub-flavored markdown checklist item below the existing heading in `tasks/mock-target.md`.

**File allow-list:**
- `tasks/mock-target.md`

**Edit instructions.** Append **exactly** this line at the end of `tasks/mock-target.md`, after the existing `# Mock target` heading:

```
- [ ] first task
```

The final file should read:

```
# Mock target
- [ ] first task
```

Do not add any other content.

**Verification (Phase 2 success criteria):**
- [ ] `grep -q '^- \[ \] first task' tasks/mock-target.md` returns 0.
- [ ] The file's first line is still `# Mock target` (`head -n 1 tasks/mock-target.md` outputs `# Mock target`).
- [ ] `wc -l tasks/mock-target.md` reports 2 lines (or 3 with trailing newline).

**Commit:** `feat(mock): append checklist item to tasks/mock-target.md (Phase 2)`.

## End-to-end success criteria (cross-phase)

After both phases:
- [ ] `tasks/mock-target.md` exists with two content lines: the heading and the checklist item.
- [ ] Two phase commits in `git log` (one per phase, conventional-commit style).
- [ ] `tasks/implement-codex-metrics.md` exists and contains 2 rows (one per phase) with `State=done` and `Files written=1`.
- [ ] No leftover `tasks/codex-implement-phase-*.tmp`, `tasks/codex-mismatch-*.tmp`, or `tasks/codex-blocked-*.tmp` artifacts (Step 10 cleanup).

## Artifact references

- `tasks/research-codebase.md` — mock research stub.
- `tasks/design-decision.md` — mock design stub.
- `.claude/commands/implement-codex.md` — the command being tested.
- `.claude/prompts/implement-codex-phase-brief.md` — the per-phase brief template.
