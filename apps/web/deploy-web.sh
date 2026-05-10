#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy-web.sh — déploie le build Vite vers le doc root o2switch
#
# Usage (depuis cPanel Terminal) :
#   bash ~/repositories/btp-expert/apps/web/deploy-web.sh
#
# La SPA est servie par Express via express.static('public/'). Ainsi, pas de
# conflit avec Passenger : tout passe par le même process Node.
# ═══════════════════════════════════════════════════════════════════════════
set -e

REPO_DIR="$HOME/repositories/btp-expert"
DEPLOY_DIR="$HOME/intranet.jacobhabitat-dev.fr"
WEB_DIST="$REPO_DIR/apps/web/dist"
PUBLIC_DIR="$DEPLOY_DIR/public"

cd "$REPO_DIR"
echo "→ git pull"
git pull

if [ ! -d "$WEB_DIST" ]; then
  echo "✗ apps/web/dist absent. Build localement (npm run build -w @btp/web), commit, push, puis relance."
  exit 1
fi

echo "→ recopie le dist Vite dans $PUBLIC_DIR"
mkdir -p "$PUBLIC_DIR"
rsync -av --delete "$WEB_DIST/" "$PUBLIC_DIR/"

echo "→ recopie le code serveur (au cas où il y aurait des changements)"
cp -r "$REPO_DIR/apps/server/dist" "$DEPLOY_DIR/apps/server/" 2>/dev/null || true
cp "$REPO_DIR/apps/server/app.js" "$DEPLOY_DIR/apps/server/app.js" 2>/dev/null || true

echo "→ sync deps prod : merge apps/server/package.json -> doc root"
# Garde le package.json doc root mais met à jour les dépendances pour
# être en phase avec apps/server/package.json (sans devDependencies).
node -e "
  const fs = require('fs');
  const path = require('path');
  const root = '$DEPLOY_DIR/package.json';
  const src = '$REPO_DIR/apps/server/package.json';
  const cur = fs.existsSync(root) ? JSON.parse(fs.readFileSync(root, 'utf8')) : {};
  const upstream = JSON.parse(fs.readFileSync(src, 'utf8'));
  cur.name = cur.name || 'btp-server-deploy';
  cur.private = true;
  cur.version = upstream.version || '0.1.0';
  cur.main = 'apps/server/app.js';
  cur.dependencies = upstream.dependencies || {};
  // ne pas écraser scripts perso, mais s'assurer du minimum
  cur.scripts = cur.scripts || {};
  cur.scripts.start = cur.scripts.start || 'node apps/server/app.js';
  fs.writeFileSync(root, JSON.stringify(cur, null, 2));
  console.log('  ✓ deps mises à jour (' + Object.keys(cur.dependencies).length + ' packages)');
" || echo "  ✗ sync package.json a échoué, fix manuel requis"

echo "→ signal restart Passenger"
mkdir -p "$DEPLOY_DIR/tmp"
touch "$DEPLOY_DIR/tmp/restart.txt"

echo "✓ Déploiement web terminé."
echo "→ teste : https://intranet.jacobhabitat-dev.fr/"
