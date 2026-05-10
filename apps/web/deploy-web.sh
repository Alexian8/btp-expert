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

echo "→ signal restart Passenger"
mkdir -p "$DEPLOY_DIR/tmp"
touch "$DEPLOY_DIR/tmp/restart.txt"

echo "✓ Déploiement web terminé."
echo "→ teste : https://intranet.jacobhabitat-dev.fr/"
