import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Trash2, Calendar, Clock, MapPin, FileText, Cloud, CloudOff } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClientSelector } from "@/components/shared/ClientSelector";
import {
  AGENDA_TYPE_META, type AgendaEvent, type AgendaEventType,
} from "@btp/types";
import { useAgendaStore } from "@/stores/agendaStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import {
  toDatetimeLocalInput, toDateInput,
  fromDatetimeLocalInput, fromDateInput,
} from "../calendarUtils";

// ═══════════════════════════════════════════════════════════════════════════
// EventEditorModal — Création / édition d'un événement agenda
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  event: AgendaEvent | null;       // null = création
  defaultDate?: Date | null;       // pour pré-remplir lors d'un clic sur une cellule
  onClose: () => void;
  onSaved: () => void;
}

const TYPE_OPTIONS: AgendaEventType[] = ["chantier", "rdv", "signature", "intervention", "autre"];

export function EventEditorModal({ open, event, defaultDate, onClose, onSaved }: Props) {
  const { create, update, remove, syncOne } = useAgendaStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AgendaEventType>("rdv");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [clientId, setClientId] = useState("");
  const [chantierId, setChantierId] = useState("");
  const [location, setLocation] = useState("");
  const [colorOverride, setColorOverride] = useState("");
  const [syncToOutlook, setSyncToOutlook] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEditing = !!event;

  // Reset form quand on ouvre
  useEffect(() => {
    if (!open) return;
    fetchChantiers();

    if (event) {
      setTitle(event.title);
      setDescription(event.description);
      setType(event.type);
      setAllDay(event.allDay);
      setStartDate(toDateInput(event.startAt));
      setStartDateTime(toDatetimeLocalInput(event.startAt));
      setEndDate(toDateInput(event.endAt));
      setEndDateTime(toDatetimeLocalInput(event.endAt));
      setClientId(event.clientId);
      setChantierId(event.chantierId);
      setLocation(event.location);
      setColorOverride(event.colorOverride);
      setSyncToOutlook(event.syncToOutlook);
    } else {
      // Création : valeurs par défaut
      const baseDate = defaultDate || new Date();
      const dateStr = toDateInput(baseDate.toISOString());
      // Heure ronde la plus proche (par défaut 9h)
      const start = new Date(baseDate);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(10, 0, 0, 0);
      setTitle("");
      setDescription("");
      setType("rdv");
      setAllDay(false);
      setStartDate(dateStr);
      setStartDateTime(toDatetimeLocalInput(start.toISOString()));
      setEndDate(dateStr);
      setEndDateTime(toDatetimeLocalInput(end.toISOString()));
      setClientId("");
      setChantierId("");
      setLocation("");
      setColorOverride("");
      setSyncToOutlook(false);
    }
    setConfirmDelete(false);
  }, [open, event?.id, defaultDate?.getTime()]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }

    const startAt = allDay
      ? fromDateInput(startDate, false)
      : fromDatetimeLocalInput(startDateTime);
    const endAt = allDay
      ? fromDateInput(endDate || startDate, true)
      : fromDatetimeLocalInput(endDateTime);

    if (!startAt || !endAt) {
      toast.error("Dates invalides");
      return;
    }
    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      toast.error("La fin doit être après le début");
      return;
    }

    const payload: Partial<AgendaEvent> = {
      title: title.trim(),
      description: description.trim(),
      type,
      allDay,
      startAt,
      endAt,
      clientId,
      chantierId,
      location: location.trim(),
      colorOverride: colorOverride.trim(),
      syncToOutlook,
    };

    setSaving(true);
    let r;
    if (isEditing && event) {
      r = await update(event.id, payload);
    } else {
      r = await create(payload);
    }
    setSaving(false);

    if (r.success) {
      toast.success(isEditing ? "Événement modifié" : "Événement créé");
      if (syncToOutlook && !isEditing) {
        toast.info("Synchronisation vers Outlook en cours...", { duration: 2500 });
      }
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setSaving(true);
    const r = await remove(event.id);
    setSaving(false);
    if (r.success) {
      toast.success("Événement supprimé");
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleSyncNow = async () => {
    if (!event) return;
    const r = await syncOne(event.id);
    if (r.success) toast.success("Synchronisé vers Outlook");
    else toast.error(r.error || "Erreur de synchronisation");
  };

  const filteredChantiers = clientId
    ? chantiers.filter((c) => c.clientId === clientId)
    : chantiers;

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
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-2xl w-full max-h-[92vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: AGENDA_TYPE_META[type].colorHex + "26", color: AGENDA_TYPE_META[type].colorHex }}
                >
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {isEditing ? "Modifier l'événement" : "Nouvel événement"}
                  </h2>
                  {isEditing && event?.outlookEventId && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Cloud className="w-3 h-3" />
                      Synchronisé avec Outlook
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Titre */}
              <div>
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: RDV métré salle de bain Dupont"
                  className="mt-1.5"
                  autoFocus
                />
              </div>

              {/* Type */}
              <div>
                <Label>Type</Label>
                <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                  {TYPE_OPTIONS.map((opt) => {
                    const meta = AGENDA_TYPE_META[opt];
                    const selected = type === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setType(opt)}
                        className={cn(
                          "py-2 px-2 rounded-md border text-xs font-medium transition-all",
                          selected
                            ? meta.bgTw
                            : "border-border bg-card hover:bg-accent text-muted-foreground"
                        )}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* All-day toggle */}
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Toute la journée</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allDay}
                  onClick={() => setAllDay(!allDay)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                    allDay ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-soft-sm transform ring-0 transition",
                      allDay ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Début</Label>
                  {allDay ? (
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1.5"
                    />
                  ) : (
                    <Input
                      type="datetime-local"
                      value={startDateTime}
                      onChange={(e) => setStartDateTime(e.target.value)}
                      className="mt-1.5"
                    />
                  )}
                </div>
                <div>
                  <Label>Fin</Label>
                  {allDay ? (
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-1.5"
                    />
                  ) : (
                    <Input
                      type="datetime-local"
                      value={endDateTime}
                      onChange={(e) => setEndDateTime(e.target.value)}
                      className="mt-1.5"
                    />
                  )}
                </div>
              </div>

              {/* Client */}
              <div>
                <Label>Client (optionnel)</Label>
                <div className="mt-1.5">
                  <ClientSelector
                    value={clientId}
                    onChange={(id) => {
                      setClientId(id);
                      // Si on change de client, on réinitialise le chantier
                      if (chantierId) {
                        const ch = chantiers.find((c) => c.id === chantierId);
                        if (ch && ch.clientId !== id) setChantierId("");
                      }
                    }}
                  />
                </div>
              </div>

              {/* Chantier */}
              <div>
                <Label htmlFor="chantier">Chantier (optionnel)</Label>
                <select
                  id="chantier"
                  value={chantierId}
                  onChange={(e) => setChantierId(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Aucun chantier</option>
                  {filteredChantiers.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.reference} · {ch.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lieu */}
              <div>
                <Label htmlFor="location">
                  <MapPin className="inline w-3.5 h-3.5 mr-1" />
                  Lieu (optionnel)
                </Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: 12 rue des Lilas, 55100 Verdun"
                  className="mt-1.5"
                />
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="desc">
                  <FileText className="inline w-3.5 h-3.5 mr-1" />
                  Notes (optionnel)
                </Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Détails additionnels..."
                  className="mt-1.5"
                />
              </div>

              {/* Sync Outlook */}
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border">
                <div className="flex items-center gap-2">
                  {syncToOutlook ? (
                    <Cloud className="w-4 h-4 text-blue-500" />
                  ) : (
                    <CloudOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm">Synchroniser avec Outlook</p>
                    <p className="text-[11px] text-muted-foreground">
                      L'événement apparaîtra dans ton calendrier Outlook
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={syncToOutlook}
                  onClick={() => setSyncToOutlook(!syncToOutlook)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                    syncToOutlook ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-soft-sm transform transition",
                      syncToOutlook ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/20">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  {confirmDelete ? (
                    <>
                      <span className="text-xs text-destructive">Confirmer ?</span>
                      <Button variant="destructive" size="sm" onClick={handleDelete} loading={saving}>
                        Oui, supprimer
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                        Annuler
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        Supprimer
                      </Button>
                      {event?.outlookEventId && (
                        <Button variant="ghost" size="sm" onClick={handleSyncNow}>
                          <Cloud className="w-3.5 h-3.5" />
                          Re-synchroniser
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button onClick={handleSubmit} loading={saving}>
                  <Save className="w-4 h-4" />
                  {isEditing ? "Enregistrer" : "Créer"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
