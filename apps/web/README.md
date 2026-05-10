# @btp/web

Web app BatiDesk déployée sur o2switch (intranet.jacobhabitat-dev.fr) — accès depuis téléphone et navigateur.

## Architecture

```
┌─────────────── intranet.jacobhabitat-dev.fr ──────────────┐
│                                                            │
│  Express (Node.js / Passenger sur cPanel)                  │
│   ├─ /api/*      → routes Auth, CRUD, Backup               │
│   └─ /*          → express.static('public/')               │
│                       ↑                                    │
│                       Le build Vite (apps/web/dist/)       │
│                       est copié dans ~/intranet…/public/   │
└────────────────────────────────────────────────────────────┘
```

Pas de `.htaccess` SPA, pas de proxy Apache séparé : **un seul process Node** gère API + SPA. Plus simple à déployer et à débugger.

## Dev local

Le backend doit tourner sur `localhost:3001` (cf `apps/server`). Vite proxy `/api` vers ce port automatiquement.

```bash
# Terminal 1 — backend
npm run dev -w @btp/server

# Terminal 2 — frontend web
npm run dev -w @btp/web
```

Ouvre http://localhost:5174/

## Build + déploiement

### 1. Build local

```bash
npm run build -w @btp/web
```

→ Génère `apps/web/dist/`. Le commit (forcé via `-f` car gitignored par défaut) :

```bash
git add -f apps/web/dist
git commit -m "Build web app"
git push
```

### 2. Déploie sur o2switch (terminal cPanel)

```bash
bash ~/repositories/btp-expert/apps/web/deploy-web.sh
```

→ Pull git, copie `apps/web/dist/*` dans `~/intranet.jacobhabitat-dev.fr/public/`, redémarre Passenger.

### 3. Vérifier

Ouvre https://intranet.jacobhabitat-dev.fr/ — page de login web.

## Pages MVP livrées

- `/login` — connexion (token JWT stocké en localStorage)
- `/` — dashboard (compteurs clients/chantiers/factures)
- `/clients` — liste des clients
- `/chantiers` — liste des chantiers
- `/factures` — liste des factures
- `/sauvegardes` — état + actions sur les backups serveur (run, download, restore, delete)

Layout adaptatif : sidebar desktop, bottom nav mobile.

## À étendre plus tard

- Création/édition de clients, chantiers, factures (uniquement lecture pour l'instant)
- Détail d'une facture avec génération PDF côté serveur
- Gestion des paiements
- Recherche full-text
- Pages devis, vault, agenda, expenses, sous-traitants
