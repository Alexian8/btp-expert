import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";

import { AppRouter } from "@/app/Router";
import { ChangePasswordModal } from "@/features/auth/components/ChangePasswordModal";
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
    // Appliquer le thème au démarrage
    applyTheme();
    // Restaure la session (mode web : JWT en localStorage → /api/auth/me).
    // En parallèle de checkSetup (sont indépendants).
    void restoreSession();
    // Vérifier si c'est la 1ère utilisation
    checkSetup();
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

  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      {/* Modal bloquant si l'utilisateur doit changer son mot de passe à
          la 1ère connexion (mustChangePassword = 1) */}
      <ChangePasswordModal />
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
