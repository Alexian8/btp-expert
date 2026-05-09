import { describe, it, expect, beforeEach } from "vitest";
import { MockRepository } from "./IDataService";

interface TestEntity {
  id: number;
  name: string;
  createdAt?: string;
}

describe("MockRepository", () => {
  let repo: MockRepository<TestEntity>;

  beforeEach(() => {
    repo = new MockRepository<TestEntity>();
  });

  it("findAll retourne un tableau vide à la création", async () => {
    const all = await repo.findAll();
    expect(all).toEqual([]);
  });

  it("create assigne un id incrémental et un createdAt", async () => {
    const a = await repo.create({ name: "A" });
    const b = await repo.create({ name: "B" });
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(a.createdAt).toBeDefined();
    expect(new Date(a.createdAt!).toString()).not.toBe("Invalid Date");
  });

  it("findById retourne l'entité existante ou null", async () => {
    const created = await repo.create({ name: "X" });
    expect(await repo.findById(created.id)).toEqual(created);
    expect(await repo.findById(999)).toBeNull();
  });

  it("update fusionne les champs et retourne l'entité modifiée", async () => {
    const created = await repo.create({ name: "old" });
    const updated = await repo.update(created.id, { name: "new" });
    expect(updated.name).toBe("new");
    expect(updated.id).toBe(created.id);
  });

  it("update sur id inconnu lève une erreur", async () => {
    await expect(repo.update(999, { name: "x" })).rejects.toThrow(/Not found/);
  });

  it("delete retire l'entité et findById renvoie null ensuite", async () => {
    const created = await repo.create({ name: "to-delete" });
    await repo.delete(created.id);
    expect(await repo.findById(created.id)).toBeNull();
  });

  it("delete sur id inconnu ne lève pas d'erreur (idempotent)", async () => {
    await expect(repo.delete(999)).resolves.toBeUndefined();
  });

  it("count reflète le nombre courant d'entités", async () => {
    expect(await repo.count()).toBe(0);
    await repo.create({ name: "1" });
    await repo.create({ name: "2" });
    expect(await repo.count()).toBe(2);
    const items = await repo.findAll();
    await repo.delete(items[0].id);
    expect(await repo.count()).toBe(1);
  });

  it("findAll retourne une copie, pas la référence interne", async () => {
    await repo.create({ name: "A" });
    const list1 = await repo.findAll();
    list1.push({ id: 999, name: "injected" } as TestEntity);
    const list2 = await repo.findAll();
    expect(list2.length).toBe(1);
  });
});
