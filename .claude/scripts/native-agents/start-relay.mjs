#!/usr/bin/env node
// start-relay: detach helper for the claude-native launcher.
//
// macOS has no setsid(1), and a bare `nohup … &` from a shell that then execs
// claude can leave the relay parented to the process that becomes Claude.
// Node's spawn({ detached: true }) + unref() is the reliable detach: the relay
// joins its own process group and re-parents to init when this helper exits.
//
// Installed by /native-agents to ~/.claude/native-agents/start-relay.mjs and
// invoked by claude-native — not meant to be run by hand.
//
// Usage: node start-relay.mjs   (port from CLAUDE_NATIVE_PORT, default 3456;
//                                RELAY_GEMINI_PORT flows through inherited env)

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const home = process.env.HOME || os.homedir();
const naHome = path.join(home, ".claude", "native-agents");
fs.mkdirSync(naHome, { recursive: true, mode: 0o700 });

const relayPath = path.join(naHome, "relay.mjs");
if (!fs.existsSync(relayPath)) {
  console.error(`start-relay: ${relayPath} not found — run /native-agents install`);
  process.exit(1);
}

const port = process.env.CLAUDE_NATIVE_PORT || "3456";

// log hygiene: bound disk use without a background task
const logPath = path.join(naHome, "relay.log");
try {
  if (fs.statSync(logPath).size > 5 * 1024 * 1024) fs.renameSync(logPath, `${logPath}.1`);
} catch {
  /* no log yet */
}
const fd = fs.openSync(logPath, "a", 0o600);

const child = spawn(process.execPath, [relayPath, "--port", port], {
  detached: true,
  stdio: ["ignore", fd, fd],
  env: process.env,
});
child.unref();
fs.closeSync(fd);
console.error(`start-relay: relay pid ${child.pid} (port ${port}, log ${logPath})`);
