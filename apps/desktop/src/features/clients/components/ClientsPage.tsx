import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Search, Plus, Building2, User as UserIcon, MapPin, Phone, MessageSquare,
  Mail, LayoutGrid, List, Trash2, Eye, Pencil, Download, Tags, HardHat, ChevronLeft, ChevronRight,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useClientsStore } from "@/stores/clientsStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useClientTagsStore } from "@/stores/clientTagsStore";
import type { Client, ContactType, Chantier } from "@btp/types";
import { ClientFormModal } from "./ClientFormModal";
import { ClientDetailModal } from "./ClientDetailModal";
import { ClientTagsManager } from "./ClientTagsManager";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TableScroller } from "@/components/shared/TableScroller";
import { downloadCsv } from "@/lib/exportCsv";
import { telHref, smsHref } from "@/lib/phoneFormat";
import {
  clientDisplayName, clientInitials, avatarColorClass, tagChipClass, hasAddress,
} from "@/lib/clientHelpers";

// ═══════════════════════════════════════════════════════════════════════════
// ClientsPage — Annuaire clients : filtres métier, pagination, avatars,
// raccourcis d'action tactiles (appel / mail / SMS), badge multi-chantiers.
// ═══════════════════════════════════════════════════════════════════════════

type ViewMode = "list" | "grid";
type StateFilter = "all" | "prospect" | "en-cours" | "termine";
const PAGE_SIZE = 25;

/** État "métier" d'un client d'après ses chantiers. */
function clientState(chs: Chantier[]): StateFilter {
  if (chs.some((c) => c.status === "en-cours")) return "en-cours";
  if (chs.some((c) => c.status === "termine")) return "termine";
  return "prospect";
}

export function ClientsPage() {
  const { clients, isLoading, fetch, delete: deleteClient } = useClientsStore();
  const chantiers = useChantiersStore((s) => s.chantiers);
  const fetchChantiers = useChantiersStore((s) => s.fetch);
  const tags = useClientTagsStore((s) => s.tags);
  const loadTags = useClientTagsStore((s) => s.load);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | ContactType>("all");
  const [filterCity, setFilterCity] = useState("all");
  const [filterState, setFilterState] = useState<StateFilter>("all");
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [tagsManagerOpen, setTagsManagerOpen] = useState(false);

  useEffect(() => {
    fetch();
    fetchChantiers();
    void loadTags();
  }, []);

  // Chantiers regroupés par client
  const chantiersByClient = useMemo(() => {
    const m = new Map<string, Chantier[]>();
    for (const c of chantiers) {
      if (!c.clientId) continue;
      const arr = m.get(c.clientId) ?? [];
      arr.push(c);
      m.set(c.clientId, arr);
    }
    return m;
  }, [chantiers]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => c.city && set.add(c.city));
    return ["all", ...Array.from(set).sort()];
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = clients.filter((c) => {
      if (filterType !== "all" && c.type !== filterType) return false;
      if (filterCity !== "all" && c.city !== filterCity) return false;
      if (filterState !== "all" && clientState(chantiersByClient.get(c.id) ?? []) !== filterState) return false;
      if (filterTags.size > 0 && !(c.tags ?? []).some((t) => filterTags.has(t))) return false;
      if (q) {
        const hay = [
          c.firstName, c.lastName, c.companyName, c.email, c.phoneMobile,
          c.phoneFixed, c.city, c.postalCode, c.addressLine1, c.siret,
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b)));
    return list;
  }, [clients, search, filterType, filterCity, filterState, filterTags, chantiersByClient]);

  // Reset de page quand les filtres changent
  useEffect(() => { setPage(0); }, [search, filterType, filterCity, filterState, filterTags, viewMode]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const handleEdit = (c: Client) => { setEditingClient(c); setFormOpen(true); setDetailClient(null); };
  const handleNew = () => { setEditingClient(null); setFormOpen(true); };
  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteClient(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const toggleTagFilter = (id: string) => {
    setFilterTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportCsv = () => {
    downloadCsv(
      "clients",
      ["Type", "Société", "Nom", "Prénom", "Email", "Tél. mobile", "Ville", "SIRET", "Chantiers", "Étiquettes"],
      filtered.map((c) => [
        c.type === "pro" ? "Professionnel" : "Particulier",
        c.companyName || "", c.lastName || "", c.firstName || "",
        c.email || "", c.phoneMobile || "", c.city || "", c.siret || "",
        String((chantiersByClient.get(c.id) ?? []).length),
        (c.tags ?? []).map((id) => tags.find((t) => t.id === id)?.label ?? id).join(" · "),
      ])
    );
  };

  const hasActiveFilters = filterType !== "all" || filterCity !== "all" || filterState !== "all" || filterTags.size > 0;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6" /> Clients
          </h1>
          <p className="text-muted-foreground mt-1">
            {clients.length} client{clients.length > 1 ? "s" : ""} · {filtered.length} affiché{filtered.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setTagsManagerOpen(true)} className="h-11">
            <Tags className="w-4 h-4" /> Étiquettes
          </Button>
          <Button variant="outline" onClick={handleExportCsv} disabled={filtered.length === 0} className="h-11">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button onClick={handleNew} className="h-11">
            <Plus className="w-4 h-4" /> Nouveau client
          </Button>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="bg-card border border-border rounded-lg p-3 mb-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client…" className="pl-9 h-11" />
          </div>
          <NativeSelect value={filterState} onChange={(e) => setFilterState(e.target.value as StateFilter)} className="w-auto min-w-[150px] h-11">
            <option value="all">Tous les états</option>
            <option value="prospect">Prospects</option>
            <option value="en-cours">Chantiers en cours</option>
            <option value="termine">Historique terminé</option>
          </NativeSelect>
          <NativeSelect value={filterType} onChange={(e) => setFilterType(e.target.value as "all" | ContactType)} className="w-auto min-w-[130px] h-11">
            <option value="all">Tous types</option>
            <option value="particulier">Particuliers</option>
            <option value="pro">Professionnels</option>
          </NativeSelect>
          <NativeSelect value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-auto min-w-[140px] h-11">
            {cities.map((c) => <option key={c} value={c}>{c === "all" ? "Toutes villes" : c}</option>)}
          </NativeSelect>
          <div className="inline-flex rounded-md border border-border p-0.5 h-11">
            <button onClick={() => setViewMode("list")} className={cn("px-3 rounded flex items-center", viewMode === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground")} title="Vue liste">
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("grid")} className={cn("px-3 rounded flex items-center", viewMode === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground")} title="Vue cartes">
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Étiquettes (filtre cumulatif) */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Étiquettes :</span>
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleTagFilter(t.id)}
                className={cn(
                  "text-sm px-2.5 py-1 rounded-full border transition-all",
                  filterTags.has(t.id) ? tagChipClass(t.color) + " ring-1 ring-current" : "border-border text-muted-foreground hover:bg-accent/50"
                )}
              >
                {t.label}
              </button>
            ))}
            {hasActiveFilters && (
              <button
                onClick={() => { setFilterType("all"); setFilterCity("all"); setFilterState("all"); setFilterTags(new Set()); }}
                className="text-xs text-primary hover:underline ml-1"
              >
                Réinitialiser
              </button>
            )}
          </div>
        )}
      </div>

      {/* Liste / grille */}
      {isLoading ? (
        <SkeletonRows rows={8} cols={3} />
      ) : filtered.length === 0 ? (
        <EmptyState hasClients={clients.length > 0} onNew={handleNew} />
      ) : viewMode === "list" ? (
        <ClientsTable
          clients={pageItems}
          tags={tags}
          chantiersByClient={chantiersByClient}
          onView={setDetailClient}
          onEdit={handleEdit}
          onDelete={(id) => setConfirmDeleteId(id)}
        />
      ) : (
        <ClientsGrid
          clients={pageItems}
          tags={tags}
          chantiersByClient={chantiersByClient}
          onView={setDetailClient}
          onEdit={handleEdit}
        />
      )}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} sur {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: pageCount }).slice(Math.max(0, page - 2), Math.max(0, page - 2) + 5).map((_, i) => {
              const p = Math.max(0, page - 2) + i;
              return (
                <button key={p} onClick={() => setPage(p)} className={cn("min-w-10 h-10 px-2 rounded-md text-sm font-medium", p === page ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent")}>
                  {p + 1}
                </button>
              );
            })}
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modales */}
      <ClientFormModal open={formOpen} client={editingClient} onClose={() => setFormOpen(false)} />
      <ClientDetailModal client={detailClient} onClose={() => setDetailClient(null)} onEdit={() => detailClient && handleEdit(detailClient)} />
      <ClientTagsManager open={tagsManagerOpen} onClose={() => setTagsManagerOpen(false)} />
      <ConfirmDialog
        open={!!confirmDeleteId}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer ce client ?"
        description="Cette action est irréversible. Les chantiers et factures liés ne seront pas supprimés mais perdront leur lien vers ce client."
        confirmLabel="Supprimer"
        destructive
      />
    </div>
  );
}

// ─── Éléments partagés ─────────────────────────────────────────────────────
type TagDef = { id: string; label: string; color: string };

function Avatar({ client, size = "md" }: { client: Client; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "w-12 h-12 text-base" : "w-10 h-10 text-sm";
  return (
    <div className={cn("rounded-full flex items-center justify-center font-semibold shrink-0 uppercase", dim, avatarColorClass(client.id))}>
      {clientInitials(client)}
    </div>
  );
}

function ChantierBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-blue-200 shrink-0"
      style={{ backgroundColor: "#1e293b" }}
      title={`${count} chantier${count > 1 ? "s" : ""}`}
    >
      <HardHat className="w-3 h-3" />
      {count} chantier{count > 1 ? "s" : ""}
    </span>
  );
}

function TagChips({ ids, tags }: { ids: string[]; tags: TagDef[] }) {
  const defs = ids.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as TagDef[];
  if (defs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {defs.map((t) => (
        <span key={t.id} className={cn("text-[11px] px-2 py-0.5 rounded-full border", tagChipClass(t.color))}>{t.label}</span>
      ))}
    </div>
  );
}

/** Boutons d'action colorés (appel vert, mail bleu, SMS orange). Massifs, tactiles. */
function ContactActions({ client, size = "sm" }: { client: Client; size?: "sm" | "lg" }) {
  const phone = client.phoneMobile || client.phoneFixed;
  const pad = size === "lg" ? "px-3 py-2 text-sm" : "px-2.5 py-1.5 text-[13px]";
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const badge = "inline-flex items-center gap-1.5 rounded-md font-medium transition-transform duration-150 hover:scale-105 active:scale-95";
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {phone && (
        <a href={telHref(phone)} onClick={stop} className={cn(badge, pad)} style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981" }} title={`Appeler ${phone}`}>
          <Phone className="w-4 h-4" /> {size === "lg" ? phone : "Appeler"}
        </a>
      )}
      {phone && (
        <a href={smsHref(phone)} onClick={stop} className={cn(badge, pad)} style={{ backgroundColor: "rgba(249,115,22,0.12)", color: "#f97316" }} title="Envoyer un SMS">
          <MessageSquare className="w-4 h-4" /> SMS
        </a>
      )}
      {client.email && (
        <a href={`mailto:${client.email}`} onClick={stop} className={cn(badge, "min-w-0", pad)} style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6" }} title={`Écrire à ${client.email}`}>
          <Mail className="w-4 h-4 shrink-0" /> <span className="truncate">{size === "lg" ? client.email : "Email"}</span>
        </a>
      )}
    </div>
  );
}

function EmptyState({ hasClients, onNew }: { hasClients: boolean; onNew: () => void }) {
  return (
    <div className="p-16 text-center bg-card border border-dashed border-border rounded-lg">
      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
        <Users className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">{hasClients ? "Aucun résultat" : "Aucun client pour l'instant"}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
        {hasClients ? "Essayez d'ajuster vos filtres ou votre recherche." : "Créez votre premier client pour démarrer."}
      </p>
      {!hasClients && <Button onClick={onNew}><Plus className="w-4 h-4" /> Créer mon premier client</Button>}
    </div>
  );
}

// ─── Vue tableau (desktop) + cartes (mobile) ───────────────────────────────
function ClientsTable({ clients, tags, chantiersByClient, onView, onEdit, onDelete }: {
  clients: Client[]; tags: TagDef[]; chantiersByClient: Map<string, Chantier[]>;
  onView: (c: Client) => void; onEdit: (c: Client) => void; onDelete: (id: string) => void;
}) {
  return (
    <>
      {/* Cartes mobile */}
      <div className="md:hidden space-y-2">
        {clients.map((c) => (
          <div key={c.id} onClick={() => onView(c)} className="bg-card border border-border rounded-lg p-3 active:bg-accent/40 cursor-pointer">
            <div className="flex items-center gap-3">
              <Avatar client={c} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{clientDisplayName(c)}</p>
                  <ChantierBadge count={(chantiersByClient.get(c.id) ?? []).length} />
                </div>
                <p className="text-sm text-muted-foreground truncate">{[c.city, c.type === "pro" ? "Pro" : "Particulier"].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="mt-2"><TagChips ids={c.tags ?? []} tags={tags} /></div>
            <div className="mt-2.5"><ContactActions client={c} /></div>
          </div>
        ))}
      </div>

      {/* Tableau desktop */}
      <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden">
        <TableScroller>
          <table className="w-full text-base">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Client</th>
                <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Ville</th>
                <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Contact</th>
                <th className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Étiquettes</th>
                <th className="text-right font-medium px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors" onClick={() => onView(c)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar client={c} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{clientDisplayName(c)}</p>
                          <ChantierBadge count={(chantiersByClient.get(c.id) ?? []).length} />
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          {c.type === "pro" ? <Building2 className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                          {c.type === "pro" ? "Professionnel" : "Particulier"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.city || "—"}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><ContactActions client={c} /></td>
                  <td className="px-4 py-3"><TagChips ids={c.tags ?? []} tags={tags} /></td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => onView(c)} title="Voir"><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => onEdit(c)} title="Modifier"><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => onDelete(c.id)} title="Supprimer"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>
      </div>
    </>
  );
}

function ClientsGrid({ clients, tags, chantiersByClient, onView, onEdit }: {
  clients: Client[]; tags: TagDef[]; chantiersByClient: Map<string, Chantier[]>;
  onView: (c: Client) => void; onEdit: (c: Client) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {clients.map((c, idx) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(idx * 0.02, 0.3) }}
          onClick={() => onView(c)}
          className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 cursor-pointer transition-all"
        >
          <div className="flex items-start gap-3">
            <Avatar client={c} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold truncate text-lg">{clientDisplayName(c)}</p>
                <ChantierBadge count={(chantiersByClient.get(c.id) ?? []).length} />
              </div>
              {hasAddress(c) && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" /> {[c.city, c.postalCode].filter(Boolean).join(" ")}
                </p>
              )}
              <div className="mt-2"><TagChips ids={c.tags ?? []} tags={tags} /></div>
            </div>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={(e) => { e.stopPropagation(); onEdit(c); }} title="Modifier">
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-3 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
            <ContactActions client={c} size="lg" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
