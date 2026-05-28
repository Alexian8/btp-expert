"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Routes REST pour la comptabilité partie double.
// Pendant des handlers IPC Electron (apps/desktop/electron/accounting.js).
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountingHooks = void 0;
exports.buildAccountingRouter = buildAccountingRouter;
const express_1 = require("express");
const engine_1 = require("../accounting/engine");
function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}
function genId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function buildAccountingRouter(db) {
    const router = (0, express_1.Router)();
    // ─── Paramètres ────────────────────────────────────────────────────────
    router.get("/settings", async (_req, res) => {
        try {
            const s = await (0, engine_1.getSettings)(db);
            res.json(s);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
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
            if (keys.length === 0)
                return res.json({ success: true });
            const updates = {};
            for (const k of keys) {
                updates[k] =
                    k === "autoGenerateEntries" || k === "fiscalYear" ? Number(body[k]) : body[k];
            }
            if (body.mode) {
                const current = await (0, engine_1.getSettings)(db);
                if (current && !current.modeChosenAt) {
                    updates.modeChosenAt = new Date().toISOString();
                }
            }
            const setSql = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(", ");
            const values = Object.values(updates);
            await db.query(`UPDATE accounting_settings SET ${setSql} WHERE id = 1`, values);
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    // ─── Plan comptable ────────────────────────────────────────────────────
    router.get("/accounts", async (req, res) => {
        try {
            let sql = "SELECT * FROM chart_of_accounts WHERE 1=1";
            const params = [];
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
            const [rows] = await db.query(sql, params);
            res.json(rows);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.get("/accounts/:numero", async (req, res) => {
        try {
            const [rows] = await db.query("SELECT * FROM chart_of_accounts WHERE numero = ?", [req.params.numero]);
            res.json(rows[0] || null);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post("/accounts", async (req, res) => {
        try {
            const data = req.body || {};
            const numero = String(data.numero || "").trim();
            if (!numero)
                return res.status(400).json({ success: false, error: "Numéro requis" });
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
            const [ex] = await db.query("SELECT numero FROM chart_of_accounts WHERE numero = ?", [numero]);
            if (ex.length > 0) {
                return res.status(409).json({ success: false, error: "Ce numéro de compte existe déjà" });
            }
            await db.query(`INSERT INTO chart_of_accounts (numero, libelle, classe, type, nature, parentNumero, isAuxiliary, isLocked)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`, [
                numero,
                data.libelle || "",
                Number(data.classe) || 0,
                data.type || "neutre",
                data.nature || "detail",
                data.parentNumero || "",
                Number(data.isAuxiliary) || 0,
            ]);
            res.json({ success: true, numero });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    router.patch("/accounts/:numero", async (req, res) => {
        try {
            const allowed = ["libelle", "classe", "type", "nature", "parentNumero"];
            const body = req.body || {};
            const keys = Object.keys(body).filter((k) => allowed.includes(k));
            if (keys.length === 0)
                return res.json({ success: true });
            const sets = keys.map((k) => `\`${k}\` = ?`).join(", ");
            const values = keys.map((k) => (k === "classe" ? Number(body[k]) : body[k]));
            await db.query(`UPDATE chart_of_accounts SET ${sets} WHERE numero = ? AND isLocked = 0`, [...values, req.params.numero]);
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    router.delete("/accounts/:numero", async (req, res) => {
        try {
            const [accRows] = await db.query("SELECT isLocked FROM chart_of_accounts WHERE numero = ?", [req.params.numero]);
            const acc = accRows[0];
            if (!acc)
                return res.status(404).json({ success: false, error: "Compte introuvable" });
            if (acc.isLocked)
                return res.status(403).json({ success: false, error: "Compte verrouillé" });
            const [used] = await db.query("SELECT 1 FROM journal_lines WHERE compteNum = ? LIMIT 1", [req.params.numero]);
            if (used.length > 0) {
                return res.status(409).json({ success: false, error: "Compte utilisé par des écritures" });
            }
            await db.query("DELETE FROM chart_of_accounts WHERE numero = ?", [req.params.numero]);
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    // ─── Journaux ──────────────────────────────────────────────────────────
    router.get("/journals", async (_req, res) => {
        try {
            const [rows] = await db.query("SELECT * FROM journals ORDER BY code");
            res.json(rows);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
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
            const params = [];
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
            const [entries] = await db.query(sql, params);
            // Charger les lignes pour chaque écriture
            const ids = entries.map((e) => e.id);
            let allLines = [];
            if (ids.length > 0) {
                const placeholders = ids.map(() => "?").join(",");
                const [lineRows] = await db.query(`SELECT * FROM journal_lines WHERE entryId IN (${placeholders}) ORDER BY entryId, ordre`, ids);
                allLines = lineRows;
            }
            const linesByEntry = {};
            for (const l of allLines) {
                const id = l.entryId;
                if (!linesByEntry[id])
                    linesByEntry[id] = [];
                linesByEntry[id].push(l);
            }
            const result = entries.map((e) => ({
                ...e,
                lines: linesByEntry[e.id] || [],
            }));
            res.json(result);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.get("/entries/:id", async (req, res) => {
        try {
            const [eRows] = await db.query(`SELECT je.*, j.libelle AS journalLibelle
         FROM journal_entries je LEFT JOIN journals j ON j.code = je.journalCode
         WHERE je.id = ?`, [req.params.id]);
            if (eRows.length === 0)
                return res.json(null);
            const [lines] = await db.query("SELECT * FROM journal_lines WHERE entryId = ? ORDER BY ordre", [req.params.id]);
            res.json({ ...eRows[0], lines });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post("/entries", async (req, res) => {
        try {
            const data = req.body || {};
            if (!data.journalCode)
                return res.status(400).json({ success: false, error: "Journal requis" });
            if (!Array.isArray(data.lines) || data.lines.length < 2) {
                return res.status(400).json({ success: false, error: "Au moins 2 lignes requises" });
            }
            const totalDebit = data.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
            const totalCredit = data.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                return res.status(400).json({ success: false, error: "Écriture déséquilibrée" });
            }
            const id = genId("je");
            const date = data.date || new Date().toISOString().slice(0, 10);
            const year = parseInt(date.slice(0, 4), 10);
            const [nRows] = await db.query(`SELECT COALESCE(MAX(numero), 0) + 1 AS n
         FROM journal_entries WHERE journalCode = ? AND exerciceYear = ?`, [data.journalCode, year]);
            const numero = Number(nRows[0].n) || 1;
            await db.query(`INSERT INTO journal_entries
          (id, journalCode, numero, \`date\`, dateValidation, libelle, pieceRef, pieceDate,
           sourceType, sourceId, exerciceYear, isLocked, isReversed, reversedById)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', '', ?, 0, 0, '')`, [
                id,
                data.journalCode,
                numero,
                date,
                date,
                data.libelle || "",
                data.pieceRef || "",
                data.pieceDate || date,
                year,
            ]);
            let ordre = 0;
            for (const l of data.lines) {
                await db.query(`INSERT INTO journal_lines
            (id, entryId, compteNum, compAuxNum, compAuxLib, libelle, debit, credit, lettrage, dateLettrage, ordre)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', ?)`, [
                    genId("jl"),
                    id,
                    l.compteNum || "",
                    l.compAuxNum || "",
                    l.compAuxLib || "",
                    l.libelle || data.libelle || "",
                    round2(Number(l.debit) || 0),
                    round2(Number(l.credit) || 0),
                    ordre++,
                ]);
            }
            res.json({ success: true, id, numero });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    router.delete("/entries/:id", async (req, res) => {
        try {
            const [rows] = await db.query("SELECT isLocked, sourceType FROM journal_entries WHERE id = ?", [req.params.id]);
            const e = rows[0];
            if (!e)
                return res.status(404).json({ success: false, error: "Écriture introuvable" });
            if (e.isLocked)
                return res.status(403).json({ success: false, error: "Écriture verrouillée" });
            if (e.sourceType !== "manual") {
                return res
                    .status(403)
                    .json({ success: false, error: "Écriture auto — modifier la source" });
            }
            await db.query("DELETE FROM journal_entries WHERE id = ?", [req.params.id]);
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // ─── Régénération massive ──────────────────────────────────────────────
    router.post("/regenerate", async (_req, res) => {
        try {
            const result = await (0, engine_1.regenerateAll)(db);
            try {
                await (0, engine_1.autoLettrerAll)(db);
            }
            catch { }
            res.json(result);
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    // ─── Lettrage ──────────────────────────────────────────────────────────
    router.post("/lettrer", async (req, res) => {
        try {
            const compteAuxNum = (req.body || {}).compteAuxNum;
            if (compteAuxNum)
                await (0, engine_1.autoLettrerAccount)(db, compteAuxNum);
            else
                await (0, engine_1.autoLettrerAll)(db);
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
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
                    await db.query("UPDATE journal_lines SET lettrage = ?, dateLettrage = ? WHERE id = ?", [code, today, id]);
                }
                else {
                    await db.query("UPDATE journal_lines SET lettrage = '', dateLettrage = '' WHERE id = ?", [id]);
                }
            }
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
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
            const params = [compteNum];
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
            const [lines] = await db.query(sql, params);
            let sDeb = 0;
            let sCre = 0;
            const enriched = lines.map((l) => {
                const ll = l;
                sDeb += Number(ll.debit);
                sCre += Number(ll.credit);
                return { ...ll, soldeProgressif: round2(sDeb - sCre) };
            });
            res.json({
                compteNum,
                lines: enriched,
                totals: { debit: round2(sDeb), credit: round2(sCre), solde: round2(sDeb - sCre) },
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
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
            const params = [];
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
            const [rows] = await db.query(sql, params);
            const result = rows.map((r) => {
                const rr = r;
                const td = Number(rr.totalDebit) || 0;
                const tc = Number(rr.totalCredit) || 0;
                return { ...rr, totalDebit: round2(td), totalCredit: round2(tc), solde: round2(td - tc) };
            });
            res.json(result);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
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
            const params = [];
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
            const [rows] = await db.query(sql, params);
            const charges = [];
            const produits = [];
            let tCh = 0;
            let tPr = 0;
            for (const r of rows) {
                const rr = r;
                const d = round2(Number(rr.totalDebit));
                const c = round2(Number(rr.totalCredit));
                if (rr.classe === 6) {
                    const m = d - c;
                    charges.push({ compteNum: rr.compteNum, libelle: rr.libelle, montant: m });
                    tCh += m;
                }
                else if (rr.classe === 7) {
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
        }
        catch (e) {
            res.status(500).json({ error: e.message });
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
            const params = [];
            if (req.query.year) {
                sql += " AND je.exerciceYear <= ?";
                params.push(Number(req.query.year));
            }
            if (req.query.asOfDate) {
                sql += " AND je.`date` <= ?";
                params.push(req.query.asOfDate);
            }
            sql += " GROUP BY jl.compteNum ORDER BY jl.compteNum";
            const [rows] = await db.query(sql, params);
            let resSql = `
        SELECT coa.classe, SUM(jl.debit) AS totalDebit, SUM(jl.credit) AS totalCredit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entryId
        LEFT JOIN chart_of_accounts coa ON coa.numero = jl.compteNum
        WHERE coa.classe IN (6, 7)
      `;
            const resParams = [];
            // Résultat cumulé (exerciceYear <= year) pour garantir l'équilibre du
            // bilan tant qu'aucune clôture n'a soldé les comptes 6/7 antérieurs.
            if (req.query.year) {
                resSql += " AND je.exerciceYear <= ?";
                resParams.push(Number(req.query.year));
            }
            if (req.query.asOfDate) {
                resSql += " AND je.`date` <= ?";
                resParams.push(req.query.asOfDate);
            }
            resSql += " GROUP BY coa.classe";
            const [resRows] = await db.query(resSql, resParams);
            let tCh = 0;
            let tPr = 0;
            for (const r of resRows) {
                const rr = r;
                if (rr.classe === 6)
                    tCh = Number(rr.totalDebit) - Number(rr.totalCredit);
                if (rr.classe === 7)
                    tPr = Number(rr.totalCredit) - Number(rr.totalDebit);
            }
            const resultat = round2(tPr - tCh);
            const actif = [];
            const passif = [];
            let tA = 0;
            let tP = 0;
            for (const r of rows) {
                const rr = r;
                const d = Number(rr.totalDebit) || 0;
                const c = Number(rr.totalCredit) || 0;
                const solde = round2(d - c);
                if (solde === 0)
                    continue;
                const item = { compteNum: rr.compteNum, libelle: rr.libelle, classe: rr.classe, montant: Math.abs(solde) };
                if (rr.type === "actif" || (rr.type !== "passif" && solde > 0)) {
                    actif.push(item);
                    tA += Math.abs(solde);
                }
                else {
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
                if (resultat >= 0)
                    tP += resultat;
                else
                    tA += Math.abs(resultat);
            }
            res.json({
                actif,
                passif,
                totalActif: round2(tA),
                totalPassif: round2(tP),
                resultat,
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ─── Rapport TVA ───────────────────────────────────────────────────────
    // GET /api/accounting/vat-report?period=YYYY-MM | YYYY-Qn | YYYY
    // Calcule TVA collectée (445710), TVA déductible (445660 + 445620) sur
    // la période, et la TVA à décaisser (différence). Inclut détail par
    // taux (heuristique : ratio TVA/base sur les écritures de classe 7).
    router.get("/vat-report", async (req, res) => {
        try {
            const period = String(req.query.period || "");
            let dateFrom = "";
            let dateTo = "";
            const year = parseInt(period.slice(0, 4), 10) || new Date().getFullYear();
            if (/^\d{4}$/.test(period)) {
                // Année entière
                dateFrom = `${year}-01-01`;
                dateTo = `${year}-12-31`;
            }
            else if (/^\d{4}-\d{2}$/.test(period)) {
                // Mois
                const mm = period.slice(5, 7);
                const lastDay = new Date(year, parseInt(mm, 10), 0).getDate();
                dateFrom = `${year}-${mm}-01`;
                dateTo = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
            }
            else if (/^\d{4}-Q[1-4]$/.test(period)) {
                // Trimestre
                const q = parseInt(period.slice(6), 10);
                const fromMonth = (q - 1) * 3 + 1;
                const toMonth = fromMonth + 2;
                const lastDay = new Date(year, toMonth, 0).getDate();
                dateFrom = `${year}-${String(fromMonth).padStart(2, "0")}-01`;
                dateTo = `${year}-${String(toMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
            }
            else {
                return res.status(400).json({ error: "Format période invalide (YYYY, YYYY-MM ou YYYY-Qn)" });
            }
            // Somme des comptes TVA sur la période
            const sumCompte = async (compte) => {
                const [rows] = await db.query(`SELECT COALESCE(SUM(jl.debit), 0) AS d, COALESCE(SUM(jl.credit), 0) AS c
           FROM journal_lines jl
           JOIN journal_entries je ON je.id = jl.entryId
           WHERE jl.compteNum = ? AND je.\`date\` >= ? AND je.\`date\` <= ?`, [compte, dateFrom, dateTo]);
                const r = rows[0];
                return { debit: Number(r.d) || 0, credit: Number(r.c) || 0 };
            };
            const collectee = await sumCompte("445710"); // crédit = TVA due
            const deductibleBiens = await sumCompte("445660"); // débit = TVA récupérable
            const deductibleImmo = await sumCompte("445620");
            const tvaCollectee = Math.max(0, collectee.credit - collectee.debit);
            const tvaDeductibleBiens = Math.max(0, deductibleBiens.debit - deductibleBiens.credit);
            const tvaDeductibleImmo = Math.max(0, deductibleImmo.debit - deductibleImmo.credit);
            const tvaDeductible = tvaDeductibleBiens + tvaDeductibleImmo;
            const tvaADecaisser = tvaCollectee - tvaDeductible;
            // Détail par taux (heuristique : pour chaque écriture VE, on regarde
            // la ligne 445710 et la ligne 706xxx pour calculer le taux)
            const [byRateRows] = await db.query(`SELECT je.id AS entryId, je.date,
                MAX(CASE WHEN jl.compteNum = '445710' THEN jl.credit - jl.debit END) AS tva,
                MAX(CASE WHEN jl.compteNum LIKE '70%' THEN jl.credit - jl.debit END) AS base
         FROM journal_entries je
         JOIN journal_lines jl ON jl.entryId = je.id
         WHERE je.journalCode IN ('VE', 'BQ') AND je.\`date\` >= ? AND je.\`date\` <= ?
         GROUP BY je.id, je.date
         HAVING tva IS NOT NULL AND base IS NOT NULL AND base > 0`, [dateFrom, dateTo]);
            const byRate = {};
            for (const r of byRateRows) {
                const rr = r;
                const tva = Number(rr.tva) || 0;
                const base = Number(rr.base) || 0;
                if (base <= 0)
                    continue;
                const rateRaw = Math.round((tva / base) * 100 * 10) / 10;
                const rateKey = Math.abs(rateRaw - 20) < 0.5 ? "20" :
                    Math.abs(rateRaw - 10) < 0.5 ? "10" :
                        Math.abs(rateRaw - 5.5) < 0.5 ? "5.5" :
                            Math.abs(rateRaw - 2.1) < 0.5 ? "2.1" :
                                String(rateRaw);
                if (!byRate[rateKey])
                    byRate[rateKey] = { base: 0, tva: 0 };
                byRate[rateKey].base += base;
                byRate[rateKey].tva += tva;
            }
            const byRateArr = Object.keys(byRate)
                .sort((a, b) => Number(b) - Number(a))
                .map((rate) => ({
                rate,
                base: Math.round(byRate[rate].base * 100) / 100,
                tva: Math.round(byRate[rate].tva * 100) / 100,
            }));
            res.json({
                period,
                dateFrom,
                dateTo,
                tvaCollectee: Math.round(tvaCollectee * 100) / 100,
                tvaDeductibleBiens: Math.round(tvaDeductibleBiens * 100) / 100,
                tvaDeductibleImmo: Math.round(tvaDeductibleImmo * 100) / 100,
                tvaDeductible: Math.round(tvaDeductible * 100) / 100,
                tvaADecaisser: Math.round(tvaADecaisser * 100) / 100,
                creditTvaAReporter: tvaADecaisser < 0 ? Math.abs(Math.round(tvaADecaisser * 100) / 100) : 0,
                byRate: byRateArr,
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ─── Comptes auxiliaires (création à la volée) ─────────────────────────
    router.post("/ensure-client-account/:clientId", async (req, res) => {
        try {
            const numero = await (0, engine_1.ensureClientAccountNumber)(db, req.params.clientId);
            res.json({ success: true, numero });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    router.post("/ensure-supplier-account/:supplierId", async (req, res) => {
        try {
            const numero = await (0, engine_1.ensureSupplierAccountNumber)(db, req.params.supplierId);
            res.json({ success: true, numero });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    // ─── Export FEC (Fichier des Écritures Comptables) ────────────────────
    // Format normalisé DGFIP : 18 colonnes tab-séparées, UTF-8 BOM, CRLF.
    // Réf : article A47 A-1 du LPF.
    router.get("/export-fec", async (req, res) => {
        try {
            const year = Number(req.query.year) || new Date().getFullYear();
            const yearStr = String(year);
            // Récupère SIREN de la company
            const [companyRows] = await db.query("SELECT data FROM company WHERE id = 1");
            let companyData = {};
            try {
                const raw = companyRows[0]?.data;
                companyData = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
            }
            catch { }
            const siren = (companyData.siret || "").replace(/\s/g, "").slice(0, 9) || "999999999";
            const headers = [
                "JournalCode", "JournalLib", "EcritureNum", "EcritureDate",
                "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib",
                "PieceRef", "PieceDate", "EcritureLib",
                "Debit", "Credit", "EcritureLet", "DateLet",
                "ValidDate", "Montantdevise", "Idevise",
            ];
            const lines = [headers.join("\t")];
            const fecDate = (iso) => {
                if (!iso)
                    return "";
                try {
                    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    return `${d.getFullYear()}${m}${day}`;
                }
                catch {
                    return "";
                }
            };
            const fecAmount = (n) => (Number(n) || 0).toFixed(2).replace(".", ",");
            const fecEsc = (s) => String(s || "").replace(/[\t\r\n|]/g, " ").trim();
            // Stratégie : on utilise PRIORITAIREMENT les écritures persistées
            // (journal_entries). Si la table est vide pour cette année, on retombe
            // sur la génération à la volée (compatibilité avec les bases anciennes).
            const [entryRows] = await db.query(`SELECT je.*, j.libelle AS journalLibelle
         FROM journal_entries je
         LEFT JOIN journals j ON j.code = je.journalCode
         WHERE je.exerciceYear = ?
         ORDER BY je.\`date\` ASC, je.journalCode ASC, je.numero ASC`, [year]);
            if (entryRows.length > 0) {
                const entries = entryRows;
                const ids = entries.map((e) => e.id);
                const placeholders = ids.map(() => "?").join(",");
                const [lineRows] = await db.query(`SELECT * FROM journal_lines WHERE entryId IN (${placeholders}) ORDER BY entryId, ordre`, ids);
                const linesByEntry = {};
                for (const l of lineRows) {
                    const ll = l;
                    if (!linesByEntry[ll.entryId])
                        linesByEntry[ll.entryId] = [];
                    linesByEntry[ll.entryId].push(ll);
                }
                const compteLibCache = {};
                const [accRows] = await db.query("SELECT numero, libelle FROM chart_of_accounts");
                for (const a of accRows) {
                    const aa = a;
                    compteLibCache[aa.numero] = aa.libelle;
                }
                for (const e of entries) {
                    const date = fecDate(e.date);
                    const validDate = fecDate(e.dateValidation || e.date);
                    const pieceDate = fecDate(e.pieceDate || e.date);
                    const journalLib = e.journalLibelle || e.journalCode;
                    const eLines = linesByEntry[e.id] || [];
                    for (const l of eLines) {
                        lines.push([
                            fecEsc(e.journalCode),
                            fecEsc(journalLib),
                            String(e.numero),
                            date,
                            fecEsc(l.compteNum),
                            fecEsc(compteLibCache[l.compteNum] || ""),
                            fecEsc(l.compAuxNum),
                            fecEsc(l.compAuxLib),
                            fecEsc(e.pieceRef),
                            pieceDate,
                            fecEsc(l.libelle || e.libelle),
                            fecAmount(Number(l.debit)),
                            fecAmount(Number(l.credit)),
                            fecEsc(l.lettrage),
                            fecDate(l.dateLettrage),
                            validDate,
                            "",
                            "",
                        ].join("\t"));
                    }
                }
            }
            else {
                // Fallback : génération à la volée depuis invoices + expenses
                // (pour les bases sans écritures persistées encore)
                const CATEGORY_PCG_LOCAL = {
                    materiaux: "601000", outillage: "606300", carburant: "606100",
                    vehicule: "615500", sous_traitance: "611000", loyer: "613200",
                    energie: "606100", telecom: "626000", assurance: "616000",
                    frais_bancaires: "627000", honoraires: "622600", fourniture: "606400",
                    repas: "625600", deplacement: "625100", formation: "628100",
                    logiciel: "651600", publicite: "623000", autre: "658000",
                };
                const PCG_LABEL = {
                    materiaux: "Achats matériaux", outillage: "Petit outillage",
                    carburant: "Carburant", vehicule: "Entretien véhicules",
                    sous_traitance: "Sous-traitance", loyer: "Locations immobilières",
                    energie: "Eau-Gaz-Électricité", telecom: "Frais postaux et télécom",
                    assurance: "Primes d'assurance", frais_bancaires: "Services bancaires",
                    honoraires: "Honoraires", fourniture: "Fournitures",
                    repas: "Repas", deplacement: "Déplacements",
                    formation: "Formation", logiciel: "Cotisations logiciels",
                    publicite: "Publicité", autre: "Charges diverses",
                };
                const [invRows] = await db.query(`SELECT i.*, c.companyName, c.firstName, c.lastName, c.type AS clientType
           FROM invoices i LEFT JOIN clients c ON c.id = i.clientId
           WHERE SUBSTR(i.issueDate, 1, 4) = ? AND i.status != 'annulee'
           ORDER BY i.issueDate, i.reference`, [yearStr]);
                let num = 1;
                for (const r of invRows) {
                    const inv = r;
                    const date = fecDate(inv.issueDate);
                    const clientName = inv.clientType === "pro" && inv.companyName
                        ? inv.companyName
                        : `${inv.firstName || ""} ${inv.lastName || ""}`.trim() || "Client";
                    const compAuxNum = "411" + (inv.clientId || "").slice(-4).padStart(4, "0");
                    const lib = `Facture ${inv.reference}`;
                    const totalTtc = Number(inv.totalTTC) || 0;
                    const totalHt = Number(inv.totalHT) || 0;
                    const totalVat = totalTtc - totalHt;
                    lines.push([
                        "VE", "Ventes", String(num), date,
                        compAuxNum, fecEsc(clientName), compAuxNum, fecEsc(clientName),
                        fecEsc(inv.reference), date, fecEsc(lib),
                        fecAmount(totalTtc), "0,00", "", "",
                        date, "", "",
                    ].join("\t"));
                    lines.push([
                        "VE", "Ventes", String(num), date,
                        "706000", "Prestations de services", "", "",
                        fecEsc(inv.reference), date, fecEsc(lib),
                        "0,00", fecAmount(totalHt), "", "",
                        date, "", "",
                    ].join("\t"));
                    if (totalVat > 0) {
                        lines.push([
                            "VE", "Ventes", String(num), date,
                            "445710", "TVA collectée", "", "",
                            fecEsc(inv.reference), date, fecEsc(lib),
                            "0,00", fecAmount(totalVat), "", "",
                            date, "", "",
                        ].join("\t"));
                    }
                    num++;
                }
                const [expRows] = await db.query(`SELECT * FROM expenses
           WHERE SUBSTR(COALESCE(expenseDate, \`date\`, ''), 1, 4) = ? AND status != 'annulee'
           ORDER BY expenseDate, reference`, [yearStr]);
                for (const r of expRows) {
                    const exp = r;
                    const date = fecDate(exp.expenseDate || exp.date || "");
                    const compAuxNum = "401" + (exp.supplierId || "").slice(-4).padStart(4, "0");
                    const supplier = exp.supplierName || "Fournisseur";
                    const lib = `Achat ${exp.reference}`;
                    const pcg = CATEGORY_PCG_LOCAL[exp.category] || "658000";
                    const totalHt = Number(exp.amountHt) || 0;
                    const totalVat = Number(exp.amountVat) || 0;
                    const totalTtc = Number(exp.amountTtc) || 0;
                    lines.push([
                        "AC", "Achats", String(num), date,
                        pcg, fecEsc(PCG_LABEL[exp.category] || "Charges diverses"), "", "",
                        fecEsc(exp.reference), date, fecEsc(lib),
                        fecAmount(totalHt), "0,00", "", "",
                        date, "", "",
                    ].join("\t"));
                    if (totalVat > 0) {
                        lines.push([
                            "AC", "Achats", String(num), date,
                            "445660", "TVA déductible", "", "",
                            fecEsc(exp.reference), date, fecEsc(lib),
                            fecAmount(totalVat), "0,00", "", "",
                            date, "", "",
                        ].join("\t"));
                    }
                    lines.push([
                        "AC", "Achats", String(num), date,
                        compAuxNum, fecEsc(supplier), compAuxNum, fecEsc(supplier),
                        fecEsc(exp.reference), date, fecEsc(lib),
                        "0,00", fecAmount(totalTtc), "", "",
                        date, "", "",
                    ].join("\t"));
                    num++;
                }
            }
            const content = "﻿" + lines.join("\r\n") + "\r\n";
            const filename = `${siren}FEC${year}1231.txt`;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.send(content);
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    return router;
}
// ─── Hooks : appelés depuis les routes invoices/expenses pour
//   générer/mettre à jour les écritures automatiquement.
// ───────────────────────────────────────────────────────────────────────────
exports.accountingHooks = {
    generateInvoiceEntry: engine_1.generateInvoiceEntry,
    generateExpenseEntry: engine_1.generateExpenseEntry,
    generateInvoicePaymentEntry: engine_1.generateInvoicePaymentEntry,
    generateExpensePaymentEntry: engine_1.generateExpensePaymentEntry,
    generateExpenseNoteEntry: engine_1.generateExpenseNoteEntry,
    generateExpenseNoteRefundEntry: engine_1.generateExpenseNoteRefundEntry,
    deleteEntriesForSource: engine_1.deleteEntriesForSource,
};
