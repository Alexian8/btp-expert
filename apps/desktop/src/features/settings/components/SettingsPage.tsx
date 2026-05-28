import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  User,
  Info,
  ShieldCheck,
  Building2,
  BookOpen,
  FileText,
  Landmark,
  Menu,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

import { cn } from "@btp/ui";
import { useAuthStore } from "@/stores/authStore";
import { useIsMobile } from "@/stores/deviceModeStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { AppearanceSection } from "./AppearanceSection";
import { SidebarSection } from "./SidebarSection";
import { AccountSection } from "./AccountSection";
import { AboutSection } from "./AboutSection";
import { BackupSection } from "./BackupSection";
import { CompanySection } from "./CompanySection";
import { LibrarySection } from "./LibrarySection";
import { DocumentsSection } from "./DocumentsSection";
import { QontoSection } from "./QontoSection";

// ═══════════════════════════════════════════════════════════════════════════
// SettingsPage — Layout 2 colonnes (desktop) / drill-down iOS (mobile)
//
// Desktop (≥ md) :
//   - Sidebar sticky à gauche (suit le scroll)
//   - Contenu scrollable à droite
//
// Mobile (< md) :
//   - Vue 1 : liste des sections (style iOS Settings)
//   - Vue 2 : section sélectionnée plein écran avec bouton retour
// ═══════════════════════════════════════════════════════════════════════════

type SectionKey =
  | "appearance"
  | "sidebar"
  | "company"
  | "library"
  | "documents"
  | "banking"
  | "account"
  | "security"
  | "about";

const sections: Array<{
  key: SectionKey;
  label: string;
  description: string;
  icon: React.ElementType;
  disabled?: boolean;
}> = [
  { key: "appearance", label: "Apparence", description: "Mode, couleurs, bordures", icon: Palette },
  { key: "sidebar", label: "Sidebar", description: "Réorganiser et masquer les onglets", icon: Menu },
  { key: "company", label: "Mon entreprise", description: "SIRET, TVA, assurances", icon: Building2 },
  { key: "library", label: "Bibliothèque", description: "Prestations récurrentes", icon: BookOpen },
  { key: "documents", label: "Documents", description: "PDF et templates email", icon: FileText },
  { key: "banking", label: "Banque (Qonto)", description: "Connexion bancaire, soldes", icon: Landmark },
  { key: "account", label: "Mon compte", description: "Identifiants, mot de passe", icon: User },
  { key: "security", label: "Sauvegarde", description: "Backup local & cloud", icon: ShieldCheck },
  { key: "about", label: "À propos", description: "Version, mentions légales", icon: Info },
];

export function SettingsPage() {
  const [active, setActive] = useState<SectionKey | null>(null);
  const user = useAuthStore((s) => s.user) as { role?: string } | null;
  const isAdmin = user?.role === "admin";
  const isMobile = useIsMobile();

  const adminOnlySections: SectionKey[] = ["company", "library", "documents", "banking", "security"];
  const visibleSections = sections.filter(
    (s) => isAdmin || !adminOnlySections.includes(s.key)
  );

  // Sur desktop, on sélectionne par défaut la 1ère section ; sur mobile,
  // on reste sur la liste pour laisser l'utilisateur choisir.
  useEffect(() => {
    if (!isMobile && active === null && visibleSections.length > 0) {
      setActive(visibleSections[0]!.key);
    }
  }, [isMobile, active, visibleSections]);

  // Garde-fou : un employé qui aurait active === "company" via URL
  useEffect(() => {
    if (active && !isAdmin && adminOnlySections.includes(active)) {
      setActive("appearance");
    }
  }, [active, isAdmin]);

  const activeSection = active ? sections.find((s) => s.key === active) : null;

  // ─── Mode mobile : drill-down iOS ──────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-full">
        <AnimatePresence mode="wait" initial={false}>
          {!active ? (
            <motion.div
              key="list"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="p-4"
            >
              <div className="mb-5">
                <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Personnalisez votre espace
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
                {visibleSections.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setActive(s.key)}
                    disabled={s.disabled}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent active:bg-accent disabled:opacity-40"
                  >
                    <div className="w-9 h-9 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                      <s.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{s.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.description}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={active}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="min-h-full"
            >
              {/* Sticky header avec bouton retour iOS-style */}
              <div className="sticky top-0 z-20 bg-card border-b border-border px-3 py-2.5 flex items-center gap-2">
                <button
                  onClick={() => setActive(null)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-md text-primary hover:bg-accent transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">Paramètres</span>
                </button>
                {activeSection && (
                  <span className="text-sm font-semibold text-foreground ml-1 truncate">
                    · {activeSection.label}
                  </span>
                )}
              </div>

              {/* Contenu de la section */}
              <div className="p-3">
                <SectionContent active={active} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Mode desktop : 2 colonnes avec sidebar sticky ────────────────
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Personnalisez votre espace de travail</p>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-6 items-start">
        {/* Side navigation — STICKY (suit le scroll) */}
        <aside className="sticky top-4 space-y-1 self-start max-h-[calc(100vh-2rem)] overflow-y-auto pr-1">
          {visibleSections.map((s) => (
            <button
              key={s.key}
              onClick={() => !s.disabled && setActive(s.key)}
              disabled={s.disabled}
              className={cn(
                "w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-all",
                "hover:bg-accent hover:text-accent-foreground",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                active === s.key && "bg-accent text-accent-foreground"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                  active === s.key
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <s.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
              </div>
            </button>
          ))}
        </aside>

        {/* Content scrollable */}
        <motion.div
          key={active ?? "loading"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="min-w-0"
        >
          {active && <SectionContent active={active} />}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Helper : rendu de la section sélectionnée ──────────────────────────
function SectionContent({ active }: { active: SectionKey }) {
  switch (active) {
    case "appearance":
      return <AppearanceSection />;
    case "sidebar":
      return <SidebarSection />;
    case "company":
      return <CompanySection />;
    case "library":
      return <LibrarySection />;
    case "documents":
      return <DocumentsSection />;
    case "banking":
      return <QontoSection />;
    case "account":
      return <AccountSection />;
    case "security":
      return <BackupSection />;
    case "about":
      return <AboutSection />;
    default:
      return null;
  }
}

// ─── Composant utilitaire : wrapper de section ───────────────────────────
export function SettingsSectionWrapper({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}
