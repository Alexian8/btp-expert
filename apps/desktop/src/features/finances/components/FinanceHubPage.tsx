import { useState } from "react";
import { useLocation } from "react-router-dom";
import { BarChart3, BookOpen, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@btp/ui";
import { FinancesPage } from "./FinancesPage";
import { AccountingHubPage } from "@/features/accounting/components/AccountingHubPage";
import { StatisticsPage } from "@/features/stats/components/StatisticsPage";

// ═══════════════════════════════════════════════════════════════════════════
// FinanceHubPage — regroupe Tableau de bord financier, Comptabilité et
// Statistiques sous une seule entrée de menu (désengorge la sidebar).
// Onglet initial déduit de l'URL (/finances, /accounting, /statistics) pour
// préserver les liens profonds existants.
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "dashboard" | "accounting" | "stats";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard",  label: "Tableau de bord", icon: BarChart3 },
  { id: "accounting", label: "Comptabilité",    icon: BookOpen },
  { id: "stats",      label: "Statistiques",     icon: Activity },
];

export function FinanceHubPage() {
  const location = useLocation();
  const initial: Tab =
    location.pathname.startsWith("/accounting") ? "accounting"
    : location.pathname.startsWith("/statistics") ? "stats"
    : "dashboard";
  const [tab, setTab] = useState<Tab>(initial);

  return (
    <div className="h-full flex flex-col">
      {/* Barre d'onglets de premier niveau */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm px-2 sm:px-4 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative px-3 sm:px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {active && (
                  <motion.div
                    layoutId="finance-hub-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenu — chaque page est h-full et gère son propre scroll interne :
          pas de wrapper overflow ici (sinon double scrollbar). */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "dashboard" && <FinancesPage />}
        {tab === "accounting" && <AccountingHubPage />}
        {tab === "stats" && <StatisticsPage />}
      </div>
    </div>
  );
}
