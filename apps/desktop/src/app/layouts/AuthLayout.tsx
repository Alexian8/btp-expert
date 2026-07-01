import { motion } from "framer-motion";
import { Outlet } from "react-router-dom";

// ═══════════════════════════════════════════════════════════════════════════
// AuthLayout — Layout pour les écrans d'authentification (login, reset)
// Esprit « liquid glass » : fond calme, grandes lueurs douces et floues,
// aucune texture technique. Carte centrée, animation d'entrée.
// ═══════════════════════════════════════════════════════════════════════════

export function AuthLayout() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Décoration fond : lueurs liquides, très diffuses */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-15%,hsl(var(--primary)/0.12),transparent_70%)]" />
        <div className="absolute top-1/3 -left-32 w-[28rem] h-[28rem] bg-primary/[0.07] rounded-full blur-[100px]" />
        <div className="absolute -bottom-32 -right-24 w-[30rem] h-[30rem] bg-primary/[0.09] rounded-full blur-[110px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-md px-4 py-10"
      >
        <Outlet />
      </motion.div>
    </div>
  );
}
