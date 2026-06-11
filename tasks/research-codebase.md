# Research: Task 22 — Productize native multi-model agents (install + auto-boot lane)

## Research Question

Productize the two verified native multi-model agent setups into an installable playbook surface (Task 22 on `tasks/todo.md`). Two working-but-dev-machine-bound setups exist: GPT-5.5 (Codex) and Gemini agents running as first-class subagent types inside Claude Code, via a local relay that routes on the request body's `model` field (`claude-*` → api.anthropic.com verbatim; `gpt-*` → VibeProxy :8317; optionally `gemini-*` → a Vertex/ADC chain). The goal is a playbook install skill so any playbook user can run one command and get these agent types working — with the supporting relay process booting automatically (the "env var set but relay down" total-lockout failure mode is the central design driver), and a doctor probe that verifies each lane end-to-end (agent self-report + relay-log upstream assertion).

### Upfront spec

**Intent.** Turn the two verified native-agent setups (`tasks/codex-native-agents.md`, `tasks/gemini-native-agents.md`) into an installable playbook surface, so a playbook user can run one install skill and get GPT-5.5 (Codex) and Gemini agents as first-class subagent types inside Claude Code — with the supporting processes booting automatically, never left to manual launch. The skill: (a) guides the **machine layer** (VibeProxy install + Codex OAuth — check-and-instruct, not automated); (b) writes the **project/user layer** (relay script, agent type files `codex` / `codex-xhigh` / `gemini-flash`, any settings/env wiring); (c) wires **auto-boot** so the relay (and, where enabled, shim + engine) is running before any relayed session; (d) ends with a **doctor probe** per lane: spawn each agent type, assert the right model answers AND the relay log shows the matching upstream line. Also: README Prerequisites gains VibeProxy.

**Gemini lane decision (developer, 2026-06-11):** user-facing install ships ONLY the default lane — VibeProxy OAuth toggle (`gemini-*` routed to VibeProxy; zero GCP, zero extra processes). The Vertex + ADC lane ships toggled off — present in the repo for local use but not offered by the install. The OAuth lane ships untested (accepted risk); the doctor probe is each user's install-time verification — design it to fail loudly and diagnosably.

**Constraints.** `disable-model-invocation: true`; project-agnostic templates (no machine paths/accounts/GCP IDs); machine layer is check-and-guide; relay/shim/engine never children of a claude session; one relay per port 3456; ship the hardened relay (abort/concurrency nets + `authorization`/`x-api-key` strip on non-Anthropic routes — non-negotiable); launchd ⇒ flip relay to fail-fast; stock sessions stay 100% stock; agent types register at session start (install must sequence restart before doctor); model IDs drift — centralize or document the update path.

**Acceptance criteria.** (1) Install skill: machine check/guide → project write → auto-boot → doctor, for Codex lane + default Gemini lane. (2) Repo carries templates: relay, agent files, Vertex machinery present-but-off. (3) Codex lane installs end-to-end fresh. (4) Gemini lane same; diagnosable probe failures (toggle off? not logged in? model name?). (5) Auto-boot guards the lockout. (6) README Prerequisites + command tables. (7) `/playbook-setup` offers it; `/playbook-update` managed list covers all new files. (8) Stock sessions identical; `codex exec` trio untouched.

**Relevant paths.** Seeds: `tasks/codex-native-agents.md` (§3, §5, §7a), `tasks/gemini-native-agents.md` (§2, §5). Dev copies: `~/Projects/Tools/codex-relay/` (relay.mjs, relay-gemini.mjs, vertex-adc-shim.mjs, gemini-cpa-config.yaml, test scripts); `~/.claude/agents/{codex,codex-xhigh,gemini-flash}.md`. New: `.claude/skills/<name>/SKILL.md`, templates under `.claude/templates/` (placement RDPI). Docs: `README.md`, `playbook-setup/SKILL.md`, `playbook-update/SKILL.md:15`.

## Summary

The install skill is mostly a **packaging and sequencing problem, not a build problem** — every runtime piece already exists and is verified (codex lane end-to-end; gemini Vertex lane end-to-end; gemini OAuth lane accepted-untested). The load-bearing discoveries:

1. **The playbook's distribution is "clone + mv everything"** (`README.md:14-18`) — anything committed under `.claude/` lands in every consuming repo automatically. This cuts both ways: templates ship for free, but files placed at *live* paths (`.claude/agents/*.md`) would register agent types in every consuming project **before any install runs** — colliding with "stock sessions stay stock." Template placement must be inert (e.g. `.claude/templates/native-agents/`), with the install skill copying to live paths.
2. **The two relays differ by ~10 lines** (verified by direct read: upstream constant, route function, strip condition, banner). A single canonical relay whose gemini upstream defaults to 8317 (VibeProxy = the shipped OAuth lane) with a config/flag toggle to 8319 (Vertex, local-only) is functionally identical to today's `relay.mjs` for users and kills both the two-relays-on-3456 footgun and the lane split.
3. **A missing axis Codex's sweep under-weighted: where the installed relay lives.** One-relay-per-port + multiple playbook projects on one machine means per-project relay copies race on 3456 with version skew. `/playbook-setup` Step 3B already has the copy-repo-file-to-`~/.claude/` precedent (`playbook-setup/SKILL.md:100-122`) — a machine-global installed home mirrors that and gives launchd a stable absolute path.
4. **`/playbook-update`'s managed-file list is strictly enumerated** (`playbook-update/SKILL.md:15-56`) — every new template/script/skill file must be added explicitly, and its removal-manifest guardrail does NOT currently allow `.claude/agents/` paths (`playbook-update/SKILL.md:171-180`), which matters the day installed agent files need renaming/retiring.
5. **Headless doctor is proven viable**: the gemini doc's verification log records a headless session spawning 3 parallel native agents through the relay (`tasks/gemini-native-agents.md` §4) — so a `claude -p` fresh relayed session can be the doctor's vehicle, modulo permission gaps (open issue #3, `tasks/new-issues.md`).
6. **Shipped `gemini-flash.md` needs rewriting, not copying** — the dev copy's description names the Vertex/ADC chain; the shipped default lane is VibeProxy OAuth.

## Detailed Findings

### The verified runtime (what gets productized)

- **Relay** (`~/Projects/Tools/codex-relay/relay.mjs`, 140 lines, zero deps): routes on body `model` — `isClaudeModel()` (`relay.mjs:30-32`) sends `claude-*`/missing to api.anthropic.com with auth untouched; everything else to VibeProxy :8317 with `authorization`/`x-api-key` deleted (`relay.mjs:64-67`). Hardening: client-error handlers, abort teardown (`relay.mjs:118-123`), writeHead guard, 502 JSON on upstream error, keep-serving `uncaughtException` (`relay.mjs:134-135` — must flip to fail-fast under launchd, recorded tension codex doc §6). Logs every request `model=X → upstream` plus requested-vs-served mismatch lines (`relay.mjs:94-101`) — the doctor's authoritative signal.
- **3-way variant** (`relay-gemini.mjs`): identical except `pickUpstream()` (`relay-gemini.mjs:33-37`) adds `gemini-*` → :8319, and the strip condition broadens to `upstream !== ANTHROPIC` (`relay-gemini.mjs:70-73`). The canonical-relay merge is a parameter, not a rewrite.
- **Agent type files** (`~/.claude/agents/`): `codex.md` (`model: gpt-5.5`, tools Read/Glob/Grep/Bash, minimal no-subagents leaf prompt), `codex-xhigh.md` (`model: gpt-5.5(xhigh)` — effort suffix consumed by CLIProxyAPI), `gemini-flash.md` (`model: gemini-3.5-flash`; **description still says Vertex/ADC — shipped template must say VibeProxy OAuth**). User-level copies are the interim home; project-level `.claude/agents/` is the decided installed home (todo.md task 22 design note 3), with install-time detection of user-level duplicates.
- **Vertex lane machinery** (ships present-but-off): `vertex-adc-shim.mjs` (ADC resolution, token cache, path rewrite), `gemini-cpa-config.yaml` (engine #2 on :8319, isolated auth-dir, shim base-url). Machine-specific values (GCP project, auth dirs) must be templated out.
- **Test scripts**: `test-codex-leg.mjs` (relay-leg smoke, model arg defaults `gpt-5.5`), `test-concurrent.mjs` (concurrency + mid-stream abort; hardcodes `gpt-5.5`). Candidate doctor building blocks — ship-or-dev-only is an open question.
- **Model-ID drift surface**: `gpt-5.5` lives in 4 places (both codex agent files, both test scripts) + `gemini-3.5-flash` in the gemini agent file and any relay/doctor references (codex doc §6).

### Playbook distribution machinery (what the install must integrate with)

- **Install flow** (`README.md:14-23`): `git clone` + `mv playbook/* playbook/.claude .` — the whole `.claude/` tree lands in the consuming repo. Prerequisites (`README.md:5-8`) list only Claude Code + Codex CLI; command tables at `README.md:39-80`; `quickref.md` has a parallel skill table — both need the new skill row, and local precedent says update quickref alongside README.
- **`/playbook-setup`** (`playbook-setup/SKILL.md`): side-effect skill, `disable-model-invocation: true`. Step 3B (`:100-122`) is the strongest precedent for this task's install mechanics: check exists → ask → copy repo file to `~/.claude/...`, diff-and-confirm on re-run. Step 3C (`:125-140`) is the check-and-guide precedent (recommend, give the user the command, don't automate). AC7's "offers/mentions the install as optional" slots naturally as a new optional step here.
- **`/playbook-update`** (`playbook-update/SKILL.md:15-56`): managed files are an explicit enumerated list — globbing is NOT used; every shipped file must be listed or it silently never propagates. Removal manifest (`:150-189`): allowed prefixes are `.claude/{skills,commands,templates,prompts,scripts,hooks}/` — `.claude/agents/` is absent; `.claude/settings*` is hard-forbidden (so distribution can never push settings — env wiring must be written by the install skill, not shipped as a managed file).
- **No committed `.claude/settings.json`, `.claude/hooks/`, or `.claude/agents/` exists today** (verified by ls). `.gitignore` ignores `.claude/settings.local.json`, `.claude/worktrees/`, `tasks/logs/`.
- **Hook schema pitfall** (`tasks/errors.md:5`): settings files nest hooks under a `"hooks"` key — wrong nesting silently breaks wiring. Relevant if auto-boot choice C (SessionStart hook) wins.
- **Permission gap** (open issue #3, `tasks/new-issues.md:51`): fresh installs lack permission rules for `codex exec` / `claude -p` already; this task adds `node`, `lsof`, `curl`, possibly `launchctl` to that surface. The doctor and auto-boot will hit auto-mode denials on fresh machines unless handled.

### Skill-authoring conventions (what the new skill must look like)

- Frontmatter `name` / `description` / `disable-model-invocation: true`; multi-mode via `$ARGUMENTS` keywords (`checkpoint/SKILL.md:12` precedent — `resume|discard|replace`).
- Codex-trio conventions if the skill shells out: temp files under `tasks/` or `tasks/logs/` (gitignored), `codex-output-check.sh` verification, cleanup-before-present.
- `/forge` precedent: skills reference other skills as inline spec, never slash-invoke them.

## Code References

- `tasks/todo.md:393-445` — Task 22 spec (intent, lane decision, constraints, ACs, design notes, OQs)
- `tasks/codex-native-agents.md` §1-§8 — verified codex-lane architecture, setup, auto-launch options A/B/C, constraints, verification log
- `tasks/gemini-native-agents.md` §1-§5 — Vertex lane architecture; §4 headless tri-provider proof; §5 two-lane decision
- `~/Projects/Tools/codex-relay/relay.mjs:30-32,64-67,94-101,118-123,134-135` — route, strip, served-model log, abort teardown, keep-serving posture
- `~/Projects/Tools/codex-relay/relay-gemini.mjs:33-37,70-73` — 3-way route, broadened strip (the only material deltas vs relay.mjs)
- `~/.claude/agents/codex.md`, `codex-xhigh.md`, `gemini-flash.md` — agent templates (gemini description stale for shipped lane)
- `.claude/skills/playbook-update/SKILL.md:15-56` — enumerated managed-file list (additions required)
- `.claude/skills/playbook-update/SKILL.md:171-189` — removal prefixes (no `.claude/agents/`; `.claude/settings*` forbidden)
- `.claude/skills/playbook-setup/SKILL.md:100-122` — Step 3B copy-to-`~/.claude/` install precedent
- `.claude/skills/playbook-setup/SKILL.md:125-140` — Step 3C check-and-guide precedent
- `README.md:5-8,14-23,60-80` — Prerequisites, clone+mv install flow, command tables
- `quickref.md:6-15` — parallel skill table to update
- `.gitignore:4-6` — settings.local, worktrees, tasks/logs ignores
- `tasks/errors.md:5` — hooks-nesting pitfall
- `tasks/new-issues.md:51` — issue #3, missing permission rules on fresh installs
- `.claude/skills/checkpoint/SKILL.md:12` — multi-mode `$ARGUMENTS` precedent

## Architecture Analysis

The playbook is a **git-distributed file tree with skill-driven post-install steps**: `clone+mv` delivers bytes; `/playbook-setup` does interactive per-project configuration; `/playbook-update` re-syncs an enumerated file list. There is no executable installer — every "install" is a skill walking the developer through checks and copies. The new skill extends this model to a third layer it has never touched: **machine state** (VibeProxy app, OAuth logins, a long-running relay process). The existing precedents split exactly along the task's (a)/(b) boundary: Step 3C-style check-and-guide for things skills can't do (app install, OAuth), Step 3B-style copy-and-confirm for things they can (placing files). What has no precedent is (c) auto-boot — the playbook has never managed a daemon — which is why the lockout failure mode dominates the design: the env-var wiring and the process lifecycle are owned by different layers (settings/git vs machine), and the install must make them fail independently-safe.

The relay's design philosophy carries the security architecture: route on one JSON field, never parse or store credentials, strip Claude auth on any non-Anthropic leg. Any canonicalization must preserve the strip-on-`!== ANTHROPIC` form (the broader of the two), since the shipped relay will serve both lanes.

## Design Axes

### Axis 1: Skill surface
- **Choices:** (a) one skill with `install` / `doctor` modes (bare = install, `doctor` = probe); (b) two skills (`/x-install`, `/x-doctor`).
- **Per-axis constraints:** `disable-model-invocation: true`; restart-before-doctor sequencing means the two phases are temporally split regardless — the surface choice is naming, not flow.
- **Evidence:** multi-mode precedent `checkpoint/SKILL.md:12`; task OQ leaves name open (`todo.md:441`).

### Axis 2: Shipped template placement (in the playbook repo)
- **Choices:** (a) inert templates under `.claude/templates/native-agents/` (or similar), install copies to live paths; (b) live paths in-repo (`.claude/agents/*.md` committed) so clone+mv installs them directly; (c) split — runnable relay under `.claude/scripts/`, static agent files under templates.
- **Per-axis constraints:** templates project-agnostic; everything placed must be enumerated in the managed-file list (`playbook-update/SKILL.md:15`); Vertex machinery must be present-but-not-offered.
- **Evidence:** flat `.claude/templates/*` precedent; `codex-output-check.sh` script precedent; clone+mv flow `README.md:14-18`.

### Axis 3: Relay shape
- **Choices:** (a) ship hardened 2-way `relay.mjs` as-is (gemini-* already falls through to 8317 — correct for the shipped OAuth lane) + keep `relay-gemini.mjs` as inert Vertex template; (b) one canonical configurable relay — gemini upstream defaults 8317, flag/config flips to 8319 (Vertex, local-only).
- **Per-axis constraints:** hardened strip + abort nets non-negotiable; strip must use the `!== ANTHROPIC` form if one relay serves both lanes; one relay per port.
- **Evidence:** deltas are ~10 lines (`relay-gemini.mjs:33-37,70-73` vs `relay.mjs:30-32,64-67`); task design note 2 leans canonical (`todo.md:432`).

### Axis 4: Installed relay home
- **Choices:** (a) per-project copy (e.g. consuming repo's `.claude/scripts/relay.mjs`); (b) machine-global user-level home (e.g. under `~/.claude/`), installed by copy the way Step 3B installs global skills; (c) run from the playbook-shipped path in-place per project but bind a single instance machine-wide (first-wins).
- **Per-axis constraints:** one relay per port 3456 across ALL projects on the machine; launchd (if chosen) needs a stable absolute path; relay version must be updatable when `/playbook-update` ships a new one.
- **Evidence:** Step 3B copy-to-`~/.claude/` precedent (`playbook-setup/SKILL.md:100-122`); lifecycle rule "never a claude child" (both docs).

### Axis 5: Auto-boot mechanism
- **Choices:** (A) shell wrapper function (starts relay detached if missing, sets env for that command only); (B) launchd LaunchAgent (`RunAtLoad` + `KeepAlive`); (C) project `.claude/settings.json` env + SessionStart hook that checks/starts the relay; hybrid C-then-B.
- **Per-axis constraints:** processes user-owned, never claude children; launchd ⇒ flip relay `uncaughtException` to fail-fast (`relay.mjs:134` + todo.md:406); hook JSON must use the `"hooks"` nesting (`tasks/errors.md:5`); hook must fail-open.
- **Evidence:** codex doc §5 A/B/C sketches; task 18's SessionStart research (matchers, additionalContext, fail-open) at `todo.md:349-390`.

### Axis 6: Env opt-in boundary
- **Choices:** (a) project `.claude/settings.json` `env.ANTHROPIC_BASE_URL` — every session in the repo is relayed; (b) wrapper-only env — relayed sessions are explicitly launched, stock `claude` untouched; (c) user-level settings env (global — likely too broad).
- **Per-axis constraints:** stock sessions stay stock; a broken/absent relay must never lock anyone out (a plain `claude` escape hatch must always exist); `.claude/settings*` cannot be a playbook-managed file (`playbook-update/SKILL.md:187`) — the install skill writes/merges it.
- **Evidence:** env-in-settings is official behavior (External Research); lockout mode codex doc §5.

### Axis 7: Doctor probe shape
- **Choices:** (a) install ends "restart, then run `<skill> doctor`" — doctor runs in the user's fresh relayed session, spawns each agent type, then greps the relay log; (b) doctor launches a headless `claude -p` relayed child session itself; (c) layered: relay-leg preflight (`test-codex-leg.mjs`-style) first, then in-session agent probe.
- **Per-axis constraints:** agent types register at session start; probe must assert self-report AND relay-log upstream line; gemini probe should include a tool-use check (gemini tool path untested — `todo.md:435`); gemini failures must diagnose (toggle? login? model name?).
- **Evidence:** headless native-agent spawn through relay is proven (`tasks/gemini-native-agents.md` §4, tri-provider fleet row); smoke-test pattern codex doc §3.5.

### Axis 8: Machine-layer check strategy
- **Choices:** (a) health endpoint only (`curl localhost:8317/v1/models`); (b) endpoint + app presence (`/Applications/VibeProxy.app`); (c) endpoint + provider-specific assertions (gpt-* present for codex lane; gemini-* present implies toggle on).
- **Per-axis constraints:** check-and-guide only — never automate app install/OAuth; re-check after instructing.
- **Evidence:** codex doc §3.1 expected model list; VibeProxy README documents toggles + Launch at Login (External Research).

### Axis 9: Vertex lane exposure
- **Choices:** (a) inert templates only, no install path, doc note for local use; (b) hidden config flag on the canonical relay (`--gemini-port 8319` / config file), undocumented in user-facing text; (c) separate local-only helper script outside the install surface.
- **Per-axis constraints:** not user-offered; project-agnostic (strip GCP project IDs); must not create a second relay on 3456.
- **Evidence:** lane decision `todo.md:397`; gemini doc §5 two-lane framing.

### Axis 10: Model-ID centralization
- **Choices:** (a) single constants/config source the relay+doctor+templates read; (b) placeholders in templates filled at install time by the skill; (c) documented update checklist enumerating every site (status quo, made explicit).
- **Per-axis constraints:** agent frontmatter `model:` is read by Claude Code directly from each agent file — true single-sourcing can't reach frontmatter without a generation step; agent-type names `codex`/`codex-xhigh`/`gemini-flash` are frozen (task 23 dependency).
- **Evidence:** four-plus drift sites (codex doc §6); OpenAI currently recommends `gpt-5.5` (External Research).

### Axis 11: Distribution & update path for installed files
- **Choices:** (a) installed agent files are verbatim copies of managed templates — update = `/playbook-update` then re-run install (diff-and-confirm like Step 3B); (b) installed files are generated (placeholder-filled) — update path must regenerate, not copy.
- **Per-axis constraints:** every shipped file enumerated in the managed list; removal prefixes lack `.claude/agents/` — extend now or document that installed agent files are install-owned, not playbook-managed.
- **Evidence:** `playbook-update/SKILL.md:15-56,171-180`.

### Axis 12: Permission handling
- **Choices:** (a) skill checks/instructs only (consistent with issue #3 remaining open); (b) install writes/merges the needed permission rules into project settings as part of the project-layer write; (c) defer wholesale to a future issue-#3 fix in `/playbook-setup`.
- **Per-axis constraints:** doctor + auto-boot need `node`, `lsof`, `curl`, possibly `launchctl`, possibly `claude -p`; fresh installs currently deny these (issue #3).
- **Evidence:** `tasks/new-issues.md:51`; `.claude/settings.local.json` (dev machine's local-only rules — the non-distributable status quo).

**Settled (not axes):** installed agent-file home = project `.claude/agents/` with user-level duplicate detection (decided 2026-06-11, `todo.md:433`); `codex` stays suffix-less, `codex-xhigh` explicit (codex doc §4); trio stays on `codex exec` (AC8).

## Axis Coupling

- If Axis 5 = B (launchd) → relay templates must carry the fail-fast `uncaughtException` posture (constraint, `todo.md:406`); Axis 4 narrows toward (b) machine home (plist wants a stable absolute path outside any repo).
- If Axis 6 = (a) project settings env → Axis 5 must guarantee relay-up before *every* session in the repo (lockout exposure is maximal); SessionStart-hook timing becomes load-bearing (see External Research) and the hook must fail-open. If Axis 6 = (b) wrapper env → lockout shrinks to wrapper-launched sessions and the wrapper itself does the boot check, but Axis 7 doctor must know to launch via the wrapper, and "auto" in auto-boot is weaker (user must adopt the wrapper).
- If Axis 3 = (b) canonical relay → Axis 9 collapses to (b)-style toggle on one artifact, eliminating the two-relays-on-3456 race by construction; strip condition must be the broadened `!== ANTHROPIC` form.
- If Axis 2 = (b) live in-repo `.claude/agents/` paths → agent types register in every consuming repo pre-install, violating "stock sessions stay stock" for users who clone but never install → effectively forces Axis 2 = (a)/(c) inert placement.
- If Axis 4 = (a) per-project relay copies → multi-project machines race on 3456 with version skew; doctor's relay-log path becomes per-project too. Machine home (b) gives one process, one log path, one version.
- If Axis 7 = (b) headless `claude -p` doctor → Axis 12 sharpens (issue #3 says fresh installs deny `claude -p`); permission handling must precede the probe.
- If Axis 10 = (b) install-time placeholder filling → Axis 11 narrows to (b) generated files, and `/playbook-update` re-sync must not blindly overwrite installed copies.
- If Axis 2 places the relay under `.claude/scripts/` (managed) AND Axis 4 = (b) machine home → install copies script out of the repo; update path = re-run install after `/playbook-update` (Step 3B diff-and-confirm pattern).

## Cross-Cutting Constraints

- Agent-type names `codex` / `codex-xhigh` / `gemini-flash` are frozen — task 23 routes to them.
- Hardened relay non-negotiable: abort/concurrency nets + credential strip on all non-Anthropic routes.
- One relay per port 3456, machine-wide; processes user-owned, never claude children.
- Stock sessions 100% stock; plain `claude` always works regardless of install state.
- Templates project-agnostic — no `~/Projects/Tools/codex-relay/` paths, no GCP IDs, no account names.
- Every new shipped file → `/playbook-update` managed list (enumerated, no globs); `.claude/settings*` can never be a managed file (forbidden, `playbook-update/SKILL.md:187`).
- README Prerequisites + command tables AND `quickref.md` table gain the new entries.
- Hooks (if used) follow the `"hooks"` settings nesting (`tasks/errors.md:5`) and fail open.
- Logs land under gitignored paths (`tasks/logs/` in-repo, or machine home outside repos).
- Gemini OAuth lane ships untested — doctor failures must name the three likely causes (toggle off / not logged in / model name unsupported).
- `gemini-flash.md` shipped description rewritten for the OAuth lane (dev copy says Vertex/ADC).

## External Research

- **Claude Code subagent scopes** — project `.claude/agents/` and user `~/.claude/agents/` are both official; project definitions are team-shareable and take precedence on name collision; files load at session start. **Unblocks:** the settled agent-home decision + Axis 7 restart sequencing; precedence detail informs the user-level-duplicate cleanup (shadowing is resolved project-first, so stale user copies are confusing but not breaking). Source: https://code.claude.com/docs/en/sub-agents
- **Settings & env** — project `.claude/settings.json` is the team-shared layer; `env` entries apply to every session started in that project; `ANTHROPIC_BASE_URL` is the documented gateway override. **Unblocks:** Axis 6 (a) viability. Sources: https://code.claude.com/docs/en/settings, https://code.claude.com/docs/en/env-vars
- **SessionStart hooks** — fire on `startup|resume|clear|compact`, receive `session_id`/`source` on stdin, can inject `additionalContext`, cannot block session start via exit 2. **Unblocks:** Axis 5 (C). Source: https://code.claude.com/docs/en/hooks. **Residual timing question:** docs imply the hook completes before the first model call, but "relay started by the hook is listening before the session's first API request" is not explicitly guaranteed — empirically testable in minutes on the dev machine; schedule for design/implement verification rather than further doc archaeology.
- **VibeProxy** — macOS 13+ menu-bar app; UI OAuth for Codex AND Gemini (provider toggles); server start/stop; **Launch at Login** option (relevant to Axis 8 guidance: the app side of auto-boot is a VibeProxy setting, not ours). **Unblocks:** Axis 8, AC4's toggle instruction. Source: https://github.com/automazeio/vibeproxy
- **VibeProxy README model drift** — README advertises GPT-5.1-era models while the verified local `/v1/models` serves `gpt-5.5` (codex doc §8). Confirms model lists are version-dependent → doctor should assert against the live `/v1/models`, not a hardcoded catalog. **Unblocks:** Axis 8 (c), Axis 10. Sources: https://github.com/automazeio/vibeproxy + `tasks/codex-native-agents.md` §3.1
- **Codex model recommendation** — OpenAI docs currently recommend `gpt-5.5` for most Codex tasks. **Unblocks:** Axis 10 (shipping `gpt-5.5` as the default ID is current-correct). Source: https://developers.openai.com/codex/models#recommended-models
- **launchd** — `RunAtLoad` starts at load/login; `KeepAlive` restarts on exit. **Unblocks:** Axis 5 (B). Source: https://www.manpagez.com/man/5/launchd.plist/
- **Headless native-agent spawning** (internal but external-shaped): a headless relayed session ran a tri-provider fleet (opus + codex + gemini-flash in parallel) successfully — `tasks/gemini-native-agents.md` §4. **Unblocks:** Axis 7 (b).
- **Gemini OAuth-lane model ID** — whether VibeProxy's gemini-cli/Code-Assist path serves the literal `gemini-3.5-flash` cannot be verified without a logged-in instance (we don't have one — that's the accepted-risk). This is *by design* the doctor's job; the probe's "model name?" diagnostic exists precisely because this is unknowable pre-ship. Not researchable further; design the failure message instead.

## Risk Analysis

- **Lockout (the headline risk):** env set + relay down = every request refused. Mitigations live on two axes (5: boot; 6: blast radius). Worst combination: project settings env + no supervisor + keep-serving relay that wedged. Note the relay's current keep-serving posture *causes* exactly the wedge launchd would fix — the fail-fast flip is coupled, not optional, under B.
- **Frontmatter `model:` passthrough is undocumented** (codex doc §6) — docs claim non-Anthropic strings are rejected; empirically they reach the wire. Any Claude Code release could tighten this and break every installed lane at once. The doctor probe is the regression detector; the fallback mechanisms (`CLAUDE_CODE_SUBAGENT_MODEL`, alias hijack — codex doc §4) survive as documented escape hatches. The install skill's docs should name this fragility.
- **Gemini OAuth lane ships untested** — accepted; transfers verification to each user's doctor run. The probe must distinguish: relay down (connection refused) / toggle off or not logged in (VibeProxy error shape) / model ID unsupported (served-model mismatch or 404) — the relay's request+mismatch logging gives the doctor the signal it needs.
- **Permission denials on fresh installs** (issue #3) — the doctor's own toolchain (`node`, `lsof`, `curl`, `claude -p`) may be denied before it can diagnose anything, presenting as a broken install. Axis 12 must be decided deliberately, not inherited.
- **Two-relay race:** legacy dev machines (this one) run `relay.mjs`/`relay-gemini.mjs` manually; an installed auto-boot could double-bind 3456 (second bind fails — but *which* relay serves is then launch-order-dependent). Install should detect an already-listening 3456 and identify it before wiring auto-boot.
- **User-level agent duplicates** — project copies take precedence (External Research), so stale `~/.claude/agents/` files won't break routing but will confuse `/agents` listings and task-23 expectations on other projects. Cleanup detection is specified in the task (design note 3); do not delete before the project-level install lands (memory + todo note).
- **Managed-list omission** — any shipped file missed in `playbook-update/SKILL.md:15` silently never updates on consumer machines. The relay especially: a future security fix (like the credential strip) MUST propagate; this elevates Axis 11 from bookkeeping to security-update channel.
- **VibeProxy is a third-party moving target** — port layout (8317 ThinkingProxy → 8318 engine), model catalog, and app paths can change under us; the Vertex lane additionally borrows the app-bundle binary (path breaks if the app moves — accepted, lane is local-only).

## Open Questions

1. **Skill name + surface** (Axis 1): `/agents-install`? `/playbook-agents`? install/doctor as modes or two skills? (Task OQ.)
2. **Project settings env vs wrapper opt-in** (Axis 6) — tied to lockout blast radius and "stock stays stock." (Task OQ.)
3. **Do the smoke/stress test scripts ship** as doctor building blocks or stay dev-only? (Task OQ.)
4. **Vertex toggle mechanism** (Axis 9): config flag, separate config file, or undocumented install arg? Must be invisible to users, recoverable for local re-install. (Task OQ.)
5. **SessionStart-hook timing** — verify empirically that a hook-started relay is listening before the session's first API call (needed only if Axis 5 = C / hybrid).
6. **Where the relay logs** when launched by wrapper vs launchd vs hook — the doctor's log-assertion needs one knowable path per mechanism.
7. **Does the playbook repo itself adopt the installed layout** (dogfood: project `.claude/agents/` here, retire `~/.claude/agents/` copies) as part of this task, or immediately after? (Affects task-23 testing and the memory-noted cleanup ordering.)
