import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";

import { AppRouter } from "@/app/Router";
import { ChangePasswordModal } from "@/features/auth/components/ChangePasswordModal";
import { InactivityLogout } from "@/features/auth/components/InactivityLogout";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { useUsersStore } from "@/stores/usersStore";
import { initDeviceDetection } from "@/stores/deviceModeStore";

// ═══════════════════════════════════════════════════════════════════════════
// App — Point d'entrée React (après main.tsx)
// ═══════════════════════════════════════════════════════════════════════════

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  const applyTheme = useThemeStore((s) => s.applyTheme);
  const checkSetup = useAuthStore((s) => s.checkSetup);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const user = useAuthStore((s) => s.user);
  const loadUsers = useUsersStore((s) => s.load);

  useEffect(() => {
    // Appliquer le thème au démarrage (synchrone, sans I/O)
    applyTheme();
    // Restoration de session + check setup en parallèle, mais on attend les
    // deux avant de laisser le router décider de la page à afficher. Avant,
    // le `void restoreSession()` partait sans attendre et `checkSetup()` se
    // résolvait souvent en premier → l'UI montrait l'écran "Créer le 1er
    // admin" pendant 200ms avant de basculer sur la page authentifiée.
    void Promise.all([restoreSession(), checkSetup()]);
    // Démarre la détection device (mobile / standalone PWA / iOS)
    const cleanup = initDeviceDetection();

    // Si le serveur renvoie 401 (token expiré ou invalidé), le shim
    // dispatche "btp:auth-required" — on logout proprement côté UI.
    const onAuthRequired = (): void => {
      void useAuthStore.getState().logout();
    };
    window.addEventListener("btp:auth-required", onAuthRequired);

    // Le shim web émet "btp:api-error" pour les pannes réseau, timeouts, 5xx,
    // 429. Avant ça les erreurs étaient avalées silencieusement (catch +
    // valeur par défaut) et l'utilisateur voyait juste une UI vide.
    // On déduplique par message pour ne pas spammer si plusieurs requêtes
    // tombent en même temps.
    let lastErrorAt = 0;
    let lastErrorMsg = "";
    const onApiError = (e: Event): void => {
      const detail = (e as CustomEvent<{ message: string; kind: string; status?: number }>).detail;
      if (!detail) return;
      const now = Date.now();
      if (detail.message === lastErrorMsg && now - lastErrorAt < 3000) return;
      lastErrorMsg = detail.message;
      lastErrorAt = now;
      const title =
        detail.kind === "timeout"
          ? "Le serveur met du temps à répondre"
          : detail.kind === "network"
            ? "Pas de réseau"
            : "Erreur serveur";
      toast.error(title, { description: detail.message });
    };
    window.addEventListener("btp:api-error", onApiError as EventListener);

    return () => {
      cleanup?.();
      window.removeEventListener("btp:auth-required", onAuthRequired);
      window.removeEventListener("btp:api-error", onApiError as EventListener);
    };
  }, [applyTheme, checkSetup, restoreSession]);

  // Charge l'annuaire users dès qu'un user est connu (login OU rechargement de page)
  useEffect(() => {
    if (user) void loadUsers();
  }, [user, loadUsers]);

  // Style visuel global (choisi par l'admin, partagé via settings serveur) :
  // synchronisé au login puis à chaque mise à jour des réglages.
  useEffect(() => {
    if (!user) return;
    const sync = async (): Promise<void> => {
      try {
        const { getDataService } = await import("@/lib/dataService");
        const s = (await getDataService().getSettings()) as {
          themeStyle?: string;
          themeLiquidBlur?: number;
          themeLiquidCardOpacity?: number;
          themeLiquidGlow?: number;
        };
        const store = useThemeStore.getState();
        const style = s?.themeStyle;
        if (
          style &&
          (style === "classique" || style === "epure" || style === "liquid" || style === "techno") &&
          style !== store.uiStyle
        ) {
          store.setUiStyle(style);
        }
        // Réglages fins Liquid glass (stockés en unités entières côté settings)
        const liquid: Partial<{ blur: number; cardOpacity: number; glow: number }> = {};
        if (typeof s?.themeLiquidBlur === "number") liquid.blur = s.themeLiquidBlur;
        if (typeof s?.themeLiquidCardOpacity === "number") liquid.cardOpacity = s.themeLiquidCardOpacity / 100;
        if (typeof s?.themeLiquidGlow === "number") liquid.glow = s.themeLiquidGlow / 100;
        if (Object.keys(liquid).length > 0) store.setLiquid(liquid);
      } catch {
        /* best-effort : garde le style local */
      }
    };
    void sync();
    const onUpdated = (): void => void sync();
    window.addEventListener("btp:settings-updated", onUpdated);
    return () => window.removeEventListener("btp:settings-updated", onUpdated);
  }, [user]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      {/* Modal bloquant si l'utilisateur doit changer son mot de passe à
          la 1ère connexion (mustChangePassword = 1) */}
      <ChangePasswordModal />
      {/* Déconnexion automatique après inactivité (durée réglable dans Paramètres) */}
      <InactivityLogout />
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "bg-card border-border",
            title: "text-card-foreground",
            description: "text-muted-foreground",
          },
        }}
      />
    </QueryClientProvider>
  );
}
