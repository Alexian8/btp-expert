import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Pencil, Trash2, Phone, Mail, ExternalLink,
  Info, Clock, FileText, PenLine, Camera, Zap, MapPin,
  Calendar, Euro, User as UserIcon, Building2, Hammer, Receipt,
  Plus, Trash, FolderOpen, Image, File, MessageSquare,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DocumentDropzone } from "@/components/shared/DocumentDropzone";
import { LinkedEventsList } from "@/features/agenda/components/LinkedEventsList";
import { SignatureModal } from "@/components/shared/SignatureModal";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useDocCategoriesStore } from "@/stores/chantierDocCategoriesStore";
import { InlineDocumentsSection } from "@/features/vault/components/InlineDocumentsSection";
import { ChantierFormModal } from "./ChantierFormModal";
import { DocCategoriesManager } from "./DocCategoriesManager";
import { CategoryBadge } from "./CategoryBadge";
import { CHANTIER_STATUS_META, CHANTIER_PRIORITY_META, QUOTE_STATUS_META, type Chantier, type ChantierPhoto } from "@btp/types";
import { CHANTIER_STATUS_ICON } from "../statusIcons";
import { formatEuros as formatEurosQuote } from "@/features/quotes/quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// ChantierDetailPage — Page dédiée avec onglets
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "infos" | "timeline" | "documents" | "signature" | "photos" | "agenda";

export function ChantierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { chantiers, fetch, delete: deleteChantier } = useChantiersStore();
  const { fetch: fetchClients, getById: getClient } = useClientsStore();

  const [activeTab, setActiveTab] = useState<Tab>("infos");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch();
    fetchClients();
  }, []);

  const chantier = chantiers.find((c) => c.id === id);

  // Ouvrir le coffre-fort filtré sur ce chantier
  const handleOpenVaultDocuments = async () => {
    if (!chantier) return;
    if (window.btpAPI?.vaultEnsureChantierFolder) {
      await window.btpAPI.vaultEnsureChantierFolder(
        chantier.id,
        chantier.title || chantier.reference || "Chantier",
        chantier.clientId
      );
    }
    navigate(`/vault?chantierId=${chantier.id}`);
  };

  if (!chantier) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/chantiers")}>
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
        <div className="mt-8 p-16 text-center bg-card border border-dashed border-border rounded-lg">
          <Hammer className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">Chantier introuvable</h3>
          <p className="text-sm text-muted-foreground">
            Ce chantier n'existe plus ou n'a jamais été créé.
          </p>
        </div>
      </div>
    );
  }

  const meta = CHANTIER_STATUS_META[chantier.status];
  const StatusIcon = CHANTIER_STATUS_ICON[chantier.status];
  const priorityMeta = CHANTIER_PRIORITY_META[chantier.priority];
  const client = getClient(chantier.clientId);

  const handleDelete = async () => {
    await deleteChantier(chantier.id);
    toast.success("Chantier supprimé");
    navigate("/chantiers");
  };

  const tabs: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
    { key: "infos",     label: "Infos",     icon: Info },
    { key: "timeline",  label: "Timeline",  icon: Clock },
    { key: "agenda",    label: "Agenda",    icon: Calendar },
    { key: "documents", label: "Documents", icon: FileText },
    { key: "photos",    label: "Photos",    icon: Camera },
    { key: "signature", label: "Signatures", icon: PenLine },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="p-4 md:p-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/chantiers")} className="mb-3">
            <ArrowLeft className="w-4 h-4" />
            Tous les chantiers
          </Button>

          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                meta.color === "slate"   && "bg-slate-500/15 text-slate-500",
                meta.color === "blue"    && "bg-blue-500/15 text-blue-500",
                meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                meta.color === "rose"    && "bg-rose-500/15 text-rose-500",
              )}>
                <StatusIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono text-muted-foreground">{chantier.reference}</p>
                <h1 className="text-xl md:text-2xl font-bold truncate">{chantier.title || "Sans titre"}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={cn(
                    "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium",
                    meta.color === "slate"   && "bg-slate-500/15 text-slate-500",
                    meta.color === "blue"    && "bg-blue-500/15 text-blue-500",
                    meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                    meta.color === "rose"    && "bg-rose-500/15 text-rose-500",
                  )}>
                    <StatusIcon className="w-3 h-3" />
                    {meta.label}
                  </span>
                  {chantier.priority === "high" && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium bg-amber-500/15 text-amber-600">
                      <Zap className="w-3 h-3" />
                      {priorityMeta.label}
                    </span>
                  )}
                  {chantier.categoryId && (
                    <CategoryBadge categoryId={chantier.categoryId} size="sm" />
                  )}
                  {chantier.nature && (
                    <span className="text-xs text-muted-foreground">· {chantier.nature}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleOpenVaultDocuments}>
                <FolderOpen className="w-3.5 h-3.5" />
                Documents
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="w-3.5 h-3.5" />
                Modifier
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          </div>

          {/* Quick actions */}
          {client && (client.phoneMobile || client.email) && (
            <div className="flex gap-2 mt-4 overflow-x-auto">
              {client.phoneMobile && (
                <a href={`tel:${client.phoneMobile}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border hover:bg-accent text-xs font-medium whitespace-nowrap">
                  <Phone className="w-3.5 h-3.5" /> Appeler le client
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border hover:bg-accent text-xs font-medium whitespace-nowrap">
                  <Mail className="w-3.5 h-3.5" /> Email
                </a>
              )}
              {(chantier.addressLine1 || chantier.city) && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent([chantier.addressLine1, chantier.postalCode, chantier.city].filter(Boolean).join(", "))}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border hover:bg-accent text-xs font-medium whitespace-nowrap">
                  <ExternalLink className="w-3.5 h-3.5" /> Carte
                </a>
              )}
            </div>
          )}
        </div>

        {/* Onglets */}
        <div className="flex gap-1 px-4 md:px-6 border-t border-border overflow-x-auto">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6">
        {activeTab === "infos"     && <TabInfos chantier={chantier} client={client} />}
        {activeTab === "timeline"  && <TabTimeline chantierId={chantier.id} />}
        {activeTab === "agenda"    && (
          <div className="bg-card border border-border rounded-lg p-4">
            <LinkedEventsList chantierId={chantier.id} title="Agenda du chantier" />
          </div>
        )}
        {activeTab === "documents" && <TabDocuments chantierId={chantier.id} />}
        {activeTab === "photos"    && <TabPhotos chantier={chantier} />}
        {activeTab === "signature" && <TabSignature chantier={chantier} client={client} />}
      </div>

      {/* Modales */}
      <ChantierFormModal open={editOpen} chantier={chantier} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Supprimer ce chantier ?"
        description="Cette action est irréversible. Photos, documents et signatures seront perdus."
        confirmLabel="Supprimer"
        destructive
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Onglet INFOS
// ═══════════════════════════════════════════════════════════════════════════
function TabInfos({ chantier, client }: { chantier: Chantier; client: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Colonne principale */}
      <div className="lg:col-span-2 space-y-4">
        {chantier.description && (
          <Card title="Description" icon={FileText}>
            <p className="text-sm whitespace-pre-wrap">{chantier.description}</p>
          </Card>
        )}

        <Card title="Localisation du chantier" icon={MapPin}>
          {(chantier.addressLine1 || chantier.city) ? (
            <div className="text-sm space-y-0.5">
              {chantier.addressLine1 && <p>{chantier.addressLine1}</p>}
              {chantier.addressLine2 && <p>{chantier.addressLine2}</p>}
              {(chantier.postalCode || chantier.city) && (
                <p>{chantier.postalCode} {chantier.city}</p>
              )}
              {chantier.country && chantier.country !== "France" && <p>{chantier.country}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune adresse renseignée</p>
          )}
        </Card>

        <Card title="Planning" icon={Calendar}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Début prévu</p>
              <p>{formatDate(chantier.startDateEstimated) || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Fin prévue</p>
              <p>{formatDate(chantier.endDateEstimated) || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Début réel</p>
              <p>{formatDate(chantier.startDateActual) || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Fin réelle</p>
              <p>{formatDate(chantier.endDateActual) || "—"}</p>
            </div>
          </div>
        </Card>

        {(chantier.budgetEstimatedHT > 0 || chantier.budgetEstimatedTTC > 0) && (
          <Card title="Budget" icon={Euro}>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-muted/40">
                <p className="text-xs text-muted-foreground mb-0.5">Budget HT</p>
                <p className="text-lg font-bold tabular-nums">{formatEuros(chantier.budgetEstimatedHT)}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/40">
                <p className="text-xs text-muted-foreground mb-0.5">Budget TTC</p>
                <p className="text-lg font-bold tabular-nums">{formatEuros(chantier.budgetEstimatedTTC)}</p>
              </div>
            </div>
          </Card>
        )}

        {chantier.notes && (
          <Card title="Notes" icon={FileText}>
            <div className="p-3 rounded-md bg-muted text-sm whitespace-pre-wrap">{chantier.notes}</div>
          </Card>
        )}

        {/* Devis liés au chantier */}
        <ChantierQuotesSection chantierId={chantier.id} />
      </div>

      {/* Colonne latérale */}
      <div className="space-y-4">
        {/* Client */}
        <Card title="Client" icon={UserIcon}>
          {client ? (
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-10 h-10 rounded-md flex items-center justify-center shrink-0",
                client.type === "pro" ? "bg-blue-500/15 text-blue-500" : "bg-violet-500/15 text-violet-500"
              )}>
                {client.type === "pro" ? <Building2 className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {client.type === "pro" && client.companyName
                    ? client.companyName
                    : `${client.firstName} ${client.lastName}`.trim() || "—"}
                </p>
                {client.city && <p className="text-xs text-muted-foreground">{client.city}</p>}
                {client.phoneMobile && <p className="text-xs font-mono text-muted-foreground mt-1">{client.phoneMobile}</p>}
                {client.email && <p className="text-xs text-muted-foreground truncate">{client.email}</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Client introuvable</p>
          )}
        </Card>

        {/* Tags */}
        {chantier.tags && chantier.tags.length > 0 && (
          <Card title="Tags" icon={FileText}>
            <div className="flex flex-wrap gap-1.5">
              {chantier.tags.map((t) => (
                <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                  {t}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Meta */}
        <Card title="Informations" icon={Info}>
          <dl className="text-xs space-y-1">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Créé le</dt>
              <dd>{formatDate(chantier.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Modifié le</dt>
              <dd>{formatDate(chantier.updatedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Priorité</dt>
              <dd>{CHANTIER_PRIORITY_META[chantier.priority].label}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Onglet TIMELINE
// ═══════════════════════════════════════════════════════════════════════════
function TabTimeline({ chantierId }: { chantierId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    if (!window.btpAPI?.chantierEventsList) return;
    setLoading(true);
    const list = await window.btpAPI.chantierEventsList(chantierId);
    setEvents(list);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [chantierId]);

  const handleAddNote = async () => {
    if (!noteInput.trim() || !window.btpAPI?.chantierEventsAddNote) return;
    setAdding(true);
    const r = await window.btpAPI.chantierEventsAddNote({
      chantierId,
      note: noteInput.trim(),
      title: noteTitle.trim() || undefined,
    });
    setAdding(false);
    if (r.success) {
      setNoteTitle("");
      setNoteInput("");
      refresh();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      {/* Ajouter une note */}
      <div className="bg-card border border-border rounded-lg p-4">
        <Label className="text-xs mb-2 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Ajouter une note à la timeline
        </Label>
        <Input
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
          placeholder="Titre (optionnel) — ex: Appel client, RDV, Acompte reçu..."
          className="mb-2"
        />
        <Textarea
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          placeholder="Détail de la note..."
          rows={2}
          className="mb-2"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAddNote} loading={adding} disabled={!noteInput.trim()}>
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Liste timeline */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground text-sm">Chargement...</div>
      ) : events.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-border rounded-lg">
          <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucun événement pour l'instant</p>
        </div>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
          <div className="space-y-4">
            {events.map((e, idx) => (
              <TimelineItem key={e.id} event={e} index={idx} onChanged={refresh} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineItem({ event, index, onChanged }: { event: any; index: number; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title || "");
  const [editDesc, setEditDesc] = useState(event.description || "");
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving] = useState(false);

  const isNote = event.kind === "note";

  const kindMeta: Record<string, { icon: any; color: string; label: string }> = {
    "created":          { icon: Plus,          color: "bg-blue-500",    label: "Création"            },
    "status-changed":   { icon: Hammer,        color: "bg-primary",     label: "Statut modifié"      },
    "note":             { icon: MessageSquare, color: "bg-slate-500",   label: "Note"                },
    "document-added":   { icon: FileText,      color: "bg-emerald-500", label: "Document ajouté"     },
    "document-removed": { icon: Trash,         color: "bg-rose-500",    label: "Document supprimé"   },
    "photo-added":      { icon: Camera,        color: "bg-violet-500",  label: "Photo ajoutée"       },
    "signed-start":     { icon: PenLine,       color: "bg-primary",     label: "PV ouverture signé"  },
    "signed-end":       { icon: PenLine,       color: "bg-emerald-500", label: "PV réception signé"  },
  };
  const meta = kindMeta[event.kind] || { icon: Info, color: "bg-muted", label: event.kind };
  const Icon = meta.icon;

  let description = event.description;
  if (event.kind === "status-changed" && event.meta) {
    const fromLabel = CHANTIER_STATUS_META[event.meta.from as keyof typeof CHANTIER_STATUS_META]?.label || event.meta.from;
    const toLabel = CHANTIER_STATUS_META[event.meta.to as keyof typeof CHANTIER_STATUS_META]?.label || event.meta.to;
    description = `${fromLabel} → ${toLabel}`;
  }

  const handleSave = async () => {
    if (!window.btpAPI?.chantierEventsUpdateNote) return;
    setSaving(true);
    const r = await window.btpAPI.chantierEventsUpdateNote({
      id: event.id,
      title: editTitle.trim() || undefined,
      description: editDesc,
    });
    setSaving(false);
    if (r.success) {
      setEditing(false);
      onChanged();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleDelete = async () => {
    if (!window.btpAPI?.chantierEventsDelete) return;
    setSaving(true);
    const r = await window.btpAPI.chantierEventsDelete(event.id);
    setSaving(false);
    if (r.success) {
      toast.success("Note supprimée");
      onChanged();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="relative group"
    >
      <div className={cn(
        "absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center",
        meta.color, "text-white"
      )}>
        <Icon className="w-2.5 h-2.5" />
      </div>
      <div className="bg-card border border-border rounded-md p-3">
        {editing && isNote ? (
          <div className="space-y-2">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Titre"
              className="h-8 text-xs"
            />
            <Textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Détail..."
              rows={2}
              className="text-xs"
            />
            <div className="flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditTitle(event.title || ""); setEditDesc(event.description || ""); }}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleSave} loading={saving}>
                Enregistrer
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium">{event.title || meta.label}</p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground font-mono">
                  {formatDateTime(event.createdAt)}
                </p>
                {isNote && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditing(true)}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      title="Modifier"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirmDel) handleDelete();
                        else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); }
                      }}
                      className={cn(
                        "p-1 rounded transition-colors",
                        confirmDel
                          ? "bg-red-500/15 text-red-600"
                          : "hover:bg-accent text-muted-foreground hover:text-destructive"
                      )}
                      title={confirmDel ? "Confirmer ?" : "Supprimer"}
                    >
                      <Trash className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{description}</p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Onglet DOCUMENTS (drag & drop)
// ═══════════════════════════════════════════════════════════════════════════
function TabDocuments({ chantierId }: { chantierId: string }) {
  // Branche maintenant sur le vrai coffre-fort (vault) via la route serveur
  // GET /api/vault/documents?chantierId=... — les uploads sont auto-liés au
  // chantier (chantierId injecté dans le payload).
  return (
    <div className="max-w-4xl">
      <InlineDocumentsSection
        chantierId={chantierId}
        defaultCategory="chantier"
        title="Documents du chantier"
        description="Plans, photos, contrats, attestations… liés à ce chantier. Stockés dans le coffre-fort."
      />
    </div>
  );
}

// Bloc legacy : conservé pour compat si jamais appelé (à supprimer plus tard)
/* eslint-disable react-hooks/rules-of-hooks -- legacy unused component, prefixed with _ */
function _LegacyTabDocumentsUnused({ chantierId }: { chantierId: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("Autre");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [categoriesManagerOpen, setCategoriesManagerOpen] = useState(false);
  const { categories, fetch: fetchCategories } = useDocCategoriesStore();

  const refresh = async () => {
    if (!window.btpAPI?.chantierDocsList) return;
    setLoading(true);
    const list = await window.btpAPI.chantierDocsList(chantierId);
    setDocs(list);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    fetchCategories();
  }, [chantierId]);

  const handleOpen = (path: string) => {
    window.btpAPI?.chantierDocsOpenExternal(path);
  };
  const handleShow = (path: string) => {
    window.btpAPI?.chantierDocsShowInFolder(path);
  };
  const handleDelete = async () => {
    if (!confirmDel || !window.btpAPI?.chantierDocsDelete) return;
    const r = await window.btpAPI.chantierDocsDelete(confirmDel);
    setConfirmDel(null);
    if (r.success) {
      toast.success("Document supprimé");
      refresh();
    } else {
      toast.error(r.error || "Erreur");
    }
  };
  const categoryNames = categories.length > 0
    ? categories.map((c) => c.name)
    : ["Autre"];

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-xs">
          <Label>Catégorie par défaut</Label>
          <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)}>
            {categoryNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCategoriesManagerOpen(true)}>
            <Tag className="w-3.5 h-3.5" />
            Gérer les catégories
          </Button>
          <p className="text-xs text-muted-foreground">
            {docs.length} document{docs.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <DocumentDropzone
        chantierId={chantierId}
        category={category}
        onUploaded={() => refresh()}
      />

      <DocCategoriesManager
        open={categoriesManagerOpen}
        onClose={() => { setCategoriesManagerOpen(false); refresh(); }}
      />

      {loading ? (
        <div className="p-12 text-center text-muted-foreground text-sm">Chargement...</div>
      ) : docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((d) => (
            <DocumentRow
              key={d.id}
              doc={d}
              onOpen={() => handleOpen(d.path)}
              onShow={() => handleShow(d.path)}
              onDelete={() => setConfirmDel(d.id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onCancel={() => setConfirmDel(null)}
        onConfirm={handleDelete}
        title="Supprimer ce document ?"
        description="Le fichier sera supprimé définitivement du stockage local."
        confirmLabel="Supprimer"
        destructive
      />
    </div>
  );
}
/* eslint-enable react-hooks/rules-of-hooks */

function DocumentRow({ doc, onOpen, onShow, onDelete }: { doc: any; onOpen: () => void; onShow: () => void; onDelete: () => void }) {
  const iconByMime = () => {
    if (!doc.mimeType) return File;
    if (doc.mimeType.startsWith("image/")) return Image;
    if (doc.mimeType === "application/pdf") return FileText;
    return File;
  };
  const Icon = iconByMime();

  return (
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-md hover:bg-accent/30 transition-colors">
      <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-1.5 py-0.5 rounded bg-muted">{doc.category}</span>
          <span>{formatBytes(doc.size)}</span>
          <span>·</span>
          <span>{formatDate(doc.createdAt)}</span>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpen} title="Ouvrir">
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onShow} title="Dans l'explorateur">
          <FolderOpen className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Onglet PHOTOS
// ═══════════════════════════════════════════════════════════════════════════
function TabPhotos({ chantier }: { chantier: Chantier }) {
  if (!chantier.photos || chantier.photos.length === 0) {
    return (
      <div className="max-w-4xl p-12 text-center border border-dashed border-border rounded-lg">
        <Camera className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground mb-1">Aucune photo pour l'instant</p>
        <p className="text-xs text-muted-foreground">
          Ajoutez des photos via le bouton "Modifier" en haut.
        </p>
      </div>
    );
  }
  return (
    <div className="max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {chantier.photos.map((p) => (
        <PhotoCard key={p.id} photo={p} />
      ))}
    </div>
  );
}

function PhotoCard({ photo }: { photo: ChantierPhoto }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!window.btpAPI?.chantiersReadPhoto) return;
      const url = await window.btpAPI.chantiersReadPhoto(photo.path);
      if (!cancelled) setDataUrl(url);
    })();
    return () => { cancelled = true; };
  }, [photo.path]);

  return (
    <div>
      <div className="aspect-video bg-muted rounded-md overflow-hidden">
        {dataUrl ? (
          <img src={dataUrl} alt={photo.caption} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Chargement...</div>
        )}
      </div>
      {photo.caption && <p className="text-xs text-muted-foreground mt-2 truncate">{photo.caption}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Onglet SIGNATURE
// ═══════════════════════════════════════════════════════════════════════════
function TabSignature({ chantier, client }: { chantier: Chantier; client: any }) {
  const [signatures, setSignatures] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState<"start" | "end" | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!window.btpAPI?.chantierSignaturesList) return;
    setLoading(true);
    const list = await window.btpAPI.chantierSignaturesList(chantier.id);
    setSignatures(list);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [chantier.id]);

  const defaultSignerName = client
    ? (client.type === "pro" && client.companyName
      ? client.companyName
      : `${client.firstName} ${client.lastName}`.trim())
    : "";

  const handleValidate = async (data: any) => {
    if (!window.btpAPI?.chantierSignaturesCreate || !modalOpen) return;
    const r = await window.btpAPI.chantierSignaturesCreate({
      chantierId: chantier.id,
      kind: modalOpen,
      signerName: data.signerName,
      signerRole: data.signerRole,
      signatureDataUrl: data.signatureDataUrl,
      notes: data.notes,
    });
    if (r.success) {
      toast.success("Signature enregistrée");
      setModalOpen(null);
      refresh();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleDelete = async () => {
    if (!confirmDel || !window.btpAPI?.chantierSignaturesDelete) return;
    const r = await window.btpAPI.chantierSignaturesDelete(confirmDel);
    setConfirmDel(null);
    if (r.success) {
      toast.success("Signature supprimée");
      refresh();
    }
  };

  const sigStart = signatures.find((s) => s.kind === "start");
  const sigEnd = signatures.find((s) => s.kind === "end");

  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Faites signer le client pour officialiser le PV d'ouverture et le PV de réception des travaux.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SignatureCard
          title="PV d'ouverture"
          description="Signature à l'ouverture du chantier"
          signature={sigStart}
          onCreate={() => setModalOpen("start")}
          onDelete={(id) => setConfirmDel(id)}
        />
        <SignatureCard
          title="PV de réception"
          description="Signature à la fin des travaux"
          signature={sigEnd}
          onCreate={() => setModalOpen("end")}
          onDelete={(id) => setConfirmDel(id)}
        />
      </div>

      <SignatureModal
        open={!!modalOpen}
        kind={modalOpen || "start"}
        defaultSignerName={defaultSignerName}
        onClose={() => setModalOpen(null)}
        onValidate={handleValidate}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onCancel={() => setConfirmDel(null)}
        onConfirm={handleDelete}
        title="Supprimer cette signature ?"
        description="La signature sera supprimée définitivement."
        confirmLabel="Supprimer"
        destructive
      />
    </div>
  );
}

function SignatureCard({
  title, description, signature, onCreate, onDelete,
}: {
  title: string; description: string; signature: any;
  onCreate: () => void; onDelete: (id: string) => void;
}) {
  const signed = !!signature;
  return (
    <div className={cn(
      "border-2 rounded-lg p-4 transition-colors",
      signed ? "border-success/40 bg-success/5" : "border-dashed border-border"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold flex items-center gap-1.5">
            <PenLine className="w-4 h-4" />
            {title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {signed && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(signature.id)}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        )}
      </div>

      {signed ? (
        <div className="space-y-2">
          <div className="bg-white rounded-md p-2 border border-border">
            <img src={signature.signatureDataUrl} alt="Signature" className="w-full max-h-32 object-contain" />
          </div>
          <dl className="text-xs space-y-0.5">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Par</dt>
              <dd className="font-medium">{signature.signerName}</dd>
            </div>
            {signature.signerRole && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Fonction</dt>
                <dd>{signature.signerRole}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Le</dt>
              <dd>{formatDateTime(signature.signedAt)}</dd>
            </div>
            {signature.notes && (
              <div className="mt-2 p-2 rounded bg-muted text-xs whitespace-pre-wrap">{signature.notes}</div>
            )}
          </dl>
        </div>
      ) : (
        <Button onClick={onCreate} variant="outline" className="w-full">
          <PenLine className="w-3.5 h-3.5" />
          Faire signer
        </Button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Card wrapper + utils
// ═══════════════════════════════════════════════════════════════════════════
function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
        <Icon className="w-3 h-3" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return iso; }
}

function formatDateTime(iso: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

function formatEuros(v: number): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ChantierQuotesSection — Liste des devis liés à ce chantier
// ═══════════════════════════════════════════════════════════════════════════
function ChantierQuotesSection({ chantierId }: { chantierId: string }) {
  const navigate = useNavigate();
  const { quotes, fetch, listByChantier } = useQuotesStore();

  useEffect(() => { fetch(); }, []);

  const linked = listByChantier(chantierId);

  return (
    <Card title={`Devis liés (${linked.length})`} icon={Receipt}>
      {linked.length === 0 ? (
        <div className="p-3 rounded-md border border-dashed border-border text-center">
          <p className="text-xs text-muted-foreground mb-2">Aucun devis lié à ce chantier</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/quotes/new")}
          >
            <Plus className="w-3.5 h-3.5" />
            Créer un devis
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {linked.map((q) => {
            const meta = QUOTE_STATUS_META[q.status];
            return (
              <button
                key={q.id}
                onClick={() => navigate(`/quotes/${q.id}`)}
                className="w-full flex items-center gap-3 p-2.5 rounded-md border border-border hover:bg-accent/40 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{q.title || "Sans titre"}</p>
                  <p className="text-xs font-mono text-muted-foreground">{q.reference}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatEurosQuote(q.totalTTC, 0)}</p>
                  <span className={cn(
                    "inline-block text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5",
                    meta.color === "slate"   && "bg-slate-500/15 text-slate-500",
                    meta.color === "blue"    && "bg-blue-500/15 text-blue-500",
                    meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                    meta.color === "rose"    && "bg-rose-500/15 text-rose-500",
                  )}>{meta.label}</span>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => navigate("/quotes/new")}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-md border border-dashed border-border hover:bg-accent/30 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter un devis
          </button>
        </div>
      )}
    </Card>
  );
}
