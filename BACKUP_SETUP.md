# 💾 Configuration des sauvegardes BatiDesk

Ce guide explique comment activer **3 niveaux de sauvegarde** complémentaires :

1. **Backup local desktop** (déjà en place — fichier `.btpbackup` dans `%APPDATA%`)
2. **Backup serveur o2switch** (cron quotidien automatique)
3. **Backup à la demande** via l'API `/api/backup/*`

OneDrive comme destination de backup est en cours de retrait — remplacé par
le serveur o2switch (plus fiable, pas de dépendance Microsoft Graph).

---

## 🤖 Cron quotidien sur o2switch (à activer une fois)

### 1. Récupère le code à jour côté serveur

Dans le **Terminal cPanel** :

```
cd ~/repositories/btp-expert
git pull
cp -r apps/server/dist ~/intranet.jacobhabitat-dev.fr/apps/server/
cp -r apps/server/src ~/intranet.jacobhabitat-dev.fr/apps/server/
cp -r apps/server/scripts ~/intranet.jacobhabitat-dev.fr/apps/server/
touch ~/intranet.jacobhabitat-dev.fr/tmp/restart.txt
```

### 2. Crée le dossier de backups

```
mkdir -p ~/backups/btp
```

### 3. Configure la tâche Cron dans cPanel

cPanel → **Avancé → Tâches Cron** → ajouter :

| Champ | Valeur |
|---|---|
| **Minute** | `0` |
| **Heure** | `3` |
| **Jour** | `*` |
| **Mois** | `*` |
| **Jour de la semaine** | `*` |
| **Commande** | (voir ci-dessous) |

Commande à coller (adapte le `/22/` à ta version Node si différent) :

```bash
/home/mime9297/nodevenv/intranet.jacobhabitat-dev.fr/22/bin/node /home/mime9297/intranet.jacobhabitat-dev.fr/apps/server/scripts/backup-cron.js >> /home/mime9297/backups/btp/cron.log 2>&1
```

→ Sauvegarde tous les jours à **3h du matin**, conservation des **14 derniers** backups.

Tu peux changer la rétention en éditant `BACKUP_RETENTION_COUNT` dans
`~/intranet.jacobhabitat-dev.fr/.env` (ajoute la ligne `BACKUP_RETENTION_COUNT=30`
pour 30 jours par exemple).

### 4. Test manuel du cron (sans attendre 3h)

Dans le terminal cPanel :

```
/home/mime9297/nodevenv/intranet.jacobhabitat-dev.fr/22/bin/node /home/mime9297/intranet.jacobhabitat-dev.fr/apps/server/scripts/backup-cron.js
```

Tu dois voir :
```
[cron] backup started at 2026-...
[cron] ✓ backup btp-backup-2026-...sql.gz (XXX bytes, 7 tables, X rows, XXXms)
[cron] retained 1 backup(s)
```

Vérifie le fichier créé :

```
ls -la ~/backups/btp/
```

---

## 📡 Endpoints REST `/api/backup/*` (déjà déployés)

Tous nécessitent l'authentification (header `Authorization: Bearer <token>`).

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/backup/list` | Liste les backups disponibles (nom, taille, date) |
| `POST` | `/api/backup/run` | Lance une sauvegarde manuelle |
| `GET` | `/api/backup/download/:name` | Télécharge un backup (gzip) |
| `POST` | `/api/backup/restore/:name` | Restaure un backup |
| `DELETE` | `/api/backup/:name` | Supprime un backup |

### Test via curl (après login)

```bash
# Login
TOKEN=$(curl -s -X POST https://intranet.jacobhabitat-dev.fr/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"Alexian","password":"TON_PASSWORD"}' | jq -r .token)

# Lance un backup manuel
curl -X POST -H "Authorization: Bearer $TOKEN" https://intranet.jacobhabitat-dev.fr/api/backup/run

# Liste les backups
curl -H "Authorization: Bearer $TOKEN" https://intranet.jacobhabitat-dev.fr/api/backup/list
```

---

## 🗑 Sécurité — pourquoi `~/backups/btp/` et pas `public_html` ?

Le dossier `~/backups/btp/` est **HORS** du Document Root du sous-domaine
(`~/intranet.jacobhabitat-dev.fr/`). Apache ne peut donc pas servir ces fichiers
à un visiteur web — ils sont accessibles uniquement via :
- Les endpoints `/api/backup/*` qui exigent l'authentification JWT
- L'accès SSH/FTP du compte cPanel

C'est volontaire : sinon n'importe qui pourrait télécharger ta DB en
devinant le nom du fichier.

---

## 🧹 Suppression de l'intégration OneDrive (TODO)

Voici les fichiers à supprimer/nettoyer (à faire dans une prochaine session
quand le serveur backup aura été testé en conditions réelles) :

### Fichiers à supprimer
- `apps/desktop/src/features/settings/components/OneDriveSection.tsx`
- `apps/desktop/src/features/settings/components/OneDriveStartupCheck.tsx`

### Fichiers à modifier
- `apps/desktop/src/stores/backupStore.ts` — retirer les champs `autoUploadToOneDrive`, `oneDriveSyncIntervalMin`, `oneDriveRetentionCount`, `checkOneDriveOnStartup`, `requireMicrosoftLogin`, `lastUploadedDbHash`
- `apps/desktop/src/features/settings/components/BackupSection.tsx` — retirer les options OneDrive
- `apps/desktop/src/app/layouts/DashboardLayout.tsx` — retirer le `<OneDriveStartupCheck />`
- `apps/desktop/electron/msGraph.js` — garder uniquement le `sendMail` (Outlook), retirer `uploadBackup` et compagnie
- `apps/desktop/electron/main.js` — retirer les handlers IPC `cloud:*`, `onedrive:*`

### Garder pour l'instant
- `apps/desktop/electron/msAuth.js` (login Microsoft — utile pour Outlook + Calendar)
- `apps/desktop/src/stores/microsoftStore.ts` (idem)
- `apps/desktop/src/features/settings/components/MicrosoftSection.tsx` (statut connexion MS)

---

## 📅 Plan court-terme

| Tâche | État |
|---|---|
| Backend invoices + paiements | ✅ déployé |
| Backend backup serveur | ✅ déployé (cron à activer) |
| **Activer cron quotidien** | ⏳ à faire (étape 1-3 ci-dessus) |
| **Test backup manuel via curl** | ⏳ recommandé |
| Suppression OneDrive backup | 🚧 prochaine session |
| UI Backup serveur dans desktop | 🚧 prochaine session |
| `apps/web` (web app o2switch) | 🚧 prochaine session |
