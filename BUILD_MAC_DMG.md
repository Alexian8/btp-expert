# 🍎 Construire BatiDesk pour Mac (DMG)

Guide pas-à-pas pour construire l'installeur DMG de BatiDesk depuis un Mac.

---

## ⚠️ Pré-requis : un Mac

Le build Mac (`.dmg`, `.app`) ne peut se faire **que sur macOS**.
C'est une contrainte Apple, pas électron-builder.

Tu peux utiliser :
- Ton propre Mac (Intel ou Apple Silicon M1/M2/M3/M4)
- Un Mac d'un proche / collaborateur
- Un Mac loué temporairement (Scaleway, MacInCloud)

**Recommandé** : macOS 12 (Monterey) ou plus récent.

---

## 🛠 Étape 1 — Installer les outils sur le Mac

### 1.1 — Installer Homebrew (si pas déjà fait)

Ouvre un terminal et lance :

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 1.2 — Installer Node.js 20

```bash
brew install node@20
brew link --overwrite node@20

# Vérifier
node --version  # doit afficher v20.x.x
npm --version   # doit afficher 10.x.x
```

### 1.3 — Installer Git (si pas déjà fait)

```bash
brew install git
```

### 1.4 — Installer Xcode Command Line Tools

Indispensable pour compiler `better-sqlite3` (module natif).

```bash
xcode-select --install
```

Si déjà installé, le terminal te dira "command line tools are already installed".

---

## 📂 Étape 2 — Récupérer le projet sur le Mac

### Méthode A — Tu as Git

```bash
cd ~/Desktop
git clone <url-de-ton-repo> btp-expert
cd btp-expert
```

### Méthode B — Tu n'as pas Git, transférer depuis Windows

**Option 1 — Clé USB** :
1. Sur le PC Windows, copie tout le dossier `C:\Users\Alexi\Desktop\btp-expert\` sur la clé
2. **Important** : exclus `node_modules/`, `dist/`, et `dist_electron/` (énormes et inutiles)
3. Branche la clé sur le Mac
4. Copie sur le bureau du Mac : `~/Desktop/btp-expert/`

**Option 2 — Cloud (OneDrive, iCloud, Drive...)** :
1. Zip le projet sur Windows (en excluant `node_modules`, `dist*`)
2. Upload sur OneDrive
3. Télécharge sur le Mac
4. Décompresse dans `~/Desktop/btp-expert/`

**Option 3 — Réseau local (rsync)** :
```bash
# Depuis le Mac, si Windows a un partage réseau actif
rsync -av --exclude='node_modules' --exclude='dist*' \
  /Volumes/SHARE/btp-expert/ ~/Desktop/btp-expert/
```

---

## 📦 Étape 3 — Installer les dépendances sur le Mac

Depuis le terminal, dans le dossier du projet :

```bash
cd ~/Desktop/btp-expert
npm install
```

**Cette étape peut prendre 5-10 min** la première fois.

`better-sqlite3` se recompile automatiquement pour macOS (Intel ou Apple Silicon
selon ton Mac). C'est normal de voir des messages "node-gyp" qui défilent.

⚠️ Si erreur "Python not found" :
```bash
brew install python
```

⚠️ Si erreur "node-gyp" persistante :
```bash
npm install -g node-gyp
npm rebuild better-sqlite3
```

---

## 🚀 Étape 4 — Construire le DMG

### Build standard (les 2 architectures)

```bash
cd ~/Desktop/btp-expert
npm run dist:mac
```

**Résultat** dans `apps/desktop/dist_electron/` :
- `BatiDesk-1.0.0.dmg`           — Mac Intel x64
- `BatiDesk-1.0.0-arm64.dmg`     — Mac Apple Silicon (M1/M2/M3/M4)
- `BatiDesk-1.0.0-mac.zip`       — ZIP Mac Intel (alternative)
- `BatiDesk-1.0.0-arm64-mac.zip` — ZIP Mac Apple Silicon

### Build pour ton Mac uniquement (plus rapide)

Si tu construis juste pour toi et que tu sais quel CPU tu as :

```bash
# Pour Apple Silicon (M1/M2/M3/M4)
npm run dist:mac:arm

# Pour Mac Intel
npm run dist:mac:intel
```

**Temps estimé** :
- Build pour 1 archi : ~3-5 min
- Build pour les 2 archis : ~6-10 min

---

## 🧪 Étape 5 — Tester le DMG

1. Double-clic sur `BatiDesk-1.0.0.dmg`
2. Le DMG s'ouvre comme un disque virtuel
3. **Glisse l'icône BatiDesk vers le dossier "Applications"**
4. Éjecte le DMG (clic droit > Éjecter)
5. Va dans Applications, double-clic BatiDesk

### ⚠️ Premier lancement — Avertissement Gatekeeper

Comme ton app n'est pas signée par un certificat Apple Developer, macOS affiche :

> "BatiDesk" ne peut pas être ouvert car le développeur n'a pas pu être vérifié.

**Solution** :
1. Click droit sur l'icône BatiDesk (dans Applications)
2. Choisir "**Ouvrir**" (pas double-clic)
3. macOS reformule : "Êtes-vous sûr de vouloir ouvrir cette app ?"
4. Click "**Ouvrir**"
5. ✅ BatiDesk démarre normalement

**Cette manipulation est nécessaire UNE SEULE fois par Mac**.
Aux lancements suivants, double-clic fonctionne normalement.

---

## 🔐 Optionnel — Signature Apple (99 $/an)

Comme pour Windows, tu peux signer ton DMG pour éviter le warning Gatekeeper.

**Apple Developer Program** : 99 $/an

Une fois inscrit, tu obtiens :
- Un **Developer ID Application** (pour signer les binaires)
- Un **Developer ID Installer** (pour signer les installeurs)
- Accès à la **notarisation Apple** (vérification automatique)

### Configuration electron-builder pour la signature Mac

Variables d'environnement à définir avant le build :

```bash
# Identifiant de signature
export CSC_NAME="Developer ID Application: TON NOM (TEAMID)"

# Pour la notarisation (recommandée)
export APPLE_ID="ton-email@apple.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID"

# Lance le build signé + notarisé
npm run dist:mac
```

`electron-builder` détectera automatiquement ces variables et signera le DMG.

📚 Doc complète :
https://www.electron.build/code-signing#macos

---

## ❓ Problèmes courants

### "Module did not self-register" au lancement

Le `better-sqlite3` n'est pas compilé pour la bonne architecture.

```bash
cd ~/Desktop/btp-expert
rm -rf node_modules
npm install
```

### "EACCES: permission denied" pendant le build

```bash
sudo chown -R $(whoami) ~/Desktop/btp-expert
```

### Build échoue avec "MAS validation"

Tu builds sans certificat → c'est normal. Le DMG est quand même créé,
juste pas signé. Lance avec :

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:mac
```

### "App is damaged and can't be opened"

Souvent dû au transfert via internet (macOS ajoute un attribut "quarantine").
Sur le Mac, terminal :

```bash
xattr -cr /Applications/BatiDesk.app
```

---

## 📋 Récap des commandes

```bash
# Setup initial (une fois)
brew install node@20 git
xcode-select --install

# Avec le projet sur le Mac
cd ~/Desktop/btp-expert
npm install

# Build DMG complet
npm run dist:mac

# Build DMG pour ton Mac uniquement
npm run dist:mac:arm   # Apple Silicon
npm run dist:mac:intel # Mac Intel

# Le DMG est dans apps/desktop/dist_electron/
open apps/desktop/dist_electron/
```

---

## 🎉 Distribuer ton DMG

Une fois le `.dmg` construit :

- **Test interne** : envoie-le par WeTransfer, AirDrop, OneDrive
- **Distribution publique** : héberge sur ton site web
- **Mise à jour automatique** : à voir en S25 (electron-updater)

Le DMG fait probablement **150-200 Mo** (Electron + Puppeteer Chromium bundlé).

---

**Tu es prêt à construire BatiDesk pour Mac !** 🚀
