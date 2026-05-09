import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Plus, MapPin, Cloud } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import {
  AGENDA_TYPE_META, formatEventTime, getEventColor,
  type AgendaEvent,
} from "@btp/types";
import { EventEditorModal } from "./EventEditorModal";

// ═══════════════════════════════════════════════════════════════════════════
// LinkedEventsList — Liste d'événements agenda liés à un client/chantier
// Utilisable dans la fiche client (filterClientId) ou chantier (filterChantierId)
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  clientId?: string;
  chantierId?: string;
  title?: string;
}

export function LinkedEventsList({ clientId, chantierId, title }: Props) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorEvent, setEditorEvent] = useState<AgendaEvent | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    let list: AgendaEvent[] = [];
    if (chantierId && window.btpAPI?.agendaListByChantier) {
      list = await window.btpAPI.agendaListByChantier(chantierId);
    } else if (clientId && window.btpAPI?.agendaListByClient) {
      list = await window.btpAPI.agendaListByClient(clientId);
    }
    setEvents(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [clientId, chantierId]);

  const handleNewEvent = () => {
    setEditorEvent(null);
    setEditorOpen(true);
  };

  const handleClickEvent = (event: AgendaEvent) => {
    setEditorEvent(event);
    setEditorOpen(true);
  };

  // Tri : à venir en premier
  const now = Date.now();
  const upcoming = events.filter(e => new Date(e.endAt).getTime() >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const past = events.filter(e => new Date(e.endAt).getTime() < now)
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
    .slice(0, 3); // limite à 3 events passés

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">{title || "Agenda"}</h3>
          <span className="text-xs text-muted-foreground">({events.length})</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleNewEvent}>
          <Plus className="w-3.5 h-3.5" />
          Nouvel événement
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground text-center py-4">Chargement...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-6 px-4 rounded-md bg-muted/30 border border-dashed border-border">
          <Calendar className="w-6 h-6 mx-auto mb-2 text-muted-foreground/60" />
          <p className="text-xs text-muted-foreground">Aucun événement</p>
          <Button variant="ghost" size="sm" onClick={handleNewEvent} className="mt-2">
            <Plus className="w-3.5 h-3.5" />
            Créer le premier
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                À venir
              </p>
              {upcoming.map((event, idx) => (
                <EventRow
                  key={event.id}
                  event={event}
                  delay={idx * 0.04}
                  onClick={() => handleClickEvent(event)}
                />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Passés
              </p>
              {past.map((event, idx) => (
                <EventRow
                  key={event.id}
                  event={event}
                  delay={idx * 0.04}
                  onClick={() => handleClickEvent(event)}
                  faded
                />
              ))}
              {events.filter(e => new Date(e.endAt).getTime() < now).length > 3 && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/calendar")} className="w-full">
                  Voir tout l'historique
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <EventEditorModal
        open={editorOpen}
        event={editorEvent}
        defaultDate={null}
        onClose={() => setEditorOpen(false)}
        onSaved={() => fetchEvents()}
      />
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────
function EventRow({
  event,
  delay,
  onClick,
  faded = false,
}: {
  event: AgendaEvent;
  delay: number;
  onClick: () => void;
  faded?: boolean;
}) {
  const color = getEventColor(event);
  const meta = AGENDA_TYPE_META[event.type];
  const start = new Date(event.startAt);
  const dateStr = start.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: faded ? 0.6 : 1, x: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="group flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors"
    >
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{event.title || "Sans titre"}</span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", meta.bgTw)}>
            {meta.label}
          </span>
          {event.outlookEventId && (
            <Cloud className="w-3 h-3 text-blue-500 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 truncate">
          <span className="font-medium">{dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</span>
          {!event.allDay && <span>· {formatEventTime(event)}</span>}
          {event.location && (
            <span className="flex items-center gap-1 truncate">
              · <MapPin className="w-3 h-3" /> {event.location}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
