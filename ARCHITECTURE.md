# 🏗 Architecture — BTP Expert v16

## Vision

L'architecture v16 est conçue autour de **3 principes** :

1. **Feature-based organization** : chaque feature métier (auth, chantiers, factures...) a son propre dossier auto-contenu
2. **Séparation UI / Logique / Données** : les composants ne parlent JAMAIS directement à la DB
3. **Multi-plateforme ready** : préparé pour iOS/Web plus tard via l'interface `IDataService`

---

## 📂 Structure des dossiers

```
btp-v16/
│
├── apps/
│   └── desktop/                           ← App Electron desktop
│       ├── electron/
│       │   ├── main.js                    ← Process main Electron
│       │   └── preload.js                 ← Bridge sécurisé vers le renderer
│       │
│       └── src/
│           ├── app/                       ← Configuration de l'app
│           │   ├── layouts/               ← Layouts (AuthLayout, DashboardLayout)
│           │   └── Router.tsx             ← Configuration des routes
│           │
│           ├── components/                ← Composants partagés (non-feature)
│           │   ├── ui/                    ← Primitives Shadcn (Button, Card, Input)
│           │   └── PlaceholderPage.tsx
│           │
│           ├── features/                  ← ⭐ CŒUR DE L'APP
│           │   ├── auth/                  ← Authentification
│           │   │   ├── components/        ← Pages & composants
│           │   │   ├── hooks/             ← useLogin, useLogout
│           │   │   ├── services/          ← authService
│           │   │   └── types/             ← Types locaux
│           │   │
│           │   ├── dashboard/
│           │   ├── clients/
│           │   ├── chantiers/
│           │   ├── invoices/              ← Devis & Factures
│           │   ├── vault/                 ← Coffre-fort
│           │   ├── forms/                 ← Atelier CERFA
│           │   ├── cgv/
│           │   └── settings/
│           │
│           ├── hooks/                     ← Hooks globaux (useTheme, useAuth)
│           ├── lib/                       ← Services globaux (dataService)
│           ├── stores/                    ← Stores Zustand (theme, auth)
│           ├── styles/                    ← CSS global + variables
│           └── types/                     ← Types locaux
│
└── packages/                              ← ⭐ PARTAGEABLE iOS/Web plus tard
    ├── types/                             ← Types métier (Client, Invoice, etc.)
    ├── core/                              ← Logique métier pure
    │   ├── services/
    │   │   └── IDataService.ts            ← Interface abstraite
    │   └── utils/
    │       └── formatters.ts              ← Format currency, date, etc.
    └── ui/                                ← Composants UI partageables
        └── lib/cn.ts                      ← Utility Tailwind merge
```

---

## 🔑 Concept clé : l'interface `IDataService`

**C'est LA pièce qui rend l'app portable** vers web/iOS plus tard.

### Principe

```typescript
// packages/core/src/services/IDataService.ts
export interface IDataService {
  clients: IRepository<Client>;
  chantiers: IRepository<Chantier>;
  invoices: IRepository<Invoice>;
  // ...
}
```

Toute la logique métier **dépend de l'interface**, pas de l'implémentation :

```typescript
// Partout dans l'app React :
import { getDataService } from "@/lib/dataService";

const ds = getDataService();
const clients = await ds.clients.findAll();
```

### Avantages

| Plateforme | Implémentation concrète |
|---|---|
| **Desktop Electron** (aujourd'hui) | `ElectronDataService` → SQLite local |
| **Web** (plus tard) | `ApiDataService` → fetch vers ton backend |
| **Mobile** (plus tard) | `MobileDataService` → SQLite mobile ou API |
| **Tests** | `MockDataService` → données en mémoire |

Le **code React ne change pas**. Seule l'implémentation change.

### Ajouter une nouvelle entité

Quand tu migres une feature depuis v15.11 :

1. Ajouter le type dans `packages/types/src/entities.ts`
2. Ajouter le repository dans `IDataService`
3. Implémenter dans `ElectronDataService` (pour l'instant, MockRepository suffit)
4. Ajouter les handlers IPC dans `electron/main.js`
5. Utiliser dans la feature via `getDataService()`

---

## 🎨 Système de thèmes (Design Tokens)

### Variables CSS

Tout le design est piloté par des variables CSS dans `apps/desktop/src/styles/globals.css` :

```css
:root {
  --background: 0 0% 100%;           /* HSL pour Tailwind */
  --foreground: 222 47% 11%;
  --primary: 217 91% 60%;            /* Accent principal */
  --radius: 0.625rem;                /* Rayon des bordures */
  /* ... */
}
```

### Thèmes

L'utilisateur choisit :
- **Mode** : `light` / `dark` / `system` → toggle classe `.dark` sur `<html>`
- **Accent** : `blue` / `violet` / `emerald` / `amber` / `rose` / `slate` → attribut `data-accent`
- **Radius** : `none` / `sm` / `md` / `lg` / `xl` / `full` → attribut `data-radius`
- **Densité** : `compact` / `normal` / `comfortable` → attribut `data-density`

Géré par `useThemeStore` (Zustand persisté).

### Ajouter un nouveau thème

Ajoute les variables dans `globals.css` :

```css
:root[data-accent="forest"] {
  --primary: 150 60% 40%;
  --ring: 150 60% 40%;
}
:root[data-accent="forest"].dark {
  --primary: 150 60% 50%;
}
```

Ajoute l'option dans `themeStore.ts` et dans les paramètres.

---

## 🧩 Composants UI : règles strictes

### Primitives vs Composés

- **Primitives** (dans `components/ui/`) : Button, Card, Input, Label, Dialog, etc.
  - Copiés depuis Shadcn UI (pas en dépendance, juste du code)
  - Stylés via Tailwind + CVA (class-variance-authority)
  - Accessibilité via Radix UI
  - Jamais de logique métier

- **Composés** (dans `features/X/components/`) : LoginPage, ClientList, InvoiceEditor...
  - Utilisent les primitives
  - Contiennent la logique métier (via hooks)
  - Appellent le dataService via stores/hooks

### Règle des classes Tailwind

Toujours utiliser les **couleurs sémantiques** :

✅ Bon :
```tsx
<div className="bg-card text-card-foreground border-border">
```

❌ Mauvais :
```tsx
<div className="bg-white text-black border-gray-200">
```

### Règle des ombres

Shadcn/Linear style = **ombres très douces** :

✅ Bon : `shadow-soft-sm`, `shadow-soft`, `shadow-soft-md`
❌ Mauvais : `shadow-2xl`, `shadow-black/50`

### Règle des animations

Préférer **Tailwind transitions** pour les micro-interactions (hover, focus), et **Framer Motion** pour :
- Transitions entre pages
- Apparition/disparition de modales
- Animations complexes (réordonnancement, drag)

Les animations doivent être **rapides** (150-300ms) et **subtiles**.

---

## 🔄 Flux de données

```
┌─────────────────────┐
│  Composant React    │  (LoginPage, ClientList, etc.)
└──────────┬──────────┘
           │ useStore()
           ▼
┌─────────────────────┐
│    Store Zustand    │  (authStore, themeStore)
└──────────┬──────────┘
           │ getDataService()
           ▼
┌─────────────────────┐
│  IDataService       │  Interface abstraite
└──────────┬──────────┘
           │ implémenté par
           ▼
┌─────────────────────┐
│ ElectronDataService │  (aujourd'hui)
└──────────┬──────────┘
           │ window.btpAPI (via preload.js)
           ▼
┌─────────────────────┐
│  Electron Main      │  IPC handlers
└──────────┬──────────┘
           │ better-sqlite3
           ▼
┌─────────────────────┐
│   SQLite locale     │
└─────────────────────┘
```

---

## 📚 State Management (Zustand)

### Règles

- **1 store = 1 domaine** (theme, auth, current-session, notifications...)
- Les stores exposent des **actions**, pas juste des setters
- Utiliser `persist` middleware pour ce qui doit survivre au refresh (thème, preferences)
- **PAS de stores gigantesques** (genre 500 lignes) : découper en plusieurs stores

### Exemple de pattern

```typescript
// stores/clientsStore.ts
interface ClientsState {
  clients: Client[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAll: () => Promise<void>;
  create: (data: Omit<Client, "id">) => Promise<Client>;
  update: (id: number, patch: Partial<Client>) => Promise<Client>;
  remove: (id: number) => Promise<void>;
}
```

---

## 🧪 Tests (futur)

Pas encore mis en place. Prévu :
- **Vitest** pour les tests unitaires
- **Testing Library** pour les composants React
- **Playwright** pour les tests E2E

---

## 🎯 Règles de qualité du code

### TypeScript strict

Le projet est en **strict mode**. Pas de `any` (sauf cas exceptionnels avec commentaire explicatif).

### Nommage

- **Composants** : PascalCase (`LoginPage.tsx`, `ClientCard.tsx`)
- **Hooks** : camelCase avec préfixe `use` (`useAuth.ts`, `useClients.ts`)
- **Stores** : camelCase avec suffixe `Store` (`authStore.ts`)
- **Types** : PascalCase (`Client`, `InvoiceLine`)
- **Constantes** : UPPER_SNAKE_CASE (`DEFAULT_PAGE_SIZE`)

### Imports

Ordre :
1. React + libraries externes
2. Packages du monorepo (`@btp/...`)
3. Imports absolus (`@/...`)
4. Imports relatifs (`./...`)

---

## 🚀 Workflow de développement

### Ajouter une feature

1. Créer le dossier `features/ma-feature/`
2. Créer les sous-dossiers `components`, `hooks`, `services`, `types`
3. Ajouter la route dans `app/Router.tsx`
4. Ajouter le lien dans `DashboardLayout.tsx`
5. Ajouter les types dans `packages/types` si nécessaire
6. Ajouter les repositories dans `IDataService` si nouvelle entité
7. Implémenter dans `ElectronDataService`
8. Coder la feature

### Commit convention (recommandé)

```
feat(clients): add client list page
fix(invoices): correct total calculation
refactor(auth): extract login logic to hook
docs: update architecture.md
```

---

## 📖 Ressources

- [Shadcn UI](https://ui.shadcn.com) — Composants de référence
- [Radix UI](https://www.radix-ui.com) — Primitives accessibles
- [Tailwind CSS](https://tailwindcss.com) — Utility-first CSS
- [Zustand](https://zustand-demo.pmnd.rs) — State management
- [Framer Motion](https://www.framer.com/motion) — Animations
- [Electron](https://www.electronjs.org) — Desktop runtime
- [Vite](https://vitejs.dev) — Build tool
