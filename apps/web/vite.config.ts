import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "/", // déployé à la racine du sous-domaine
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@btp/core": path.resolve(__dirname, "../../packages/core/src"),
      "@btp/types": path.resolve(__dirname, "../../packages/types/src"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      // En dev, /api est proxifié vers le backend local Express
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
});
