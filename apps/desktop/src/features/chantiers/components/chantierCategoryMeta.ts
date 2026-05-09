import {
  Hammer, Wrench, Building, Building2, Home, Package, Zap, Droplets,
  Shield, Grid3x3, Palette, Paintbrush, Trees, Lightbulb, Snowflake,
  Wind, Truck, Cog, Layers, Pickaxe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// chantierCategoryMeta.ts — Icônes et couleurs (Session 22)
// Spécifiquement adaptées aux corps d'état du BTP
// ═══════════════════════════════════════════════════════════════════════════

export interface IconOption {
  key: string;
  Icon: LucideIcon;
  label: string;
}

export const CHANTIER_CAT_ICON_OPTIONS: IconOption[] = [
  { key: "hammer",     Icon: Hammer,     label: "Maçonnerie" },
  { key: "building",   Icon: Building,   label: "Gros œuvre" },
  { key: "building2",  Icon: Building2,  label: "Bâtiment" },
  { key: "home",       Icon: Home,       label: "Couverture" },
  { key: "package",    Icon: Package,    label: "Charpente" },
  { key: "zap",        Icon: Zap,        label: "Électricité" },
  { key: "droplets",   Icon: Droplets,   label: "Plomberie" },
  { key: "shield",     Icon: Shield,     label: "Isolation" },
  { key: "grid",       Icon: Grid3x3,    label: "Carrelage" },
  { key: "palette",    Icon: Palette,    label: "Peinture" },
  { key: "paintbrush", Icon: Paintbrush, label: "Finitions" },
  { key: "wrench",     Icon: Wrench,     label: "Menuiserie" },
  { key: "trees",      Icon: Trees,      label: "Aménagement extérieur" },
  { key: "lightbulb",  Icon: Lightbulb,  label: "Éclairage" },
  { key: "snowflake",  Icon: Snowflake,  label: "Climatisation" },
  { key: "wind",       Icon: Wind,       label: "Ventilation" },
  { key: "truck",      Icon: Truck,      label: "Livraison" },
  { key: "cog",        Icon: Cog,        label: "Mécanique" },
  { key: "layers",     Icon: Layers,     label: "Revêtements" },
  { key: "pickaxe",    Icon: Pickaxe,    label: "Démolition" },
];

export interface ColorOption {
  key: string;
  label: string;
  bg: string;
  text: string;
  border: string;
  /** Couleurs au format hex pour PDF (Session 22) */
  hex: string;
  hexBg: string;
}

export const CHANTIER_CAT_COLOR_OPTIONS: ColorOption[] = [
  { key: "slate",   label: "Gris",       bg: "bg-slate-500/15",   text: "text-slate-500",   border: "border-slate-500/30",   hex: "#64748b", hexBg: "#f1f5f9" },
  { key: "stone",   label: "Pierre",     bg: "bg-stone-500/15",   text: "text-stone-500",   border: "border-stone-500/30",   hex: "#78716c", hexBg: "#f5f5f4" },
  { key: "blue",    label: "Bleu",       bg: "bg-blue-500/15",    text: "text-blue-500",    border: "border-blue-500/30",    hex: "#3b82f6", hexBg: "#dbeafe" },
  { key: "indigo",  label: "Indigo",     bg: "bg-indigo-500/15",  text: "text-indigo-500",  border: "border-indigo-500/30",  hex: "#6366f1", hexBg: "#e0e7ff" },
  { key: "violet",  label: "Violet",     bg: "bg-violet-500/15",  text: "text-violet-500",  border: "border-violet-500/30",  hex: "#8b5cf6", hexBg: "#ede9fe" },
  { key: "emerald", label: "Vert",       bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500/30", hex: "#10b981", hexBg: "#d1fae5" },
  { key: "teal",    label: "Turquoise",  bg: "bg-teal-500/15",    text: "text-teal-500",    border: "border-teal-500/30",    hex: "#14b8a6", hexBg: "#ccfbf1" },
  { key: "yellow",  label: "Jaune",      bg: "bg-yellow-500/15",  text: "text-yellow-600",  border: "border-yellow-500/30",  hex: "#eab308", hexBg: "#fef9c3" },
  { key: "amber",   label: "Ambre",      bg: "bg-amber-500/15",   text: "text-amber-500",   border: "border-amber-500/30",   hex: "#f59e0b", hexBg: "#fef3c7" },
  { key: "orange",  label: "Orange",     bg: "bg-orange-500/15",  text: "text-orange-500",  border: "border-orange-500/30",  hex: "#f97316", hexBg: "#ffedd5" },
  { key: "rose",    label: "Rose",       bg: "bg-rose-500/15",    text: "text-rose-500",    border: "border-rose-500/30",    hex: "#f43f5e", hexBg: "#ffe4e6" },
  { key: "pink",    label: "Magenta",    bg: "bg-pink-500/15",    text: "text-pink-500",    border: "border-pink-500/30",    hex: "#ec4899", hexBg: "#fce7f3" },
];

export function getChantierCatIcon(key: string): LucideIcon {
  return CHANTIER_CAT_ICON_OPTIONS.find((o) => o.key === key)?.Icon || Hammer;
}

export function getChantierCatColor(key: string): ColorOption {
  return CHANTIER_CAT_COLOR_OPTIONS.find((c) => c.key === key) || CHANTIER_CAT_COLOR_OPTIONS[0];
}
