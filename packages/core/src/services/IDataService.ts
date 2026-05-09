import type {
  Client,
  Supplier,
  Chantier,
  LegacyInvoice as Invoice,
  LegacyVaultDocument as VaultDocument,
  CGVClause,
  ChantierClause,
  User,
  AppSettings,
} from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// IDataService — Interface abstraite pour la persistance des données
//
// C'est LA clé de la portabilité multi-plateforme.
//
// Aujourd'hui : implémenté par ElectronDataService (SQLite local)
// Demain : peut être implémenté par :
//   - ApiDataService (backend REST)
//   - SupabaseDataService (Firebase-like, pour mobile/web)
//   - IndexedDBDataService (PWA offline)
//
// Toute la logique métier passe par cette interface, JAMAIS directement
// par window.btpDB ou fetch() ou autre.
// ═══════════════════════════════════════════════════════════════════════════

export interface QueryFilter {
  [key: string]: string | number | boolean | null | undefined;
}

export interface PaginationOptions {
  offset?: number;
  limit?: number;
  orderBy?: string;
  order?: "asc" | "desc";
}

// ─── CRUD générique typé ─────────────────────────────────────────────────
export interface IRepository<T> {
  findAll(filter?: QueryFilter, pagination?: PaginationOptions): Promise<T[]>;
  findById(id: number | string): Promise<T | null>;
  create(data: Omit<T, "id" | "createdAt">): Promise<T>;
  update(id: number | string, data: Partial<T>): Promise<T>;
  delete(id: number | string): Promise<void>;
  count(filter?: QueryFilter): Promise<number>;
}

// ─── Service principal : façade sur tous les repositories ─────────────────
export interface IDataService {
  // Auth
  login(username: string, password: string): Promise<User | null>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;

  // Settings
  getSettings(): Promise<AppSettings>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;

  // Repositories métier
  clients: IRepository<Client>;
  fournisseurs: IRepository<Supplier>;
  chantiers: IRepository<Chantier>;
  invoices: IRepository<Invoice>;
  vault: IRepository<VaultDocument>;
  cgvClauses: IRepository<CGVClause>;
  chantierClauses: IRepository<ChantierClause>;

  // Operations spéciales
  exportBackup(): Promise<ArrayBuffer>;
  importBackup(data: ArrayBuffer): Promise<void>;
}

// ─── Mock pour les tests / dev sans backend ──────────────────────────────
export class MockRepository<T extends { id: number | string }> implements IRepository<T> {
  private data: T[] = [];
  private nextId = 1;

  async findAll(): Promise<T[]> {
    return [...this.data];
  }
  async findById(id: number | string): Promise<T | null> {
    return this.data.find((d) => d.id === id) || null;
  }
  async create(data: Omit<T, "id" | "createdAt">): Promise<T> {
    const item = { ...data, id: this.nextId++, createdAt: new Date().toISOString() } as unknown as T;
    this.data.push(item);
    return item;
  }
  async update(id: number | string, data: Partial<T>): Promise<T> {
    const idx = this.data.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error(`Not found: ${id}`);
    this.data[idx] = { ...this.data[idx], ...data };
    return this.data[idx];
  }
  async delete(id: number | string): Promise<void> {
    this.data = this.data.filter((d) => d.id !== id);
  }
  async count(): Promise<number> {
    return this.data.length;
  }
}
