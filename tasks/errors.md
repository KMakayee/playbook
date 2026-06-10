# Error & Learnings Log

---

### 2026-04-01 — Hooks Configuration

- **Type:** pitfall
- **What:** Claude Code hooks in `settings.local.json` use `"hooks": { "Stop": [...] }` nesting — NOT top-level event keys. Plugin `hooks.json` files use a different wrapper with `{"hooks": {...}}` plus a `description` field. The Explore sub-agent returned incorrect guidance (top-level `"Stop"` key), which failed schema validation.
- **Why it matters:** Wrong nesting causes silent validation failure or runtime errors. The schema error message is clear but the two formats (settings vs plugin) are easy to confuse.
- **Confidence:** high — verified against schema and working config

### 2026-04-07 — codex commands (all)

- **Type:** pitfall
- **What:** `codex exec` fails to write the `-o` output file when the bash tool's default 2-minute timeout kills the process mid-run. `codex exec --output-last-message` only writes on clean exit — a killed process leaves no file.
- **Why it matters:** Every codex command silently produces no output when Codex takes >2 minutes on a large codebase. Fix: always specify a 10-minute timeout (600000ms) when running `codex exec`.
- **Confidence:** high — root cause confirmed via `codex exec --help` (no `--timeout` flag; timeout is bash-side)

### 2026-06-10 — /implement Step 8 (child fix application)

- **Type:** pitfall
- **What:** Under auto mode on this machine, the permission classifier denies `/implement` Step 8's child process (`claude -p ... --dangerously-skip-permissions`) as an "unsafe autonomous loop." Workaround used: the parent applied the triaged fixes inline via Edit (the fix instructions in `tasks/code-review-fixes.tmp` were precise enough to apply directly), then re-ran verification and committed as usual.
- **Why it matters:** `/implement`, `/implement-codex`, `/issue-implement`, and `/auto-issues` all spawn `claude -p --dangerously-skip-permissions` children. Any run under auto mode may hit the same denial mid-flow. Either add a Bash permission rule for the child invocation, or expect the parent-inline fallback (fine for small fix lists; loses the context-isolation benefit on large ones).
- **Confidence:** high — observed directly (task 20 implement run, 2026-06-10)
