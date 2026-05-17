import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileSignature, ClipboardCheck, Receipt, FileText, Leaf, Building2,
} from "lucide-react";

import { cn } from "@btp/ui";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";

import { ReceptionsSection } from "./ReceptionsSection";
import { TvaAttestationsSection } from "./TvaAttestationsSection";
import { Dc4Section } from "./Dc4Section";
import { DaactSection } from "./DaactSection";
import { RgeSection } from "./RgeSection";

// ═══════════════════════════════════════════════════════════════════════════
// AdminDocsPage — Page principale documents administratifs (Session 17)
// 5 onglets : PV réception / Attestations TVA / DC4 / DAACT / RGE
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "reception" | "tva" | "dc4" | "daact" | "rge";

export function AdminDocsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("reception");
  const { stats, fetchStats } = useAdministrativeDocsStore();

  useEffect(() => {
    fetchStats();
  }, []);

  const tabs: Array<{ key: Tab; label: string; icon: any; description: string; badge?: number }> = [
    {
      key: "reception",
      label: "PV de réception",
      icon: ClipboardCheck,
      description: "Procès-verbaux de réception de chantier",
      badge: stats.receptionsTotal,
    },
    {
      key: "tva",
      label: "Attestations TVA",
      icon: Receipt,
      description: "TVA réduite 5,5% / 10% (résidentiel)",
      badge: stats.tvaAttestationsTotal,
    },
    {
      key: "dc4",
      label: "DC4 sous-traitance",
      icon: FileText,
      description: "Déclarations de sous-traitance (marchés publics)",
      badge: stats.dc4Total,
    },
    {
      key: "daact",
      label: "DAACT",
      icon: Building2,
      description: "Déclaration d'achèvement des travaux — CERFA 13408*13",
      badge: stats.daactTotal,
    },
    {
      key: "rge",
      label: "RGE / MaPrimeRénov'",
      icon: Leaf,
      description: "Rénovation énergétique (préparation 2026)",
      badge: stats.rgeDocumentsTotal,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm p-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/20 flex items-center justify-center shrink-0">
            <FileSignature className="w-5 h-5 text-violet-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">Documents administratifs</h1>
            <p className="text-xs text-muted-foreground">
              PV réception, attestations TVA, DC4 sous-traitance, RGE
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
              {t.badge !== undefined && t.badge > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto p-4">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "reception" && <ReceptionsSection />}
          {activeTab === "tva" && <TvaAttestationsSection />}
          {activeTab === "dc4" && <Dc4Section />}
          {activeTab === "daact" && <DaactSection />}
          {activeTab === "rge" && <RgeSection />}
        </motion.div>
      </div>
    </div>
  );
}
