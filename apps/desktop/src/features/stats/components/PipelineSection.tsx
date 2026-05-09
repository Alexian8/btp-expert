import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FileText, FileSignature, FileCheck, FileX,
  CheckCircle2, AlertTriangle, ArrowRight, TrendingUp,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@btp/types";
import { useStatsStore } from "@/stores/statsStore";

// ═══════════════════════════════════════════════════════════════════════════
// PipelineSection — Vue détaillée du pipeline devis
// ═══════════════════════════════════════════════════════════════════════════

export function PipelineSection() {
  const navigate = useNavigate();
  const { pipeline, fetchPipeline } = useStatsStore();

  useEffect(() => {
    fetchPipeline();
  }, []);

  if (!pipeline) {
    return <div className="text-sm text-muted-foreground">Chargement...</div>;
  }

  const totalCount = pipeline.countBrouillon + pipeline.countEnvoye + pipeline.countAccepte + pipeline.countRefuse;

  return (
    <div className="space-y-4 max-w-5xl">
      {/* KPI bandeau */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total devis"
          value={String(totalCount)}
          icon={FileText}
          color="bg-slate-500/15 text-slate-500"
        />
        <KpiCard
          label="Taux de signature"
          value={`${pipeline.conversionEnvoyeToAccepte.toFixed(0)}%`}
          icon={CheckCircle2}
          color="bg-emerald-500/15 text-emerald-500"
          subtext={`Sur ${pipeline.countEnvoye + pipeline.countAccepte + pipeline.countRefuse} devis envoyés/conclus`}
        />
        <KpiCard
          label="Délai moyen signature"
          value={`${pipeline.avgSignatureDelayDays} j`}
          icon={TrendingUp}
          color="bg-blue-500/15 text-blue-500"
        />
        <KpiCard
          label="Carnet de commandes"
          value={formatEuro(pipeline.amountAccepte)}
          icon={FileCheck}
          color="bg-violet-500/15 text-violet-500"
          subtext="Signé non encore facturé"
        />
      </div>

      {/* Entonnoir détaillé */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Entonnoir de conversion</h3>
        <div className="space-y-3">
          <FunnelStep
            label="Brouillons"
            count={pipeline.countBrouillon}
            amount={pipeline.amountBrouillon}
            color="bg-slate-400"
            widthPct={100}
          />
          <FunnelStep
            label="Envoyés"
            count={pipeline.countEnvoye + pipeline.countAccepte + pipeline.countRefuse}
            amount={pipeline.amountEnvoye + pipeline.amountAccepte + pipeline.amountFactured + pipeline.amountRefuse}
            color="bg-blue-500"
            widthPct={totalCount > 0 ? ((pipeline.countEnvoye + pipeline.countAccepte + pipeline.countRefuse) / totalCount) * 100 : 0}
          />
          <FunnelStep
            label="Acceptés"
            count={pipeline.countAccepte}
            amount={pipeline.amountAccepte + pipeline.amountFactured}
            color="bg-violet-500"
            widthPct={totalCount > 0 ? (pipeline.countAccepte / totalCount) * 100 : 0}
          />
          <FunnelStep
            label="Facturés"
            count={pipeline.countFactured}
            amount={pipeline.amountFactured}
            color="bg-emerald-500"
            widthPct={totalCount > 0 ? (pipeline.countFactured / totalCount) * 100 : 0}
          />
          <FunnelStep
            label="Refusés"
            count={pipeline.countRefuse}
            amount={pipeline.amountRefuse}
            color="bg-red-500"
            widthPct={totalCount > 0 ? (pipeline.countRefuse / totalCount) * 100 : 0}
          />
        </div>
      </div>

      {/* Alertes : devis envoyés sans réponse */}
      {pipeline.oldEnvoyeCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-700">
                {pipeline.oldEnvoyeCount} devis envoyé{pipeline.oldEnvoyeCount > 1 ? "s" : ""} sans réponse depuis +30 jours
              </h3>
              <p className="text-xs text-amber-700/80 mt-1">
                Total en attente : <strong>{formatEuro(pipeline.oldEnvoyeAmount)}</strong>.
                Pense à les relancer pour les transformer en signature.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/quotes?status=envoye")}>
                Voir les devis en attente
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Récap montants */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Récapitulatif des montants HT</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <AmountRow label="Brouillons" value={pipeline.amountBrouillon} icon={FileText} />
            <AmountRow label="En attente signature" value={pipeline.amountEnvoye} icon={FileSignature} highlight />
            <AmountRow label="Carnet de commandes" value={pipeline.amountAccepte} icon={FileCheck} highlight />
          </div>
          <div className="space-y-2">
            <AmountRow label="Acceptés et facturés" value={pipeline.amountFactured} icon={CheckCircle2} />
            <AmountRow label="Refusés (perdus)" value={pipeline.amountRefuse} icon={FileX} negative />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, subtext }: {
  label: string;
  value: string;
  icon: any;
  color: string;
  subtext?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {subtext && <p className="text-[11px] text-muted-foreground mt-1">{subtext}</p>}
    </div>
  );
}

function FunnelStep({ label, count, amount, color, widthPct }: {
  label: string;
  count: number;
  amount: number;
  color: string;
  widthPct: number;
}) {
  const safeWidth = Math.max(5, widthPct); // au moins 5% pour la lisibilité
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative"
    >
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium">{label} <span className="text-muted-foreground">({count})</span></span>
        <span className="font-semibold tabular-nums">{formatEuro(amount)}</span>
      </div>
      <div className="h-6 rounded-md bg-muted overflow-hidden flex">
        <div
          className={cn("h-full rounded-md flex items-center px-2 text-xs text-white font-semibold", color)}
          style={{ width: `${safeWidth}%` }}
        >
          {widthPct >= 10 && `${widthPct.toFixed(0)}%`}
        </div>
      </div>
    </motion.div>
  );
}

function AmountRow({ label, value, icon: Icon, highlight, negative }: {
  label: string;
  value: number;
  icon: any;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded-md",
      highlight && "bg-violet-500/5"
    )}>
      <Icon className={cn(
        "w-3.5 h-3.5",
        highlight ? "text-violet-500" : negative ? "text-red-500" : "text-muted-foreground"
      )} />
      <span className="text-sm flex-1 truncate">{label}</span>
      <span className={cn(
        "text-sm font-semibold tabular-nums tabular-nums",
        highlight ? "text-violet-600" : negative ? "text-red-500" : ""
      )}>
        {formatEuro(value)}
      </span>
    </div>
  );
}
