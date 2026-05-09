import type { AgendaEvent } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// calendarUtils — Helpers pour générer la grille mois
// ═══════════════════════════════════════════════════════════════════════════

export interface MonthCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: AgendaEvent[];
}

/**
 * Génère la grille du mois (matrice 6x7 = 42 cellules)
 * Commence au lundi de la semaine contenant le 1er du mois
 */
export function buildMonthGrid(year: number, month: number, events: AgendaEvent[]): MonthCell[] {
  const cells: MonthCell[] = [];

  // Premier du mois
  const firstOfMonth = new Date(year, month, 1);
  // Trouver le lundi qui précède (ou égale)
  const dayOfWeek = firstOfMonth.getDay() || 7; // dim = 7
  const startDate = new Date(firstOfMonth);
  startDate.setDate(firstOfMonth.getDate() - (dayOfWeek - 1));

  // Aujourd'hui
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Générer 6 semaines × 7 jours = 42 cellules
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    date.setHours(0, 0, 0, 0);

    // Filtrer les événements de cette date
    const cellEvents = events.filter((e) => isEventOnDate(e, date));

    cells.push({
      date,
      isCurrentMonth: date.getMonth() === month,
      isToday: date.getTime() === today.getTime(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      events: cellEvents,
    });
  }

  return cells;
}

/**
 * Un événement est-il sur cette date ?
 * Pour les événements multi-jours, on les considère présents sur tous les jours.
 */
export function isEventOnDate(event: AgendaEvent, date: Date): boolean {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

/**
 * Range ISO pour la requête backend (inclus toute la grille mois)
 */
export function getMonthRangeIso(year: number, month: number): { rangeStart: string; rangeEnd: string } {
  const firstOfMonth = new Date(year, month, 1);
  const dayOfWeek = firstOfMonth.getDay() || 7;
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - (dayOfWeek - 1));
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  end.setHours(23, 59, 59, 999);

  return {
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
  };
}

/**
 * Trie les événements pour affichage : all-day en premier, puis par heure
 */
export function sortEventsForDisplay(events: AgendaEvent[]): AgendaEvent[] {
  return [...events].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  });
}

/**
 * Format pour input HTML datetime-local
 */
export function toDatetimeLocalInput(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

/**
 * Format pour input HTML date
 */
export function toDateInput(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return "";
  }
}

/**
 * Convertit un input datetime-local en ISO UTC
 */
export function fromDatetimeLocalInput(value: string): string {
  if (!value) return "";
  return new Date(value).toISOString();
}

/**
 * Convertit un input date (sans heure) en ISO UTC à minuit
 */
export function fromDateInput(value: string, atEndOfDay = false): string {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  if (atEndOfDay) date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export const DAY_NAMES_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
