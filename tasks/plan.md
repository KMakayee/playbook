# Plan: Task 22 — Productize native multi-model agents (install + auto-boot lane)

**Design:** `tasks/design-decision.md` — Shared spine + Option 2: installed fail-closed launcher (`~/.claude/native-agents/bin/claude-native`), no env in any settings file, no launchd. Developer signed off 2026-06-11.
**Research:** `tasks/research-codebase.md` · **Patterns:** `tasks/research-patterns.md` (launch-on-demand sidecar patterns; recommendations 1–7 absorbed below).

---

## Scope boundaries (from design "What We're NOT Doing")

- No user-facing Vertex/ADC install path — machinery ships inert; toggle documented only in template comments.
- No automation of the machine layer (VibeProxy install, server start, OAuth) — check-and-guide only.
- No changes to the `codex exec` trio (`/codex-research`, `/codex-audit`, `/design` integration) — AC8.
- No task 23 work. Agent-type names `codex` / `codex-xhigh` / `gemini-flash` are frozen.
- No Windows/Linux support (VibeProxy is macOS-only).
- No general fix for issue #3 — only the permission rules this feature's own doctor/boot path needs.
- Not shipping `test-codex-leg.mjs` / `test-concurrent.mjs` — dev-only.
- No relay feature work beyond the canonical merge — **with one scope amendment this plan adds: a `GET /health` identity endpoint** (~20 lines; patterns research Concern 2 — the fail-closed launcher and doctor cannot distinguish our relay from a foreign process with a raw TCP check, so the design's chosen fail-closed approach depends on it). The design's "no relay feature work" line predates the patterns research that surfaced this; the patterns doc explicitly asks the developer to allow it. **Approving this plan ratifies the amendment** — it is not pre-sanctioned by the design text.
- No launchd, no `uncaughtException` fail-fast flip (coupled only to supervision; keep-serving stays correct unsupervised).
- No SessionStart-hook boot lane.

## File inventory

**New shipped files (9 — all must be added to `/playbook-update` managed list):**

```
.claude/skills/native-agents/SKILL.md                       (install + doctor modes)
.claude/scripts/native-agents/claude-native                 (bash fail-closed launcher)
.claude/scripts/native-agents/start-relay.mjs               (Node detach helper)
.claude/templates/native-agents/relay.mjs                   (canonical 3-way relay + /health)
.claude/templates/native-agents/agents/codex.md
.claude/templates/native-agents/agents/codex-xhigh.md
.claude/templates/native-agents/agents/gemini-flash.md
.claude/templates/native-agents/vertex/vertex-adc-shim.mjs  (inert, local-only)
.claude/templates/native-agents/vertex/gemini-cpa-config.yaml (inert, local-only)
```

**Modified files (5):** `README.md`, `quickref.md`, `.claude/skills/playbook-setup/SKILL.md`, `.claude/skills/playbook-update/SKILL.md`, `.gitignore`.

**Written by the install at runtime (never committed to the playbook repo, never playbook-managed):**
- Machine home `~/.claude/native-agents/`: `relay.mjs`, `start-relay.mjs`, `bin/claude-native`, `relay.log` (+ `relay.log.1`)
- Consuming project: `.claude/agents/{codex,codex-xhigh,gemini-flash}.md`, permission rules merged into `.claude/settings.local.json`

Agent files under `.claude/templates/native-agents/agents/` are inert — Claude Code only loads agents from `.claude/agents/` and `~/.claude/agents/` (verified, research External Research). Nothing ships at a live `.claude/agents/` path, so no `/playbook-update` removal-prefix extension is needed; installed copies are install-owned, documented as such in the skill.

---

## Phase 1 — Canonical relay template + inert Vertex machinery

- [x] **Complete 2026-06-11.** All success criteria verified: /health identity JSON with matching scriptHash; routing smoke claude→anthropic (401 from api.anthropic.com), gpt-5.5→codex (live 200 via VibeProxy), gemini→gemini lane (default 8317; RELAY_GEMINI_PORT=3499 toggle honored, 502 relay_upstream_error); banner self-describes lane; project-agnostic grep clean.

**Goal:** one relay artifact serving both lanes; Vertex machinery present-but-off.

### 1a. `.claude/templates/native-agents/relay.mjs`

Merge the two dev relays (sources verified 2026-06-11: `~/Projects/Tools/codex-relay/relay.mjs` 140 lines, `relay-gemini.mjs` 146 lines; deltas are exactly `pickUpstream()` at `relay-gemini.mjs:33-37`, broadened strip at `:70-73`, constants and banner). Base on `relay-gemini.mjs` (the superset) with these changes:

1. **Constants:** `RELAY_VERSION = "1.0.0"` (new); `GEMINI` port from `process.env.RELAY_GEMINI_PORT`, **default `8317`** (VibeProxy = shipped OAuth lane; `8319` = local Vertex lane). `CODEX` stays `8317`. Use `127.0.0.1` as upstream host (dev copies use `localhost`; pin to v4 loopback for consistency with the launcher's health URL).
2. **`GET /health` endpoint** (the scope amendment flagged above): intercept `req.method === "GET" && req.url === "/health"` at the top of the request handler, **before** body collection/routing (an unintercepted GET routes to Anthropic). Respond 200 JSON:
   `{ service: "playbook-native-agents-relay", relayVersion, scriptHash, pid, port, geminiPort, startedAt }` — `startedAt` captured once at boot; `scriptHash` = sha256 of the relay's own source (`fs.readFileSync(process.argv[1])`, computed once at boot, ~4 lines). The hash is the launcher's staleness gate: it catches relay changes that ship without a `RELAY_VERSION` bump (Codex review RISK — a version-only check leaves the security-fix channel dependent on humans remembering to bump). `relayVersion` stays for human-readable diagnostics. ~20 lines total.
3. **Keep verbatim** (hardening, non-negotiable): client error handlers, writeHead guard, 502 relay_upstream_error JSON, abort teardown (`res.on("close")` → `proxied.destroy()`), clientError handler, keep-serving `uncaughtException`/`unhandledRejection` (no launchd → no fail-fast flip), keep-alive agents, served-model peek + `SERVED BY` mismatch log (`relay-gemini.mjs:98-110` — the doctor's authoritative signal), strip condition `upstream !== ANTHROPIC` (`relay-gemini.mjs:70-73` — the broadened form, required since one relay serves both lanes).
4. **Header comment rewrite:** project-agnostic (no `~/Projects/Tools/` paths); document both lanes; document `RELAY_GEMINI_PORT=8319` as the local-only Vertex toggle **here and only here** (plus the vertex/ templates) — never in user-facing docs. Note the installed home (`~/.claude/native-agents/relay.mjs`) and that the launcher manages boot/log.
5. **Banner:** print version, port, and gemini upstream port so the log self-describes the active lane.

### 1b. `.claude/templates/native-agents/vertex/` (inert)

- `vertex-adc-shim.mjs`: copy from dev (verified project-agnostic — project ID resolves from `--project` / `GOOGLE_CLOUD_PROJECT` / ADC quota project, nothing hardcoded). Header comment gains one line: local-only lane, not installed by `/native-agents`, used with `RELAY_GEMINI_PORT=8319`.
- `gemini-cpa-config.yaml`: copy from dev; fix the machine-specific comment path at line 3 (`~/Projects/Tools/codex-relay/...` → generic `<path-to>/gemini-cpa-config.yaml`). Body is already generic (port 8319, isolated auth-dir, placeholder api-key).

### Success criteria

```bash
# health + identity (use a scratch port; dev relay may own 3456)
node .claude/templates/native-agents/relay.mjs --port 3490 &   # then:
curl -fsS http://127.0.0.1:3490/health   # → JSON: service=playbook-native-agents-relay, relayVersion=1.0.0, geminiPort=8317, scriptHash matching: shasum -a 256 .claude/templates/native-agents/relay.mjs
# routing smoke: claude-* → anthropic; gpt-* → codex; gemini-* honors RELAY_GEMINI_PORT
curl -s http://127.0.0.1:3490/v1/messages -H 'content-type: application/json' -d '{"model":"claude-test"}'   # log line: → anthropic
curl -s http://127.0.0.1:3490/v1/messages -H 'content-type: application/json' -d '{"model":"gpt-5.5","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}'  # log line: → codex (VibeProxy live on dev machine)
RELAY_GEMINI_PORT=3499 node .claude/templates/native-agents/relay.mjs --port 3491 &  # then exercise the toggle:
curl -s http://127.0.0.1:3491/v1/messages -H 'content-type: application/json' -d '{"model":"gemini-3.5-flash"}'   # → 502 {"type":"error",...relay_upstream_error...(gemini)} (nothing on 3499) + log line: model=gemini-3.5-flash → gemini
curl -s http://127.0.0.1:3490/v1/messages -H 'content-type: application/json' -d '{"model":"gemini-3.5-flash"}'   # default-lane relay: log line → gemini, upstream 8317 (VibeProxy)
# project-agnostic check (no machine paths/accounts anywhere in shipped files)
grep -rE 'Users/chief|Projects/Tools|omk' .claude/templates/native-agents/ .claude/scripts/native-agents/ 2>/dev/null   # → empty
# kill scratch relays afterwards
```

Strip-condition and abort-net correctness are verified by code review against `relay-gemini.mjs:70-73,123-129` (behavioral verification of header stripping needs an instrumented upstream — out of scope; the code is a verbatim carry).

---

## Phase 2 — Fail-closed launcher + detach helper

- [x] **Complete 2026-06-11.** All 6 harness checks pass (HOME-override + stub claude): cold boot execs with env + relay re-parented to init (ppid=1); warm path reuses same relay pid; foreign listener fails closed (lsof table, no exec); stale gate catches content edit via hash mismatch with stop-it message; stray lock doesn't block a healthy relay. Note: foreign-listener diagnostic prints the lsof *output table* (plus the lsof command in boot_diag), satisfying the "show lsof" criterion.

**Goal:** `claude-native` = port-check → identity handshake → boot-if-absent → poll health → `exec` claude with env, refusing to start Claude on any ambiguity. Lockout becomes structurally impossible (env is never set against an unverified relay).

### 2a. `.claude/scripts/native-agents/start-relay.mjs` (Node detach helper)

Patterns research rec 3 (verified: macOS has no `setsid` executable; bare `nohup … &` + `exec` can leave the relay parented to the process that becomes Claude — Concern 1, so the plan deliberately does NOT copy the design sketch's "setsid/nohup" literally):

- Resolve home `~/.claude/native-agents/` (honor `$HOME`); `mkdir` mode `0700` if needed.
- Log hygiene (patterns rec 7): if `relay.log` > 5 MB, rename to `relay.log.1` (overwrite). Open append fd, mode `0600`.
- `spawn(process.execPath, [relayPath, "--port", port], { detached: true, stdio: ["ignore", fd, fd], env: process.env })`; `child.unref()`; print the child PID; exit 0. Port from `CLAUDE_NATIVE_PORT` env, default 3456 (passed through by the launcher). `RELAY_GEMINI_PORT` flows through inherited env for local Vertex use.

### 2b. `.claude/scripts/native-agents/claude-native` (bash launcher)

Flow (patterns recs 1–6):

1. **Preconditions:** `command -v node`, `command -v curl`, `command -v lsof`, `command -v shasum`, `command -v claude`; installed files exist: `~/.claude/native-agents/relay.mjs` **and** `~/.claude/native-agents/start-relay.mjs` (Codex review: the boot path needs both — a missing helper must fail closed up front, not mid-boot). Any missing → fail closed: "run `/native-agents install`" (and plain-`claude` escape-hatch line).
2. **Config:** `PORT="${CLAUDE_NATIVE_PORT:-3456}"`, `HEALTH=http://127.0.0.1:$PORT/health`, `TRIES="${CLAUDE_NATIVE_HEALTH_TRIES:-30}"` (×100 ms).
3. **Identity handshake:** `curl -fsS --max-time 2 "$HEALTH"`:
   - JSON with `"service":"playbook-native-agents-relay"` → compare health `scriptHash` against `shasum -a 256 ~/.claude/native-agents/relay.mjs` (single source: the installed file itself — no launcher-side constant to drift, and no dependence on a human remembering a version bump). Match → **exec path** (step 6). Mismatch → fail closed: "running relay (v X, pid N) doesn't match the installed relay.mjs — stop it (`kill <pid from health>`), then rerun `claude-native`." **Never auto-kill** (patterns Concern 3, simplest v1).
   - Response but wrong/no service field → **foreign listener** → fail closed: show `lsof -nP -iTCP:$PORT -sTCP:LISTEN`, log path, escape hatch.
   - No response → step 4 if nothing is listening (`lsof -nP -iTCP:$PORT -sTCP:LISTEN` empty); if something IS listening but health failed → foreign listener (above).
4. **Boot (advisory lock, patterns rec 2):** `mkdir ~/.claude/native-agents/relay.start.lock` — on success: re-check health once (lost race = fine), `node ~/.claude/native-agents/start-relay.mjs`, poll `$HEALTH` up to `$TRIES`×100 ms, `rmdir` lock (trap-protected). On `mkdir` failure: another launcher is booting — poll health up to the same cap; healthy → step 6; else fail closed naming the lock path and how to clear a stale one.
5. **Poll outcome:** healthy+identity+hash → step 6; anything else → fail-closed diagnostic (patterns rec 5): what failed, `tail -5` of `relay.log`, the `lsof` command, and "plain `claude` is unaffected."
6. **Exec:** `exec env ANTHROPIC_BASE_URL="http://127.0.0.1:$PORT" claude "$@"` — TTY/signals pass through; headless `claude-native -p …` works identically.

### Success criteria (test with `HOME` override + stub `claude` — no real session needed)

```bash
T=$(mktemp -d); mkdir -p "$T/.claude/native-agents/bin" "$T/path"
cp .claude/templates/native-agents/relay.mjs .claude/scripts/native-agents/start-relay.mjs "$T/.claude/native-agents/"
cp .claude/scripts/native-agents/claude-native "$T/.claude/native-agents/bin/"; chmod 755 "$T/.claude/native-agents/bin/claude-native"
printf '#!/bin/bash\necho "BASE_URL=$ANTHROPIC_BASE_URL"\n' > "$T/path/claude"; chmod 755 "$T/path/claude"
# 1. cold boot: relay absent → boots, health passes, stub execs with env set
HOME="$T" PATH="$T/path:$PATH" CLAUDE_NATIVE_PORT=3492 "$T/.claude/native-agents/bin/claude-native"   # → BASE_URL=http://127.0.0.1:3492
ps -o ppid= -p "$(lsof -tnP -iTCP:3492 -sTCP:LISTEN)"   # → 1 (re-parented to init, not a claude child)
# 2. warm path: rerun → fast exec, no second relay (same pid on 3492)
# 3. foreign listener: python3 -m http.server 3493 & → CLAUDE_NATIVE_PORT=3493 run → non-zero exit, lsof hint, stub NOT executed
# 4. stale-process gate: edit $T's installed relay.mjs (e.g. sed RELAY_VERSION 1.0.0→9.9.9) while the 3492 relay keeps running → rerun → fail closed, hash mismatch, "stop it" message (proves the gate catches ANY content change, not just version bumps)
# 5. lock: mkdir "$T/.claude/native-agents/relay.start.lock" with relay healthy → still execs (lock holder ≠ blocker when healthy)
# cleanup: kill test relay + http.server; rm -rf "$T"
```

---

## Phase 3 — Agent templates

- [x] **Complete 2026-06-11.** Model IDs verbatim (gpt-5.5 / gpt-5.5(xhigh) / gemini-3.5-flash); all three name the claude-native relayed-session requirement; gemini-flash.md has zero Vertex/ADC mentions; diff vs dev copies is description-only.

**Goal:** the three agent files as shipped templates, rewritten for the productized lane.

`.claude/templates/native-agents/agents/{codex,codex-xhigh,gemini-flash}.md` — start from the dev copies at `~/.claude/agents/` (verified 2026-06-11: frontmatter `name`/`description`/`model`/`tools: Read, Glob, Grep, Bash`, minimal no-subagents leaf prompt). Deltas:

1. **All three:** description gains the relayed-session requirement, e.g. "Requires a relayed session (launch via `claude-native`); in a stock session, spawning this agent fails with a contained model error." Body prompt stays verbatim (leaf, no sub-agents).
2. **`gemini-flash.md`:** description rewritten for the shipped lane — "served by Gemini 3.5 Flash via the local relay/VibeProxy (Gemini provider enabled + logged in)" — replacing the Vertex/ADC chain wording (research Summary #6).
3. **Model IDs verbatim:** `gpt-5.5`, `gpt-5.5(xhigh)`, `gemini-3.5-flash` (Axis 10c — current-correct per External Research; drift detected at run time by the doctor's live-catalog check).

### Success criteria

```bash
grep -H '^model:' .claude/templates/native-agents/agents/*.md   # gpt-5.5 / gpt-5.5(xhigh) / gemini-3.5-flash
grep -L 'claude-native' .claude/templates/native-agents/agents/*.md   # → empty (all three name the relayed-session requirement)
grep -c 'Vertex\|ADC' .claude/templates/native-agents/agents/gemini-flash.md   # → 0
diff ~/.claude/agents/codex.md .claude/templates/native-agents/agents/codex.md   # only the description delta
```

---

## Phase 4 — `/native-agents` skill (install + doctor)

- [x] **Complete 2026-06-11.** Frontmatter (name/description/argument-hint/disable-model-invocation) verified; "Never auto-kill" ×2; doctor mode documented; structural read-through confirms install steps 1–7, doctor steps 0–5, gemini triage table, fragility note, and drift checklist. Permission-rule strings pinned (judgment call 10): printenv, curl health/models, lsof 3456, shasum template+installed, node start-relay boot path, Read rule for the machine home (log reads go through the Read tool, so no tail/wc Bash rules needed).

**Goal:** `.claude/skills/native-agents/SKILL.md`. Frontmatter: `name: native-agents`, description, `disable-model-invocation: true`. Modes via `$ARGUMENTS` (precedent `checkpoint/SKILL.md:12`): bare or `install` → install flow; `doctor` → probe.

### Install flow (steps the skill instructs the agent to perform)

1. **Platform + tools preflight:** macOS check (`uname`), `command -v node`, `command -v curl`, `command -v lsof`, `command -v claude` (Codex review: steps 2–3 use curl/lsof immediately — check everything the flow needs up front). Missing → stop with guidance.
2. **Machine layer — check-and-guide (never automate; Step 3C precedent):**
   - `curl -fsS --max-time 2 http://127.0.0.1:8317/v1/models` → parse the **live** catalog (Axis 8c — hardcoded catalogs drift):
     - any `gpt-*` → codex lane ready; absent → guide: install VibeProxy (github.com/automazeio/vibeproxy, macOS 13+), start server, enable Codex provider + OAuth login, recommend **Launch at Login** (the app side of auto-boot is a VibeProxy setting, not ours); re-check after instructing.
     - any `gemini-*` → gemini lane ready; absent → guide: enable Gemini provider toggle + OAuth login in VibeProxy; user may skip (lane optional — agent files still install; doctor will diagnose).
   - Endpoint down entirely → check `/Applications/VibeProxy.app` exists (diagnostic fallback) → guide install/start; re-check.
3. **Port 3456 preflight (two-relay race, research Risk #5):** `lsof -nP -iTCP:3456 -sTCP:LISTEN`. If listening → `curl /health`: our relay → report version, and if its `scriptHash` ≠ `shasum -a 256` of the template about to be installed, instruct stop before continuing (same gate the launcher applies); no/foreign health → name the owning process from lsof and instruct the user to stop it (legacy dev relays `relay.mjs`/`relay-gemini.mjs` are the expected culprits). **Never auto-kill.**
4. **Machine home write (Step 3B copy/diff precedent, `playbook-setup/SKILL.md:100-122`):** `mkdir -p ~/.claude/native-agents/bin` (0700); copy `templates/native-agents/relay.mjs` and `scripts/native-agents/start-relay.mjs` → `~/.claude/native-agents/`; `scripts/native-agents/claude-native` → `~/.claude/native-agents/bin/` (chmod 755). On re-run: diff-and-confirm each (same → skip silently; different → summarize + ask).
5. **Project layer write:**
   - `mkdir -p .claude/agents`; copy the three agent templates with diff-and-confirm.
   - **User-level duplicate detection:** if `~/.claude/agents/{codex,codex-xhigh,gemini-flash}.md` exist, explain precedence (project wins; stale user copies confuse `/agents` listings) and offer deletion — only after the project copies are in place (ordering per research Risk #6).
   - **Permission rules (Axis 12b):** merge into `.claude/settings.local.json` (create if absent; preserve existing keys; correct `"permissions"` nesting) the allow-rules the doctor and install-re-run paths need — the design's full Axis 12 enumeration (`node`, `curl`, `lsof`, boot path) plus log reads: curl to `127.0.0.1:3456/health` and `127.0.0.1:8317/v1/models`, `lsof -nP -iTCP:…`, `node` (install preflight/re-runs), and read/tail of `~/.claude/native-agents/relay.log`. Rules target the default port 3456; sessions on a non-default `CLAUDE_NATIVE_PORT` may see permission prompts (accepted — the override is an escape hatch, not the paved path). Exact rule strings finalized at implementation against the current permission-rule prefix syntax (`Bash(prefix:*)` form) — keep the set minimal; show the developer the merged result.
6. **Shell integration — check-and-guide:** print the PATH line to paste into `~/.zshrc`: `export PATH="$HOME/.claude/native-agents/bin:$PATH"` (PATH over alias — works for headless `claude-native -p` and scripts; alias noted as alternative). The skill cannot verify the user's rc file took effect — say so.
7. **Handoff:** print: open a **new terminal**, run `claude-native` in this project (agent types register at session start — restart is mandatory), then run `/native-agents doctor`. Print the escape hatch ("plain `claude` is always unaffected") and the lockout-immunity note (fail-closed launcher never sets env against a dead relay).

### Doctor flow

0. **Relayed-session check (Axis 7 step 0):** `printenv ANTHROPIC_BASE_URL` → must be a `http://127.0.0.1:<port>` / `localhost` URL. Not set → stop: "this session is not relayed — relaunch via `claude-native`, then rerun." **Derive the relay port from this URL** and use it for every subsequent check (Codex review: a `CLAUDE_NATIVE_PORT` session is valid and must not fail the doctor; the launcher guarantees env and relay port agree).
1. **Preflight:** `curl http://127.0.0.1:<derived-port>/health` (assert service + report version/hash/pid/geminiPort); `curl http://127.0.0.1:8317/v1/models` → assert the **installed agents' frontmatter models** appear (`gpt-5.5`; `gemini-3.5-flash` for the gemini lane): read expected IDs from `.claude/agents/*.md`, not a hardcoded list.
2. **Log baseline:** `wc -l < ~/.claude/native-agents/relay.log`.
3. **Probes (Agent tool, one per installed type):**
   - `codex`: prompt = identify your model family/provider in one line. Pass = response present, identifies as GPT/OpenAI family (loose — self-reported IDs are unreliable; the log is authoritative).
   - `codex-xhigh`: same.
   - `gemini-flash`: self-report **plus a tool-use step** (Read a named repo file and quote its first line — the gemini tool path is untested, design constraint). Pass = Gemini family + correct quote.
4. **Log assertion (authoritative):** read `relay.log` lines past the baseline; assert per probe a `model=<id> → codex|gemini` line; assert the session's own `model=claude-* → anthropic` lines exist (proves relayed session end-to-end); flag any `SERVED BY` mismatch line.
5. **Verdict table + gemini triage (the lane ships untested by design — failures must name their cause):**
   | Signal | Diagnosis | Fix |
   | connection refused / `relay_upstream_error (gemini)` 502 | VibeProxy not running | start VibeProxy server |
   | auth/error body from VibeProxy | Gemini toggle off or not logged in | enable provider + OAuth in VibeProxy |
   | `SERVED BY` mismatch or model-not-found | `gemini-3.5-flash` unsupported by the OAuth path | check live `/v1/models`, update `gemini-flash.md` model + drift checklist |
6. **Fragility note in the skill (research Risk #2):** frontmatter `model:` passthrough of non-Anthropic IDs is empirically-working but undocumented behavior; a Claude Code release could break it — the doctor is the regression detector; `CLAUDE_CODE_SUBAGENT_MODEL` is the documented escape hatch.

### Model-ID drift checklist (a section in the skill)

Enumerate every drift site: `templates/native-agents/agents/{codex,codex-xhigh}.md` (`gpt-5.5`), `agents/gemini-flash.md` (`gemini-3.5-flash`), installed copies in `.claude/agents/` and `~/.claude/agents/` equivalents on consumer machines (propagate via re-run install). The doctor's live-catalog check is the detector; this checklist is the update path.

### Success criteria

```bash
head -5 .claude/skills/native-agents/SKILL.md        # frontmatter: name, description, disable-model-invocation: true
grep -c 'never auto-kill\|Never auto-kill' .claude/skills/native-agents/SKILL.md   # ≥1
grep -c 'doctor' .claude/skills/native-agents/SKILL.md                              # mode documented
# structural read-through: install has steps 1-7 above; doctor has steps 0-5 + triage table + drift checklist
```

Plus a full read-through against this phase's spec (prose artifact — review is the test).

---

## Phase 5 — Docs + distribution wiring

1. **`README.md`:**
   - Prerequisites (`README.md:5-8`): add optional line — VibeProxy (macOS, for optional native multi-model agents).
   - "Setup & maintenance" table (`README.md:60-66`): add `/native-agents` row ("Install GPT/Gemini as native subagent types via a local relay (optional; macOS)").
   - Short subsection (3–5 lines) under "What's included" describing the lane: install + `claude-native` launcher + doctor; explicitly note stock sessions are untouched.
2. **`quickref.md`:** add `/native-agents` row to the Playbook table (`quickref.md:9-15`).
3. **`.claude/skills/playbook-setup/SKILL.md`:** new Step 3D after Step 3C (LSP, `:125-140`): offer the optional native-agents lane — one paragraph, points at `/native-agents` (AC7; check-and-guide, no inline duplication of the install logic — `/forge` precedent says reference, don't slash-invoke).
4. **`.claude/skills/playbook-update/SKILL.md`:**
   - Managed files list (`:19-56`): append all 9 new shipped paths.
   - One nudge line in Step 2 Category A: if any `native-agents` file was updated, remind the developer to re-run `/native-agents install` so installed copies (machine home + project agents) pick up the change — this is the relay's security-fix propagation channel (research Risk #7; design non-blocking OQ resolved: yes).
5. **`.gitignore`:** add `.claude/agents/` — dogfood guard: the playbook repo itself will install live agent files in Phase 6, and committing them would register agent types in every consuming repo pre-install (violates "stock stays stock"). `.gitignore` is not distributed by the clone+mv flow (`mv playbook/*` skips dotfiles; only `.claude` is moved explicitly), so this is purely a maintainer-repo guard; consuming teams may commit their installed `.claude/agents/` (shareable by design).

### Success criteria

```bash
grep -c 'VibeProxy' README.md                          # ≥2 (prereq + subsection)
grep -c 'native-agents' README.md quickref.md          # ≥1 each
grep -c 'native-agents' .claude/skills/playbook-update/SKILL.md   # ≥10 (9 managed paths + nudge)
grep -A2 'Step 3D' .claude/skills/playbook-setup/SKILL.md          # offer present
grep -c '^\.claude/agents/$' .gitignore                # 1
# managed-list completeness: every path in "File inventory → new shipped files" appears verbatim
for f in $(git status --porcelain | awk '{print $2}' | grep native-agents); do grep -q "$f" .claude/skills/playbook-update/SKILL.md || echo "MISSING: $f"; done
```

---

## Phase 6 — Dogfood install + doctor (interactive; spans two sessions)

**Goal:** run the real install on this machine/repo (AC3 end-to-end), retire the legacy dev setup, and verify the doctor (AC4 — for gemini, "verified" means *diagnosable*, since the OAuth lane ships untested by design and this machine has no VibeProxy Gemini login).

In this session (the implementing agent executes the install flow as the skill specifies):
1. Stop any legacy manually-launched relay on 3456 (`relay.mjs`/`relay-gemini.mjs`) — the install's port-3456 preflight must detect and name it first (that detection IS a test).
2. Run the install flow: machine home populated; project `.claude/agents/` written; user-level `~/.claude/agents/{codex,codex-xhigh,gemini-flash}.md` duplicates detected and retired (project copies landed first); permission rules merged into `.claude/settings.local.json`.
3. Developer pastes the PATH line into `~/.zshrc`; optionally retires the personal `claude-codex()` wrapper (superseded by the installed launcher).

In a fresh `claude-native` session (developer action — the implementing session cannot do this; agent types register at session start):
4. Run `/native-agents doctor`: expect `codex` + `codex-xhigh` PASS (self-report + relay-log lines); `gemini-flash` → PASS if the developer opts to enable VibeProxy Gemini OAuth, otherwise the probe must produce the documented triage diagnosis (toggle off / not logged in) — either outcome verifies the AC.
5. Stock checks: plain `claude` in this repo works untouched (no env, direct Anthropic); `git status` shows no `.claude/agents/` entries (gitignored); `git diff main` touches none of the `codex exec` trio skills (AC8).

### Success criteria

```bash
ls ~/.claude/native-agents/ ~/.claude/native-agents/bin/   # relay.mjs, start-relay.mjs, relay.log, bin/claude-native
ls .claude/agents/                                          # codex.md codex-xhigh.md gemini-flash.md
ls ~/.claude/agents/codex.md 2>&1                           # No such file (retired)
git check-ignore .claude/agents/codex.md                    # ignored
git diff --stat main -- .claude/skills/codex-research .claude/skills/codex-audit .claude/skills/design   # empty (AC8)
# + doctor verdict table from the fresh claude-native session (developer-reported)
```

**Interruption safety:** phases 1–5 are purely additive/doc edits — the repo and all existing workflows stay fully working at every commit boundary. Phase 6 mutates only local machine state (machine home, user agents dir, settings.local.json — all outside git or gitignored); an interrupted Phase 6 leaves stock `claude` untouched by construction (no settings env anywhere — that's the design's core property).

**Commits:** one conventional commit per phase (`feat(templates): …`, `feat(scripts): …`, `feat(skills): …`, `docs: …`); Phase 6 commits only the `.gitignore` line if not already in Phase 5 (it is — Phase 6 commits nothing; it's machine-state + verification).

---

## Judgment Calls

1. **Names adopted as proposed:** skill `/native-agents`, launcher `claude-native` (design non-blocking OQ; developer can override at plan review — pure find/replace on this plan).
2. **Launcher = bash + Node detach helper** (vs all-bash or all-Node): bash gives true `exec` TTY/signal semantics for the claude leg; Node `spawn({detached:true})` + `unref()` is the only reliable macOS detach (no `setsid` executable — patterns research, verified locally). The design sketch's "setsid/nohup" is deliberately not copied (patterns Concern 1).
3. **`GET /health` added to the relay** — a scope amendment to the design's "no relay feature work" line, ratified by approving this plan (Codex review CORRECTION: the design text does not pre-sanction it; patterns Concern 2 asks the developer to allow it). Technical case: identity handshake is what makes fail-closed meaningful; a raw TCP check can't distinguish our relay from a foreign/stale process.
4. **Version-mismatch policy: never auto-kill** — fail closed with the PID and instructions (patterns Concern 3 simplest-v1; auto-restart could disrupt another active relayed session).
5. **Staleness gate = content hash, not version string:** the relay self-hashes its source at boot and reports it via `/health`; the launcher compares against `shasum -a 256` of the installed file (Codex review RISK absorbed: a version-only check silently accepts a stale process whenever a relay change ships without a `RELAY_VERSION` bump — unacceptable for the security-fix channel). `RELAY_VERSION` is kept for human-readable diagnostics only.
6. **Vertex toggle = `RELAY_GEMINI_PORT` env var, port-only** (not a full URL): keeps the upstream localhost-constrained by construction (no arbitrary-host injection via env), and ports are the only delta between the two lanes.
7. **`CLAUDE_NATIVE_PORT` override** (default 3456): primarily for the Phase 2 test harness; also the documented out if 3456 is ever contended. The relay already takes `--port`; the launcher threads it through and sets `ANTHROPIC_BASE_URL` consistently, and the doctor derives its port from `ANTHROPIC_BASE_URL` so override sessions pass (Codex review RISK absorbed). Permission rules target the default port only.
8. **Shell integration: PATH entry over alias** — survives non-interactive shells and headless `claude-native -p`; alias documented as the alternative.
9. **Install always writes all three agent files** even when the gemini lane isn't ready — harmless (contained per-spawn error, documented in agent descriptions), and the doctor diagnoses lane state; avoids a partial-install matrix.
10. **Permission-rule exact strings deferred to implementation** — the intent set is fixed and now matches the design's Axis 12 enumeration in full (`node`, curl health/models, lsof port check, boot path, relay.log reads — Codex review CORRECTION absorbed); the `Bash(prefix:*)` syntax has enough sharp edges (literal `:` in URLs) that pinning strings now would just create stale plan text.
11. **Self-report assertions loose, log assertions strict:** models misreport their own IDs routinely; the relay's `model=… → upstream` + `SERVED BY` lines are the ground truth (design's own framing).
12. **Log rotation: 5 MB rename-to-`.1` at boot** in the start helper — simplest hygiene that bounds disk use without a background task (patterns rec 7 scaled down).

## Artifact references

- `tasks/research-codebase.md` — axes, coupling, risks, code references (relay internals verified against live files 2026-06-11)
- `tasks/design-decision.md` — chosen approach + shared spine (Axes 1–12), scope boundaries
- `tasks/research-patterns.md` — recommendations 1–7 and Concerns 1–3, all absorbed above
