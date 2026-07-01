import { motion } from "framer-motion";
import { Outlet } from "react-router-dom";

// ═══════════════════════════════════════════════════════════════════════════
// AuthLayout — Layout pour les écrans d'authentification (login, reset)
// Fond : halo primaire en haut, grille discrète masquée au centre, deux
// lueurs d'angle. Carte centrée, animation d'entrée.
// ═══════════════════════════════════════════════════════════════════════════

export function AuthLayout() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Décoration fond */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        {/* Halo principal en haut */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,hsl(var(--primary)/0.15),transparent_70%)]" />
        {/* Grille discrète, estompée vers les bords */}
        <div
          className="absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        {/* Lueurs d'angle */}
        <div className="absolute -top-16 -left-16 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-16 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md px-4 py-10"
      >
        <Outlet />
      </motion.div>
    </div>
  );
}
