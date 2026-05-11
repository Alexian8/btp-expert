import { Code, Heart } from "lucide-react";

import { SettingsSectionWrapper } from "./SettingsPage";
import logoSquareUrl from "@/assets/logo-square.png";

// ═══════════════════════════════════════════════════════════════════════════
// AboutSection — Infos sur l'app
// ═══════════════════════════════════════════════════════════════════════════

export function AboutSection() {
  return (
    <div className="space-y-6">
      <SettingsSectionWrapper title="À propos de BatiDesk" description="Logiciel de gestion pour artisans du bâtiment">
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-white flex items-center justify-center">
            <img
              src={logoSquareUrl}
              alt="BatiDesk"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <p className="text-lg font-bold">BatiDesk</p>
            <p className="text-sm text-muted-foreground">Version 16.0.0</p>
            <p className="text-xs text-muted-foreground">Édité par JACOB HABITAT</p>
          </div>
        </div>

        <div className="grid gap-3">
          <InfoRow label="Éditeur" value="JACOB HABITAT" />
          <InfoRow label="SIRET" value="51068269300013" />
          <InfoRow label="N° TVA" value="FR21510682693" />
          <InfoRow label="Licence" value="Propriétaire" />
        </div>
      </SettingsSectionWrapper>

      <SettingsSectionWrapper title="Stack technique">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            "React 18",
            "TypeScript",
            "Vite 5",
            "Tailwind CSS",
            "Zustand",
            "React Router v6",
            "Framer Motion",
            "Electron 32",
            "SQLite",
          ].map((tech) => (
            <div
              key={tech}
              className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md"
            >
              <Code className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs">{tech}</span>
            </div>
          ))}
        </div>
      </SettingsSectionWrapper>

      <SettingsSectionWrapper title="Mentions légales">
        <p className="text-sm text-muted-foreground leading-relaxed">
          © 2026 JACOB HABITAT. Tous droits réservés.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Ce logiciel est un outil de gestion destiné aux artisans du bâtiment. Toutes les
          données sont stockées localement sur votre ordinateur et chiffrées lorsque
          nécessaire. Aucune information n'est envoyée à des serveurs externes sans votre
          consentement explicite.
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-4">
          Fait avec <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> pour simplifier
          le quotidien des artisans BTP.
        </p>
      </SettingsSectionWrapper>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
