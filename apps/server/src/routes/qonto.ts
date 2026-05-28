// ═══════════════════════════════════════════════════════════════════════════
// Routes Qonto — /api/qonto/*
//
// Socle d'intégration bancaire (lecture seule pour l'instant) :
//   POST   /connect       enregistre + teste les identifiants API
//   GET    /status        état de connexion (sans exposer la secret)
//   POST   /disconnect    supprime les identifiants
//   GET    /accounts      comptes + soldes (live)
//   GET    /transactions  transactions d'un compte (live)
//
// Le rapprochement bancaire et l'import en compta seront ajoutés ensuite,
// une fois la connexion testée avec un vrai compte.
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import type { DB } from "../db";
import type { Config } from "../config";
import { fetchOrganization, fetchTransactions } from "../qonto/client";
import {
  saveCredentials,
  getCredentials,
  getStatus,
  deleteCredentials,
} from "../qonto/credentials";

export function buildQontoRouter(db: DB, cfg: Config): Router {
  const router = Router();
  const jwtSecret = cfg.JWT_SECRET;

  // ─── État de connexion ─────────────────────────────────────────────────
  router.get("/status", async (_req, res) => {
    try {
      res.json(await getStatus(db));
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ─── Connexion (teste puis enregistre) ─────────────────────────────────
  router.post("/connect", async (req, res) => {
    try {
      const login = String((req.body || {}).login || "").trim();
      const secretKey = String((req.body || {}).secretKey || "").trim();
      if (!login || !secretKey) {
        return res.status(400).json({ success: false, error: "Login et secret key requis." });
      }
      // Test immédiat : on tente de récupérer l'organisation
      const org = await fetchOrganization({ login, secretKey });
      await saveCredentials(db, { login, secretKey }, jwtSecret, org.legalName);
      res.json({
        success: true,
        organizationName: org.legalName,
        accountsCount: org.accounts.length,
      });
    } catch (e) {
      res.status(400).json({ success: false, error: (e as Error).message });
    }
  });

  // ─── Déconnexion ────────────────────────────────────────────────────────
  router.post("/disconnect", async (_req, res) => {
    try {
      await deleteCredentials(db);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  // ─── Comptes + soldes (live) ────────────────────────────────────────────
  router.get("/accounts", async (_req, res) => {
    try {
      const creds = await getCredentials(db, jwtSecret);
      if (!creds) return res.status(409).json({ error: "Qonto non connecté." });
      const org = await fetchOrganization(creds);
      res.json({ organizationName: org.legalName, accounts: org.accounts });
    } catch (e) {
      res.status(502).json({ error: (e as Error).message });
    }
  });

  // ─── Transactions d'un compte (live) ────────────────────────────────────
  router.get("/transactions", async (req, res) => {
    try {
      const creds = await getCredentials(db, jwtSecret);
      if (!creds) return res.status(409).json({ error: "Qonto non connecté." });
      const accountSlug = String(req.query.accountId || "");
      if (!accountSlug) return res.status(400).json({ error: "accountId requis." });
      const settledFrom = req.query.from ? String(req.query.from) : undefined;
      const transactions = await fetchTransactions(creds, accountSlug, {
        settledFrom,
        maxPages: 10,
      });
      res.json({ transactions });
    } catch (e) {
      res.status(502).json({ error: (e as Error).message });
    }
  });

  return router;
}
