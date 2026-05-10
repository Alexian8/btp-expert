import { useState } from "react";
import { motion } from "framer-motion";
import { Palette, User, Info, ShieldCheck, Building2, BookOpen, FileText, Menu } from "lucide-react";

import { cn } from "@btp/ui";
import { useAuthStore } from "@/stores/authStore";
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

// ═══════════════════════════════════════════════════════════════════════════
// SettingsPage — Page Paramètres avec navigation en side-tabs
// ═══════════════════════════════════════════════════════════════════════════

type SectionKey = "appearance" | "sidebar" | "company" | "library" | "documents" | "account" | "security" | "about";

const sections: Array<{
  key: SectionKey;
  label: string;
  description: string;
  icon: React.ElementType;
  disabled?: boolean;
}> = [
  {
    key: "appearance",
    label: "Apparence",
    description: "Mode, couleurs, bordures",
    icon: Palette,
  },
  {
    key: "sidebar",
    label: "Sidebar",
    description: "Réorganiser et masquer les onglets",
    icon: Menu,
  },
  {
    key: "company",
    label: "Mon entreprise",
    description: "SIRET, TVA, assurances",
    icon: Building2,
  },
  {
    key: "library",
    label: "Bibliothèque",
    description: "Prestations récurrentes",
    icon: BookOpen,
  },
  {
    key: "documents",
    label: "Documents",
    description: "Personnalisation PDF et templates email",
    icon: FileText,
  },
  {
    key: "account",
    label: "Mon compte",
    description: "Identifiants, mot de passe",
    icon: User,
  },
  {
    key: "security",
    label: "Sauvegarde",
    description: "Backup local & cloud",
    icon: ShieldCheck,
  },
  {
    key: "about",
    label: "À propos",
    description: "Version, mentions légales",
    icon: Info,
  },
];

export function SettingsPage() {
  const [active, setActive] = useState<SectionKey>("appearance");
  const user = useAuthStore((s) => s.user) as { role?: string } | null;
  const isAdmin = user?.role === "admin";

  // Sections réservées admin (modifient les données entreprise)
  const adminOnlySections: SectionKey[] = ["company", "library", "documents", "security"];
  const visibleSections = sections.filter(
    (s) => isAdmin || !adminOnlySections.includes(s.key)
  );

  // Si l'employé clique sur une section admin par hash URL, on force appearance
  if (!isAdmin && adminOnlySections.includes(active)) {
    setActive("appearance");
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">
          Personnalisez votre espace de travail
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        {/* Side navigation */}
        <aside className="space-y-1">
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
                  active === s.key ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
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

        {/* Content */}
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {active === "appearance" && <AppearanceSection />}
          {active === "sidebar" && <SidebarSection />}
          {active === "company" && <CompanySection />}
          {active === "library" && <LibrarySection />}
          {active === "documents" && <DocumentsSection />}
          {active === "account" && <AccountSection />}
          {active === "security" && <BackupSection />}
          {active === "about" && <AboutSection />}
        </motion.div>
      </div>
    </div>
  );
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
