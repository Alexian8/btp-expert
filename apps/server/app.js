// ═══════════════════════════════════════════════════════════════════════════
// app.js — Entry point Phusion Passenger (cPanel Setup Node.js App)
//
// IMPORTANT cPanel/o2switch :
//   - Passenger fournit un PORT via env, on doit faire app.listen(port)
//   - On exporte le handler pour les Phusion Passenger Apache classiques aussi
// ═══════════════════════════════════════════════════════════════════════════

const fs = require("node:fs");
const path = require("node:path");

const DEBUG_LOG = path.resolve(__dirname, "..", "..", "passenger-debug.log");
function log(msg) {
  try {
    fs.appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${msg}\n`);
  } catch {}
}

process.on("uncaughtException", (e) => {
  log(`uncaughtException: ${e && e.message}\n${e && e.stack}`);
});
process.on("unhandledRejection", (e) => {
  log(`unhandledRejection: ${e && e.message ? e.message : e}\n${e && e.stack ? e.stack : ""}`);
});

log("== app.js START ==");
log(`__dirname=${__dirname}`);
log(`cwd=${process.cwd()}`);
log(`PORT env=${process.env.PORT || "(not set)"}`);
log(`PASSENGER_PORT env=${process.env.PASSENGER_PORT || "(not set)"}`);

try {
  const dotenv = require("dotenv");
  for (const candidate of [
    path.resolve(__dirname, "..", "..", ".env"),
    path.resolve(__dirname, ".env"),
    path.resolve(process.cwd(), ".env"),
  ]) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      log(`dotenv loaded from ${candidate}`);
      break;
    }
  }
} catch (e) {
  log(`dotenv error: ${e.message}`);
}

// Sentry must be initialized before any module that loads express/http.
try {
  require("./dist/instrument");
  log("sentry instrument loaded");
} catch (e) {
  log(`sentry instrument skipped: ${e && e.message}`);
}

const express = require("express");
const proxy = express();

let realApp = null;
let initError = null;

proxy.use((req, res, next) => {
  if (realApp) return realApp(req, res, next);
  if (initError) {
    res.status(500).json({
      message: "Server init failed",
      error: initError.message || String(initError),
    });
    return;
  }
  res.status(503).json({ message: "Server is starting…" });
});

(async () => {
  try {
    log("loading dist/config…");
    const { loadConfig } = require("./dist/config");
    log("loading dist/app…");
    const { createApp } = require("./dist/app");
    log("loadConfig…");
    const cfg = loadConfig();
    log("createApp…");
    const { app } = await createApp(cfg);
    realApp = app;
    log("✅ App initialized");
  } catch (e) {
    initError = e;
    log(`✗ Init failed: ${e && e.message}`);
    log(e && e.stack ? e.stack : "");
  }
})();

// Sur cPanel/Passenger Node, on DOIT faire listen() sur le port fourni par
// le hosting (Passenger reverse-proxy vers ce port).
const port = Number(process.env.PORT || process.env.PASSENGER_PORT || 3000);
const server = proxy.listen(port, () => {
  log(`listening on port ${port}`);
});
server.on("error", (e) => log(`server error: ${e.message}`));

module.exports = proxy;
