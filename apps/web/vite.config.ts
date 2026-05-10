import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// ═══════════════════════════════════════════════════════════════════════════
// Vite config web — la SPA réutilise directement le source de apps/desktop/src
//
// Stratégie : un seul code source pour les deux apps. Le shim installé au
// démarrage (lib/btpAPI-shim.ts) émule window.btpAPI via fetch /api/*.
// ═══════════════════════════════════════════════════════════════════════════

const desktopSrc = path.resolve(__dirname, "../desktop/src");
const webSrc = path.resolve(__dirname, "src");

export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: [
      // L'alias "@" pointe par DÉFAUT sur apps/desktop/src.
      // Ainsi, tous les imports @/components, @/features, @/stores, etc.
      // résolvent dans le code source desktop.
      // EXCEPTION : on override certains chemins web-specific.
      {
        find: /^@\/lib\/btpAPI-shim$/,
        replacement: path.join(webSrc, "lib/btpAPI-shim.ts"),
      },
      { find: "@/web", replacement: webSrc },
      { find: "@", replacement: desktopSrc },
      { find: "@btp/core", replacement: path.resolve(__dirname, "../../packages/core/src") },
      { find: "@btp/types", replacement: path.resolve(__dirname, "../../packages/types/src") },
      { find: "@btp/ui", replacement: path.resolve(__dirname, "../../packages/ui/src") },
    ],
  },
  server: {
    port: 5174,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  define: {
    // Désactive certains comportements Electron-only à la compilation
    "process.platform": JSON.stringify("web"),
  },
});
