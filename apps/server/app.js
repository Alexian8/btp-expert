// ═══════════════════════════════════════════════════════════════════════════
// app.js — Entry point Phusion Passenger (cPanel Setup Node.js App)
//
// cPanel/o2switch démarre cette app via Passenger qui lit le port et le
// chemin depuis l'env. Ne PAS appeler app.listen() ici : il faut juste
// EXPORTER l'app Express (Passenger gère le binding).
//
// Comment cPanel exécute ce fichier :
//   1. Le user crée une "Setup Node.js App" pointant vers ce dossier
//   2. cPanel installe les dépendances (npm install) et compile (npm run build)
//   3. Au démarrage, Passenger require()'er ce fichier — il s'attend à un export
// ═══════════════════════════════════════════════════════════════════════════

require("dotenv/config");

// Charge le code TypeScript compilé. `npm run build` produit dist/.
const { loadConfig } = require("./dist/config");
const { createApp } = require("./dist/app");

const cfg = loadConfig();

// Passenger n'attend pas une promise — on initialise de manière synchrone
// et on attache l'app dès que prête. En cas d'erreur, on logge.
let cachedApp = null;
let initError = null;

const initPromise = createApp(cfg).then(({ app }) => {
  cachedApp = app;
}).catch((e) => {
  initError = e;
  console.error("[passenger] Échec init createApp:", e);
});

// Petit middleware d'attente : tant que createApp n'a pas résolu,
// on répond 503. Évite les 500 mystérieux au démarrage à froid.
module.exports = function (req, res, next) {
  if (cachedApp) return cachedApp(req, res, next);
  if (initError) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Server init failed", error: String(initError) }));
    return;
  }
  initPromise.then(() => {
    if (cachedApp) cachedApp(req, res, next);
    else {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ message: "Server is starting…" }));
    }
  });
};
