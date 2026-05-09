# 🚀 BTP Expert v16 — Guide d'installation

## 📦 Prérequis

Avant de commencer :

- **Node.js** ≥ 18 (vérifie avec `node -v`)
- **npm** ≥ 9 (vérifie avec `npm -v`)
- **Git** (recommandé pour versionner)
- Windows ou macOS

Si tu n'as pas Node 18+, télécharge-le ici : https://nodejs.org/

---

## 🎯 Installation pas à pas

### Étape 1 — Extraire le projet

Copie le dossier `btp-v16` à l'emplacement de ton choix. Par exemple :

```
C:\Users\Alexi\Documents\btp-v16
```

> 💡 **Important** : Ne copie **PAS** dans le même dossier que `btp-expert` (v15.11). Garde les 2 projets séparés pour pouvoir continuer à utiliser la v15.11 en prod pendant qu'on développe la v16.

### Étape 2 — Ouvrir un terminal dans le dossier

Ouvre PowerShell (Windows) ou Terminal (Mac), puis :

```bash
cd C:\Users\Alexi\Documents\btp-v16
```

### Étape 3 — Installer les dépendances

C'est **la commande la plus importante** :

```bash
npm install
```

Cette commande :
- Installe **toutes les dépendances** de l'app (React, Tailwind, Electron, Shadcn, etc.)
- Configure le **monorepo** (workspaces)
- Compile les **packages partagés** (core, ui, types)
- Prend **5-10 minutes** la première fois (soyez patient ! ☕)

> ⚠️ Si tu as des erreurs `better-sqlite3`, essaie :
> ```bash
> npm install --ignore-scripts
> cd apps/desktop
> npx electron-rebuild -f -w better-sqlite3
> ```

### Étape 4 — Lancer en mode développement

```bash
npm run dev
```

Deux choses se lancent en parallèle :
1. **Vite dev server** sur http://localhost:5173 (React + HMR)
2. **Electron** qui charge Vite

L'application devrait s'ouvrir automatiquement. 🎉

> 💡 À cette étape, tu verras l'écran de login. **Crée ton compte administrateur** lors du premier lancement.

### Étape 5 — Build de production

Pour créer un installer (.exe sur Windows, .dmg sur Mac) :

```bash
# Build pour ta plateforme actuelle
npm run dist

# Ou explicitement :
npm run dist:win       # Windows .exe
npm run dist:mac       # macOS .dmg
```

Le résultat est dans `apps/desktop/dist_electron/`.

---

## 🔧 Commandes disponibles

Depuis la racine du monorepo :

| Commande | Effet |
|---|---|
| `npm run dev` | Lance l'app en mode dev (Vite + Electron) |
| `npm run build` | Compile TypeScript + build Vite |
| `npm run dist` | Build + crée l'installer Electron |
| `npm run dist:win` | Installer Windows uniquement |
| `npm run dist:mac` | Installer macOS uniquement |
| `npm run lint` | Analyse statique (ESLint) |
| `npm run typecheck` | Vérifie les types TypeScript |

---

## 🐛 Dépannage

### "Cannot find module '@btp/core'"

Les packages partagés ne sont pas linkés. Refais :
```bash
npm install
```

### "better-sqlite3 was compiled against a different Node.js version"

Recompile better-sqlite3 pour la version d'Electron :
```bash
cd apps/desktop
npx electron-rebuild -f -w better-sqlite3
```

### L'app se lance mais reste blanche

Vérifie la console (F12). Si tu vois une erreur `Failed to fetch`, Vite n'est pas encore démarré. Attends 5 secondes et recharge avec `Ctrl+R`.

### Port 5173 déjà utilisé

Quelqu'un utilise déjà ce port. Change-le dans `apps/desktop/vite.config.ts` → `server.port`.

---

## 📂 Structure du projet

```
btp-v16/
├── package.json                    ← Configuration monorepo
├── apps/
│   └── desktop/                    ← Application Electron desktop
│       ├── electron/               ← Process main Electron (main.js, preload.js)
│       ├── src/
│       │   ├── app/                ← Layouts, routes
│       │   ├── components/         ← Composants UI partagés app
│       │   ├── features/           ← Features métier (auth, dashboard, clients, ...)
│       │   ├── hooks/              ← Custom hooks
│       │   ├── lib/                ← Services (dataService, etc.)
│       │   ├── stores/             ← Stores Zustand
│       │   ├── styles/             ← CSS global
│       │   └── types/              ← Types locaux
│       ├── index.html
│       ├── package.json
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       └── vite.config.ts
└── packages/
    ├── core/                       ← Logique métier partagée (IDataService, formatters)
    ├── ui/                         ← Helpers UI partagés (cn, etc.)
    └── types/                      ← Types TypeScript partagés
```

---

## 🎨 Personnalisation du thème

Dans l'app, va dans **Paramètres > Apparence** (à implémenter) pour changer :
- **Mode** : clair / sombre / système
- **Couleur d'accent** : bleu / violet / émeraude / ambre / rose / ardoise
- **Rayons** : aucun / petit / moyen / grand / pilule
- **Densité** : compact / normal / confortable

Tout est géré via **CSS variables** dans `apps/desktop/src/styles/globals.css`.

---

## 🚀 Prochaines étapes

Cette v16.0 est le **squelette fonctionnel**. Les features seront migrées depuis v15.11 une par une. Liste prévisionnelle :

- [ ] Session 2 : Clients + Fournisseurs (CRUD)
- [ ] Session 3 : Chantiers
- [ ] Session 4-5 : Devis / Factures
- [ ] Session 6 : Coffre-fort
- [ ] Session 7 : Agenda
- [ ] Session 8+ : Tout le reste

Pendant ce temps, **continue à utiliser v15.11 en production** pour ton activité BTP.

---

## 💡 Pour rendre compatible Web / iOS / Android plus tard

L'architecture est **déjà préparée** :

1. **Interface IDataService** (dans `packages/core`) — c'est le point d'abstraction entre l'app React et la couche données. Aujourd'hui implémentée par `ElectronDataService` (SQLite local). Demain tu peux la remplacer par :
   - `ApiDataService` (backend REST/GraphQL)
   - `SupabaseDataService` (backend-as-a-service)
   - `IndexedDBDataService` (pour PWA offline)

2. **Composants UI** (`packages/ui`) — réutilisables sur React Native, Next.js, etc. (avec de petites adaptations).

3. **Types métier** (`packages/types`) — identiques sur toutes les plateformes.

Pour faire une version web plus tard :
```bash
# Créer une app web dans le monorepo
mkdir apps/web
cd apps/web
# Créer un projet Next.js avec la même couche UI/core/types
```

Pour faire une version mobile plus tard :
```bash
# Créer une app mobile dans le monorepo
mkdir apps/mobile
# Créer un projet Expo avec React Native
```

Les **packages/core, ui, types** seront partagés entre toutes les apps.

---

✅ **Si tu suis ces étapes, tu as une v16 fonctionnelle en 10 minutes.**
