# 🌐 Plan de migration : Desktop → Web/Serveur

> But : permettre à BatiDesk de tourner **soit en local (SQLite + Electron)
> soit en mode serveur (Express + DB partagée)** sans changer une ligne du code
> des 22 features.

## Pourquoi c'est possible aujourd'hui

L'architecture repose sur l'interface `IDataService` ([packages/core/src/services/IDataService.ts](packages/core/src/services/IDataService.ts)).
Tous les écrans React passent par cette interface — jamais par `window.btpAPI`,
`fetch` ou `better-sqlite3` en direct.

Il suffit donc d'avoir **deux implémentations** et un **aiguilleur** :

```
                       ┌─────────────────────┐
   features/* (UI)  →  │   IDataService      │
                       └──────────┬──────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                ▼                                   ▼
      ElectronDataService                    ApiDataService
      (SQLite via IPC, local)            (HTTP REST, distant)
      apps/desktop/src/lib/dataService.ts   packages/core/src/services/ApiDataService.ts
```

L'aiguilleur : [apps/desktop/src/lib/dataServiceFactory.ts](apps/desktop/src/lib/dataServiceFactory.ts).

## Architecture cible

```
┌─────────────────────────────────────────────────────────────────┐
│                    Serveur (Linux/VPS)                          │
│                                                                  │
│   ┌────────────────┐      ┌─────────────────┐                   │
│   │  apps/server   │ ──→  │ batidesk.db     │  (SQLite WAL)     │
│   │  Express + JWT │      │ + dossier vault │                   │
│   └────────┬───────┘      └─────────────────┘                   │
│            │ HTTPS (Caddy/Nginx + Let's Encrypt)                │
│            │                                                     │
└────────────┼─────────────────────────────────────────────────────┘
             │
   ┌─────────┼──────────┐
   ▼         ▼          ▼
 Desktop   Web App    Mobile (futur)
 Electron  Vite SPA   React Native
 (pareil)  (à créer)  (à créer)
```

## Étapes (incrémentales — chaque étape laisse l'app fonctionnelle)

### ✅ Étape 0 — Fondations (FAIT)
- `IDataService` + `MockRepository` + `ElectronDataService`
- `ApiDataService` côté `@btp/core` (client HTTP générique)
- `DataServiceFactory` qui aiguille selon `VITE_USE_REMOTE_API`
- Squelette `apps/server` (Express + SQLite + JWT) avec routes `auth`, `clients`, `fournisseurs`, `chantiers`, `settings`
- Tests : `npm test -w @btp/core` et `npm test -w @btp/server`

### Étape 1 — Compléter le serveur (1-2 jours)
Pour chaque ressource encore manquante côté `apps/server` :
- Ajouter table SQL dans [apps/server/src/db.ts](apps/server/src/db.ts) `runMigrations()`
- Brancher un `SqliteRepository` + `buildCrudRouter` dans [apps/server/src/app.ts](apps/server/src/app.ts)
- Tests d'intégration dans `app.test.ts`

Ressources restantes : `invoices`, `quotes`, `vault`, `cgvClauses`, `chantierClauses`, `agendaEvents`, `expenses`, `expenseNotes`, `subcontractors`, `purchaseOrders`, `situations`, `administrativeDocs`.

### Étape 2 — Endpoints non-CRUD (3-5 jours)
- `/api/stats/*` — agrégats finance, pipeline, retards (passer par des views SQL)
- `/api/backup/export` et `/api/backup/import` — déjà appelés par `ApiDataService`, à câbler
- `/api/external/sirene` et `/api/external/ban` — proxy serveur (évite CORS et cache les SIRET)

### Étape 3 — Migration de la donnée Electron → serveur (1 jour)
Petit script `apps/server/scripts/import-from-desktop.ts` :
1. Lit le fichier `.btpbackup` exporté depuis l'app desktop
2. Extrait la DB SQLite
3. La copie au chemin `DATABASE_PATH` du serveur
   → comme c'est le **même format de tables**, ça marche tel quel.

### Étape 4 — Web app (2-3 semaines)
Créer `apps/web` :
- Vite + React (le code des features est déjà 100% web-compatible)
- Reprendre tous les composants de `apps/desktop/src/features/*` quasi tels quels
- Remplacer `getDataService()` par `new ApiDataService({ baseUrl: API_URL, … })` directement (pas besoin du factory côté web — c'est toujours en mode serveur)
- Brancher l'auth sur le store Zustand existant

### Étape 5 — Déploiement (1 jour)
- `apps/server` → conteneur Docker, derrière Caddy (HTTPS auto)
- `apps/web` → bucket statique (Cloudflare Pages, Netlify, ou même Caddy)
- Backups DB → cron `sqlite3 .backup` quotidien + push vers OneDrive/S3

### Étape 6 — Synchro hors-ligne (optionnel, plus tard)
- L'app desktop continue d'exister pour le mode 100% local
- Mode hybride : SQLite local + sync delta avec le serveur via une table `sync_log`
- Hors scope court-terme.

## Ce qu'il faut éviter

- ❌ Faire `fetch()` ou `window.btpAPI` directement depuis une feature → casse la portabilité.
- ❌ Stocker des chemins absolus de fichiers dans la DB → ne marchera pas en web.
- ❌ Mettre des secrets côté client (Vite expose `VITE_*` dans le bundle final !).
  → Tout secret doit vivre dans `apps/server/.env` uniquement.

## Vérification rapide

Quand vous touchez à une feature, posez-vous :

1. Est-ce que ça passe par `getDataService()` ? → ✅
2. Est-ce que ça utilise `fs`, `path`, `child_process`, `electron` ? → ❌ à isoler côté Electron uniquement.
3. Est-ce que ça stocke des données dans `localStorage` ? → ⚠️ OK pour préférences UI, JAMAIS pour données métier.

## État courant

| Composant                          | État       |
|-----------------------------------|------------|
| `IDataService` (contrat)           | ✅ stable  |
| `ElectronDataService`              | ✅ partiel (en cours migration v15→v16) |
| `ApiDataService` (client HTTP)     | ✅ prêt + testé |
| `DataServiceFactory`               | ✅ prêt    |
| `apps/server` (squelette)          | ✅ démarrable, 3 ressources branchées |
| Migration features serveur         | 🚧 à faire |
| `apps/web`                         | 🚧 pas créé |
| Déploiement                        | 🚧 pas commencé |

## Tests

```bash
# Tests unitaires + intégration
npm test --workspaces --if-present

# Lancer le serveur en dev
npm run dev -w @btp/server

# Lancer le desktop en mode serveur (après avoir mis VITE_USE_REMOTE_API=true)
npm run dev -w @btp/desktop
```
