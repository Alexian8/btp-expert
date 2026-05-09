import { useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, ChevronRight, MapPin, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useAgendaStore } from "@/stores/agendaStore";
import { useClientsStore } from "@/stores/clientsStore";
import {
  AGENDA_TYPE_META, formatEventTime, getEventColor,
  type AgendaEvent,
} from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// UpcomingEventsWidget — Widget "Prochains RDV" pour le dashboard
// ═══════════════════════════════════════════════════════════════════════════

export function UpcomingEventsWidget() {
  const navigate = useNavigate();
  const { upcomingEvents, fetchUpcoming } = useAgendaStore();
  const clients = useClientsStore((s) => s.clients);

  useEffect(() => {
    fetchUpcoming(7);
  }, []);

  const list = upcomingEvents.slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-card border border-border rounded-lg p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Prochains rendez-vous</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/calendar")}>
          Tout voir
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          Aucun événement dans les 7 prochains jours
        </div>
      ) : (
        <div className="space-y-1.5">
          {list.map((event, idx) => (
            <EventRow
              key={event.id}
              event={event}
              clients={clients}
              delay={idx * 0.04}
              onClick={() => navigate("/calendar")}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

interface RowProps {
  event: AgendaEvent;
  clients: Array<{ id: string; type?: string; companyName?: string; firstName?: string; lastName?: string }>;
  delay: number;
  onClick: () => void;
}

function EventRow({ event, clients, delay, onClick }: RowProps) {
  const color = getEventColor(event);
  const meta = AGENDA_TYPE_META[event.type];

  // Récupérer nom client
  let clientName = "";
  if (event.clientId) {
    const c = clients.find((x) => x.id === event.clientId);
    if (c) {
      clientName = c.type === "pro" && c.companyName
        ? c.companyName
        : `${c.firstName || ""} ${c.lastName || ""}`.trim();
    }
  }

  // Format date
  const start = new Date(event.startAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const daysFromNow = Math.round((startDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  let dateLabel = "";
  if (daysFromNow === 0) dateLabel = "Aujourd'hui";
  else if (daysFromNow === 1) dateLabel = "Demain";
  else if (daysFromNow > 0 && daysFromNow < 7) {
    dateLabel = start.toLocaleDateString("fr-FR", { weekday: "long" });
    dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  } else {
    dateLabel = start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="group flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors"
    >
      {/* Pastille colorée */}
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{event.title || "Sans titre"}</span>
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
              meta.bgTw
            )}
          >
            {meta.label}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 truncate">
          <span className="font-medium">{dateLabel}</span>
          {!event.allDay && <span>· {formatEventTime(event)}</span>}
          {clientName && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 truncate">
                <User className="w-3 h-3 shrink-0" />
                {clientName}
              </span>
            </>
          )}
          {event.location && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                {event.location}
              </span>
            </>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </motion.div>
  );
}
