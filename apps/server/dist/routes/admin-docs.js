"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Routes "Documents administratifs" — PV de réception, Attestations TVA,
// DC4 sous-traitance, RGE/MaPrimeRénov'.
//
// Expose une API CRUD HTTP pour que l'app web utilise les mêmes données que
// l'app Electron (qui passe par les handlers IPC). Toutes les routes sont
// scopées multi-tenant via la colonne companyId du repository.
//
// Endpoints :
//   GET    /api/admin-docs/stats              — compteurs agrégés
//   *      /api/admin-docs/receptions(/:id)   — CRUD PV de réception
//   GET    /api/admin-docs/receptions/:id/reserves
//   PUT    /api/admin-docs/receptions/:id/reserves
//   *      /api/admin-docs/tva(/:id)          — CRUD attestations TVA
//   *      /api/admin-docs/dc4(/:id)          — CRUD DC4
//   *      /api/admin-docs/rge(/:id)          — CRUD RGE
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAdminDocsRouter = buildAdminDocsRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const repository_1 = require("../repository");
const crud_1 = require("./crud");
const auth_1 = require("../auth");
const receptionTemplate_1 = require("../templates/receptionTemplate");
const tvaAttestationTemplate_1 = require("../templates/tvaAttestationTemplate");
const tvaAttestationCerfaTemplate_1 = require("../templates/tvaAttestationCerfaTemplate");
const tvaAttestationCerfaOfficielTemplate_1 = require("../templates/tvaAttestationCerfaOfficielTemplate");
const dc4Template_1 = require("../templates/dc4Template");
const daactCerfaTemplate_1 = require("../templates/daactCerfaTemplate");
const cerfaFiller_1 = require("../cerfaFiller");
// Helper : convertit une date ISO (YYYY-MM-DD) en format CERFA jj/mm/aaaa
function dateToCerfa(iso) {
    if (!iso)
        return "";
    const d = new Date(iso);
    if (isNaN(d.getTime()))
        return iso;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
// Helper : extrait CP/ville depuis "12 rue X, 75001 Paris"
function splitAddress(full) {
    const s = String(full || "").trim();
    if (!s)
        return { street: "", postal: "", city: "" };
    const m = s.match(/^(.*?)[,\n]\s*(\d{5})\s+(.+)$/);
    if (m)
        return { street: m[1].trim(), postal: m[2], city: m[3].trim() };
    const postal = (s.match(/\b(\d{5})\b/) || [])[1] || "";
    return { street: s, postal, city: "" };
}
// HTML chrome ajouté autour du template existant : un bouton flottant "Imprimer
// en PDF" qui déclenche le dialogue d'impression natif du navigateur (Ctrl+P /
// Cmd+P), masqué lors de l'impression elle-même via @media print. Permet à
// l'utilisateur de sauvegarder le PDF sans dépendance externe, gratuitement.
function wrapWithPrintButton(html, title) {
    const inject = `
<style>
  @media print {
    .print-toolbar { display: none !important; }
  }
  .print-toolbar {
    position: fixed; top: 12px; right: 12px; z-index: 9999;
    display: flex; gap: 8px;
    font-family: -apple-system, system-ui, sans-serif;
  }
  .print-toolbar button {
    background: #2563eb; color: white; border: 0; padding: 8px 14px;
    border-radius: 8px; font-size: 13px; font-weight: 600;
    box-shadow: 0 2px 6px rgba(0,0,0,.15); cursor: pointer;
  }
  .print-toolbar button:hover { background: #1d4ed8; }
  .print-toolbar button.secondary { background: #6b7280; }
  .print-toolbar button.secondary:hover { background: #4b5563; }
</style>
<div class="print-toolbar">
  <button onclick="window.print()" title="Cmd/Ctrl + P">Imprimer / Enregistrer en PDF</button>
  <button class="secondary" onclick="window.close()">Fermer</button>
</div>
<script>
  // Auto-déclenche le dialogue d'impression au chargement si on a été ouvert
  // avec ?autoprint=1 (depuis le bouton "Aperçu PDF" de l'app). L'utilisateur
  // choisit "Enregistrer comme PDF" dans le dialogue natif du navigateur.
  if (new URLSearchParams(location.search).has("autoprint")) {
    window.addEventListener("load", () => setTimeout(() => window.print(), 400));
  }
  document.title = ${JSON.stringify(title)};
</script>
`;
    // On insère juste après <body> pour que le bouton reste accessible.
    return html.replace(/<body([^>]*)>/i, `<body$1>${inject}`);
}
const wrap = (handler) => (req, res, next) => {
    handler(req, res).catch(next);
};
// ─── Whitelists colonnes ───────────────────────────────────────────────────
const RECEPTION_COLS = [
    "reference",
    "chantierId",
    "clientId",
    "clientName",
    "receptionType",
    "receptionDate",
    "guaranteeStartDate",
    "location",
    "ownerPresent",
    "contractorPresent",
    "worksDescription",
    "observations",
    "retentionAmount",
    "retentionReleaseDate",
    "ownerSigned",
    "ownerSignedDate",
    "ownerSignatureDataUrl",
    "contractorSigned",
    "contractorSignedDate",
    "contractorSignatureDataUrl",
    "status",
    "vaultDocumentId",
];
const TVA_COLS = [
    "reference",
    "attestationType",
    "tvaRate",
    "chantierId",
    "clientId",
    "clientName",
    "logementType",
    "logementBuiltOver2Years",
    "logementYearOfConstruction",
    "logementAddress",
    "ownerCivilite",
    "ownerLastName",
    "ownerFirstName",
    "ownerEmail",
    "ownerPhone",
    "ownerSiret",
    "interventionType",
    "category",
    "worksDescription",
    "worksStartDate",
    "worksEndDate",
    "totalAmountHt",
    "invoiceReference",
    "clientCommitments",
    "signedDate",
    "signedLocation",
    "clientSignatureDataUrl",
    "status",
    "vaultDocumentId",
];
const DC4_COLS = [
    "reference",
    "acteSpecialNumber",
    "purchaseOrderId",
    "subcontractorId",
    "subcontractorName",
    "subcontractorSiret",
    "chantierId",
    "publicMarketReference",
    "publicMarketObject",
    "publicAuthorityName",
    "publicAuthorityAddress",
    "subcontractedWorksDescription",
    "subcontractedAmountHt",
    "subcontractedAmountTtc",
    "subcontractedDuration",
    "paymentMethod",
    "paymentDelay",
    "cautionType",
    "cautionRequired",
    "cautionReceived",
    "acceptanceDeadline",
    "signedDate",
    "signedLocation",
    "contractorSignatureDataUrl",
    "ownerSignatureDataUrl",
    "authoritySignatureDataUrl",
    "status",
    "vaultDocumentId",
];
const DAACT_COLS = [
    "reference",
    "chantierId",
    "permitType",
    "permitNumber",
    "voiriesDifferees",
    "voiriesDate",
    "titulaireNom",
    "titulairePrenom",
    "denomination",
    "siret",
    "representantNom",
    "representantPrenom",
    "email",
    "achievementDate",
    "destinationChangeDate",
    "partialWorks",
    "partialWorksDescription",
    "surfaceCreated",
    "nbLogementsTotal",
    "nbIndividuels",
    "nbCollectifs",
    "signedDate",
    "signedLocation",
    "declarantSignatureDataUrl",
    "architectLocation",
    "architectSignedDate",
    "architectSignatureDataUrl",
    "status",
    "vaultDocumentId",
];
const RGE_COLS = [
    "reference",
    "type",
    "chantierId",
    "clientId",
    "clientName",
    "rgeQualification",
    "rgeQualificationNumber",
    "rgeValidUntil",
    "worksDescription",
    "totalAmountTtc",
    "primeRenovExpected",
    "primeRenovActual",
    "notes",
    "vaultDocumentId",
];
// ─── Schéma : réserves d'un PV de réception ────────────────────────────────
const ReserveSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64).optional(),
    description: zod_1.z.string().max(2000).optional().default(""),
    location: zod_1.z.string().max(255).optional().default(""),
    category: zod_1.z.string().max(64).optional().default(""),
    toBeFixedBefore: zod_1.z.string().max(32).optional().default(""),
    fixed: zod_1.z.union([zod_1.z.boolean(), zod_1.z.number()]).optional().default(false),
    fixedDate: zod_1.z.string().max(32).optional().default(""),
    sortOrder: zod_1.z.number().int().optional().default(0),
});
function buildAdminDocsRouter(db, cfg) {
    const router = (0, express_1.Router)();
    router.use((0, auth_1.requireAuth)(cfg, db));
    // ─── Repositories ───────────────────────────────────────────────────────
    const receptions = new repository_1.MysqlRepository(db, "reception_reports", {
        primaryKey: "client",
        filterableColumns: ["chantierId", "clientId", "status", "receptionType"],
        sortableColumns: ["receptionDate", "createdAt", "reference"],
        writableColumns: RECEPTION_COLS,
        hasUpdatedAt: true,
        hasAuditColumns: true,
        tenantColumn: "companyId",
    });
    const tva = new repository_1.MysqlRepository(db, "tva_attestations", {
        primaryKey: "client",
        filterableColumns: ["chantierId", "clientId", "status", "tvaRate", "attestationType"],
        sortableColumns: ["signedDate", "createdAt", "reference"],
        writableColumns: TVA_COLS,
        jsonColumns: ["clientCommitments"],
        hasUpdatedAt: true,
        hasAuditColumns: true,
        tenantColumn: "companyId",
    });
    const dc4 = new repository_1.MysqlRepository(db, "dc4_declarations", {
        primaryKey: "client",
        filterableColumns: ["chantierId", "subcontractorId", "status"],
        sortableColumns: ["signedDate", "createdAt", "reference"],
        writableColumns: DC4_COLS,
        hasUpdatedAt: true,
        hasAuditColumns: true,
        tenantColumn: "companyId",
    });
    const daact = new repository_1.MysqlRepository(db, "daact_declarations", {
        primaryKey: "client",
        filterableColumns: ["chantierId", "permitType", "status"],
        sortableColumns: ["achievementDate", "signedDate", "createdAt", "reference"],
        writableColumns: DAACT_COLS,
        hasUpdatedAt: true,
        hasAuditColumns: true,
        tenantColumn: "companyId",
    });
    const rge = new repository_1.MysqlRepository(db, "rge_documents", {
        primaryKey: "client",
        filterableColumns: ["chantierId", "clientId", "type"],
        sortableColumns: ["createdAt", "reference"],
        writableColumns: RGE_COLS,
        hasUpdatedAt: true,
        hasAuditColumns: true,
        tenantColumn: "companyId",
    });
    // ─── Stats agrégées (utilisées par les bandeaux KPI de l'UI) ───────────
    router.get("/stats", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [[rcp]] = await db.query(`SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN receptionType IN ('avec_reserves','refusee') THEN 1 ELSE 0 END) AS withReserves
         FROM reception_reports WHERE companyId = ?`, [tenantId]);
        const [[tvaStats]] = await db.query(`SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN YEAR(COALESCE(NULLIF(signedDate,''), createdAt)) = YEAR(CURDATE())
                    THEN 1 ELSE 0 END) AS thisYear
         FROM tva_attestations WHERE companyId = ?`, [tenantId]);
        const [[dc4Stats]] = await db.query(`SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status IN ('brouillon','envoye') THEN 1 ELSE 0 END) AS pending
         FROM dc4_declarations WHERE companyId = ?`, [tenantId]);
        const [[daactStats]] = await db.query(`SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status IN ('brouillon','depose') THEN 1 ELSE 0 END) AS pending
         FROM daact_declarations WHERE companyId = ?`, [tenantId]);
        const [[rgeStats]] = await db.query(`SELECT COUNT(*) AS total FROM rge_documents WHERE companyId = ?`, [tenantId]);
        res.json({
            receptionsTotal: Number(rcp?.total ?? 0),
            receptionsWithReserves: Number(rcp?.withReserves ?? 0),
            tvaAttestationsTotal: Number(tvaStats?.total ?? 0),
            tvaAttestationsThisYear: Number(tvaStats?.thisYear ?? 0),
            dc4Total: Number(dc4Stats?.total ?? 0),
            dc4Pending: Number(dc4Stats?.pending ?? 0),
            daactTotal: Number(daactStats?.total ?? 0),
            daactPending: Number(daactStats?.pending ?? 0),
            rgeDocumentsTotal: Number(rgeStats?.total ?? 0),
        });
    }));
    // ─── Réserves d'un PV de réception ─────────────────────────────────────
    // Stockées dans une table séparée (1 PV → N réserves). On les expose comme
    // sous-ressource pour ne pas alourdir le payload du PV principal.
    router.get("/receptions/:id/reserves", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        // Vérifie d'abord que le PV appartient bien au tenant courant.
        const [parentRows] = await db.query("SELECT id FROM reception_reports WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        if (parentRows.length === 0) {
            res.status(404).json({ message: "PV introuvable" });
            return;
        }
        const [rows] = await db.query("SELECT * FROM reception_reserves WHERE reportId = ? ORDER BY sortOrder ASC, id ASC", [req.params.id]);
        res.json(rows);
    }));
    router.put("/receptions/:id/reserves", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [parentRows] = await db.query("SELECT id FROM reception_reports WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        if (parentRows.length === 0) {
            res.status(404).json({ message: "PV introuvable" });
            return;
        }
        const parsed = zod_1.z.array(ReserveSchema).max(200).safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Payload invalide", issues: parsed.error.issues });
            return;
        }
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.execute("DELETE FROM reception_reserves WHERE reportId = ?", [req.params.id]);
            for (const [idx, r] of parsed.data.entries()) {
                await conn.execute(`INSERT INTO reception_reserves
               (id, reportId, description, location, category,
                toBeFixedBefore, fixed, fixedDate, sortOrder)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    r.id ?? `res_${Date.now()}_${idx}`,
                    req.params.id,
                    r.description,
                    r.location,
                    r.category,
                    r.toBeFixedBefore,
                    r.fixed ? 1 : 0,
                    r.fixedDate,
                    r.sortOrder,
                ]);
            }
            await conn.commit();
        }
        catch (e) {
            await conn.rollback();
            throw e;
        }
        finally {
            conn.release();
        }
        const [rows] = await db.query("SELECT * FROM reception_reserves WHERE reportId = ? ORDER BY sortOrder ASC, id ASC", [req.params.id]);
        res.json(rows);
    }));
    // ─── Récupère le profil entreprise (utilisé pour les en-têtes PDF) ─────
    async function loadCompany(tenantId) {
        const [rows] = await db.query("SELECT data, name FROM company WHERE id = ? LIMIT 1", [tenantId]);
        const row = rows[0];
        if (!row)
            return {};
        let data = {};
        try {
            data = row.data ? JSON.parse(row.data) : {};
        }
        catch {
            data = {};
        }
        // Charge aussi le cachet/signature depuis settings (whitelist déjà filtrée).
        const [stampRows] = await db.query("SELECT `key`, value FROM settings WHERE `key` IN ('companyStampDataUrl','companySignatureDataUrl')");
        for (const r of stampRows) {
            try {
                data[r.key] = JSON.parse(r.value);
            }
            catch {
                data[r.key] = r.value;
            }
        }
        return { ...data, companyName: data.companyName ?? row.name ?? "" };
    }
    // ─── Aperçu HTML / impression PDF natif navigateur ─────────────────────
    // GET /receptions/:id/html → PV de réception
    router.get("/receptions/:id/html", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [reportRows] = await db.query("SELECT * FROM reception_reports WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        const report = reportRows[0];
        if (!report) {
            res.status(404).type("html").send("<h1>PV introuvable</h1>");
            return;
        }
        const [reserveRows] = await db.query("SELECT * FROM reception_reserves WHERE reportId = ? ORDER BY sortOrder ASC", [req.params.id]);
        const [clientRows] = report.clientId
            ? await db.query("SELECT * FROM clients WHERE id = ? LIMIT 1", [report.clientId])
            : [[]];
        const [chantierRows] = report.chantierId
            ? await db.query("SELECT * FROM chantiers WHERE id = ? LIMIT 1", [report.chantierId])
            : [[]];
        const company = await loadCompany(tenantId);
        const html = (0, receptionTemplate_1.renderReceptionHtml)({
            report: { ...report, ownerSigned: !!report.ownerSigned, contractorSigned: !!report.contractorSigned },
            reserves: (reserveRows ?? []).map((r) => ({ ...r, fixed: !!r.fixed })),
            client: clientRows[0] ?? null,
            chantier: chantierRows[0] ?? null,
            company,
        });
        res
            .type("html")
            .send(wrapWithPrintButton(html, `PV ${String(report.reference ?? "")}`));
    }));
    // GET /tva/:id/html → Attestation TVA (CERFA 1300 ou modèle libre)
    router.get("/tva/:id/html", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await db.query("SELECT * FROM tva_attestations WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        const attestation = rows[0];
        if (!attestation) {
            res.status(404).type("html").send("<h1>Attestation introuvable</h1>");
            return;
        }
        // Normalise booléen + parse JSON commitments (le template attend des
        // tableaux JS, pas du JSON sérialisé).
        attestation.logementBuiltOver2Years = !!attestation.logementBuiltOver2Years;
        try {
            attestation.clientCommitments = JSON.parse(String(attestation.clientCommitments ?? "[]"));
        }
        catch {
            attestation.clientCommitments = [];
        }
        const company = await loadCompany(tenantId);
        const html = attestation.attestationType === "cerfa_officiel_1301sd"
            ? (0, tvaAttestationCerfaOfficielTemplate_1.renderTvaAttestationCerfaOfficielHtml)({ attestation, company })
            : attestation.attestationType === "cerfa_1300"
                ? (0, tvaAttestationCerfaTemplate_1.renderTvaAttestationCerfaHtml)({ attestation, company })
                : (0, tvaAttestationTemplate_1.renderTvaAttestationHtml)({ attestation, company });
        res
            .type("html")
            .send(wrapWithPrintButton(html, `Attestation TVA ${String(attestation.reference ?? "")}`));
    }));
    // GET /dc4/:id/html → DC4 sous-traitance
    router.get("/dc4/:id/html", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await db.query("SELECT * FROM dc4_declarations WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        const declaration = rows[0];
        if (!declaration) {
            res.status(404).type("html").send("<h1>DC4 introuvable</h1>");
            return;
        }
        declaration.cautionRequired = !!declaration.cautionRequired;
        declaration.cautionReceived = !!declaration.cautionReceived;
        const [stRows] = declaration.subcontractorId
            ? await db.query("SELECT * FROM subcontractors WHERE id = ? LIMIT 1", [declaration.subcontractorId])
            : [[]];
        const [chantierRows] = declaration.chantierId
            ? await db.query("SELECT * FROM chantiers WHERE id = ? LIMIT 1", [declaration.chantierId])
            : [[]];
        const company = await loadCompany(tenantId);
        const html = (0, dc4Template_1.renderDc4Html)({
            declaration,
            subcontractor: stRows[0] ?? null,
            chantier: chantierRows[0] ?? null,
            company,
        });
        res
            .type("html")
            .send(wrapWithPrintButton(html, `DC4 ${String(declaration.reference ?? "")}`));
    }));
    // GET /tva/:id/pdf → CERFA officiel 1301-SD pré-rempli (AcroForm)
    // Le navigateur affiche le PDF natif (utile + imprimable + signable à la main).
    router.get("/tva/:id/pdf", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await db.query("SELECT * FROM tva_attestations WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        const a = rows[0];
        if (!a) {
            res.status(404).type("html").send("<h1>Attestation introuvable</h1>");
            return;
        }
        const addr = splitAddress(String(a.logementAddress ?? ""));
        const typeMap = {
            maison: "maison",
            residence_principale: "maison",
            immeuble_collectif: "immeuble_collectif",
            appartement: "appartement",
        };
        const pdfBytes = await (0, cerfaFiller_1.fillCerfa1301SD)({
            nom: String(a.ownerLastName ?? ""),
            prenom: String(a.ownerFirstName ?? ""),
            adresse: addr.street,
            codePostal: addr.postal,
            commune: addr.city,
            typeLogement: typeMap[String(a.logementType ?? "")] ?? "maison",
            adresseLogement: addr.street,
            communeLogement: addr.city,
            codePostalLogement: addr.postal,
            qualite: "proprietaire",
            tauxReduit: Number(a.tvaRate) === 5.5 ? "5.5" : "10",
            faitA: String(a.signedLocation ?? ""),
            faitLe: dateToCerfa(a.signedDate),
        });
        res
            .type("application/pdf")
            .setHeader("Content-Disposition", `inline; filename="CERFA-1301SD-${String(a.reference ?? "attestation")}.pdf"`)
            .send(Buffer.from(pdfBytes));
    }));
    // GET /daact/:id/pdf → CERFA officiel 13408*13 pré-rempli (AcroForm)
    router.get("/daact/:id/pdf", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await db.query("SELECT * FROM daact_declarations WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        const d = rows[0];
        if (!d) {
            res.status(404).type("html").send("<h1>DAACT introuvable</h1>");
            return;
        }
        const [chRows] = d.chantierId
            ? await db.query("SELECT * FROM chantiers WHERE id = ? LIMIT 1", [d.chantierId])
            : [[]];
        const ch = chRows[0] ?? {};
        const company = await loadCompany(tenantId);
        const pdfBytes = await (0, cerfaFiller_1.fillCerfa13408)({
            permitType: d.permitType ?? "permis_construire",
            permitNumber: String(d.permitNumber ?? ""),
            voiriesDifferees: !!d.voiriesDifferees,
            voiriesDate: dateToCerfa(d.voiriesDate),
            declarantNom: String(d.titulaireNom ?? ""),
            declarantPrenom: String(d.titulairePrenom ?? ""),
            denomination: String(d.denomination ?? company.companyName ?? ""),
            siret: String(d.siret ?? company.siret ?? ""),
            typeSociete: String(company.legalForm ?? ""),
            representantNom: String(d.representantNom ?? company.leaderLastName ?? ""),
            representantPrenom: String(d.representantPrenom ?? company.leaderFirstName ?? ""),
            adresseNumero: "",
            adresseVoie: String(ch.addressLine1 ?? ""),
            adresseLocalite: String(ch.city ?? ""),
            adresseCodePostal: String(ch.postalCode ?? ""),
            email1: String(d.email ?? company.email ?? ""),
            achievementDate: dateToCerfa(d.achievementDate),
            destinationChangeDate: dateToCerfa(d.destinationChangeDate),
            totalTravaux: !d.partialWorks,
            trancheTravaux: !!d.partialWorks,
            precisAchevement: String(d.partialWorksDescription ?? ""),
            surfacePlancher: String(d.surfaceCreated ?? ""),
            nbLogementsTotal: String(d.nbLogementsTotal ?? ""),
            nbIndividuels: String(d.nbIndividuels ?? ""),
            nbCollectifs: String(d.nbCollectifs ?? ""),
            signatureLieu: String(d.signedLocation ?? ""),
            signatureDate: dateToCerfa(d.signedDate),
            signatureNom: String(d.representantNom ?? ""),
        });
        res
            .type("application/pdf")
            .setHeader("Content-Disposition", `inline; filename="CERFA-13408-${String(d.reference ?? "daact")}.pdf"`)
            .send(Buffer.from(pdfBytes));
    }));
    // GET /daact/:id/html → DAACT CERFA 13408*13
    router.get("/daact/:id/html", wrap(async (req, res) => {
        const tenantId = req.user?.companyId ?? 1;
        const [rows] = await db.query("SELECT * FROM daact_declarations WHERE id = ? AND companyId = ? LIMIT 1", [req.params.id, tenantId]);
        const declaration = rows[0];
        if (!declaration) {
            res.status(404).type("html").send("<h1>DAACT introuvable</h1>");
            return;
        }
        declaration.voiriesDifferees = !!declaration.voiriesDifferees;
        declaration.partialWorks = !!declaration.partialWorks;
        const [chantierRows] = declaration.chantierId
            ? await db.query("SELECT * FROM chantiers WHERE id = ? LIMIT 1", [declaration.chantierId])
            : [[]];
        const company = await loadCompany(tenantId);
        const html = (0, daactCerfaTemplate_1.renderDaactCerfaHtml)({
            declaration,
            chantier: chantierRows[0] ?? null,
            company,
        });
        res
            .type("html")
            .send(wrapWithPrintButton(html, `DAACT ${String(declaration.reference ?? "")}`));
    }));
    // ─── CRUD générique pour les 5 entités ─────────────────────────────────
    router.use("/receptions", (0, crud_1.buildCrudRouter)(receptions, { db, resourceName: "admin_receptions" }));
    router.use("/tva", (0, crud_1.buildCrudRouter)(tva, { db, resourceName: "admin_tva" }));
    router.use("/dc4", (0, crud_1.buildCrudRouter)(dc4, { db, resourceName: "admin_dc4" }));
    router.use("/daact", (0, crud_1.buildCrudRouter)(daact, { db, resourceName: "admin_daact" }));
    router.use("/rge", (0, crud_1.buildCrudRouter)(rge, { db, resourceName: "admin_rge" }));
    return router;
}
