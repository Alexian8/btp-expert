// ═══════════════════════════════════════════════════════════════════════════
// administrativeDocs.js — Documents administratifs BTP (Session 17)
//
// Gère :
//   - PV de réception de chantier (norme NF P 03-001)
//   - Attestations TVA réduite 5,5% / 10%
//   - DC4 — Déclaration de sous-traitance (marchés publics)
//   - Documents RGE / MaPrimeRénov'
// ═══════════════════════════════════════════════════════════════════════════

const { ipcMain } = require("electron");

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() { return new Date().toISOString(); }

function makeReference(db, table, prefix) {
  const year = new Date().getFullYear();
  const fullPrefix = `${prefix}-${year}-`;
  const last = db.prepare(`
    SELECT reference FROM ${table}
    WHERE reference LIKE ?
    ORDER BY reference DESC LIMIT 1
  `).get(`${fullPrefix}%`);
  let n = 1;
  if (last && last.reference) {
    const m = last.reference.match(/-(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${fullPrefix}${String(n).padStart(4, "0")}`;
}

function rowToReception(row) {
  if (!row) return null;
  return {
    ...row,
    ownerSigned: !!row.ownerSigned,
    contractorSigned: !!row.contractorSigned,
  };
}

function rowToTvaAttestation(row) {
  if (!row) return null;
  return {
    ...row,
    logementBuiltOver2Years: !!row.logementBuiltOver2Years,
    clientCommitments: row.clientCommitments ? JSON.parse(row.clientCommitments) : [],
  };
}

function rowToDc4(row) {
  if (!row) return null;
  return {
    ...row,
    cautionRequired: !!row.cautionRequired,
    cautionReceived: !!row.cautionReceived,
  };
}

function init({ db }) {

  // ═════════════════════════════════════════════════════════════════════════
  // PV DE RÉCEPTION
  // ═════════════════════════════════════════════════════════════════════════

  ipcMain.handle("admin:reception:list", (_e, filters = {}) => {
    try {
      let sql = "SELECT * FROM reception_reports WHERE 1=1";
      const params = [];
      if (filters.chantierId) { sql += " AND chantierId = ?"; params.push(filters.chantierId); }
      if (filters.status) { sql += " AND status = ?"; params.push(filters.status); }
      if (filters.receptionType) { sql += " AND receptionType = ?"; params.push(filters.receptionType); }
      sql += " ORDER BY receptionDate DESC, createdAt DESC";
      return db.prepare(sql).all(...params).map(rowToReception);
    } catch (e) {
      console.error("[admin:reception:list]", e);
      return [];
    }
  });

  ipcMain.handle("admin:reception:getById", (_e, id) => {
    try {
      const report = rowToReception(db.prepare("SELECT * FROM reception_reports WHERE id = ?").get(id));
      if (!report) return null;
      const reserves = db.prepare("SELECT * FROM reception_reserves WHERE reportId = ? ORDER BY sortOrder ASC").all(id);
      return {
        ...report,
        reserves: reserves.map((r) => ({ ...r, fixed: !!r.fixed })),
      };
    } catch { return null; }
  });

  ipcMain.handle("admin:reception:create", (_e, data) => {
    try {
      const id = generateId("rcp");
      const reference = makeReference(db, "reception_reports", "PV");
      const now = nowIso();
      db.prepare(`
        INSERT INTO reception_reports (
          id, reference, chantierId, clientId, clientName,
          receptionType, receptionDate, guaranteeStartDate,
          location, ownerPresent, contractorPresent,
          worksDescription, observations,
          retentionAmount, retentionReleaseDate,
          ownerSigned, ownerSignedDate, ownerSignatureDataUrl,
          contractorSigned, contractorSignedDate, contractorSignatureDataUrl,
          status, vaultDocumentId,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, reference,
        data.chantierId || "",
        data.clientId || "",
        data.clientName || "",
        data.receptionType || "sans_reserves",
        data.receptionDate || now.slice(0, 10),
        data.guaranteeStartDate || data.receptionDate || now.slice(0, 10),
        data.location || "",
        data.ownerPresent || "",
        data.contractorPresent || "",
        data.worksDescription || "",
        data.observations || "",
        Number(data.retentionAmount) || 0,
        data.retentionReleaseDate || "",
        data.ownerSigned ? 1 : 0,
        data.ownerSignedDate || "",
        data.ownerSignatureDataUrl || "",
        data.contractorSigned ? 1 : 0,
        data.contractorSignedDate || "",
        data.contractorSignatureDataUrl || "",
        data.status || "brouillon",
        data.vaultDocumentId || "",
        now, now
      );

      // Insérer les réserves si fournies
      if (Array.isArray(data.reserves)) {
        const insRes = db.prepare(`
          INSERT INTO reception_reserves (
            id, reportId, description, location, category,
            toBeFixedBefore, fixed, fixedDate, sortOrder
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.reserves.forEach((r, idx) => {
          insRes.run(
            generateId("res"),
            id,
            r.description || "",
            r.location || "",
            r.category || "",
            r.toBeFixedBefore || "",
            r.fixed ? 1 : 0,
            r.fixedDate || "",
            idx
          );
        });
      }

      return { success: true, id, reference };
    } catch (e) {
      console.error("[admin:reception:create]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("admin:reception:update", (_e, { id, data }) => {
    try {
      const allowed = [
        "chantierId", "clientId", "clientName",
        "receptionType", "receptionDate", "guaranteeStartDate",
        "location", "ownerPresent", "contractorPresent",
        "worksDescription", "observations",
        "retentionAmount", "retentionReleaseDate",
        "ownerSigned", "ownerSignedDate", "ownerSignatureDataUrl",
        "contractorSigned", "contractorSignedDate", "contractorSignatureDataUrl",
        "status", "vaultDocumentId",
      ];
      const keys = Object.keys(data).filter((k) => allowed.includes(k));
      if (keys.length > 0) {
        const sets = keys.map((k) => `${k} = @${k}`).join(", ");
        const payload = { id, updatedAt: nowIso() };
        for (const k of keys) {
          if (k === "ownerSigned" || k === "contractorSigned") payload[k] = data[k] ? 1 : 0;
          else if (k === "retentionAmount") payload[k] = Number(data[k]) || 0;
          else payload[k] = data[k] !== undefined ? data[k] : "";
        }
        db.prepare(`UPDATE reception_reports SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);
      }

      // Remplacer les réserves
      if (Array.isArray(data.reserves)) {
        db.prepare("DELETE FROM reception_reserves WHERE reportId = ?").run(id);
        const insRes = db.prepare(`
          INSERT INTO reception_reserves (
            id, reportId, description, location, category,
            toBeFixedBefore, fixed, fixedDate, sortOrder
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.reserves.forEach((r, idx) => {
          insRes.run(
            r.id || generateId("res"),
            id,
            r.description || "",
            r.location || "",
            r.category || "",
            r.toBeFixedBefore || "",
            r.fixed ? 1 : 0,
            r.fixedDate || "",
            idx
          );
        });
      }
      return { success: true };
    } catch (e) {
      console.error("[admin:reception:update]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("admin:reception:delete", (_e, id) => {
    try {
      db.prepare("DELETE FROM reception_reserves WHERE reportId = ?").run(id);
      db.prepare("DELETE FROM reception_reports WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // ATTESTATIONS TVA
  // ═════════════════════════════════════════════════════════════════════════

  ipcMain.handle("admin:tva:list", (_e, filters = {}) => {
    try {
      let sql = "SELECT * FROM tva_attestations WHERE 1=1";
      const params = [];
      if (filters.chantierId) { sql += " AND chantierId = ?"; params.push(filters.chantierId); }
      if (filters.tvaRate !== undefined) { sql += " AND tvaRate = ?"; params.push(filters.tvaRate); }
      if (filters.status) { sql += " AND status = ?"; params.push(filters.status); }
      if (filters.year) { sql += " AND substr(signedDate, 1, 4) = ?"; params.push(String(filters.year)); }
      sql += " ORDER BY signedDate DESC, createdAt DESC";
      return db.prepare(sql).all(...params).map(rowToTvaAttestation);
    } catch (e) {
      console.error("[admin:tva:list]", e);
      return [];
    }
  });

  ipcMain.handle("admin:tva:getById", (_e, id) => {
    try {
      return rowToTvaAttestation(db.prepare("SELECT * FROM tva_attestations WHERE id = ?").get(id));
    } catch { return null; }
  });

  ipcMain.handle("admin:tva:create", (_e, data) => {
    try {
      const id = generateId("tva");
      const reference = makeReference(db, "tva_attestations", "ATT");
      const now = nowIso();
      db.prepare(`
        INSERT INTO tva_attestations (
          id, reference, attestationType, tvaRate,
          chantierId, clientId, clientName,
          logementType, logementBuiltOver2Years, logementYearOfConstruction, logementAddress,
          ownerCivilite, ownerLastName, ownerFirstName, ownerEmail, ownerPhone, ownerSiret,
          interventionType, category, worksDescription, worksStartDate, worksEndDate,
          totalAmountHt, invoiceReference,
          clientCommitments,
          signedDate, signedLocation, clientSignatureDataUrl,
          status, vaultDocumentId,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, reference,
        data.attestationType || "simplifiee",
        Number(data.tvaRate) || 10,
        data.chantierId || "",
        data.clientId || "",
        data.clientName || "",
        data.logementType || "residence_principale",
        data.logementBuiltOver2Years ? 1 : 0,
        data.logementYearOfConstruction || "",
        data.logementAddress || "",
        data.ownerCivilite || "",
        data.ownerLastName || "",
        data.ownerFirstName || "",
        data.ownerEmail || "",
        data.ownerPhone || "",
        data.ownerSiret || "",
        data.interventionType || "amelioration",
        data.category || "amelioration_qualite",
        data.worksDescription || "",
        data.worksStartDate || "",
        data.worksEndDate || "",
        Number(data.totalAmountHt) || 0,
        data.invoiceReference || "",
        JSON.stringify(data.clientCommitments || []),
        data.signedDate || "",
        data.signedLocation || "",
        data.clientSignatureDataUrl || "",
        data.status || "brouillon",
        data.vaultDocumentId || "",
        now, now
      );
      return { success: true, id, reference };
    } catch (e) {
      console.error("[admin:tva:create]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("admin:tva:update", (_e, { id, data }) => {
    try {
      const allowed = [
        "attestationType", "tvaRate",
        "chantierId", "clientId", "clientName",
        "logementType", "logementBuiltOver2Years", "logementYearOfConstruction", "logementAddress",
        "ownerCivilite", "ownerLastName", "ownerFirstName", "ownerEmail", "ownerPhone", "ownerSiret",
        "interventionType", "category", "worksDescription", "worksStartDate", "worksEndDate",
        "totalAmountHt", "invoiceReference",
        "clientCommitments",
        "signedDate", "signedLocation", "clientSignatureDataUrl",
        "status", "vaultDocumentId",
      ];
      const keys = Object.keys(data).filter((k) => allowed.includes(k));
      if (keys.length === 0) return { success: true };
      const sets = keys.map((k) => `${k} = @${k}`).join(", ");
      const payload = { id, updatedAt: nowIso() };
      for (const k of keys) {
        if (k === "logementBuiltOver2Years") payload[k] = data[k] ? 1 : 0;
        else if (k === "tvaRate" || k === "totalAmountHt") payload[k] = Number(data[k]) || 0;
        else if (k === "clientCommitments") payload[k] = JSON.stringify(data[k] || []);
        else payload[k] = data[k] !== undefined ? data[k] : "";
      }
      db.prepare(`UPDATE tva_attestations SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("admin:tva:delete", (_e, id) => {
    try {
      db.prepare("DELETE FROM tva_attestations WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // DC4 - DÉCLARATION DE SOUS-TRAITANCE
  // ═════════════════════════════════════════════════════════════════════════

  ipcMain.handle("admin:dc4:list", (_e, filters = {}) => {
    try {
      let sql = "SELECT * FROM dc4_declarations WHERE 1=1";
      const params = [];
      if (filters.subcontractorId) { sql += " AND subcontractorId = ?"; params.push(filters.subcontractorId); }
      if (filters.purchaseOrderId) { sql += " AND purchaseOrderId = ?"; params.push(filters.purchaseOrderId); }
      if (filters.status) { sql += " AND status = ?"; params.push(filters.status); }
      sql += " ORDER BY createdAt DESC";
      return db.prepare(sql).all(...params).map(rowToDc4);
    } catch (e) {
      console.error("[admin:dc4:list]", e);
      return [];
    }
  });

  ipcMain.handle("admin:dc4:getById", (_e, id) => {
    try {
      return rowToDc4(db.prepare("SELECT * FROM dc4_declarations WHERE id = ?").get(id));
    } catch { return null; }
  });

  ipcMain.handle("admin:dc4:create", (_e, data) => {
    try {
      const id = generateId("dc4");
      const reference = makeReference(db, "dc4_declarations", "DC4");
      const now = nowIso();
      db.prepare(`
        INSERT INTO dc4_declarations (
          id, reference, acteSpecialNumber,
          purchaseOrderId, subcontractorId, subcontractorName, subcontractorSiret, chantierId,
          publicMarketReference, publicMarketObject, publicAuthorityName, publicAuthorityAddress,
          subcontractedWorksDescription, subcontractedAmountHt, subcontractedAmountTtc, subcontractedDuration,
          paymentMethod, paymentDelay,
          cautionType, cautionRequired, cautionReceived,
          acceptanceDeadline, signedDate, signedLocation,
          contractorSignatureDataUrl, ownerSignatureDataUrl, authoritySignatureDataUrl,
          status, vaultDocumentId,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, reference,
        data.acteSpecialNumber || "",
        data.purchaseOrderId || "",
        data.subcontractorId || "",
        data.subcontractorName || "",
        data.subcontractorSiret || "",
        data.chantierId || "",
        data.publicMarketReference || "",
        data.publicMarketObject || "",
        data.publicAuthorityName || "",
        data.publicAuthorityAddress || "",
        data.subcontractedWorksDescription || "",
        Number(data.subcontractedAmountHt) || 0,
        Number(data.subcontractedAmountTtc) || 0,
        data.subcontractedDuration || "",
        data.paymentMethod || "Paiement direct par le maître d'ouvrage",
        Number(data.paymentDelay) || 30,
        data.cautionType || "Aucune",
        data.cautionRequired ? 1 : 0,
        data.cautionReceived ? 1 : 0,
        data.acceptanceDeadline || "",
        data.signedDate || "",
        data.signedLocation || "",
        data.contractorSignatureDataUrl || "",
        data.ownerSignatureDataUrl || "",
        data.authoritySignatureDataUrl || "",
        data.status || "brouillon",
        data.vaultDocumentId || "",
        now, now
      );
      return { success: true, id, reference };
    } catch (e) {
      console.error("[admin:dc4:create]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("admin:dc4:update", (_e, { id, data }) => {
    try {
      const allowed = [
        "acteSpecialNumber",
        "purchaseOrderId", "subcontractorId", "subcontractorName", "subcontractorSiret", "chantierId",
        "publicMarketReference", "publicMarketObject", "publicAuthorityName", "publicAuthorityAddress",
        "subcontractedWorksDescription", "subcontractedAmountHt", "subcontractedAmountTtc", "subcontractedDuration",
        "paymentMethod", "paymentDelay",
        "cautionType", "cautionRequired", "cautionReceived",
        "acceptanceDeadline", "signedDate", "signedLocation",
        "contractorSignatureDataUrl", "ownerSignatureDataUrl", "authoritySignatureDataUrl",
        "status", "vaultDocumentId",
      ];
      const keys = Object.keys(data).filter((k) => allowed.includes(k));
      if (keys.length === 0) return { success: true };
      const sets = keys.map((k) => `${k} = @${k}`).join(", ");
      const payload = { id, updatedAt: nowIso() };
      for (const k of keys) {
        if (k === "cautionRequired" || k === "cautionReceived") payload[k] = data[k] ? 1 : 0;
        else if (["subcontractedAmountHt", "subcontractedAmountTtc", "paymentDelay"].includes(k)) payload[k] = Number(data[k]) || 0;
        else payload[k] = data[k] !== undefined ? data[k] : "";
      }
      db.prepare(`UPDATE dc4_declarations SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("admin:dc4:delete", (_e, id) => {
    try {
      db.prepare("DELETE FROM dc4_declarations WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // RGE Documents (préparation 2026)
  // ═════════════════════════════════════════════════════════════════════════

  ipcMain.handle("admin:rge:list", () => {
    try {
      return db.prepare("SELECT * FROM rge_documents ORDER BY createdAt DESC").all();
    } catch { return []; }
  });

  ipcMain.handle("admin:rge:create", (_e, data) => {
    try {
      const id = generateId("rge");
      const reference = makeReference(db, "rge_documents", "RGE");
      const now = nowIso();
      db.prepare(`
        INSERT INTO rge_documents (
          id, reference, type, chantierId, clientId, clientName,
          rgeQualification, rgeQualificationNumber, rgeValidUntil,
          worksDescription, totalAmountTtc, primeRenovExpected, primeRenovActual,
          notes, vaultDocumentId,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, reference,
        data.type || "qualification",
        data.chantierId || "",
        data.clientId || "",
        data.clientName || "",
        data.rgeQualification || "",
        data.rgeQualificationNumber || "",
        data.rgeValidUntil || "",
        data.worksDescription || "",
        Number(data.totalAmountTtc) || 0,
        Number(data.primeRenovExpected) || 0,
        Number(data.primeRenovActual) || 0,
        data.notes || "",
        data.vaultDocumentId || "",
        now, now
      );
      return { success: true, id, reference };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("admin:rge:delete", (_e, id) => {
    try {
      db.prepare("DELETE FROM rge_documents WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // STATS GLOBALES
  // ═════════════════════════════════════════════════════════════════════════

  ipcMain.handle("admin:getStats", () => {
    try {
      const currentYear = new Date().getFullYear();

      const receptionsTotal = db.prepare("SELECT COUNT(*) as n FROM reception_reports").get().n || 0;
      const receptionsWithReserves = db.prepare("SELECT COUNT(*) as n FROM reception_reports WHERE receptionType = 'avec_reserves'").get().n || 0;

      const tvaAttestationsTotal = db.prepare("SELECT COUNT(*) as n FROM tva_attestations").get().n || 0;
      const tvaAttestationsThisYear = db.prepare(`
        SELECT COUNT(*) as n FROM tva_attestations
        WHERE substr(signedDate, 1, 4) = ?
      `).get(String(currentYear)).n || 0;

      const dc4Total = db.prepare("SELECT COUNT(*) as n FROM dc4_declarations").get().n || 0;
      const dc4Pending = db.prepare("SELECT COUNT(*) as n FROM dc4_declarations WHERE status = 'envoyee'").get().n || 0;

      const rgeDocumentsTotal = db.prepare("SELECT COUNT(*) as n FROM rge_documents").get().n || 0;

      let daactTotal = 0, daactPending = 0;
      try {
        daactTotal = db.prepare("SELECT COUNT(*) as n FROM daact_declarations").get().n || 0;
        daactPending = db.prepare("SELECT COUNT(*) as n FROM daact_declarations WHERE status IN ('brouillon','depose')").get().n || 0;
      } catch {
        /* table peut ne pas exister sur anciennes DB — migration au prochain boot */
      }

      return {
        receptionsTotal, receptionsWithReserves,
        tvaAttestationsTotal, tvaAttestationsThisYear,
        dc4Total, dc4Pending,
        daactTotal, daactPending,
        rgeDocumentsTotal,
      };
    } catch (e) {
      return {
        receptionsTotal: 0, receptionsWithReserves: 0,
        tvaAttestationsTotal: 0, tvaAttestationsThisYear: 0,
        dc4Total: 0, dc4Pending: 0,
        daactTotal: 0, daactPending: 0,
        rgeDocumentsTotal: 0,
      };
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // DAACT — Déclaration d'achèvement et de conformité (CERFA 13408*13)
  // ═════════════════════════════════════════════════════════════════════════

  const DAACT_ALLOWED = [
    "chantierId", "permitType", "permitNumber",
    "voiriesDifferees", "voiriesDate",
    "titulaireNom", "titulairePrenom",
    "denomination", "siret",
    "representantNom", "representantPrenom", "email",
    "achievementDate", "destinationChangeDate",
    "partialWorks", "partialWorksDescription",
    "surfaceCreated", "nbLogementsTotal", "nbIndividuels", "nbCollectifs",
    "signedDate", "signedLocation", "declarantSignatureDataUrl",
    "architectLocation", "architectSignedDate", "architectSignatureDataUrl",
    "status", "vaultDocumentId",
  ];

  function rowToDaact(row) {
    if (!row) return null;
    return {
      ...row,
      voiriesDifferees: !!row.voiriesDifferees,
      partialWorks: !!row.partialWorks,
    };
  }

  ipcMain.handle("admin:daact:list", (_e, filters = {}) => {
    try {
      let sql = "SELECT * FROM daact_declarations WHERE 1=1";
      const params = [];
      if (filters.chantierId) { sql += " AND chantierId = ?"; params.push(filters.chantierId); }
      if (filters.permitType) { sql += " AND permitType = ?"; params.push(filters.permitType); }
      if (filters.status) { sql += " AND status = ?"; params.push(filters.status); }
      sql += " ORDER BY achievementDate DESC, createdAt DESC";
      return db.prepare(sql).all(...params).map(rowToDaact);
    } catch (e) {
      console.error("[admin:daact:list]", e);
      return [];
    }
  });

  ipcMain.handle("admin:daact:getById", (_e, id) => {
    try {
      return rowToDaact(db.prepare("SELECT * FROM daact_declarations WHERE id = ?").get(id));
    } catch { return null; }
  });

  ipcMain.handle("admin:daact:create", (_e, data) => {
    try {
      const id = generateId("daact");
      const reference = makeReference(db, "daact_declarations", "DAACT");
      const now = nowIso();
      db.prepare(`
        INSERT INTO daact_declarations (
          id, reference, chantierId, permitType, permitNumber,
          voiriesDifferees, voiriesDate,
          titulaireNom, titulairePrenom,
          denomination, siret, representantNom, representantPrenom, email,
          achievementDate, destinationChangeDate,
          partialWorks, partialWorksDescription,
          surfaceCreated, nbLogementsTotal, nbIndividuels, nbCollectifs,
          signedDate, signedLocation, declarantSignatureDataUrl,
          architectLocation, architectSignedDate, architectSignatureDataUrl,
          status, vaultDocumentId,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, reference,
        data.chantierId || "",
        data.permitType || "permis_construire",
        data.permitNumber || "",
        data.voiriesDifferees ? 1 : 0,
        data.voiriesDate || "",
        data.titulaireNom || "",
        data.titulairePrenom || "",
        data.denomination || "",
        data.siret || "",
        data.representantNom || "",
        data.representantPrenom || "",
        data.email || "",
        data.achievementDate || now.slice(0, 10),
        data.destinationChangeDate || "",
        data.partialWorks ? 1 : 0,
        data.partialWorksDescription || "",
        Number(data.surfaceCreated) || 0,
        Number(data.nbLogementsTotal) || 0,
        Number(data.nbIndividuels) || 0,
        Number(data.nbCollectifs) || 0,
        data.signedDate || "",
        data.signedLocation || "",
        data.declarantSignatureDataUrl || "",
        data.architectLocation || "",
        data.architectSignedDate || "",
        data.architectSignatureDataUrl || "",
        data.status || "brouillon",
        data.vaultDocumentId || "",
        now, now
      );
      return { success: true, id, reference };
    } catch (e) {
      console.error("[admin:daact:create]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("admin:daact:update", (_e, { id, data }) => {
    try {
      const keys = Object.keys(data).filter((k) => DAACT_ALLOWED.includes(k));
      if (keys.length === 0) return { success: true };
      const sets = keys.map((k) => `${k} = @${k}`).join(", ");
      const payload = { id, updatedAt: nowIso() };
      for (const k of keys) {
        if (["voiriesDifferees", "partialWorks"].includes(k)) payload[k] = data[k] ? 1 : 0;
        else if (["surfaceCreated", "nbLogementsTotal", "nbIndividuels", "nbCollectifs"].includes(k)) payload[k] = Number(data[k]) || 0;
        else payload[k] = data[k] !== undefined ? data[k] : "";
      }
      db.prepare(`UPDATE daact_declarations SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("admin:daact:delete", (_e, id) => {
    try {
      db.prepare("DELETE FROM daact_declarations WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log("[administrativeDocs] Module initialisé");
}

module.exports = { init };
