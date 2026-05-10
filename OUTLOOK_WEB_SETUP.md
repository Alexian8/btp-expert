# 📧 Configuration Outlook web (Microsoft OAuth + Graph API)

L'envoi d'emails Outlook depuis la web app utilise OAuth 2.0 web (redirect classique)
avec stockage des tokens côté serveur en MySQL.

## 1. App Registration sur Azure

1. https://portal.azure.com → **Azure Active Directory** → **App registrations** → **New registration**
2. Remplir :
   - **Name** : `BatiDesk Web`
   - **Supported account types** : *Accounts in any organizational directory and personal Microsoft accounts*
   - **Redirect URI** : *Web* + `https://intranet.jacobhabitat-dev.fr/api/auth/microsoft/callback`
3. Clique **Register**.
4. Copie le **Application (client) ID** affiché → ce sera ton `MS_CLIENT_ID`.

## 2. Créer un client secret

1. Dans la même app → **Certificates & secrets** → **+ New client secret**
2. Description : `BatiDesk web prod` · Expiration : 24 months
3. Copie la **Value** (PAS la Secret ID) → ce sera ton `MS_CLIENT_SECRET`.
   ⚠️ Tu ne pourras plus la voir après avoir quitté la page.

## 3. Configurer les permissions

1. **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**
2. Coche :
   - `User.Read` (déjà coché par défaut)
   - `Mail.Send` (envoi d'email depuis ton compte)
   - `Calendars.ReadWrite` (sync agenda)
   - `Files.ReadWrite.AppFolder` (backup OneDrive — optionnel)
   - `offline_access` (refresh token)
3. **Grant admin consent** (si tu es admin) — sinon ce sera demandé à chaque user au premier login.

## 4. Configurer les variables d'environnement serveur

Sur cPanel → **Setup Node.js App** → **Environment variables** → ajoute :

```
MS_CLIENT_ID=<le client ID de l'étape 1>
MS_CLIENT_SECRET=<le secret de l'étape 2>
MS_TENANT=common
MS_REDIRECT_URI=https://intranet.jacobhabitat-dev.fr/api/auth/microsoft/callback
MS_SCOPES=offline_access User.Read Mail.Send Calendars.ReadWrite Files.ReadWrite.AppFolder
```

Clique **Save** puis **Restart App**.

## 5. Vérifier côté `.env` doc root

Si tu utilises un `.env` au lieu de Setup Node.js App, ajoute les mêmes variables dans :

```
~/intranet.jacobhabitat-dev.fr/.env
```

## 6. Tester le flow

### Depuis le navigateur (manuel)

1. Login sur `https://intranet.jacobhabitat-dev.fr/`
2. Récupère ton token JWT depuis DevTools → Application → Local Storage → `btp.web.token`
3. Va sur `https://intranet.jacobhabitat-dev.fr/api/auth/microsoft/login?token=<ton-jwt>`
4. Tu es redirigé vers Microsoft → autorise → tu reviens avec « Connexion réussie »
5. Vérifie : `GET /api/auth/microsoft/account` (avec Bearer token) doit retourner `{connected: true, accountEmail: "..."}`

### Envoi de mail (curl)

```bash
curl -X POST https://intranet.jacobhabitat-dev.fr/api/email/send \
  -H "Authorization: Bearer <ton-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": ["destinataire@example.com"],
    "subject": "Test BatiDesk",
    "body": "<p>Hello !</p>",
    "isHtml": true
  }'
```

Réponse `202` = email envoyé via Graph API depuis ton compte Outlook.

## 7. Endpoints exposés

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/auth/microsoft/login?token=<JWT>` | Démarre le flow OAuth (redirect Microsoft) |
| `GET` | `/api/auth/microsoft/callback` | Callback Microsoft (auto, pas appelé par toi) |
| `GET` | `/api/auth/microsoft/account` | Statut connexion (auth Bearer) |
| `POST` | `/api/auth/microsoft/logout` | Supprime les tokens (auth Bearer) |
| `POST` | `/api/email/send` | Envoie un email (auth Bearer) |

## 8. Sécurité

- Les **access tokens Microsoft** sont stockés chiffrés côté MySQL (table `oauth_tokens`)
- Le **client secret** ne quitte jamais le serveur
- Le PKCE (code verifier S256) protège du vol de code en transit
- Le **state OAuth** protège contre CSRF (10 min de validité)

---

## 🚧 Limitations actuelles

- **Pas d'UI dans la web app pour cliquer "Connecter Microsoft"** — il faut passer par l'URL manuelle (étape 6). UI à ajouter dans Settings web.
- **PDF côté web non implémenté** : Puppeteer ne marche pas sur o2switch mutualisé (pas de Chrome installable). Solutions possibles à explorer :
  - **browserless.io** ($10/mo) — service Chrome remote, le serveur appelle leur API
  - **@react-pdf/renderer** côté client — réécriture des templates en composants React-PDF
  - **window.print()** côté client — popup imprimer/save as PDF, basique
  - **PDFShift / DocRaptor** — services HTML→PDF payants
