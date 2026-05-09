// ═══════════════════════════════════════════════════════════════════════════
// DataServiceFactory — choisit l'implémentation IDataService selon l'env
//
// Permet de basculer du mode desktop (SQLite local via Electron IPC)
// vers le mode web/serveur (REST distant) sans toucher aux features.
//
// Activation du mode serveur :
//   .env → VITE_USE_REMOTE_API=true
//          VITE_API_BASE_URL=https://api.batidesk.fr
//
// Tous les écrans existants continuent de marcher : ils consomment
// `getDataService()` qui retourne maintenant l'instance choisie.
// ═══════════════════════════════════════════════════════════════════════════

import type { IDataService } from "@btp/core";
import { ApiDataService } from "@btp/core";
import { getDataService as getElectronDataService } from "./dataService";

let cached: IDataService | null = null;

function isRemoteMode(): boolean {
  // Vite expose les variables préfixées VITE_ via import.meta.env
  return String(import.meta.env.VITE_USE_REMOTE_API ?? "").toLowerCase() === "true";
}

function getRemoteBaseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL;
  if (!url) {
    throw new Error(
      "VITE_USE_REMOTE_API=true mais VITE_API_BASE_URL est vide. " +
        "Renseignez l'URL du serveur dans .env."
    );
  }
  return String(url);
}

/**
 * Récupère l'auth token courant pour les requêtes vers le backend.
 * À brancher sur le store auth (Zustand) — pour l'instant lit le localStorage.
 */
function getAuthToken(): string | null {
  try {
    return localStorage.getItem("btp.authToken");
  } catch {
    return null;
  }
}

export function getDataService(): IDataService {
  if (cached) return cached;

  if (isRemoteMode()) {
    cached = new ApiDataService({
      baseUrl: getRemoteBaseUrl(),
      tokenProvider: getAuthToken,
      onTokenReceived: (token) => {
        try {
          localStorage.setItem("btp.authToken", token);
        } catch {}
      },
      onUnauthorized: () => {
        try {
          localStorage.removeItem("btp.authToken");
        } catch {}
        // Le store auth surveillera ce flag pour rediriger vers /login
        window.dispatchEvent(new CustomEvent("btp:auth-required"));
      },
    });
  } else {
    cached = getElectronDataService();
  }
  return cached;
}

/** Pour les tests — réinitialise le cache singleton. */
export function resetDataService(): void {
  cached = null;
}
