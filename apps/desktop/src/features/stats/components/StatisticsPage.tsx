import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, BarChart3, Activity, Calendar as CalendarIcon, FileSignature } from "lucide-react";

import { cn } from "@btp/ui";
import { useStatsStore } from "@/stores/statsStore";

import { PipelineSection } from "./PipelineSection";
import { PaymentDelaysSection } from "./PaymentDelaysSection";
import { YoYSection } from "./YoYSection";
import { SeasonalitySection } from "./SeasonalitySection";

// ═══════════════════════════════════════════════════════════════════════════
// StatisticsPage — Page principale stats avancées (Session 16)
// 4 sections détaillées via onglets
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "delays" | "pipeline" | "yoy" | "seasonality";

export function StatisticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("delays");
  const { fetchAll, isLoading } = useStatsStore();

  useEffect(() => {
    fetchAll();
  }, []);

  const tabs: Array<{ key: Tab; label: string; icon: any; description: string }> = [
    { key: "delays", label: "Délais de paiement", icon: Activity, description: "Qui paie en retard, factures en attente" },
    { key: "pipeline", label: "Pipeline devis", icon: FileSignature, description: "Entonnoir de conversion, carnet de commandes" },
    { key: "yoy", label: "Comparatif N vs N-1", icon: TrendingUp, description: "Évolution mois par mois année courante vs précédente" },
    { key: "seasonality", label: "Saisonnalité", icon: CalendarIcon, description: "Heatmap CA mensuel sur plusieurs années" },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm p-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/20 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-violet-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">Statistiques avancées</h1>
            <p className="text-xs text-muted-foreground">
              Pilotage et analyse approfondie de ton activité
            </p>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex items-center gap-1 mt-4 -mb-px overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Chargement...</div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "delays" && <PaymentDelaysSection />}
            {activeTab === "pipeline" && <PipelineSection />}
            {activeTab === "yoy" && <YoYSection />}
            {activeTab === "seasonality" && <SeasonalitySection />}
          </motion.div>
        )}
      </div>
    </div>
  );
}
