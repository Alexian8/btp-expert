import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Invoice, InvoicePayment, QuoteItem, VatRate } from "@btp/types";

import {
  computeInvoiceTotals,
  daysBetween,
  daysOverdue,
  formatDateFR,
  isInvoiceOverdue,
} from "./invoiceEngine";

// ─── Helpers ────────────────────────────────────────────────────────────────

let idCounter = 0;
const nextId = () => `id-${++idCounter}`;

function line(unitPriceHT: number, vatRate: VatRate = 20, quantity = 1): QuoteItem {
  return {
    id: nextId(),
    kind: "line",
    title: "",
    description: "",
    quantity,
    unit: "u",
    unitPriceHT,
    vatRate,
    discountPercent: 0,
    discountAmount: 0,
    discountMode: "none",
  };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: nextId(),
    reference: "FACT-TEST",
    status: "envoyee",
    type: "standard",
    title: "",
    clientId: "client-1",
    chantierId: "",
    fromQuoteId: "",
    issueDate: "2026-01-01",
    dueDate: "2026-01-31",
    paymentTermsDays: 30,
    sentAt: "",
    paidAt: "",
    items: [],
    globalDiscountMode: "none",
    globalDiscountPercent: 0,
    globalDiscountAmount: 0,
    acompteBasedOnQuoteId: "",
    acomptePercent: 0,
    avoirReferenceInvoiceId: "",
    introText: "",
    conditionsText: "",
    footerText: "",
    internalNotes: "",
    companySnapshot: {},
    totalHT: 0,
    totalTTC: 0,
    totalPaid: 0,
    lastReminderSentAt: "",
    remindersCount: 0,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function payment(amount: number, date = "2026-01-15"): InvoicePayment {
  return {
    id: nextId(),
    invoiceId: "any",
    amount,
    date,
    method: "virement",
    reference: "",
    notes: "",
    createdAt: "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// computeInvoiceTotals
// ═══════════════════════════════════════════════════════════════════════════

describe("computeInvoiceTotals", () => {
  it("reuses quote totals and adds payment info (zero payments)", () => {
    const totals = computeInvoiceTotals(invoice({ items: [line(1000, 20)] }), []);
    expect(totals.totalHT).toBe(1000);
    expect(totals.totalTTC).toBe(1200);
    expect(totals.totalPaid).toBe(0);
    expect(totals.remainingDue).toBe(1200);
  });

  it("sums payments and computes remaining due", () => {
    const totals = computeInvoiceTotals(
      invoice({ items: [line(1000, 20)] }),
      [payment(300), payment(400)],
    );
    expect(totals.totalPaid).toBe(700);
    expect(totals.remainingDue).toBe(500);
  });

  it("clamps remainingDue at 0 when overpaid", () => {
    const totals = computeInvoiceTotals(invoice({ items: [line(100, 20)] }), [payment(500)]);
    expect(totals.totalPaid).toBe(500);
    expect(totals.remainingDue).toBe(0);
  });

  it("returns 0 totals for an empty invoice", () => {
    const totals = computeInvoiceTotals(invoice({ items: [] }), []);
    expect(totals.totalHT).toBe(0);
    expect(totals.totalTTC).toBe(0);
    expect(totals.remainingDue).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// daysBetween / formatDateFR
// ═══════════════════════════════════════════════════════════════════════════

describe("daysBetween", () => {
  it("returns the number of days between two ISO dates", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
  });

  it("returns 0 for the same day", () => {
    expect(daysBetween("2026-01-15", "2026-01-15")).toBe(0);
  });

  it("returns a negative number when the range is reversed", () => {
    expect(daysBetween("2026-02-01", "2026-01-01")).toBe(-31);
  });

  it("returns 0 when either input is empty", () => {
    expect(daysBetween("", "2026-01-01")).toBe(0);
    expect(daysBetween("2026-01-01", "")).toBe(0);
  });
});

describe("formatDateFR", () => {
  it("formats an ISO date in fr-FR locale", () => {
    expect(formatDateFR("2026-03-14")).toBe("14/03/2026");
  });

  it("returns an empty string for empty input", () => {
    expect(formatDateFR("")).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isInvoiceOverdue / daysOverdue — time-sensitive, freeze the clock
// ═══════════════════════════════════════════════════════════════════════════

describe("isInvoiceOverdue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is true when dueDate is in the past and status is 'envoyee'", () => {
    expect(isInvoiceOverdue(invoice({ status: "envoyee", dueDate: "2026-01-31" }))).toBe(true);
  });

  it("is false when status is 'payee' even with a past dueDate", () => {
    expect(isInvoiceOverdue(invoice({ status: "payee", dueDate: "2026-01-31" }))).toBe(false);
  });

  it("is false when status is 'brouillon'", () => {
    expect(isInvoiceOverdue(invoice({ status: "brouillon", dueDate: "2026-01-31" }))).toBe(false);
  });

  it("is false when status is 'annulee'", () => {
    expect(isInvoiceOverdue(invoice({ status: "annulee", dueDate: "2026-01-31" }))).toBe(false);
  });

  it("is false when dueDate is today (not yet overdue)", () => {
    expect(isInvoiceOverdue(invoice({ status: "envoyee", dueDate: "2026-02-15" }))).toBe(false);
  });

  it("is false when dueDate is in the future", () => {
    expect(isInvoiceOverdue(invoice({ status: "envoyee", dueDate: "2026-03-01" }))).toBe(false);
  });

  it("is false when dueDate is empty", () => {
    expect(isInvoiceOverdue(invoice({ status: "envoyee", dueDate: "" }))).toBe(false);
  });

  it("is true for partiellement-payee invoices past due", () => {
    expect(
      isInvoiceOverdue(invoice({ status: "partiellement-payee", dueDate: "2026-01-31" })),
    ).toBe(true);
  });
});

describe("daysOverdue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 when not overdue", () => {
    expect(daysOverdue(invoice({ status: "payee", dueDate: "2026-01-01" }))).toBe(0);
    expect(daysOverdue(invoice({ status: "envoyee", dueDate: "2026-03-01" }))).toBe(0);
  });

  it("returns the number of days past the due date", () => {
    expect(daysOverdue(invoice({ status: "envoyee", dueDate: "2026-01-31" }))).toBe(15);
  });
});
