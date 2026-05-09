# 🏗 BTP Expert v16

> Application professionnelle de gestion pour artisans du bâtiment.
> Architecture moderne, multi-plateforme ready, design premium.

---

## 🚀 Démarrage rapide

```bash
npm install
npm run dev
```

L'app se lance sur http://localhost:5173 + fenêtre Electron.

➡️ **Documentation complète** : voir [`INSTALL.md`](./INSTALL.md)

---

## 📚 Documentation

| Fichier | Contenu |
|---|---|
| [`INSTALL.md`](./INSTALL.md) | Installation pas à pas, commandes, dépannage |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Architecture, design system, règles de code |
| [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md) | Plan de migration depuis v15.11 |

---

## 🎨 Stack technique

| Catégorie | Technologie |
|---|---|
| **UI** | React 18 + TypeScript |
| **Build** | Vite 5 |
| **Styling** | Tailwind CSS + CSS Variables |
| **Composants** | Shadcn UI style (Radix + CVA) |
| **State** | Zustand (+ persist) |
| **Data** | React Query |
| **Routing** | React Router v6 |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **Forms** | React Hook Form + Zod |
| **Desktop** | Electron 32 |
| **Database** | SQLite (better-sqlite3) |
| **Monorepo** | npm workspaces |

---

## 📂 Structure

```
btp-v16/
├── apps/
│   └── desktop/        ← App Electron desktop (actuel)
│       Futur :
│       └── web/        ← Next.js (plus tard)
│       └── mobile/     ← Expo React Native (plus tard)
│
└── packages/
    ├── core/           ← Logique métier (IDataService, formatters)
    ├── ui/             ← Composants UI partagés
    └── types/          ← Types TypeScript partagés
```

---

## 🎯 État actuel (v16.0.0-alpha)

✅ **Fait** : Fondations (architecture, design system, auth, router, layouts)
🟠 **En cours** : Migration des features depuis v15.11
📅 **Prévu** : Release 1.0.0 après migration complète

Voir [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) pour le plan détaillé.

---

## 🌍 Multi-plateforme

L'architecture est préparée pour s'étendre à d'autres plateformes :

- ✅ **Desktop** (Windows + macOS via Electron) — actuel
- 🟡 **Web** (via Next.js) — architecture ready
- 🟡 **Mobile** (via Expo React Native) — architecture ready

Grâce à l'interface abstraite `IDataService`, le code métier ne dépend pas d'une plateforme spécifique.

---

## 📜 Licence

Propriétaire — JACOB HABITAT (Alexian JACOB)
