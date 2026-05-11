# Migration du déploiement : cPanel git → GitHub Actions

Cette doc décrit la sortie progressive des artefacts `dist/` du dépôt git, et
le remplacement du pipeline `.cpanel.yml` par le workflow GitHub Actions
`.github/workflows/deploy.yml`.

## État actuel

- `apps/server/dist/` est explicitement **non-gitignored** (whitelist dans
  `.gitignore`) et committé.
- `apps/web/dist/` est gitignored mais d'anciens fichiers traînent en tracked
  (force-add historique).
- Le déploiement passe par `.cpanel.yml` : cPanel pull le repo et rsync
  sources + dist vers le doc root.

Conséquence : chaque PR front/back doit re-builder localement et commiter le
`dist/`, ce qui pollue les diffs et alourdit l'historique.

## Cible

- Plus aucun `dist/` dans git.
- `.cpanel.yml` supprimé.
- Le workflow GitHub Actions build dans le runner Ubuntu puis rsync via SSH
  vers o2switch et touche `tmp/restart.txt` pour redémarrer Passenger.

## Étapes (à faire dans l'ordre)

### 1. Ajouter les secrets GitHub

Dans `Settings → Secrets and variables → Actions → New repository secret`,
crée ces quatre secrets :

| Secret                  | Exemple                                          |
| ----------------------- | ------------------------------------------------ |
| `O2SWITCH_HOST`         | `nXX.o2switch.net`                               |
| `O2SWITCH_USER`         | ton login cPanel                                 |
| `O2SWITCH_SSH_KEY`      | contenu **complet** de la clé privée (PEM)       |
| `O2SWITCH_DEPLOY_PATH`  | `/home/<user>/intranet.jacobhabitat-dev.fr`      |

Pour générer la clé si tu n'en as pas :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/o2switch_deploy -C "github-actions"
# Copie ~/.ssh/o2switch_deploy.pub dans cPanel → SSH Access → Manage SSH Keys
# Colle le contenu de ~/.ssh/o2switch_deploy (la PRIVÉE) dans le secret O2SWITCH_SSH_KEY
```

### 2. Tester en dry-run

Va dans `Actions → Deploy to o2switch → Run workflow`, coche `dry_run: true`
et lance. Le workflow fait un `rsync --dry-run` : il liste ce qu'il
**aurait** copié sans rien écrire sur le serveur.

Vérifie que la liste est cohérente (sources + dist construits dans le
runner).

### 3. Déploiement réel

Re-lance le workflow sans dry-run. Vérifie ensuite :

- Site web `https://intranet.jacobhabitat-dev.fr/` toujours OK
- API serveur répond (health-check de ton choix)
- `tmp/restart.txt` a bien été touché (Passenger a redémarré)

### 4. Cutover : retirer les dist du git

Une fois le déploiement GitHub Actions validé :

```bash
# 1. Retirer apps/web/dist du tracking
git rm -r --cached apps/web/dist

# 2. Retirer apps/server/dist du tracking
git rm -r --cached apps/server/dist

# 3. Nettoyer le .gitignore — supprimer la whitelist server :
#    !apps/server/dist/
#    !apps/server/dist/**

# 4. Supprimer le pipeline cPanel
git rm .cpanel.yml

# 5. Désactiver le déploiement cPanel côté o2switch :
#    cPanel → Git Version Control → décocher "Deploy on push" sur ton repo
#    (ou supprimer le repo de cPanel — il restera sur GitHub uniquement)

git commit -m "chore(deploy): switch to GitHub Actions, drop committed dist + .cpanel.yml"
git push
```

### 5. Activer le déploiement auto (optionnel)

Une fois confiant, dans `.github/workflows/deploy.yml`, décommente le
trigger `push: branches: [main]` pour déployer automatiquement à chaque
push sur main.

## Rollback

Si quelque chose casse à l'étape 3 :

- Sur cPanel, fais un « Deploy HEAD Commit » manuel via Git Version Control
  pour repasser sur la version `.cpanel.yml` précédente.
- Le `.cpanel.yml` est toujours dans le repo tant que l'étape 4 n'est pas
  faite, donc rien n'est cassé côté cPanel.

## Notes

- Le workflow **ne fait pas** `npm install --omit=dev` sur le serveur. Si tu
  ajoutes une nouvelle dépendance runtime, il faut toujours te connecter en
  SSH et faire `npm install --omit=dev` une fois, comme aujourd'hui.
- Le runner GitHub Actions tourne sur Ubuntu : le build se fait sur Node 20,
  identique à o2switch. Aucun module natif n'est rebuild ici (le serveur
  Express n'a pas de native deps).
