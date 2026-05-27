import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, BookOpen, Coins } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAccountingStore } from "@/stores/accountingStore";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ACCOUNTING_MODE_LABEL } from "@btp/types";
import type { AccountingMode } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// AccountingSettingsView — Paramètres comptables
// Changement de mode + régénération de l'historique
// ═══════════════════════════════════════════════════════════════════════════

export function AccountingSettingsView() {
  const settings = useAccountingStore((s) => s.settings);
  const fetchSettings = useAccountingStore((s) => s.fetchSettings);
  const updateSettings = useAccountingStore((s) => s.updateSettings);
  const regenerateAll = useAccountingStore((s) => s.regenerateAll);
  const isRegenerating = useAccountingStore((s) => s.isRegenerating);

  const [pendingMode, setPendingMode] = useState<Exclude<AccountingMode, ""> | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  if (!settings) return null;

  const handleSwitchMode = async () => {
    if (!pendingMode) return;
    const r = await updateSettings({ mode: pendingMode });
    if (r.success) {
      toast.success("Mode modifié — pensez à régénérer l'historique");
      setPendingMode(null);
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleRegenerate = async () => {
    setConfirmRegen(false);
    const r = await regenerateAll();
    if (r.success) {
      toast.success("Historique régénéré", {
        description: `${r.invoices} factures · ${r.expenses} dépenses · ${r.invoicePayments + r.expensePayments} paiements`,
      });
    } else {
      toast.error("Erreur lors de la régénération");
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-5">
        <h3 className="font-semibold mb-1">Mode comptable actuel</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Détermine quand les écritures comptables sont générées automatiquement.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ModeCard
            mode="engagement"
            icon={<BookOpen className="w-5 h-5" />}
            title="Engagement"
            subtitle="SARL · SAS"
            description="Écritures à l'émission des factures et saisie des dépenses. Suivi créances/dettes."
            active={settings.mode === "engagement"}
            onSelect={() => settings.mode !== "engagement" && setPendingMode("engagement")}
          />
          <ModeCard
            mode="tresorerie"
            icon={<Coins className="w-5 h-5" />}
            title="Trésorerie"
            subtitle="Micro · EI"
            description="Écritures uniquement aux encaissements et décaissements."
            active={settings.mode === "tresorerie"}
            onSelect={() => settings.mode !== "tresorerie" && setPendingMode("tresorerie")}
          />
        </div>

        {settings.modeChosenAt && (
          <p className="text-xs text-muted-foreground mt-3">
            Choix initial : {new Date(settings.modeChosenAt).toLocaleDateString("fr-FR")}
          </p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Régénérer toutes les écritures</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Recalcule automatiquement toutes les écritures comptables à partir des factures, dépenses et paiements existants. À utiliser après un changement de mode ou en cas d'incohérence.
            </p>
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Les écritures manuelles (OD) ne sont pas affectées.</span>
            </div>
          </div>
          <Button onClick={() => setConfirmRegen(true)} loading={isRegenerating}>
            Régénérer
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Génération automatique des écritures</h3>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-sm">
              {settings.autoGenerateEntries ? "Activée" : "Désactivée"}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {settings.autoGenerateEntries
                ? "Les écritures sont générées en temps réel quand vous créez/modifiez des factures et dépenses."
                : "La génération automatique est désactivée — vous devez régénérer manuellement."}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              const r = await updateSettings({ autoGenerateEntries: settings.autoGenerateEntries ? 0 : 1 });
              if (r.success) toast.success(settings.autoGenerateEntries ? "Génération auto désactivée" : "Génération auto activée");
            }}
          >
            {settings.autoGenerateEntries ? "Désactiver" : "Activer"}
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={!!pendingMode}
        onCancel={() => setPendingMode(null)}
        onConfirm={handleSwitchMode}
        title={`Passer en ${pendingMode ? ACCOUNTING_MODE_LABEL[pendingMode] : ""} ?`}
        description={(
          <span>
            Les nouvelles écritures suivront la logique du nouveau mode. Pour appliquer le changement aux factures et dépenses existantes, lancez ensuite "Régénérer toutes les écritures".
          </span>
        )}
        confirmLabel="Changer de mode"
      />

      <ConfirmDialog
        open={confirmRegen}
        onCancel={() => setConfirmRegen(false)}
        onConfirm={handleRegenerate}
        title="Régénérer toutes les écritures ?"
        description={(
          <span>
            Toutes les écritures automatiques (VE, AC, BQ) seront supprimées et recréées à partir des factures, dépenses et paiements actuels. Les écritures manuelles (OD) sont conservées. L'opération est sûre et idempotente.
          </span>
        )}
        confirmLabel="Lancer la régénération"
      />
    </div>
  );
}

function ModeCard({
  icon, title, subtitle, description, active, onSelect,
}: {
  mode: AccountingMode;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`p-4 rounded-lg border-2 text-left transition-all ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
      disabled={active}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          {icon}
        </div>
        {active && <CheckCircle2 className="w-5 h-5 text-primary" />}
      </div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mb-2">{subtitle}</div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </button>
  );
}
