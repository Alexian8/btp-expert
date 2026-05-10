import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Receipt,
  Hammer,
  Users,
  Database,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
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
import logoSquareUrl from "@/assets/logo-square.png";
import logoHorizontalUrl from "@/assets/logo-horizontal.png";

// Navigation alignée sur celle de l'app desktop. Les pages non encore branchées
// côté serveur sont volontairement omises ; on les ajoutera quand /api/quotes,
// /api/vault, etc. seront prêts.
const navigation = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/factures", label: "Factures", icon: Receipt },
  { to: "/chantiers", label: "Chantiers", icon: Hammer },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/sauvegardes", label: "Sauvegardes", icon: Database },
];

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentNav = navigation.find(
    (n) => n.to === location.pathname || (n.to !== "/" && location.pathname.startsWith(n.to))
  );
  const pageTitle = currentNav?.label || "BatiDesk";

  return (
    <div className="h-screen flex bg-background">
      {/* SIDEBAR */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 relative",
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
            <img
              src={logoSquareUrl}
              alt="BatiDesk"
              className="w-10 h-10 rounded-lg object-contain shrink-0"
            />
          ) : (
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
        </div>

        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => (
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
              {!collapsed && <span className="truncate flex-1">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <Separator />
        <div className="p-2">
          <Button
            variant="ghost"
            onClick={logout}
            className={cn("w-full justify-start", collapsed && "justify-center px-0")}
            title={collapsed ? "Déconnexion" : undefined}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && "Déconnexion"}
          </Button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {/* Burger mobile */}
            <button
              className="md:hidden p-2 -ml-2"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h2 className="text-base font-semibold tracking-tight">{pageTitle}</h2>
          </div>

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
              <DropdownMenuItem onClick={() => navigate("/sauvegardes")}>
                <Database className="w-4 h-4" />
                <span>Sauvegardes</span>
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

      {/* Sidebar mobile en overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="w-64 h-full bg-card flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-16 flex items-center px-4 border-b border-border">
              <img src={logoHorizontalUrl} alt="BatiDesk" className="h-9 w-auto object-contain" />
            </div>
            <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all",
                      "hover:bg-accent hover:text-accent-foreground",
                      isActive && "bg-accent text-accent-foreground"
                    )
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <Separator />
            <div className="p-2">
              <Button variant="ghost" onClick={logout} className="w-full justify-start">
                <LogOut className="w-4 h-4" />
                Déconnexion
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
