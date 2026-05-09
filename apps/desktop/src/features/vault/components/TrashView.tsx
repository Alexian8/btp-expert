import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trash2, RotateCcw, X, AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useVaultStore } from "@/stores/vaultStore";
import {
  formatFileSize,
  type VaultDocumentWithTags,
} from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// TrashView — Vue de la corbeille du coffre-fort
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  onBack: () => void;
}

export function TrashView({ onBack }: Props) {
  const { trash, fetchTrash, restoreDocument, deleteDocumentForever } = useVaultStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchTrash().finally(() => setLoading(false));
  }, []);

  const handleRestore = async (doc: VaultDocumentWithTags) => {
    const r = await restoreDocument(doc.id);
    if (r.success) {
      toast.success(`"${doc.fileName}" restauré`);
      await fetchTrash();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleDeleteForever = async (doc: VaultDocumentWithTags) => {
    if (!confirm(`Supprimer DÉFINITIVEMENT "${doc.fileName}" ?\n\nCette action est irréversible.`)) return;
    const r = await deleteDocumentForever(doc.id);
    if (r.success) {
      toast.success("Document supprimé définitivement");
      await fetchTrash();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const daysUntilPermanentDelete = (deletedAt: string): number => {
    if (!deletedAt) return 30;
    const elapsed = Date.now() - new Date(deletedAt).getTime();
    const days = Math.max(0, 30 - Math.floor(elapsed / (1000 * 60 * 60 * 24)));
    return days;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm p-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-rose-500/15 text-rose-500 flex items-center justify-center">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Corbeille</h1>
            <p className="text-xs text-muted-foreground">
              Les documents sont supprimés définitivement après 30 jours
            </p>
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Chargement...</div>
        ) : trash.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <Trash2 className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">Corbeille vide</h3>
            <p className="text-sm text-muted-foreground">
              Les documents que tu mets à la corbeille apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {trash.map((doc, idx) => {
              const daysLeft = daysUntilPermanentDelete(doc.deletedAt);
              const isUrgent = daysLeft <= 5;
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                  className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatFileSize(doc.fileSize)} · Supprimé le {formatDate(doc.deletedAt)}
                    </p>
                    <div className={cn(
                      "flex items-center gap-1 mt-1 text-[11px]",
                      isUrgent ? "text-rose-500 font-medium" : "text-muted-foreground"
                    )}>
                      {isUrgent && <AlertTriangle className="w-3 h-3" />}
                      {daysLeft === 0
                        ? "Sera supprimé dans quelques heures"
                        : `Sera supprimé dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleRestore(doc)}>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restaurer
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteForever(doc)}
                      title="Supprimer définitivement"
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("fr-FR"); } catch { return iso; }
}
