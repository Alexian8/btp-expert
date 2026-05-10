import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/index.css";

// Mode sombre par défaut (comme l'app desktop)
// Respecte aussi la préférence utilisateur si déjà stockée
const stored = (() => {
  try {
    return localStorage.getItem("btp.web.theme");
  } catch {
    return null;
  }
})();
const theme = stored ?? "dark";
if (theme === "dark") document.documentElement.classList.add("dark");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
