import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

import { cn } from "@btp/ui";

// ═══════════════════════════════════════════════════════════════════════════
// SideDrawer — volet coulissant depuis la droite (desktop) / plein écran bas
// (mobile). Remplace les modales centrées pour les fiches et formulaires.
// Transitions transform/opacity, ~250 ms. Ferme au clic sur l'overlay + Échap.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Largeur du volet sur desktop (classe Tailwind max-w-*). */
  widthClass?: string;
  /** Contenu du pied (boutons d'action). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function SideDrawer({ open, onClose, title, subtitle, widthClass = "max-w-xl", footer, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Panneau : à droite plein hauteur sur desktop, feuille basse sur mobile */}
          <motion.div
            initial={{ x: "100%", y: 0 }}
            animate={{ x: 0, y: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.28 }}
            className={cn(
              "absolute top-0 right-0 h-full w-full bg-card border-l border-border shadow-soft-xl flex flex-col",
              widthClass
            )}
            role="dialog"
            aria-modal="true"
          >
            {(title || subtitle) && (
              <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-border shrink-0">
                <div className="min-w-0">
                  {title && <h2 className="text-lg font-semibold truncate">{title}</h2>}
                  {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 -mr-1 rounded-md hover:bg-accent text-muted-foreground transition-colors shrink-0"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
            {footer && (
              <div className="border-t border-border p-4 bg-muted/20 shrink-0">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
