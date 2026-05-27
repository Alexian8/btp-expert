import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Wallet, AlertCircle,
  Receipt, Download, BarChart3, Percent,
  Trophy, Building2, Hammer,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useFinanceStore } from "@/stores/financeStore";
import { formatEuro } from "@btp/types";
import { MonthlyBarsChart } from "./MonthlyBarsChart";
import { TopClientsList, TopSuppliersList, ChantierMarginsList } from "./TopLists";
import { AccountingModeGate } from "./AccountingModeGate";
import { PaymentDelaysWidget } from "@/features/stats/components/PaymentDelaysWidget";
import { QuotePipelineWidget } from "@/features/stats/components/QuotePipelineWidget";

// ═══════════════════════════════════════════════════════════════════════════
// FinancesPage — Dashboard financier (Session 13 Msg 3)
// ═══════════════════════════════════════════════════════════════════════════

export function FinancesPage() {
  const { stats, monthly, topClients, topSuppliers, chantierMargins, isLoading, fetchAll, exportFEC } = useFinanceStore();
  const [exporting, setExporting] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  useEffect(() => {
    fetchAll();
  }, []);

  const handleExportFEC = async () => {
    setExporting(true);
    const r = await exportFEC(selectedYear);
    setExporting(false);
    if (r.success) {
      toast.success(
        `FEC exporté : ${r.lineCount} ligne${(r.lineCount || 0) > 1 ? "s" : ""}`,
        { description: `${r.invoicesCount} facture${(r.invoicesCount || 0) > 1 ? "s" : ""} + ${r.expensesCount} dépense${(r.expensesCount || 0) > 1 ? "s" : ""}` }
      );
    } else if (!r.cancelled) {
      toast.error(r.error || "Erreur d'export");
    }
  };

  // Trimestre courant pour la TVA
  const currentMonth = new Date().getMonth() + 1;
  const currentTrim = Math.ceil(currentMonth / 3);
  const trimLabel = `T${currentTrim} ${currentYear}`;

  return (
    <div className="h-full flex flex-col">
      <AccountingModeGate />
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm p-4 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight">Finances</h1>
              <p className="text-xs text-muted-foreground">
                Dashboard de pilotage financier
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 rounded-md border border-input bg-background text-sm tabular-nums"
            >
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Button onClick={handleExportFEC} loading={exporting} variant="outline" size="sm">
              <Download className="w-3.5 h-3.5" />
              Exporter FEC
            </Button>
          </div>
        </div>
      </div>

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">Chargement...</div>
        ) : (
          <>
            {/* ─── Cards stats principales ────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                label="CA encaissé"
                period="ce mois"
                amount={stats.caEncaisseMonth}
                yearAmount={stats.caEncaisseYear}
                yearLabel={`${currentYear}`}
                icon={Wallet}
                color="emerald"
              />
              <KpiCard
                label="CA en attente"
                period="factures non payées"
                amount={stats.caEnAttente}
                icon={AlertCircle}
                color="amber"
              />
              <KpiCard
                label="Dépenses"
                period="ce mois"
                amount={stats.expensesMonth}
                yearAmount={stats.expensesYear}
                yearLabel={`${currentYear}`}
                icon={Receipt}
                color="rose"
              />
              <KpiCard
                label="Marge"
                period="ce mois"
                amount={stats.margeMonth}
                yearAmount={stats.margeYear}
                yearLabel={`${currentYear}`}
                icon={stats.margeMonth >= 0 ? TrendingUp : TrendingDown}
                color={stats.margeMonth >= 0 ? "emerald" : "rose"}
              />
            </div>

            {/* ─── Graphique mensuel + TVA ──────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Graphique : prend 2/3 sur grand écran */}
              <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Évolution sur 12 mois</h3>
                </div>
                {monthly.length === 0 ? (
                  <div className="text-center py-12 text-xs text-muted-foreground">
                    Pas encore de données.
                  </div>
                ) : (
                  <MonthlyBarsChart data={monthly} />
                )}
              </div>

              {/* TVA */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Percent className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">TVA · {currentYear}</h3>
                </div>
                <div className="space-y-3">
                  <TvaRow label="Collectée" amount={stats.tvaCollectee} positive />
                  <TvaRow label="Déductible" amount={stats.tvaDeductible} negative />
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">À reverser</p>
                        <p className="text-[10.5px] text-muted-foreground/70">{trimLabel} en cours</p>
                      </div>
                      <p className={cn(
                        "text-lg font-bold tabular-nums",
                        stats.tvaAReverser > 0 ? "text-amber-500" : "text-emerald-500"
                      )}>
                        {formatEuro(stats.tvaAReverser)}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground italic mt-2">
                    Calcul cumulé sur l'année.<br/>
                    Pour la déclaration trimestrielle, voir avec ton expert-comptable.
                  </p>
                </div>
              </div>
            </div>

            {/* ─── Widgets S16 : Pipeline + Délais paiement ──────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PaymentDelaysWidget />
              <QuotePipelineWidget />
            </div>

            {/* ─── Top listes ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Top Clients */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-violet-500" />
                  <h3 className="text-sm font-semibold">Top clients (par CA)</h3>
                </div>
                <TopClientsList clients={topClients} />
              </div>

              {/* Top Suppliers */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-rose-500" />
                  <h3 className="text-sm font-semibold">Top fournisseurs (par dépenses)</h3>
                </div>
                <TopSuppliersList suppliers={topSuppliers} />
              </div>
            </div>

            {/* ─── Marges par chantier ─────────────────────────────────────── */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Hammer className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold">Marges par chantier</h3>
              </div>
              <ChantierMarginsList margins={chantierMargins} />
            </div>

            {/* ─── Footer info ─────────────────────────────────────────────── */}
            <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-semibold mb-1">À propos de ces chiffres</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Le <strong>CA encaissé</strong> correspond au total payé sur tes factures.</li>
                <li>Le <strong>CA en attente</strong> couvre les factures envoyées non encore réglées.</li>
                <li>La <strong>TVA</strong> est calculée proportionnellement aux paiements (TVA sur encaissements).</li>
                <li>L'<strong>export FEC</strong> est aux normes DGFIP (article A47 A-1 du LPF).</li>
                <li>Ces données t'aident au pilotage. Pour la déclaration officielle, voir avec ton expert-comptable.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Composants internes ───────────────────────────────────────────────────

function KpiCard({ label, period, amount, yearAmount, yearLabel, icon: Icon, color }: {
  label: string;
  period: string;
  amount: number;
  yearAmount?: number;
  yearLabel?: string;
  icon: any;
  color: "emerald" | "amber" | "rose" | "blue" | "violet";
}) {
  const colorClasses = {
    emerald: "bg-emerald-500/15 text-emerald-500",
    amber: "bg-amber-500/15 text-amber-500",
    rose: "bg-rose-500/15 text-rose-500",
    blue: "bg-blue-500/15 text-blue-500",
    violet: "bg-violet-500/15 text-violet-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card border border-border rounded-lg p-4"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-[10.5px] text-muted-foreground/70 mt-0.5">{period}</p>
        </div>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", colorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight">{formatEuro(amount)}</p>
      {yearAmount !== undefined && (
        <p className="text-[11px] text-muted-foreground mt-1">
          {yearLabel} : <span className="font-semibold tabular-nums">{formatEuro(yearAmount)}</span>
        </p>
      )}
    </motion.div>
  );
}

function TvaRow({ label, amount, positive, negative }: {
  label: string;
  amount: number;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {positive && <span className="text-emerald-500 text-base font-bold">+</span>}
        {negative && <span className="text-rose-500 text-base font-bold">−</span>}
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-sm font-semibold tabular-nums">{formatEuro(amount)}</p>
    </div>
  );
}
