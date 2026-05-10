import React from "react";
import ReactDOM from "react-dom/client";
import { installBtpApiShim } from "./lib/btpAPI-shim";

// 1. Installer le shim window.btpAPI AVANT que l'App desktop ne s'évalue
installBtpApiShim();

// 2. Mode sombre par défaut (préférence respectée si déjà stockée)
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

// 3. Charger l'App de l'app desktop (alias "@" résout vers ../desktop/src)
import("@/App").then(({ App }) => {
  // 4. Charger les styles globaux (toujours desktop)
  import("@/styles/globals.css");

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
