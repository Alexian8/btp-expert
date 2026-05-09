# 🔐 Microsoft Azure Setup — Guide OAuth pour BTP Expert

> Ce guide explique comment configurer un compte Microsoft Azure Developer
> pour activer l'intégration OneDrive + Outlook + Calendar dans BTP Expert.
>
> **À faire quand tu seras prêt à brancher l'OAuth** (pas maintenant).

---

## 🎯 Pourquoi Microsoft Azure ?

Avec un Client ID Azure, BTP Expert pourra :

- ☁️ **OneDrive** : sauvegarde automatique sans dossier local nécessaire
- 📧 **Outlook Mail** : envoi des devis/factures directement depuis l'app
- 📅 **Calendar** : synchronisation bi-directionnelle de l'agenda
- 👥 **Contacts Outlook** : import des clients depuis ton carnet d'adresses
- 📎 **Microsoft Graph API** : accès à plein d'autres services Microsoft 365

---

## 📋 Prérequis

- Un compte Microsoft personnel **OU** un compte Microsoft 365 professionnel
- 15 minutes devant toi

---

## 🚀 Étape 1 — Créer un compte Azure Developer (gratuit)

### 1.1. Va sur Azure Portal

🔗 [https://portal.azure.com](https://portal.azure.com)

Connecte-toi avec ton compte Microsoft (celui d'Outlook / OneDrive).

### 1.2. Créer un abonnement Azure gratuit (si demandé)

- Azure propose un **tier gratuit** qui suffit largement pour l'usage de BTP Expert
- **Aucune facturation** sauf si tu dépasses les limites (impossible en usage normal)
- Si demandé, accepte les conditions et crée un compte "Pay-As-You-Go" (mais tu ne paieras rien)

---

## 🔧 Étape 2 — Enregistrer l'application BTP Expert

### 2.1. Aller dans "App registrations"

Dans Azure Portal, cherche **"App registrations"** dans la barre de recherche du haut, puis clique dessus.

### 2.2. Nouvelle inscription

Clique **"+ New registration"** (Nouvelle inscription).

Remplis le formulaire :

| Champ | Valeur |
|---|---|
| **Name** | `BTP Expert Desktop` |
| **Supported account types** | Choisis **"Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts"** |
| **Redirect URI (optional)** | Type : **Public client/native (mobile & desktop)** — URL : `http://localhost:3000/auth/callback` |

Clique **"Register"**.

### 2.3. Récupérer le Client ID

Sur la page suivante, tu verras :
- **Application (client) ID** : c'est un UUID comme `12345678-abcd-1234-abcd-123456789abc`

👉 **Copie cette valeur**, c'est ton **Client ID**. Tu me le donneras quand on fera la session "OAuth activation".

---

## 🔑 Étape 3 — Configurer les permissions (scopes)

### 3.1. Dans le menu de ton app

Clique sur **"API permissions"** dans le menu de gauche.

### 3.2. Ajouter les permissions

Clique **"+ Add a permission"** → **Microsoft Graph** → **Delegated permissions**.

Coche ces scopes :

#### Pour OneDrive (backup)
- `Files.ReadWrite` — lire/écrire les fichiers de l'utilisateur
- `Files.ReadWrite.AppFolder` — créer un dossier dédié à BTP Expert

#### Pour Outlook (email)
- `Mail.Send` — envoyer des emails
- `Mail.ReadWrite` — lire/gérer les emails (pour template)

#### Pour Calendar (agenda)
- `Calendars.ReadWrite` — gérer les événements du calendrier

#### Pour Contacts
- `Contacts.Read` — lire les contacts (import clients)

#### Permissions de base (toujours requises)
- `User.Read` — lire le profil (nom, email)
- `offline_access` — rester connecté (refresh token)

Clique **"Add permissions"**.

### 3.3. Grant admin consent (si compte perso, skip)

Si tu es sur un compte Microsoft 365 pro, clique **"Grant admin consent for [ton org]"**.

---

## 🛡 Étape 4 — Authentification

### 4.1. Dans le menu

Clique sur **"Authentication"** dans le menu de gauche.

### 4.2. Configurer la platform Public client

Vérifie que :
- **Redirect URIs** contient `http://localhost:3000/auth/callback`
- **Allow public client flows** → **Yes** (important pour Electron desktop)

Clique **"Save"**.

---

## ✅ Étape 5 — C'est fini !

Tu as maintenant :
- ✅ Un **Client ID** : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- ✅ Une app Azure configurée avec les bonnes permissions
- ✅ Un redirect URI valide pour l'OAuth Electron

### Donne-moi le Client ID dans la session OAuth

Quand on fera la session "OAuth activation", tu me donneras le Client ID et je le configurerai dans le code BTP Expert. Ça prendra **5 minutes** côté code.

---

## 🔒 Sécurité — ce qu'il faut savoir

- **Ton Client ID n'est pas un secret critique** : il identifie juste ton app, c'est public (comme une clé d'API publique)
- Ce qui est sensible, ce sont les **tokens d'utilisateur** que BTP Expert recevra après login, mais ils sont stockés de façon chiffrée localement sur ton PC
- Tu peux **révoquer l'accès à tout moment** depuis [https://account.microsoft.com/privacy/app-access](https://account.microsoft.com/privacy/app-access)

---

## 🐛 Problèmes courants

### "AADSTS700016: Application not found"
→ Le Client ID n'est pas bon. Copie-le à nouveau depuis Azure Portal.

### "AADSTS500113: No reply address is registered"
→ Le Redirect URI n'est pas bien configuré. Va dans **Authentication** et vérifie qu'il y a bien `http://localhost:3000/auth/callback`.

### "AADSTS65001: User has not consented"
→ Les permissions ne sont pas acceptées. Refais l'étape 3.

### Le popup OAuth ne s'ouvre pas
→ Vérifie que **"Allow public client flows"** est sur **Yes** dans Authentication.

---

## 💰 Coûts

**ZÉRO euro.** Microsoft Graph API pour un usage personnel / petite entreprise est entièrement gratuit :

- Limite d'appels : **plusieurs milliers par minute** (largement suffisant)
- Stockage OneDrive : utilise ton quota existant (5 Go gratuit de base)
- Emails Outlook : utilise ton quota Outlook existant

---

## 🎯 Prochaine session "OAuth Activation"

Quand tu auras suivi ce guide et obtenu ton Client ID, dis :

> "Session OAuth — j'ai mon Client ID : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`"

Et je ferai :
1. Installer la lib `@azure/msal-node` dans le projet
2. Configurer le `MicrosoftGraphProvider`
3. Remplacer le bouton "Bientôt disponible" par un vrai "Se connecter à Microsoft"
4. Brancher OneDrive sur le backup auto
5. Préparer les futures intégrations Outlook / Calendar

**Temps estimé** : 1 session (2-3h de code).

---

## 📚 Ressources officielles

- [Microsoft Graph overview](https://learn.microsoft.com/en-us/graph/overview)
- [Register an application with the Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [MSAL.js for Electron](https://learn.microsoft.com/en-us/entra/msal/node/)

---

**Pas urgent** : tu peux garder la v16 en "Option A" (backup local dans dossier OneDrive synchronisé) pendant des mois. L'OAuth native sera un + quand tu seras prêt.
