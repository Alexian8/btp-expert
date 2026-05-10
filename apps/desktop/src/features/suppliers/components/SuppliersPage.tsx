import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Package, Search, Plus, Building2, MapPin, Phone, Mail,
  LayoutGrid, List, Trash2, Eye, Pencil,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useSuppliersStore } from "@/stores/suppliersStore";
import { SUPPLIER_CATEGORIES, type Supplier } from "@btp/types";
import { SupplierFormModal } from "./SupplierFormModal";
import { SupplierDetailModal } from "./SupplierDetailModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

// ═══════════════════════════════════════════════════════════════════════════
// SuppliersPage — Liste des fournisseurs
// ═══════════════════════════════════════════════════════════════════════════

type ViewMode = "list" | "grid";

export function SuppliersPage() {
  const { suppliers, isLoading, fetch, delete: deleteSupplier } = useSuppliersStore();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [detail, setDetail] = useState<Supplier | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (filterCategory !== "all" && s.category !== filterCategory) return false;
      if (q) {
        const haystack = [
          s.companyName, s.contactFirstName, s.contactLastName,
          s.email, s.phoneMobile, s.city, s.postalCode, s.siret,
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [suppliers, search, filterCategory]);

  const handleEdit = (s: Supplier) => {
    setEditing(s);
    setFormOpen(true);
    setDetail(null);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteSupplier(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6" /> Fournisseurs
          </h1>
          <p className="text-muted-foreground mt-1">
            {suppliers.length} fournisseur{suppliers.length > 1 ? "s" : ""} dans votre base
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="w-4 h-4" />
          Nouveau fournisseur
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-9" />
        </div>
        <NativeSelect value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-auto min-w-[160px]">
          <option value="all">Toutes catégories</option>
          {SUPPLIER_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </NativeSelect>
        <div className="inline-flex rounded-md border border-border p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={cn("px-2 py-1.5 rounded transition-colors",
              viewMode === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn("px-2 py-1.5 rounded transition-colors",
              viewMode === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center bg-card border border-dashed border-border rounded-lg">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
            <Package className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">
            {suppliers.length > 0 ? "Aucun résultat" : "Aucun fournisseur pour l'instant"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            {suppliers.length > 0
              ? "Ajustez vos filtres ou votre recherche."
              : "Ajoutez vos fournisseurs habituels pour suivre les achats et factures reçues."}
          </p>
          {suppliers.length === 0 && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="w-4 h-4" />
              Créer mon premier fournisseur
            </Button>
          )}
        </div>
      ) : viewMode === "list" ? (
        <SuppliersTable suppliers={filtered} onView={setDetail} onEdit={handleEdit} onDelete={setConfirmDeleteId} />
      ) : (
        <SuppliersGrid suppliers={filtered} onView={setDetail} onEdit={handleEdit} onDelete={setConfirmDeleteId} />
      )}

      <SupplierFormModal open={formOpen} supplier={editing} onClose={() => setFormOpen(false)} />
      <SupplierDetailModal supplier={detail} onClose={() => setDetail(null)} onEdit={() => detail && handleEdit(detail)} />
      <ConfirmDialog
        open={!!confirmDeleteId}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer ce fournisseur ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        destructive
      />
    </div>
  );
}

function SuppliersTable({
  suppliers, onView, onEdit, onDelete,
}: {
  suppliers: Supplier[];
  onView: (s: Supplier) => void;
  onEdit: (s: Supplier) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      {/* ─── Cartes mobile (< md) ─────────────────────────────────────── */}
      <div className="md:hidden space-y-2">
        {suppliers.map((s, idx) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.02, 0.3) }}
            onClick={() => onView(s)}
            className="bg-card border border-border rounded-lg p-3 active:bg-accent/40 cursor-pointer flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-md bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{s.companyName || "—"}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {s.category && (
                  <span className="px-1.5 py-0.5 rounded bg-muted">{s.category}</span>
                )}
                {s.city && <span>{s.city}</span>}
                {(s.phoneMobile || s.phoneFixed) && (
                  <span className="font-mono">{s.phoneMobile || s.phoneFixed}</span>
                )}
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(s)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDelete(s.id)}
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── Tableau desktop (≥ md) ───────────────────────────────────── */}
      <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Nom</th>
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Catégorie</th>
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Ville</th>
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Téléphone</th>
              <th className="text-right font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s, idx) => (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer"
                onClick={() => onView(s)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.companyName || "—"}</p>
                      {(s.contactFirstName || s.contactLastName) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {s.contactFirstName} {s.contactLastName}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s.category}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.city || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.phoneMobile || s.phoneFixed || "—"}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(s)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(s)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(s.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </>
  );
}

function SuppliersGrid({
  suppliers, onView,
}: {
  suppliers: Supplier[];
  onView: (s: Supplier) => void;
  onEdit: (s: Supplier) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {suppliers.map((s, idx) => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(idx * 0.02, 0.3) }}
          onClick={() => onView(s)}
          className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 hover:shadow-soft-md cursor-pointer transition-all"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{s.companyName || "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="px-1.5 py-0.5 rounded bg-muted">{s.category}</span>
              </p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {s.city && <p className="flex items-center gap-1.5 truncate"><MapPin className="w-3 h-3 shrink-0" /> {s.city}</p>}
                {(s.phoneMobile || s.phoneFixed) && (
                  <p className="flex items-center gap-1.5 truncate"><Phone className="w-3 h-3 shrink-0" /> {s.phoneMobile || s.phoneFixed}</p>
                )}
                {s.email && <p className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 shrink-0" /> {s.email}</p>}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
