import { describe, it, expect } from "vitest";
import {
  AI_EXPENSE_CATEGORIES,
  buildQuoteLinePrompts,
  buildExpenseCategoryPrompts,
  parseExpenseCategory,
  sanitizeQuoteLineDescription,
} from "./prompts";

describe("buildQuoteLinePrompts", () => {
  it("inclut la désignation dans le prompt", () => {
    const { system, prompt } = buildQuoteLinePrompts({ title: "Pose de carrelage 30×30" });
    expect(prompt).toContain("Pose de carrelage 30×30");
    expect(system).toContain("artisan du bâtiment");
  });

  it("intègre la description existante comme points à couvrir", () => {
    const { prompt } = buildQuoteLinePrompts({
      title: "Peinture salon",
      description: "2 couches, blanc mat",
    });
    expect(prompt).toContain("2 couches, blanc mat");
  });

  it("n'ajoute pas de bloc « points à intégrer » quand la description est vide", () => {
    const { prompt } = buildQuoteLinePrompts({ title: "Démolition cloison", description: "  " });
    expect(prompt).not.toContain("Points à intégrer");
  });
});

describe("sanitizeQuoteLineDescription", () => {
  it("retire guillemets, puces et markdown", () => {
    expect(sanitizeQuoteLineDescription('« Fourniture et pose. »')).toBe("Fourniture et pose.");
    expect(sanitizeQuoteLineDescription("- Dépose\n- Pose neuve")).toBe("Dépose Pose neuve");
    expect(sanitizeQuoteLineDescription("**Travaux** de qualité")).toBe("Travaux de qualité");
  });

  it("retire un préfixe « Description : »", () => {
    expect(sanitizeQuoteLineDescription("Description : Pose de faïence.")).toBe(
      "Pose de faïence."
    );
  });

  it("compresse les espaces multiples", () => {
    expect(sanitizeQuoteLineDescription("Pose   de \n carrelage")).toBe("Pose de carrelage");
  });

  it("borne la longueur à la dernière phrase complète", () => {
    const long = ("Phrase de remplissage numéro un. ".repeat(40)).trim();
    const out = sanitizeQuoteLineDescription(long);
    expect(out.length).toBeLessThanOrEqual(600);
    expect(out.endsWith(".")).toBe(true);
  });

  it("renvoie une chaîne vide pour une entrée vide", () => {
    expect(sanitizeQuoteLineDescription("")).toBe("");
    expect(sanitizeQuoteLineDescription("   \n ")).toBe("");
  });
});

describe("buildExpenseCategoryPrompts", () => {
  it("liste toutes les clés de catégories", () => {
    const { prompt } = buildExpenseCategoryPrompts({ description: "Sacs de ciment" });
    for (const { key } of AI_EXPENSE_CATEGORIES) {
      expect(prompt).toContain(key);
    }
  });

  it("mentionne le fournisseur quand il est fourni", () => {
    const { prompt } = buildExpenseCategoryPrompts({
      description: "Gasoil utilitaire",
      supplierName: "TotalEnergies",
    });
    expect(prompt).toContain("TotalEnergies");
  });
});

describe("parseExpenseCategory", () => {
  it("reconnaît une clé exacte", () => {
    expect(parseExpenseCategory("materiaux")).toBe("materiaux");
    expect(parseExpenseCategory("carburant")).toBe("carburant");
  });

  it("tolère ponctuation, casse et accents", () => {
    expect(parseExpenseCategory("Matériaux.")).toBe("materiaux");
    expect(parseExpenseCategory("CARBURANT !")).toBe("carburant");
  });

  it("tolère les réponses verbeuses", () => {
    expect(parseExpenseCategory("La catégorie est : carburant.")).toBe("carburant");
    expect(parseExpenseCategory("Je choisis la clé sous_traitance")).toBe("sous_traitance");
  });

  it("normalise les tirets/espaces vers underscore", () => {
    expect(parseExpenseCategory("sous-traitance")).toBe("sous_traitance");
    expect(parseExpenseCategory("frais bancaires")).toBe("frais_bancaires");
  });

  it("reconnaît un libellé complet", () => {
    expect(parseExpenseCategory("Matériaux de construction")).toBe("materiaux");
  });

  it("renvoie null quand rien n'est reconnu", () => {
    expect(parseExpenseCategory("")).toBeNull();
    expect(parseExpenseCategory("aucune idée")).toBeNull();
  });

  it("reste aligné avec ExpenseCategory de @btp/types (18 catégories)", () => {
    // Garde-fou : si une catégorie est ajoutée dans packages/types, cette
    // liste dupliquée doit être mise à jour (cf. commentaire dans prompts.ts).
    expect(AI_EXPENSE_CATEGORIES).toHaveLength(18);
    expect(AI_EXPENSE_CATEGORIES.map((c) => c.key)).toContain("autre");
  });
});
