import { motion } from "framer-motion";
import { Outlet } from "react-router-dom";

// ═══════════════════════════════════════════════════════════════════════════
// AuthLayout — Layout pour les écrans d'authentification (login, signup)
// Fond en dégradé subtil, carte centrée, animation d'entrée
// ═══════════════════════════════════════════════════════════════════════════

export function AuthLayout() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Décoration fond : dégradé subtil */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -right-4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md px-4"
      >
        <Outlet />
      </motion.div>
    </div>
  );
}
