import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Hammer, Receipt, AlertTriangle, CreditCard, Lock,
  ArrowRight, Plus, Calendar, ClipboardCheck, Activity,
  FileSignature, FilePlus, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useInvoicesStore } from "@/stores/invoicesStore";
import { useStatsStore } from "@/stores/statsStore";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";
import { formatEuro } from "@btp/types";
import { UpcomingEventsWidget } from "@/features/agenda/components/UpcomingEventsWidget";

// ═══════════════════════════════════════════════════════════════════════════
// DashboardPage — Page d'accueil orientée ACTIONS (Session 19)
// Salutation contextuelle + alertes + raccourcis rapides + KPI
// ═══════════════════════════════════════════════════════════════════════════

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const fetchClients = useClientsStore((s) => s.fetch);
  const chantiers = useChantiersStore((s) => s.chantiers);
  const fetchChantiers = useChantiersStore((s) => s.fetch);
  const quotes = useQuotesStore((s) => s.quotes);
  const fetchQuotes = useQuotesStore((s) => s.fetch);
  const invoices = useInvoicesStore((s) => s.invoices);
  const fetchInvoices = useInvoicesStore((s) => s.fetch);

  const { paymentDelays, pipeline, fetchAll: fetchStatsAll } = useStatsStore();
  const { receptions, fetchReceptions } = useAdministrativeDocsStore();

  useEffect(() => {
    fetchClients();
    fetchChantiers();
    fetchQuotes();
    fetchInvoices();
    fetchStatsAll();
    fetchReceptions();
  }, []);

  // ─── Calculs ─────────────────────────────────────────────────────────────
  const greeting = useMemo(() => getGreeting(), []);

  const chantiersActifs = chantiers.filter((c) => c.status === "en-cours").length;
  const devisBrouillons = quotes.filter((q) => q.status === "brouillon").length;

  // Réserves en attente de levée
  const reservesEnCours = useMemo(() => {
    let count = 0;
    for (const r of receptions) {
      if (r.receptionType === "avec_reserves") count++;
    }
    return count;
  }, [receptions]);

  // CA encaissé ce mois
  const caCeMois = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return invoices.reduce((sum, i) => {
      if (!i.issueDate || i.status === "annulee") return sum;
      try {
        const d = new Date(i.issueDate);
        if (d.getMonth() === month && d.getFullYear() === year) {
          return sum + (i.totalPaid || 0);
        }
      } catch {}
      return sum;
    }, 0);
  }, [invoices]);

  // CA encaissé mois précédent (pour comparaison)
  const caMoisPrecedent = useMemo(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = prev.getMonth();
    const year = prev.getFullYear();
    return invoices.reduce((sum, i) => {
      if (!i.issueDate || i.status === "annulee") return sum;
      try {
        const d = new Date(i.issueDate);
        if (d.getMonth() === month && d.getFullYear() === year) {
          return sum + (i.totalPaid || 0);
        }
      } catch {}
      return sum;
    }, 0);
  }, [invoices]);

  // CA encaissé année en cours
  const caCetteAnnee = useMemo(() => {
    const year = new Date().getFullYear();
    return invoices.reduce((sum, i) => {
      if (!i.issueDate || i.status === "annulee") return sum;
      try {
        const d = new Date(i.issueDate);
        if (d.getFullYear() === year) {
          return sum + (i.totalPaid || 0);
        }
      } catch {}
      return sum;
    }, 0);
  }, [invoices]);

  // % d'évolution mois vs mois précédent
  const variationCA = useMemo(() => {
    if (caMoisPrecedent === 0) return null;
    const pct = ((caCeMois - caMoisPrecedent) / caMoisPrecedent) * 100;
    return Math.round(pct);
  }, [caCeMois, caMoisPrecedent]);

  // ─── Alertes regroupées ─────────────────────────────────────────────────
  const alerts: Alert[] = [];

  if (paymentDelays && paymentDelays.invoicesOverdueCount > 0) {
    alerts.push({
      type: "danger",
      icon: AlertTriangle,
      title: `${paymentDelays.invoicesOverdueCount} facture${paymentDelays.invoicesOverdueCount > 1 ? "s" : ""} en retard`,
      subtitle: `${formatEuro(paymentDelays.invoicesOverdueAmount)} à recouvrer`,
      action: "Voir les factures",
      onClick: () => navigate("/statistics"),
    });
  }

  if (pipeline && pipeline.oldEnvoyeCount > 0) {
    alerts.push({
      type: "warning",
      icon: Receipt,
      title: `${pipeline.oldEnvoyeCount} devis sans réponse depuis +30 jours`,
      subtitle: `${formatEuro(pipeline.oldEnvoyeAmount)} en attente de signature`,
      action: "Relancer",
      onClick: () => navigate("/quotes"),
    });
  }

  if (reservesEnCours > 0) {
    alerts.push({
      type: "info",
      icon: ClipboardCheck,
      title: `${reservesEnCours} PV avec réserves à lever`,
      subtitle: "À traiter pour clôturer la garantie",
      action: "Voir les PV",
      onClick: () => navigate("/admin-docs"),
    });
  }

  // ─── KPI cartes ─────────────────────────────────────────────────────────
  const kpis: Kpi[] = [
    {
      label: "CA encaissé ce mois",
      value: formatEuro(caCeMois),
      icon: CreditCard,
      color: "bg-emerald-500/15 text-emerald-500",
      to: "/finances",
      trend: variationCA,
    },
    {
      label: "CA encaissé cette année",
      value: formatEuro(caCetteAnnee),
      icon: TrendingUp,
      color: "bg-teal-500/15 text-teal-500",
      to: "/finances",
    },
    {
      label: "Chantiers actifs",
      value: String(chantiersActifs),
      icon: Hammer,
      color: "bg-blue-500/15 text-blue-500",
      to: "/chantiers",
    },
    {
      label: "Brouillons devis",
      value: String(devisBrouillons),
      icon: Receipt,
      color: "bg-amber-500/15 text-amber-500",
      to: "/quotes",
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {greeting}{user?.username ? `, ${user.username}` : ""}
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              v1.0.0
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm flex items-center gap-2 flex-wrap">
            <span>{formatToday()}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
              Ctrl+K pour rechercher
            </span>
          </p>
        </div>

        {/* Actions rapides */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => navigate("/quotes/new")}>
            <Plus className="w-4 h-4" />
            Nouveau devis
          </Button>
          <Button variant="outline" onClick={() => navigate("/chantiers")}>
            <Hammer className="w-4 h-4" />
            Nouveau chantier
          </Button>
        </div>
      </div>

      {/* Alertes */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <AlertCard key={idx} alert={alert} delay={idx * 0.04} />
          ))}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi, idx) => {
          const TrendIcon = kpi.trend == null ? null : kpi.trend > 0 ? TrendingUp : kpi.trend < 0 ? TrendingDown : Minus;
          const trendColor = kpi.trend == null
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
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", kpi.color)}>
                  <kpi.icon className="w-4 h-4" />
                </div>
                {TrendIcon && (
                  <span className={cn("text-[10px] font-semibold flex items-center gap-0.5", trendColor)}>
                    <TrendIcon className="w-3 h-3" />
                    {kpi.trend! > 0 ? "+" : ""}{kpi.trend}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold tabular-nums mt-0.5 truncate">{kpi.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Grid : Agenda + Raccourcis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agenda du jour (col 2) */}
        <div className="lg:col-span-2">
          <UpcomingEventsWidget />
        </div>

        {/* Raccourcis (col 1) */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Raccourcis
          </h3>
          <div className="space-y-1.5">
            <ShortcutLink icon={FilePlus} label="Nouvelle facture" to="/invoices/new" navigate={navigate} />
            <ShortcutLink icon={FileSignature} label="Documents admin" to="/admin-docs" navigate={navigate} />
            <ShortcutLink icon={CreditCard} label="Notes de frais" to="/expense-notes" navigate={navigate} />
            <ShortcutLink icon={Hammer} label="Sous-traitants" to="/subcontractors" navigate={navigate} />
            <ShortcutLink icon={Lock} label="Coffre-fort" to="/vault" navigate={navigate} />
            <ShortcutLink icon={Calendar} label="Agenda complet" to="/agenda" navigate={navigate} />
          </div>
        </div>
      </div>

      {/* Pas d'alerte = état zen */}
      {alerts.length === 0 && (
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
            <p className="text-sm font-semibold">Tout est sous contrôle</p>
            <p className="text-xs text-muted-foreground">
              Aucune action urgente. Tu peux te concentrer sur le travail.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────
type AlertType = "danger" | "warning" | "info";
interface Alert {
  type: AlertType;
  icon: any;
  title: string;
  subtitle: string;
  action: string;
  onClick: () => void;
}

interface Kpi {
  label: string;
  value: string;
  icon: any;
  color: string;
  to: string;
  trend?: number | null;  // % d'évolution (Session 1.0.0)
}

// ─── Sub-components ───────────────────────────────────────────────────────
function AlertCard({ alert, delay }: { alert: Alert; delay: number }) {
  const colorMap = {
    danger: "border-red-500/30 bg-red-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    info: "border-blue-500/30 bg-blue-500/5",
  };
  const iconColorMap = {
    danger: "bg-red-500/15 text-red-500",
    warning: "bg-amber-500/15 text-amber-500",
    info: "bg-blue-500/15 text-blue-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={cn(
        "border rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:shadow-soft-sm transition-all",
        colorMap[alert.type]
      )}
      onClick={alert.onClick}
    >
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", iconColorMap[alert.type])}>
        <alert.icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{alert.title}</p>
        <p className="text-xs text-muted-foreground truncate">{alert.subtitle}</p>
      </div>
      <Button variant="ghost" size="sm">
        {alert.action}
        <ArrowRight className="w-3 h-3" />
      </Button>
    </motion.div>
  );
}

function ShortcutLink({ icon: Icon, label, to, navigate }: {
  icon: any;
  label: string;
  to: string;
  navigate: (path: string) => void;
}) {
  return (
    <button
      onClick={() => navigate(to)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-sm text-left transition-colors"
    >
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Bonsoir";
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
