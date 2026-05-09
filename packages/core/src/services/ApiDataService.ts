// ═══════════════════════════════════════════════════════════════════════════
// ApiDataService — implémentation HTTP de IDataService
//
// Permet de brancher l'app sur un serveur distant (REST) sans rien changer
// dans la couche UI. Tous les écrans passent déjà par IDataService.
//
// Convention REST attendue côté serveur :
//   GET    /api/{resource}           → list (avec filter en query string)
//   GET    /api/{resource}/:id       → findById
//   POST   /api/{resource}           → create
//   PATCH  /api/{resource}/:id       → update
//   DELETE /api/{resource}/:id       → delete
//   GET    /api/{resource}/count     → count
//
// Auth : token Bearer dans l'en-tête Authorization (récupéré depuis
// le tokenProvider injecté).
//
// Le client HTTP est volontairement minimaliste (fetch natif, zéro dépendance)
// pour rester portable navigateur ↔ Node ↔ React Native.
// ═══════════════════════════════════════════════════════════════════════════

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
import type {
  IDataService,
  IRepository,
  PaginationOptions,
  QueryFilter,
} from "./IDataService";

// ─── Configuration ───────────────────────────────────────────────────────

export interface ApiDataServiceConfig {
  /** URL de base du serveur, ex: "https://api.batidesk.fr" (sans slash final). */
  baseUrl: string;
  /**
   * Récupère le token d'auth courant à injecter dans Authorization.
   * Retourner null pour les requêtes anonymes.
   */
  tokenProvider?: () => string | null | Promise<string | null>;
  /**
   * Appelé après un login réussi avec le token reçu du serveur.
   * Utiliser pour persister le token (localStorage, etc.).
   */
  onTokenReceived?: (token: string) => void | Promise<void>;
  /** Hook appelé sur 401, utile pour déclencher un re-login. */
  onUnauthorized?: () => void | Promise<void>;
  /** Timeout par requête en ms (par défaut 30s). */
  timeoutMs?: number;
  /** fetch custom (utile pour tests / Node sans global fetch). */
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── HTTP client interne ─────────────────────────────────────────────────

class HttpClient {
  readonly baseUrl: string;
  readonly tokenProvider?: ApiDataServiceConfig["tokenProvider"];
  readonly onTokenReceived?: ApiDataServiceConfig["onTokenReceived"];
  private readonly onUnauthorized?: ApiDataServiceConfig["onUnauthorized"];
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ApiDataServiceConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.tokenProvider = config.tokenProvider;
    this.onTokenReceived = config.onTokenReceived;
    this.onUnauthorized = config.onUnauthorized;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async authHeaders(): Promise<Record<string, string>> {
    const token = this.tokenProvider ? await Promise.resolve(this.tokenProvider()) : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async request<T>(
    method: string,
    path: string,
    options: { query?: Record<string, unknown>; body?: unknown } = {}
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    const token = await Promise.resolve(this.tokenProvider?.() ?? null);
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      throw new ApiError(0, e instanceof Error ? e.message : "Network error");
    }
    clearTimeout(timer);

    if (res.status === 401) {
      await Promise.resolve(this.onUnauthorized?.());
      throw new ApiError(401, "Unauthorized");
    }

    let payload: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!res.ok) {
      let message: string = res.statusText || `HTTP ${res.status}`;
      if (payload && typeof payload === "object" && "message" in payload) {
        const m = (payload as { message: unknown }).message;
        if (m) message = String(m);
      }
      throw new ApiError(res.status, message, payload);
    }

    return payload as T;
  }
}

// ─── Repository HTTP générique ───────────────────────────────────────────

class HttpRepository<T extends { id?: number | string }> implements IRepository<T> {
  constructor(
    private readonly http: HttpClient,
    private readonly resource: string
  ) {}

  findAll(filter?: QueryFilter, pagination?: PaginationOptions): Promise<T[]> {
    return this.http.request<T[]>("GET", `/api/${this.resource}`, {
      query: { ...filter, ...pagination },
    });
  }

  findById(id: number | string): Promise<T | null> {
    return this.http
      .request<T>("GET", `/api/${this.resource}/${encodeURIComponent(String(id))}`)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      });
  }

  create(data: Omit<T, "id" | "createdAt">): Promise<T> {
    return this.http.request<T>("POST", `/api/${this.resource}`, { body: data });
  }

  update(id: number | string, data: Partial<T>): Promise<T> {
    return this.http.request<T>(
      "PATCH",
      `/api/${this.resource}/${encodeURIComponent(String(id))}`,
      { body: data }
    );
  }

  delete(id: number | string): Promise<void> {
    return this.http
      .request<void>("DELETE", `/api/${this.resource}/${encodeURIComponent(String(id))}`)
      .then(() => undefined);
  }

  async count(filter?: QueryFilter): Promise<number> {
    const res = await this.http.request<{ count: number } | number>(
      "GET",
      `/api/${this.resource}/count`,
      { query: filter }
    );
    return typeof res === "number" ? res : res.count;
  }
}

// ─── Service principal ───────────────────────────────────────────────────

export class ApiDataService implements IDataService {
  private readonly http: HttpClient;

  readonly clients: IRepository<Client>;
  readonly fournisseurs: IRepository<Supplier>;
  readonly chantiers: IRepository<Chantier>;
  readonly invoices: IRepository<Invoice>;
  readonly vault: IRepository<VaultDocument>;
  readonly cgvClauses: IRepository<CGVClause>;
  readonly chantierClauses: IRepository<ChantierClause>;

  constructor(config: ApiDataServiceConfig) {
    this.http = new HttpClient(config);
    this.clients = new HttpRepository<Client>(this.http, "clients");
    this.fournisseurs = new HttpRepository<Supplier>(this.http, "fournisseurs");
    this.chantiers = new HttpRepository<Chantier>(this.http, "chantiers");
    this.invoices = new HttpRepository<Invoice>(this.http, "invoices");
    this.vault = new HttpRepository<VaultDocument>(this.http, "vault");
    this.cgvClauses = new HttpRepository<CGVClause>(this.http, "cgv-clauses");
    this.chantierClauses = new HttpRepository<ChantierClause>(this.http, "chantier-clauses");
  }

  // ─── Auth ──────────────────────────────────────────────────────────────
  async login(username: string, password: string): Promise<User | null> {
    try {
      const res = await this.http.request<User & { token?: string }>(
        "POST",
        "/api/auth/login",
        { body: { username, password } }
      );
      if (res?.token && this.http.onTokenReceived) {
        await Promise.resolve(this.http.onTokenReceived(res.token));
      }
      return res;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return null;
      throw e;
    }
  }

  logout(): Promise<void> {
    return this.http.request<void>("POST", "/api/auth/logout").then(() => undefined);
  }

  getCurrentUser(): Promise<User | null> {
    return this.http.request<User>("GET", "/api/auth/me").catch((e) => {
      if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return null;
      throw e;
    });
  }

  // ─── Settings ──────────────────────────────────────────────────────────
  getSettings(): Promise<AppSettings> {
    return this.http.request<AppSettings>("GET", "/api/settings");
  }

  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    return this.http.request<AppSettings>("PATCH", "/api/settings", { body: patch });
  }

  // ─── Backup (binaire — bypass du JSON) ─────────────────────────────────
  async exportBackup(): Promise<ArrayBuffer> {
    const res = await fetch(this.http.baseUrl + "/api/backup/export", {
      headers: await this.http.authHeaders(),
    });
    if (!res.ok) throw new ApiError(res.status, `Backup export failed: ${res.statusText}`);
    return res.arrayBuffer();
  }

  async importBackup(data: ArrayBuffer): Promise<void> {
    const res = await fetch(this.http.baseUrl + "/api/backup/import", {
      method: "POST",
      headers: { ...(await this.http.authHeaders()), "Content-Type": "application/octet-stream" },
      body: data,
    });
    if (!res.ok) throw new ApiError(res.status, `Backup import failed: ${res.statusText}`);
  }
}
