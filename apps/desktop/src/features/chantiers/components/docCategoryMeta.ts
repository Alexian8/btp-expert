import {
  File, FileText, FileSignature, Receipt, CreditCard,
  Camera, Image, Map, Stamp, ShieldCheck,
  Hammer, Wrench, Package, Briefcase, Building,
  Calendar, Clock, AlertCircle, CheckCircle2, Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// docCategoryMeta.ts — Icônes et couleurs disponibles pour les catégories
// de documents chantier (Session 21)
// ═══════════════════════════════════════════════════════════════════════════

export interface IconOption {
  key: string;
  Icon: LucideIcon;
  label: string;
}

export const ICON_OPTIONS: IconOption[] = [
  { key: "file",            Icon: File,           label: "Fichier" },
  { key: "file-text",       Icon: FileText,       label: "Document" },
  { key: "file-signature",  Icon: FileSignature,  label: "Contrat" },
  { key: "receipt",         Icon: Receipt,        label: "Devis" },
  { key: "credit-card",     Icon: CreditCard,     label: "Facture" },
  { key: "camera",          Icon: Camera,         label: "Photo" },
  { key: "image",           Icon: Image,          label: "Image" },
  { key: "map",             Icon: Map,            label: "Plan" },
  { key: "stamp",           Icon: Stamp,          label: "Permis" },
  { key: "shield-check",    Icon: ShieldCheck,    label: "Attestation" },
  { key: "hammer",          Icon: Hammer,         label: "Travaux" },
  { key: "wrench",          Icon: Wrench,         label: "Outils" },
  { key: "package",         Icon: Package,        label: "Matériel" },
  { key: "briefcase",       Icon: Briefcase,      label: "Pro" },
  { key: "building",        Icon: Building,       label: "Bâtiment" },
  { key: "calendar",        Icon: Calendar,       label: "Date" },
  { key: "clock",           Icon: Clock,          label: "Temps" },
  { key: "alert-circle",    Icon: AlertCircle,    label: "Alerte" },
  { key: "check-circle",    Icon: CheckCircle2,   label: "Validé" },
  { key: "tag",             Icon: Tag,            label: "Tag" },
];

export interface ColorOption {
  key: string;
  label: string;
  /** Tailwind classes for bg + text */
  bg: string;
  text: string;
  border: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  { key: "slate",   label: "Gris",     bg: "bg-slate-500/15",   text: "text-slate-500",   border: "border-slate-500/30" },
  { key: "blue",    label: "Bleu",     bg: "bg-blue-500/15",    text: "text-blue-500",    border: "border-blue-500/30" },
  { key: "violet",  label: "Violet",   bg: "bg-violet-500/15",  text: "text-violet-500",  border: "border-violet-500/30" },
  { key: "indigo",  label: "Indigo",   bg: "bg-indigo-500/15",  text: "text-indigo-500",  border: "border-indigo-500/30" },
  { key: "emerald", label: "Vert",     bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500/30" },
  { key: "teal",    label: "Turquoise",bg: "bg-teal-500/15",    text: "text-teal-500",    border: "border-teal-500/30" },
  { key: "amber",   label: "Ambre",    bg: "bg-amber-500/15",   text: "text-amber-500",   border: "border-amber-500/30" },
  { key: "orange",  label: "Orange",   bg: "bg-orange-500/15",  text: "text-orange-500",  border: "border-orange-500/30" },
  { key: "rose",    label: "Rose",     bg: "bg-rose-500/15",    text: "text-rose-500",    border: "border-rose-500/30" },
  { key: "red",     label: "Rouge",    bg: "bg-red-500/15",     text: "text-red-500",     border: "border-red-500/30" },
];

export function getIcon(key: string): LucideIcon {
  return ICON_OPTIONS.find((o) => o.key === key)?.Icon || File;
}

export function getColor(key: string): ColorOption {
  return COLOR_OPTIONS.find((c) => c.key === key) || COLOR_OPTIONS[0];
}
