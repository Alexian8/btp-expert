# 🚀 Déploiement BatiDesk sur o2switch (cPanel)

Guide pas-à-pas pour mettre l'API BatiDesk en ligne sur ton hébergement
o2switch et faire pointer ton app desktop dessus.

**Cible** : `https://intranet.jacobhabitat-dev.fr/api/...`

---

## Prérequis (côté cPanel — tu y es déjà)

Dans ton cPanel, repérer ces 4 modules (visibles sur ta capture d'écran) :

- **Domaines → Sous-domaines** (créer `intranet.jacobhabitat-dev.fr`)
- **Bases de données → Bases de données MySQL** (créer la DB et le user)
- **Logiciel → Setup Node.js App** (déployer le code)
- **Sécurité → Let's Encrypt™ SSL** (HTTPS gratuit)

---

## Étape 1 — Créer le sous-domaine

1. cPanel → **Sous-domaines**
2. Champ « Sous-domaine » : `intranet`
3. Champ « Domaine » : `jacobhabitat-dev.fr`
4. Le « Document Root » est rempli automatiquement, ex :
   `/home/loris/intranet.jacobhabitat-dev.fr` — note bien ce chemin, on
   l'utilisera plus loin (variable `APP_ROOT`).
5. Clique « Créer ».

## Étape 2 — Activer HTTPS sur le sous-domaine

1. cPanel → **Let's Encrypt™ SSL**
2. Liste des domaines → coche `intranet.jacobhabitat-dev.fr`
3. « Émettre » → certificat valide en quelques secondes
4. Vérifier ensuite dans **SSL/TLS Status** que le sous-domaine est ✅

## Étape 3 — Créer la base MySQL

1. cPanel → **Bases de données MySQL**
2. **Créer une nouvelle base** : `btp` (cPanel préfixera → `loris_btp`)
3. **Ajouter un utilisateur** : `btpadmin` + mot de passe fort
   (cPanel a un générateur — copie-le quelque part de sûr, on le mettra dans `.env`)
4. **Ajouter l'utilisateur à la base** : sélectionne les deux + coche
   « ALL PRIVILEGES » → Soumettre.

Note les valeurs finales (préfixe inclus) :

```
MYSQL_USER     = loris_btpadmin
MYSQL_PASSWORD = <celui que tu viens de générer>
MYSQL_DATABASE = loris_btp
MYSQL_HOST     = localhost
```

## Étape 4 — Uploader le code

Deux options :

### Option A — Git (recommandé si ton repo est sur GitHub)

1. cPanel → **Git™ Version Control** (visible sur ta capture, section Fichiers)
2. « Create » → URL du repo, branche `main`, dépôt destination =
   `/home/loris/intranet.jacobhabitat-dev.fr/repo`
3. Une fois cloné, on déplacera juste les fichiers du serveur dans le doc root.

### Option B — FTP / Gestionnaire de fichiers

1. Sur ton poste, builder localement :
   ```bash
   cd C:\Users\Alexi\Desktop\btp-expert
   npm install
   npm run build -w @btp/server
   ```
2. cPanel → **Gestionnaire de fichiers**, va dans
   `/home/loris/intranet.jacobhabitat-dev.fr/`
3. Uploader **uniquement** ces fichiers depuis ton poste :
   - `apps/server/package.json`
   - `apps/server/package-lock.json` (s'il existe — sinon copier le root `package-lock.json`)
   - `apps/server/app.js`
   - `apps/server/.htaccess`
   - `apps/server/dist/` (généré par `npm run build`)
   - `packages/core/dist/` (idem) → renommer ou copier dans `node_modules/@btp/core` après install
   - `packages/types/dist/` → idem dans `node_modules/@btp/types`

   **OU** plus simple : zipper le dossier `apps/server` localement après
   `npm run build`, l'uploader, le décompresser dans le doc root.

> Pour la suite, je recommande l'**option A (Git)** parce que les futurs
> déploiements seront un simple `git pull` + redémarrage de l'app via cPanel.

## Étape 5 — Configurer Setup Node.js App

1. cPanel → **Setup Node.js App** (section Logiciel)
2. « CREATE APPLICATION » :
   - **Node.js version** : la plus récente disponible (≥ 18, idéalement 20 ou 22)
   - **Application mode** : `Production`
   - **Application root** : `intranet.jacobhabitat-dev.fr` (relatif à `/home/loris/`)
     ⚠️ Ou directement `intranet.jacobhabitat-dev.fr/apps/server` si tu as gardé
     la structure monorepo
   - **Application URL** : `intranet.jacobhabitat-dev.fr`
   - **Application startup file** : `app.js`
   - **Passenger log file** : laisser par défaut (utile pour debug)
3. Clique « Create ».

### Variables d'environnement

Dans la même page, section « Environment variables », ajoute :

```
NODE_ENV              = production
PORT                  = 3001            (cPanel l'override de toute façon)
CORS_ORIGINS          = https://intranet.jacobhabitat-dev.fr
JWT_SECRET            = <128 caractères aléatoires — voir ci-dessous>
JWT_EXPIRES_IN        = 7d
MYSQL_HOST            = localhost
MYSQL_PORT            = 3306
MYSQL_USER            = loris_btpadmin
MYSQL_PASSWORD        = <celui de l'étape 3>
MYSQL_DATABASE        = loris_btp
MYSQL_CONNECTION_LIMIT= 10
```

Pour générer un JWT_SECRET solide depuis ton terminal local :

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Installer les dépendances

Toujours dans Setup Node.js App, en haut à droite, clique « **Run NPM Install** ».
Patiente quelques minutes — Passenger compile aussi les modules natifs.

### Démarrer l'app

Clique « **Start App** » (ou « Restart » si elle est déjà active).
Le bouton « Log » te donne accès au stderr/stdout.

## Étape 6 — Vérifier que ça marche

Depuis ton navigateur :

```
https://intranet.jacobhabitat-dev.fr/api/health
```

Tu dois voir :

```json
{ "ok": true, "version": "0.1.0", "time": "2026-05-10T..." }
```

Si tu vois une page 503 « Server is starting… », attends 5-10 secondes et
recharge — c'est le warm-up Passenger.

Si tu vois 500, ouvre **Setup Node.js App → Log** pour voir l'erreur (souvent
DB credentials ou JWT_SECRET trop court).

## Étape 7 — Bootstrap du premier admin

Une fois `/api/health` qui répond, crée ton compte initial via curl
(depuis ton terminal Windows) :

```bash
curl -X POST https://intranet.jacobhabitat-dev.fr/api/auth/bootstrap ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"Alexian\",\"password\":\"TON-MOT-DE-PASSE\"}"
```

Réponse attendue : `{"id":1,"username":"Alexian"}`

Si tu refais l'appel : `409 Bootstrap déjà effectué` → c'est normal,
la sécurité empêche de créer plusieurs admins par cette voie.

## Étape 8 — Migrer les données depuis ta DB locale

Pour transférer Alexian + clients/chantiers/etc. depuis `btp-v16.db` :

```bash
cd C:\Users\Alexi\Desktop\btp-expert\apps\server
# Renseigne les MYSQL_* dans .env d'abord (en pointant vers o2switch)
# o2switch autorise les connexions distantes via "MySQL distant" — il faut
# d'abord whitelister ton IP publique : cPanel → MySQL distant
npm run migrate:sqlite -- "$APPDATA/@btp/desktop/btp-v16.db"
```

⚠️ **Avant de lancer la migration**, dans cPanel → **MySQL distant**, ajoute
ton IP publique (cherche « mon IP » sur Google) à la liste blanche.

⚠️ **Pour l'instant le script ne migre que la table `users`** (le schéma des
autres tables diffère entre desktop et serveur — la migration se fera au
fur et à mesure qu'on alignera les schémas).

Si tu préfères : utilise le **bootstrap** étape 7 et recrée tes 2 clients +
chantiers à la main, c'est rapide.

## Étape 9 — Bascule de l'app desktop

Sur ton poste, modifie `apps/desktop/.env` :

```env
VITE_USE_REMOTE_API=true
VITE_API_BASE_URL=https://intranet.jacobhabitat-dev.fr
```

Puis relance l'app :

```bash
npm run dev -w @btp/desktop
```

Le `DataServiceFactory` détecte `VITE_USE_REMOTE_API=true` et instancie
`ApiDataService` au lieu de `ElectronDataService`. **Aucun écran de l'app
n'a besoin d'être modifié** — c'est tout l'intérêt de la couche `IDataService`.

Login → tu devrais voir tes données depuis MySQL distant.

## Étape 10 — Repasser en local pour les sauvegardes

Tu peux garder les **deux modes** côte à côte. Pour repasser en local
(ex: si Internet est coupé sur un chantier) :

```env
VITE_USE_REMOTE_API=false
```

L'app reprend `btp-v16.db` local. Note : les modifications faites en local
ne se synchronisent PAS vers le serveur automatiquement — c'est un choix
de design « mode déconnecté lecture seule recommandé ». La synchro
bidirectionnelle est une étape ultérieure (cf §Limitations).

---

## Limitations connues à ce stade

- Seules **3 ressources** sont branchées côté serveur : `clients`,
  `fournisseurs`, `chantiers` + `settings`. Les 12 autres (factures, devis,
  vault, agenda, …) sont encore en stub. Le client desktop le verra : les
  pages correspondantes échoueront en mode remote tant qu'on n'a pas branché
  les routes côté serveur.
- Pas de **synchronisation hors-ligne** : si tu modifies en local pendant
  que tu es en mode remote=true, ça écrit dans la DB locale qui ne sera pas
  re-synchronisée automatiquement. Recommandation : un seul mode actif à la fois.
- **Vault (coffre-fort)** : les fichiers sont actuellement stockés en local
  (`%APPDATA%\@btp\desktop\vault\`). Côté serveur, il faudra ajouter une
  route `/api/vault/upload` + stockage sur le hosting o2switch (les
  documents s'accumulent vite — vérifier ton quota disque).

## Maintenance — redéploiement

Pour une nouvelle version du serveur :

1. `git pull` dans le doc root (ou re-uploader les fichiers)
2. `npm run build -w @btp/server` localement → réuploader `dist/`
3. cPanel → Setup Node.js App → « **Restart App** »

## Sauvegardes

cPanel a **JetBackup 5** (visible dans ta capture). Configure une sauvegarde
quotidienne de la DB MySQL — c'est gratuit et ça remplace le système OneDrive
bancale.

cPanel → **JetBackup 5** → « MySQL Backups » → Schedule daily.
