import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Clock, AlertTriangle, Hourglass, Wallet,
  TrendingDown, Receipt,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@btp/types";
import { useStatsStore } from "@/stores/statsStore";

// ═══════════════════════════════════════════════════════════════════════════
// PaymentDelaysSection — Vue détaillée des délais de paiement
// ═══════════════════════════════════════════════════════════════════════════

export function PaymentDelaysSection() {
  const navigate = useNavigate();
  const {
    paymentDelays, fetchPaymentDelays,
    clientDelays, fetchClientDelays,
    overdueInvoices, fetchOverdueInvoices,
  } = useStatsStore();

  useEffect(() => {
    fetchPaymentDelays();
    fetchClientDelays(15);
    fetchOverdueInvoices();
  }, []);

  if (!paymentDelays) {
    return <div className="text-sm text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {/* KPI bandeau */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Délai moyen de règlement"
          value={`${paymentDelays.avgPaymentDelayDays}`}
          unit="jours"
          icon={Clock}
          color="bg-blue-500/15 text-blue-500"
          subtext="Entre émission et paiement"
        />
        <KpiCard
          label="Retard moyen"
          value={`${paymentDelays.avgLatenessDays}`}
          unit="jours"
          icon={Hourglass}
          color={paymentDelays.avgLatenessDays > 7 ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"}
          subtext="Au-delà de l'échéance"
        />
        <KpiCard
          label="Factures en retard"
          value={String(paymentDelays.invoicesOverdueCount)}
          icon={AlertTriangle}
          color={paymentDelays.invoicesOverdueCount > 0 ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-500"}
          subtext={paymentDelays.invoicesOverdueAmount > 0 ? formatEuro(paymentDelays.invoicesOverdueAmount) : "Tout est à jour"}
          warning={paymentDelays.invoicesOverdueCount > 0}
        />
        <KpiCard
          label="En attente paiement"
          value={String(paymentDelays.invoicesPendingCount)}
          icon={Wallet}
          color="bg-violet-500/15 text-violet-500"
          subtext={formatEuro(paymentDelays.invoicesPendingAmount)}
        />
      </div>

      {/* Factures en retard */}
      {overdueInvoices.length > 0 && (
        <div className="bg-card border border-red-500/30 rounded-lg overflow-hidden">
          <div className="bg-red-500/10 p-4 border-b border-red-500/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-semibold">
                {overdueInvoices.length} facture{overdueInvoices.length > 1 ? "s" : ""} en retard
              </h3>
              <span className="ml-auto text-sm font-bold tabular-nums text-red-500">
                {formatEuro(overdueInvoices.reduce((s, i) => s + i.remainingAmount, 0))}
              </span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {overdueInvoices.map((inv, idx) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="p-3 hover:bg-accent/50 cursor-pointer flex items-center gap-3"
                onClick={() => navigate("/invoices")}
              >
                <div className={cn(
                  "w-10 h-10 rounded-md flex items-center justify-center shrink-0 font-bold text-xs",
                  inv.daysOverdue > 30 ? "bg-red-500/20 text-red-600" : "bg-amber-500/20 text-amber-600"
                )}>
                  {inv.daysOverdue}j
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-semibold">{inv.reference}</span>
                    <span className="text-xs text-muted-foreground truncate">· {inv.clientName}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Émise le {formatDate(inv.issueDate)} · Échéance {formatDate(inv.dueDate)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{formatEuro(inv.remainingAmount)}</p>
                  {inv.totalPaid > 0 && (
                    <p className="text-[10.5px] text-muted-foreground">
                      Sur {formatEuro(inv.totalTtc)}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Top mauvais payeurs */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Délais de paiement par client</h3>
            <span className="ml-auto text-xs text-muted-foreground">
              Triés par retard moyen décroissant
            </span>
          </div>
        </div>
        {clientDelays.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucun client n'a encore réglé de facture.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs">
              <tr className="text-left">
                <th className="p-3 font-semibold">Client</th>
                <th className="p-3 font-semibold text-right">Factures payées</th>
                <th className="p-3 font-semibold text-right">Délai moyen</th>
                <th className="p-3 font-semibold text-right">Retard moyen</th>
                <th className="p-3 font-semibold text-right">Pire retard</th>
                <th className="p-3 font-semibold text-right">Total réglé</th>
              </tr>
            </thead>
            <tbody>
              {clientDelays.map((c) => (
                <tr
                  key={c.clientId}
                  onClick={() => navigate("/clients")}
                  className="border-t border-border hover:bg-accent/40 cursor-pointer"
                >
                  <td className="p-3">
                    <span className="font-medium">{c.clientName}</span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{c.invoicesPaidCount}</td>
                  <td className="p-3 text-right tabular-nums">{c.avgDelayDays} j</td>
                  <td className={cn(
                    "p-3 text-right tabular-nums font-semibold",
                    c.avgLatenessDays > 14 ? "text-red-500" : c.avgLatenessDays > 0 ? "text-amber-500" : "text-emerald-500"
                  )}>
                    {c.avgLatenessDays > 0 ? `+${c.avgLatenessDays}j` : "OK"}
                  </td>
                  <td className={cn(
                    "p-3 text-right tabular-nums",
                    c.worstLatenessDays > 30 ? "text-red-500 font-semibold" : "text-muted-foreground"
                  )}>
                    {c.worstLatenessDays > 0 ? `+${c.worstLatenessDays}j` : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums font-semibold">{formatEuro(c.totalPaid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Conseils */}
      <div className="bg-muted/30 border border-border rounded-lg p-4 text-xs text-muted-foreground">
        <p className="font-semibold mb-1 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" />
          À propos du retard
        </p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Délai moyen de règlement</strong> = nombre de jours moyen entre la date d'émission et la date de paiement effective.</li>
          <li><strong>Retard moyen</strong> = nombre de jours moyen au-delà de la date d'échéance contractuelle (0 si payé en avance).</li>
          <li>En France, le délai légal de paiement est de 30 jours par défaut, ou 60 jours max sur convention.</li>
          <li>Pour les retards récurrents, n'hésite pas à exiger un acompte ou à appliquer des pénalités de retard.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function KpiCard({ label, value, unit, icon: Icon, color, subtext, warning }: {
  label: string;
  value: string;
  unit?: string;
  icon: any;
  color: string;
  subtext?: string;
  warning?: boolean;
}) {
  return (
    <div className={cn(
      "border rounded-lg p-3",
      warning ? "bg-card border-red-500/30" : "bg-card border-border"
    )}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-xl font-bold tabular-nums">
        {value}
        {unit && <span className="text-xs ml-1 font-normal text-muted-foreground">{unit}</span>}
      </p>
      {subtext && <p className="text-[11px] text-muted-foreground mt-1 truncate">{subtext}</p>}
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
  } catch { return iso; }
}
