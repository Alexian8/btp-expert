// ═══════════════════════════════════════════════════════════════════════════
// Routes REST pour la comptabilité partie double.
// Pendant des handlers IPC Electron (apps/desktop/electron/accounting.js).
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import type { DB as Pool, RowDataPacket } from "../db";
import {
  generateInvoiceEntry,
  generateExpenseEntry,
  generateInvoicePaymentEntry,
  generateExpensePaymentEntry,
  deleteEntriesForSource,
  regenerateAll,
  autoLettrerAll,
  autoLettrerAccount,
  ensureClientAccountNumber,
  ensureSupplierAccountNumber,
  getSettings,
} from "../accounting/engine";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildAccountingRouter(db: Pool): Router {
  const router = Router();

  // ─── Paramètres ────────────────────────────────────────────────────────

  router.get("/settings", async (_req, res) => {
    try {
      const s = await getSettings(db);
      res.json(s);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.patch("/settings", async (req, res) => {
    try {
      const allowed = [
        "mode",
        "exerciceStart",
        "fiscalYear",
        "lastLockedDate",
        "defaultVatRegime",
        "autoGenerateEntries",
      ];
      const body = req.body || {};
      const keys = Object.keys(body).filter((k) => allowed.includes(k));
      if (keys.length === 0) return res.json({ success: true });

      const updates: Record<string, unknown> = {};
      for (const k of keys) {
        updates[k] =
          k === "autoGenerateEntries" || k === "fiscalYear" ? Number(body[k]) : body[k];
      }
      if (body.mode) {
        const current = await getSettings(db);
        if (current && !current.modeChosenAt) {
          updates.modeChosenAt = new Date().toISOString();
        }
      }
      const setSql = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(", ");
      const values = Object.values(updates);
      await db.query(`UPDATE accounting_settings SET ${setSql} WHERE id = 1`, values);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  // ─── Plan comptable ────────────────────────────────────────────────────

  router.get("/accounts", async (req, res) => {
    try {
      let sql = "SELECT * FROM chart_of_accounts WHERE 1=1";
      const params: unknown[] = [];
      if (req.query.classe) {
        sql += " AND classe = ?";
        params.push(Number(req.query.classe));
      }
      if (req.query.search) {
        sql += " AND (numero LIKE ? OR libelle LIKE ?)";
        params.push(`${req.query.search}%`, `%${req.query.search}%`);
      }
      if (req.query.parentNumero) {
        sql += " AND parentNumero = ?";
        params.push(req.query.parentNumero);
      }
      sql += " ORDER BY numero ASC";
      const [rows] = await db.query<RowDataPacket[]>(sql, params);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get("/accounts/:numero", async (req, res) => {
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM chart_of_accounts WHERE numero = ?",
        [req.params.numero]
      );
      res.json(rows[0] || null);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post("/accounts", async (req, res) => {
    try {
      const data = req.body || {};
      const numero = String(data.numero || "").trim();
      if (!numero) return res.status(400).json({ success: false, error: "Numéro requis" });
      // Plages réservées aux auxiliaires
      if (numero.length === 6) {
        const isClient = numero.startsWith("411") && numero !== "411000" && numero !== "411999";
        const isSupp = numero.startsWith("401") && numero !== "401000" && numero !== "401999";
        if (isClient || isSupp) {
          const tier = isClient ? "clients" : "fournisseurs";
          return res.status(400).json({
            success: false,
            error: `La plage ${numero.slice(0, 3)}001-${numero.slice(0, 3)}998 est réservée aux auxiliaires ${tier}. Utilisez ${numero.slice(0, 3)}999 pour un compte divers.`,
          });
        }
      }
      const [ex] = await db.query<RowDataPacket[]>(
        "SELECT numero FROM chart_of_accounts WHERE numero = ?",
        [numero]
      );
      if (ex.length > 0) {
        return res.status(409).json({ success: false, error: "Ce numéro de compte existe déjà" });
      }
      await db.query(
        `INSERT INTO chart_of_accounts (numero, libelle, classe, type, nature, parentNumero, isAuxiliary, isLocked)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          numero,
          data.libelle || "",
          Number(data.classe) || 0,
          data.type || "neutre",
          data.nature || "detail",
          data.parentNumero || "",
          Number(data.isAuxiliary) || 0,
        ]
      );
      res.json({ success: true, numero });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  router.patch("/accounts/:numero", async (req, res) => {
    try {
      const allowed = ["libelle", "classe", "type", "nature", "parentNumero"];
      const body = req.body || {};
      const keys = Object.keys(body).filter((k) => allowed.includes(k));
      if (keys.length === 0) return res.json({ success: true });
      const sets = keys.map((k) => `\`${k}\` = ?`).join(", ");
      const values = keys.map((k) => (k === "classe" ? Number(body[k]) : body[k]));
      await db.query(
        `UPDATE chart_of_accounts SET ${sets} WHERE numero = ? AND isLocked = 0`,
        [...values, req.params.numero]
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  router.delete("/accounts/:numero", async (req, res) => {
    try {
      const [accRows] = await db.query<RowDataPacket[]>(
        "SELECT isLocked FROM chart_of_accounts WHERE numero = ?",
        [req.params.numero]
      );
      const acc = accRows[0] as { isLocked: number } | undefined;
      if (!acc) return res.status(404).json({ success: false, error: "Compte introuvable" });
      if (acc.isLocked) return res.status(403).json({ success: false, error: "Compte verrouillé" });
      const [used] = await db.query<RowDataPacket[]>(
        "SELECT 1 FROM journal_lines WHERE compteNum = ? LIMIT 1",
        [req.params.numero]
      );
      if (used.length > 0) {
        return res.status(409).json({ success: false, error: "Compte utilisé par des écritures" });
      }
      await db.query("DELETE FROM chart_of_accounts WHERE numero = ?", [req.params.numero]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  // ─── Journaux ──────────────────────────────────────────────────────────

  router.get("/journals", async (_req, res) => {
    try {
      const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM journals ORDER BY code");
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ─── Écritures (livre journal) ─────────────────────────────────────────

  router.get("/entries", async (req, res) => {
    try {
      let sql = `
        SELECT je.*, j.libelle AS journalLibelle
        FROM journal_entries je
        LEFT JOIN journals j ON j.code = je.journalCode
        WHERE 1=1
      `;
      const params: unknown[] = [];
      if (req.query.journalCode) {
        sql += " AND je.journalCode = ?";
        params.push(req.query.journalCode);
      }
      if (req.query.year) {
        sql += " AND je.exerciceYear = ?";
        params.push(Number(req.query.year));
      }
      if (req.query.dateFrom) {
        sql += " AND je.`date` >= ?";
        params.push(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        sql += " AND je.`date` <= ?";
        params.push(req.query.dateTo);
      }
      if (req.query.search) {
        sql += " AND (je.libelle LIKE ? OR je.pieceRef LIKE ?)";
        params.push(`%${req.query.search}%`, `%${req.query.search}%`);
      }
      sql += " ORDER BY je.`date` ASC, je.numero ASC";
      if (req.query.limit) {
        sql += " LIMIT ?";
        params.push(Number(req.query.limit));
      }
      const [entries] = await db.query<RowDataPacket[]>(sql, params);
      // Charger les lignes pour chaque écriture
      const ids = (entries as { id: string }[]).map((e) => e.id);
      let allLines: RowDataPacket[] = [];
      if (ids.length > 0) {
        const placeholders = ids.map(() => "?").join(",");
        const [lineRows] = await db.query<RowDataPacket[]>(
          `SELECT * FROM journal_lines WHERE entryId IN (${placeholders}) ORDER BY entryId, ordre`,
          ids
        );
        allLines = lineRows;
      }
      const linesByEntry: Record<string, RowDataPacket[]> = {};
      for (const l of allLines) {
        const id = (l as { entryId: string }).entryId;
        if (!linesByEntry[id]) linesByEntry[id] = [];
        linesByEntry[id].push(l);
      }
      const result = entries.map((e: RowDataPacket) => ({
        ...(e as Record<string, unknown>),
        lines: linesByEntry[(e as { id: string }).id] || [],
      }));
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get("/entries/:id", async (req, res) => {
    try {
      const [eRows] = await db.query<RowDataPacket[]>(
        `SELECT je.*, j.libelle AS journalLibelle
         FROM journal_entries je LEFT JOIN journals j ON j.code = je.journalCode
         WHERE je.id = ?`,
        [req.params.id]
      );
      if (eRows.length === 0) return res.json(null);
      const [lines] = await db.query<RowDataPacket[]>(
        "SELECT * FROM journal_lines WHERE entryId = ? ORDER BY ordre",
        [req.params.id]
      );
      res.json({ ...(eRows[0] as Record<string, unknown>), lines });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post("/entries", async (req, res) => {
    try {
      const data = req.body || {};
      if (!data.journalCode) return res.status(400).json({ success: false, error: "Journal requis" });
      if (!Array.isArray(data.lines) || data.lines.length < 2) {
        return res.status(400).json({ success: false, error: "Au moins 2 lignes requises" });
      }
      const totalDebit = data.lines.reduce(
        (s: number, l: { debit?: number }) => s + (Number(l.debit) || 0),
        0
      );
      const totalCredit = data.lines.reduce(
        (s: number, l: { credit?: number }) => s + (Number(l.credit) || 0),
        0
      );
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return res.status(400).json({ success: false, error: "Écriture déséquilibrée" });
      }
      const id = genId("je");
      const date = data.date || new Date().toISOString().slice(0, 10);
      const year = parseInt(date.slice(0, 4), 10);
      const [nRows] = await db.query<RowDataPacket[]>(
        `SELECT COALESCE(MAX(numero), 0) + 1 AS n
         FROM journal_entries WHERE journalCode = ? AND exerciceYear = ?`,
        [data.journalCode, year]
      );
      const numero = Number((nRows[0] as { n: number }).n) || 1;

      await db.query(
        `INSERT INTO journal_entries
          (id, journalCode, numero, \`date\`, dateValidation, libelle, pieceRef, pieceDate,
           sourceType, sourceId, exerciceYear, isLocked, isReversed, reversedById)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', '', ?, 0, 0, '')`,
        [
          id,
          data.journalCode,
          numero,
          date,
          date,
          data.libelle || "",
          data.pieceRef || "",
          data.pieceDate || date,
          year,
        ]
      );
      let ordre = 0;
      for (const l of data.lines) {
        await db.query(
          `INSERT INTO journal_lines
            (id, entryId, compteNum, compAuxNum, compAuxLib, libelle, debit, credit, lettrage, dateLettrage, ordre)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', ?)`,
          [
            genId("jl"),
            id,
            l.compteNum || "",
            l.compAuxNum || "",
            l.compAuxLib || "",
            l.libelle || data.libelle || "",
            round2(Number(l.debit) || 0),
            round2(Number(l.credit) || 0),
            ordre++,
          ]
        );
      }
      res.json({ success: true, id, numero });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  router.delete("/entries/:id", async (req, res) => {
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT isLocked, sourceType FROM journal_entries WHERE id = ?",
        [req.params.id]
      );
      const e = rows[0] as { isLocked: number; sourceType: string } | undefined;
      if (!e) return res.status(404).json({ success: false, error: "Écriture introuvable" });
      if (e.isLocked) return res.status(403).json({ success: false, error: "Écriture verrouillée" });
      if (e.sourceType !== "manual") {
        return res
          .status(403)
          .json({ success: false, error: "Écriture auto — modifier la source" });
      }
      await db.query("DELETE FROM journal_entries WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // ─── Régénération massive ──────────────────────────────────────────────

  router.post("/regenerate", async (_req, res) => {
    try {
      const result = await regenerateAll(db);
      try {
        await autoLettrerAll(db);
      } catch {}
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  // ─── Lettrage ──────────────────────────────────────────────────────────

  router.post("/lettrer", async (req, res) => {
    try {
      const compteAuxNum = (req.body || {}).compteAuxNum;
      if (compteAuxNum) await autoLettrerAccount(db, compteAuxNum);
      else await autoLettrerAll(db);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  router.post("/set-lettrage", async (req, res) => {
    try {
      const { lineIds, code } = req.body || {};
      if (!Array.isArray(lineIds) || lineIds.length === 0) {
        return res.status(400).json({ success: false, error: "Aucune ligne" });
      }
      const today = new Date().toISOString().slice(0, 10);
      for (const id of lineIds) {
        if (code) {
          await db.query(
            "UPDATE journal_lines SET lettrage = ?, dateLettrage = ? WHERE id = ?",
            [code, today, id]
          );
        } else {
          await db.query(
            "UPDATE journal_lines SET lettrage = '', dateLettrage = '' WHERE id = ?",
            [id]
          );
        }
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  // ─── Vues : grand livre, balance, P&L, bilan ──────────────────────────

  router.get("/grand-livre/:compteNum", async (req, res) => {
    try {
      const compteNum = req.params.compteNum;
      let sql = `
        SELECT jl.*, je.journalCode, je.numero AS entryNumero, je.\`date\`, je.pieceRef,
               je.libelle AS entryLibelle
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entryId
        WHERE jl.compteNum = ?
      `;
      const params: unknown[] = [compteNum];
      if (req.query.year) {
        sql += " AND je.exerciceYear = ?";
        params.push(Number(req.query.year));
      }
      if (req.query.dateFrom) {
        sql += " AND je.`date` >= ?";
        params.push(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        sql += " AND je.`date` <= ?";
        params.push(req.query.dateTo);
      }
      sql += " ORDER BY je.`date` ASC, je.numero ASC, jl.ordre ASC";
      const [lines] = await db.query<RowDataPacket[]>(sql, params);
      let sDeb = 0;
      let sCre = 0;
      const enriched = lines.map((l: RowDataPacket) => {
        const ll = l as { debit: number; credit: number } & Record<string, unknown>;
        sDeb += Number(ll.debit);
        sCre += Number(ll.credit);
        return { ...ll, soldeProgressif: round2(sDeb - sCre) };
      });
      res.json({
        compteNum,
        lines: enriched,
        totals: { debit: round2(sDeb), credit: round2(sCre), solde: round2(sDeb - sCre) },
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get("/balance", async (req, res) => {
    try {
      let sql = `
        SELECT jl.compteNum, jl.compAuxNum, jl.compAuxLib,
               coa.libelle AS compteLibelle, coa.classe, coa.type, coa.nature,
               SUM(jl.debit) AS totalDebit, SUM(jl.credit) AS totalCredit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entryId
        LEFT JOIN chart_of_accounts coa ON coa.numero = jl.compteNum
        WHERE 1=1
      `;
      const params: unknown[] = [];
      if (req.query.year) {
        sql += " AND je.exerciceYear = ?";
        params.push(Number(req.query.year));
      }
      if (req.query.dateFrom) {
        sql += " AND je.`date` >= ?";
        params.push(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        sql += " AND je.`date` <= ?";
        params.push(req.query.dateTo);
      }
      sql += " GROUP BY jl.compteNum, jl.compAuxNum ORDER BY jl.compteNum";
      const [rows] = await db.query<RowDataPacket[]>(sql, params);
      const result = rows.map((r: RowDataPacket) => {
        const rr = r as { totalDebit: number; totalCredit: number } & Record<string, unknown>;
        const td = Number(rr.totalDebit) || 0;
        const tc = Number(rr.totalCredit) || 0;
        return { ...rr, totalDebit: round2(td), totalCredit: round2(tc), solde: round2(td - tc) };
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get("/income-statement", async (req, res) => {
    try {
      let sql = `
        SELECT jl.compteNum, coa.libelle, coa.classe,
               SUM(jl.debit) AS totalDebit, SUM(jl.credit) AS totalCredit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entryId
        LEFT JOIN chart_of_accounts coa ON coa.numero = jl.compteNum
        WHERE coa.classe IN (6, 7)
      `;
      const params: unknown[] = [];
      if (req.query.year) {
        sql += " AND je.exerciceYear = ?";
        params.push(Number(req.query.year));
      }
      if (req.query.dateFrom) {
        sql += " AND je.`date` >= ?";
        params.push(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        sql += " AND je.`date` <= ?";
        params.push(req.query.dateTo);
      }
      sql += " GROUP BY jl.compteNum ORDER BY jl.compteNum";
      const [rows] = await db.query<RowDataPacket[]>(sql, params);
      const charges: { compteNum: string; libelle: string; montant: number }[] = [];
      const produits: { compteNum: string; libelle: string; montant: number }[] = [];
      let tCh = 0;
      let tPr = 0;
      for (const r of rows) {
        const rr = r as { compteNum: string; libelle: string; classe: number; totalDebit: number; totalCredit: number };
        const d = round2(Number(rr.totalDebit));
        const c = round2(Number(rr.totalCredit));
        if (rr.classe === 6) {
          const m = d - c;
          charges.push({ compteNum: rr.compteNum, libelle: rr.libelle, montant: m });
          tCh += m;
        } else if (rr.classe === 7) {
          const m = c - d;
          produits.push({ compteNum: rr.compteNum, libelle: rr.libelle, montant: m });
          tPr += m;
        }
      }
      res.json({
        charges,
        produits,
        totalCharges: round2(tCh),
        totalProduits: round2(tPr),
        resultat: round2(tPr - tCh),
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get("/balance-sheet", async (req, res) => {
    try {
      let sql = `
        SELECT jl.compteNum, coa.libelle, coa.classe, coa.type, coa.nature,
               SUM(jl.debit) AS totalDebit, SUM(jl.credit) AS totalCredit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entryId
        LEFT JOIN chart_of_accounts coa ON coa.numero = jl.compteNum
        WHERE coa.classe IN (1, 2, 3, 4, 5)
      `;
      const params: unknown[] = [];
      if (req.query.year) {
        sql += " AND je.exerciceYear <= ?";
        params.push(Number(req.query.year));
      }
      if (req.query.asOfDate) {
        sql += " AND je.`date` <= ?";
        params.push(req.query.asOfDate);
      }
      sql += " GROUP BY jl.compteNum ORDER BY jl.compteNum";
      const [rows] = await db.query<RowDataPacket[]>(sql, params);

      let resSql = `
        SELECT coa.classe, SUM(jl.debit) AS totalDebit, SUM(jl.credit) AS totalCredit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entryId
        LEFT JOIN chart_of_accounts coa ON coa.numero = jl.compteNum
        WHERE coa.classe IN (6, 7)
      `;
      const resParams: unknown[] = [];
      if (req.query.year) {
        resSql += " AND je.exerciceYear = ?";
        resParams.push(Number(req.query.year));
      }
      if (req.query.asOfDate) {
        resSql += " AND je.`date` <= ?";
        resParams.push(req.query.asOfDate);
      }
      resSql += " GROUP BY coa.classe";
      const [resRows] = await db.query<RowDataPacket[]>(resSql, resParams);
      let tCh = 0;
      let tPr = 0;
      for (const r of resRows) {
        const rr = r as { classe: number; totalDebit: number; totalCredit: number };
        if (rr.classe === 6) tCh = Number(rr.totalDebit) - Number(rr.totalCredit);
        if (rr.classe === 7) tPr = Number(rr.totalCredit) - Number(rr.totalDebit);
      }
      const resultat = round2(tPr - tCh);

      const actif: { compteNum: string; libelle: string; classe: number; montant: number }[] = [];
      const passif: { compteNum: string; libelle: string; classe: number; montant: number }[] = [];
      let tA = 0;
      let tP = 0;
      for (const r of rows) {
        const rr = r as { compteNum: string; libelle: string; classe: number; type?: string; totalDebit: number; totalCredit: number };
        const d = Number(rr.totalDebit) || 0;
        const c = Number(rr.totalCredit) || 0;
        const solde = round2(d - c);
        if (solde === 0) continue;
        const item = { compteNum: rr.compteNum, libelle: rr.libelle, classe: rr.classe, montant: Math.abs(solde) };
        if (rr.type === "actif" || (rr.type !== "passif" && solde > 0)) {
          actif.push(item);
          tA += Math.abs(solde);
        } else {
          passif.push(item);
          tP += Math.abs(solde);
        }
      }
      if (resultat !== 0) {
        passif.push({
          compteNum: resultat >= 0 ? "120000" : "129000",
          libelle: resultat >= 0 ? "Résultat de l'exercice (bénéfice)" : "Résultat de l'exercice (perte)",
          classe: 1,
          montant: Math.abs(resultat),
        });
        if (resultat >= 0) tP += resultat;
        else tA += Math.abs(resultat);
      }
      res.json({
        actif,
        passif,
        totalActif: round2(tA),
        totalPassif: round2(tP),
        resultat,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ─── Comptes auxiliaires (création à la volée) ─────────────────────────

  router.post("/ensure-client-account/:clientId", async (req, res) => {
    try {
      const numero = await ensureClientAccountNumber(db, req.params.clientId);
      res.json({ success: true, numero });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  router.post("/ensure-supplier-account/:supplierId", async (req, res) => {
    try {
      const numero = await ensureSupplierAccountNumber(db, req.params.supplierId);
      res.json({ success: true, numero });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  return router;
}

// ─── Hooks : appelés depuis les routes invoices/expenses pour
//   générer/mettre à jour les écritures automatiquement.
// ───────────────────────────────────────────────────────────────────────────

export const accountingHooks = {
  generateInvoiceEntry,
  generateExpenseEntry,
  generateInvoicePaymentEntry,
  generateExpensePaymentEntry,
  deleteEntriesForSource,
};
