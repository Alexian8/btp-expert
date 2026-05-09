# 🔐 Signature de code Windows — Guide complet

Ce guide explique comment signer ton installeur BatiDesk avec un certificat de
signature de code Windows (Authenticode). Une fois signé, Windows SmartScreen
fait moins de tapage et tes futurs utilisateurs voient "JACOB HABITAT" comme
éditeur vérifié.

---

## 📊 Comparatif des certificats

| Type             | Prix indicatif | SmartScreen          | Token USB | Recommandé pour |
|------------------|---------------|----------------------|-----------|-----------------|
| **Auto-signé**   | Gratuit       | ❌ Toujours warning  | Non       | Test / interne  |
| **OV standard**  | ~70-150 €/an  | ⚠️ Warning quelques mois (puis OK quand reputation acquise) | Non | Petits éditeurs |
| **EV**           | ~250-450 €/an | ✅ Vert immédiatement | **Oui** (token physique) | Distribution pro |

### 💡 Mon avis

- **Pour ton usage interne JACOB HABITAT** → certificat **OV** suffit largement.
  Le warning SmartScreen disparaît après quelques téléchargements/installations.

- **Si tu veux distribuer à des clients/partenaires** → **EV** vaut le coup.
  Pas de friction, expérience pro dès le premier téléchargement.

---

## 🛒 Où acheter un certificat OV (recommandé pour démarrer)

Revendeurs autorisés (prix au jour du write — vérifier) :

- **SSL.com** : ~75 $/an (Code Signing OV) — le moins cher, livraison rapide
- **Sectigo / Comodo** : ~95 €/an
- **DigiCert** : ~474 $/an (premium, support pro)
- **Certum** (Pologne, marché européen) : ~85 €/an — bonne option EU
- **GlobalSign** : ~250 €/an

**Pour commander tu auras besoin de :**
- N° SIRET de JACOB HABITAT (`51068269300013`) ✓
- Justificatif Kbis ou équivalent
- Téléphone professionnel
- Email professionnel
- Vérification de l'identité par le CA (certificate authority)

Délai : 1 à 5 jours ouvrés selon le CA et la rapidité de validation.

---

## 📥 Une fois le certificat reçu

Le CA te donnera un fichier `.pfx` ou `.p12` (PKCS#12) avec un mot de passe.
**C'est ce fichier qu'electron-builder utilise pour signer.**

⚠ **Garde ce fichier en lieu sûr** (coffre-fort, KeePass, etc.).
Ne le commit JAMAIS dans Git. Ne le partage pas par email.

---

## ⚙️ Configuration electron-builder (déjà faite)

Le `package.json` est déjà configuré pour utiliser les variables d'environnement
standard d'electron-builder :

```json
"win": {
  "signingHashAlgorithms": ["sha256"],
  "signDlls": true
  ...
}
```

**Tu n'as rien à modifier dans le code.** electron-builder détecte
automatiquement les variables d'environnement suivantes au moment du build :

| Variable                | Description                                         |
|-------------------------|-----------------------------------------------------|
| `CSC_LINK`              | Chemin absolu vers ton fichier `.pfx`               |
| `CSC_KEY_PASSWORD`      | Mot de passe du `.pfx`                              |

---

## 🚀 Construire un build signé

### Méthode 1 : Variables d'environnement temporaires (simple, recommandé)

Ouvre un terminal PowerShell **avec ces variables avant le build** :

```powershell
$env:CSC_LINK = "C:\Users\Alexi\Documents\jacob-habitat-signing.pfx"
$env:CSC_KEY_PASSWORD = "TON_MOT_DE_PASSE"

cd C:\Users\Alexi\Desktop\btp-expert
npm run release:win:signed
```

Les variables existent uniquement dans cette session PowerShell — elles
disparaissent quand tu fermes la fenêtre. Plus sûr.

### Méthode 2 : Fichier `.env.local` (pratique si tu builds souvent)

Crée un fichier `apps/desktop/.env.local` (déjà dans `.gitignore`) :

```env
CSC_LINK=C:\Users\Alexi\Documents\jacob-habitat-signing.pfx
CSC_KEY_PASSWORD=TON_MOT_DE_PASSE
```

Puis utilise un loader d'env (electron-builder lit déjà les variables OS).
Sur Windows, depuis PowerShell :

```powershell
Get-Content apps\desktop\.env.local | ForEach-Object {
  $name, $value = $_ -split '=', 2
  Set-Item -Path "env:$name" -Value $value
}
npm run release:win:signed
```

### Méthode 3 : Variables système permanentes (déconseillé)

Tu peux les mettre dans les "Variables d'environnement" Windows.
**Risqué** : toute application qui tourne sous ton user pourrait
théoriquement les lire. Préfère la méthode 1.

---

## 🧪 Vérifier qu'un build est bien signé

Une fois le build fait, va dans `apps/desktop/dist_electron/`.
Le fichier de setup s'appelle `BatiDesk-Setup-1.0.0.exe`.

**Click droit → Propriétés → onglet "Signatures numériques"**

Tu devrais voir :
- ✅ Nom du signataire : **JACOB HABITAT**
- ✅ Algorithme : SHA-256
- ✅ Horodatage (timestamp serveur)

Si l'onglet n'existe pas → le build n'a PAS été signé.
Vérifie que les variables `CSC_LINK` et `CSC_KEY_PASSWORD` étaient bien
définies au moment du `npm run release:win:signed`.

---

## 🆘 Build sans certificat (warning Windows mais ça marche)

Si tu n'as pas encore de certificat, tu peux quand même construire et installer
BatiDesk. Au moment de l'installation, Windows SmartScreen affichera :

> Windows a protégé votre PC
> Microsoft Defender SmartScreen a empêché le démarrage d'une application non reconnue.

→ Click sur **"Plus d'infos"** puis **"Exécuter quand même"**.
L'installation se déroule normalement.

Pour build non signé :

```powershell
npm run dist:win
```

---

## 📅 Renouvellement

Les certificats OV/EV expirent généralement après **1 à 3 ans**.

Quand tu renouvelles :
1. Reçois le nouveau `.pfx` du CA
2. Mets à jour `CSC_LINK` vers le nouveau fichier
3. **Re-signe les anciennes versions** si tu veux qu'elles continuent
   d'être validées (sinon le timestamp d'origine reste valide tant que
   le CA ne révoque pas le certif d'origine — donc rien à faire dans 99% des cas)

---

## 🛡️ Bonnes pratiques

- ❌ Ne JAMAIS commit le `.pfx` dans Git
- ❌ Ne JAMAIS mettre le mot de passe dans le code source
- ❌ Ne JAMAIS uploader le `.pfx` sur un serveur partagé
- ✅ Backup le `.pfx` sur un disque externe + chiffré (BitLocker / VeraCrypt)
- ✅ Stocke le mot de passe dans un gestionnaire (1Password, Bitwarden, KeePass)
- ✅ Pour CI/CD plus tard : utilise GitHub Secrets ou Azure Key Vault

---

## 🔗 Liens utiles

- [Doc electron-builder Code Signing](https://www.electron.build/code-signing)
- [SSL.com Code Signing](https://www.ssl.com/certificates/code-signing/)
- [Sectigo Code Signing](https://sectigo.com/ssl-certificates-tls/code-signing)
- [SmartScreen reputation building](https://docs.microsoft.com/en-us/windows/security/threat-protection/microsoft-defender-smartscreen/microsoft-defender-smartscreen-overview)

---

**Ce guide t'accompagne pour la 1.0.0 et toutes les futures versions.**
La config est pérenne — tu n'auras plus jamais à toucher au code,
juste à mettre à jour `CSC_LINK` quand tu renouvelles ton certificat.
