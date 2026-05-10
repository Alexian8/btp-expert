import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Hammer,
  Receipt,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Minus,
  Database,
  Users,
  ArrowRight,
  Activity,
  ClipboardCheck,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

import { cn } from "@btp/ui";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { formatCurrency } from "@btp/core";
import type { Invoice } from "@btp/types";

interface Counts {
  clients: number;
  chantiers: number;
  invoices: number;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function formatToday(): string {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface Kpi {
  label: string;
  value: string;
  icon: typeof Hammer;
  color: string;
  to: string;
  trend?: number | null;
}

export function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, ch, inv, allInvoices] = await Promise.all([
          api.clients.count(),
          api.chantiers.count(),
          api.invoices.count(),
          api.invoices.findAll(),
        ]);
        if (!cancelled) {
          setCounts({ clients: c, chantiers: ch, invoices: inv });
          setInvoices(allInvoices as unknown as Invoice[]);
        }
      } catch {
        if (!cancelled) {
          setCounts({ clients: 0, chantiers: 0, invoices: 0 });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = useMemo(() => getGreeting(), []);

  // CA encaissé ce mois / mois précédent / année
  const caCeMois = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return invoices.reduce((sum, i) => {
      if (!i.issueDate || i.status === "annulee") return sum;
      const d = new Date(i.issueDate);
      if (!isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year) {
        return sum + (Number(i.totalPaid) || 0);
      }
      return sum;
    }, 0);
  }, [invoices]);

  const caMoisPrecedent = useMemo(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = prev.getMonth();
    const year = prev.getFullYear();
    return invoices.reduce((sum, i) => {
      if (!i.issueDate || i.status === "annulee") return sum;
      const d = new Date(i.issueDate);
      if (!isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year) {
        return sum + (Number(i.totalPaid) || 0);
      }
      return sum;
    }, 0);
  }, [invoices]);

  const caCetteAnnee = useMemo(() => {
    const year = new Date().getFullYear();
    return invoices.reduce((sum, i) => {
      if (!i.issueDate || i.status === "annulee") return sum;
      const d = new Date(i.issueDate);
      if (!isNaN(d.getTime()) && d.getFullYear() === year) {
        return sum + (Number(i.totalPaid) || 0);
      }
      return sum;
    }, 0);
  }, [invoices]);

  const variationCA = useMemo(() => {
    if (caMoisPrecedent === 0) return null;
    return Math.round(((caCeMois - caMoisPrecedent) / caMoisPrecedent) * 100);
  }, [caCeMois, caMoisPrecedent]);

  const brouillonsCount = useMemo(
    () => invoices.filter((i) => i.status === "brouillon").length,
    [invoices]
  );

  const kpis: Kpi[] = [
    {
      label: "CA encaissé ce mois",
      value: formatCurrency(caCeMois),
      icon: CreditCard,
      color: "bg-emerald-500/15 text-emerald-500",
      to: "/factures",
      trend: variationCA,
    },
    {
      label: "CA encaissé cette année",
      value: formatCurrency(caCetteAnnee),
      icon: TrendingUp,
      color: "bg-teal-500/15 text-teal-500",
      to: "/factures",
    },
    {
      label: "Chantiers",
      value: String(counts?.chantiers ?? 0),
      icon: Hammer,
      color: "bg-blue-500/15 text-blue-500",
      to: "/chantiers",
    },
    {
      label: "Factures (brouillons)",
      value: String(brouillonsCount),
      icon: Receipt,
      color: "bg-amber-500/15 text-amber-500",
      to: "/factures",
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {greeting}
              {user?.username ? `, ${user.username}` : ""}
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              v1.0.0
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{formatToday()}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => navigate("/factures")}>
            <Plus className="w-4 h-4" />
            Nouveau devis
          </Button>
          <Button variant="outline" onClick={() => navigate("/chantiers")}>
            <Hammer className="w-4 h-4" />
            Nouveau chantier
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi, idx) => {
          const TrendIcon =
            kpi.trend == null
              ? null
              : kpi.trend > 0
              ? TrendingUp
              : kpi.trend < 0
              ? TrendingDown
              : Minus;
          const trendColor =
            kpi.trend == null
              ? ""
              : kpi.trend > 0
              ? "text-emerald-500"
              : kpi.trend < 0
              ? "text-red-500"
              : "text-muted-foreground";
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => navigate(kpi.to)}
              className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 hover:shadow-soft-sm cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center",
                    kpi.color
                  )}
                >
                  <kpi.icon className="w-4 h-4" />
                </div>
                {TrendIcon && (
                  <span
                    className={cn(
                      "text-[10px] font-semibold flex items-center gap-0.5",
                      trendColor
                    )}
                  >
                    <TrendIcon className="w-3 h-3" />
                    {kpi.trend! > 0 ? "+" : ""}
                    {kpi.trend}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold tabular-nums mt-0.5 truncate">{kpi.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Grid : Raccourcis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Dernières factures
          </h3>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Aucune facture pour l'instant.</p>
          ) : (
            <div className="space-y-1.5">
              {invoices.slice(0, 5).map((inv) => (
                <button
                  key={(inv as { id: string }).id}
                  onClick={() => navigate("/factures")}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium font-mono truncate">
                      {inv.reference || "Sans n°"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {inv.title || "Sans titre"}
                    </p>
                  </div>
                  <div className="text-sm font-semibold tabular-nums shrink-0 ml-2">
                    {formatCurrency(inv.totalTTC ?? 0)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Raccourcis
          </h3>
          <div className="space-y-1.5">
            <ShortcutLink icon={Users} label="Voir les clients" to="/clients" navigate={navigate} />
            <ShortcutLink icon={Hammer} label="Voir les chantiers" to="/chantiers" navigate={navigate} />
            <ShortcutLink icon={Receipt} label="Voir les factures" to="/factures" navigate={navigate} />
            <ShortcutLink
              icon={Database}
              label="État des sauvegardes"
              to="/sauvegardes"
              navigate={navigate}
            />
          </div>
        </div>
      </div>

      {/* État zen */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">Intranet connecté à o2switch</p>
          <p className="text-xs text-muted-foreground">
            Tes données sont synchronisées avec le serveur. Tu peux y accéder depuis n'importe où.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function ShortcutLink({
  icon: Icon,
  label,
  to,
  navigate,
}: {
  icon: typeof Hammer;
  label: string;
  to: string;
  navigate: (to: string) => void;
}) {
  return (
    <button
      onClick={() => navigate(to)}
      className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent transition-colors text-left"
    >
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-sm flex-1 truncate">{label}</span>
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
    </button>
  );
}
