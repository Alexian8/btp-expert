import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// QuoteMath — calculs HT / TVA / TTC d'un devis ou d'une facture.
//
// Port fidèle de apps/desktop/src/features/quotes/quoteEngine.ts :
// la remise globale s'applique au sous-total HT après remises de ligne, puis
// la TVA est recalculée au prorata pour chaque taux.
// ═══════════════════════════════════════════════════════════════════════════

enum QuoteMath {
    /// Arrondi à 2 décimales — équivalent du round2 de quoteEngine.ts.
    static func round2(_ value: Double) -> Double {
        ((value + Double.ulpOfOne) * 100).rounded() / 100
    }

    struct LineAmounts {
        var grossHT: Double
        var discount: Double
        var netHT: Double
    }

    struct VatLine: Identifiable {
        var rate: Double
        var base: Double
        var tax: Double
        var id: Double { rate }
    }

    struct Totals {
        var subtotalHT: Double          // sous-total HT après remises de ligne
        var globalDiscount: Double      // remise globale en €
        var totalHT: Double
        var totalVAT: Double
        var totalTTC: Double
        var vatLines: [VatLine]         // détail TVA par taux (taux utilisés seulement)
    }

    /// Montants d'une ligne : brut HT, remise, HT net.
    static func lineAmounts(_ item: QuoteItem) -> LineAmounts {
        guard !item.isSection else {
            return LineAmounts(grossHT: 0, discount: 0, netHT: 0)
        }
        let gross = item.quantity * item.unitPriceHT
        var discount = 0.0
        if item.discountMode == "percent", item.discountPercent > 0 {
            discount = gross * (item.discountPercent / 100)
        } else if item.discountMode == "amount", item.discountAmount > 0 {
            discount = min(item.discountAmount, gross)
        }
        let net = max(0, gross - discount)
        return LineAmounts(grossHT: round2(gross), discount: round2(discount), netHT: round2(net))
    }

    /// TTC d'une ligne seule (pour l'affichage par ligne).
    static func lineTotalTTC(_ item: QuoteItem) -> Double {
        let net = lineAmounts(item).netHT
        return round2(net + net * (item.vatRate / 100))
    }

    /// Totaux complets d'un devis / d'une facture.
    static func computeTotals(
        items: [QuoteItem],
        globalDiscountMode: String,
        globalDiscountPercent: Double,
        globalDiscountAmount: Double
    ) -> Totals {
        // 1) Sous-total HT après remises de ligne
        var subtotalHT = 0.0
        for item in items where !item.isSection {
            subtotalHT += lineAmounts(item).netHT
        }

        // 2) Remise globale
        var globalDiscount = 0.0
        if globalDiscountMode == "percent", globalDiscountPercent > 0 {
            globalDiscount = subtotalHT * (globalDiscountPercent / 100)
        } else if globalDiscountMode == "amount", globalDiscountAmount > 0 {
            globalDiscount = min(globalDiscountAmount, subtotalHT)
        }
        let totalHT = max(0, subtotalHT - globalDiscount)

        // 3) TVA recalculée au prorata après remise globale
        let ratio = subtotalHT > 0 ? totalHT / subtotalHT : 0
        let standardRates: [Double] = [20, 10, 5.5, 0]
        var vatLines: [VatLine] = []
        for rate in standardRates {
            var base = 0.0
            for item in items where !item.isSection && item.vatRate == rate {
                base += lineAmounts(item).netHT * ratio
            }
            if base > 0 {
                vatLines.append(VatLine(rate: rate, base: round2(base), tax: round2(base * (rate / 100))))
            }
        }

        let totalVAT = round2(vatLines.reduce(0) { $0 + $1.tax })
        let totalTTC = round2(round2(totalHT) + totalVAT)

        return Totals(
            subtotalHT: round2(subtotalHT),
            globalDiscount: round2(globalDiscount),
            totalHT: round2(totalHT),
            totalVAT: totalVAT,
            totalTTC: totalTTC,
            vatLines: vatLines
        )
    }
}
