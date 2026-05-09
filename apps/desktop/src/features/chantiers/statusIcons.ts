import { Eye, Hammer, CheckCircle2, XCircle, Zap, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChantierStatus, ChantierPriority } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// Mapping centralisé des icônes pour statuts & priorités de chantiers
// Pas d'emojis dans l'UI finale — uniquement des icônes Lucide propres.
// ═══════════════════════════════════════════════════════════════════════════

export const CHANTIER_STATUS_ICON: Record<ChantierStatus, LucideIcon> = {
  "prospect":  Eye,
  "en-cours":  Hammer,
  "termine":   CheckCircle2,
  "annule":    XCircle,
};

export const CHANTIER_PRIORITY_ICON: Record<ChantierPriority, LucideIcon> = {
  "low":    Minus,
  "normal": Minus,
  "high":   Zap,
};
