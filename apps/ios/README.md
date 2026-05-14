# BatiDesk — application iPhone (SwiftUI)

App iOS native qui reprend **le design et les onglets de la web app BatiDesk**
(`apps/web`). Elle parle au **même backend** Express (`apps/server`) via les
routes REST `/api/*` — exactement comme le shim `window.btpAPI` côté web.

```
apps/
├── desktop/   ← Electron + React
├── server/    ← Express + MySQL  ◄── l'app iOS tape ici aussi
├── web/       ← SPA React (o2switch)
└── ios/       ← ★ cette app — SwiftUI, natif iPhone
```

---

## ⚠️ Prérequis : un Mac

Une app iOS **ne se compile pas sous Windows** — il faut **macOS + Xcode 16
ou plus récent**. Le code a été écrit et structuré sur Windows mais doit être
ouvert, compilé et testé sur un Mac (ou un Mac cloud type MacStadium / un
runner CI macOS).

> Le projet n'a donc **pas pu être compilé ni lancé** depuis l'environnement
> de développement actuel. Première étape côté Mac : ouvrir le projet, lancer
> un build (`⌘B`) et corriger les éventuels avertissements mineurs.

---

## Lancer l'app

1. Sur un Mac, ouvrir `apps/ios/BatiDesk.xcodeproj` avec Xcode 16+.
2. Sélectionner le schéma **BatiDesk** + un simulateur iPhone.
3. `⌘R` pour lancer.
4. Pour un **iPhone physique** : onglet *Signing & Capabilities* du target,
   choisir ton *Team* Apple Developer (le bundle id `fr.jacobhabitat.batidesk`
   peut être modifié librement).

### Si le `.xcodeproj` refuse de s'ouvrir

Le `.xcodeproj` est écrit à la main (format « synchronized groups » d'Xcode 16).
En cas de souci, on le régénère depuis `project.yml` avec
[XcodeGen](https://github.com/yonaskolb/XcodeGen) :

```bash
brew install xcodegen
cd apps/ios
xcodegen generate      # réécrit BatiDesk.xcodeproj proprement
```

---

## Connexion au serveur

- URL par défaut : **`https://intranet.jacobhabitat-dev.fr`** (serveur o2switch
  de production, cf `apps/web/README.md`).
- Modifiable dans l'app : écran de **connexion** (bouton serveur en bas) ou
  **Réglages → Serveur**. Utile pour pointer vers un backend local
  (`http://localhost:3001` — l'app autorise déjà le HTTP local via ATS).
- Le **JWT** renvoyé par `/api/auth/login` est stocké dans le **Keychain** et
  rejoué en `Authorization: Bearer` sur chaque requête. Au démarrage,
  `/api/auth/me` réhydrate la session (pas de re-login forcé).

---

## Onglets (calqués sur la web app)

La sidebar web a 13 entrées ; une TabBar iPhone en tient ~5. On garde les 4
plus utilisées + un onglet **Plus** qui regroupe le reste — convention iOS.

| Onglet iOS         | Équivalent web                        | État |
|--------------------|----------------------------------------|------|
| **Tableau de bord**| `/` dashboard (KPI, alertes)           | ✅ Fonctionnel |
| **Devis & Factures**| `/quotes` `/invoices`                 | ✅ Liste + recherche + détail |
| **Chantiers**      | `/chantiers`                           | ✅ Liste + filtre statut + détail |
| **Clients**        | `/clients`                             | ✅ Liste + recherche + détail |
| **Plus › Fournisseurs** | `/suppliers`                      | ✅ Liste + recherche + détail |
| **Plus › Réglages**| `/settings`                            | ✅ Compte, apparence, serveur, déconnexion |
| Plus › Agenda, Dépenses, Notes de frais, Sous-traitants, Finances, Statistiques, Documents admin, Coffre-fort | routes web correspondantes | 🚧 Écrans *placeholder* — à porter |

Comme la web app, **l'app mobile est en lecture seule pour ce MVP** (création /
édition à venir). Le design suit les mêmes tokens : thème sombre par défaut,
accent bleu, pastilles de statut slate / blue / emerald / amber / rose.

---

## Architecture

```
BatiDesk/
├── App/            BatiDeskApp (entrée), RootContainerView (splash→login→app)
├── Theme/          Theme.swift — port des design tokens de globals.css (HSL)
├── Support/        Format, décodage tolérant, Keychain, LoadPhase,
│                   ResourceListViewModel<T>, ClientDirectory
├── Networking/     APIClient (URLSession + JWT), APIError
├── Models/         User, Client, Supplier, Chantier, Quote, Invoice, StatusMeta
├── Auth/           AuthManager (ObservableObject), LoginView
├── Navigation/     MainTabView — la TabBar
├── Components/     StatusBadge, StatCard, Avatar, StateViews, DetailRow,
│                   ContactActionsBar…
└── Features/       Dashboard / Clients / Chantiers / Invoices / Suppliers /
                    More / Settings
```

Principes (cohérents avec `ARCHITECTURE.md` du monorepo) :

- **Une seule porte d'accès aux données** : `APIClient` (équivalent natif du
  contrat `IDataService` / du shim `btpAPI`). Aucune vue ne fait de `fetch`
  direct.
- **Décodage tolérant** (`Support/DecodingHelpers.swift`) : MySQL via mysql2
  renvoie les `DECIMAL` en `String` et certaines colonnes en `null` — les
  helpers `str` / `dbl` / `intVal` / `boolVal` encaissent ça sans planter.
- **Modèles partagés** : les structs Swift reprennent les types de
  `packages/types` (Client, Chantier, Quote, Invoice…).
- **Thème** : `Theme.swift` reconstruit chaque token HSL de
  `apps/desktop/src/styles/globals.css` en couleur claire **et** sombre ;
  bascule Clair / Sombre / Système dans les Réglages (sombre par défaut,
  comme le web).

---

## Pistes pour la suite

- Porter les écrans *placeholder* (Agenda, Dépenses, Finances, etc.).
- Passer en lecture **+ écriture** (création/édition clients, chantiers,
  devis…) — l'`APIClient` a déjà `rawRequest` POST/PATCH/DELETE prêt.
- Affichage / partage des PDF de devis & factures.
- Notifications push pour les RDV agenda et les relances de factures.
- Cache hors-ligne (les artisans sont souvent sur chantier sans réseau).
