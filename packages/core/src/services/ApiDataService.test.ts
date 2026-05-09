import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiDataService, ApiError } from "./ApiDataService";

interface FakeCall {
  url: string;
  init: RequestInit;
}

function makeFetchMock(responses: Array<{ status?: number; body?: unknown; text?: string }>) {
  const calls: FakeCall[] = [];
  let idx = 0;
  const fetchImpl = vi.fn(async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const r = responses[idx++] ?? { status: 200, body: null };
    const status = r.status ?? 200;
    const bodyText = r.text ?? (r.body !== undefined ? JSON.stringify(r.body) : "");
    // 204/205/304 interdisent un body côté Response constructor
    const noBody = status === 204 || status === 205 || status === 304;
    return new Response(noBody ? null : bodyText, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe("ApiDataService — repositories", () => {
  let calls: FakeCall[];
  let service: ApiDataService;

  beforeEach(() => {
    const mock = makeFetchMock([
      { body: [{ id: 1, name: "Acme" }] },
      { body: { id: 1, name: "Acme" } },
      { body: { id: 2, name: "Created" } },
      { body: { id: 2, name: "Updated" } },
      { status: 204, text: "" },
      { body: { count: 42 } },
    ]);
    calls = mock.calls;
    service = new ApiDataService({
      baseUrl: "https://api.test/",
      tokenProvider: () => "tok-123",
      fetchImpl: mock.fetchImpl,
    });
  });

  it("findAll fait GET /api/clients avec filter en query", async () => {
    const result = await service.clients.findAll({ active: true }, { limit: 10 });
    expect(result).toEqual([{ id: 1, name: "Acme" }]);
    expect(calls[0].url).toBe("https://api.test/api/clients?active=true&limit=10");
    expect(calls[0].init.method).toBe("GET");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
  });

  it("findById fait GET /api/clients/:id", async () => {
    await service.clients.findAll();
    const result = await service.clients.findById(1);
    expect(result).toEqual({ id: 1, name: "Acme" });
    expect(calls[1].url).toBe("https://api.test/api/clients/1");
  });

  it("create fait POST avec body JSON", async () => {
    await service.clients.findAll();
    await service.clients.findById(1);
    const result = await service.clients.create({ name: "Created" } as never);
    expect(result).toEqual({ id: 2, name: "Created" });
    expect(calls[2].init.method).toBe("POST");
    expect(calls[2].init.body).toBe(JSON.stringify({ name: "Created" }));
    expect((calls[2].init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    );
  });

  it("update fait PATCH /api/clients/:id", async () => {
    await service.clients.findAll();
    await service.clients.findById(1);
    await service.clients.create({ name: "Created" } as never);
    const result = await service.clients.update(2, { name: "Updated" } as never);
    expect((result as unknown as { name: string }).name).toBe("Updated");
    expect(calls[3].init.method).toBe("PATCH");
    expect(calls[3].url).toBe("https://api.test/api/clients/2");
  });

  it("delete fait DELETE /api/clients/:id et résout sans valeur", async () => {
    await service.clients.findAll();
    await service.clients.findById(1);
    await service.clients.create({ name: "x" } as never);
    await service.clients.update(2, { name: "y" } as never);
    const result = await service.clients.delete(2);
    expect(result).toBeUndefined();
    expect(calls[4].init.method).toBe("DELETE");
  });

  it("count accepte payload {count: n} ou number brut", async () => {
    await service.clients.findAll();
    await service.clients.findById(1);
    await service.clients.create({ name: "x" } as never);
    await service.clients.update(2, { name: "y" } as never);
    await service.clients.delete(2);
    const n = await service.clients.count({ active: true });
    expect(n).toBe(42);
    expect(calls[5].url).toBe("https://api.test/api/clients/count?active=true");
  });
});

describe("ApiDataService — gestion d'erreurs", () => {
  it("findById renvoie null sur 404", async () => {
    const mock = makeFetchMock([{ status: 404, body: { message: "not found" } }]);
    const service = new ApiDataService({
      baseUrl: "https://api.test",
      fetchImpl: mock.fetchImpl,
    });
    const result = await service.clients.findById(999);
    expect(result).toBeNull();
  });

  it("login renvoie null sur 401", async () => {
    const mock = makeFetchMock([{ status: 401, body: { message: "bad creds" } }]);
    const onUnauthorized = vi.fn();
    const service = new ApiDataService({
      baseUrl: "https://api.test",
      fetchImpl: mock.fetchImpl,
      onUnauthorized,
    });
    const result = await service.login("a", "b");
    expect(result).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("autres erreurs lèvent ApiError avec status et message", async () => {
    const mock = makeFetchMock([{ status: 500, body: { message: "boom" } }]);
    const service = new ApiDataService({
      baseUrl: "https://api.test",
      fetchImpl: mock.fetchImpl,
    });
    await expect(service.clients.findAll()).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "boom",
    });
  });

  it("requête sans tokenProvider n'envoie pas d'Authorization", async () => {
    const mock = makeFetchMock([{ body: [] }]);
    const service = new ApiDataService({
      baseUrl: "https://api.test",
      fetchImpl: mock.fetchImpl,
    });
    await service.clients.findAll();
    expect(
      (mock.calls[0].init.headers as Record<string, string>).Authorization
    ).toBeUndefined();
  });

  it("ApiError est sérializable et a le bon nom", () => {
    const err = new ApiError(418, "I'm a teapot", { detail: "x" });
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(418);
    expect(err.body).toEqual({ detail: "x" });
  });
});

describe("ApiDataService — auth & settings", () => {
  it("login fait POST /api/auth/login avec username/password", async () => {
    const mock = makeFetchMock([{ body: { id: 1, username: "alice" } }]);
    const service = new ApiDataService({
      baseUrl: "https://api.test",
      fetchImpl: mock.fetchImpl,
    });
    const user = await service.login("alice", "secret");
    expect(user).toEqual({ id: 1, username: "alice" });
    expect(mock.calls[0].url).toBe("https://api.test/api/auth/login");
    expect(mock.calls[0].init.body).toBe(
      JSON.stringify({ username: "alice", password: "secret" })
    );
  });

  it("getCurrentUser renvoie null si non connecté (404)", async () => {
    const mock = makeFetchMock([{ status: 404 }]);
    const service = new ApiDataService({
      baseUrl: "https://api.test",
      fetchImpl: mock.fetchImpl,
    });
    expect(await service.getCurrentUser()).toBeNull();
  });

  it("updateSettings fait PATCH /api/settings", async () => {
    const mock = makeFetchMock([{ body: { theme: "dark" } }]);
    const service = new ApiDataService({
      baseUrl: "https://api.test",
      fetchImpl: mock.fetchImpl,
    });
    const result = await service.updateSettings({ theme: "dark" } as never);
    expect(result).toEqual({ theme: "dark" });
    expect(mock.calls[0].init.method).toBe("PATCH");
  });
});
