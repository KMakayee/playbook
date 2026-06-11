---
name: native-agents
description: Install GPT/Gemini as native Claude Code subagent types via a local relay (macOS), or diagnose an existing install with the doctor.
argument-hint: '[install | doctor]'
disable-model-invocation: true
---

# Native Multi-Model Agents

Install `codex`, `codex-xhigh`, and `gemini-flash` as native subagent types, served by a local model-routing relay in front of VibeProxy. Sessions launched through the installed `claude-native` launcher route `gpt-*`/`gemini-*` agent traffic to VibeProxy's OAuth providers while `claude-*` traffic passes to Anthropic untouched. Plain `claude` sessions are never affected — the launcher is fail-closed and nothing is written to any settings `env` block, so a broken relay can never lock you out.

Takes a single optional argument (`$ARGUMENTS`):

| `$ARGUMENTS` | Behavior |
|---|---|
| empty or `install` | install flow (first run or re-run/update) |
| `doctor` | diagnose an existing install end-to-end |
| anything else | error — list the valid args (`install`, `doctor`) and stop |

**Ground rules for both modes:**

- **Never auto-kill a process.** When a stale or foreign listener must go away, name it (PID, command) and instruct the developer to stop it themselves.
- The machine layer (VibeProxy install, server start, provider OAuth) is **check-and-guide only** — verify and instruct, never automate.
- Run the exact command strings shown below — they match the permission rules the install merges into `.claude/settings.local.json`.

---

## Install flow

### 1. Platform + tools preflight

- `uname` must print `Darwin` — VibeProxy is macOS-only. Anything else → stop: this feature is not available on this platform.
- `command -v` each of: `node`, `curl`, `lsof`, `shasum`, `claude`. Any missing → stop and tell the developer what to install first.

### 2. Machine layer — check VibeProxy (guide, never automate)

Probe the live model catalog (hardcoded catalogs drift; the live endpoint is the truth):

```bash
curl -fsS --max-time 2 http://127.0.0.1:8317/v1/models
```

- **Endpoint down entirely** → check whether `/Applications/VibeProxy.app` exists.
  - Missing → guide: install VibeProxy from github.com/automazeio/vibeproxy (macOS 13+), open it, and start its server.
  - Present → guide: open VibeProxy and start the server.
  Then re-run the probe before continuing.
- **Catalog has a `gpt-*` model** → codex lane ready.
  Absent → guide: in VibeProxy, enable the **Codex** provider and complete its OAuth login; recommend turning on **Launch at Login** (that's the app side of auto-boot — a VibeProxy setting, not ours). Re-probe after the developer confirms.
- **Catalog has a `gemini-*` model** → gemini lane ready.
  Absent → guide: enable the **Gemini** provider toggle and complete its OAuth login in VibeProxy. The developer may skip this — the lane is optional; the agent files still install and `/native-agents doctor` will diagnose the lane later.

### 3. Port 3456 preflight (avoid a two-relay race)

```bash
lsof -nP -iTCP:3456 -sTCP:LISTEN
```

- **Nothing listening** → continue.
- **Something listening** → probe its identity:

  ```bash
  curl -fsS --max-time 2 http://127.0.0.1:3456/health
  ```

  - JSON with `"service":"playbook-native-agents-relay"` → it's our relay; report its `relayVersion` and `pid`. Compare its `scriptHash` against `shasum -a 256 .claude/templates/native-agents/relay.mjs` (the template about to be installed). If they differ, instruct the developer to stop the running relay (`kill <pid from health>`) before continuing — the same staleness gate `claude-native` applies. **Never auto-kill.**
  - No response or no/wrong `service` field → a foreign process owns the port. Name the owning process from the `lsof` output and instruct the developer to stop it. Expected culprits: manually-launched legacy dev relays (`relay.mjs` / `relay-gemini.mjs`).

### 4. Machine home write

Create the machine home and copy the three runtime files:

| Source (playbook repo) | Destination |
|---|---|
| `.claude/templates/native-agents/relay.mjs` | `~/.claude/native-agents/relay.mjs` |
| `.claude/scripts/native-agents/start-relay.mjs` | `~/.claude/native-agents/start-relay.mjs` |
| `.claude/scripts/native-agents/claude-native` | `~/.claude/native-agents/bin/claude-native` (chmod 755) |

- `mkdir -p ~/.claude/native-agents/bin` first (mode 0700 on `~/.claude/native-agents`).
- **Re-run behavior (diff-and-confirm):** if a destination file already exists, compare contents. Same → skip silently. Different → show a brief summary of the changes and ask: "Update `<file>`? (yes / skip)".
- Installed copies are **install-owned**: tell the developer not to hand-edit them — changes ship through the playbook templates and an install re-run.

### 5. Project layer write

a. **Agent files:** `mkdir -p .claude/agents`, then copy the three templates from `.claude/templates/native-agents/agents/` → `.claude/agents/{codex,codex-xhigh,gemini-flash}.md`, with the same diff-and-confirm as step 4. Install all three even when the gemini lane isn't ready — a missing lane produces a contained per-spawn error (documented in each agent's description), and the doctor diagnoses lane state.

b. **User-level duplicate detection** (only after the project copies are in place): if any of `~/.claude/agents/{codex,codex-xhigh,gemini-flash}.md` exist, explain that project agents take precedence and stale user-level copies confuse `/agents` listings, then offer to delete them.

c. **Permission rules:** merge the following into the project's `.claude/settings.local.json` (create the file if absent; preserve all existing keys; the rules belong under `permissions.allow`). Show the developer the merged result.

```json
{
  "permissions": {
    "allow": [
      "Bash(printenv ANTHROPIC_BASE_URL)",
      "Bash(curl -fsS --max-time 2 http://127.0.0.1:3456/health)",
      "Bash(curl -fsS --max-time 2 http://127.0.0.1:8317/v1/models)",
      "Bash(lsof -nP -iTCP:3456 -sTCP:LISTEN)",
      "Bash(shasum -a 256 ~/.claude/native-agents/relay.mjs)",
      "Bash(shasum -a 256 .claude/templates/native-agents/relay.mjs)",
      "Bash(node ~/.claude/native-agents/start-relay.mjs)",
      "Read(~/.claude/native-agents/**)"
    ]
  }
}
```

These cover the doctor and install-re-run paths on the default port. Sessions on a non-default `CLAUDE_NATIVE_PORT` may see permission prompts — accepted; the override is an escape hatch, not the paved path.

### 6. Shell integration (check-and-guide)

Print the line to paste into `~/.zshrc`:

```bash
export PATH="$HOME/.claude/native-agents/bin:$PATH"
```

PATH is preferred over an alias because it also works for headless runs (`claude-native -p "…"`) and scripts; an alias (`alias claude-native="$HOME/.claude/native-agents/bin/claude-native"`) is the alternative. You cannot verify the developer's rc file took effect — say so explicitly.

If the developer asks to make `claude` itself launch relayed sessions, don't set that up now — the doctor offers exactly that after its probes pass (Doctor step 6), which is the right gate: never default someone into a lane that hasn't passed a probe yet.

### 7. Handoff

Print, verbatim in spirit:

1. Open a **new terminal** (so the PATH change loads), `cd` into this project, and run `claude-native` — agent types register at session start, so a restart is mandatory; this session cannot see them.
2. In that new session, run `/native-agents doctor` to verify end-to-end.
3. Escape hatch: a stock session is always available — plain `claude` (or `command claude`, which bypasses the optional alias from Doctor step 6).
4. Lockout immunity: `claude-native` is fail-closed — it never points a session at a relay it hasn't verified, so a dead or stale relay means a refused launch with diagnostics, never a broken Claude.

---

## Doctor flow

### 0. Relayed-session check

```bash
printenv ANTHROPIC_BASE_URL
```

- Not set, or not a `http://127.0.0.1:<port>` / `http://localhost:<port>` URL → stop: "this session is not relayed — relaunch via `claude-native`, then rerun `/native-agents doctor`."
- Set → **derive the relay port from this URL** and use it for every relay check below. A session on a non-default `CLAUDE_NATIVE_PORT` is valid — the launcher guarantees env and relay port agree.

### 1. Preflight

- `curl -fsS --max-time 2 http://127.0.0.1:<derived-port>/health` → assert `"service":"playbook-native-agents-relay"`; report `relayVersion`, `scriptHash`, `pid`, `geminiPort`.
- `curl -fsS --max-time 2 http://127.0.0.1:8317/v1/models` → read the expected model IDs from the **installed agents' frontmatter** (`grep '^model:' .claude/agents/*.md` — never a hardcoded list) and check each against the live catalog, stripping any `(…)` reasoning-effort suffix first (`gpt-5.5(xhigh)` → catalog entry `gpt-5.5`). Track availability **per lane**: a missing `gpt-5.5` fails the codex lane; a missing `gemini-3.5-flash` fails only the gemini lane (record it for the step-5 verdict + triage and skip that probe's pass expectation). One absent lane never stops the doctor — the remaining probes still run.

### 2. Log baseline

Read `~/.claude/native-agents/relay.log` (Read tool) and record its current line count — the assertion in step 4 only looks at lines past this baseline.

### 3. Probes (Agent tool, one per installed agent type)

- `codex`: prompt — "Identify your model family/provider in one line." Pass = a response arrives and identifies as GPT/OpenAI family.
- `codex-xhigh`: same prompt and pass criteria.
- `gemini-flash`: self-report **plus a tool-use step** — "Identify your model family in one line, then Read the file `README.md` in this repo and quote its first line." Pass = Gemini family **and** the quote is correct (the gemini tool path needs explicit exercise).

Keep self-report assertions loose — models misreport their own IDs routinely. The log assertion below is the authoritative check.

### 4. Log assertion (authoritative)

Read `~/.claude/native-agents/relay.log` lines past the step-2 baseline and assert:

- one `model=<id> → codex` line per codex/codex-xhigh probe, and a `model=gemini-3.5-flash → gemini` line for the gemini probe;
- the session's own `model=claude-* → anthropic` lines exist (proves this session is relayed end-to-end);
- no `SERVED BY` mismatch lines — flag any found (requested model ≠ serving model is drift, see the checklist below). **Known benign exception:** `gpt-5.5(xhigh)` requests report `SERVED BY gpt-5.5` — the parenthetical is a reasoning-effort directive consumed upstream, not a separate model ID; don't treat it as drift.

### 5. Verdict

Present a table: agent type | probe result | log evidence | verdict (PASS/FAIL + reason).

**Gemini triage** (the lane ships untested by design — a failure must name its cause):

| Signal | Diagnosis | Fix |
|---|---|---|
| connection refused / `relay_upstream_error (gemini)` 502 | VibeProxy not running | start the VibeProxy server |
| auth/error body from VibeProxy | Gemini provider toggle off, or not logged in | enable the provider + OAuth login in VibeProxy |
| `SERVED BY` mismatch or model-not-found | `gemini-3.5-flash` not supported by the OAuth path | check the live `/v1/models` catalog and walk the model-ID drift checklist below |

### 6. Offer the default swap (only when the codex probes pass)

If the `codex`/`codex-xhigh` probes passed (gemini may have failed — it's optional), check `~/.zshrc` for an existing `alias claude=` line. If one is already there, skip silently. Otherwise offer:

> "Want `claude` itself to launch relayed sessions from now on? I'll add `alias claude=\"$HOME/.claude/native-agents/bin/claude-native\"` to your `~/.zshrc`. You can always get a stock session with `command claude` (bypasses the alias), and removing the line undoes it."

- **yes** → append to `~/.zshrc` (with a `# playbook native-agents — claude defaults to the relayed launcher` comment line above it); remind the developer it takes effect in new terminals.
- **no** → skip silently.

The alias cannot break the launcher itself: aliases don't apply inside non-interactive scripts, so `claude-native`'s final `exec … claude` still resolves to the real binary — no recursion. Never use a PATH shim named `claude` for this; that *would* recurse.

If the codex probes did not pass, do not offer the swap — fix the lane first.

### Fragility note

Frontmatter `model:` passthrough of non-Anthropic IDs is **empirically-working but undocumented** Claude Code behavior — a future release could break it. This doctor is the regression detector: if probes that passed start failing after a Claude Code update with the relay healthy and the log clean, suspect the passthrough. `CLAUDE_CODE_SUBAGENT_MODEL` is the documented escape hatch for forcing a subagent model while a fix is sorted out.

---

## Model-ID drift checklist

When a provider renames or retires a model (the doctor's live-catalog check is the detector; this checklist is the update path), update every drift site:

1. `.claude/templates/native-agents/agents/codex.md` and `codex-xhigh.md` — `model: gpt-5.5` / `gpt-5.5(xhigh)`
2. `.claude/templates/native-agents/agents/gemini-flash.md` — `model: gemini-3.5-flash`
3. Installed project copies in `.claude/agents/` (this and every consuming project) — propagate by re-running `/native-agents install`
4. Any user-level `~/.claude/agents/` equivalents on consumer machines — same re-run, which detects and offers to retire them

After updating, re-run `/native-agents doctor` to confirm the new IDs resolve against the live catalog.
