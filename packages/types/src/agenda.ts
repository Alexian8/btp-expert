// ═══════════════════════════════════════════════════════════════════════════
// Types Agenda (Session 12)
// ═══════════════════════════════════════════════════════════════════════════

export type AgendaEventType = "chantier" | "rdv" | "signature" | "intervention" | "autre";

export interface AgendaEvent {
  id: string;
  title: string;
  description: string;          // notes / détails
  type: AgendaEventType;

  // Dates ISO
  startAt: string;              // ex: "2026-04-26T09:00:00.000Z"
  endAt: string;                // ex: "2026-04-26T11:00:00.000Z"
  allDay: boolean;              // si true, ignorer les heures

  // Lien optionnels
  clientId: string;             // "" si pas lié
  chantierId: string;           // "" si pas lié
  quoteId: string;              // pour les RDV signature liés à un devis
  invoiceId: string;            // pour relances factures (futur)

  // Affichage
  location: string;             // adresse / lieu
  colorOverride: string;        // hex ex: "#3b82f6", "" = utilise la couleur par défaut du type

  // Sync Microsoft Outlook
  syncToOutlook: boolean;       // l'utilisateur veut sync cet event ?
  outlookEventId: string;       // id Outlook si déjà sync, "" sinon
  outlookLastSyncAt: string;    // date ISO dernière sync, "" sinon

  // Métadonnées
  createdAt: string;
  updatedAt: string;
}

// ─── Couleurs par défaut par type ────────────────────────────────────────
export const AGENDA_TYPE_META: Record<AgendaEventType, {
  label: string;
  colorHex: string;
  colorTw: string;
  bgTw: string;
}> = {
  chantier: {
    label: "Chantier",
    colorHex: "#3b82f6",
    colorTw: "text-blue-500",
    bgTw: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  },
  rdv: {
    label: "Rendez-vous",
    colorHex: "#8b5cf6",
    colorTw: "text-violet-500",
    bgTw: "bg-violet-500/15 text-violet-500 border-violet-500/30",
  },
  signature: {
    label: "Signature",
    colorHex: "#f59e0b",
    colorTw: "text-amber-500",
    bgTw: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  },
  intervention: {
    label: "Intervention",
    colorHex: "#10b981",
    colorTw: "text-emerald-500",
    bgTw: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  },
  autre: {
    label: "Autre",
    colorHex: "#64748b",
    colorTw: "text-slate-500",
    bgTw: "bg-slate-500/15 text-slate-500 border-slate-500/30",
  },
};

// ─── Stats ────────────────────────────────────────────────────────────────
export interface AgendaStats {
  totalEvents: number;
  todayCount: number;           // événements aujourd'hui
  thisWeekCount: number;        // cette semaine
  upcomingNext7Days: number;    // les 7 prochains jours
}

// ─── Helpers ──────────────────────────────────────────────────────────────
export function getEventColor(event: { type: AgendaEventType; colorOverride: string }): string {
  if (event.colorOverride && /^#[0-9a-fA-F]{6}$/.test(event.colorOverride)) {
    return event.colorOverride;
  }
  return AGENDA_TYPE_META[event.type]?.colorHex || AGENDA_TYPE_META.autre.colorHex;
}

export function isEventToday(event: AgendaEvent): boolean {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return event.startAt.startsWith(today);
}

export function isEventInRange(event: AgendaEvent, rangeStart: Date, rangeEnd: Date): boolean {
  const start = new Date(event.startAt).getTime();
  const end = new Date(event.endAt).getTime();
  return end >= rangeStart.getTime() && start <= rangeEnd.getTime();
}

export function formatEventTime(event: AgendaEvent): string {
  if (event.allDay) return "Toute la journée";
  try {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
    return `${fmt(start)} – ${fmt(end)}`;
  } catch {
    return "";
  }
}

export function formatEventDate(event: AgendaEvent): string {
  try {
    const start = new Date(event.startAt);
    return start.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
