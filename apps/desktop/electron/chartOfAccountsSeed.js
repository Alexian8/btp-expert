// ═══════════════════════════════════════════════════════════════════════════
// chartOfAccountsSeed.js — Plan comptable général adapté BTP (PCG)
//
// Comptes préchargés au premier démarrage du module compta.
// Référence : Plan Comptable Général français (PCG 2014).
// ═══════════════════════════════════════════════════════════════════════════

// nature: "centralisateur" (synthèse, non mouvementé directement)
//         "detail" (compte de saisie standard)
//         "collectif" (regroupe des auxiliaires : 411, 401)
// type:   "actif" | "passif" | "charge" | "produit" | "neutre"

const SEED_ACCOUNTS = [
  // ─── CLASSE 1 — CAPITAUX ────────────────────────────────────────────────
  { numero: "101000", libelle: "Capital social",                  classe: 1, type: "passif", nature: "detail" },
  { numero: "106100", libelle: "Réserve légale",                  classe: 1, type: "passif", nature: "detail" },
  { numero: "108000", libelle: "Compte de l'exploitant",          classe: 1, type: "passif", nature: "detail" },
  { numero: "110000", libelle: "Report à nouveau (créditeur)",    classe: 1, type: "passif", nature: "detail" },
  { numero: "119000", libelle: "Report à nouveau (débiteur)",     classe: 1, type: "actif",  nature: "detail" },
  { numero: "120000", libelle: "Résultat de l'exercice (bénéfice)", classe: 1, type: "passif", nature: "detail" },
  { numero: "129000", libelle: "Résultat de l'exercice (perte)",   classe: 1, type: "actif",  nature: "detail" },
  { numero: "164000", libelle: "Emprunts auprès des établissements de crédit", classe: 1, type: "passif", nature: "detail" },
  { numero: "168800", libelle: "Intérêts courus sur emprunts",    classe: 1, type: "passif", nature: "detail" },

  // ─── CLASSE 2 — IMMOBILISATIONS ────────────────────────────────────────
  { numero: "211000", libelle: "Terrains",                        classe: 2, type: "actif",  nature: "detail" },
  { numero: "213000", libelle: "Constructions",                   classe: 2, type: "actif",  nature: "detail" },
  { numero: "215400", libelle: "Matériel industriel",             classe: 2, type: "actif",  nature: "detail" },
  { numero: "218200", libelle: "Matériel de transport",           classe: 2, type: "actif",  nature: "detail" },
  { numero: "218300", libelle: "Outillage / Matériel de bureau",  classe: 2, type: "actif",  nature: "detail" },
  { numero: "218400", libelle: "Mobilier",                        classe: 2, type: "actif",  nature: "detail" },
  { numero: "281300", libelle: "Amortissements constructions",    classe: 2, type: "actif",  nature: "detail" },
  { numero: "281540", libelle: "Amortissements matériel industriel", classe: 2, type: "actif", nature: "detail" },
  { numero: "281820", libelle: "Amortissements matériel transport", classe: 2, type: "actif", nature: "detail" },
  { numero: "281830", libelle: "Amortissements outillage",        classe: 2, type: "actif",  nature: "detail" },

  // ─── CLASSE 4 — TIERS ───────────────────────────────────────────────────
  { numero: "401000", libelle: "Fournisseurs",                    classe: 4, type: "passif", nature: "collectif", isAuxiliary: 0 },
  { numero: "404000", libelle: "Fournisseurs d'immobilisations",  classe: 4, type: "passif", nature: "collectif", isAuxiliary: 0 },
  { numero: "411000", libelle: "Clients",                         classe: 4, type: "actif",  nature: "collectif", isAuxiliary: 0 },
  { numero: "418000", libelle: "Clients - Factures à établir",    classe: 4, type: "actif",  nature: "detail" },
  { numero: "419000", libelle: "Clients - Avances et acomptes reçus", classe: 4, type: "passif", nature: "detail" },
  { numero: "421000", libelle: "Personnel - Rémunérations dues",  classe: 4, type: "passif", nature: "detail" },
  { numero: "425000", libelle: "Personnel - Avances et acomptes", classe: 4, type: "actif",  nature: "detail" },
  { numero: "431000", libelle: "Sécurité sociale",                classe: 4, type: "passif", nature: "detail" },
  { numero: "437000", libelle: "Autres organismes sociaux",       classe: 4, type: "passif", nature: "detail" },
  { numero: "445660", libelle: "TVA déductible sur biens et services", classe: 4, type: "actif", nature: "detail" },
  { numero: "445620", libelle: "TVA déductible sur immobilisations", classe: 4, type: "actif", nature: "detail" },
  { numero: "445670", libelle: "Crédit de TVA à reporter",        classe: 4, type: "actif",  nature: "detail" },
  { numero: "445710", libelle: "TVA collectée",                   classe: 4, type: "passif", nature: "detail" },
  { numero: "445510", libelle: "TVA à décaisser",                 classe: 4, type: "passif", nature: "detail" },
  { numero: "447000", libelle: "Autres impôts et taxes",          classe: 4, type: "passif", nature: "detail" },
  { numero: "467000", libelle: "Autres comptes débiteurs ou créditeurs", classe: 4, type: "neutre", nature: "detail" },

  // ─── CLASSE 5 — FINANCIER ───────────────────────────────────────────────
  { numero: "512000", libelle: "Banque - Compte principal",       classe: 5, type: "actif", nature: "detail" },
  { numero: "514000", libelle: "Chèques postaux",                 classe: 5, type: "actif", nature: "detail" },
  { numero: "517000", libelle: "Autres organismes financiers",    classe: 5, type: "actif", nature: "detail" },
  { numero: "530000", libelle: "Caisse",                          classe: 5, type: "actif", nature: "detail" },
  { numero: "580000", libelle: "Virements internes",              classe: 5, type: "neutre", nature: "detail" },

  // ─── CLASSE 6 — CHARGES ─────────────────────────────────────────────────
  { numero: "601000", libelle: "Achats de matériaux",             classe: 6, type: "charge", nature: "detail" },
  { numero: "604000", libelle: "Achats d'études et prestations",  classe: 6, type: "charge", nature: "detail" },
  { numero: "606100", libelle: "Fournitures non stockables (eau, énergie, carburant)", classe: 6, type: "charge", nature: "detail" },
  { numero: "606300", libelle: "Petit outillage et matériel",     classe: 6, type: "charge", nature: "detail" },
  { numero: "606400", libelle: "Fournitures administratives",     classe: 6, type: "charge", nature: "detail" },
  { numero: "606800", libelle: "Autres achats non stockés",       classe: 6, type: "charge", nature: "detail" },
  { numero: "611000", libelle: "Sous-traitance générale",         classe: 6, type: "charge", nature: "detail" },
  { numero: "613200", libelle: "Locations immobilières",          classe: 6, type: "charge", nature: "detail" },
  { numero: "613500", libelle: "Locations mobilières",            classe: 6, type: "charge", nature: "detail" },
  { numero: "615500", libelle: "Entretien et réparations véhicules", classe: 6, type: "charge", nature: "detail" },
  { numero: "616000", libelle: "Primes d'assurance",              classe: 6, type: "charge", nature: "detail" },
  { numero: "618000", libelle: "Documentation, divers",           classe: 6, type: "charge", nature: "detail" },
  { numero: "622600", libelle: "Honoraires",                      classe: 6, type: "charge", nature: "detail" },
  { numero: "623000", libelle: "Publicité, publications",         classe: 6, type: "charge", nature: "detail" },
  { numero: "625100", libelle: "Voyages et déplacements",         classe: 6, type: "charge", nature: "detail" },
  { numero: "625600", libelle: "Missions et réceptions",          classe: 6, type: "charge", nature: "detail" },
  { numero: "626000", libelle: "Frais postaux et de télécommunications", classe: 6, type: "charge", nature: "detail" },
  { numero: "627000", libelle: "Services bancaires",              classe: 6, type: "charge", nature: "detail" },
  { numero: "628100", libelle: "Formation",                       classe: 6, type: "charge", nature: "detail" },
  { numero: "635100", libelle: "Contribution Économique Territoriale (CFE/CVAE)", classe: 6, type: "charge", nature: "detail" },
  { numero: "637800", libelle: "Autres impôts et taxes",          classe: 6, type: "charge", nature: "detail" },
  { numero: "641000", libelle: "Rémunérations du personnel",      classe: 6, type: "charge", nature: "detail" },
  { numero: "645000", libelle: "Charges de sécurité sociale et de prévoyance", classe: 6, type: "charge", nature: "detail" },
  { numero: "647000", libelle: "Autres charges sociales",         classe: 6, type: "charge", nature: "detail" },
  { numero: "651600", libelle: "Redevances pour logiciels",       classe: 6, type: "charge", nature: "detail" },
  { numero: "658000", libelle: "Charges diverses de gestion courante", classe: 6, type: "charge", nature: "detail" },
  { numero: "661100", libelle: "Intérêts des emprunts",           classe: 6, type: "charge", nature: "detail" },
  { numero: "671000", libelle: "Charges exceptionnelles",         classe: 6, type: "charge", nature: "detail" },
  { numero: "681120", libelle: "Dotations aux amortissements",    classe: 6, type: "charge", nature: "detail" },

  // ─── CLASSE 7 — PRODUITS ────────────────────────────────────────────────
  { numero: "701000", libelle: "Ventes de produits finis",        classe: 7, type: "produit", nature: "detail" },
  { numero: "704000", libelle: "Travaux",                         classe: 7, type: "produit", nature: "detail" },
  { numero: "706000", libelle: "Prestations de services",         classe: 7, type: "produit", nature: "detail" },
  { numero: "707000", libelle: "Ventes de marchandises",          classe: 7, type: "produit", nature: "detail" },
  { numero: "708500", libelle: "Ports et frais accessoires facturés", classe: 7, type: "produit", nature: "detail" },
  { numero: "709000", libelle: "Rabais, remises et ristournes accordés", classe: 7, type: "produit", nature: "detail" },
  { numero: "758000", libelle: "Produits divers de gestion courante", classe: 7, type: "produit", nature: "detail" },
  { numero: "771000", libelle: "Produits exceptionnels",          classe: 7, type: "produit", nature: "detail" },
];

const SEED_JOURNALS = [
  { code: "VE", libelle: "Journal des ventes",      type: "ventes",     defaultCompte: "706000" },
  { code: "AC", libelle: "Journal des achats",      type: "achats",     defaultCompte: "" },
  { code: "BQ", libelle: "Journal de banque",       type: "banque",     defaultCompte: "512000" },
  { code: "CA", libelle: "Journal de caisse",       type: "caisse",     defaultCompte: "530000" },
  { code: "OD", libelle: "Opérations diverses",     type: "od",         defaultCompte: "" },
  { code: "AN", libelle: "À-nouveaux",              type: "anouveaux",  defaultCompte: "" },
];

// ─── Mapping catégorie de dépense → compte PCG (cohérent avec types/accounting.ts) ─
const CATEGORY_PCG = {
  materiaux:       "601000",
  outillage:       "606300",
  carburant:       "606100",
  vehicule:        "615500",
  sous_traitance:  "611000",
  loyer:           "613200",
  energie:         "606100",
  telecom:         "626000",
  assurance:       "616000",
  frais_bancaires: "627000",
  honoraires:      "622600",
  fourniture:      "606400",
  repas:           "625600",
  deplacement:     "625100",
  formation:       "628100",
  logiciel:        "651600",
  publicite:       "623000",
  autre:           "658000",
};

// ─── Helpers d'application ─────────────────────────────────────────────────

function seedChartOfAccounts(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO chart_of_accounts
      (numero, libelle, classe, type, nature, parentNumero, isAuxiliary, isLocked, createdAt, updatedAt)
    VALUES (@numero, @libelle, @classe, @type, @nature, '', @isAuxiliary, 1, @now, @now)
  `);
  const now = new Date().toISOString();
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      insert.run({
        numero: r.numero,
        libelle: r.libelle,
        classe: r.classe,
        type: r.type,
        nature: r.nature,
        isAuxiliary: r.isAuxiliary === undefined ? 0 : r.isAuxiliary,
        now,
      });
    }
  });
  tx(SEED_ACCOUNTS);
}

function seedJournals(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO journals (code, libelle, type, defaultCompte, isLocked, createdAt)
    VALUES (@code, @libelle, @type, @defaultCompte, 1, @now)
  `);
  const now = new Date().toISOString();
  const tx = db.transaction((rows) => {
    for (const r of rows) insert.run({ ...r, now });
  });
  tx(SEED_JOURNALS);
}

module.exports = {
  SEED_ACCOUNTS,
  SEED_JOURNALS,
  CATEGORY_PCG,
  seedChartOfAccounts,
  seedJournals,
};
