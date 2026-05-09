import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, RefreshCw, Cloud,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { useAgendaStore } from "@/stores/agendaStore";
import type { AgendaEvent } from "@btp/types";
import { MonthGrid } from "./MonthGrid";
import { EventEditorModal } from "./EventEditorModal";
import { buildMonthGrid, getMonthRangeIso, MONTH_NAMES } from "../calendarUtils";

// ═══════════════════════════════════════════════════════════════════════════
// AgendaPage — Page principale de l'agenda (vue mois)
// ═══════════════════════════════════════════════════════════════════════════

export function AgendaPage() {
  const { events, fetchEvents, fetchStats, syncAllToOutlook } = useAgendaStore();

  // Mois courant affiché
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // État modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorEvent, setEditorEvent] = useState<AgendaEvent | null>(null);
  const [editorDefaultDate, setEditorDefaultDate] = useState<Date | null>(null);

  const [syncing, setSyncing] = useState(false);

  // Charger les événements quand on change de mois
  useEffect(() => {
    const { rangeStart, rangeEnd } = getMonthRangeIso(year, month);
    fetchEvents(rangeStart, rangeEnd);
    fetchStats();
  }, [year, month]);

  // Construire la grille mois
  const cells = useMemo(() => buildMonthGrid(year, month, events), [year, month, events]);

  const handlePrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const handleToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  };

  const handleClickDay = (date: Date) => {
    setEditorEvent(null);
    setEditorDefaultDate(date);
    setEditorOpen(true);
  };

  const handleClickEvent = (event: AgendaEvent) => {
    setEditorEvent(event);
    setEditorDefaultDate(null);
    setEditorOpen(true);
  };

  const handleSync = async () => {
    setSyncing(true);
    const r = await syncAllToOutlook();
    setSyncing(false);
    if (r.success) {
      toast.success(`Synchronisé : ${r.pushed || 0} événement${(r.pushed || 0) > 1 ? "s" : ""} poussé${(r.pushed || 0) > 1 ? "s" : ""}`);
      const { rangeStart, rangeEnd } = getMonthRangeIso(year, month);
      fetchEvents(rangeStart, rangeEnd);
    } else if (r.needsLogin) {
      toast.error("Connecte-toi à Microsoft d'abord (Paramètres > Sauvegarde)");
    } else {
      toast.error(r.error || "Erreur de synchronisation");
    }
  };

  const handleNewEvent = () => {
    setEditorEvent(null);
    setEditorDefaultDate(new Date());
    setEditorOpen(true);
  };

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm p-4 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight">Agenda</h1>
              <p className="text-xs text-muted-foreground">
                Chantiers, rendez-vous, signatures et interventions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleSync} loading={syncing}>
              <Cloud className="w-3.5 h-3.5" />
              Sync Outlook
            </Button>
            <Button onClick={handleNewEvent} size="sm">
              <Plus className="w-4 h-4" />
              Nouvel événement
            </Button>
          </div>
        </div>

        {/* Navigation mois */}
        <div className="flex items-center justify-between mt-4 gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <motion.h2
              key={`${year}-${month}`}
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="text-lg font-semibold tracking-tight px-3 min-w-[180px] text-center"
            >
              {MONTH_NAMES[month]} {year}
            </motion.h2>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              disabled={isCurrentMonth}
              className={cn(isCurrentMonth && "opacity-60")}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Aujourd'hui
            </Button>
          </div>
        </div>
      </div>

      {/* Grille calendrier */}
      <motion.div
        key={`${year}-${month}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 overflow-hidden"
      >
        <MonthGrid
          cells={cells}
          onClickDay={handleClickDay}
          onClickEvent={handleClickEvent}
        />
      </motion.div>

      {/* Modal éditeur */}
      <EventEditorModal
        open={editorOpen}
        event={editorEvent}
        defaultDate={editorDefaultDate}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          const { rangeStart, rangeEnd } = getMonthRangeIso(year, month);
          fetchEvents(rangeStart, rangeEnd);
        }}
      />
    </div>
  );
}
