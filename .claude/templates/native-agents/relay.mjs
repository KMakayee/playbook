#!/usr/bin/env node
// playbook-native-agents-relay: model-routing relay for Claude Code.
//
// Installed by /native-agents to ~/.claude/native-agents/relay.mjs and booted
// on demand by the claude-native launcher, which also owns relay.log rotation.
// Do not hand-edit the installed copy — changes ship through the playbook
// template and a /native-agents install re-run.
//
//   claude (ANTHROPIC_BASE_URL=http://127.0.0.1:3456, set by claude-native)
//     ├─ model claude-*  → api.anthropic.com   (bytes verbatim, auth headers untouched)
//     ├─ model gemini-*  → 127.0.0.1:$RELAY_GEMINI_PORT (default 8317 = VibeProxy, Gemini OAuth)
//     └─ model <other>   → VibeProxy 127.0.0.1:8317 (Codex OAuth lives there, not here)
//
// Local-only Vertex lane: launch with RELAY_GEMINI_PORT=8319 to send gemini-*
// traffic to a second CLIProxyAPI instance backed by vertex-adc-shim.mjs (see
// the playbook's .claude/templates/native-agents/vertex/ — that lane is never
// installed by /native-agents and is documented only there and here).
//
// This process never stores, parses, or re-uses credentials. It routes on the
// `model` field of the request body and pipes streams both directions.
//
// GET /health returns identity JSON (service, relayVersion, scriptHash, pid,
// port, geminiPort, startedAt). The claude-native launcher and the
// /native-agents doctor use it as the fail-closed identity handshake; the
// scriptHash is their staleness gate against the installed relay.mjs.
//
// Usage:  node relay.mjs [--port 3456] [--debug]

import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import crypto from "node:crypto";

const RELAY_VERSION = "1.0.0";

const args = process.argv.slice(2);

// fail fast on explicit invalid ports: a detached boot logs this to relay.log
// and the claude-native launcher fails closed showing the log tail
function parsePort(value, fallback, name) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(`relay: invalid ${name} "${value}" — expected an integer 1..65535`);
    process.exit(1);
  }
  return n;
}
const portIdx = args.indexOf("--port");
const PORT = parsePort(portIdx >= 0 ? args[portIdx + 1] : undefined, 3456, "--port");
const DEBUG = args.includes("--debug");

const ANTHROPIC = { protocol: "https:", host: "api.anthropic.com", port: 443, label: "anthropic" };
const CODEX = { protocol: "http:", host: "127.0.0.1", port: 8317, label: "codex" };
const GEMINI = {
  protocol: "http:",
  host: "127.0.0.1",
  port: parsePort(process.env.RELAY_GEMINI_PORT, 8317, "RELAY_GEMINI_PORT"),
  label: "gemini",
};

// identity facts for GET /health — captured once at boot
const STARTED_AT = new Date().toISOString();
const SCRIPT_HASH = crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex");

// keep-alive agents so concurrent fan-out reuses sockets
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 64 });
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 64 });

const log = (...a) => console.log(new Date().toISOString(), ...a);
const dbg = (...a) => DEBUG && log("[debug]", ...a);

function pickUpstream(model) {
  if (typeof model !== "string" || model.startsWith("claude")) return ANTHROPIC;
  if (model.startsWith("gemini")) return GEMINI;
  return CODEX;
}

const server = http.createServer((req, res) => {
  // a dropped client must never take the process down
  req.on("error", (e) => dbg("client req error:", e.message));
  res.on("error", (e) => dbg("client res error:", e.message));

  // identity handshake — answered before body collection/routing
  // (an unintercepted GET would route to Anthropic)
  if (req.method === "GET" && req.url === "/health") {
    req.resume();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        service: "playbook-native-agents-relay",
        relayVersion: RELAY_VERSION,
        scriptHash: SCRIPT_HASH,
        pid: process.pid,
        port: PORT,
        geminiPort: GEMINI.port,
        startedAt: STARTED_AT,
      })
    );
    return;
  }

  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);

    // Route on the model field when present; default to Anthropic.
    let model;
    try {
      model = JSON.parse(body.toString("utf8")).model;
    } catch {
      /* non-JSON or empty body (e.g. GET/HEAD) → Anthropic */
    }
    const upstream = pickUpstream(model);
    const label = upstream.label;
    log(`${req.method} ${req.url} model=${model ?? "-"} → ${label}`);

    // Forward headers verbatim except hop-by-hop / host.
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers["content-length"];
    headers["content-length"] = Buffer.byteLength(body);

    // Never hand Claude's credentials to a local proxy leg: both the Codex and
    // Gemini routes authenticate upstream themselves (Codex/Gemini OAuth in
    // VibeProxy, ADC in vertex-adc-shim), so strip Claude's auth there.
    if (upstream !== ANTHROPIC) {
      delete headers.authorization;
      delete headers["x-api-key"];
    }

    const isTls = upstream.protocol === "https:";
    const proxied = (isTls ? https : http).request(
      {
        host: upstream.host,
        port: upstream.port,
        method: req.method,
        path: req.url,
        headers,
        agent: isTls ? httpsAgent : httpAgent,
      },
      (upRes) => {
        upRes.on("error", (e) => {
          dbg(`upstream stream error (${label}):`, e.message);
          res.destroy();
        });
        try {
          res.writeHead(upRes.statusCode, upRes.headers);
        } catch (e) {
          log(`writeHead failed (${label}):`, e.message);
          upRes.destroy();
          res.destroy();
          return;
        }
        // peek at the first chunk to report which model actually served
        let served = null;
        const peek = (chunk) => {
          const m = /"model"\s*:\s*"([^"]+)"/.exec(chunk.toString("utf8"));
          if (m) {
            served = m[1];
            if (served !== model) log(`  ↳ requested ${model} but SERVED BY ${served} (${label})`);
            upRes.off("data", peek);
          }
        };
        upRes.on("data", peek);
        upRes.pipe(res); // stream SSE / body straight through
        upRes.on("end", () => dbg(`← ${upRes.statusCode} (${label})${served ? ` served=${served}` : ""}`));
      }
    );
    proxied.on("error", (err) => {
      log(`upstream error (${label}):`, err.message);
      if (res.writableEnded || res.destroyed) return;
      try {
        if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ type: "error", error: { type: "relay_upstream_error", message: `${label}: ${err.message}` } }));
      } catch {
        res.destroy();
      }
    });
    // client gone (abort/retry) → tear down the upstream leg, don't error out
    res.on("close", () => {
      if (!res.writableEnded) {
        dbg(`client closed early (${label})`);
        proxied.destroy();
      }
    });
    proxied.end(body);
  });
});

server.on("clientError", (err, socket) => {
  dbg("clientError:", err.message);
  socket.destroy();
});

// last-resort safety nets: log loudly, keep serving
process.on("uncaughtException", (err) => log("UNCAUGHT:", err.stack || err.message));
process.on("unhandledRejection", (err) => log("UNHANDLED REJECTION:", err?.stack || String(err)));

server.listen(PORT, "127.0.0.1", () => {
  log(`playbook-native-agents-relay v${RELAY_VERSION} listening on http://127.0.0.1:${PORT}`);
  log(`  claude-* → https://${ANTHROPIC.host}  |  gemini-* → http://${GEMINI.host}:${GEMINI.port}  |  other → http://${CODEX.host}:${CODEX.port}`);
});
