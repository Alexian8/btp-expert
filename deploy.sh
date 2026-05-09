#!/bin/bash
# Script de déploiement manuel pour o2switch / cPanel
# Usage : bash ~/repositories/btp-expert/deploy.sh
set -e

REPO_DIR="$HOME/repositories/btp-expert"
DEPLOY_DIR="$HOME/intranet.jacobhabitat-dev.fr"

echo "─── Déploiement BatiDesk ──────────────────────────"
echo "  source : $REPO_DIR"
echo "  cible  : $DEPLOY_DIR"

cd "$REPO_DIR"
echo ""
echo "→ git pull..."
git pull

echo ""
echo "→ rsync vers $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR"
rsync -av --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist_electron' \
  --exclude='apps/desktop' \
  ./ "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"

echo ""
echo "→ npm install (workspaces)..."
npm install --omit=dev --workspaces --include-workspace-root

echo ""
echo "→ build du serveur TypeScript..."
npm run build -w @btp/server

echo ""
echo "→ signal restart Passenger..."
mkdir -p tmp
touch tmp/restart.txt

echo ""
echo "✓ Déploiement terminé."
