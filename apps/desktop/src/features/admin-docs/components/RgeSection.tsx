import { Leaf, Construction, ExternalLink, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

// ═══════════════════════════════════════════════════════════════════════════
// RgeSection — Placeholder préparation 2026
// ═══════════════════════════════════════════════════════════════════════════

export function RgeSection() {
  return (
    <div className="space-y-4 max-w-4xl">
      {/* Bandeau préparation */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
            <Construction className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold mb-1">Module en préparation pour 2026</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Ce module sera complété quand tu obtiendras tes qualifications RGE.
              Il prendra en charge la rénovation énergétique éligible MaPrimeRénov', CEE et éco-PTZ.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <FeatureCard
                icon={Sparkles}
                title="Mentions obligatoires RGE"
                description="Devis et factures avec qualification, n° certif, date de validité"
              />
              <FeatureCard
                icon={Sparkles}
                title="Estimation MaPrimeRénov'"
                description="Calcul automatique de l'aide selon revenus et type de travaux"
              />
              <FeatureCard
                icon={Sparkles}
                title="Attestation de fin de travaux"
                description="Document de référence pour le versement de l'aide"
              />
              <FeatureCard
                icon={Sparkles}
                title="Fiches techniques"
                description="Conformité matériaux et équipements éligibles"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Qualifications RGE */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Leaf className="w-4 h-4 text-emerald-500" />
          Les principales qualifications RGE
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <QualifCard name="Qualibat RGE" description="Tous corps d'état du bâtiment (le plus répandu)" />
          <QualifCard name="Qualifelec RGE" description="Travaux d'électricité, pompes à chaleur" />
          <QualifCard name="Qualibois" description="Installation de chaudières et poêles à bois" />
          <QualifCard name="QualiPV" description="Installation photovoltaïque" />
          <QualifCard name="QualiSol" description="Solaire thermique et chauffe-eau solaires" />
          <QualifCard name="Qualipac" description="Pompes à chaleur" />
        </div>
      </div>

      {/* Liens utiles */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-3">Liens utiles</h3>
        <div className="space-y-2">
          <LinkRow
            href="https://www.france-renov.gouv.fr/aides/maprimerenov"
            label="MaPrimeRénov' — site officiel France Rénov'"
          />
          <LinkRow
            href="https://www.qualibat.com/devenir-rge/"
            label="Devenir RGE Qualibat"
          />
          <LinkRow
            href="https://www.francenum.gouv.fr/"
            label="Aides et subventions à la transition énergétique"
          />
        </div>
      </div>

      {/* Plans 2026 */}
      <div className="bg-blue-500/5 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm font-semibold mb-1">📅 Tes plans 2026</p>
        <p className="text-xs text-muted-foreground">
          Tu as indiqué que tu prévois d'obtenir ta qualification RGE en 2026.
          Quand ce sera fait, je serai prêt à activer ce module avec :
          devis-factures spécialisés, estimation MaPrimeRénov', conservation
          des preuves dans le coffre-fort. Reviens vers moi à ce moment-là !
        </p>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-md bg-card/50 border border-emerald-500/20">
      <Icon className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-semibold">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function QualifCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="p-3 rounded-md border border-border bg-muted/20">
      <p className="text-sm font-semibold">{name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm text-primary hover:underline"
    >
      <ExternalLink className="w-3.5 h-3.5" />
      {label}
    </a>
  );
}
