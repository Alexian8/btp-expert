import { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface ResourceListProps<T> {
  title: string;
  items: T[];
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  renderItem: (item: T) => ReactNode;
  emptyMessage?: string;
}

export function ResourceList<T>({
  title,
  items,
  isLoading,
  error,
  onReload,
  renderItem,
  emptyMessage = "Aucun élément",
}: ResourceListProps<T>) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{title}</h1>
        <button onClick={onReload} className="btn-ghost" disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="card mb-4 border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <div className="text-text-muted text-sm">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="card text-text-muted text-sm">{emptyMessage}</div>
      ) : (
        <div className="space-y-2">{items.map((item) => renderItem(item))}</div>
      )}
    </div>
  );
}
