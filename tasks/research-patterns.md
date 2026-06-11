# Patterns Research: Launch-on-Demand Local Sidecar/Daemon Patterns for a CLI Launcher

**Design decision:** `tasks/design-decision.md`

Researched by Codex (`--search`, xhigh) for the chosen approach: the fail-closed `claude-native` launcher that port-checks → spawns the relay detached → polls readiness → execs `claude` with `ANTHROPIC_BASE_URL`. Parent session spot-checked the Node.js, Bazel, Gradle, and OpenSSH sources against the live pages (all claims held) and verified the "no `setsid` executable on macOS" claim locally (`command -v setsid` → not found).

## Sources Studied

### OpenSSH ControlMaster — official docs + source, [ssh_config(5)](https://man.openbsd.org/ssh_config#ControlMaster), [ssh(1)](https://man.openbsd.org/ssh.1), [mux.c](https://raw.githubusercontent.com/openssh/openssh-portable/master/mux.c)
- **Why this source:** Mature launch/reuse pattern for an existing CLI that opportunistically connects to a background local control endpoint.
- **What we learned:** OpenSSH keys daemon identity by a private Unix socket path, recommends host/user/port tokens in that path (`%h`/`%p`/`%r` or `%C` — verified), and uses protocol handshakes/alive checks rather than "socket exists" alone. Its `auto` multiplexing is fail-open because SSH can still connect normally (verified).
- **Applicable to us:** Because `claude-native` cannot safely fall back to plain `claude` after the user requested a relayed session, copy the identity/handshake pattern but keep fail-closed. A raw `127.0.0.1:3456` listener check is insufficient.

### Bazel Client/Server — official docs, [client/server implementation](https://bazel.build/run/client-server), [command-line reference](https://bazel.build/reference/command-line-reference)
- **Why this source:** Long-lived on-demand CLI server with workspace/user scoping, version checks, startup waiting, and explicit shutdown.
- **What we learned:** Bazel starts a server if none exists for the output base, allows only one invocation at a time per server, checks server version before use and stops/restarts mismatched servers, and idles servers out after a timeout (verified).
- **Applicable to us:** Add a relay version/protocol check before `exec claude`. On mismatch, either graceful-restart the known relay or fail with a clear "old relay running" diagnostic.

### Gradle Daemon — official docs, [Gradle Daemon](https://docs.gradle.org/current/userguide/gradle_daemon.html)
- **Why this source:** Widely used build daemon with compatibility selection, user-home logs, status/stop UX, and cleanup conventions.
- **What we learned:** Gradle only reuses compatible daemons based on exact build environment and Gradle/JVM version. It writes per-process daemon logs under the Gradle user home (`~/.gradle/daemon/<version>/daemon-<pid>.out.log`), supports `--stop`, and auto-cleans logs older than 14 days (verified).
- **Applicable to us:** Treat relay compatibility as explicit data, not inference. Put logs under `~/.claude/native-agents/`, include PID/version in health output, and implement simple rotation/truncation.

### GnuPG `gpg-agent` — official docs, [Invoking GPG-AGENT](https://www.gnupg.org/documentation/manuals/gnupg/Invoking-GPG_002dAGENT.html), [Agent Options](https://www.gnupg.org/documentation/manuals/gnupg/Agent-Options.html), [Agent GETINFO](https://www.gnupg.org/documentation/manuals/gnupg/Agent-GETINFO.html), [Agent Signals](https://www.gnupg.org/documentation/manuals/gnupg/Agent-Signals.html)
- **Why this source:** Security-sensitive user-owned agent that auto-starts on demand and exposes process identity.
- **What we learned:** GnuPG tools auto-start the agent, the agent refuses duplicate daemon instances by default, exposes `GETINFO` values such as version/PID/socket name, supports graceful `SIGTERM`, and has log-file support.
- **Applicable to us:** Add a relay health/identity endpoint returning version, PID, UID, script path/hash, and upstream mode. Use graceful termination for trusted old-relay restarts.

### Node.js Child Process Detach — official docs, [child_process detached/unref](https://nodejs.org/api/child_process.html#optionsdetached)
- **Why this source:** The relay is Node-based, and macOS does not provide a `setsid` command-line utility (verified locally).
- **What we learned:** On non-Windows platforms, `spawn(..., { detached: true })` makes the child leader of a new process group **and session**; long-running detached children need stdio ignored/redirected or they stay attached to the terminal; `unref()` lets the parent exit independently (all verified against the live docs, including the canonical `detached + stdio:'ignore' + unref()` example).
- **Applicable to us:** Prefer a tiny Node start helper over shell-only `setsid`/`nohup`. It directly satisfies "survives launcher / never a claude child" and avoids keeping relay stdio attached to Claude.

### POSIX/macOS Detach Primitives — specs/docs, [POSIX nohup](https://man7.org/linux/man-pages/man1/nohup.1p.html), [macOS setsid(2)](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/setsid.2.html), [macOS daemon(3)](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man3/daemon.3.html)
- **Why this source:** The launcher target is macOS shell environments.
- **What we learned:** `nohup` only ignores SIGHUP and handles terminal stdio; it does not itself create a new session. macOS has `setsid(2)` as a syscall only — there is no `setsid` executable (verified locally on this machine). Apple's `daemon(3)` docs discourage direct daemonizing in favor of `launchd`.
- **Applicable to us:** Do not rely on `setsid` being in PATH. Avoid bare `nohup node relay.mjs &` followed by `exec claude` — the background relay can remain parented to the process that becomes Claude.

## Coverage Assessment

- **Source count:** 6 strong sources / 9 candidate families searched. Docker/Colima/Lima searches did not surface a stronger launch-on-demand pattern than Bazel/Gradle/GPG/OpenSSH for this narrow launcher shape.
- **Read depth per source:** OpenSSH moderate-to-deep; Bazel deep (client/server page + key options); Gradle moderate (key sections); GnuPG moderate (key sections); Node/POSIX/macOS detach docs deep for the relevant sections. (`tasks/design-decision.md` and `tasks/research-codebase.md` read in full.)
- **Confidence:** HIGH. Sources agree on identity handshakes, explicit compatibility checks, user-home logs, and fail-fast/fail-closed behavior when the daemon is required. The only medium-confidence area is the exact readiness-timeout length for this specific Node relay. Parent spot-check (4 of 6 sources opened + 1 local claim) passed with no corrections.

## Synthesized Patterns

- Mature tools do not trust "a port/socket is open" as daemon identity. They key the endpoint by user/workspace/version where possible, then confirm with a protocol or metadata handshake.
- Single-instance enforcement usually has two layers: an atomic OS-level endpoint claim, plus advisory launcher coordination to avoid noisy races. For our fixed TCP port, the daemon's bind is the final lock; a launcher-side `mkdir` lock can reduce duplicate spawns.
- Compatibility is explicit. Bazel and Gradle both refuse to reuse an incompatible daemon. For us, health output should include relay protocol version and installed relay hash/version.
- Readiness should poll a health/identity endpoint, not just TCP connect. A foreign process on 3456 must produce a fail-closed diagnostic, not a relayed Claude launch.
- Fail-open is appropriate when the daemon is an optimization (OpenSSH multiplexing). `claude-native` is different: the user explicitly requested a relayed session, so fail-closed is the right UX.
- Logs belong in the user-owned daemon home, not `nohup.out`: `~/.claude/native-agents/relay.log`, mode 0600, with simple start-time rotation or truncation.

## Recommendations for Our Implementation

1. **Add `GET /health` to the relay.** Return JSON with at least: `service: "claude-native-relay"`, `protocolVersion`, `relayVersion` (or script hash), `pid`, `uid`, `port`, `startedAt`, and upstream mode. The launcher requires this before setting `ANTHROPIC_BASE_URL`. (Note: this is relay code change — see Concerns.)
2. **Launcher-side advisory lock** such as `~/.claude/native-agents/relay.start.lock` created with atomic `mkdir`. Re-check health after acquiring the lock. If the lock exists, poll health briefly before considering it stale.
3. **Detach via a Node start helper**: `child_process.spawn(process.execPath, [relayPath], { detached: true, stdio: ['ignore', outFd, errFd] }); child.unref();` — more portable on macOS than `setsid` (no executable exists) and safer than bare `nohup`.
4. **Poll health with a short cap** — e.g. 30 attempts at 100ms with a documented env override. The poll should distinguish: no listener / foreign listener / wrong version / healthy relay.
5. **Fail-closed error UX:** say `claude-native` refused to start Claude, state that plain `claude` remains unaffected (the escape hatch), show the log path, and include the command to inspect the port owner (`lsof -nP -iTCP:3456 -sTCP:LISTEN`).
6. **Upgrades:** compare launcher-expected version to health-reported version. If the running relay is ours and idle, terminate gracefully and restart. If active or untrusted, fail closed with instructions instead of killing an unknown or busy process.
7. **Log hygiene at start:** create `~/.claude/native-agents/` mode 0700, append to `relay.log` mode 0600, rotate to `relay.log.1` or truncate with a marker when over a small cap.

## Concerns for Developer Review

1. **Detach mechanism vs design sketch:** the design's Option 2 sketch says "setsid/nohup" — macOS has no `setsid` executable, and bare `nohup … & ; exec claude` does not guarantee the relay is no longer a child of the process that becomes Claude. The implementation should use the Node detached helper (or an explicit intermediate process that exits before `exec`). Implementation-level fix; no design change needed, but the plan must not copy the sketch literally.
2. **Health endpoint vs "No relay feature work" scope line:** the design's What-We're-NOT-Doing says "no relay feature work beyond the canonical two-variant merge," but every studied tool treats an identity/health handshake as non-optional for a fixed public localhost port — a raw TCP-listening check cannot distinguish our relay from a foreign or stale process, which the doctor and fail-closed launcher both depend on. Recommend the developer explicitly allow this one addition (~15 lines: a `GET /health` route) as part of the canonical merge.
3. **Restart-on-version-mismatch policy:** automatic restart can disrupt another active relayed session on the same machine. Developer should choose between "restart only when health says idle" and "fail with 'old relay running'; ask the user to stop it." (Simplest v1: never auto-kill; print instructions.)
