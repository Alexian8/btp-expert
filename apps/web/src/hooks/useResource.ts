import { useEffect, useState, useCallback } from "react";
import type { IRepository } from "@btp/core";

interface UseResourceState<T> {
  items: T[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useResource<T>(repo: IRepository<T>): UseResourceState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await repo.findAll();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, isLoading, error, reload };
}
