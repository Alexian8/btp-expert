import {
  Folder, Shield, Award, Users, Hammer, FileText, Image,
  Package, Calendar, Lock, Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// vaultIcons — Mapping icon key → Lucide component
// ═══════════════════════════════════════════════════════════════════════════

export const FOLDER_ICON_MAP: Record<string, LucideIcon> = {
  folder:   Folder,
  shield:   Shield,
  award:    Award,
  users:    Users,
  hammer:   Hammer,
  fileText: FileText,
  image:    Image,
  package:  Package,
  calendar: Calendar,
  lock:     Lock,
  star:     Star,
};

export function getFolderIcon(iconKey: string): LucideIcon {
  return FOLDER_ICON_MAP[iconKey] || Folder;
}

export const FOLDER_COLOR_TW: Record<string, string> = {
  default: "text-slate-400",
  blue:    "text-blue-500",
  violet:  "text-violet-500",
  emerald: "text-emerald-500",
  amber:   "text-amber-500",
  rose:    "text-rose-500",
};

export const FOLDER_BG_TW: Record<string, string> = {
  default: "bg-slate-500/15 text-slate-500",
  blue:    "bg-blue-500/15 text-blue-500",
  violet:  "bg-violet-500/15 text-violet-500",
  emerald: "bg-emerald-500/15 text-emerald-500",
  amber:   "bg-amber-500/15 text-amber-500",
  rose:    "bg-rose-500/15 text-rose-500",
};

export function getFolderColorClass(colorKey: string): string {
  return FOLDER_COLOR_TW[colorKey] || FOLDER_COLOR_TW.default;
}

export function getFolderBgClass(colorKey: string): string {
  return FOLDER_BG_TW[colorKey] || FOLDER_BG_TW.default;
}
