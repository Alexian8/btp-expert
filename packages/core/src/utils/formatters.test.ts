import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  formatPhone,
  formatSiret,
} from "./formatters";

const NBSP = " ";
const NNBSP = " ";
const stripSpaces = (s: string) => s.replace(/[\s  ]/g, "");

describe("formatCurrency", () => {
  it("formate une somme positive en euros français", () => {
    expect(stripSpaces(formatCurrency(1234.5))).toBe("1234,50€");
  });

  it("retourne 0,00€ pour null/undefined/NaN", () => {
    expect(stripSpaces(formatCurrency(null))).toBe("0,00€");
    expect(stripSpaces(formatCurrency(undefined))).toBe("0,00€");
    expect(stripSpaces(formatCurrency("abc"))).toBe("0,00€");
  });

  it("accepte une string numérique", () => {
    expect(stripSpaces(formatCurrency("99.99"))).toBe("99,99€");
  });

  it("formate les montants négatifs", () => {
    const result = formatCurrency(-50);
    expect(result).toContain("50,00");
    expect(result).toMatch(/[-−]/);
  });
});

describe("formatNumber", () => {
  it("respecte le nombre de décimales demandé", () => {
    expect(formatNumber(3.14159, 2)).toBe("3,14");
    expect(formatNumber(3.14159, 4)).toBe("3,1416");
    expect(formatNumber(3, 0)).toBe("3");
  });

  it("retourne 0,00 par défaut pour valeurs invalides", () => {
    expect(formatNumber(null)).toBe("0,00");
    expect(formatNumber(undefined)).toBe("0,00");
  });
});

describe("formatDate", () => {
  it("format short par défaut (jj/mm/aaaa)", () => {
    expect(formatDate("2026-05-09")).toBe("09/05/2026");
  });

  it("format numeric identique à toLocaleDateString fr-FR", () => {
    const result = formatDate("2026-05-09", "numeric");
    expect(result).toMatch(/^0?9\/0?5\/2026$/);
  });

  it("format long contient le mois en lettres", () => {
    const result = formatDate("2026-05-09", "long");
    expect(result.toLowerCase()).toContain("mai");
    expect(result).toContain("2026");
  });

  it("retourne chaîne vide pour null/undefined/invalide", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("not-a-date")).toBe("");
  });

  it("accepte un objet Date", () => {
    expect(formatDate(new Date("2026-01-15"))).toBe("15/01/2026");
  });
});

describe("formatDateTime", () => {
  it("inclut heures et minutes sur 2 chiffres", () => {
    const result = formatDateTime("2026-05-09T08:05:00");
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  it("retourne chaîne vide pour invalide", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime("xyz")).toBe("");
  });
});

describe("formatPhone", () => {
  it("formate un numéro français à 10 chiffres avec espaces", () => {
    expect(formatPhone("0123456789")).toBe("01 23 45 67 89");
  });

  it("nettoie les caractères non numériques avant formatage", () => {
    expect(formatPhone("01.23.45.67.89")).toBe("01 23 45 67 89");
    expect(formatPhone("01-23-45-67-89")).toBe("01 23 45 67 89");
  });

  it("avec préfixe international (>10 chiffres) retourne tel quel", () => {
    // +33123456789 = 11 chiffres après nettoyage → format inchangé
    expect(formatPhone("+33 1 23 45 67 89")).toBe("+33 1 23 45 67 89");
  });

  it("retourne tel quel si pas 10 chiffres", () => {
    expect(formatPhone("12345")).toBe("12345");
  });

  it("retourne chaîne vide pour null/undefined", () => {
    expect(formatPhone(null)).toBe("");
    expect(formatPhone(undefined)).toBe("");
  });
});

describe("formatSiret", () => {
  it("formate un SIRET 14 chiffres en groupes 3-3-3-5", () => {
    expect(formatSiret("12345678900012")).toBe("123 456 789 00012");
  });

  it("nettoie les espaces avant formatage", () => {
    expect(formatSiret("123 456 789 00012")).toBe("123 456 789 00012");
  });

  it("retourne tel quel si pas 14 chiffres", () => {
    expect(formatSiret("123456")).toBe("123456");
  });

  it("retourne chaîne vide pour null/undefined", () => {
    expect(formatSiret(null)).toBe("");
    expect(formatSiret(undefined)).toBe("");
  });
});
