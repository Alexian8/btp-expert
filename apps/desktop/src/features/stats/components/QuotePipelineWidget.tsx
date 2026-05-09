import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FileSignature, ChevronRight, AlertTriangle,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@btp/types";
import { useStatsStore } from "@/stores/statsStore";

// ═══════════════════════════════════════════════════════════════════════════
// QuotePipelineWidget — Widget compact pour la page Finances
// Affiche les KPI essentiels du pipeline devis
// ═══════════════════════════════════════════════════════════════════════════

export function QuotePipelineWidget() {
  const navigate = useNavigate();
  const { pipeline, fetchPipeline } = useStatsStore();

  useEffect(() => {
    fetchPipeline();
  }, []);

  if (!pipeline) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-xs text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  const hasOldEnvoye = pipeline.oldEnvoyeCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-card border rounded-lg p-4",
        hasOldEnvoye ? "border-amber-500/40" : "border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <FileSignature className="w-4 h-4 text-violet-500" />
        <h3 className="text-sm font-semibold flex-1">Pipeline devis</h3>
        <Button variant="ghost" size="sm" onClick={() => navigate("/statistics")}>
          Détails
          <ChevronRight className="w-3 h-3" />
        </Button>
      </div>

      {/* Mini entonnoir */}
      <div className="space-y-1.5 mb-3">
        <PipelineRow
          label="En attente signature"
          count={pipeline.countEnvoye}
          amount={pipeline.amountEnvoye}
          color="bg-blue-500"
          maxAmount={Math.max(pipeline.amountEnvoye, pipeline.amountAccepte, pipeline.amountFactured, 1)}
        />
        <PipelineRow
          label="Carnet de commandes"
          count={pipeline.countAccepte - pipeline.countFactured}
          amount={pipeline.amountAccepte}
          color="bg-violet-500"
          maxAmount={Math.max(pipeline.amountEnvoye, pipeline.amountAccepte, pipeline.amountFactured, 1)}
        />
        <PipelineRow
          label="Acceptés et facturés"
          count={pipeline.countFactured}
          amount={pipeline.amountFactured}
          color="bg-emerald-500"
          maxAmount={Math.max(pipeline.amountEnvoye, pipeline.amountAccepte, pipeline.amountFactured, 1)}
        />
      </div>

      {/* Taux conversion */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
        <div>
          <p className="text-[11px] text-muted-foreground">Taux signature</p>
          <p className="text-base font-bold tabular-nums">
            {pipeline.conversionEnvoyeToAccepte.toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Délai signature</p>
          <p className="text-base font-bold tabular-nums">
            {pipeline.avgSignatureDelayDays}<span className="text-xs ml-1 font-normal text-muted-foreground">j</span>
          </p>
        </div>
      </div>

      {hasOldEnvoye && (
        <div className="mt-3 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="text-[11px] text-amber-700 flex-1">
            <strong>{pipeline.oldEnvoyeCount}</strong> devis envoyés sans réponse depuis +30j
          </span>
          <span className="text-[11px] tabular-nums font-semibold text-amber-700 shrink-0">
            {formatEuro(pipeline.oldEnvoyeAmount)}
          </span>
        </div>
      )}
    </motion.div>
  );
}

function PipelineRow({ label, count, amount, color, maxAmount }: {
  label: string;
  count: number;
  amount: number;
  color: string;
  maxAmount: number;
}) {
  const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
  return (
    <div className="relative">
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="text-muted-foreground">
          {label} · <span className="font-semibold text-foreground">{count}</span>
        </span>
        <span className="font-semibold tabular-nums">{formatEuro(amount)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
