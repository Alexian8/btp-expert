// ═══════════════════════════════════════════════════════════════════════════
// app.js — Entry point Phusion Passenger (cPanel Setup Node.js App)
//
// Pointer Setup Node.js App → Application startup file = apps/server/app.js
// (au lieu d'un app.js proxy à la racine — supprimé pour simplifier).
// ═══════════════════════════════════════════════════════════════════════════

const fs = require("node:fs");
const path = require("node:path");

const DEBUG_LOG = path.resolve(__dirname, "..", "..", "passenger-debug.log");
function log(msg) {
  try {
    fs.appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${msg}\n`);
  } catch {}
}

log("== app.js START ==");
log(`__dirname=${__dirname}`);
log(`cwd=${process.cwd()}`);

try {
  // Charge .env depuis 3 emplacements possibles (cwd, racine doc, dossier app)
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
      stack: initError.stack || null,
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

module.exports = proxy;
