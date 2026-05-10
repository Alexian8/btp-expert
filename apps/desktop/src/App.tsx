import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

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
  const user = useAuthStore((s) => s.user);
  const loadUsers = useUsersStore((s) => s.load);

  useEffect(() => {
    // Appliquer le thème au démarrage
    applyTheme();
    // Vérifier si c'est la 1ère utilisation
    checkSetup();
    // Démarre la détection device (mobile / standalone PWA / iOS)
    const cleanup = initDeviceDetection();
    return cleanup;
  }, [applyTheme, checkSetup]);

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
