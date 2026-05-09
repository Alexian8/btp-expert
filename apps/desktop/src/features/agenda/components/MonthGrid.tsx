import { motion } from "framer-motion";
import { cn } from "@btp/ui";
import { AGENDA_TYPE_META, getEventColor, type AgendaEvent } from "@btp/types";
import { type MonthCell, sortEventsForDisplay, DAY_NAMES_SHORT } from "../calendarUtils";

// ═══════════════════════════════════════════════════════════════════════════
// MonthGrid — Grille calendrier mensuelle (style Outlook)
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  cells: MonthCell[];
  onClickDay: (date: Date) => void;
  onClickEvent: (event: AgendaEvent) => void;
}

export function MonthGrid({ cells, onClickDay, onClickEvent }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Entêtes des jours de la semaine */}
      <div className="grid grid-cols-7 border-b border-border bg-card/40">
        {DAY_NAMES_SHORT.map((name, idx) => (
          <div
            key={name}
            className={cn(
              "py-2 px-3 text-xs font-semibold text-center uppercase tracking-wider",
              idx >= 5 ? "text-muted-foreground/70" : "text-muted-foreground"
            )}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Grille des cellules - 6 semaines */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
        {cells.map((cell, idx) => (
          <DayCell
            key={cell.date.toISOString()}
            cell={cell}
            onClickDay={onClickDay}
            onClickEvent={onClickEvent}
            isLastCol={(idx + 1) % 7 === 0}
            isLastRow={idx >= 35}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Cellule jour ──────────────────────────────────────────────────────────
interface DayCellProps {
  cell: MonthCell;
  onClickDay: (date: Date) => void;
  onClickEvent: (event: AgendaEvent) => void;
  isLastCol: boolean;
  isLastRow: boolean;
}

function DayCell({ cell, onClickDay, onClickEvent, isLastCol, isLastRow }: DayCellProps) {
  const { date, isCurrentMonth, isToday, isWeekend, events } = cell;
  const sorted = sortEventsForDisplay(events);
  const visible = sorted.slice(0, 3);
  const hidden = sorted.length - visible.length;

  return (
    <div
      onClick={() => onClickDay(date)}
      className={cn(
        "group relative flex flex-col p-1.5 cursor-pointer transition-colors min-h-0 overflow-hidden",
        !isLastCol && "border-r border-border",
        !isLastRow && "border-b border-border",
        !isCurrentMonth && "bg-muted/30",
        isCurrentMonth && isWeekend && "bg-muted/10",
        "hover:bg-accent/30"
      )}
    >
      {/* Numéro du jour */}
      <div className="flex items-center justify-between shrink-0 mb-1">
        <span
          className={cn(
            "inline-flex items-center justify-center text-xs font-medium tabular-nums transition-all",
            isToday
              ? "w-6 h-6 rounded-full bg-primary text-primary-foreground shadow-sm font-bold"
              : !isCurrentMonth
              ? "text-muted-foreground/50 px-1"
              : "text-foreground px-1"
          )}
        >
          {date.getDate()}
        </span>
      </div>

      {/* Événements visibles */}
      <div className="flex-1 min-h-0 flex flex-col gap-0.5 overflow-hidden">
        {visible.map((event, i) => (
          <EventChip
            key={event.id}
            event={event}
            onClick={(e) => {
              e.stopPropagation();
              onClickEvent(event);
            }}
            delay={i * 0.02}
          />
        ))}

        {hidden > 0 && (
          <div className="text-[10.5px] text-muted-foreground font-medium px-1.5 py-0.5 leading-tight">
            +{hidden} autre{hidden > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chip d'événement ─────────────────────────────────────────────────────
function EventChip({
  event,
  onClick,
  delay = 0,
}: {
  event: AgendaEvent;
  onClick: (e: React.MouseEvent) => void;
  delay?: number;
}) {
  const color = getEventColor(event);
  const meta = AGENDA_TYPE_META[event.type];

  // Heure de début si pas all-day
  const startTime = !event.allDay ? formatTime(event.startAt) : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -2 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15, delay }}
      onClick={onClick}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium leading-tight cursor-pointer hover:scale-[1.02] hover:shadow-sm transition-all overflow-hidden"
      style={{
        backgroundColor: color + "26", // ~15% opacity
        color: color,
        borderLeft: `2.5px solid ${color}`,
      }}
      title={`${meta.label} : ${event.title}`}
    >
      {startTime && <span className="tabular-nums opacity-70 shrink-0">{startTime}</span>}
      <span className="truncate">{event.title || "Sans titre"}</span>
    </motion.div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}h${d.getMinutes() > 0 ? String(d.getMinutes()).padStart(2, "0") : ""}`;
  } catch {
    return "";
  }
}
