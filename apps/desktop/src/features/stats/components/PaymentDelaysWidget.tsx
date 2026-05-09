import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Clock, AlertTriangle, TrendingUp, ChevronRight,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@btp/types";
import { useStatsStore } from "@/stores/statsStore";

// ═══════════════════════════════════════════════════════════════════════════
// PaymentDelaysWidget — Widget compact pour la page Finances
// Affiche les KPI essentiels sur les délais de paiement
// ═══════════════════════════════════════════════════════════════════════════

export function PaymentDelaysWidget() {
  const navigate = useNavigate();
  const { paymentDelays, fetchPaymentDelays } = useStatsStore();

  useEffect(() => {
    fetchPaymentDelays();
  }, []);

  if (!paymentDelays) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-xs text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  const hasOverdue = paymentDelays.invoicesOverdueCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-card border rounded-lg p-4",
        hasOverdue ? "border-amber-500/40" : "border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <Clock className="w-4 h-4 text-blue-500" />
        <h3 className="text-sm font-semibold flex-1">Délais de paiement</h3>
        <Button variant="ghost" size="sm" onClick={() => navigate("/statistics")}>
          Détails
          <ChevronRight className="w-3 h-3" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Délai moyen de règlement */}
        <div>
          <p className="text-xs text-muted-foreground">Délai moyen règlement</p>
          <p className="text-2xl font-bold tabular-nums mt-0.5">
            {paymentDelays.avgPaymentDelayDays}<span className="text-xs ml-1 font-normal text-muted-foreground">jours</span>
          </p>
          {paymentDelays.avgLatenessDays > 0 && (
            <p className="text-[11px] text-amber-500 mt-0.5">
              dont +{paymentDelays.avgLatenessDays}j de retard
            </p>
          )}
        </div>

        {/* Factures en retard */}
        <div className={cn(
          "rounded-md p-2 -m-1",
          hasOverdue && "bg-amber-500/5"
        )}>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {hasOverdue ? <AlertTriangle className="w-3 h-3 text-amber-500" /> : <TrendingUp className="w-3 h-3 text-emerald-500" />}
            <span>En retard</span>
          </div>
          <p className={cn(
            "text-2xl font-bold tabular-nums mt-0.5",
            hasOverdue && "text-amber-500"
          )}>
            {paymentDelays.invoicesOverdueCount}
          </p>
          {hasOverdue && (
            <p className="text-[11px] tabular-nums text-amber-600 mt-0.5">
              {formatEuro(paymentDelays.invoicesOverdueAmount)}
            </p>
          )}
        </div>
      </div>

      {paymentDelays.invoicesPendingCount > 0 && (
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            En attente de paiement
          </span>
          <span className="text-sm font-semibold tabular-nums">
            {paymentDelays.invoicesPendingCount} fact. · {formatEuro(paymentDelays.invoicesPendingAmount)}
          </span>
        </div>
      )}
    </motion.div>
  );
}
