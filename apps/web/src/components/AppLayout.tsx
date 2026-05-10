import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Users, HardHat, FileText, Database, LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

const navItems = [
  { to: "/", label: "Accueil", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/chantiers", label: "Chantiers", icon: HardHat },
  { to: "/factures", label: "Factures", icon: FileText },
  { to: "/sauvegardes", label: "Sauvegardes", icon: Database },
];

export function AppLayout() {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* ─── Sidebar (md+) ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-60 flex-col bg-bg-elevated border-r border-border">
        <div className="p-4 border-b border-border">
          <div className="font-bold text-lg">BatiDesk</div>
          <div className="text-xs text-text-muted">Intranet · {user?.username}</div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={logout}
          className="m-2 btn-ghost justify-start text-sm"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </aside>

      {/* ─── Contenu principal ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* ─── Bottom nav (mobile only) ──────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-bg-elevated border-t border-border flex items-stretch z-10">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                isActive ? "text-accent" : "text-text-muted"
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
