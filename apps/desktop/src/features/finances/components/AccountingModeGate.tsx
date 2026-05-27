import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Coins, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useAccountingStore } from "@/stores/accountingStore";
import type { AccountingMode } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// AccountingModeGate — modale d'onboarding qui demande à l'utilisateur de
// choisir son mode comptable (engagement | trésorerie) la première fois.
// Une fois choisi, propose de régénérer l'historique des écritures.
// ═══════════════════════════════════════════════════════════════════════════

export function AccountingModeGate() {
  const settings = useAccountingStore((s) => s.settings);
  const fetchSettings = useAccountingStore((s) => s.fetchSettings);
  const setMode = useAccountingStore((s) => s.setMode);
  const regenerateAll = useAccountingStore((s) => s.regenerateAll);
  const isRegenerating = useAccountingStore((s) => s.isRegenerating);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "confirm" | "regenerating" | "done">("choose");
  const [selectedMode, setSelectedMode] = useState<Exclude<AccountingMode, "">>("engagement");
  const [regenStats, setRegenStats] = useState<{ invoices: number; expenses: number; invoicePayments: number; expensePayments: number } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings && settings.mode === "") setOpen(true);
  }, [settings]);

  const handleConfirmMode = async () => {
    const res = await setMode(selectedMode);
    if (!res.success) {
      toast.error("Erreur", { description: res.error });
      return;
    }
    setStep("confirm");
  };

  const handleRegenerate = async () => {
    setStep("regenerating");
    const r = await regenerateAll();
    if (r.success) {
      setRegenStats({
        invoices: r.invoices,
        expenses: r.expenses,
        invoicePayments: r.invoicePayments,
        expensePayments: r.expensePayments,
      });
      setStep("done");
    } else {
      toast.error("Erreur lors de la régénération");
      setStep("confirm");
    }
  };

  const handleSkipRegenerate = () => {
    setStep("done");
    setRegenStats({ invoices: 0, expenses: 0, invoicePayments: 0, expensePayments: 0 });
  };

  const handleClose = () => {
    setOpen(false);
    setStep("choose");
  };

  if (!settings) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-2xl w-full overflow-hidden"
          >
            {step === "choose" && (
              <>
                <div className="px-6 pt-6 pb-2">
                  <h2 className="text-xl font-semibold mb-1">Configuration de la comptabilité</h2>
                  <p className="text-sm text-muted-foreground">
                    Choisissez le mode comptable adapté à votre structure. Vous pourrez le changer plus tard dans les paramètres.
                  </p>
                </div>

                <div className="px-6 pb-6 pt-4 grid sm:grid-cols-2 gap-3">
                  <ModeCard
                    icon={<BookOpen className="w-6 h-6" />}
                    title="Engagement"
                    subtitle="SARL · SAS · EURL"
                    selected={selectedMode === "engagement"}
                    onClick={() => setSelectedMode("engagement")}
                    description="Les écritures sont générées dès l'émission de la facture ou la saisie de la dépense. C'est la norme pour les sociétés commerciales (suivi créances/dettes)."
                  />
                  <ModeCard
                    icon={<Coins className="w-6 h-6" />}
                    title="Trésorerie"
                    subtitle="Micro-entreprise · EI"
                    selected={selectedMode === "tresorerie"}
                    onClick={() => setSelectedMode("tresorerie")}
                    description="Les écritures sont générées aux encaissements et décaissements réels. Plus simple, adapté aux micro-entreprises et entreprises individuelles."
                  />
                </div>

                <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-muted/30">
                  <Button onClick={handleConfirmMode}>
                    Continuer avec ce mode
                  </Button>
                </div>
              </>
            )}

            {step === "confirm" && (
              <>
                <div className="px-6 pt-6 pb-2">
                  <h2 className="text-xl font-semibold mb-1">Régénérer l'historique ?</h2>
                  <p className="text-sm text-muted-foreground">
                    Toutes vos factures, dépenses et paiements existants peuvent être convertis automatiquement en écritures comptables en partie double. Cette opération est sûre et peut être relancée à tout moment.
                  </p>
                </div>
                <div className="px-6 py-4 bg-muted/30 mx-6 my-4 rounded-lg border border-border text-sm">
                  <strong>Recommandé :</strong> régénérer tout l'historique pour disposer immédiatement du livre journal, du grand livre, de la balance, du compte de résultat et du bilan.
                </div>
                <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-muted/30">
                  <Button variant="outline" onClick={handleSkipRegenerate}>
                    Plus tard
                  </Button>
                  <Button onClick={handleRegenerate} loading={isRegenerating}>
                    Régénérer maintenant
                  </Button>
                </div>
              </>
            )}

            {step === "regenerating" && (
              <div className="px-6 py-12 flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <div className="text-center">
                  <h2 className="text-lg font-semibold">Régénération en cours…</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Conversion des factures, dépenses et paiements en écritures comptables.
                  </p>
                </div>
              </div>
            )}

            {step === "done" && (
              <>
                <div className="px-6 pt-6 pb-2 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Comptabilité configurée</h2>
                    <p className="text-sm text-muted-foreground">
                      Votre comptabilité est prête. Les nouvelles factures et dépenses généreront automatiquement leurs écritures.
                    </p>
                  </div>
                </div>
                {regenStats && (regenStats.invoices + regenStats.expenses + regenStats.invoicePayments + regenStats.expensePayments) > 0 && (
                  <div className="px-6 py-4 mx-6 my-4 rounded-lg border border-border bg-muted/30 text-sm space-y-1">
                    <div className="flex justify-between"><span>Factures traitées</span><strong>{regenStats.invoices}</strong></div>
                    <div className="flex justify-between"><span>Dépenses traitées</span><strong>{regenStats.expenses}</strong></div>
                    <div className="flex justify-between"><span>Encaissements traités</span><strong>{regenStats.invoicePayments}</strong></div>
                    <div className="flex justify-between"><span>Règlements traités</span><strong>{regenStats.expensePayments}</strong></div>
                  </div>
                )}
                <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-muted/30">
                  <Button onClick={handleClose}>Terminer</Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ModeCard({
  icon,
  title,
  subtitle,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left p-4 rounded-lg border-2 transition-all",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/30",
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
        selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
      )}>
        {icon}
      </div>
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mb-2">{subtitle}</div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </button>
  );
}
