"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prompts_1 = require("./prompts");
(0, vitest_1.describe)("buildQuoteLinePrompts", () => {
    (0, vitest_1.it)("inclut la désignation dans le prompt", () => {
        const { system, prompt } = (0, prompts_1.buildQuoteLinePrompts)({ title: "Pose de carrelage 30×30" });
        (0, vitest_1.expect)(prompt).toContain("Pose de carrelage 30×30");
        (0, vitest_1.expect)(system).toContain("artisan du bâtiment");
    });
    (0, vitest_1.it)("intègre la description existante comme points à couvrir", () => {
        const { prompt } = (0, prompts_1.buildQuoteLinePrompts)({
            title: "Peinture salon",
            description: "2 couches, blanc mat",
        });
        (0, vitest_1.expect)(prompt).toContain("2 couches, blanc mat");
    });
    (0, vitest_1.it)("n'ajoute pas de bloc « points à intégrer » quand la description est vide", () => {
        const { prompt } = (0, prompts_1.buildQuoteLinePrompts)({ title: "Démolition cloison", description: "  " });
        (0, vitest_1.expect)(prompt).not.toContain("Points à intégrer");
    });
});
(0, vitest_1.describe)("sanitizeQuoteLineDescription", () => {
    (0, vitest_1.it)("retire guillemets, puces et markdown", () => {
        (0, vitest_1.expect)((0, prompts_1.sanitizeQuoteLineDescription)('« Fourniture et pose. »')).toBe("Fourniture et pose.");
        (0, vitest_1.expect)((0, prompts_1.sanitizeQuoteLineDescription)("- Dépose\n- Pose neuve")).toBe("Dépose Pose neuve");
        (0, vitest_1.expect)((0, prompts_1.sanitizeQuoteLineDescription)("**Travaux** de qualité")).toBe("Travaux de qualité");
    });
    (0, vitest_1.it)("retire un préfixe « Description : »", () => {
        (0, vitest_1.expect)((0, prompts_1.sanitizeQuoteLineDescription)("Description : Pose de faïence.")).toBe("Pose de faïence.");
    });
    (0, vitest_1.it)("compresse les espaces multiples", () => {
        (0, vitest_1.expect)((0, prompts_1.sanitizeQuoteLineDescription)("Pose   de \n carrelage")).toBe("Pose de carrelage");
    });
    (0, vitest_1.it)("borne la longueur à la dernière phrase complète", () => {
        const long = ("Phrase de remplissage numéro un. ".repeat(40)).trim();
        const out = (0, prompts_1.sanitizeQuoteLineDescription)(long);
        (0, vitest_1.expect)(out.length).toBeLessThanOrEqual(600);
        (0, vitest_1.expect)(out.endsWith(".")).toBe(true);
    });
    (0, vitest_1.it)("renvoie une chaîne vide pour une entrée vide", () => {
        (0, vitest_1.expect)((0, prompts_1.sanitizeQuoteLineDescription)("")).toBe("");
        (0, vitest_1.expect)((0, prompts_1.sanitizeQuoteLineDescription)("   \n ")).toBe("");
    });
});
(0, vitest_1.describe)("buildExpenseCategoryPrompts", () => {
    (0, vitest_1.it)("liste toutes les clés de catégories", () => {
        const { prompt } = (0, prompts_1.buildExpenseCategoryPrompts)({ description: "Sacs de ciment" });
        for (const { key } of prompts_1.AI_EXPENSE_CATEGORIES) {
            (0, vitest_1.expect)(prompt).toContain(key);
        }
    });
    (0, vitest_1.it)("mentionne le fournisseur quand il est fourni", () => {
        const { prompt } = (0, prompts_1.buildExpenseCategoryPrompts)({
            description: "Gasoil utilitaire",
            supplierName: "TotalEnergies",
        });
        (0, vitest_1.expect)(prompt).toContain("TotalEnergies");
    });
});
(0, vitest_1.describe)("parseExpenseCategory", () => {
    (0, vitest_1.it)("reconnaît une clé exacte", () => {
        (0, vitest_1.expect)((0, prompts_1.parseExpenseCategory)("materiaux")).toBe("materiaux");
        (0, vitest_1.expect)((0, prompts_1.parseExpenseCategory)("carburant")).toBe("carburant");
    });
    (0, vitest_1.it)("tolère ponctuation, casse et accents", () => {
        (0, vitest_1.expect)((0, prompts_1.parseExpenseCategory)("Matériaux.")).toBe("materiaux");
        (0, vitest_1.expect)((0, prompts_1.parseExpenseCategory)("CARBURANT !")).toBe("carburant");
    });
    (0, vitest_1.it)("tolère les réponses verbeuses", () => {
        (0, vitest_1.expect)((0, prompts_1.parseExpenseCategory)("La catégorie est : carburant.")).toBe("carburant");
        (0, vitest_1.expect)((0, prompts_1.parseExpenseCategory)("Je choisis la clé sous_traitance")).toBe("sous_traitance");
    });
    (0, vitest_1.it)("normalise les tirets/espaces vers underscore", () => {
        (0, vitest_1.expect)((0, prompts_1.parseExpenseCategory)("sous-traitance")).toBe("sous_traitance");
        (0, vitest_1.expect)((0, prompts_1.parseExpenseCategory)("frais bancaires")).toBe("frais_bancaires");
    });
    (0, vitest_1.it)("reconnaît un libellé complet", () => {
        (0, vitest_1.expect)((0, prompts_1.parseExpenseCategory)("Matériaux de construction")).toBe("materiaux");
    });
    (0, vitest_1.it)("renvoie null quand rien n'est reconnu", () => {
        (0, vitest_1.expect)((0, prompts_1.parseExpenseCategory)("")).toBeNull();
        (0, vitest_1.expect)((0, prompts_1.parseExpenseCategory)("aucune idée")).toBeNull();
    });
    (0, vitest_1.it)("reste aligné avec ExpenseCategory de @btp/types (18 catégories)", () => {
        // Garde-fou : si une catégorie est ajoutée dans packages/types, cette
        // liste dupliquée doit être mise à jour (cf. commentaire dans prompts.ts).
        (0, vitest_1.expect)(prompts_1.AI_EXPENSE_CATEGORIES).toHaveLength(18);
        (0, vitest_1.expect)(prompts_1.AI_EXPENSE_CATEGORIES.map((c) => c.key)).toContain("autre");
    });
});
