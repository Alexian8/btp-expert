import { Percent, Euro } from "lucide-react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { Quote, QuoteTotals } from "@btp/types";
import { formatEuros } from "../quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// QuoteTotalsPanel — Affichage des totaux + remise globale
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  totals: QuoteTotals;
  quote: Pick<Quote, "globalDiscountMode" | "globalDiscountPercent" | "globalDiscountAmount">;
  onDiscountChange: (patch: { globalDiscountMode?: "percent" | "amount" | "none"; globalDiscountPercent?: number; globalDiscountAmount?: number }) => void;
  vatEnabled: boolean;
}

export function QuoteTotalsPanel({ totals, quote, onDiscountChange, vatEnabled }: Props) {
  const hasLineDiscounts = totals.totalLineDiscounts > 0;
  const hasGlobalDiscount = quote.globalDiscountMode !== "none" && totals.globalDiscount > 0;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold">Totaux</h3>

      {/* Sous-total brut */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Sous-total HT</span>
        <span className="tabular-nums">{formatEuros(totals.subtotalBeforeDiscountHT)}</span>
      </div>

      {hasLineDiscounts && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Remises par ligne</span>
          <span className="tabular-nums">− {formatEuros(totals.totalLineDiscounts)}</span>
        </div>
      )}

      {hasLineDiscounts && (
        <div className="flex justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">Après remises lignes</span>
          <span className="tabular-nums">{formatEuros(totals.subtotalAfterLineDiscountsHT)}</span>
        </div>
      )}

      {/* Remise globale */}
      <div className="pt-2 border-t border-border">
        <label className="text-xs text-muted-foreground block mb-1">Remise globale</label>
        <div className="flex items-center gap-2">
          <NativeSelect
            value={quote.globalDiscountMode}
            onChange={(e) => onDiscountChange({ globalDiscountMode: e.target.value as any })}
            className="h-8 flex-1"
          >
            <option value="none">Aucune</option>
            <option value="percent">En %</option>
            <option value="amount">En €</option>
          </NativeSelect>
          {quote.globalDiscountMode === "percent" && (
            <div className="relative w-24">
              <Input
                type="number"
                step="0.1"
                value={quote.globalDiscountPercent || ""}
                onChange={(e) => onDiscountChange({ globalDiscountPercent: Number(e.target.value) || 0 })}
                className="h-8 pr-5 tabular-nums"
              />
              <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            </div>
          )}
          {quote.globalDiscountMode === "amount" && (
            <div className="relative w-28">
              <Input
                type="number"
                step="0.01"
                value={quote.globalDiscountAmount || ""}
                onChange={(e) => onDiscountChange({ globalDiscountAmount: Number(e.target.value) || 0 })}
                className="h-8 pr-5 tabular-nums"
              />
              <Euro className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            </div>
          )}
        </div>
        {hasGlobalDiscount && (
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            Soit − {formatEuros(totals.globalDiscount)}
          </p>
        )}
      </div>

      {/* Total HT */}
      <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
        <span>Total HT</span>
        <span className="tabular-nums">{formatEuros(totals.totalHT)}</span>
      </div>

      {/* Détail TVA */}
      {vatEnabled ? (
        <div className="space-y-1 text-sm">
          {([20, 10, 5.5, 0] as const).map((rate) => {
            const detail = totals.vatDetail[rate];
            if (detail.tax === 0 && detail.base === 0) return null;
            return (
              <div key={rate} className="flex justify-between text-muted-foreground">
                <span>TVA {rate}% sur {formatEuros(detail.base)}</span>
                <span className="tabular-nums">{formatEuros(detail.tax)}</span>
              </div>
            );
          })}
          <div className="flex justify-between font-medium pt-1 border-t border-border">
            <span>Total TVA</span>
            <span className="tabular-nums">{formatEuros(totals.totalVAT)}</span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic p-2 rounded-md bg-muted/50">
          TVA non applicable — art. 293 B du CGI
        </div>
      )}

      {/* Total TTC */}
      <div className="flex justify-between text-lg font-bold pt-3 border-t-2 border-primary/30">
        <span>Total {vatEnabled ? "TTC" : "à payer"}</span>
        <span className="tabular-nums text-primary">{formatEuros(totals.totalTTC)}</span>
      </div>
    </div>
  );
}
