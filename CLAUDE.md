# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

BatiDesk — logiciel de gestion pour artisans du bâtiment (clients, chantiers, devis, factures, dépenses, comptabilité en partie double, banque Qonto, agenda). Distribué en **desktop** (Electron), **web** (auto-hébergée) et **iOS** (natif), à partir d'une seule base de code UI.

> Le code (commentaires, libellés, messages) est rédigé en **français**. Conserver cette langue.

> 🔑 **Règle d'or — tout doit être inter-compatible web / desktop / iOS.** Aucune fonctionnalité ne doit être desktop-only ou web-only. Toute opération de données passe par le contrat partagé (voir [La couche `window.btpAPI`](#la-couche-windowbtpapi-clé-de-la-portabilité)) et doit être exposée côté serveur REST pour que le web ET iOS puissent la consommer. Avant de considérer une fonctionnalité « terminée », vérifier qu'elle fonctionne (ou dégrade proprement) sur les trois plateformes.

## Commandes

Prérequis : Node ≥ 18. Lancer `npm install` à la racine (installe tous les workspaces ; le postinstall recompile `better-sqlite3` pour Electron et build le serveur).

```bash
# Développement
npm run dev                      # app desktop (Vite :5173 + fenêtre Electron)
npm run dev:server               # serveur Express :3001 (tsx watch)
npm run dev -w @btp/web           # SPA web :5174 (proxy /api vers :3001)

# Qualité — exécuter avant de committer
npm run typecheck                # tsc --noEmit sur tous les workspaces
npm run lint                     # ESLint sur tous les workspaces
npm test                         # vitest sur tous les workspaces

# Cibler un workspace ou un seul test
npm run typecheck -w @btp/desktop
npm test -w @btp/core
npx vitest run apps/desktop/src/features/invoices/invoiceEngine.test.ts   # un fichier
npx vitest run -t "nom du test"                                           # par nom

# Build / packaging
npm run build                    # desktop : tsc --noEmit + vite build
npm run build -w @btp/web         # SPA web → apps/web/dist (voir gotcha ci-dessous)
npm run build:server             # serveur → dist/ + copie des PDF CERFA
npm run dist -w @btp/desktop      # installeurs Electron (.exe / .dmg)
```

⚠️ **`apps/web/dist/` est versionné volontairement** — l'app web est hébergée chez **o2switch via cPanel** (Node.js App + Passenger + MySQL), qui ne lance **pas** de build au déploiement et sert directement le `dist/` poussé. Après toute modification de l'UI destinée au web, **rebuild `npm run build -w @btp/web` et committer le `dist/` régénéré** (les assets dans `dist/assets/` sont gitignored → `git add -f`). C'est aussi la cause des conflits de merge récurrents sur `apps/web/dist/` : régénérer le `dist` après merge plutôt que de résoudre à la main.

## Architecture

### Une seule base de code UI, deux plateformes
`apps/desktop/src` **est** l'UI ; c'est la source de vérité pour desktop ET web. `apps/web` ne contient quasiment pas de code propre : son `vite.config.ts` aliase `@` vers `../desktop/src`, donc tous les imports `@/components`, `@/features`, `@/stores`… résolvent dans le source desktop. Conséquence : **toute modification UI dans `apps/desktop/src` impacte aussi le web**. Seuls quelques modules sont overridés pour le web via alias Vite : `@/lib/btpAPI-shim` et `@/lib/sentry`.

### La couche `window.btpAPI` (clé de la portabilité)
L'UI n'accède jamais directement à la base ni au réseau : elle appelle `window.btpAPI.*`. Cet objet est fourni différemment selon la plateforme :
- **Desktop** : le preload Electron expose `window.btpAPI` qui relaie en IPC vers le main process → SQLite (`better-sqlite3`).
- **Web** : `apps/web/src/lib/btpAPI-shim.ts` réimplémente la même surface d'API en `fetch('/api/*')` vers le serveur Express.

Ces deux implémentations honorent le contrat `IDataService` défini dans `packages/core`. **Pour ajouter une opération de données, la propager de bout en bout sur toute la chaîne** : type dans `packages/types` → méthode `IDataService` (`packages/core`) → implémentation desktop (IPC + handler main → SQLite) → route serveur REST (`apps/server/src/routes`) → shim web (`apps/web/src/lib/btpAPI-shim.ts`). L'app **iOS** (`apps/ios`) consomme la même API REST : exposer la route serveur, c'est aussi rendre la fonctionnalité disponible à iOS. **Une fonctionnalité qui marche en desktop mais pas sur web/iOS est généralement un trou dans le shim ou une route REST manquante** (beaucoup sont encore des stubs : PDF, CRUD complet, compta, agenda, coffre-fort).

### State (front)
Stores **Zustand** dans `apps/desktop/src/stores/*` (un par domaine : `clientsStore`, `invoicesStore`, `financeStore`…). Pattern récurrent : `fetch()` peuple le store via `window.btpAPI`, les mutations appellent `window.btpAPI` puis re-`fetch()`. React Query est aussi présent. Les calculs métier vivent dans des moteurs purs et testés (`invoiceEngine.ts`, `quoteEngine.ts`).

### Serveur (`apps/server`)
Express + MySQL (`mysql2`, requêtes paramétrées) + JWT. Le **schéma est auto-créé/migré au démarrage** (`db.ts`, `CREATE TABLE IF NOT EXISTS` — pas de migrations versionnées). Points d'entrée transverses : `auth.ts` (JWT + scrypt), `rbac.ts` (rôles hiérarchiques super_admin > admin > manager > accountant > worker > viewer), `token-revocation.ts` (blacklist au logout/changement de mot de passe), `audit.ts` (journal d'activité), `rate-limit.ts` (buckets **en mémoire** — ne scale pas en multi-instance). Le CRUD générique est dans `routes/crud.ts` ; les domaines spécialisés ont leur route (`accounting`, `qonto`, `vault`, `microsoft`, `admin-*`). Démarrage prod : `app.js` (Passenger/cPanel chez o2switch) ou `node dist/index.js`. Le redémarrage de l'app o2switch se déclenche en touchant `tmp/restart.txt` (script `npm run restart`).

### Comptabilité
Partie double complète (`apps/server/src/accounting`, types dans `packages/types/src/accounting.ts`) : journal, grand livre, balance, compte de résultat, bilan, TVA, export FEC. Les marges par chantier (`ChantierMargin`) sont calculées côté compta et exposées via `financeStore`.

### Sécurité / secrets
Mots de passe en scrypt. Les credentials Qonto sont chiffrés AES-256-GCM (clé dérivée du `JWT_SECRET`) et ne sont jamais renvoyés au front. Config validée par Zod au boot (`config.ts`) ; `JWT_SECRET` doit faire ≥ 32 octets. Variables d'environnement principales du serveur : `JWT_SECRET` (requis), `MYSQL_HOST/USER/PASSWORD/DATABASE`, `CORS_ORIGINS`, `APP_URL`, `PORT`, et optionnelles `MS_*` (Outlook/OneDrive), `SMTP_*` (email), `SENTRY_DSN`. Voir le tableau complet dans `README.md`.

### Premier démarrage
La base est vide : créer le premier administrateur via `POST /api/auth/bootstrap` (one-shot), puis login via `POST /api/auth/login`.

## Workspaces
- `apps/desktop` — Electron + React + Vite : **toute l'UI** (source de vérité).
- `apps/server` — API REST Express + MySQL.
- `apps/web` — SPA web ; réutilise le source desktop, ajoute le shim HTTP. `dist/` versionné.
- `apps/ios` — MVP natif lecture seule (peu maintenu).
- `packages/core` — `IDataService`, logique métier partagée.
- `packages/types` — types TypeScript partagés (modèles métier).
- `packages/ui` — composants UI partagés (Radix + CVA), importés via `@btp/ui`.
