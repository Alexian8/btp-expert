# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

BatiDesk — logiciel de gestion pour artisans du bâtiment (clients, chantiers, devis, factures, dépenses, comptabilité en partie double, banque Qonto, agenda). Distribué en **desktop** (Electron), **web** (auto-hébergée) et **iOS** (natif), à partir d'une seule base de code UI.

> Le code (commentaires, libellés, messages) est rédigé en **français**. Conserver cette langue.

> 🔑 **Règle d'or — tout doit être inter-compatible web / desktop / iOS.** Aucune fonctionnalité ne doit être desktop-only, web-only, ni inaccessible sur iOS. Toute opération de données passe par le contrat partagé (voir [La couche `window.btpAPI`](#la-couche-windowbtpapi-clé-de-la-portabilité)) et doit être exposée côté serveur REST pour que le web ET iOS puissent la consommer. Avant de considérer une fonctionnalité « terminée », vérifier qu'elle fonctionne sur les trois plateformes. **L'app iOS ne doit PAS rester en lecture seule** : viser la parité CRUD avec desktop/web (voir [Limitations & direction produit](#limitations-connues--direction-produit)).

> 📝 **Tenir ce fichier à jour (obligatoire).** Dès qu'une fonctionnalité ajoutée ou modifiée change ce qui est décrit ici — nouvelle route/page, nouveau module ou store, nouveau champ de `settings`, nouvelle intégration, changement d'architecture, de navigation, de convention, de workflow de déploiement ou de statut métier — **mettre à jour `CLAUDE.md` dans le même commit/PR que le code**. Le contexte doit toujours refléter l'état réel du dépôt ; une fonctionnalité n'est pas « terminée » si elle a rendu une section de ce fichier obsolète sans la corriger.

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

⚠️ **DEUX `dist/` sont versionnés volontairement** — o2switch/cPanel ne lance **aucun build** au déploiement (`.cpanel.yml` fait uniquement un rsync + restart) et sert/exécute directement ce qui est poussé :
- **`apps/web/dist/`** (SPA) : après toute modif UI → `npm run build -w @btp/web` puis committer (assets gitignored → `git add -f`).
- **`apps/server/dist/`** (serveur compilé, exécuté par Passenger via `app.js`) : après **toute modif de `apps/server/src`** → `npm run build:server` puis committer. **Oublier cette étape = les nouvelles routes n'existent pas en prod** (l'UI à jour affiche alors « Route inconnue »).

C'est aussi la cause des conflits de merge récurrents sur ces `dist/` : régénérer après merge plutôt que résoudre à la main.

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
Express + MySQL (`mysql2`, requêtes paramétrées) + JWT. Le **schéma est auto-créé/migré au démarrage** (`db.ts`, `CREATE TABLE IF NOT EXISTS` — pas de migrations versionnées). Points d'entrée transverses : `auth.ts` (JWT + scrypt), `rbac.ts` (rôles hiérarchiques super_admin > admin > manager > accountant > worker > viewer), `token-revocation.ts` (blacklist au logout/changement de mot de passe), `audit.ts` (journal d'activité), `rate-limit.ts` (buckets **en mémoire** — ne scale pas en multi-instance). Le CRUD générique est dans `routes/crud.ts` ; les domaines spécialisés ont leur route (`accounting`, `qonto`, `vault`, `microsoft`, `admin-*`).

**Déploiement (o2switch / cPanel)** : le hosting clone le dépôt côté serveur via *Git Version Control* (sous `/home/<user-cpanel>/repositories/btp-expert`, branche **`main`**) et l'exécute via *Setup Node.js App* (Passenger) — **Node 22**, `NODE_ENV=production`, fichier de démarrage **`apps/server/app.js`**, dans un virtualenv `nodevenv`. Le déploiement se déclenche par **« Deploy HEAD Commit »** dans Git Version Control (exécute `.cpanel.yml` : rsync du dépôt vers le doc root + copie de `apps/web/dist` vers `public/` + restart) — un simple *Pull* ne suffit pas. **Aucun build côté serveur** → les deux `dist/` (web ET serveur) doivent être committés. Redémarrage seul : bouton *Redémarrer* de cPanel ou `touch tmp/restart.txt` (`npm run restart`).

### Comptabilité
Partie double complète (`apps/server/src/accounting`, types dans `packages/types/src/accounting.ts`) : journal, grand livre, balance, compte de résultat, bilan, TVA, export FEC. Les marges par chantier (`ChantierMargin`) sont calculées côté compta et exposées via `financeStore`.

### Sécurité / secrets
Mots de passe en scrypt. Les credentials Qonto sont chiffrés AES-256-GCM (clé dérivée du `JWT_SECRET`) et ne sont jamais renvoyés au front. Config validée par Zod au boot (`config.ts`) ; `JWT_SECRET` doit faire ≥ 32 octets. Variables d'environnement principales du serveur : `JWT_SECRET` (requis), `MYSQL_HOST/USER/PASSWORD/DATABASE`, `CORS_ORIGINS`, `APP_URL`, `PORT`, et optionnelles `MS_*` (Outlook/OneDrive), `SMTP_*` (email), `SENTRY_DSN`. Voir le tableau complet dans `README.md`.

### Authentification & sessions
- **JWT** : validité `JWT_EXPIRES_IN` (défaut 7j), révocation au logout/changement de mot de passe (`token-revocation.ts`). Token web en `localStorage` ; à 401 le shim émet `btp:auth-required` → logout UI.
- **Déconnexion automatique par inactivité** : composant `InactivityLogout` (monté dans `App.tsx`), 100 % client (web + desktop), avertissement 60 s avant. Durée réglable dans **Paramètres → Session & sécurité** (`SessionSection`) via le setting `sessionInactivityMinutes` (défaut 30, 0 = désactivé). Préfixe `session` ajouté à la whitelist `/api/settings`.
- **Verrouillage de compte** : après `LOGIN_LOCKOUT_MAX_ATTEMPTS` échecs (défaut 10), compte verrouillé `LOGIN_LOCKOUT_MINUTES` (défaut 15) — colonnes `users.failedLoginAttempts` / `lockedUntil` ; déverrouillé au login réussi ou au reset admin. Réponse 429 (surfacée en toast côté web).
- **Politique de mot de passe** : ≥ 10 car. + maj/min/chiffre, validée **côté serveur** (`validatePasswordPolicy` dans `routes/auth.ts`) en plus de l'UI (`ChangePasswordModal`).
- **Mot de passe oublié (self-service, web)** : `POST /api/auth/request-reset` (réponse 200 anti-énumération, rate-limité, email SMTP avec lien `${APP_URL}/reset-password?token=`, table `password_resets`, token SHA-256, validité 1 h) puis `POST /api/auth/reset-password` (`{token,newPassword}`). UI : lien « Mot de passe oublié ? » sur `LoginPage` (si `isWeb`) + page publique `ResetPasswordPage` (`/reset-password`). Shim : `authRequestPasswordReset` / `authResetPassword`.
- **Profil self-service (web)** : `PATCH /api/auth/me` (prénom/nom/email), `POST /api/auth/change-username` (confirmé par mot de passe, unicité, révoque le token → reconnexion), `POST /api/auth/change-password` (politique serveur, révoque le token). Shim : `authUpdateProfile` / `authChangeUsername` / `authChangePassword`. UI : `AccountSection` (Paramètres → Mon compte) branche web (REST) vs desktop (IPC historique `updateUsername`/`updatePassword`, hash SHA-256 local) ; l'édition du profil n'apparaît que si l'API REST est disponible.
- **Admin utilisateurs** (`routes/admin-users.ts`, RBAC) : CRUD + modale d'édition (nom/email), invitation (mot de passe temporaire + `mustChangePassword`), **renvoi d'invitation** (`POST /:id/resend-invite` — régénère le mot de passe + renvoie l'email), reset, **déverrouillage** (`POST /:id/unlock` — badge « Verrouillé » + bouton dans l'UI), désactivation. UI responsive (cartes mobile + tableau desktop), filtres rôle/statut.
- **Révocation de sessions par utilisateur** : `users.tokensInvalidBefore` (epoch s) + `revokeAllUserSessions` / `isUserSessionRevoked` (`token-revocation.ts`, cache 60 s, vérifié dans `requireAuth`). Appelée à la désactivation, au reset admin, au renvoi d'invitation et à la suppression — un compte désactivé perd ses sessions immédiatement.
- **Isolation worker côté serveur** : le rôle `worker` est restreint à ses propres lignes (`createdBy`) dans `MysqlRepository` via `ScopeContext.restrictToCreatedBy` (branché dans `routes/crud.ts`). Le filtre `?createdBy=ME` du shim web n'est qu'un confort d'UI, plus une barrière.
- **Super-admin** (`routes/super-admin.ts`, rôle `super_admin` créé via `apps/server/scripts/create-super-admin.js`, page `/super-admin/companies`) : gestion des entreprises clientes — création (+ admin initial avec email d'invitation), désactivation (bloque tous les logins), **modale de gestion** (`CompanyDetailModal` : renommage, liste des utilisateurs, activation) et **suppression définitive** (`DELETE /companies/:id`, cascade générique sur toutes les tables à colonne `companyId` sauf `audit_logs` ; garde-fous : ID 1 interdit + désactivation préalable + saisie du nom).

### Emails — transports & canaux
Le client SMTP maison est dans `apps/server/src/email.ts` (`sendMail`, zéro dépendance, supporte les **pièces jointes** en `multipart/mixed`). Deux routes serveur d'envoi (`apps/server/src/routes/microsoft.ts`, `buildEmailRouter`) :
- `POST /api/email/send` → **Microsoft Graph** (`/me/sendMail`), nécessite un compte Microsoft 365 connecté.
- `POST /api/email/send-smtp` → **SMTP** (mailbox de domaine via `SMTP_*`), **sans compte Microsoft**. Voie privilégiée pour les devis/factures côté web.

**Flux devis/factures par plateforme** (modales `SendQuoteByEmailModal` / `SendInvoiceByEmailModal` → `window.btpAPI.quotesSendViaOutlook` / `invoicesSendViaOutlook`) :
- **Desktop** : le main Electron génère le PDF et envoie via **Microsoft Graph**.
- **Web** : le PDF est généré dans le navigateur (`pdfElementToBase64`, React-PDF) puis transmis en base64 ; le shim envoie via **SMTP** (`/api/email/send-smtp`) et marque le devis « envoyé » / la facture « envoyée » ou la relance (parité desktop). ⚠️ Le transport SMTP n'envoie qu'à **un destinataire** (cc/destinataires multiples non gérés).

Mails **système** (invitations utilisateurs) : `sendMail`/SMTP. Pour la délivrabilité de la mailbox o2switch, configurer **SPF/DKIM/DMARC** et utiliser une vraie adresse `@<domaine>` (pas le sous-domaine de dev).

> ℹ️ `SendDocumentMailModal` + `emailSendDocument` (shim, branché aussi sur `/api/email/send-smtp`) sont un chemin alternatif **non câblé** dans l'UI actuelle.

**Diagnostic SMTP intégré (admin, web)** : Paramètres → **Emails (SMTP)** (`EmailSection`) — affiche la config vue par le serveur (`GET /api/email/smtp-status`, jamais le mot de passe) et envoie un email de test avec remontée de l'erreur SMTP exacte (`POST /api/email/test-smtp`). Premier réflexe quand « je ne reçois aucun email ».

### Premier démarrage
La base est vide : créer le premier administrateur via `POST /api/auth/bootstrap` (one-shot), puis login via `POST /api/auth/login`.

## Navigation & vocabulaire métier

Instance de référence (dev) : `intranet.jacobhabitat-dev.fr` (déploiement Jacob Habitat, o2switch). Thème **sombre par défaut** (toggle clair/sombre), **palette de commandes ⌘K / Ctrl+K**, barre latérale repliable.

**Sidebar** (définie dans `apps/desktop/src/app/layouts/DashboardLayout.tsx`) → routes :
`/` Tableau de bord · `/quotes` **Devis & Factures** · `/chantiers` Chantiers · `/clients` Clients · `/suppliers` Fournisseurs · `/expenses` Dépenses & frais · `/subcontractors` Sous-traitants · `/finances` **Finances & Compta** · `/admin-docs` Documents admin · `/calendar` Agenda · `/vault` Coffre-fort · `/settings` Paramètres (épinglé en bas).
⚠️ Pièges de routing : **Devis + Factures** sont une seule page à onglets (`/quotes`), **Finances + Compta** sont regroupées (`/finances`), et l'**Agenda est sur `/calendar`** (pas `/agenda`).

**Numérotation** : `<PREFIX>-<AAAA>-<NNNN>`, compteur **remis à 1 chaque année** (`DEVIS-2026-0001`, `FACT-2026-0001`, `DEP-…`). ⚠️ Générée à **deux endroits qui doivent rester alignés** (exemple concret de la règle d'inter-compatibilité) : desktop `apps/desktop/electron/main.js` et serveur `apps/server/src/accounting/references.ts`.

**Statuts** (libellés & couleurs dans `packages/types`) :
- **Devis** : brouillon · envoyé · accepté · refusé.
- **Facture** : brouillon · envoyée · partiellement-payée · payée · annulée. Types : standard · acompte · avoir.
- **Chantier** : prospect · en-cours · terminé · annulé — vues **Kanban (drag-drop)** + Liste. Kanban à **colonnes teintées** (UX terrain) : prospect bleu-gris (`slate`) · en cours orange (`amber`) · terminé vert (`emerald`) · annulé rouge (`rose`) — couleurs portées par `CHANTIER_STATUS_META`.

### Onglet Clients (`/clients`)
Annuaire orienté terrain : recherche + **filtres cumulatifs** (état des chantiers prospect/en-cours/terminé via `chantiersStore.listByClient`, ville, **étiquettes**), **pagination 25/page**, bascule **tableau ⇄ cartes**, **avatars** initiales + couleur déterministe (`lib/clientHelpers.ts`), **badge multi-chantiers** (bleu nuit `#1e293b`), **raccourcis d'action** `tel:`/`sms:`/`mailto:` (`lib/phoneFormat.ts` : `telHref`/`smsHref`). Fiche (`ClientDetailModal`) **compartimentée par dossier de chantier** (accordéons : devis+factures propres à chaque chantier) + bouton **Google Maps** (`googleMapsUrl`). Formulaire : `PhoneInput` (verrou +33, format live), `EmailInput` (autocomplétion des domaines au `@`), auto-casse Nom (MAJ) / Prénom (Capitalisé) / Ville (MAJ à la validation du CP), autofill **Sirene** via `SiretLookup` (API ouverte `recherche-entreprises.api.gouv.fr`). **Étiquettes personnalisables** : `clientTags` (settings partagés via `clientTagsStore` / `ClientTagsManager`) — préfixe **`client`** ajouté à la whitelist `/api/settings` ; les tags assignés vivent dans `client.tags[]`.

### Documents PDF (devis / factures)
Rendus par **React-PDF** dans `apps/desktop/src/features/pdf/` — deux styles par type : `QuotePdfClassique`/`QuotePdfMinimal`, `InvoicePdfClassique`/`InvoicePdfMinimal`. **Toute l'identité d'entreprise et les mentions légales sont paramétrables dans Paramètres** (`packages/types/src/settings.ts`) et ne doivent **jamais être codées en dur** : identité (SIRET, TVA intracom., APE), coordonnées bancaires (IBAN/BIC, affichées si `pdfIbanShown`), assurances (`assuranceDecennale*` — **obligatoire en BTP** —, `assuranceRC*`), acompte par défaut (`acompteDefaut`), clause de réserve de propriété, validité du devis.

Mentions attendues sur un devis (conformité BTP, pour référence) : **assurance décennale** + RC pro, coordonnées bancaires, **réserve de propriété**, **validité (30 j)**, **acompte** (ex. 30 % à la commande), bloc signature « **Bon pour accord** ». La **TVA est gérée par ligne** (totaux regroupés par taux ; 20 % dans les exemples courants).

## Conventions

### UX terrain (tactile) — règles globales dans `globals.css`
Sous `@media (pointer: coarse)` (téléphone/tablette de chantier, gants, soleil) : **cibles tactiles ≥ 44 px** (boutons, selects, inputs) et **texte de lecture ≥ 16 px** (`.text-sm` → 16 px, `.text-xs` → 14 px). Le desktop souris garde sa densité. En mode sombre, `--muted-foreground` est volontairement clair (78 %) pour la lisibilité en extérieur — ne pas le réassombrir.

### UI responsive — « visible sur tous les supports »
La version **web doit être utilisable sur mobile, tablette et desktop** (le desktop Electron reste large écran). Les vues de liste suivent le pattern : **cartes empilées en mobile (`md:hidden`) + tableau en desktop (`hidden md:block`)** — reproduire ce double rendu pour toute nouvelle liste. Penser tactile (cibles ≥ 40 px), `flex-wrap` sur les barres d'outils, pas de largeur fixe.

### Micro-interactions & primitives partagées (charte UI)
Charte transverse desktop + mobile-first — animations en **transform/opacity uniquement**, durées **150–300 ms**, respect de `prefers-reduced-motion`. Réutiliser ces primitives plutôt que de réimplémenter :
- **`@/components/shared/SideDrawer`** — volet coulissant depuis la droite (feuille plein écran sur mobile). **Standard pour toutes les modales de fiche/formulaire** : props `{open,onClose,title,subtitle,widthClass,footer,children}`, ferme au clic overlay + Échap, header/footer intégrés. Déjà appliqué à `ClientDetailModal` et `ClientFormModal` (`widthClass="max-w-3xl"` pour les gros formulaires) — migrer les autres modales au fur et à mesure.
- **`@/components/shared/TableScroller`** — enveloppe un `<table>` en `overflow-x-auto` avec ombre en dégradé sur les bords (classe `.scroll-shadow-x`) indiquant le scroll horizontal mobile.
- **`@/components/ui/skeleton`** — `Skeleton`, `SkeletonRows({rows,cols})`, `SkeletonCards({count})` pour les états de chargement (remplacent les spinners sur les listes).
- **`@/lib/useCountUp`** — `useCountUp(target, duration=500)` : animation RAF ease-out des nombres (KPIs du tableau de bord).
- **`Button` (`success` prop)** — bouton de validation qui passe au vert avec une coche SVG animée (`@keyframes check-draw`) au succès.
- **Kanban chantiers** : carte en drag `rotate-2 scale-105 shadow-2xl`, colonne survolée `.kanban-drop-target` (bordure pointillée pulsée `@keyframes dash-pulse`), impact au drop `.drop-impact`. Sur mobile : colonnes en `snap-x` scrollables.
- **Toasts** en haut à droite (`<Toaster position="top-right">` dans `App.tsx`).
Les keyframes/classes CSS de la charte (`check-draw`, `dash-pulse`, `kanban-drop-target`, `drop-impact`, `scroll-shadow-x`) sont dans `globals.css` avant `@layer utilities`.

### Style & helpers (réutiliser, ne pas réinventer)
- Sémantique couleur constante : **emerald** = positif/payé, **rose/red** = retard/erreur, **amber** = en attente/brouillon, **blue/violet** = informatif. Utiliser les tokens Tailwind (`text-muted-foreground`, `bg-card`, `border-border`…) — pas de couleurs en dur hors palette.
- **Style visuel global** : 4 personnalités (classique · épuré · liquid glass · techno) via `data-ui-style` sur `<html>` (overrides CSS dans `globals.css`, hors `@layer`). Choisi par l'**admin** dans Paramètres → Apparence → « Style de l'application » (setting partagé `themeStyle`, synchronisé au login dans `App.tsx`). Les nouveaux composants doivent utiliser les tokens (`bg-card`…) pour hériter automatiquement du style. Le thème **Liquid glass est ajustable** (curseurs admin visibles quand il est actif) : variables CSS `--liquid-blur` / `--liquid-card-alpha` / `--liquid-glow` injectées sur `<html>` par `themeStore` (`setLiquid`), settings partagés `themeLiquidBlur` (px) / `themeLiquidCardOpacity` (%) / `themeLiquidGlow` (%). **Liquid** vitre toute la coque (sidebar/topbar/menus/champs via `.bg-card`/`.bg-popover`/`aside`/`header`) : les halos colorés sont posés sur `<html>` et `.bg-background` est rendu transparent pour que le flou ait de la matière. **Épuré** applique le **thème par défaut de shadcn/ui** (base « zinc ») : il **réécrit les tokens** (palette neutre zinc, primaire **monochrome** — boutons blancs en sombre / noirs en clair, `--radius: 0.5rem`, carte == fond + bordure 1px, zéro ombre). La couleur d'accent est volontairement neutralisée en épuré ; ne pas y ajouter d'ombres.
- Montants via `formatEuro`/`formatEuros`, dates via `formatDateFR`. Notifications : `toast` (sonner). Animations : `framer-motion`. Icônes : `lucide-react`.
- Composants de base dans `@btp/ui` (Radix + CVA) et `@/components/ui/*` ; réutiliser `ConfirmDialog`, `Button`, `Input`, `NativeSelect`… La logique d'écran vit dans `apps/desktop/src/features/<domaine>/components`.

### Workflow Git
Développer sur une branche `claude/*`, PR vers `main`. Avant commit : `npm run typecheck` + `npm test`. **Avant toute PR : rebuilder et committer le(s) `dist/` impactés** — `npm run build -w @btp/web` si l'UI a changé, **`npm run build:server` si `apps/server/src` a changé** (sinon la prod o2switch reste sur l'ancien code : « Route inconnue »). **Si le changement redéfinit le contexte documenté ici, mettre à jour `CLAUDE.md` dans le même commit** (cf. règle « Tenir ce fichier à jour » en tête de fichier).

### Tests
Vitest. La logique métier est isolée dans des moteurs purs et testés (`invoiceEngine.ts`, `quoteEngine.ts`) — y placer tout nouveau calcul (totaux, TVA, échéances, marges) et le couvrir par un test. Pas encore d'E2E.

## Limitations connues & direction produit
- **iOS — parité CRUD quasi atteinte.** `apps/ios` (SwiftUI, iOS 17+) couvre en CRUD complet : clients, chantiers, devis, factures, fournisseurs, **dépenses, notes de frais, sous-traitants, agenda**, plus une vue **Finances** (KPIs + marges par chantier, lecture). Restent en placeholder : Statistiques, Documents admin, Coffre-fort. Trous d'inter-compat relevés côté serveur : pas de route REST pour les **attestations sous-traitants** ni pour les stats finances (`FinanceStats`/`ChantierMargin` recalculés côté client comme le fait le shim web). Toute nouvelle fonctionnalité doit prévoir son accès iOS (route REST + écran). ⚠️ Le `.xcodeproj` (synchronized groups Xcode 16) inclut automatiquement les nouveaux `.swift` ; le build/test se fait sur Mac uniquement.
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
