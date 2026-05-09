const { join } = require("path");

/**
 * Puppeteer configuration (pour les commandes npx puppeteer browsers install)
 * Force le téléchargement de Chromium dans le dossier du projet.
 *
 * NOTE : avec puppeteer-core, ce fichier n'est plus utilisé pour résoudre
 * le chemin Chromium à l'exécution. Il sert uniquement pour la CLI
 * `npx puppeteer browsers install chrome` qui télécharge Chromium
 * dans .puppeteer-cache/ au lieu de ~/.cache/puppeteer/.
 *
 * @type {import("puppeteer-core").Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, ".puppeteer-cache"),
};
