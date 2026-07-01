// ═══════════════════════════════════════════════════════════════════════════
// MysqlRepository — implémentation CRUD générique sur une table MySQL
//
// Convention : les colonnes sont en camelCase (alignées sur @btp/types).
// La whitelist `filterable/sortable/writableColumns` protège contre l'injection
// SQL : seuls les noms de colonnes connus sont insérés dans le SQL final.
// ═══════════════════════════════════════════════════════════════════════════

import type { DB, ResultSetHeader, RowDataPacket } from "./db";

export interface RepositoryOptions {
  filterableColumns: readonly string[];
  sortableColumns: readonly string[];
  writableColumns: readonly string[];
  /** Si true, met à jour `updatedAt` automatiquement à chaque UPDATE. */
  hasUpdatedAt?: boolean;
  /**
   * Stratégie de PK :
   *  - "auto" (défaut) : INT AUTO_INCREMENT, lit `result.insertId`
   *  - "client" : la PK (string ex: UUID) vient dans le payload de create
   */
  primaryKey?: "auto" | "client";
  /** Colonnes JSON — sérialisées en JSON.stringify avant insert/update. */
  jsonColumns?: readonly string[];
  /**
   * Si true, la table possède les colonnes `createdBy` et `updatedBy`
   * et le repo y injecte automatiquement l'ID de l'utilisateur connecté
   * fourni via le 2e argument de create()/update().
   * Le client ne peut JAMAIS écrire ces colonnes directement (filtre repo).
   */
  hasAuditColumns?: boolean;
  /**
   * Multi-tenant : nom de la colonne tenant (typiquement "companyId").
   * Si défini :
   *  - findAll/findById/count/update/delete scopent automatiquement par
   *    `WHERE <tenantColumn> = ?` (impossible de voir/modifier les rows
   *    d'un autre tenant)
   *  - create injecte automatiquement la valeur tenant
   *  - le client ne peut JAMAIS écrire cette colonne via le payload
   */
  tenantColumn?: string;
}

export interface ScopeContext {
  /** ID de l'utilisateur connecté — injecté dans createdBy/updatedBy. */
  auditUserId?: number;
  /** ID du tenant (company) du user — scope auto les queries. */
  tenantId?: number;
  /**
   * Isolation par auteur (rôle `worker`) : si défini ET que la table possède
   * les colonnes d'audit (`hasAuditColumns`), toutes les lectures/écritures
   * sont restreintes à `createdBy = <valeur>`. Imposé CÔTÉ SERVEUR — le
   * filtre `?createdBy=ME` du shim web n'est qu'un confort d'UI.
   */
  restrictToCreatedBy?: number;
}

const ident = (s: string): string => "`" + s.replace(/`/g, "``") + "`";

export class MysqlRepository<T extends Record<string, unknown> & { id?: number }> {
  constructor(
    private readonly db: DB,
    private readonly table: string,
    private readonly opts: RepositoryOptions
  ) {}

  /** Ajoute la restriction `createdBy = ?` (rôle worker) si applicable. */
  private applyCreatedByScope(wheres: string[], params: unknown[], ctx: ScopeContext): void {
    if (this.opts.hasAuditColumns && ctx.restrictToCreatedBy != null) {
      wheres.push(`${ident("createdBy")} = ?`);
      params.push(ctx.restrictToCreatedBy);
    }
  }

  async findAll(
    filter: Record<string, unknown> = {},
    query: Record<string, unknown> = {},
    ctx: ScopeContext = {}
  ): Promise<T[]> {
    const wheres: string[] = [];
    const params: unknown[] = [];

    // Scope tenant en PREMIER (impossible à override par filter client)
    if (this.opts.tenantColumn && ctx.tenantId != null) {
      wheres.push(`${ident(this.opts.tenantColumn)} = ?`);
      params.push(ctx.tenantId);
    }
    // Scope worker (createdBy) — imposé serveur, non contournable par filter
    this.applyCreatedByScope(wheres, params, ctx);

    for (const [key, value] of Object.entries(filter)) {
      if (!this.opts.filterableColumns.includes(key)) continue;
      // SÉCURITÉ : un client ne peut pas filtrer sur tenantColumn (sinon il
      // pourrait voir d'autres tenants en passant un autre companyId)
      if (this.opts.tenantColumn && key === this.opts.tenantColumn) continue;
      // SÉCURITÉ : le scope worker impose déjà createdBy — pas d'override
      if (ctx.restrictToCreatedBy != null && key === "createdBy") continue;
      wheres.push(`${ident(key)} = ?`);
      params.push(value);
    }

    let sql = `SELECT * FROM ${ident(this.table)}`;
    if (wheres.length) sql += ` WHERE ${wheres.join(" AND ")}`;

    const orderBy = typeof query.orderBy === "string" ? query.orderBy : null;
    if (orderBy && this.opts.sortableColumns.includes(orderBy)) {
      const order = query.order === "desc" ? "DESC" : "ASC";
      sql += ` ORDER BY ${ident(orderBy)} ${order}`;
    }

    const limit = Number(query.limit);
    const offset = Number(query.offset);
    if (Number.isFinite(limit) && limit > 0) {
      sql += ` LIMIT ?`;
      params.push(limit);
      if (Number.isFinite(offset) && offset > 0) {
        sql += ` OFFSET ?`;
        params.push(offset);
      }
    }

    const [rows] = await this.db.query<RowDataPacket[]>(sql, params);
    return rows as unknown as T[];
  }

  async findById(id: number | string, ctx: ScopeContext = {}): Promise<T | null> {
    const wheres = ["id = ?"];
    const params: unknown[] = [id];
    if (this.opts.tenantColumn && ctx.tenantId != null) {
      wheres.push(`${ident(this.opts.tenantColumn)} = ?`);
      params.push(ctx.tenantId);
    }
    this.applyCreatedByScope(wheres, params, ctx);
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT * FROM ${ident(this.table)} WHERE ${wheres.join(" AND ")} LIMIT 1`,
      params
    );
    return (rows[0] as unknown as T) ?? null;
  }

  async create(data: Record<string, unknown>, ctx: ScopeContext = {}): Promise<T> {
    const auditUserId = ctx.auditUserId;
    const useClientPk = this.opts.primaryKey === "client";
    const cols: string[] = [];
    const placeholders: string[] = [];
    const values: unknown[] = [];

    if (useClientPk) {
      const id = (data as { id?: unknown }).id;
      if (!id || typeof id !== "string") {
        throw new Error("PK string requise dans le payload (champ `id`)");
      }
      cols.push(ident("id"));
      placeholders.push("?");
      values.push(id);
    }

    for (const [key, value] of Object.entries(data)) {
      if (key === "id") continue; // déjà ajouté en mode client-pk, ignoré en mode auto
      // SÉCURITÉ : un client ne peut JAMAIS écrire createdBy/updatedBy
      // depuis le payload (sinon il pourrait usurper un autre user).
      if (key === "createdBy" || key === "updatedBy") continue;
      // SÉCURITÉ : un client ne peut JAMAIS écrire la colonne tenant
      // (sinon il pourrait créer une row dans un autre tenant)
      if (this.opts.tenantColumn && key === this.opts.tenantColumn) continue;
      if (!this.opts.writableColumns.includes(key)) continue;
      cols.push(ident(key));
      placeholders.push("?");
      values.push(this.serializeValue(key, value));
    }

    // Injection auto du tenant depuis le JWT
    if (this.opts.tenantColumn && ctx.tenantId != null) {
      cols.push(ident(this.opts.tenantColumn));
      placeholders.push("?");
      values.push(ctx.tenantId);
    }

    // Injection auto de createdBy / updatedBy depuis le JWT serveur
    if (this.opts.hasAuditColumns && auditUserId != null) {
      cols.push(ident("createdBy"));
      placeholders.push("?");
      values.push(auditUserId);
      cols.push(ident("updatedBy"));
      placeholders.push("?");
      values.push(auditUserId);
    }

    if (!cols.length) throw new Error("Aucune colonne valide à insérer");

    const sql = `INSERT INTO ${ident(this.table)} (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`;
    const [result] = await this.db.execute<ResultSetHeader>(sql, values as never[]);
    const insertedId = useClientPk ? (data as { id: string }).id : result.insertId;
    const created = await this.findById(insertedId, ctx);
    if (!created) throw new Error("Insertion failed: row not found after insert");
    return created;
  }

  private serializeValue(column: string, value: unknown): unknown {
    if (this.opts.jsonColumns?.includes(column) && value != null && typeof value !== "string") {
      return JSON.stringify(value);
    }
    return value;
  }

  async update(
    id: number | string,
    data: Record<string, unknown>,
    ctx: ScopeContext = {}
  ): Promise<T | null> {
    const auditUserId = ctx.auditUserId;
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key === "id") continue; // PK ne s'update pas
      if (key === "createdBy" || key === "updatedBy") continue; // SÉCURITÉ
      if (this.opts.tenantColumn && key === this.opts.tenantColumn) continue; // SÉCURITÉ
      if (!this.opts.writableColumns.includes(key)) continue;
      sets.push(`${ident(key)} = ?`);
      values.push(this.serializeValue(key, value));
    }

    // Injection auto updatedBy
    if (this.opts.hasAuditColumns && auditUserId != null) {
      sets.push(`${ident("updatedBy")} = ?`);
      values.push(auditUserId);
    }

    if (!sets.length) return this.findById(id, ctx);

    if (this.opts.hasUpdatedAt) sets.push(`${ident("updatedAt")} = CURRENT_TIMESTAMP`);

    // WHERE id = ? AND companyId = ?  (impossible de modifier les rows d'un autre tenant)
    const wheres = ["id = ?"];
    values.push(id);
    if (this.opts.tenantColumn && ctx.tenantId != null) {
      wheres.push(`${ident(this.opts.tenantColumn)} = ?`);
      values.push(ctx.tenantId);
    }
    this.applyCreatedByScope(wheres, values, ctx);
    const sql = `UPDATE ${ident(this.table)} SET ${sets.join(", ")} WHERE ${wheres.join(" AND ")}`;
    await this.db.execute<ResultSetHeader>(sql, values as never[]);
    return this.findById(id, ctx);
  }

  async delete(id: number | string, ctx: ScopeContext = {}): Promise<boolean> {
    const wheres = ["id = ?"];
    const params: unknown[] = [id];
    if (this.opts.tenantColumn && ctx.tenantId != null) {
      wheres.push(`${ident(this.opts.tenantColumn)} = ?`);
      params.push(ctx.tenantId);
    }
    this.applyCreatedByScope(wheres, params, ctx);
    const [result] = await this.db.execute<ResultSetHeader>(
      `DELETE FROM ${ident(this.table)} WHERE ${wheres.join(" AND ")}`,
      params as never[]
    );
    return result.affectedRows > 0;
  }

  async count(
    filter: Record<string, unknown> = {},
    ctx: ScopeContext = {}
  ): Promise<number> {
    const wheres: string[] = [];
    const params: unknown[] = [];
    if (this.opts.tenantColumn && ctx.tenantId != null) {
      wheres.push(`${ident(this.opts.tenantColumn)} = ?`);
      params.push(ctx.tenantId);
    }
    this.applyCreatedByScope(wheres, params, ctx);
    for (const [key, value] of Object.entries(filter)) {
      if (!this.opts.filterableColumns.includes(key)) continue;
      if (this.opts.tenantColumn && key === this.opts.tenantColumn) continue;
      if (ctx.restrictToCreatedBy != null && key === "createdBy") continue;
      wheres.push(`${ident(key)} = ?`);
      params.push(value);
    }
    let sql = `SELECT COUNT(*) AS n FROM ${ident(this.table)}`;
    if (wheres.length) sql += ` WHERE ${wheres.join(" AND ")}`;
    const [rows] = await this.db.query<RowDataPacket[]>(sql, params);
    return Number((rows[0] as { n: number }).n);
  }
}
