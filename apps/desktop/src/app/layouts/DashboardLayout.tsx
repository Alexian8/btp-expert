import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CommandPaletteProvider } from "@/features/command-palette/components/CommandPaletteProvider";
import { useCommandPalette } from "@/features/command-palette/components/CommandPaletteProvider";
import { OnboardingGate } from "@/features/onboarding/components/OnboardingGate";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Receipt,
  Hammer,
  Users,
  Calendar,
  Archive,
  Settings,
  LogOut,
  Building2,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  User as UserIcon,
  Search,
  Package,
  Check,
  BarChart3,
  Wallet,
  HardHat,
  Activity,
  FileSignature,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useSidebarPrefsStore } from "@/stores/sidebarPrefsStore";
import { useChantierCategoriesStore } from "@/stores/chantierCategoriesStore";
import { useBackupStore, startOneDriveScheduler } from "@/stores/backupStore";
import { OneDriveStartupCheck } from "@/features/settings/components/OneDriveStartupCheck";
import { useClientsStore } from "@/stores/clientsStore";
import { useSuppliersStore } from "@/stores/suppliersStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useInvoicesStore } from "@/stores/invoicesStore";

// ─── Logos (importés comme modules pour que Vite les bundle correctement) ───
import logoSquareUrl from "@/assets/logo-square.png";
import logoHorizontalUrl from "@/assets/logo-horizontal.png";

// ═══════════════════════════════════════════════════════════════════════════
// DashboardLayout v3 — Shell applicatif avec navigation complète
// ═══════════════════════════════════════════════════════════════════════════

const navigation = [
  { id: "dashboard",      to: "/",                  label: "Tableau de bord", icon: LayoutDashboard, end: true, badgeKey: null },
  { id: "quotes",         to: "/quotes",            label: "Devis & Factures", icon: Receipt, badgeKey: "quotes" as const },
  { id: "chantiers",      to: "/chantiers",         label: "Chantiers", icon: Hammer, badgeKey: "chantiers" as const },
  { id: "clients",        to: "/clients",           label: "Clients", icon: Users, badgeKey: "clients" as const },
  { id: "suppliers",      to: "/suppliers",         label: "Fournisseurs", icon: Package, badgeKey: "suppliers" as const },
  { id: "calendar",       to: "/calendar",          label: "Agenda", icon: Calendar, badgeKey: null },
  { id: "expenses",       to: "/expenses",          label: "Dépenses", icon: Receipt, badgeKey: null },
  { id: "expense-notes",  to: "/expense-notes",     label: "Notes de frais", icon: Wallet, badgeKey: null },
  { id: "subcontractors", to: "/subcontractors",    label: "Sous-traitants", icon: HardHat, badgeKey: null },
  { id: "finances",       to: "/finances",          label: "Finances", icon: BarChart3, badgeKey: null },
  { id: "statistics",     to: "/statistics",        label: "Statistiques", icon: Activity, badgeKey: null },
  { id: "admin-docs",     to: "/admin-docs",        label: "Documents admin", icon: FileSignature, badgeKey: null },
  { id: "vault",          to: "/vault",             label: "Coffre-fort", icon: Archive, badgeKey: null },
];

export function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const { mode, setMode, hideSidebarBadges } = useThemeStore();
  const { order, hidden, syncWithCurrentNav } = useSidebarPrefsStore();
  const checkOneDriveOnStartup = useBackupStore((s) => s.checkOneDriveOnStartup);
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  // Sync au démarrage : ajoute les nouveaux items, retire les disparus
  useEffect(() => {
    syncWithCurrentNav(navigation.map((n) => n.id));
  }, []);

  const clientsCount = useClientsStore((s) => s.clients.length);
  const suppliersCount = useSuppliersStore((s) => s.suppliers.length);
  const chantiersCount = useChantiersStore((s) => s.chantiers.filter(c => c.status === "en-cours").length);
  const quotesCount = useQuotesStore((s) => s.quotes.filter(q => q.status === "brouillon" || q.status === "envoye").length);
  const invoicesCount = useInvoicesStore((s) => s.invoices.filter(i => i.status === "envoyee" || i.status === "partiellement-payee").length);
  const combinedInvoicesQuotesCount = quotesCount + invoicesCount;
  const fetchClients = useClientsStore((s) => s.fetch);
  const fetchSuppliers = useSuppliersStore((s) => s.fetch);
  const fetchChantiers = useChantiersStore((s) => s.fetch);
  const fetchQuotes = useQuotesStore((s) => s.fetch);
  const fetchInvoices = useInvoicesStore((s) => s.fetch);
  const fetchChantierCategories = useChantierCategoriesStore((s) => s.fetch);

  useEffect(() => {
    if (user) {
      fetchClients();
      fetchSuppliers();
      fetchChantiers();
      fetchQuotes();
      fetchInvoices();
      fetchChantierCategories();

      // Session iOS-1.5 : démarrer le scheduler OneDrive au login
      startOneDriveScheduler();

      // Session 12 : toast si RDV aujourd'hui
      if (window.btpAPI?.agendaListToday) {
        window.btpAPI.agendaListToday().then((events) => {
          if (events.length === 0) return;
          // Petit délai pour ne pas être trop intrusif au démarrage
          setTimeout(() => {
            const count = events.length;
            const todayStr = events.length === 1
              ? `1 événement aujourd'hui : ${events[0].title}`
              : `${count} événements prévus aujourd'hui`;
            toast.info(todayStr, {
              description: "Cliquez pour ouvrir l'agenda",
              duration: 6000,
              action: {
                label: "Voir",
                onClick: () => navigate("/calendar"),
              },
            });
          }, 1500);
        }).catch(() => {});
      }
    }
  }, [user, fetchClients, fetchSuppliers, fetchChantiers, fetchQuotes, fetchInvoices]);

  const badges: Record<string, number> = {
    clients: clientsCount,
    suppliers: suppliersCount,
    chantiers: chantiersCount,
    quotes: combinedInvoicesQuotesCount,
  };

  const currentNav = navigation.find(
    (n) => n.to === location.pathname || (n.to !== "/" && location.pathname.startsWith(n.to))
  );
  const pageTitle =
    currentNav?.label || (location.pathname === "/settings" ? "Paramètres" : "BatiDesk");

  return (
    <CommandPaletteProvider>
    <div className="h-screen flex bg-background">
      <OnboardingGate />
      <OneDriveStartupCheck enabled={checkOneDriveOnStartup} />
      {/* SIDEBAR */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-200 relative",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-20 z-10 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shadow-soft-sm hover:bg-accent transition-colors"
          title={collapsed ? "Déplier" : "Replier"}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        <div className="h-16 flex items-center justify-center px-4 border-b border-border overflow-hidden">
          {collapsed ? (
            /* Replié : logo carré seul, centré, taille modérée */
            <img
              src={logoSquareUrl}
              alt="BatiDesk"
              className="w-10 h-10 rounded-lg object-contain shrink-0"
            />
          ) : (
            /* Déplié : logo horizontal, respect du ratio, aligné à gauche */
            <motion.img
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              src={logoHorizontalUrl}
              alt="BatiDesk"
              className="h-10 w-auto object-contain"
              style={{ maxWidth: "100%" }}
            />
          )}
          <span className="sr-only">BatiDesk v16.0.0</span>
        </div>

        {/* Bouton recherche globale (Cmd+K) */}
        <div className="px-2 pt-3">
          <SearchTrigger collapsed={collapsed} />
        </div>

        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {(() => {
            // Calcule la liste effective : ordre persisté + masquage
            const byId = new Map(navigation.map((n) => [n.id, n]));
            const ordered = order
              .map((id) => byId.get(id))
              .filter((x): x is typeof navigation[number] => Boolean(x))
              .filter((item) => !hidden.includes(item.id));
            // Items qui n'étaient pas dans l'ordre (sécurité) → en fin de liste
            const missing = navigation.filter(
              (n) => !order.includes(n.id) && !hidden.includes(n.id)
            );
            return [...ordered, ...missing];
          })().map((item) => {
            const badge = item.badgeKey ? badges[item.badgeKey] : null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-accent text-accent-foreground",
                    collapsed && "justify-center"
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{item.label}</span>
                    {!hideSidebarBadges && badge !== null && badge > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <Separator />

        <div className="p-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all",
                "hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-accent text-accent-foreground",
                collapsed && "justify-center"
              )
            }
            title={collapsed ? "Paramètres" : undefined}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Paramètres</span>}
          </NavLink>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div>
            <h2 className="text-base font-semibold tracking-tight">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                className="w-64 h-8 pl-9 text-xs bg-background"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {mode === "light" && <Sun className="h-4 w-4" />}
                  {mode === "dark" && <Moon className="h-4 w-4" />}
                  {mode === "system" && <Monitor className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Apparence</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setMode("light")}>
                  <Sun className="w-4 h-4" /> Clair
                  {mode === "light" && <Check className="ml-auto w-3.5 h-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMode("dark")}>
                  <Moon className="w-4 h-4" /> Sombre
                  {mode === "dark" && <Check className="ml-auto w-3.5 h-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMode("system")}>
                  <Monitor className="w-4 h-4" /> Système
                  {mode === "system" && <Check className="ml-auto w-3.5 h-3.5" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent transition-colors">
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                    {user?.username?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-medium leading-tight">{user?.username}</p>
                    <p className="text-[10px] text-muted-foreground">{user?.role}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="text-sm font-semibold">{user?.username}</p>
                    <p className="text-xs text-muted-foreground font-normal">
                      {user?.role === "admin" ? "Administrateur" : "Utilisateur"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <UserIcon className="w-4 h-4" />
                  <span>Mon compte</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="w-4 h-4" />
                  <span>Paramètres</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Se déconnecter</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 overflow-auto"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
    </CommandPaletteProvider>
  );
}

// ─── SearchTrigger : bouton sidebar pour ouvrir la palette ────────────────
function SearchTrigger({ collapsed }: { collapsed: boolean }) {
  const { setOpen } = useCommandPalette();
  const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");

  return (
    <button
      onClick={() => setOpen(true)}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all",
        "border border-border bg-muted/30 hover:bg-accent hover:border-primary/30",
        "text-muted-foreground hover:text-foreground",
        collapsed && "justify-center px-0"
      )}
      title={collapsed ? "Recherche (Ctrl+K)" : undefined}
    >
      <Search className="w-4 h-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left text-[13px]">Rechercher</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-border font-mono">
            {isMac ? "⌘K" : "Ctrl+K"}
          </kbd>
        </>
      )}
    </button>
  );
}
