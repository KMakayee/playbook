---
name: design-decision-task-8
description: Design decision for Task 8 (`/catchup`) + Issue #1 closeout
---

# Design: `/catchup` for parallel-worktree catch-up + close Issue #1

## Context

We are adding a new `/catchup` slash command that handles drift detection → merge default in → conflict surfacing → host-project validation → ready-to-push, plus a small staleness gate added to `/push-pr` and `/push-pr-light`. Co-located with this is Issue #1 (default `/push-pr*` to `--squash`, with explicit `--title`), which lands on the same edit surface.

Three architectural facts (from research) constrain the design space hard:

1. **No shared-prompt mechanism.** Slash commands are plain markdown; no `--include` directive. Anything reused between `/catchup` and `/push-pr*` is either duplicated inline or extracted to a shell helper script.
2. **Worktree-only flow.** Four worktrees branched from `main` are active; `git checkout main` is unavailable. Must use `git fetch origin && git merge origin/<default>`.
3. **Slash commands cannot programmatically invoke other slash commands.** `/push-pr*`'s staleness gate must surface "Run `/catchup`" as text and stop, not call `/catchup` and proceed.

**Research:** `tasks/research-codebase.md`

## Options Considered

### Option A — "Inline + CLAUDE.md, conventions-first"

The most natural extension of existing playbook patterns. Treats `/catchup` as a `/checkpoint`-style command and `/push-pr*` additions as defensive shell snippets duplicated inline.

**Axis-choice combination:**
- Axis 1 (default-branch detection):
  - For `/catchup`: **A + D fallback** — `git symbolic-ref refs/remotes/origin/HEAD` first; if unset, prompt the developer.
  - For `/push-pr*` staleness gate: **C-then-A** — if an open PR already exists for the branch, use the PR's `baseRefName` (via `gh pr view --json baseRefName`); otherwise fall back to the detected default. This avoids false positives where a PR targets `dev` but the gate measures against `main`.
- Axis 2 (staleness check location): **A inline duplicated** in `catchup.md`, `push-pr.md`, `push-pr-light.md`. Three files, ~5 lines each — small enough to keep in sync.
- Axis 3 (catch-up op): **A merge** + **C refuse-on-default** (`/catchup` on `main` is a no-op error).
- Axis 4 (conflict UX): **A single conflict report** with explicit "keep BOTH for independent additions" prose, `--abort` escape hatch, and stop-for-developer-resolution.
- Axis 5 (in-progress merge): **B warn-and-ask** — detect `MERGE_HEAD`, offer continue/abort/proceed-anyway.
- Axis 6 (validation source): **A read CLAUDE.md** `Build & Run` and `Testing` sections; agent extracts commands.
- Axis 7 (validation trigger): **A always-if-configured, ASK before running, narrow scope** — read both sections; extract only non-mutating verification commands (lint, typecheck, test runner); explicitly skip `Install dependencies`, `Dev server`, `Production build`, and any `format --write` style mutating commands; show extracted commands to the developer and require confirm/edit before executing. Skip silently on placeholder. Skip entirely when no merge happened (already-up-to-date).
- Axis 8 (already-up-to-date): **A pre-merge `git rev-list --left-right --count`** before any merge attempt; clean idempotent no-op that still recommends `/push-pr` afterward (developer's mental model).
- Axis 9 (reversibility surface): **B inline at applicability** — `--abort` in conflict step, `reset --hard ORIG_HEAD` in post-merge-commit-but-pre-push step.
- Axis 10 (post-validation handoff): **A recommend `/push-pr`** (or `/push-pr-light`); never auto-push.
- Axis 11 (Issue #1 PR-title):
  - For NEW PRs: **D hybrid confirm** — `gh pr create --fill` for body, agent proposes a derived title from latest commit subject (or branch name as fallback), developer confirms or edits, then runs with explicit `--title "..." --fill`.
  - For EXISTING PRs (where `/push-pr*` skips creation today): show the current PR title to the developer when surfacing the URL, and recommend `gh pr edit <num> --title "..."` if it doesn't read cleanly. No automation — squash-commit-title hygiene is a developer judgment call.
- Axis 12 (`/catchup` args): **B optional `<base>` override** (matches `/push-pr <base>` precedent).
- Axis 13 (distribution): **B managed-files + global-install** — add to both `playbook-update.md` managed list and `playbook-setup.md` global-install list.

**Squash-aware post-merge sync:** Existing `push-pr.md:23-25` / `push-pr-light.md:28-30` use `git fetch origin main && git merge origin/main && git push`. Two changes are required: (a) replace hardcoded `main` with the detected default, and (b) reword to acknowledge that with `--squash` the resulting `origin/<default>` tip is a NEW commit (not the feature branch's tip), so `git merge` will produce a small reconciliation merge commit rather than a fast-forward — which is fine, but the prose shouldn't imply fast-forward.

**What's good:** Maximally consistent with `/checkpoint` and `/push-pr*` styles; zero new conventions; CLAUDE.md interpretation pattern is already established (`/playbook-audit`); single fallback path for default-branch detection covers the documented failure mode without adding a `gh` dependency. Existing-PR `baseRefName` reuse is a 2-line shell change but eliminates a real false-positive class. Ask-before-run validation prevents the agent from silently running `npm install`, a dev server, or a formatter.

**What's not:** Inline duplication of staleness logic across three files is real maintenance friction (a developer changing the gate has to keep three files in sync). CLAUDE.md validation hook is still interpretive even with confirmation — the agent's choice of *which* prose to extract is load-bearing. Hybrid PR-title confirm adds an interactive step that didn't exist before. Existing-PR title hygiene is advisory-only, so a developer who skips the recommendation still gets a bad squash commit (acceptable trade — full automation would mean editing PRs the developer didn't ask us to edit).

### Option B — "Helper script + dedicated validation config"

Reduces duplication by extracting the staleness signal into a shell helper (precedent: `.claude/scripts/pipeline-eval.sh`) and replaces CLAUDE.md interpretation with a structured config file.

**Axis-choice combination:**
- Axis 1: **B `gh repo view --json defaultBranchRef`** primary, **A** local fallback, **D** developer prompt as last resort.
- Axis 2: **B helper script** `.claude/scripts/staleness.sh` — emits ahead/behind counts and the recommendation text. `/catchup` and both `/push-pr*` shell out to it.
- Axis 3: **A merge** + **C refuse-on-default**.
- Axis 4: **A single conflict report** (same as A).
- Axis 5: **B warn-and-ask** (same as A).
- Axis 6: **B dedicated `.claude/validation.json`** — schema-defined commands (lint, typecheck, test); `/catchup` (and any future validation-needing command) reads it.
- Axis 7: **A always-if-configured** + skip-if-file-missing (cleaner skip path than placeholder-detection).
- Axis 8: **A pre-merge rev-list** (via the helper script).
- Axis 9: **B inline at applicability** (same as A).
- Axis 10: **A recommend `/push-pr`**.
- Axis 11: **D hybrid confirm** (same as A).
- Axis 12: **B optional `<base>` override** (same as A).
- Axis 13: **B managed-files + global-install** — and the helper script must also be globally distributed (a new precedent for non-command files).

**What's good:** No duplication. Validation config is machine-readable, removing the interpretation risk. `gh`-first default-branch detection is authoritative.

**What's not:** Two new conventions (helper script + JSON config) where the playbook has none today. The shell helper itself becomes a managed surface — `/playbook-update` must learn to update it; `/playbook-setup` must learn to install it. Globally installing a shell script is a step beyond globally installing markdown commands; it has no existing precedent. `gh`-first default-branch lookup adds a network call to every `/push-pr*` and `/catchup` invocation. Validation JSON config means every consuming repo needs to fill *another* file beyond CLAUDE.md, increasing onboarding friction.

### Option C — "Lean: signal-only in push-pr, defer validation, derive title"

Minimum-scope variant. `/catchup` exists, but `/push-pr*` only carries the *signal* (a short rev-list check + recommend `/catchup` text), not the full gate logic. Validation is opt-in only (no CLAUDE.md reading by default).

**Axis-choice combination:**
- Axis 1: **A + D fallback** (same as A).
- Axis 2: **C signal-only-in-push-pr** — `/push-pr*` does a 2-line `git fetch origin && git rev-list --count HEAD..origin/<default>`, surfaces "Run `/catchup`" if non-zero, then exits. The "logic" in `/catchup` is the full gate; in `/push-pr*` it's just the signal.
- Axis 3: **A merge** + **C refuse-on-default**.
- Axis 4: **A single conflict report**.
- Axis 5: **B warn-and-ask**.
- Axis 6: **A read CLAUDE.md** but only when `/catchup --validate` is passed.
- Axis 7: **C opt-in via `--validate`** — default behavior is no validation; explicit flag triggers CLAUDE.md read. Avoids interpretive load on every catch-up.
- Axis 8: **A pre-merge rev-list**.
- Axis 9: **B inline at applicability**.
- Axis 10: **A recommend `/push-pr`**.
- Axis 11: **B derive from latest commit subject** with `--fill` for body — no interactive confirm; if commit subject is bad, developer edits on GitHub. Note: current `/push-pr` only accepts `<base>` as argument; adding a `--title` arg passthrough would be a new design axis not in scope.
- Axis 12: **D both** — `<base>` override **and** `--validate` flag.
- Axis 13: **B managed-files + global-install**.

**What's good:** Smallest surface. `/push-pr*` change is ~3 lines (fetch, rev-list count, recommendation) instead of a duplicated gate. No interactive PR-title prompt. Validation is opt-in, removing the "agent runs the wrong commands" risk.

**What's not:** Validation isn't on by default — Task 8 frames validation as a gate ("did this change break anything?"), and a default-off gate that needs `--validate` to fire defeats much of the value. Latest-commit-subject derivation produces ugly titles in worktrees where the last commit is a fixup or WIP. Two-flavor argument shape (`<base>` override + `--validate` flag) is a small but real ergonomics tax — `/checkpoint` only ever uses subcommands, not flags.

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)

*(none remaining — see Decision below for resolved items)*

### Non-blocking (can resolve during implementation)

- [ ] Exact wording of the keep-both conflict prompt — Task 8 demands explicit guidance; phrasing finalized during plan/implement.
- [ ] Whether the squash-default mention in README/quickref goes in the description column of `/push-pr*` rows or as a footnote under the table — purely cosmetic.
- [ ] Whether to surface `gh pr edit <num> --title "..."` as an automated suggestion (printed by `/push-pr*` when an existing PR is found) or as part of the `/catchup` prompt — the former is more discoverable.

## What We're NOT Doing

- **No rebase support.** Axis 3 (B) is opt-in-only for unpushed branches; deferring to a future iteration. Merge default-in is the documented Task 8 strategy and preserves original SHAs.
- **No automatic conflict resolution.** Agent surfaces conflicts and stops; developer resolves. No file-by-file walk (Axis 4 (B)).
- **No auto-push after `/catchup`.** Axis 10 (A) — preserve `reset --hard ORIG_HEAD` reversibility window.
- **No `/checkpoint` global-install fix.** Out of scope; logged as a follow-up consideration.
- **No new `--include` mechanism for slash commands.** Even though it would simplify Option B's helper-script approach, that's a structural change far larger than Task 8.
- **No `/auto-issues` changes.** Phase 9 uses `/commit`, not `/push-pr`, so Issue #1's `--squash`/`--title` change does not affect it.

## Decision

**Chosen approach:** Option A ("Inline + CLAUDE.md, conventions-first") with the four refinements absorbed inline above:
1. `/push-pr*` staleness gate uses the existing PR's `baseRefName` when available (Axis 1 refinement).
2. Validation reads CLAUDE.md but **asks before running** and **narrows to non-mutating verification commands** (lint/typecheck/test only — never install, dev server, build, or `format --write`) (Axis 7 refinement).
3. Existing-PR title hygiene is handled advisorily — surface the current PR title when skipping creation; recommend `gh pr edit` if it doesn't read cleanly (Axis 11 refinement).
4. Post-merge sync is reworded for squash semantics and uses the detected default branch (no longer hardcoded `main`).

Plus: explicitly close Issue #1 by editing `tasks/issues.md` (status → done) as part of the implementation PR.

**Rationale:** Option A wins on every decision heuristic. It matches existing playbook patterns (`/checkpoint` switch-table, `/push-pr*` defensive shell, `/playbook-audit` CLAUDE.md interpretation) — Heuristic #1. It introduces no new abstractions (no helper script, no JSON config, no new managed-file precedent) — Heuristic #2. It preserves the `reset --hard ORIG_HEAD` reversibility window by stopping after validation rather than auto-pushing — Heuristic #3.

Option B's helper-script + JSON-config investments don't earn their cost: the inline duplication is ~5 lines × 3 files, and CLAUDE.md interpretation (with the ask-before-running guard) is no riskier than the existing `/playbook-audit` pattern. Option C's opt-in validation (`--validate` flag) hollows out the value of the catch-up gate — Task 8 frames validation as a default-on guard, and Codex's independent review confirms default-off would be the wrong call.

Codex's independent design converged on Option A; its cross-check surfaced four real refinements (existing-PR `baseRefName`, ask-before-running, narrowed validation scope, squash-aware post-merge sync wording) that have all been folded into the option above. No tiebreaker was needed.
