import React from "react";
import ReactDOM from "react-dom/client";
import { installBtpApiShim } from "./lib/btpAPI-shim";
import { initSentry } from "./lib/sentry";

initSentry();

// ─── Capture des erreurs de boot pour les afficher visuellement ──────────
function showFatal(err: unknown): void {
  const root = document.getElementById("root");
  if (!root) return;
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack || ""}` : String(err);
  root.innerHTML = `
    <div style="font-family: -apple-system, system-ui, sans-serif; padding: 24px; max-width: 720px; margin: 32px auto; background: #16181f; color: #e7e9ee; border: 1px solid #2a2d38; border-radius: 12px;">
      <h2 style="margin: 0 0 12px; color: #ef4444;">⚠️ Erreur de chargement</h2>
      <p style="color: #94a3b8; margin: 0 0 16px;">L'app n'a pas pu démarrer. Détail technique :</p>
      <pre style="background: #0a0b0f; padding: 12px; border-radius: 8px; overflow: auto; font-size: 12px; white-space: pre-wrap; word-break: break-word;">${msg
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>
      <button onclick="location.reload()" style="margin-top: 16px; background: #3b82f6; color: white; border: 0; padding: 8px 16px; border-radius: 8px; cursor: pointer;">Recharger</button>
    </div>
  `;
}

window.addEventListener("error", (e) => {
  console.error("[main] error event:", e.error);
  showFatal(e.error || e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[main] unhandledrejection:", e.reason);
  showFatal(e.reason);
});

try {
  // 1. Installer le shim window.btpAPI
  installBtpApiShim();

  // 2. Mode sombre par défaut
  const stored = (() => {
    try {
      return localStorage.getItem("btp.web.theme");
    } catch {
      return null;
    }
  })();
  if ((stored ?? "dark") === "dark") {
    document.documentElement.classList.add("dark");
  }

  // 3. Charger l'App desktop (alias "@" → ../desktop/src)
  Promise.all([import("@/App"), import("@/styles/globals.css")])
    .then(([mod]) => {
      const App = (mod as { App: React.ComponentType }).App;
      if (!App) throw new Error("Export `App` introuvable dans @/App");
      ReactDOM.createRoot(document.getElementById("root")!).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    })
    .catch(showFatal);
} catch (e) {
  showFatal(e);
}
