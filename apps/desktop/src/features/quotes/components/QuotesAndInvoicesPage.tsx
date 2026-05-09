import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Receipt } from "lucide-react";

import { cn } from "@btp/ui";
import { QuotesListView } from "./QuotesListView";
import { InvoicesListView } from "@/features/invoices/components/InvoicesListView";
import { useQuotesStore } from "@/stores/quotesStore";
import { useInvoicesStore } from "@/stores/invoicesStore";

// ═══════════════════════════════════════════════════════════════════════════
// QuotesAndInvoicesPage — Page unifiée Devis + Factures avec 2 tabs
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "quotes" | "invoices";

export function QuotesAndInvoicesPage() {
  const [tab, setTab] = useState<Tab>("quotes");
  const quotesCount = useQuotesStore((s) => s.quotes.length);
  const invoicesCount = useInvoicesStore((s) => s.invoices.length);
  const fetchQuotes = useQuotesStore((s) => s.fetch);
  const fetchInvoices = useInvoicesStore((s) => s.fetch);

  useEffect(() => {
    fetchQuotes();
    fetchInvoices();
  }, [fetchQuotes, fetchInvoices]);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      {/* Tabs de bascule */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit mb-6">
        <TabButton
          active={tab === "quotes"}
          onClick={() => setTab("quotes")}
          icon={FileText}
          label="Devis"
          count={quotesCount}
        />
        <TabButton
          active={tab === "invoices"}
          onClick={() => setTab("invoices")}
          icon={Receipt}
          label="Factures"
          count={invoicesCount}
        />
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {tab === "quotes" ? <QuotesListView /> : <InvoicesListView />}
      </motion.div>
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, label, count,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
        active
          ? "bg-card shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
      {count > 0 && (
        <span className={cn(
          "ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
          active ? "bg-primary/15 text-primary" : "bg-muted-foreground/15 text-muted-foreground"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
