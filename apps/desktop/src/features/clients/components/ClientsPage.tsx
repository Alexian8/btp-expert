import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  Plus,
  Building2,
  User as UserIcon,
  MapPin,
  Phone,
  Mail,
  Filter,
  LayoutGrid,
  List,
  Trash2,
  Eye,
  Pencil,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useClientsStore } from "@/stores/clientsStore";
import type { Client, ContactType } from "@btp/types";
import { ClientFormModal } from "./ClientFormModal";
import { ClientDetailModal } from "./ClientDetailModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

// ═══════════════════════════════════════════════════════════════════════════
// ClientsPage — Liste des clients avec recherche, filtres, tri
// ═══════════════════════════════════════════════════════════════════════════

type SortKey = "name" | "city" | "createdAt";
type ViewMode = "list" | "grid";

export function ClientsPage() {
  const { clients, isLoading, fetch, delete: deleteClient } = useClientsStore();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | ContactType>("all");
  const [filterCity, setFilterCity] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch();
  }, []);

  // ─── Liste des villes distinctes pour le filtre ─────────────────────────
  const cities = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => c.city && set.add(c.city));
    return ["all", ...Array.from(set).sort()];
  }, [clients]);

  // ─── Filtrage + tri ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = clients.filter((c) => {
      if (filterType !== "all" && c.type !== filterType) return false;
      if (filterCity !== "all" && c.city !== filterCity) return false;
      if (q) {
        const haystack = [
          c.firstName, c.lastName, c.companyName,
          c.email, c.phoneMobile, c.phoneFixed,
          c.city, c.postalCode, c.addressLine1,
          c.siret, c.tvaIntracom,
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortKey === "name") {
        const an = (a.companyName || `${a.lastName} ${a.firstName}`).toLowerCase();
        const bn = (b.companyName || `${b.lastName} ${b.firstName}`).toLowerCase();
        return an.localeCompare(bn);
      }
      if (sortKey === "city") return (a.city || "").localeCompare(b.city || "");
      if (sortKey === "createdAt") return (b.createdAt || "").localeCompare(a.createdAt || "");
      return 0;
    });

    return list;
  }, [clients, search, filterType, filterCity, sortKey]);

  // ─── Actions ────────────────────────────────────────────────────────────
  const handleEdit = (c: Client) => {
    setEditingClient(c);
    setFormOpen(true);
    setDetailClient(null);
  };

  const handleNew = () => {
    setEditingClient(null);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteClient(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6" /> Clients
          </h1>
          <p className="text-muted-foreground mt-1">
            {clients.length} client{clients.length > 1 ? "s" : ""} dans votre base
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4" />
          Nouveau client
        </Button>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="bg-card border border-border rounded-lg p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="pl-9"
          />
        </div>
        <NativeSelect
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="w-auto min-w-[140px]"
        >
          <option value="all">Tous types</option>
          <option value="particulier">Particuliers</option>
          <option value="pro">Professionnels</option>
        </NativeSelect>
        <NativeSelect
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="w-auto min-w-[140px]"
        >
          {cities.map((c) => (
            <option key={c} value={c}>{c === "all" ? "Toutes villes" : c}</option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="w-auto min-w-[140px]"
        >
          <option value="name">Tri : Nom</option>
          <option value="city">Tri : Ville</option>
          <option value="createdAt">Tri : Récent</option>
        </NativeSelect>

        <div className="inline-flex rounded-md border border-border p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "px-2 py-1.5 rounded text-xs transition-colors",
              viewMode === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
            title="Vue liste"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "px-2 py-1.5 rounded text-xs transition-colors",
              viewMode === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
            title="Vue grille"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground">Chargement...</div>
      ) : filtered.length === 0 ? (
        <EmptyState hasClients={clients.length > 0} onNew={handleNew} />
      ) : viewMode === "list" ? (
        <ClientsTable
          clients={filtered}
          onView={setDetailClient}
          onEdit={handleEdit}
          onDelete={(id) => setConfirmDeleteId(id)}
        />
      ) : (
        <ClientsGrid
          clients={filtered}
          onView={setDetailClient}
          onEdit={handleEdit}
          onDelete={(id) => setConfirmDeleteId(id)}
        />
      )}

      {/* Modales */}
      <ClientFormModal
        open={formOpen}
        client={editingClient}
        onClose={() => setFormOpen(false)}
      />
      <ClientDetailModal
        client={detailClient}
        onClose={() => setDetailClient(null)}
        onEdit={() => detailClient && handleEdit(detailClient)}
      />
      <ConfirmDialog
        open={!!confirmDeleteId}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer ce client ?"
        description="Cette action est irréversible. Les chantiers et factures liés ne seront pas supprimés mais ils perdront leur lien vers ce client."
        confirmLabel="Supprimer"
        destructive
      />
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────
function EmptyState({ hasClients, onNew }: { hasClients: boolean; onNew: () => void }) {
  return (
    <div className="p-16 text-center bg-card border border-dashed border-border rounded-lg">
      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
        <Users className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">
        {hasClients ? "Aucun résultat" : "Aucun client pour l'instant"}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
        {hasClients
          ? "Essayez d'ajuster vos filtres ou votre recherche."
          : "Créez votre premier client pour démarrer. Vous pourrez ensuite y associer des chantiers et des devis."}
      </p>
      {!hasClients && (
        <Button onClick={onNew}>
          <Plus className="w-4 h-4" />
          Créer mon premier client
        </Button>
      )}
    </div>
  );
}

// ─── Vue table ──────────────────────────────────────────────────────────
function ClientsTable({
  clients,
  onView,
  onEdit,
  onDelete,
}: {
  clients: Client[];
  onView: (c: Client) => void;
  onEdit: (c: Client) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      {/* ─── Cartes mobile (< md) ─────────────────────────────────────── */}
      <div className="md:hidden space-y-2">
        {clients.map((c, idx) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.02, 0.3) }}
            onClick={() => onView(c)}
            className="bg-card border border-border rounded-lg p-3 active:bg-accent/40 cursor-pointer flex items-center gap-3"
          >
            <div
              className={cn(
                "w-10 h-10 rounded-md flex items-center justify-center shrink-0",
                c.type === "pro"
                  ? "bg-blue-500/15 text-blue-500"
                  : "bg-violet-500/15 text-violet-500"
              )}
            >
              {c.type === "pro" ? (
                <Building2 className="w-4 h-4" />
              ) : (
                <UserIcon className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">
                {c.type === "pro" && c.companyName
                  ? c.companyName
                  : `${c.firstName} ${c.lastName}`.trim() || "—"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {[c.city, c.phoneMobile || c.phoneFixed, c.email]
                  .filter(Boolean)
                  .slice(0, 2)
                  .join(" · ") || "—"}
              </p>
            </div>
            <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(c)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDelete(c.id)}
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
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Ville</th>
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Téléphone</th>
              <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Email</th>
              <th className="text-right font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c, idx) => (
              <motion.tr
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                onClick={() => onView(c)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                      c.type === "pro" ? "bg-blue-500/15 text-blue-500" : "bg-violet-500/15 text-violet-500"
                    )}>
                      {c.type === "pro" ? <Building2 className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {c.type === "pro" && c.companyName ? c.companyName : `${c.firstName} ${c.lastName}`.trim() || "—"}
                      </p>
                      {c.type === "pro" && (c.firstName || c.lastName) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {c.firstName} {c.lastName}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.city || "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {c.phoneMobile || c.phoneFixed || "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                  {c.email || "—"}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(c)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(c.id)}>
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

// ─── Vue grille ─────────────────────────────────────────────────────────
function ClientsGrid({
  clients,
  onView,
  onEdit,
  onDelete,
}: {
  clients: Client[];
  onView: (c: Client) => void;
  onEdit: (c: Client) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {clients.map((c, idx) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(idx * 0.02, 0.3) }}
          onClick={() => onView(c)}
          className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 hover:shadow-soft-md cursor-pointer transition-all"
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              "w-10 h-10 rounded-md flex items-center justify-center shrink-0",
              c.type === "pro" ? "bg-blue-500/15 text-blue-500" : "bg-violet-500/15 text-violet-500"
            )}>
              {c.type === "pro" ? <Building2 className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">
                {c.type === "pro" && c.companyName ? c.companyName : `${c.firstName} ${c.lastName}`.trim() || "—"}
              </p>
              {c.type === "pro" && (c.firstName || c.lastName) && (
                <p className="text-xs text-muted-foreground truncate">
                  {c.firstName} {c.lastName}
                </p>
              )}
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {c.city && (
                  <p className="flex items-center gap-1.5 truncate"><MapPin className="w-3 h-3 shrink-0" /> {c.city}</p>
                )}
                {(c.phoneMobile || c.phoneFixed) && (
                  <p className="flex items-center gap-1.5 truncate"><Phone className="w-3 h-3 shrink-0" /> {c.phoneMobile || c.phoneFixed}</p>
                )}
                {c.email && (
                  <p className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 shrink-0" /> {c.email}</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
