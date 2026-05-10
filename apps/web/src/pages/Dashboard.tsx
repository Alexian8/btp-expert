import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, HardHat, FileText, Database, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

interface Stats {
  clients: number;
  chantiers: number;
  invoices: number;
}

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, ch, inv] = await Promise.all([
          api.clients.count(),
          api.chantiers.count(),
          api.invoices.count(),
        ]);
        if (!cancelled) setStats({ clients: c, chantiers: ch, invoices: inv });
      } catch {
        if (!cancelled) setStats({ clients: 0, chantiers: 0, invoices: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { to: "/clients", label: "Clients", icon: Users, value: stats?.clients },
    { to: "/chantiers", label: "Chantiers", icon: HardHat, value: stats?.chantiers },
    { to: "/factures", label: "Factures", icon: FileText, value: stats?.invoices },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Bonjour, {user?.username}</h1>
        <p className="text-text-muted text-sm">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {cards.map(({ to, label, icon: Icon, value }) => (
          <Link
            key={to}
            to={to}
            className="card hover:border-accent transition-colors group"
          >
            <div className="flex items-center justify-between">
              <Icon size={20} className="text-text-secondary" />
              <ArrowRight
                size={16}
                className="text-text-muted group-hover:text-accent transition-colors"
              />
            </div>
            <div className="mt-2 text-2xl font-bold">{value ?? "—"}</div>
            <div className="text-xs text-text-muted">{label}</div>
          </Link>
        ))}
      </div>

      <Link to="/sauvegardes" className="card flex items-center gap-3 hover:border-accent">
        <Database size={20} className="text-text-secondary" />
        <div className="flex-1">
          <div className="font-medium">Sauvegardes</div>
          <div className="text-xs text-text-muted">État de la sauvegarde serveur</div>
        </div>
        <ArrowRight size={16} className="text-text-muted" />
      </Link>
    </div>
  );
}
