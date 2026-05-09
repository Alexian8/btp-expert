// ═══════════════════════════════════════════════════════════════════════════
// MicrosoftAuth — Service OAuth Microsoft pour Electron
// Utilise @azure/msal-node avec PKCE + loopback interactive flow
// ═══════════════════════════════════════════════════════════════════════════

const { PublicClientApplication, CryptoProvider } = require("@azure/msal-node");
const { shell, safeStorage, app } = require("electron");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const { URL } = require("node:url");

// ─── Configuration ───────────────────────────────────────────────────────
const CLIENT_ID = process.env.VITE_MICROSOFT_CLIENT_ID || "bb94c2c0-b3f8-4998-bfb0-946580c886c9";
const AUTHORITY = process.env.VITE_MICROSOFT_AUTHORITY || "https://login.microsoftonline.com/common";
const REDIRECT_URI = process.env.VITE_MICROSOFT_REDIRECT_URI || "http://localhost:42813/oauth/callback";
const REDIRECT_PORT = parseInt(new URL(REDIRECT_URI).port || "42813", 10);
const DEFAULT_SCOPES = [
  "Files.ReadWrite.AppFolder",
  "Files.ReadWrite",
  "Mail.Send",
  "Calendars.ReadWrite",
  "User.Read",
  "offline_access",
];

const TOKEN_FILE = () => path.join(app.getPath("userData"), "ms-auth-cache.bin");

// ─── Cache plugin pour persister les tokens de façon chiffrée ────────────
const cachePlugin = {
  async beforeCacheAccess(cacheContext) {
    try {
      const file = TOKEN_FILE();
      if (fs.existsSync(file)) {
        const encrypted = fs.readFileSync(file);
        if (safeStorage.isEncryptionAvailable()) {
          const decrypted = safeStorage.decryptString(encrypted);
          cacheContext.tokenCache.deserialize(decrypted);
        } else {
          // Fallback : stockage en clair (pas idéal mais fonctionnel)
          cacheContext.tokenCache.deserialize(encrypted.toString("utf-8"));
        }
      }
    } catch (e) {
      console.warn("[MS Auth] Cache read error:", e.message);
    }
  },
  async afterCacheAccess(cacheContext) {
    try {
      if (cacheContext.cacheHasChanged) {
        const serialized = cacheContext.tokenCache.serialize();
        const file = TOKEN_FILE();
        if (safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(serialized);
          fs.writeFileSync(file, encrypted);
        } else {
          fs.writeFileSync(file, serialized, "utf-8");
        }
      }
    } catch (e) {
      console.warn("[MS Auth] Cache write error:", e.message);
    }
  },
};

// ─── MSAL application ────────────────────────────────────────────────────
let pca = null;

function getPCA() {
  if (pca) return pca;
  pca = new PublicClientApplication({
    auth: {
      clientId: CLIENT_ID,
      authority: AUTHORITY,
    },
    cache: {
      cachePlugin,
    },
    system: {
      loggerOptions: {
        loggerCallback: (_level, message) => {
          if (process.env.NODE_ENV !== "production") {
            // console.log("[MSAL]", message);
          }
        },
        piiLoggingEnabled: false,
      },
    },
  });
  return pca;
}

// ─── Loopback server (pour récupérer le code OAuth) ──────────────────────
function startLoopbackServer(state) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
        if (reqUrl.pathname === "/oauth/callback") {
          const code = reqUrl.searchParams.get("code");
          const err = reqUrl.searchParams.get("error");
          const errDesc = reqUrl.searchParams.get("error_description");
          const returnedState = reqUrl.searchParams.get("state");

          // HTML de confirmation dans le navigateur
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>BatiDesk - Connexion Microsoft</title>
<style>
  body { font-family: -apple-system, Segoe UI, system-ui, sans-serif; background: #0a0b0f; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #16181f; border: 1px solid #2a2d38; border-radius: 16px; padding: 40px; max-width: 440px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  .icon { width: 64px; height: 64px; background: ${err ? "#ef444420" : "#10b98120"}; color: ${err ? "#ef4444" : "#10b981"}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; }
  h1 { margin: 0 0 8px; font-size: 20px; }
  p { color: #94a3b8; margin: 0; line-height: 1.5; font-size: 14px; }
  .footer { margin-top: 24px; font-size: 12px; color: #64748b; }
</style></head>
<body>
  <div class="card">
    <div class="icon">${err ? "✕" : "✓"}</div>
    <h1>${err ? "Connexion échouée" : "Connexion réussie"}</h1>
    <p>${err ? (errDesc || err) : "Vous pouvez fermer cette fenêtre et retourner dans BatiDesk."}</p>
    <p class="footer">BatiDesk v16 · JACOB HABITAT</p>
  </div>
  <script>setTimeout(() => window.close(), 2500);</script>
</body></html>`);

          server.close();
          if (err) {
            return reject(new Error(errDesc || err));
          }
          if (!code) {
            return reject(new Error("Aucun code reçu de Microsoft"));
          }
          if (state && returnedState && state !== returnedState) {
            return reject(new Error("State mismatch (CSRF protection)"));
          }
          return resolve(code);
        }
        res.writeHead(404);
        res.end("Not found");
      } catch (e) {
        res.writeHead(500);
        res.end("Error");
        reject(e);
      }
    });

    server.on("error", (e) => reject(e));
    server.listen(REDIRECT_PORT, "127.0.0.1", () => {
      // Ready
    });

    // Timeout après 5 min
    setTimeout(() => {
      try { server.close(); } catch {}
      reject(new Error("Timeout : pas de réponse Microsoft après 5 minutes"));
    }, 5 * 60 * 1000);
  });
}

// ─── Login interactif ────────────────────────────────────────────────────
async function login(scopes = DEFAULT_SCOPES) {
  const pcaApp = getPCA();

  // Génération du PKCE
  const cryptoProvider = new CryptoProvider();
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
  const state = cryptoProvider.createNewGuid();

  // URL d'authentification
  const authCodeUrlParams = {
    scopes,
    redirectUri: REDIRECT_URI,
    codeChallenge: challenge,
    codeChallengeMethod: "S256",
    state,
    prompt: "select_account",
  };

  const authUrl = await pcaApp.getAuthCodeUrl(authCodeUrlParams);

  // Démarrer le serveur loopback AVANT d'ouvrir le navigateur
  const codePromise = startLoopbackServer(state);

  // Ouvrir le navigateur par défaut sur la page Microsoft
  await shell.openExternal(authUrl);

  // Attendre le callback
  const code = await codePromise;

  // Échanger le code contre un token
  const tokenResponse = await pcaApp.acquireTokenByCode({
    code,
    scopes,
    redirectUri: REDIRECT_URI,
    codeVerifier: verifier,
    state,
  });

  return {
    account: tokenResponse.account,
    accessToken: tokenResponse.accessToken,
    expiresOn: tokenResponse.expiresOn,
  };
}

// ─── Logout ──────────────────────────────────────────────────────────────
async function logout() {
  const pcaApp = getPCA();
  const cache = pcaApp.getTokenCache();
  const accounts = await cache.getAllAccounts();
  for (const acc of accounts) {
    await cache.removeAccount(acc);
  }
  // Supprimer aussi le fichier cache
  try {
    const f = TOKEN_FILE();
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } catch {}
  return { success: true };
}

// ─── Get current account (without login) ─────────────────────────────────
async function getAccount() {
  try {
    const pcaApp = getPCA();
    const accounts = await pcaApp.getTokenCache().getAllAccounts();
    return accounts[0] || null;
  } catch {
    return null;
  }
}

// ─── Get access token (refresh silently if needed) ───────────────────────
async function getAccessToken(scopes = DEFAULT_SCOPES) {
  const pcaApp = getPCA();
  const accounts = await pcaApp.getTokenCache().getAllAccounts();
  if (accounts.length === 0) {
    throw new Error("Non connecté à Microsoft. Merci de vous connecter.");
  }
  try {
    const response = await pcaApp.acquireTokenSilent({
      account: accounts[0],
      scopes,
      forceRefresh: false,
    });
    return response.accessToken;
  } catch (e) {
    // Si le silent refresh échoue, il faut re-login
    throw new Error("Session Microsoft expirée, merci de vous reconnecter.");
  }
}

module.exports = {
  login,
  logout,
  getAccount,
  getAccessToken,
  DEFAULT_SCOPES,
  CLIENT_ID,
};
