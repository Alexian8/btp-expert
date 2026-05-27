import { useEffect, useState } from "react";
import { BookOpen, FileText, ListChecks, TrendingUp, Scale, Calculator, Settings as SettingsIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@btp/ui";
import { useAccountingStore } from "@/stores/accountingStore";
import { AccountingModeGate } from "@/features/finances/components/AccountingModeGate";
import { JournalEntriesView } from "./JournalEntriesView";
import { GrandLivreView } from "./GrandLivreView";
import { BalanceView } from "./BalanceView";
import { IncomeStatementView } from "./IncomeStatementView";
import { BalanceSheetView } from "./BalanceSheetView";
import { ChartOfAccountsView } from "./ChartOfAccountsView";
import { AccountingSettingsView } from "./AccountingSettingsView";

// ═══════════════════════════════════════════════════════════════════════════
// AccountingHubPage — Hub central de la comptabilité partie double
//   Onglets : Livre Journal · Grand Livre · Balance · Compte Résultat · Bilan
//           · Plan Comptable · Paramètres
// ═══════════════════════════════════════════════════════════════════════════

type TabId = "journal" | "grandLivre" | "balance" | "incomeStatement" | "balanceSheet" | "plan" | "settings";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "journal",         label: "Livre Journal",   icon: BookOpen },
  { id: "grandLivre",      label: "Grand Livre",     icon: FileText },
  { id: "balance",         label: "Balance",         icon: ListChecks },
  { id: "incomeStatement", label: "Compte de Résultat", icon: TrendingUp },
  { id: "balanceSheet",    label: "Bilan",           icon: Scale },
  { id: "plan",            label: "Plan Comptable",  icon: Calculator },
  { id: "settings",        label: "Paramètres",      icon: SettingsIcon },
];

export function AccountingHubPage() {
  const [activeTab, setActiveTab] = useState<TabId>("journal");
  const fetchSettings = useAccountingStore((s) => s.fetchSettings);
  const settings = useAccountingStore((s) => s.settings);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // Tant que le mode n'est pas choisi, on bloque les onglets et on montre l'onboarding
  const modeChosen = settings && settings.mode !== "";

  return (
    <div className="h-full flex flex-col">
      <AccountingModeGate />

      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm p-4 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold truncate">Comptabilité</h1>
              <p className="text-xs text-muted-foreground truncate">
                {settings?.mode === "engagement" && "Mode engagement"}
                {settings?.mode === "tresorerie" && "Mode trésorerie"}
                {!settings?.mode && "Configuration requise"}
                {settings?.fiscalYear ? ` · exercice ${settings.fiscalYear}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border bg-background sticky top-0 z-10">
        <div className="px-4 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isDisabled = !modeChosen && tab.id !== "settings";
              return (
                <button
                  key={tab.id}
                  onClick={() => !isDisabled && setActiveTab(tab.id)}
                  disabled={isDisabled}
                  className={cn(
                    "relative px-3 py-3 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    isDisabled && "opacity-40 cursor-not-allowed hover:text-muted-foreground",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="accounting-active-tab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {!modeChosen && activeTab !== "settings" && (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold mb-1">Configuration requise</h2>
            <p className="text-sm text-muted-foreground">
              Choisissez votre mode comptable pour activer le module.
            </p>
          </div>
        )}
        {(modeChosen || activeTab === "settings") && (
          <>
            {activeTab === "journal" && <JournalEntriesView />}
            {activeTab === "grandLivre" && <GrandLivreView />}
            {activeTab === "balance" && <BalanceView />}
            {activeTab === "incomeStatement" && <IncomeStatementView />}
            {activeTab === "balanceSheet" && <BalanceSheetView />}
            {activeTab === "plan" && <ChartOfAccountsView />}
            {activeTab === "settings" && <AccountingSettingsView />}
          </>
        )}
      </div>
    </div>
  );
}
