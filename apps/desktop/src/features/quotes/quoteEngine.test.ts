import { describe, it, expect } from "vitest";

import type { Quote, QuoteItem, VatRate } from "@btp/types";

import {
  calculateLineHT,
  calculateLineTTC,
  computeQuoteTotals,
} from "./quoteEngine";

// ─── Helpers ────────────────────────────────────────────────────────────────

let idCounter = 0;
const nextId = () => `id-${++idCounter}`;

function line(overrides: Partial<QuoteItem> = {}): QuoteItem {
  return {
    id: nextId(),
    kind: "line",
    title: "",
    description: "",
    quantity: 1,
    unit: "u",
    unitPriceHT: 0,
    vatRate: 20 as VatRate,
    discountPercent: 0,
    discountAmount: 0,
    discountMode: "none",
    ...overrides,
  };
}

function section(title = "Section"): QuoteItem {
  return {
    id: nextId(),
    kind: "section",
    title,
    description: "",
    quantity: 0,
    unit: "",
    unitPriceHT: 0,
    vatRate: 20 as VatRate,
    discountPercent: 0,
    discountAmount: 0,
    discountMode: "none",
  };
}

type QuoteTotalsInput = Pick<
  Quote,
  "items" | "globalDiscountMode" | "globalDiscountPercent" | "globalDiscountAmount"
>;

function quote(items: QuoteItem[], overrides: Partial<QuoteTotalsInput> = {}): QuoteTotalsInput {
  return {
    items,
    globalDiscountMode: "none",
    globalDiscountPercent: 0,
    globalDiscountAmount: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// calculateLineHT
// ═══════════════════════════════════════════════════════════════════════════

describe("calculateLineHT", () => {
  it("computes raw HT from quantity × unit price with no discount", () => {
    const result = calculateLineHT(line({ quantity: 3, unitPriceHT: 100 }));
    expect(result).toEqual({ bruthT: 300, discount: 0, netHT: 300 });
  });

  it("applies a percent discount", () => {
    const result = calculateLineHT(
      line({ quantity: 1, unitPriceHT: 1000, discountMode: "percent", discountPercent: 10 }),
    );
    expect(result.bruthT).toBe(1000);
    expect(result.discount).toBe(100);
    expect(result.netHT).toBe(900);
  });

  it("applies a fixed-amount discount", () => {
    const result = calculateLineHT(
      line({ quantity: 1, unitPriceHT: 500, discountMode: "amount", discountAmount: 75 }),
    );
    expect(result.discount).toBe(75);
    expect(result.netHT).toBe(425);
  });

  it("caps a fixed-amount discount at the brut HT (never negative)", () => {
    const result = calculateLineHT(
      line({ quantity: 1, unitPriceHT: 100, discountMode: "amount", discountAmount: 999 }),
    );
    expect(result.discount).toBe(100);
    expect(result.netHT).toBe(0);
  });

  it("returns zeros for a section (kind !== 'line')", () => {
    expect(calculateLineHT(section())).toEqual({ bruthT: 0, discount: 0, netHT: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// calculateLineTTC
// ═══════════════════════════════════════════════════════════════════════════

describe("calculateLineTTC", () => {
  it("applies 20% VAT (default professional rate)", () => {
    const result = calculateLineTTC(line({ quantity: 1, unitPriceHT: 1000, vatRate: 20 }));
    expect(result).toEqual({ netHT: 1000, vat: 200, ttc: 1200 });
  });

  it("applies 5.5% reduced VAT (renovation énergétique)", () => {
    const result = calculateLineTTC(line({ quantity: 1, unitPriceHT: 1000, vatRate: 5.5 }));
    expect(result).toEqual({ netHT: 1000, vat: 55, ttc: 1055 });
  });

  it("applies 10% intermediate VAT (travaux d'amélioration)", () => {
    const result = calculateLineTTC(line({ quantity: 1, unitPriceHT: 1000, vatRate: 10 }));
    expect(result).toEqual({ netHT: 1000, vat: 100, ttc: 1100 });
  });

  it("applies 0% VAT (exonération)", () => {
    const result = calculateLineTTC(line({ quantity: 2, unitPriceHT: 250, vatRate: 0 }));
    expect(result).toEqual({ netHT: 500, vat: 0, ttc: 500 });
  });

  it("computes TTC after a line discount", () => {
    const result = calculateLineTTC(
      line({
        quantity: 1,
        unitPriceHT: 100,
        vatRate: 20,
        discountMode: "percent",
        discountPercent: 10,
      }),
    );
    // 100 - 10% = 90 HT, +20% VAT = 108 TTC
    expect(result).toEqual({ netHT: 90, vat: 18, ttc: 108 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// computeQuoteTotals — devis complet
// ═══════════════════════════════════════════════════════════════════════════

describe("computeQuoteTotals", () => {
  it("sums a single line at 20% VAT", () => {
    const totals = computeQuoteTotals(
      quote([line({ quantity: 1, unitPriceHT: 1000, vatRate: 20 })]),
    );
    expect(totals.totalHT).toBe(1000);
    expect(totals.totalVAT).toBe(200);
    expect(totals.totalTTC).toBe(1200);
    expect(totals.vatDetail[20]).toEqual({ base: 1000, tax: 200 });
  });

  it("aggregates several VAT rates into vatDetail", () => {
    const totals = computeQuoteTotals(
      quote([
        line({ quantity: 1, unitPriceHT: 1000, vatRate: 20 }),
        line({ quantity: 1, unitPriceHT: 1000, vatRate: 10 }),
        line({ quantity: 1, unitPriceHT: 1000, vatRate: 5.5 }),
      ]),
    );
    expect(totals.totalHT).toBe(3000);
    expect(totals.vatDetail[20]).toEqual({ base: 1000, tax: 200 });
    expect(totals.vatDetail[10]).toEqual({ base: 1000, tax: 100 });
    expect(totals.vatDetail[5.5]).toEqual({ base: 1000, tax: 55 });
    expect(totals.totalVAT).toBe(355);
    expect(totals.totalTTC).toBe(3355);
  });

  it("ignores sections in totals", () => {
    const totals = computeQuoteTotals(
      quote([
        section("Maçonnerie"),
        line({ quantity: 1, unitPriceHT: 500, vatRate: 20 }),
        section("Plomberie"),
        line({ quantity: 1, unitPriceHT: 500, vatRate: 20 }),
      ]),
    );
    expect(totals.totalHT).toBe(1000);
    expect(totals.totalTTC).toBe(1200);
  });

  it("applies a global percent discount on the post-line-discount subtotal", () => {
    const totals = computeQuoteTotals(
      quote([line({ quantity: 1, unitPriceHT: 1000, vatRate: 20 })], {
        globalDiscountMode: "percent",
        globalDiscountPercent: 5,
      }),
    );
    expect(totals.subtotalAfterLineDiscountsHT).toBe(1000);
    expect(totals.globalDiscount).toBe(50);
    expect(totals.totalHT).toBe(950);
    expect(totals.totalVAT).toBe(190);
    expect(totals.totalTTC).toBe(1140);
  });

  it("applies a global fixed-amount discount", () => {
    const totals = computeQuoteTotals(
      quote([line({ quantity: 1, unitPriceHT: 1000, vatRate: 20 })], {
        globalDiscountMode: "amount",
        globalDiscountAmount: 100,
      }),
    );
    expect(totals.globalDiscount).toBe(100);
    expect(totals.totalHT).toBe(900);
    expect(totals.totalTTC).toBe(1080);
  });

  it("caps a global fixed-amount discount at the subtotal (never negative)", () => {
    const totals = computeQuoteTotals(
      quote([line({ quantity: 1, unitPriceHT: 100, vatRate: 20 })], {
        globalDiscountMode: "amount",
        globalDiscountAmount: 9999,
      }),
    );
    expect(totals.globalDiscount).toBe(100);
    expect(totals.totalHT).toBe(0);
    expect(totals.totalTTC).toBe(0);
  });

  it("redistributes a global discount proportionally across VAT rates", () => {
    // 1000 € HT @ 20% + 1000 € HT @ 10% = 2000 € HT subtotal
    // 10% global discount → 1800 € HT total
    // Ratio post-discount = 0.9 — each VAT base shrinks by 10%
    const totals = computeQuoteTotals(
      quote(
        [
          line({ quantity: 1, unitPriceHT: 1000, vatRate: 20 }),
          line({ quantity: 1, unitPriceHT: 1000, vatRate: 10 }),
        ],
        { globalDiscountMode: "percent", globalDiscountPercent: 10 },
      ),
    );
    expect(totals.subtotalAfterLineDiscountsHT).toBe(2000);
    expect(totals.globalDiscount).toBe(200);
    expect(totals.totalHT).toBe(1800);
    expect(totals.vatDetail[20]).toEqual({ base: 900, tax: 180 });
    expect(totals.vatDetail[10]).toEqual({ base: 900, tax: 90 });
    expect(totals.totalVAT).toBe(270);
    expect(totals.totalTTC).toBe(2070);
  });

  it("combines line discounts and global discount", () => {
    // Line: 1000 € HT - 10% = 900 € HT net
    // Global discount on 900: -5% = 855 € HT
    // VAT @ 20% on 855 = 171 € → TTC 1026 €
    const totals = computeQuoteTotals(
      quote(
        [
          line({
            quantity: 1,
            unitPriceHT: 1000,
            vatRate: 20,
            discountMode: "percent",
            discountPercent: 10,
          }),
        ],
        { globalDiscountMode: "percent", globalDiscountPercent: 5 },
      ),
    );
    expect(totals.subtotalBeforeDiscountHT).toBe(1000);
    expect(totals.totalLineDiscounts).toBe(100);
    expect(totals.subtotalAfterLineDiscountsHT).toBe(900);
    expect(totals.globalDiscount).toBe(45);
    expect(totals.totalHT).toBe(855);
    expect(totals.totalVAT).toBe(171);
    expect(totals.totalTTC).toBe(1026);
  });

  it("handles an empty quote (no lines)", () => {
    const totals = computeQuoteTotals(quote([]));
    expect(totals.totalHT).toBe(0);
    expect(totals.totalVAT).toBe(0);
    expect(totals.totalTTC).toBe(0);
    expect(totals.vatDetail[20]).toEqual({ base: 0, tax: 0 });
  });

  it("rounds to 2 decimals (no floating-point garbage)", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS — engine must clean that up
    const totals = computeQuoteTotals(
      quote([
        line({ quantity: 1, unitPriceHT: 0.1, vatRate: 20 }),
        line({ quantity: 1, unitPriceHT: 0.2, vatRate: 20 }),
      ]),
    );
    expect(totals.totalHT).toBe(0.3);
    expect(totals.totalTTC).toBe(0.36);
  });

  it("does not over-charge VAT when the global discount is 100%", () => {
    const totals = computeQuoteTotals(
      quote([line({ quantity: 1, unitPriceHT: 1000, vatRate: 20 })], {
        globalDiscountMode: "percent",
        globalDiscountPercent: 100,
      }),
    );
    expect(totals.totalHT).toBe(0);
    expect(totals.totalVAT).toBe(0);
    expect(totals.totalTTC).toBe(0);
  });
});
