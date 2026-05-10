// ═══════════════════════════════════════════════════════════════════════════
// api.ts — instance unique d'ApiDataService pour la web app
//
// L'URL de base est dérivée :
//   - en prod : même origine que l'app (servie par Apache + Passenger),
//   - en dev : proxy /api → localhost:3001 (cf vite.config.ts)
// ═══════════════════════════════════════════════════════════════════════════

import { ApiDataService } from "@btp/core";

const TOKEN_KEY = "btp.web.token";

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore (quota, mode privé…)
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export const api = new ApiDataService({
  // Même origine — Apache route /api/* vers Passenger Node
  baseUrl: typeof window !== "undefined" ? window.location.origin : "",
  tokenProvider: getToken,
  onTokenReceived: setToken,
  onUnauthorized: () => {
    clearToken();
    window.dispatchEvent(new CustomEvent("btp:auth-required"));
  },
});

export { getToken };
