# 🔄 Guide de Migration v15.11 → v16

## Principe directeur

La v16 est une **refonte totale** basée sur une architecture moderne. Les features de v15.11 seront migrées **une par une**, dans un ordre logique, en respectant la nouvelle structure.

**Pendant la migration** : tu continues d'utiliser v15.11 en production pour ton activité BTP. La v16 est en développement en parallèle, et progressivement elle prendra le relais.

---

## 📋 Ordre de migration recommandé

### Phase 1 — Fondations ✅ **FAIT dans cette session**
- [x] Monorepo + TypeScript + Vite + Electron
- [x] Design system + thèmes (variables CSS, dark/light, 6 accents)
- [x] Composants UI primitifs (Button, Card, Input, Label)
- [x] Stores Zustand (theme, auth)
- [x] Router React Router
- [x] Layouts (Auth, Dashboard)
- [x] Page Login (avec setup 1er user)
- [x] Page Dashboard (placeholder)

### Phase 2 — Core métier (sessions 2-4)
- [ ] **Session 2** : Clients (CRUD + recherche + tri)
- [ ] **Session 3** : Fournisseurs (similaire aux clients)
- [ ] **Session 4** : Chantiers (CRUD + vue détaillée)

### Phase 3 — Facturation (sessions 5-7)
- [ ] **Session 5** : Devis/Factures — Liste + création
- [ ] **Session 6** : Devis/Factures — Éditeur (lignes, totaux, TVA)
- [ ] **Session 7** : Devis/Factures — Génération PDF

### Phase 4 — Documents (sessions 8-10)
- [ ] **Session 8** : Coffre-fort (upload, catégories, recherche)
- [ ] **Session 9** : Atelier Formulaires (CERFA)
- [ ] **Session 10** : CGV (éditeur + bibliothèque de clauses)

### Phase 5 — Features avancées (sessions 11-15)
- [ ] **Session 11** : Agenda
- [ ] **Session 12** : Déplacements + Frais annexes
- [ ] **Session 13** : Sous-traitants + Stocks + Actifs
- [ ] **Session 14** : Dashboard avancé (widgets, graphiques)
- [ ] **Session 15** : Paramètres complets

### Phase 6 — Polish & migration données (sessions 16-18)
- [ ] **Session 16** : Script de migration DB v15 → v16
- [ ] **Session 17** : Tests de régression
- [ ] **Session 18** : Polish UI + fix bugs + release 1.0.0

---

## 🛠 Méthode pour migrer une feature

Pour chaque feature, suivre **ce template** :

### 1. Analyser la feature dans v15.11

Dans `btp-expert/src/App.jsx`, trouver :
- Le composant principal (ex: `ClientsView`)
- Les composants liés (ex: `ClientEditor`, `ClientCard`)
- Les handlers IPC backend (dans `electron.js`)
- Les types de données utilisés

### 2. Créer la structure dans v16

```bash
mkdir -p apps/desktop/src/features/NOM_FEATURE/{components,hooks,services,types}
```

### 3. Migrer les types

Dans `packages/types/src/entities.ts`, vérifier que le type existe (sinon l'ajouter).

### 4. Implémenter dans `IDataService`

**Si ce n'est pas déjà fait**, ajouter le repository :

```typescript
// packages/core/src/services/IDataService.ts
export interface IDataService {
  // ...
  maFeature: IRepository<MaEntite>;
}
```

### 5. Brancher le repository SQLite

Dans `apps/desktop/src/lib/dataService.ts`, remplacer le `MockRepository` par une vraie implémentation SQLite :

```typescript
class SQLiteClientRepository implements IRepository<Client> {
  async findAll() {
    return window.btpAPI.invoke("clients:findAll");
  }
  // ...
}
```

Ajouter les handlers IPC dans `electron/main.js`.

### 6. Créer les composants React

Dans `features/NOM_FEATURE/components/` :
- `NomFeaturePage.tsx` — Page principale (liste)
- `NomFeatureEditor.tsx` — Modal/page d'édition
- `NomFeatureCard.tsx` — Carte individuelle

**Règles** :
- Utiliser les composants UI de `components/ui/`
- Utiliser le dataService, jamais `window.btpAPI` directement
- Animer les apparitions avec Framer Motion
- Responsive (grid 1 col mobile, 2-3 cols desktop)

### 7. Ajouter la route

Dans `apps/desktop/src/app/Router.tsx` :

```typescript
{
  path: "ma-feature",
  element: <MaFeaturePage />,
}
```

Et le lien dans `DashboardLayout.tsx`.

### 8. Tester

```bash
npm run dev
```

Cliquer sur le lien dans la sidebar, tester les CRUD.

---

## 🎨 Traduction des styles v15.11 → v16

Les classes v15.11 (`bg-[#16181f]`, `text-slate-400`) doivent être remplacées par des **couleurs sémantiques** :

| v15.11 (hardcoded) | v16 (sémantique) |
|---|---|
| `bg-[#16181f]` | `bg-card` |
| `bg-[#0a0c10]` | `bg-background` |
| `border-[#2a2d38]` | `border-border` |
| `text-white` | `text-foreground` |
| `text-slate-400` | `text-muted-foreground` |
| `text-blue-400` | `text-primary` |
| `hover:bg-[#2a2d38]` | `hover:bg-accent` |
| `shadow-xl shadow-black/20` | `shadow-soft-md` |

**Avantage** : le thème (clair/sombre, couleur d'accent) s'adapte automatiquement.

---

## 📦 Migration des données

Quand la v16 sera stable, on créera un **script one-shot** qui :

1. Lit la base SQLite v15.11 dans `C:\Users\Alexi\AppData\Roaming\btp-expert\`
2. Transforme les données au nouveau schéma v16 (si différent)
3. Écrit dans la nouvelle DB v16 `C:\Users\Alexi\AppData\Roaming\btp-v16\`

Les tables qui changent de schéma seront migrées, les autres copiées telles quelles.

---

## ⚠ Pièges à éviter

### ❌ Tenter de copier-coller App.jsx de v15.11

Ne pas copier les gros composants tels quels. **Découper** en plus petits morceaux.

### ❌ Utiliser `window.btpAPI` directement dans les composants

Toujours passer par le dataService → permet de remplacer SQLite par une API plus tard.

### ❌ Hardcoder les couleurs

Utiliser **uniquement** les couleurs sémantiques (`bg-card`, `text-foreground`, etc.).

### ❌ Oublier le responsive

Les composants v16 doivent marcher à la fois sur desktop large (1920px) ET sur écran plus petit (1100px min).

### ❌ Ignorer les types

Chaque prop de composant doit avoir une interface TypeScript explicite.

---

## 🎯 Quand est-ce qu'on est à 1.0.0 ?

La v16.0.0 sera considérée **stable** quand :

- [x] L'app se lance sans erreur
- [x] Login/setup fonctionnel
- [ ] Toutes les features de v15.11 sont migrées
- [ ] Les données peuvent être migrées de v15.11 vers v16
- [ ] Les tests de régression passent
- [ ] La documentation est à jour
- [ ] Build .exe Windows fonctionne
- [ ] Build .dmg Mac fonctionne (optionnel)

**Estimation** : 15-20 sessions à partir d'aujourd'hui.

---

## 📞 Besoin d'aide ?

Si tu bloques sur une feature, dans la prochaine session dis-moi :

> "Je migre la feature X de v15.11. Voici le code actuel : [paste]. Peux-tu me montrer comment le refaire en v16 ?"

Et je te guide pas à pas.
