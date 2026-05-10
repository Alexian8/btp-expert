// ═══════════════════════════════════════════════════════════════════════════
// app.js — Entry point Phusion Passenger (cPanel Setup Node.js App)
//
// Stratégie : on exporte IMMÉDIATEMENT une mini-app Express qui répond 503
// pendant le cold-start, puis on swap vers la vraie app dès que createApp()
// résout. Cela évite que Passenger hang sur la première requête.
// ═══════════════════════════════════════════════════════════════════════════

require("dotenv/config");
const path = require("node:path");
const express = require("express");

// Charge un .env depuis le dossier de l'app si dotenv ne l'a pas trouvé via cwd
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const { loadConfig } = require("./dist/config");
const { createApp } = require("./dist/app");

let realApp = null;
let initError = null;

const proxy = express();
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

// Init en arrière-plan
(async () => {
  try {
    const cfg = loadConfig();
    const { app } = await createApp(cfg);
    realApp = app;
    console.log("[passenger] ✅ App initialized");
  } catch (e) {
    initError = e;
    console.error("[passenger] ✗ Init failed:", e && e.stack ? e.stack : e);
  }
})();

module.exports = proxy;
