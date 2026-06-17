import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { getDataService } from "@/lib/dataService";
import { DEFAULT_SESSION_INACTIVITY_MINUTES } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// InactivityLogout — déconnexion automatique après une période d'inactivité.
//
// La durée est lue dans les Paramètres (`sessionInactivityMinutes`, défaut 30,
// 0 = désactivé). 60 s avant la coupure, une modale d'avertissement s'affiche
// avec un compte à rebours et un bouton « Rester connecté ». Pendant
// l'avertissement, l'activité (souris/clavier) n'annule PAS la coupure : il
// faut cliquer explicitement. Fonctionne en web ET desktop (100 % client).
// ═══════════════════════════════════════════════════════════════════════════

const WARNING_SECONDS = 60;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;

export function InactivityLogout() {
  const user = useAuthStore((s) => s.user);
  const [timeoutMin, setTimeoutMin] = useState<number>(DEFAULT_SESSION_INACTIVITY_MINUTES);
  const [warningOpen, setWarningOpen] = useState(false);
  const [remaining, setRemaining] = useState(WARNING_SECONDS);

  const warningRef = useRef(false);
  const stayRef = useRef<() => void>(() => {});

  // ─── Charge la durée configurée (et la recharge si les réglages changent) ──
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const s = await getDataService().getSettings();
        const v = (s as { sessionInactivityMinutes?: number })?.sessionInactivityMinutes;
        if (alive) setTimeoutMin(typeof v === "number" ? v : DEFAULT_SESSION_INACTIVITY_MINUTES);
      } catch {
        /* garde le défaut */
      }
    };
    void load();
    const onUpdated = (): void => void load();
    window.addEventListener("btp:settings-updated", onUpdated);
    window.addEventListener("focus", onUpdated);
    return () => {
      alive = false;
      window.removeEventListener("btp:settings-updated", onUpdated);
      window.removeEventListener("focus", onUpdated);
    };
  }, [user]);

  // ─── Arme les minuteries et écoute l'activité ─────────────────────────────
  useEffect(() => {
    if (!user || !timeoutMin || timeoutMin <= 0) return; // désactivé

    let warnTimer: ReturnType<typeof setTimeout> | undefined;
    let logoutTimer: ReturnType<typeof setTimeout> | undefined;
    let countdown: ReturnType<typeof setInterval> | undefined;
    let lastArm = 0;

    const clearAll = (): void => {
      if (warnTimer) clearTimeout(warnTimer);
      if (logoutTimer) clearTimeout(logoutTimer);
      if (countdown) clearInterval(countdown);
    };

    const logoutNow = (): void => {
      clearAll();
      warningRef.current = false;
      setWarningOpen(false);
      toast.message("Déconnexion automatique", { description: "Session fermée pour inactivité." });
      void useAuthStore.getState().logout();
    };

    const showWarning = (): void => {
      warningRef.current = true;
      setRemaining(WARNING_SECONDS);
      setWarningOpen(true);
      countdown = setInterval(() => setRemaining((r) => (r > 1 ? r - 1 : 0)), 1000);
    };

    const arm = (): void => {
      clearAll();
      warningRef.current = false;
      setWarningOpen(false);
      const total = timeoutMin * 60_000;
      warnTimer = setTimeout(showWarning, Math.max(0, total - WARNING_SECONDS * 1000));
      logoutTimer = setTimeout(logoutNow, total);
    };

    const onActivity = (): void => {
      if (warningRef.current) return; // pendant l'avertissement : clic requis
      const now = Date.now();
      if (now - lastArm < 1000) return; // throttle
      lastArm = now;
      arm();
    };

    stayRef.current = arm;
    arm();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [user, timeoutMin]);

  return (
    <AnimatePresence>
      {warningOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-md w-full p-6 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Toujours là ?</h2>
            <p className="text-sm text-muted-foreground mb-1">
              Vous allez être déconnecté pour inactivité dans
            </p>
            <p className="text-3xl font-bold tabular-nums mb-4">{remaining}s</p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => void useAuthStore.getState().logout()}>
                Se déconnecter
              </Button>
              <Button onClick={() => stayRef.current()}>Rester connecté</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
