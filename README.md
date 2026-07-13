<div align="center">

# 🏗 BatiDesk

**Logiciel de gestion complet pour artisans du bâtiment.**
Clients · Chantiers · Devis · Factures · Dépenses · Comptabilité · Banque

Multi-plateforme : application **desktop** (Windows/macOS) et **web** (auto-hébergée).

</div>

---

## 📋 Sommaire

1. [Présentation](#-présentation)
2. [Stack technique](#-stack-technique)
3. [Structure du projet](#-structure-du-projet)
4. [Démarrage rapide (développement)](#-démarrage-rapide-développement)
5. [Build (compilation)](#-build-compilation)
6. [Déploiement web (cPanel)](#-déploiement-web-cpanel)
7. [🔁 Transférer vers un autre hébergeur](#-transférer-vers-un-autre-hébergeur)
8. [Variables d'environnement](#-variables-denvironnement)
9. [Intégrations externes](#-intégrations-externes)
10. [Application desktop (Windows / macOS)](#-application-desktop-windows--macos)
11. [Sauvegardes](#-sauvegardes)
12. [Dépannage](#-dépannage)

---

## 🎯 Présentation

BatiDesk couvre toute la gestion d'une entreprise du bâtiment :

| Module | Description |
|---|---|
| **Clients & Fournisseurs** | Carnet d'adresses, SIRET, TVA |
| **Chantiers** | Suivi projets, photos, documents, signatures, marge |
| **Devis & Factures** | Multi-lignes, remises, 3 styles PDF, envoi email, conversion devis→facture, acomptes |
| **Dépenses & frais** | Achats fournisseurs + notes de frais, justificatifs |
| **Comptabilité** | Partie double complète : livre journal, grand livre, balance, compte de résultat, bilan, TVA, export FEC |
| **Banque (Qonto)** | Connexion bancaire (lecture solde/transactions), rapprochement à venir |
| **Agenda** | Planning, synchro Outlook |
| **Coffre-fort** | Stockage chiffré de documents |
| **Documents admin** | CERFA, PV de réception, attestations TVA, DC4 |

Un **guide d'utilisation complet** est intégré dans l'app (bouton **?** en haut) — voir aussi [`GUIDE_COMPTABILITE.md`](./GUIDE_COMPTABILITE.md).

---

## 🧱 Stack technique

| Catégorie | Technologie |
|---|---|
| Langage | TypeScript |
| UI | React 18 + Tailwind CSS + Shadcn (Radix + CVA) |
| State / Data | Zustand · React Query |
| Build | Vite 5 |
| Desktop | Electron 32 + better-sqlite3 (SQLite local) |
| Serveur web | Express + MySQL (mysql2) + JWT |
| PDF | @react-pdf/renderer · pdf-lib |
| Orthographe | nspell (dictionnaire Hunspell FR) |
| Monorepo | npm workspaces |

L'abstraction `IDataService` (dans `packages/core`) permet au même code métier de fonctionner en **desktop** (SQLite via Electron IPC) ou en **web** (API REST via le serveur Express).

---

## 📂 Structure du projet

```
btp-expert/
├── apps/
│   ├── desktop/     ← App Electron (UI principale, partagée avec le web)
│   ├── server/      ← Backend Express + MySQL (API REST /api/*)
│   ├── web/         ← SPA web (réutilise apps/desktop/src via alias Vite)
│   └── ios/         ← App iOS native (MVP, lecture seule)
└── packages/
    ├── core/        ← IDataService, logique métier
    ├── types/       ← Types TypeScript partagés
    └── ui/          ← Composants UI partagés
```

> ℹ️ **Important** : l'app web (`apps/web`) ne contient quasiment pas de code propre — elle réutilise `apps/desktop/src` et remplace `window.btpAPI` (Electron) par un shim HTTP qui appelle le serveur. Une seule base de code UI pour les deux plateformes.

---

## 🚀 Démarrage rapide (développement)

**Prérequis** : Node.js ≥ 18, npm.

```bash
git clone <repo> btp-expert
cd btp-expert
npm install                       # installe tous les workspaces (5-10 min)

# App desktop (Vite :5173 + fenêtre Electron, HMR inclus)
npm run dev -w @btp/desktop

# Serveur web (Express :3001, en watch)
npm run dev -w @btp/server
```

Pour développer le **front web** contre le serveur local : configurer `apps/web` puis `npm run dev -w @btp/web`.

---

## 🔨 Build (compilation)

```bash
npm run build -w @btp/server      # → apps/server/dist/
npm run build -w @btp/web         # → apps/web/dist/
npm run build -w @btp/desktop     # → apps/desktop/dist/
```

> ⚠️ **Les `dist/` du serveur et du web sont commités dans Git** (volontairement). Le déploiement cPanel ne fait PAS de `npm run build` (trop lent/instable) : il copie les sources **et** les `dist/` déjà compilés. **Avant chaque push qui touche le serveur ou le web, il faut donc rebuilder et committer les `dist/`** :
> ```bash
> npm run build -w @btp/server && npm run build -w @btp/web
> git add -f apps/server/dist apps/web/dist
> git commit -m "build" && git push
> ```

---

## 🌐 Déploiement web (cPanel)

Cible type : `https://intranet.mondomaine.fr`. Le pipeline est défini dans [`.cpanel.yml`](./.cpanel.yml).

### 1. Sous-domaine + SSL
- cPanel → **Sous-domaines** → créer (ex. `intranet`). Noter le **Document Root** (ex. `/home/<user>/intranet.mondomaine.fr`).
- cPanel → **Let's Encrypt SSL** → émettre le certificat pour ce sous-domaine.

### 2. Base de données MySQL
- cPanel → **Bases de données MySQL** → créer une base (ex. `btp` → préfixée `<user>_btp`) et un utilisateur, l'associer avec **ALL PRIVILEGES**.

### 3. Dépôt Git
- cPanel → **Git™ Version Control** → **Create** → URL du repo, branche `main`, destination = doc root.
- Déploiements suivants : **Update from Remote** puis **Deploy HEAD Commit** (exécute `.cpanel.yml` : rsync sources+`dist/`, restart).

### 4. Application Node.js
- cPanel → **Setup Node.js App** → **Create Application** :
  - **Node version** : 20 ou 22
  - **Application mode** : `Production`
  - **Application root** : le doc root du sous-domaine
  - **Startup file** : `app.js`
- Renseigner les **variables d'environnement** (voir [section dédiée](#-variables-denvironnement)).
- **Run NPM Install** puis **Start App**.

### 5. Vérifier
```
https://intranet.mondomaine.fr/api/health   →   {"ok":true, ...}
```

### 6. Créer le premier administrateur
```bash
curl -X POST https://intranet.mondomaine.fr/api/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"username":"Admin","password":"VOTRE_MOT_DE_PASSE"}'
```
(Réponse `409` = bootstrap déjà fait, c'est normal.)

### Redéployer après une mise à jour
1. (En local) rebuild + commit des `dist/` + push (voir [Build](#-build-compilation)).
2. cPanel → Git Version Control → **Update from Remote** → **Deploy HEAD Commit**.
3. Si besoin : Setup Node.js App → **Restart** (ou `touch tmp/restart.txt`).

---

## 🔁 Transférer vers un autre hébergeur

L'application est **portable** : seuls la base MySQL, les variables d'environnement et le code sont nécessaires. Voici comment migrer.

### A. Vers un autre cPanel (o2switch, OVH cPanel, etc.)

1. **Sauvegarder l'ancienne base** : cPanel → phpMyAdmin → Exporter la base (`.sql`), ou en SSH :
   ```bash
   mysqldump -u <user> -p <user>_btp > btp_dump.sql
   ```
2. Sur le **nouveau** cPanel, refaire les étapes [Déploiement web](#-déploiement-web-cpanel) : sous-domaine, SSL, **nouvelle base MySQL**, dépôt Git, Setup Node.js App.
3. **Importer le dump** dans la nouvelle base (phpMyAdmin → Importer).
4. **Variables d'environnement** : recopier les mêmes valeurs, en adaptant uniquement :
   - `MYSQL_HOST/USER/PASSWORD/DATABASE` (nouveaux identifiants)
   - `CORS_ORIGINS` et `APP_URL` (nouveau domaine)
   - `MS_REDIRECT_URI` si Outlook est utilisé (+ mettre à jour l'URL de redirection côté Azure).
5. **Run NPM Install** → **Start App** → vérifier `/api/health` et le login.
6. **DNS** : faire pointer le domaine vers le nouvel hébergeur. ⚠️ Conserver l'ancien serveur actif jusqu'à propagation DNS (24-48 h).

### B. Vers un VPS / serveur dédié (sans cPanel)

```bash
# 1. Prérequis sur le serveur
sudo apt install -y nodejs npm mysql-server nginx
# (Node ≥ 18 ; utiliser nvm si la version des dépôts est trop ancienne)

# 2. Récupérer le code
git clone <repo> /var/www/batidesk && cd /var/www/batidesk
npm install --omit=dev

# 3. Base de données
sudo mysql -e "CREATE DATABASE btp; CREATE USER 'btp'@'localhost' IDENTIFIED BY 'MOT_DE_PASSE';
               GRANT ALL ON btp.* TO 'btp'@'localhost';"
mysql -u btp -p btp < btp_dump.sql        # si migration depuis une base existante

# 4. Variables d'environnement
cp apps/server/.env.example apps/server/.env   # puis éditer (voir tableau)

# 5. Lancer en service permanent (pm2)
npm i -g pm2
pm2 start apps/server/dist/index.js --name batidesk
pm2 save && pm2 startup
```

Puis un reverse-proxy **nginx** vers le port Node (3001) avec certificat **Let's Encrypt** (`certbot`). Le schéma de base se crée automatiquement au premier démarrage (`runMigrations`).

### Ce qui doit suivre dans tous les cas
- ✅ La **base MySQL** (dump + restore — le schéma est identique partout)
- ✅ Le **fichier `.env`** (mêmes variables, valeurs adaptées au nouvel hôte)
- ✅ Le dossier de **sauvegardes** (`~/backups/btp/` si vous le conservez)
- ✅ Les **URL de redirection Azure** (Outlook) si l'intégration Microsoft est active

---

## 🔑 Variables d'environnement

Fichier `apps/server/.env` (ou variables dans Setup Node.js App côté cPanel).

| Variable | Requis | Exemple / défaut | Rôle |
|---|:---:|---|---|
| `JWT_SECRET` | ✅ | *(128 hex)* | Clé de signature des tokens. Générer : `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `MYSQL_HOST` | ✅ | `localhost` | Hôte MySQL |
| `MYSQL_USER` | ✅ | `user_btpadmin` | Utilisateur MySQL |
| `MYSQL_PASSWORD` | ✅ | *(fort)* | Mot de passe MySQL |
| `MYSQL_DATABASE` | ✅ | `user_btp` | Nom de la base |
| `MYSQL_PORT` | — | `3306` | Port MySQL |
| `MYSQL_CONNECTION_LIMIT` | — | `10` | Pool de connexions |
| `NODE_ENV` | — | `production` | Environnement |
| `PORT` | — | `3001` | Port (cPanel l'override) |
| `CORS_ORIGINS` | — | `https://intranet.mondomaine.fr` | Origines autorisées (séparées par `,`) |
| `APP_URL` | — | `https://intranet.mondomaine.fr` | URL utilisée dans les emails |
| `JWT_EXPIRES_IN` | — | `7d` | Durée de validité des tokens |
| `MS_CLIENT_ID` / `MS_CLIENT_SECRET` | — | *(Azure)* | OAuth Microsoft (Outlook/OneDrive) |
| `MS_REDIRECT_URI` | — | `https://…/api/auth/microsoft/callback` | Redirection OAuth |
| `MS_TENANT` / `MS_SCOPES` | — | `common` / *(scopes)* | Config OAuth |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | — | — | Envoi d'emails (alternative à Outlook) |
| `CPANEL_HOST` / `CPANEL_USERNAME` / `CPANEL_API_TOKEN` | — | — | Provisioning de boîtes mail (optionnel, cPanel) |
| `SENTRY_DSN` | — | `https://…@sentry.io/…` | Monitoring d'erreurs (optionnel) |
| `RATE_LIMIT_*` | — | *(défauts)* | Limitation de débit login/API/IA |
| `AI_MODEL_PATH` | — | `/home/user/ai-models/qwen2.5-1.5b-instruct-q4_k_m.gguf` | Active l'assistant IA locale (chemin absolu du modèle GGUF) |
| `AI_THREADS` | — | `2` | Threads CPU pour l'inférence (rester bas sur mutualisé) |
| `AI_CONTEXT_SIZE` / `AI_MAX_TOKENS` | — | `2048` / `220` | Taille de contexte / longueur max des réponses |
| `AI_TIMEOUT_MS` / `AI_QUEUE_MAX` | — | `60000` / `4` | Timeout d'une inférence / requêtes en attente max |

Seules les **5 variables ✅** sont strictement nécessaires pour démarrer.

---

## 🔌 Intégrations externes

### Microsoft (Outlook + OneDrive) — *optionnel*
1. [portal.azure.com](https://portal.azure.com) → **App registrations** → nouvelle app.
2. **Redirect URI** (type Web) : `https://VOTRE_DOMAINE/api/auth/microsoft/callback`.
3. **Certificates & secrets** → créer un secret (le copier immédiatement).
4. **API permissions** (Microsoft Graph, déléguées) : `offline_access`, `User.Read`, `Mail.Send`, `Calendars.ReadWrite`, `Files.ReadWrite.AppFolder`.
5. Renseigner `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_REDIRECT_URI` dans l'env.

> En cas de changement de domaine, **mettre à jour le Redirect URI dans Azure** sinon la connexion Outlook échoue.

### Banque Qonto — *optionnel*
Paramètres → **Banque (Qonto)** dans l'app. Générer une clé API dans Qonto (Paramètres → Intégrations → API), puis saisir login + secret. La clé est chiffrée côté serveur, jamais exposée.

### Sentry (monitoring) — *optionnel*
Créer un projet sur [sentry.io](https://sentry.io), récupérer la DSN, la mettre dans `SENTRY_DSN` (serveur) / `VITE_SENTRY_DSN` (web). Offre gratuite suffisante (5 000 erreurs/mois).

### Assistant IA locale — *optionnel*
Petit modèle de langage (GGUF) exécuté **directement sur le serveur** via `node-llama-cpp` (CPU, aucune donnée envoyée à un service externe). Utilisé pour rédiger les descriptions de lignes de devis et suggérer la catégorie des dépenses.

1. Sur le serveur (SSH) : `node apps/server/scripts/download-ai-model.js` — télécharge Qwen2.5-1.5B-Instruct Q4_K_M (~1 Go) dans `~/ai-models/` (variante 0.5B plus rapide : voir `--url` dans le script).
2. Ajouter `AI_MODEL_PATH=/home/<user>/ai-models/qwen2.5-1.5b-instruct-q4_k_m.gguf` dans le `.env`.
3. Vérifier que la dépendance optionnelle est installée : `npm install --omit=dev` à la racine du site.
4. Redémarrer l'app Node, puis tester dans **Paramètres → IA locale**.

Sans `AI_MODEL_PATH`, le service se déclare indisponible et l'UI masque simplement les boutons IA. Le modèle est chargé en RAM à la première requête (~1,2 Go pour le 1.5B) et une seule inférence tourne à la fois (`AI_THREADS=2` par défaut) pour respecter le fair-use CPU de l'hébergement mutualisé. Comptez plusieurs secondes par réponse — c'est un assistant d'appoint, pas un chat temps réel.

---

## 💻 Application desktop (Windows / macOS)

```bash
npm run dist          # installeur pour l'OS courant
npm run dist:win      # Windows .exe
npm run dist:mac      # macOS .dmg (à lancer sur un Mac)
```

### Signature de code Windows (recommandé pour éviter l'alerte SmartScreen)
Avec un certificat OV (`.pfx`) :
```bash
# PowerShell
$env:CSC_LINK = "C:\chemin\certificat.pfx"
$env:CSC_KEY_PASSWORD = "mot-de-passe"
npm run dist:win
```

### macOS
Prérequis : `xcode-select --install`. Le build produit un `.dmg` (Intel + Apple Silicon arm64).

---

## 💾 Sauvegardes

- **Desktop** : sauvegarde locale (fichier `.btpbackup`) + envoi optionnel sur OneDrive (Paramètres → Sauvegarde).
- **Serveur** : sauvegarde quotidienne automatique recommandée via une **tâche Cron** (3 h du matin) appelant le script de backup du serveur ; stockage **hors du doc root** (ex. `~/backups/btp/`). Sur cPanel, **JetBackup** peut aussi sauvegarder la base MySQL.
- Endpoints serveur : `POST /api/backup/run`, `GET /api/backup/list`, restauration `POST /api/backup/restore/:name` (authentifiés).

---

## 🛠 Dépannage

| Problème | Solution |
|---|---|
| `/api/health` renvoie 500 | Identifiants MySQL erronés ou `JWT_SECRET` < 32 caractères → vérifier l'env, voir le **Log** dans Setup Node.js App |
| 503 « Server is starting » | Warm-up Passenger, attendre 5-10 s et recharger |
| Modifications absentes après déploiement | Avez-vous **rebuild + committé les `dist/`** avant le push ? Puis **Deploy HEAD Commit** sur cPanel |
| Connexion Outlook échoue | Redirect URI Azure ≠ domaine actuel → corriger dans Azure |
| Page blanche / erreur de chargement | Vider le cache navigateur (`Ctrl+Shift+R`) |

---

<div align="center">

**BatiDesk** — © JACOB HABITAT (Alexian JACOB) · Licence propriétaire

</div>
