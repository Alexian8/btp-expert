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

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import type { DB, RowDataPacket } from "../db";
import type { Config } from "../config";
import { MysqlRepository } from "../repository";
import { buildCrudRouter } from "./crud";
import { requireAuth } from "../auth";
import { renderReceptionHtml } from "../templates/receptionTemplate";
import { renderTvaAttestationHtml } from "../templates/tvaAttestationTemplate";
import { renderTvaAttestationCerfaHtml } from "../templates/tvaAttestationCerfaTemplate";
import { renderTvaAttestationCerfaOfficielHtml } from "../templates/tvaAttestationCerfaOfficielTemplate";
import { renderDc4Html } from "../templates/dc4Template";
import { renderDaactCerfaHtml } from "../templates/daactCerfaTemplate";
import { fillCerfa1301SD, fillCerfa13408, isPdfLibAvailable } from "../cerfaFiller";

const PDF_LIB_HELP_HTML = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>pdf-lib manquant</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:24px;background:#fef3c7;border:1px solid #f59e0b;border-radius:12px}
code{background:#fff;padding:2px 6px;border-radius:4px;font-family:Menlo,monospace}</style></head>
<body>
<h1>⚙️ Une dépendance manque sur le serveur</h1>
<p>La génération des CERFA officiels nécessite la bibliothèque <code>pdf-lib</code>
qui n'est pas encore installée sur ce serveur o2switch.</p>
<p>Pour activer cette fonctionnalité, ouvrez le <strong>Terminal cPanel</strong> et lancez :</p>
<pre><code>cd ~/intranet.jacobhabitat-dev.fr &amp;&amp; npm install pdf-lib --omit=dev
mkdir -p tmp &amp;&amp; touch tmp/restart.txt</code></pre>
<p>Le serveur redémarrera automatiquement et cette page disparaîtra.</p>
<p style="font-size:13px;color:#666">En attendant, les autres types d'attestations TVA (modèle simplifié,
CERFA visuel BatiDesk) restent disponibles.</p>
</body></html>`;

// Helper : convertit une date ISO (YYYY-MM-DD) en format CERFA jj/mm/aaaa
function dateToCerfa(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Helper : extrait CP/ville depuis "12 rue X, 75001 Paris"
function splitAddress(full: string): { street: string; postal: string; city: string } {
  const s = String(full || "").trim();
  if (!s) return { street: "", postal: "", city: "" };
  const m = s.match(/^(.*?)[,\n]\s*(\d{5})\s+(.+)$/);
  if (m) return { street: m[1].trim(), postal: m[2], city: m[3].trim() };
  const postal = (s.match(/\b(\d{5})\b/) || [])[1] || "";
  return { street: s, postal, city: "" };
}

// HTML chrome ajouté autour du template existant : un bouton flottant "Imprimer
// en PDF" qui déclenche le dialogue d'impression natif du navigateur (Ctrl+P /
// Cmd+P), masqué lors de l'impression elle-même via @media print. Permet à
// l'utilisateur de sauvegarder le PDF sans dépendance externe, gratuitement.
function wrapWithPrintButton(html: string, title: string): string {
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

const wrap =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
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
const ReserveSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  description: z.string().max(2000).optional().default(""),
  location: z.string().max(255).optional().default(""),
  category: z.string().max(64).optional().default(""),
  toBeFixedBefore: z.string().max(32).optional().default(""),
  fixed: z.union([z.boolean(), z.number()]).optional().default(false),
  fixedDate: z.string().max(32).optional().default(""),
  sortOrder: z.number().int().optional().default(0),
});

export function buildAdminDocsRouter(db: DB, cfg: Config): Router {
  const router = Router();
  router.use(requireAuth(cfg, db));

  // ─── Repositories ───────────────────────────────────────────────────────
  const receptions = new MysqlRepository(db, "reception_reports", {
    primaryKey: "client",
    filterableColumns: ["chantierId", "clientId", "status", "receptionType"],
    sortableColumns: ["receptionDate", "createdAt", "reference"],
    writableColumns: RECEPTION_COLS,
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });

  const tva = new MysqlRepository(db, "tva_attestations", {
    primaryKey: "client",
    filterableColumns: ["chantierId", "clientId", "status", "tvaRate", "attestationType"],
    sortableColumns: ["signedDate", "createdAt", "reference"],
    writableColumns: TVA_COLS,
    jsonColumns: ["clientCommitments"],
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });

  const dc4 = new MysqlRepository(db, "dc4_declarations", {
    primaryKey: "client",
    filterableColumns: ["chantierId", "subcontractorId", "status"],
    sortableColumns: ["signedDate", "createdAt", "reference"],
    writableColumns: DC4_COLS,
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });

  const daact = new MysqlRepository(db, "daact_declarations", {
    primaryKey: "client",
    filterableColumns: ["chantierId", "permitType", "status"],
    sortableColumns: ["achievementDate", "signedDate", "createdAt", "reference"],
    writableColumns: DAACT_COLS,
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });

  const rge = new MysqlRepository(db, "rge_documents", {
    primaryKey: "client",
    filterableColumns: ["chantierId", "clientId", "type"],
    sortableColumns: ["createdAt", "reference"],
    writableColumns: RGE_COLS,
    hasUpdatedAt: true,
    hasAuditColumns: true,
    tenantColumn: "companyId",
  });

  // ─── Stats agrégées (utilisées par les bandeaux KPI de l'UI) ───────────
  router.get(
    "/stats",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [[rcp]] = await db.query<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN receptionType IN ('avec_reserves','refusee') THEN 1 ELSE 0 END) AS withReserves
         FROM reception_reports WHERE companyId = ?`,
        [tenantId]
      );
      const [[tvaStats]] = await db.query<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN YEAR(COALESCE(NULLIF(signedDate,''), createdAt)) = YEAR(CURDATE())
                    THEN 1 ELSE 0 END) AS thisYear
         FROM tva_attestations WHERE companyId = ?`,
        [tenantId]
      );
      const [[dc4Stats]] = await db.query<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status IN ('brouillon','envoye') THEN 1 ELSE 0 END) AS pending
         FROM dc4_declarations WHERE companyId = ?`,
        [tenantId]
      );
      const [[daactStats]] = await db.query<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status IN ('brouillon','depose') THEN 1 ELSE 0 END) AS pending
         FROM daact_declarations WHERE companyId = ?`,
        [tenantId]
      );
      const [[rgeStats]] = await db.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM rge_documents WHERE companyId = ?`,
        [tenantId]
      );
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
    })
  );

  // ─── Réserves d'un PV de réception ─────────────────────────────────────
  // Stockées dans une table séparée (1 PV → N réserves). On les expose comme
  // sous-ressource pour ne pas alourdir le payload du PV principal.
  router.get(
    "/receptions/:id/reserves",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      // Vérifie d'abord que le PV appartient bien au tenant courant.
      const [parentRows] = await db.query<RowDataPacket[]>(
        "SELECT id FROM reception_reports WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      if (parentRows.length === 0) {
        res.status(404).json({ message: "PV introuvable" });
        return;
      }
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM reception_reserves WHERE reportId = ? ORDER BY sortOrder ASC, id ASC",
        [req.params.id]
      );
      res.json(rows);
    })
  );

  router.put(
    "/receptions/:id/reserves",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [parentRows] = await db.query<RowDataPacket[]>(
        "SELECT id FROM reception_reports WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      if (parentRows.length === 0) {
        res.status(404).json({ message: "PV introuvable" });
        return;
      }
      const parsed = z.array(ReserveSchema).max(200).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Payload invalide", issues: parsed.error.issues });
        return;
      }
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.execute("DELETE FROM reception_reserves WHERE reportId = ?", [req.params.id]);
        for (const [idx, r] of parsed.data.entries()) {
          await conn.execute(
            `INSERT INTO reception_reserves
               (id, reportId, description, location, category,
                toBeFixedBefore, fixed, fixedDate, sortOrder)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              r.id ?? `res_${Date.now()}_${idx}`,
              req.params.id,
              r.description,
              r.location,
              r.category,
              r.toBeFixedBefore,
              r.fixed ? 1 : 0,
              r.fixedDate,
              r.sortOrder,
            ]
          );
        }
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM reception_reserves WHERE reportId = ? ORDER BY sortOrder ASC, id ASC",
        [req.params.id]
      );
      res.json(rows);
    })
  );

  // ─── Récupère le profil entreprise (utilisé pour les en-têtes PDF) ─────
  async function loadCompany(tenantId: number): Promise<Record<string, unknown>> {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT data, name FROM company WHERE id = ? LIMIT 1",
      [tenantId]
    );
    const row = rows[0] as { data?: string; name?: string } | undefined;
    if (!row) return {};
    let data: Record<string, unknown> = {};
    try {
      data = row.data ? (JSON.parse(row.data) as Record<string, unknown>) : {};
    } catch {
      data = {};
    }
    // Charge aussi le cachet/signature depuis settings (whitelist déjà filtrée).
    const [stampRows] = await db.query<RowDataPacket[]>(
      "SELECT `key`, value FROM settings WHERE `key` IN ('companyStampDataUrl','companySignatureDataUrl')"
    );
    for (const r of stampRows as Array<{ key: string; value: string }>) {
      try {
        data[r.key] = JSON.parse(r.value);
      } catch {
        data[r.key] = r.value;
      }
    }
    return { ...data, companyName: data.companyName ?? row.name ?? "" };
  }

  // ─── Aperçu HTML / impression PDF natif navigateur ─────────────────────
  // GET /receptions/:id/html → PV de réception
  router.get(
    "/receptions/:id/html",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [reportRows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM reception_reports WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      const report = reportRows[0];
      if (!report) {
        res.status(404).type("html").send("<h1>PV introuvable</h1>");
        return;
      }
      const [reserveRows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM reception_reserves WHERE reportId = ? ORDER BY sortOrder ASC",
        [req.params.id]
      );
      const [clientRows] = report.clientId
        ? await db.query<RowDataPacket[]>("SELECT * FROM clients WHERE id = ? LIMIT 1", [report.clientId])
        : [[]];
      const [chantierRows] = report.chantierId
        ? await db.query<RowDataPacket[]>("SELECT * FROM chantiers WHERE id = ? LIMIT 1", [report.chantierId])
        : [[]];
      const company = await loadCompany(tenantId);
      const html = renderReceptionHtml({
        report: { ...report, ownerSigned: !!report.ownerSigned, contractorSigned: !!report.contractorSigned } as Record<string, unknown>,
        reserves: (reserveRows ?? []).map((r) => ({ ...r, fixed: !!(r as { fixed?: number }).fixed })),
        client: (clientRows[0] as Record<string, unknown>) ?? null,
        chantier: (chantierRows[0] as Record<string, unknown>) ?? null,
        company,
      });
      res
        .type("html")
        .send(wrapWithPrintButton(html, `PV ${String(report.reference ?? "")}`));
    })
  );

  // GET /tva/:id/html → Attestation TVA (CERFA 1300 ou modèle libre)
  router.get(
    "/tva/:id/html",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM tva_attestations WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      const attestation = rows[0] as Record<string, unknown> | undefined;
      if (!attestation) {
        res.status(404).type("html").send("<h1>Attestation introuvable</h1>");
        return;
      }
      // Normalise booléen + parse JSON commitments (le template attend des
      // tableaux JS, pas du JSON sérialisé).
      attestation.logementBuiltOver2Years = !!attestation.logementBuiltOver2Years;
      try {
        attestation.clientCommitments = JSON.parse(
          String(attestation.clientCommitments ?? "[]")
        );
      } catch {
        attestation.clientCommitments = [];
      }
      const company = await loadCompany(tenantId);
      const html =
        attestation.attestationType === "cerfa_officiel_1301sd"
          ? renderTvaAttestationCerfaOfficielHtml({ attestation, company })
          : attestation.attestationType === "cerfa_1300"
            ? renderTvaAttestationCerfaHtml({ attestation, company })
            : renderTvaAttestationHtml({ attestation, company });
      res
        .type("html")
        .send(wrapWithPrintButton(html, `Attestation TVA ${String(attestation.reference ?? "")}`));
    })
  );

  // GET /dc4/:id/html → DC4 sous-traitance
  router.get(
    "/dc4/:id/html",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM dc4_declarations WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      const declaration = rows[0] as Record<string, unknown> | undefined;
      if (!declaration) {
        res.status(404).type("html").send("<h1>DC4 introuvable</h1>");
        return;
      }
      declaration.cautionRequired = !!declaration.cautionRequired;
      declaration.cautionReceived = !!declaration.cautionReceived;
      const [stRows] = declaration.subcontractorId
        ? await db.query<RowDataPacket[]>("SELECT * FROM subcontractors WHERE id = ? LIMIT 1", [declaration.subcontractorId])
        : [[]];
      const [chantierRows] = declaration.chantierId
        ? await db.query<RowDataPacket[]>("SELECT * FROM chantiers WHERE id = ? LIMIT 1", [declaration.chantierId])
        : [[]];
      const company = await loadCompany(tenantId);
      const html = renderDc4Html({
        declaration,
        subcontractor: (stRows[0] as Record<string, unknown>) ?? null,
        chantier: (chantierRows[0] as Record<string, unknown>) ?? null,
        company,
      });
      res
        .type("html")
        .send(wrapWithPrintButton(html, `DC4 ${String(declaration.reference ?? "")}`));
    })
  );

  // GET /tva/:id/pdf → CERFA officiel 1301-SD pré-rempli (AcroForm)
  // Le navigateur affiche le PDF natif (utile + imprimable + signable à la main).
  router.get(
    "/tva/:id/pdf",
    wrap(async (req, res) => {
      if (!isPdfLibAvailable()) {
        res.status(503).type("html").send(PDF_LIB_HELP_HTML);
        return;
      }
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM tva_attestations WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      const a = rows[0] as Record<string, unknown> | undefined;
      if (!a) {
        res.status(404).type("html").send("<h1>Attestation introuvable</h1>");
        return;
      }
      const addr = splitAddress(String(a.logementAddress ?? ""));
      const typeMap: Record<string, "maison" | "immeuble_collectif" | "appartement" | "autre"> = {
        maison: "maison",
        residence_principale: "maison",
        immeuble_collectif: "immeuble_collectif",
        appartement: "appartement",
      };
      const pdfBytes = await fillCerfa1301SD({
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
        faitLe: dateToCerfa(a.signedDate as string),
      });
      res
        .type("application/pdf")
        .setHeader(
          "Content-Disposition",
          `inline; filename="CERFA-1301SD-${String(a.reference ?? "attestation")}.pdf"`
        )
        .send(Buffer.from(pdfBytes));
    })
  );

  // GET /daact/:id/pdf → CERFA officiel 13408*13 pré-rempli (AcroForm)
  router.get(
    "/daact/:id/pdf",
    wrap(async (req, res) => {
      if (!isPdfLibAvailable()) {
        res.status(503).type("html").send(PDF_LIB_HELP_HTML);
        return;
      }
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM daact_declarations WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      const d = rows[0] as Record<string, unknown> | undefined;
      if (!d) {
        res.status(404).type("html").send("<h1>DAACT introuvable</h1>");
        return;
      }
      const [chRows] = d.chantierId
        ? await db.query<RowDataPacket[]>("SELECT * FROM chantiers WHERE id = ? LIMIT 1", [d.chantierId])
        : [[]];
      const ch = (chRows[0] as Record<string, unknown>) ?? {};
      const company = await loadCompany(tenantId);

      const pdfBytes = await fillCerfa13408({
        permitType: (d.permitType as "permis_construire" | "permis_amenager" | "declaration_prealable") ?? "permis_construire",
        permitNumber: String(d.permitNumber ?? ""),
        voiriesDifferees: !!d.voiriesDifferees,
        voiriesDate: dateToCerfa(d.voiriesDate as string),
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
        achievementDate: dateToCerfa(d.achievementDate as string),
        destinationChangeDate: dateToCerfa(d.destinationChangeDate as string),
        totalTravaux: !d.partialWorks,
        trancheTravaux: !!d.partialWorks,
        precisAchevement: String(d.partialWorksDescription ?? ""),
        surfacePlancher: String(d.surfaceCreated ?? ""),
        nbLogementsTotal: String(d.nbLogementsTotal ?? ""),
        nbIndividuels: String(d.nbIndividuels ?? ""),
        nbCollectifs: String(d.nbCollectifs ?? ""),
        signatureLieu: String(d.signedLocation ?? ""),
        signatureDate: dateToCerfa(d.signedDate as string),
        signatureNom: String(d.representantNom ?? ""),
      });
      res
        .type("application/pdf")
        .setHeader(
          "Content-Disposition",
          `inline; filename="CERFA-13408-${String(d.reference ?? "daact")}.pdf"`
        )
        .send(Buffer.from(pdfBytes));
    })
  );

  // GET /daact/:id/html → DAACT CERFA 13408*13
  router.get(
    "/daact/:id/html",
    wrap(async (req, res) => {
      const tenantId = req.user?.companyId ?? 1;
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM daact_declarations WHERE id = ? AND companyId = ? LIMIT 1",
        [req.params.id, tenantId]
      );
      const declaration = rows[0] as Record<string, unknown> | undefined;
      if (!declaration) {
        res.status(404).type("html").send("<h1>DAACT introuvable</h1>");
        return;
      }
      declaration.voiriesDifferees = !!declaration.voiriesDifferees;
      declaration.partialWorks = !!declaration.partialWorks;
      const [chantierRows] = declaration.chantierId
        ? await db.query<RowDataPacket[]>("SELECT * FROM chantiers WHERE id = ? LIMIT 1", [declaration.chantierId])
        : [[]];
      const company = await loadCompany(tenantId);
      const html = renderDaactCerfaHtml({
        declaration,
        chantier: (chantierRows[0] as Record<string, unknown>) ?? null,
        company,
      });
      res
        .type("html")
        .send(wrapWithPrintButton(html, `DAACT ${String(declaration.reference ?? "")}`));
    })
  );

  // ─── CRUD générique pour les 5 entités ─────────────────────────────────
  router.use("/receptions", buildCrudRouter(receptions, { db, resourceName: "admin_receptions" }));
  router.use("/tva", buildCrudRouter(tva, { db, resourceName: "admin_tva" }));
  router.use("/dc4", buildCrudRouter(dc4, { db, resourceName: "admin_dc4" }));
  router.use("/daact", buildCrudRouter(daact, { db, resourceName: "admin_daact" }));
  router.use("/rge", buildCrudRouter(rge, { db, resourceName: "admin_rge" }));

  return router;
}
