// ═══════════════════════════════════════════════════════════════════════════
// subcontractors.js — Module Sous-traitants (Session 15)
//
// Gère :
//   - CRUD sous-traitants
//   - Attestations avec rappels d'expiration auto via agenda
//   - Bons de commande (BdC) avec lignes
//   - Situations de travaux (avec %avancement / retenue garantie)
//   - Stats globales
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

function rowToSubcontractor(row) {
  if (!row) return null;
  return { ...row, isActive: !!row.isActive };
}
function rowToPo(row) {
  if (!row) return null;
  return {
    ...row,
    retentionEnabled: !!row.retentionEnabled,
    retentionReleased: !!row.retentionReleased,
    hasSituations: !!row.hasSituations,
    cautionRequired: !!row.cautionRequired,
    cautionReceived: !!row.cautionReceived,
  };
}

function init({ db }) {

  // ═════════════════════════════════════════════════════════════════════════
  // SOUS-TRAITANTS
  // ═════════════════════════════════════════════════════════════════════════

  ipcMain.handle("subcontractors:list", (_e, filters = {}) => {
    try {
      let sql = "SELECT * FROM subcontractors WHERE 1=1";
      const params = [];
      if (filters.activity) { sql += " AND activity = ?"; params.push(filters.activity); }
      if (filters.isActive !== undefined) { sql += " AND isActive = ?"; params.push(filters.isActive ? 1 : 0); }
      sql += " ORDER BY companyName ASC";
      return db.prepare(sql).all(...params).map(rowToSubcontractor);
    } catch (e) {
      console.error("[subcontractors:list]", e);
      return [];
    }
  });

  ipcMain.handle("subcontractors:getById", (_e, id) => {
    try {
      return rowToSubcontractor(db.prepare("SELECT * FROM subcontractors WHERE id = ?").get(id));
    } catch { return null; }
  });

  ipcMain.handle("subcontractors:create", (_e, data) => {
    try {
      const id = generateId("st");
      const now = nowIso();
      db.prepare(`
        INSERT INTO subcontractors (
          id, companyName, contactFirstName, contactLastName, contactRole,
          activity, activityNotes,
          siret, rcs, legalForm, capital, tvaNumber,
          email, phone, mobile, website,
          addressLine1, addressLine2, postalCode, city, country,
          iban, bic, bankName,
          isActive, rating, notes, defaultVatRate,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.companyName || "",
        data.contactFirstName || "",
        data.contactLastName || "",
        data.contactRole || "",
        data.activity || "autre",
        data.activityNotes || "",
        data.siret || "",
        data.rcs || "",
        data.legalForm || "",
        data.capital || "",
        data.tvaNumber || "",
        data.email || "",
        data.phone || "",
        data.mobile || "",
        data.website || "",
        data.addressLine1 || "",
        data.addressLine2 || "",
        data.postalCode || "",
        data.city || "",
        data.country || "France",
        data.iban || "",
        data.bic || "",
        data.bankName || "",
        data.isActive !== false ? 1 : 0,
        Number(data.rating) || 0,
        data.notes || "",
        Number(data.defaultVatRate) || 20,
        now, now
      );
      return { success: true, id };
    } catch (e) {
      console.error("[subcontractors:create]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("subcontractors:update", (_e, { id, data }) => {
    try {
      const allowed = [
        "companyName", "contactFirstName", "contactLastName", "contactRole",
        "activity", "activityNotes",
        "siret", "rcs", "legalForm", "capital", "tvaNumber",
        "email", "phone", "mobile", "website",
        "addressLine1", "addressLine2", "postalCode", "city", "country",
        "iban", "bic", "bankName",
        "isActive", "rating", "notes", "defaultVatRate",
      ];
      const keys = Object.keys(data).filter(k => allowed.includes(k));
      if (keys.length === 0) return { success: true };
      const sets = keys.map(k => `${k} = @${k}`).join(", ");
      const payload = { id, updatedAt: nowIso() };
      for (const k of keys) {
        if (k === "isActive") payload[k] = data[k] ? 1 : 0;
        else if (k === "rating" || k === "defaultVatRate") payload[k] = Number(data[k]) || 0;
        else payload[k] = data[k] !== undefined ? data[k] : "";
      }
      db.prepare(`UPDATE subcontractors SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);
      return { success: true };
    } catch (e) {
      console.error("[subcontractors:update]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("subcontractors:delete", (_e, id) => {
    try {
      // Vérifier qu'aucun BdC n'est lié
      const linked = db.prepare("SELECT COUNT(*) as cnt FROM purchase_orders WHERE subcontractorId = ?").get(id);
      if (linked.cnt > 0) {
        return { success: false, error: `Impossible : ${linked.cnt} bon(s) de commande lié(s)` };
      }
      // Supprimer attestations en cascade
      db.prepare("DELETE FROM st_attestations WHERE subcontractorId = ?").run(id);
      db.prepare("DELETE FROM subcontractors WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // ATTESTATIONS
  // ═════════════════════════════════════════════════════════════════════════

  ipcMain.handle("subcontractors:listAttestations", (_e, subcontractorId) => {
    try {
      const sql = subcontractorId
        ? "SELECT * FROM st_attestations WHERE subcontractorId = ? ORDER BY expirationDate ASC"
        : "SELECT * FROM st_attestations ORDER BY expirationDate ASC";
      const rows = subcontractorId
        ? db.prepare(sql).all(subcontractorId)
        : db.prepare(sql).all();
      return rows;
    } catch (e) {
      console.error("[subcontractors:listAttestations]", e);
      return [];
    }
  });

  ipcMain.handle("subcontractors:createAttestation", (_e, data) => {
    try {
      const id = generateId("att");
      const now = nowIso();
      db.prepare(`
        INSERT INTO st_attestations (
          id, subcontractorId, type, customLabel, reference,
          issuedDate, expirationDate, vaultDocumentId, notes,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.subcontractorId,
        data.type || "autre",
        data.customLabel || "",
        data.reference || "",
        data.issuedDate || "",
        data.expirationDate || "",
        data.vaultDocumentId || "",
        data.notes || "",
        now, now
      );
      return { success: true, id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("subcontractors:updateAttestation", (_e, { id, data }) => {
    try {
      const allowed = ["type", "customLabel", "reference", "issuedDate", "expirationDate", "vaultDocumentId", "notes"];
      const keys = Object.keys(data).filter(k => allowed.includes(k));
      if (keys.length === 0) return { success: true };
      const sets = keys.map(k => `${k} = @${k}`).join(", ");
      const payload = { id, updatedAt: nowIso() };
      for (const k of keys) payload[k] = data[k] !== undefined ? data[k] : "";
      db.prepare(`UPDATE st_attestations SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("subcontractors:deleteAttestation", (_e, id) => {
    try {
      db.prepare("DELETE FROM st_attestations WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("subcontractors:listExpiringAttestations", (_e, daysAhead = 30) => {
    try {
      const limit = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const rows = db.prepare(`
        SELECT a.*, s.companyName
        FROM st_attestations a
        LEFT JOIN subcontractors s ON s.id = a.subcontractorId
        WHERE a.expirationDate != '' AND a.expirationDate <= ?
        ORDER BY a.expirationDate ASC
      `).all(limit);
      // Marquer expirées vs expire bientôt
      return rows.map(r => ({
        ...r,
        isExpired: r.expirationDate < today,
      }));
    } catch (e) {
      return [];
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // BONS DE COMMANDE
  // ═════════════════════════════════════════════════════════════════════════

  function recalcPoTotals(poId) {
    const lines = db.prepare("SELECT * FROM po_lines WHERE purchaseOrderId = ?").all(poId);
    let totalHt = 0, totalVat = 0;
    for (const l of lines) {
      totalHt += (l.quantity || 0) * (l.unitPriceHt || 0);
      totalVat += ((l.quantity || 0) * (l.unitPriceHt || 0)) * ((l.vatRate || 0) / 100);
    }
    const totalTtc = totalHt + totalVat;
    const po = db.prepare("SELECT retentionEnabled, retentionPct FROM purchase_orders WHERE id = ?").get(poId);
    const retentionAmount = po?.retentionEnabled
      ? +(totalTtc * (po.retentionPct || 0) / 100).toFixed(2)
      : 0;
    db.prepare(`
      UPDATE purchase_orders
      SET totalHt = ?, totalVat = ?, totalTtc = ?, retentionAmount = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      +totalHt.toFixed(2),
      +totalVat.toFixed(2),
      +totalTtc.toFixed(2),
      retentionAmount,
      nowIso(),
      poId
    );
  }

  ipcMain.handle("po:list", (_e, filters = {}) => {
    try {
      let sql = "SELECT * FROM purchase_orders WHERE 1=1";
      const params = [];
      if (filters.subcontractorId) { sql += " AND subcontractorId = ?"; params.push(filters.subcontractorId); }
      if (filters.chantierId) { sql += " AND chantierId = ?"; params.push(filters.chantierId); }
      if (filters.status) { sql += " AND status = ?"; params.push(filters.status); }
      sql += " ORDER BY poDate DESC, createdAt DESC";
      return db.prepare(sql).all(...params).map(rowToPo);
    } catch (e) {
      console.error("[po:list]", e);
      return [];
    }
  });

  ipcMain.handle("po:getById", (_e, id) => {
    try {
      const po = rowToPo(db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id));
      if (!po) return null;
      const lines = db.prepare("SELECT * FROM po_lines WHERE purchaseOrderId = ? ORDER BY sortOrder ASC").all(id);
      return { ...po, lines };
    } catch { return null; }
  });

  ipcMain.handle("po:create", (_e, data) => {
    try {
      const id = generateId("po");
      const reference = makeReference(db, "purchase_orders", "BC");
      const now = nowIso();
      db.prepare(`
        INSERT INTO purchase_orders (
          id, reference, subcontractorId, subcontractorName, chantierId,
          poDate, startDate, endDate, signedDate,
          title, description,
          totalHt, totalVat, totalTtc,
          retentionEnabled, retentionPct, retentionAmount, retentionReleaseDate, retentionReleased,
          hasSituations, paymentDelay,
          cautionRequired, cautionReceived, cautionVaultDocumentId,
          vaultDocumentId,
          status, notes,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 0, ?, 0, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        reference,
        data.subcontractorId || "",
        data.subcontractorName || "",
        data.chantierId || "",
        data.poDate || now.slice(0, 10),
        data.startDate || "",
        data.endDate || "",
        data.signedDate || "",
        data.title || "",
        data.description || "",
        data.retentionEnabled ? 1 : 0,
        Number(data.retentionPct) || 5,
        data.retentionReleaseDate || "",
        data.hasSituations ? 1 : 0,
        Number(data.paymentDelay) || 30,
        data.cautionRequired ? 1 : 0,
        data.cautionVaultDocumentId || "",
        data.vaultDocumentId || "",
        data.status || "brouillon",
        data.notes || "",
        now, now
      );

      // Insérer lignes si fournies
      if (Array.isArray(data.lines)) {
        const insLine = db.prepare(`
          INSERT INTO po_lines (
            id, purchaseOrderId, designation, quantity, unit,
            unitPriceHt, totalHt, vatRate, notes, sortOrder
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.lines.forEach((l, idx) => {
          insLine.run(
            generateId("pol"),
            id,
            l.designation || "",
            Number(l.quantity) || 0,
            l.unit || "",
            Number(l.unitPriceHt) || 0,
            +((Number(l.quantity) || 0) * (Number(l.unitPriceHt) || 0)).toFixed(2),
            Number(l.vatRate) || 20,
            l.notes || "",
            idx
          );
        });
      }

      recalcPoTotals(id);
      return { success: true, id, reference };
    } catch (e) {
      console.error("[po:create]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("po:update", (_e, { id, data }) => {
    try {
      const allowed = [
        "subcontractorId", "subcontractorName", "chantierId",
        "poDate", "startDate", "endDate", "signedDate",
        "title", "description",
        "retentionEnabled", "retentionPct", "retentionReleaseDate", "retentionReleased",
        "hasSituations", "paymentDelay",
        "cautionRequired", "cautionReceived", "cautionVaultDocumentId",
        "vaultDocumentId",
        "status", "notes",
      ];
      const keys = Object.keys(data).filter(k => allowed.includes(k));
      if (keys.length > 0) {
        const sets = keys.map(k => `${k} = @${k}`).join(", ");
        const payload = { id, updatedAt: nowIso() };
        for (const k of keys) {
          if (["retentionEnabled", "retentionReleased", "hasSituations", "cautionRequired", "cautionReceived"].includes(k)) {
            payload[k] = data[k] ? 1 : 0;
          } else if (k === "retentionPct" || k === "paymentDelay") {
            payload[k] = Number(data[k]) || 0;
          } else payload[k] = data[k] !== undefined ? data[k] : "";
        }
        db.prepare(`UPDATE purchase_orders SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);
      }

      // Si lines fournies, on remplace
      if (Array.isArray(data.lines)) {
        db.prepare("DELETE FROM po_lines WHERE purchaseOrderId = ?").run(id);
        const insLine = db.prepare(`
          INSERT INTO po_lines (
            id, purchaseOrderId, designation, quantity, unit,
            unitPriceHt, totalHt, vatRate, notes, sortOrder
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.lines.forEach((l, idx) => {
          insLine.run(
            l.id || generateId("pol"),
            id,
            l.designation || "",
            Number(l.quantity) || 0,
            l.unit || "",
            Number(l.unitPriceHt) || 0,
            +((Number(l.quantity) || 0) * (Number(l.unitPriceHt) || 0)).toFixed(2),
            Number(l.vatRate) || 20,
            l.notes || "",
            idx
          );
        });
      }
      recalcPoTotals(id);
      return { success: true };
    } catch (e) {
      console.error("[po:update]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("po:delete", (_e, id) => {
    try {
      // Vérifier qu'aucune situation n'est liée
      const sit = db.prepare("SELECT COUNT(*) as cnt FROM situations WHERE purchaseOrderId = ?").get(id);
      if (sit.cnt > 0) {
        return { success: false, error: `Impossible : ${sit.cnt} situation(s) liée(s)` };
      }
      db.prepare("DELETE FROM po_lines WHERE purchaseOrderId = ?").run(id);
      db.prepare("DELETE FROM purchase_orders WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Libérer la retenue de garantie
  ipcMain.handle("po:releaseRetention", (_e, id) => {
    try {
      db.prepare(`
        UPDATE purchase_orders
        SET retentionReleased = 1, status = 'solde', updatedAt = ?
        WHERE id = ?
      `).run(nowIso(), id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SITUATIONS
  // ═════════════════════════════════════════════════════════════════════════

  function recalcSituationTotals(situationId) {
    const lines = db.prepare("SELECT * FROM situation_lines WHERE situationId = ?").all(situationId);
    let totalHt = 0, totalVat = 0;
    for (const l of lines) {
      const newAmount = (l.totalHt || 0) * ((l.newPct || 0) / 100);
      totalHt += newAmount;
      totalVat += newAmount * ((l.vatRate || 0) / 100);
    }
    const totalTtc = totalHt + totalVat;

    const sit = db.prepare("SELECT purchaseOrderId FROM situations WHERE id = ?").get(situationId);
    const po = sit ? db.prepare("SELECT retentionEnabled, retentionPct FROM purchase_orders WHERE id = ?").get(sit.purchaseOrderId) : null;
    const retentionAmount = po?.retentionEnabled
      ? +(totalTtc * (po.retentionPct || 0) / 100).toFixed(2)
      : 0;
    const netToPay = totalTtc - retentionAmount;

    // Calcul avancement global = somme des cumulPctNow * (lineHt / poTotalHt)
    const poTotal = db.prepare(`
      SELECT COALESCE(SUM(totalHt), 0) as t
      FROM po_lines
      WHERE purchaseOrderId = (SELECT purchaseOrderId FROM situations WHERE id = ?)
    `).get(situationId).t || 0;
    let weightedAdvancement = 0;
    if (poTotal > 0) {
      for (const l of lines) {
        weightedAdvancement += ((l.cumulPctNow || 0) * (l.totalHt || 0)) / poTotal;
      }
    }

    db.prepare(`
      UPDATE situations
      SET totalHt = ?, totalVat = ?, totalTtc = ?,
          retentionAmount = ?, netToPay = ?, globalAdvancementPct = ?,
          updatedAt = ?
      WHERE id = ?
    `).run(
      +totalHt.toFixed(2), +totalVat.toFixed(2), +totalTtc.toFixed(2),
      retentionAmount, +netToPay.toFixed(2), +weightedAdvancement.toFixed(2),
      nowIso(),
      situationId
    );
  }

  ipcMain.handle("situations:list", (_e, filters = {}) => {
    try {
      let sql = "SELECT * FROM situations WHERE 1=1";
      const params = [];
      if (filters.purchaseOrderId) { sql += " AND purchaseOrderId = ?"; params.push(filters.purchaseOrderId); }
      if (filters.subcontractorId) { sql += " AND subcontractorId = ?"; params.push(filters.subcontractorId); }
      if (filters.chantierId) { sql += " AND chantierId = ?"; params.push(filters.chantierId); }
      if (filters.status) { sql += " AND status = ?"; params.push(filters.status); }
      sql += " ORDER BY situationDate DESC";
      return db.prepare(sql).all(...params);
    } catch (e) {
      console.error("[situations:list]", e);
      return [];
    }
  });

  ipcMain.handle("situations:getById", (_e, id) => {
    try {
      const sit = db.prepare("SELECT * FROM situations WHERE id = ?").get(id);
      if (!sit) return null;
      const lines = db.prepare("SELECT * FROM situation_lines WHERE situationId = ? ORDER BY sortOrder ASC").all(id);
      return { ...sit, lines };
    } catch { return null; }
  });

  ipcMain.handle("situations:create", (_e, data) => {
    try {
      const id = generateId("sit");
      const reference = makeReference(db, "situations", "SIT");
      const now = nowIso();

      // Calculer numéro pour ce BdC
      const last = db.prepare(`
        SELECT MAX(number) as n FROM situations WHERE purchaseOrderId = ?
      `).get(data.purchaseOrderId);
      const number = ((last && last.n) || 0) + 1;

      db.prepare(`
        INSERT INTO situations (
          id, reference, number,
          purchaseOrderId, subcontractorId, subcontractorName, chantierId, poReference,
          situationDate, paidDate,
          totalHt, totalVat, totalTtc,
          retentionAmount, netToPay, globalAdvancementPct,
          status, notes, vaultDocumentId,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?)
      `).run(
        id, reference, number,
        data.purchaseOrderId,
        data.subcontractorId || "",
        data.subcontractorName || "",
        data.chantierId || "",
        data.poReference || "",
        data.situationDate || now.slice(0, 10),
        data.paidDate || "",
        data.status || "brouillon",
        data.notes || "",
        data.vaultDocumentId || "",
        now, now
      );

      // Insérer lignes
      if (Array.isArray(data.lines)) {
        const insLine = db.prepare(`
          INSERT INTO situation_lines (
            id, situationId, poLineId, designation,
            totalHt, cumulPctPrevious, cumulPctNow, newPct, newAmountHt,
            vatRate, sortOrder
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.lines.forEach((l, idx) => {
          const newPct = (Number(l.cumulPctNow) || 0) - (Number(l.cumulPctPrevious) || 0);
          const newAmount = (Number(l.totalHt) || 0) * (newPct / 100);
          insLine.run(
            generateId("sl"),
            id,
            l.poLineId || "",
            l.designation || "",
            Number(l.totalHt) || 0,
            Number(l.cumulPctPrevious) || 0,
            Number(l.cumulPctNow) || 0,
            newPct,
            +newAmount.toFixed(2),
            Number(l.vatRate) || 20,
            idx
          );
        });
      }

      recalcSituationTotals(id);
      return { success: true, id, reference };
    } catch (e) {
      console.error("[situations:create]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("situations:update", (_e, { id, data }) => {
    try {
      const allowed = ["situationDate", "paidDate", "status", "notes", "vaultDocumentId"];
      const keys = Object.keys(data).filter(k => allowed.includes(k));
      if (keys.length > 0) {
        const sets = keys.map(k => `${k} = @${k}`).join(", ");
        const payload = { id, updatedAt: nowIso() };
        for (const k of keys) payload[k] = data[k] !== undefined ? data[k] : "";
        db.prepare(`UPDATE situations SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);
      }
      if (Array.isArray(data.lines)) {
        db.prepare("DELETE FROM situation_lines WHERE situationId = ?").run(id);
        const insLine = db.prepare(`
          INSERT INTO situation_lines (
            id, situationId, poLineId, designation,
            totalHt, cumulPctPrevious, cumulPctNow, newPct, newAmountHt,
            vatRate, sortOrder
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.lines.forEach((l, idx) => {
          const newPct = (Number(l.cumulPctNow) || 0) - (Number(l.cumulPctPrevious) || 0);
          const newAmount = (Number(l.totalHt) || 0) * (newPct / 100);
          insLine.run(
            l.id || generateId("sl"),
            id,
            l.poLineId || "",
            l.designation || "",
            Number(l.totalHt) || 0,
            Number(l.cumulPctPrevious) || 0,
            Number(l.cumulPctNow) || 0,
            newPct,
            +newAmount.toFixed(2),
            Number(l.vatRate) || 20,
            idx
          );
        });
      }
      recalcSituationTotals(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("situations:delete", (_e, id) => {
    try {
      db.prepare("DELETE FROM situation_lines WHERE situationId = ?").run(id);
      db.prepare("DELETE FROM situations WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("situations:markPaid", (_e, { id, paidDate }) => {
    try {
      const today = paidDate || nowIso().slice(0, 10);
      db.prepare(`
        UPDATE situations SET status = 'payee', paidDate = ?, updatedAt = ?
        WHERE id = ?
      `).run(today, nowIso(), id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Helper pour le frontend : obtenir les % cumulés des situations PRÉCÉDENTES
  // pour pré-remplir une nouvelle situation
  ipcMain.handle("situations:getPreviousCumulPcts", (_e, purchaseOrderId) => {
    try {
      // Pour chaque ligne du BdC, somme des cumulPctNow des situations validees/payees précédentes
      const poLines = db.prepare("SELECT * FROM po_lines WHERE purchaseOrderId = ? ORDER BY sortOrder ASC")
        .all(purchaseOrderId);
      const result = {};
      for (const pol of poLines) {
        // Dernière situation pour cette ligne (validée ou payée)
        const last = db.prepare(`
          SELECT sl.cumulPctNow
          FROM situation_lines sl
          JOIN situations s ON s.id = sl.situationId
          WHERE sl.poLineId = ? AND s.status IN ('validee', 'payee')
          ORDER BY s.situationDate DESC, s.createdAt DESC
          LIMIT 1
        `).get(pol.id);
        result[pol.id] = last?.cumulPctNow || 0;
      }
      return result;
    } catch (e) {
      console.error("[situations:getPreviousCumulPcts]", e);
      return {};
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // STATS
  // ═════════════════════════════════════════════════════════════════════════

  ipcMain.handle("subcontractors:getStats", () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const totalActive = db.prepare("SELECT COUNT(*) as n FROM subcontractors WHERE isActive = 1").get().n || 0;
      const totalArchived = db.prepare("SELECT COUNT(*) as n FROM subcontractors WHERE isActive = 0").get().n || 0;

      const attestationsExpired = db.prepare(`
        SELECT COUNT(*) as n FROM st_attestations
        WHERE expirationDate != '' AND expirationDate < ?
      `).get(today).n || 0;

      const attestationsExpiringSoon = db.prepare(`
        SELECT COUNT(*) as n FROM st_attestations
        WHERE expirationDate != '' AND expirationDate >= ? AND expirationDate <= ?
      `).get(today, in30days).n || 0;

      const totalContractsAmount = db.prepare(`
        SELECT COALESCE(SUM(totalHt), 0) as t FROM purchase_orders
        WHERE status NOT IN ('annule', 'solde')
      `).get().t || 0;

      const pendingPayments = db.prepare(`
        SELECT COALESCE(SUM(netToPay), 0) as t FROM situations
        WHERE status = 'validee'
      `).get().t || 0;

      return {
        totalActive, totalArchived,
        attestationsExpired, attestationsExpiringSoon,
        totalContractsAmount, pendingPayments,
      };
    } catch (e) {
      return {
        totalActive: 0, totalArchived: 0,
        attestationsExpired: 0, attestationsExpiringSoon: 0,
        totalContractsAmount: 0, pendingPayments: 0,
      };
    }
  });

  ipcMain.handle("po:getStats", () => {
    try {
      const totalPos = db.prepare("SELECT COUNT(*) as n FROM purchase_orders").get().n || 0;
      const totalEnCours = db.prepare("SELECT COUNT(*) as n FROM purchase_orders WHERE status IN ('signe', 'en_cours')").get().n || 0;
      const totalAmount = db.prepare(`
        SELECT COALESCE(SUM(totalHt), 0) as t FROM purchase_orders
        WHERE status NOT IN ('annule', 'solde')
      `).get().t || 0;

      const today = new Date().toISOString().slice(0, 10);
      const pendingRetentions = db.prepare(`
        SELECT COALESCE(SUM(retentionAmount), 0) as t FROM purchase_orders
        WHERE retentionEnabled = 1 AND retentionReleased = 0
      `).get().t || 0;
      const expiredRetentions = db.prepare(`
        SELECT COALESCE(SUM(retentionAmount), 0) as t FROM purchase_orders
        WHERE retentionEnabled = 1 AND retentionReleased = 0
        AND retentionReleaseDate != '' AND retentionReleaseDate <= ?
      `).get(today).t || 0;

      return { totalPos, totalEnCours, totalAmount, pendingRetentions, expiredRetentions };
    } catch (e) {
      return { totalPos: 0, totalEnCours: 0, totalAmount: 0, pendingRetentions: 0, expiredRetentions: 0 };
    }
  });

  console.log("[subcontractors] Module initialisé");
}

module.exports = { init };
