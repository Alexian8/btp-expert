// ═══════════════════════════════════════════════════════════════════════════
// app.js (racine du monorepo) — Proxy vers apps/server/app.js
//
// Permet à Phusion Passenger (cPanel Setup Node.js App) de démarrer le serveur
// sans avoir à pointer vers un sous-dossier. Comme ça, l'Application Root du
// Setup Node.js App = la racine du sous-domaine (où npm install monorepo).
// ═══════════════════════════════════════════════════════════════════════════

module.exports = require("./apps/server/app.js");
