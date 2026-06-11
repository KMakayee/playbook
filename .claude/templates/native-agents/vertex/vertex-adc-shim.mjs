#!/usr/bin/env node
// vertex-adc-shim: ADC auth wrapper for the Gemini/Vertex leg.
//
// Local-only lane: NOT installed by /native-agents — used together with the
// relay's RELAY_GEMINI_PORT=8319 toggle (see gemini-cpa-config.yaml alongside).
//
//   CLIProxyAPI #2 (gemini-cpa-config.yaml, :8319)
//     └─► this shim (127.0.0.1:3457)
//           strips the placeholder x-goog-api-key,
//           attaches Authorization: Bearer <ADC access token>,
//           rewrites /v1/publishers/google/models/X:method
//                 →  /v1/projects/<project>/locations/<location>/publishers/google/models/X:method
//           └─► https://aiplatform.googleapis.com
//
// Auth is Application Default Credentials, resolved the standard way:
//   1. GOOGLE_APPLICATION_CREDENTIALS env var (authorized_user or service_account JSON)
//   2. gcloud well-known file ~/.config/gcloud/application_default_credentials.json
// No credential is ever copied or persisted; access tokens (~1h) live in memory only.
//
// Usage: node vertex-adc-shim.mjs [--port 3457] [--project <id>] [--location global] [--debug]

import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const PORT = Number(flag("port", 3457));
const LOCATION = flag("location", "global");
const DEBUG = args.includes("--debug");

const log = (...a) => console.log(new Date().toISOString(), ...a);
const dbg = (...a) => DEBUG && log("[debug]", ...a);

// ---------- ADC resolution ----------
function adcPath() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return path.join(os.homedir(), ".config", "gcloud", "application_default_credentials.json");
}

function loadCreds() {
  const p = adcPath();
  if (!fs.existsSync(p)) throw new Error(`no ADC credentials at ${p} — run: gcloud auth application-default login`);
  return { creds: JSON.parse(fs.readFileSync(p, "utf8")), source: p };
}

const { creds, source } = loadCreds();
const PROJECT = flag("project", process.env.GOOGLE_CLOUD_PROJECT || creds.quota_project_id);
if (!PROJECT) throw new Error("no project id: pass --project, set GOOGLE_CLOUD_PROJECT, or set an ADC quota project");

// ---------- token cache + refresh ----------
let cached = { token: null, exp: 0 };

async function getToken() {
  if (cached.token && Date.now() < cached.exp - 120_000) return cached.token;
  let body, url;
  if (creds.type === "authorized_user") {
    url = "https://oauth2.googleapis.com/token";
    body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
    }).toString();
  } else if (creds.type === "service_account") {
    // only reachable if GOOGLE_APPLICATION_CREDENTIALS explicitly points at an SA key
    const now = Math.floor(Date.now() / 1000);
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })}`;
    const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(creds.private_key, "base64url");
    url = "https://oauth2.googleapis.com/token";
    body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${sig}`,
    }).toString();
  } else {
    throw new Error(`unsupported ADC credential type: ${creds.type}`);
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  dbg(`token refreshed, expires in ${json.expires_in}s`);
  return cached.token;
}

// ---------- proxy ----------
const agent = new https.Agent({ keepAlive: true, maxSockets: 64 });

function rewritePath(url) {
  // /v1/publishers/google/models/X:method[?query] → full Vertex resource path
  return url.replace(
    /^\/v1(beta1)?\/publishers\//,
    `/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/`
  );
}

const server = http.createServer((req, res) => {
  req.on("error", (e) => dbg("client req error:", e.message));
  res.on("error", (e) => dbg("client res error:", e.message));

  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    let body = Buffer.concat(chunks);
    // Vertex's resource-path endpoint rejects unknown fields; the engine puts a
    // redundant "model" in the body — drop it (the path already names the model).
    try {
      const parsed = JSON.parse(body.toString("utf8"));
      if (parsed && typeof parsed === "object" && "model" in parsed) {
        delete parsed.model;
        body = Buffer.from(JSON.stringify(parsed));
      }
    } catch {
      /* non-JSON (e.g. GET) → forward as-is */
    }

    let token;
    try {
      token = await getToken();
    } catch (e) {
      log("ADC ERROR:", e.message);
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { code: 401, message: `adc-shim: ${e.message}`, status: "UNAUTHENTICATED" } }));
      return;
    }

    const upstreamPath = rewritePath(req.url);
    log(`${req.method} ${req.url} → ${upstreamPath}`);

    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers["content-length"];
    delete headers["x-goog-api-key"]; // placeholder key from gemini-cpa-config.yaml — never forwarded
    headers["authorization"] = `Bearer ${token}`;
    headers["content-length"] = Buffer.byteLength(body);

    const proxied = https.request(
      { host: "aiplatform.googleapis.com", port: 443, method: req.method, path: upstreamPath, headers, agent },
      (upRes) => {
        upRes.on("error", (e) => {
          dbg("upstream stream error:", e.message);
          res.destroy();
        });
        try {
          res.writeHead(upRes.statusCode, upRes.headers);
        } catch (e) {
          log("writeHead failed:", e.message);
          upRes.destroy();
          res.destroy();
          return;
        }
        upRes.pipe(res);
        upRes.on("end", () => dbg(`← ${upRes.statusCode}`));
      }
    );
    proxied.on("error", (err) => {
      log("upstream error:", err.message);
      if (res.writableEnded || res.destroyed) return;
      try {
        if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: 502, message: `adc-shim upstream: ${err.message}` } }));
      } catch {
        res.destroy();
      }
    });
    res.on("close", () => {
      if (!res.writableEnded) {
        dbg("client closed early");
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
process.on("uncaughtException", (err) => log("UNCAUGHT:", err.stack || err.message));
process.on("unhandledRejection", (err) => log("UNHANDLED REJECTION:", err?.stack || String(err)));

server.listen(PORT, "127.0.0.1", () => {
  log(`vertex-adc-shim on http://127.0.0.1:${PORT}`);
  log(`  ADC: ${source} (type=${creds.type})  project=${PROJECT}  location=${LOCATION}`);
});
