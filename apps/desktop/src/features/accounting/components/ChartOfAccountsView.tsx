import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, Edit, Lock } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAccountingStore } from "@/stores/accountingStore";
import type { Account } from "@btp/types";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CLASS_LABEL, CLASS_COLOR } from "../lib/accountingFormatters";

// ═══════════════════════════════════════════════════════════════════════════
// ChartOfAccountsView — Plan comptable (CRUD)
// ═══════════════════════════════════════════════════════════════════════════

export function ChartOfAccountsView() {
  const fetchAccounts = useAccountingStore((s) => s.fetchAccounts);
  const accounts = useAccountingStore((s) => s.accounts);
  const createAccount = useAccountingStore((s) => s.createAccount);
  const updateAccount = useAccountingStore((s) => s.updateAccount);
  const deleteAccount = useAccountingStore((s) => s.deleteAccount);

  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState<number | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Account | null>(null);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (filterClass !== null && a.classe !== filterClass) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return a.numero.toLowerCase().includes(q) || a.libelle.toLowerCase().includes(q);
    });
  }, [accounts, search, filterClass]);

  const handleDelete = async () => {
    if (!toDelete) return;
    const r = await deleteAccount(toDelete.numero);
    if (r.success) {
      toast.success("Compte supprimé");
      setToDelete(null);
    } else {
      toast.error(r.error || "Suppression impossible");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (n° ou libellé)…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterClass(null)}
            className={`px-2 py-1 text-xs rounded transition-colors ${filterClass === null ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            Toutes
          </button>
          {[1, 2, 3, 4, 5, 6, 7].map((c) => (
            <button
              key={c}
              onClick={() => setFilterClass(c)}
              className={`px-2 py-1 text-xs rounded transition-colors ${filterClass === c ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nouveau compte
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">N°</th>
                <th className="px-3 py-2 text-left">Libellé</th>
                <th className="px-3 py-2 text-left">Classe</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Nature</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.numero} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono font-semibold">{a.numero}</td>
                  <td className="px-3 py-2">{a.libelle}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${CLASS_COLOR[a.classe] || "bg-muted"}`}>
                      {a.classe} — {CLASS_LABEL[a.classe] || ""}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{a.type}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{a.nature}</td>
                  <td className="px-3 py-2 text-right">
                    {a.isLocked ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="w-3 h-3" /> système
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(a)} className="p-1 rounded hover:bg-muted" title="Modifier">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setToDelete(a)} className="p-1 rounded hover:bg-destructive/15 hover:text-destructive" title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Aucun compte trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AccountEditorModal
        open={creating || !!editing}
        editing={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSubmit={async (data) => {
          const r = editing
            ? await updateAccount(editing.numero, data)
            : await createAccount(data);
          if (r.success) {
            toast.success(editing ? "Compte modifié" : "Compte créé");
            setCreating(false);
            setEditing(null);
            return true;
          }
          toast.error(r.error || "Erreur");
          return false;
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="Supprimer ce compte ?"
        description={toDelete && (
          <span>Le compte <strong>{toDelete.numero} — {toDelete.libelle}</strong> sera définitivement supprimé. Cette action est impossible si des écritures utilisent ce compte.</span>
        )}
        destructive
        confirmLabel="Supprimer"
      />
    </div>
  );
}

interface AccountEditorModalProps {
  open: boolean;
  editing: Account | null;
  onClose: () => void;
  onSubmit: (data: Partial<Account>) => Promise<boolean>;
}

function AccountEditorModal({ open, editing, onClose, onSubmit }: AccountEditorModalProps) {
  const [numero, setNumero] = useState("");
  const [libelle, setLibelle] = useState("");
  const [classe, setClasse] = useState<number>(6);
  const [type, setType] = useState<Account["type"]>("charge");
  const [nature, setNature] = useState<Account["nature"]>("detail");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNumero(editing?.numero || "");
      setLibelle(editing?.libelle || "");
      setClasse(editing?.classe || 6);
      setType((editing?.type as Account["type"]) || "charge");
      setNature((editing?.nature as Account["nature"]) || "detail");
    }
  }, [open, editing]);

  const handleSubmit = async () => {
    if (!numero) return toast.error("Numéro requis");
    if (!libelle) return toast.error("Libellé requis");
    setSubmitting(true);
    const ok = await onSubmit({ numero, libelle, classe, type, nature });
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-lg w-full"
          >
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold">
                {editing ? "Modifier un compte" : "Nouveau compte"}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Numéro</label>
                <Input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
                  className="mt-1 font-mono"
                  placeholder="Ex: 411500"
                  disabled={!!editing}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Libellé</label>
                <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} className="mt-1" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Classe</label>
                  <select
                    value={classe}
                    onChange={(e) => setClasse(Number(e.target.value))}
                    className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                      <option key={c} value={c}>{c} — {CLASS_LABEL[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Account["type"])}
                    className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="actif">Actif</option>
                    <option value="passif">Passif</option>
                    <option value="charge">Charge</option>
                    <option value="produit">Produit</option>
                    <option value="neutre">Neutre</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Nature</label>
                  <select
                    value={nature}
                    onChange={(e) => setNature(e.target.value as Account["nature"])}
                    className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="detail">Détail</option>
                    <option value="centralisateur">Centralisateur</option>
                    <option value="collectif">Collectif</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>Annuler</Button>
              <Button onClick={handleSubmit} loading={submitting}>
                {editing ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
