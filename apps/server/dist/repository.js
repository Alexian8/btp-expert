"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// MysqlRepository — implémentation CRUD générique sur une table MySQL
//
// Convention : les colonnes sont en camelCase (alignées sur @btp/types).
// La whitelist `filterable/sortable/writableColumns` protège contre l'injection
// SQL : seuls les noms de colonnes connus sont insérés dans le SQL final.
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.MysqlRepository = void 0;
const ident = (s) => "`" + s.replace(/`/g, "``") + "`";
class MysqlRepository {
    db;
    table;
    opts;
    constructor(db, table, opts) {
        this.db = db;
        this.table = table;
        this.opts = opts;
    }
    async findAll(filter = {}, query = {}) {
        const wheres = [];
        const params = [];
        for (const [key, value] of Object.entries(filter)) {
            if (!this.opts.filterableColumns.includes(key))
                continue;
            wheres.push(`${ident(key)} = ?`);
            params.push(value);
        }
        let sql = `SELECT * FROM ${ident(this.table)}`;
        if (wheres.length)
            sql += ` WHERE ${wheres.join(" AND ")}`;
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
        const [rows] = await this.db.query(sql, params);
        return rows;
    }
    async findById(id) {
        const [rows] = await this.db.query(`SELECT * FROM ${ident(this.table)} WHERE id = ? LIMIT 1`, [id]);
        return rows[0] ?? null;
    }
    async create(data) {
        const useClientPk = this.opts.primaryKey === "client";
        const cols = [];
        const placeholders = [];
        const values = [];
        if (useClientPk) {
            const id = data.id;
            if (!id || typeof id !== "string") {
                throw new Error("PK string requise dans le payload (champ `id`)");
            }
            cols.push(ident("id"));
            placeholders.push("?");
            values.push(id);
        }
        for (const [key, value] of Object.entries(data)) {
            if (key === "id")
                continue; // déjà ajouté en mode client-pk, ignoré en mode auto
            if (!this.opts.writableColumns.includes(key))
                continue;
            cols.push(ident(key));
            placeholders.push("?");
            values.push(this.serializeValue(key, value));
        }
        if (!cols.length)
            throw new Error("Aucune colonne valide à insérer");
        const sql = `INSERT INTO ${ident(this.table)} (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`;
        const [result] = await this.db.execute(sql, values);
        const insertedId = useClientPk ? data.id : result.insertId;
        const created = await this.findById(insertedId);
        if (!created)
            throw new Error("Insertion failed: row not found after insert");
        return created;
    }
    serializeValue(column, value) {
        if (this.opts.jsonColumns?.includes(column) && value != null && typeof value !== "string") {
            return JSON.stringify(value);
        }
        return value;
    }
    async update(id, data) {
        const sets = [];
        const values = [];
        for (const [key, value] of Object.entries(data)) {
            if (key === "id")
                continue; // PK ne s'update pas
            if (!this.opts.writableColumns.includes(key))
                continue;
            sets.push(`${ident(key)} = ?`);
            values.push(this.serializeValue(key, value));
        }
        if (!sets.length)
            return this.findById(id);
        if (this.opts.hasUpdatedAt)
            sets.push(`${ident("updatedAt")} = CURRENT_TIMESTAMP`);
        values.push(id);
        const sql = `UPDATE ${ident(this.table)} SET ${sets.join(", ")} WHERE id = ?`;
        await this.db.execute(sql, values);
        return this.findById(id);
    }
    async delete(id) {
        const [result] = await this.db.execute(`DELETE FROM ${ident(this.table)} WHERE id = ?`, [id]);
        return result.affectedRows > 0;
    }
    async count(filter = {}) {
        const wheres = [];
        const params = [];
        for (const [key, value] of Object.entries(filter)) {
            if (!this.opts.filterableColumns.includes(key))
                continue;
            wheres.push(`${ident(key)} = ?`);
            params.push(value);
        }
        let sql = `SELECT COUNT(*) AS n FROM ${ident(this.table)}`;
        if (wheres.length)
            sql += ` WHERE ${wheres.join(" AND ")}`;
        const [rows] = await this.db.query(sql, params);
        return Number(rows[0].n);
    }
}
exports.MysqlRepository = MysqlRepository;
//# sourceMappingURL=repository.js.map