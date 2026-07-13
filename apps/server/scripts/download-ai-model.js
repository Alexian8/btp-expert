#!/usr/bin/env node
/* eslint-disable no-console */
// ═══════════════════════════════════════════════════════════════════════════
// download-ai-model.js — télécharge le modèle GGUF de l'assistant IA locale
//
// À lancer UNE FOIS sur le serveur (SSH o2switch) ou en local :
//
//   node apps/server/scripts/download-ai-model.js [dossier-destination]
//   node apps/server/scripts/download-ai-model.js --url <url-gguf> [dossier]
//
// Par défaut : Qwen2.5-1.5B-Instruct quantifié Q4_K_M (~1 Go), un bon
// compromis qualité/vitesse pour l'inférence CPU sur mutualisé. Pour un
// serveur plus lent, préférer la variante 0.5B (--url ci-dessous).
//
// Le script affiche à la fin la ligne AI_MODEL_PATH=… à copier dans le .env
// du serveur (puis redémarrer l'app Node : cPanel → Restart).
//
// Zéro dépendance : https natif, suit les redirections (Hugging Face → CDN).
// ═══════════════════════════════════════════════════════════════════════════

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const https = require("node:https");

const DEFAULT_URL =
  "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf";
// Variante plus légère si le serveur est trop lent (~400 Mo) :
//   https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf

function parseArgs(argv) {
  const args = { url: DEFAULT_URL, destDir: path.join(os.homedir(), "ai-models") };
  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--url") {
      args.url = argv[++i];
      if (!args.url) {
        console.error("--url attend une URL de fichier .gguf");
        process.exit(1);
      }
    } else {
      rest.push(argv[i]);
    }
  }
  if (rest[0]) args.destDir = path.resolve(rest[0]);
  return args;
}

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(0) + " Mo";
}

/** GET avec suivi de redirections (max 10) — Hugging Face redirige vers son CDN. */
function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 10) {
      reject(new Error("Trop de redirections"));
      return;
    }
    https
      .get(url, { headers: { "User-Agent": "batidesk-ai-model-downloader" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(get(new URL(res.headers.location, url).toString(), redirects + 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} sur ${url}`));
          return;
        }
        resolve(res);
      })
      .on("error", reject);
  });
}

async function main() {
  const { url, destDir } = parseArgs(process.argv);
  const fileName = decodeURIComponent(new URL(url).pathname.split("/").pop() || "model.gguf");
  if (!fileName.endsWith(".gguf")) {
    console.error(`L'URL ne pointe pas vers un fichier .gguf : ${fileName}`);
    process.exit(1);
  }
  const destPath = path.join(destDir, fileName);

  if (fs.existsSync(destPath)) {
    console.log(`✅ Le modèle existe déjà : ${destPath}`);
    console.log(`\nDans le .env du serveur :\n  AI_MODEL_PATH=${destPath}\n`);
    return;
  }

  fs.mkdirSync(destDir, { recursive: true });
  const tmpPath = destPath + ".part";

  console.log(`Téléchargement de ${fileName}`);
  console.log(`  depuis : ${url}`);
  console.log(`  vers   : ${destPath}\n`);

  const res = await get(url);
  const total = Number(res.headers["content-length"]) || 0;
  let done = 0;
  let lastLog = 0;

  const out = fs.createWriteStream(tmpPath);
  res.on("data", (chunk) => {
    done += chunk.length;
    const now = Date.now();
    if (now - lastLog > 2000) {
      lastLog = now;
      const pct = total ? ` (${((done / total) * 100).toFixed(0)} %)` : "";
      console.log(`  … ${formatMB(done)}${total ? " / " + formatMB(total) : ""}${pct}`);
    }
  });

  await new Promise((resolve, reject) => {
    res.pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
    res.on("error", reject);
  });

  if (total && done !== total) {
    fs.rmSync(tmpPath, { force: true });
    throw new Error(`Téléchargement incomplet (${formatMB(done)} / ${formatMB(total)}) — relancez le script`);
  }
  fs.renameSync(tmpPath, destPath);

  console.log(`\n✅ Modèle téléchargé : ${destPath} (${formatMB(done)})`);
  console.log(`\nÉtapes suivantes :`);
  console.log(`  1. Ajouter dans le .env du serveur :\n       AI_MODEL_PATH=${destPath}`);
  console.log(`  2. Vérifier que node-llama-cpp est installé : npm install --omit=dev`);
  console.log(`  3. Redémarrer l'app Node (cPanel → Restart, ou npm run restart)`);
  console.log(`  4. Vérifier dans BatiDesk : Paramètres → IA locale → Lancer un test`);
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
});
