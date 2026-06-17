# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

BatiDesk — logiciel de gestion pour artisans du bâtiment (clients, chantiers, devis, factures, dépenses, comptabilité en partie double, banque Qonto, agenda). Distribué en **desktop** (Electron), **web** (auto-hébergée) et **iOS** (natif), à partir d'une seule base de code UI.

> Le code (commentaires, libellés, messages) est rédigé en **français**. Conserver cette langue.

> 🔑 **Règle d'or — tout doit être inter-compatible web / desktop / iOS.** Aucune fonctionnalité ne doit être desktop-only, web-only, ni inaccessible sur iOS. Toute opération de données passe par le contrat partagé (voir [La couche `window.btpAPI`](#la-couche-windowbtpapi-clé-de-la-portabilité)) et doit être exposée côté serveur REST pour que le web ET iOS puissent la consommer. Avant de considérer une fonctionnalité « terminée », vérifier qu'elle fonctionne sur les trois plateformes. **L'app iOS ne doit PAS rester en lecture seule** : viser la parité CRUD avec desktop/web (voir [Limitations & direction produit](#limitations-connues--direction-produit)).

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

## Conventions

### UI responsive — « visible sur tous les supports »
La version **web doit être utilisable sur mobile, tablette et desktop** (le desktop Electron reste large écran). Les vues de liste suivent le pattern : **cartes empilées en mobile (`md:hidden`) + tableau en desktop (`hidden md:block`)** — reproduire ce double rendu pour toute nouvelle liste. Penser tactile (cibles ≥ 40 px), `flex-wrap` sur les barres d'outils, pas de largeur fixe.

### Style & helpers (réutiliser, ne pas réinventer)
- Sémantique couleur constante : **emerald** = positif/payé, **rose/red** = retard/erreur, **amber** = en attente/brouillon, **blue/violet** = informatif. Utiliser les tokens Tailwind (`text-muted-foreground`, `bg-card`, `border-border`…) — pas de couleurs en dur hors palette.
- Montants via `formatEuro`/`formatEuros`, dates via `formatDateFR`. Notifications : `toast` (sonner). Animations : `framer-motion`. Icônes : `lucide-react`.
- Composants de base dans `@btp/ui` (Radix + CVA) et `@/components/ui/*` ; réutiliser `ConfirmDialog`, `Button`, `Input`, `NativeSelect`… La logique d'écran vit dans `apps/desktop/src/features/<domaine>/components`.

### Workflow Git
Développer sur une branche `claude/*`, PR vers `main`. Avant commit : `npm run typecheck` + `npm test`. **Avant toute PR touchant l'UI : `npm run build -w @btp/web` puis committer le `dist/` régénéré** (sinon conflits et déploiement o2switch obsolète).

### Tests
Vitest. La logique métier est isolée dans des moteurs purs et testés (`invoiceEngine.ts`, `quoteEngine.ts`) — y placer tout nouveau calcul (totaux, TVA, échéances, marges) et le couvrir par un test. Pas encore d'E2E.

## Limitations connues & direction produit
- **iOS — parité CRUD visée (PAS de lecture seule).** `apps/ios` est aujourd'hui surtout en lecture ; l'objectif est le CRUD complet comme desktop/web, en consommant l'API REST. Toute nouvelle fonctionnalité doit prévoir son accès iOS (route REST + écran).
- **Shim web incomplet** : plusieurs opérations restent des stubs dans `apps/web/src/lib/btpAPI-shim.ts` (export PDF, certains CRUD, compta, agenda, coffre-fort) — à compléter pour tenir la règle d'inter-compatibilité.
- **Qonto** : lecture soldes/transactions OK, **rapprochement bancaire non implémenté**.
- **Pas de migrations versionnées** : le schéma MySQL est (re)créé au démarrage (`db.ts`). Ajouter une colonne = l'ajouter au `CREATE TABLE` / `ALTER` idempotent du démarrage.
- **Rate-limit en mémoire** (`rate-limit.ts`) : ne tient pas en multi-instance.

## Workspaces
- `apps/desktop` — Electron + React + Vite : **toute l'UI** (source de vérité).
- `apps/server` — API REST Express + MySQL.
- `apps/web` — SPA web ; réutilise le source desktop, ajoute le shim HTTP. `dist/` versionné.
- `apps/ios` — app native (objectif parité CRUD, cf. ci-dessus).
- `packages/core` — `IDataService`, logique métier partagée.
- `packages/types` — types TypeScript partagés (modèles métier).
- `packages/ui` — composants UI partagés (Radix + CVA), importés via `@btp/ui`.
