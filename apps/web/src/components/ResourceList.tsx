import { ReactNode } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResourceListProps<T> {
  title: string;
  subtitle?: string;
  items: T[];
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  renderItem: (item: T) => ReactNode;
  emptyMessage?: string;
  actions?: ReactNode;
}

export function ResourceList<T>({
  title,
  subtitle,
  items,
  isLoading,
  error,
  onReload,
  renderItem,
  emptyMessage = "Aucun élément",
  actions,
}: ResourceListProps<T>) {
  return (
    <div className="p-6 md:p-8 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <Button variant="outline" onClick={onReload} disabled={isLoading} size="sm">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <div className="text-muted-foreground text-sm py-12 text-center">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground text-sm">
          {emptyMessage}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          {items.map((item) => renderItem(item))}
        </motion.div>
      )}
    </div>
  );
}
