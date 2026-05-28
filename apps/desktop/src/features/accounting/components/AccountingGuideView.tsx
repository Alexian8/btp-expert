import { useState } from "react";
import {
  BookOpen, Coins, Workflow, Receipt, Scale, TrendingUp, RefreshCw,
  AlertCircle, ChevronDown, GraduationCap, FileDown, HelpCircle,
} from "lucide-react";
import { cn } from "@btp/ui";
import { Card } from "@/components/ui/card";

// ═══════════════════════════════════════════════════════════════════════════
// AccountingGuideView — Tutoriel intégré de la comptabilité.
// Pensé pour le grand débutant (théorie simple) ET celui qui découvre l'app
// (étapes concrètes). Sections repliables.
// ═══════════════════════════════════════════════════════════════════════════

interface Section {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
}

function Théorie({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-500 mb-1.5 flex items-center gap-1.5">
        <GraduationCap className="w-3.5 h-3.5" /> Comprendre
      </div>
      <div className="text-sm leading-relaxed text-foreground/90 space-y-2">{children}</div>
    </div>
  );
}

function Pratique({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500 mb-1.5 flex items-center gap-1.5">
        <Workflow className="w-3.5 h-3.5" /> Dans BatiDesk
      </div>
      <div className="text-sm leading-relaxed text-foreground/90 space-y-2">{children}</div>
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: "intro",
    icon: BookOpen,
    title: "1. La compta en 2 minutes",
    body: (
      <>
        <Théorie>
          <p>
            La comptabilité, c'est <strong>noter tout ce qui entre et sort d'argent</strong>,
            de façon organisée. En France on utilise la <strong>partie double</strong> :
            chaque opération est notée deux fois — d'où vient l'argent, où il va. Les deux
            montants sont toujours <strong>égaux</strong>.
          </p>
          <p>
            On parle de <strong>débit</strong> (gauche) et <strong>crédit</strong> (droite).
            Règle d'or : pour chaque écriture, <strong>total débit = total crédit</strong>.
          </p>
          <p className="text-muted-foreground">
            Exemple : un client vous paie 720 € → votre banque <em>augmente</em> de 720 €
            (débit banque) et votre client <em>ne vous doit plus</em> 720 € (crédit client).
            Équilibré.
          </p>
        </Théorie>
        <Pratique>
          <p>
            Vous n'avez <strong>presque rien à saisir</strong> en compta. L'app crée les
            écritures automatiquement quand vous créez une facture, encaissez un paiement,
            saisissez une dépense ou une note de frais. Vous travaillez normalement,
            la compta se remplit toute seule.
          </p>
        </Pratique>
      </>
    ),
  },
  {
    id: "mode",
    icon: Coins,
    title: "2. Choisir son mode",
    body: (
      <>
        <Théorie>
          <p>Deux façons de tenir sa compta :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Trésorerie</strong> (micro-entreprise, auto-entrepreneur, EI) :
              l'écriture est créée quand l'argent entre/sort réellement.</li>
            <li><strong>Engagement</strong> (SARL, SAS, EURL) : l'écriture est créée dès
              la facture émise, même non encore payée. Permet de suivre créances et dettes.</li>
          </ul>
        </Théorie>
        <Pratique>
          <p>
            Au premier accès, une fenêtre vous demande votre mode. En cas de doute :
            micro/auto-entrepreneur → <strong>Trésorerie</strong> ; société →
            <strong> Engagement</strong>. Modifiable dans <strong>Paramètres</strong>, mais
            évitez de changer après avoir des factures (sinon relancez « Régénérer »).
          </p>
        </Pratique>
      </>
    ),
  },
  {
    id: "workflow",
    icon: Workflow,
    title: "3. Le workflow quotidien",
    body: (
      <Pratique>
        <p>Vous ne touchez jamais directement à la compta. Tout part de vos opérations :</p>
        <div className="font-mono text-xs bg-muted/50 rounded-md p-3 leading-relaxed">
          1. DEVIS → (pas d'écriture, c'est une proposition){"\n"}
          2. FACTURE → écriture auto · journal Ventes (VE){"\n"}
          3. PAIEMENT reçu → écriture auto · journal Banque (BQ){"\n"}
          4. DÉPENSE → écriture auto · journal Achats (AC){"\n"}
          5. Paiement fournisseur → écriture auto · Banque (BQ){"\n"}
          6. NOTE DE FRAIS → écriture auto (AC puis BQ au remboursement)
        </div>
        <p>Vous venez dans l'onglet Comptabilité juste pour <strong>consulter</strong> et
          déclarer la TVA.</p>
      </Pratique>
    ),
  },
  {
    id: "exemple",
    icon: Receipt,
    title: "4. Exemple concret (facture 720 € TTC)",
    body: (
      <>
        <Pratique>
          <p>Facturez 600 € HT (TVA 20 % = 720 € TTC) au client Mathieu, puis encaissez :</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Devis & Factures → Nouvelle facture → 1 ligne « Travaux » 600 € HT.</li>
            <li>Le client paie → ouvrez la facture → « Enregistrer un paiement » → 720 €.</li>
          </ol>
        </Pratique>
        <Théorie>
          <p>Ce que la compta crée (visible dans Livre Journal) :</p>
          <div className="text-xs">
            <div className="font-semibold mt-1">À la facture (journal VE) :</div>
            <div className="font-mono bg-muted/50 rounded p-2 mt-1">
              411-Mathieu …… <strong>D 720,00</strong>{"\n"}
              706000 Prestations …… C 600,00{"\n"}
              445710 TVA collectée …… C 120,00
            </div>
            <div className="font-semibold mt-2">Au paiement (journal BQ) :</div>
            <div className="font-mono bg-muted/50 rounded p-2 mt-1">
              512000 Banque …… <strong>D 720,00</strong>{"\n"}
              411-Mathieu …… C 720,00
            </div>
          </div>
          <p className="text-muted-foreground">
            <strong>« Pourquoi deux fois 720 € ? »</strong> La 1ʳᵉ écriture dit « Mathieu me
            doit 720 € », la 2ᵉ dit « Mathieu a payé, il ne me doit plus rien ». Son compte
            revient à zéro : la facture est soldée. C'est le but de la partie double.
          </p>
        </Théorie>
      </>
    ),
  },
  {
    id: "tva",
    icon: Receipt,
    title: "5. La TVA",
    body: (
      <>
        <Théorie>
          <p>
            Quand vous facturez, vous encaissez de la TVA pour l'État (<strong>collectée</strong>).
            Quand vous achetez, vous payez une TVA récupérable (<strong>déductible</strong>).
            Vous reversez la différence :
          </p>
          <div className="font-mono text-xs bg-muted/50 rounded p-2">
            TVA à reverser = TVA collectée − TVA déductible
          </div>
          <p className="text-muted-foreground">Si la déductible est plus grande, vous avez
            un crédit de TVA reporté sur la période suivante.</p>
        </Théorie>
        <Pratique>
          <p>
            Onglet <strong>TVA</strong> → choisissez la période (mois / trimestre / année).
            L'app calcule la TVA collectée, déductible, le montant à reverser et le détail
            par taux. Reportez ces montants sur votre déclaration CA3 (impots.gouv.fr).
          </p>
        </Pratique>
      </>
    ),
  },
  {
    id: "etats",
    icon: Scale,
    title: "6. Compte de résultat & Bilan",
    body: (
      <>
        <Théorie>
          <p><strong>Compte de résultat</strong> = est-ce que je gagne de l'argent ?
            <span className="font-mono text-xs"> Produits − Charges = Bénéfice/Perte</span></p>
          <p><strong>Bilan</strong> = photo de l'entreprise à un instant T :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Actif</strong> : ce que je possède (banque, créances, matériel).</li>
            <li><strong>Passif</strong> : d'où vient l'argent (capital, emprunts, dettes).</li>
          </ul>
          <p>Actif = Passif, toujours.</p>
        </Théorie>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 mb-1.5 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Bon à savoir
          </div>
          <p className="text-sm text-foreground/90">
            Au démarrage, le bilan peut sembler déséquilibré si vous n'avez pas saisi votre
            situation de départ (capital, solde de banque initial). C'est normal : il devient
            juste au fil de l'activité. Pour un démarrage propre, demandez vos « à-nouveaux »
            à votre expert-comptable et saisissez-les via une écriture manuelle (OD).
          </p>
        </div>
      </>
    ),
  },
  {
    id: "regen",
    icon: RefreshCw,
    title: "7. Régénérer / reprendre une compta",
    body: (
      <Pratique>
        <p>
          Si vous aviez déjà des factures/dépenses avant d'activer la compta, ou après un
          changement de mode : <strong>Paramètres → Régénérer toutes les écritures</strong>.
        </p>
        <p>
          L'app reconstruit tout à partir de vos documents existants. <strong>C'est sans
          risque</strong> et relançable autant de fois que voulu (aucun doublon créé).
        </p>
      </Pratique>
    ),
  },
  {
    id: "fec",
    icon: FileDown,
    title: "8. Export pour l'expert-comptable (FEC)",
    body: (
      <Pratique>
        <p>
          <strong>Finances → Exporter FEC</strong>. Le FEC est le format officiel réclamé par
          le fisc et votre expert-comptable. Choisissez l'année, transmettez le fichier tel
          quel. BatiDesk tient la compta au quotidien ; votre expert-comptable valide et fait
          les déclarations annuelles — l'app lui fait gagner beaucoup de temps.
        </p>
      </Pratique>
    ),
  },
  {
    id: "faq",
    icon: HelpCircle,
    title: "9. Questions fréquentes",
    body: (
      <div className="space-y-3 text-sm">
        <div>
          <div className="font-semibold">« J'ai changé de mode et j'ai des doublons. »</div>
          <div className="text-muted-foreground">→ Paramètres → Régénérer toutes les écritures. Ça nettoie et reconstruit proprement.</div>
        </div>
        <div>
          <div className="font-semibold">« Mon bilan n'est pas équilibré. »</div>
          <div className="text-muted-foreground">→ Normal au démarrage sans à-nouveaux. Saisissez vos soldes de début (OD) ou demandez-les à votre expert-comptable.</div>
        </div>
        <div>
          <div className="font-semibold">« Dois-je toucher au Plan Comptable ? »</div>
          <div className="text-muted-foreground">→ Non, sauf besoin précis. Tous les comptes BTP utiles existent déjà. Les plages 411xxx (clients) et 401xxx (fournisseurs) sont gérées automatiquement.</div>
        </div>
        <div>
          <div className="font-semibold">« La compta remplace-t-elle mon expert-comptable ? »</div>
          <div className="text-muted-foreground">→ Non. Elle tient votre compta au quotidien et produit le FEC ; l'expert-comptable valide et fait le bilan officiel.</div>
        </div>
      </div>
    ),
  },
];

export function AccountingGuideView() {
  const [openId, setOpenId] = useState<string>("intro");

  return (
    <div className="max-w-3xl space-y-4">
      {/* Intro */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Guide de la comptabilité</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pas besoin d'être comptable. Suivez ce guide pas-à-pas : les blocs
              <span className="text-blue-500 font-medium"> bleus</span> expliquent la théorie,
              les blocs <span className="text-emerald-500 font-medium">verts</span> montrent
              quoi faire dans l'app. Cliquez sur une section pour la déplier.
            </p>
          </div>
        </div>
      </Card>

      {/* Récap express */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-primary" /> En résumé
        </h3>
        <ol className="list-decimal pl-5 text-sm space-y-1 text-foreground/90">
          <li>Choisissez votre <strong>mode</strong> au démarrage.</li>
          <li><strong>Travaillez normalement</strong> (devis, factures, dépenses) — la compta se remplit seule.</li>
          <li>Consultez <strong>TVA</strong> avant chaque déclaration.</li>
          <li>Consultez <strong>Compte de Résultat</strong> pour voir vos bénéfices.</li>
          <li>Exportez le <strong>FEC</strong> pour votre expert-comptable.</li>
        </ol>
      </Card>

      {/* Sections repliables */}
      <div className="space-y-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const isOpen = openId === s.id;
          return (
            <Card key={s.id} className="overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? "" : s.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                <div className={cn(
                  "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                  isOpen ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="font-medium text-sm flex-1">{s.title}</span>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
                  {s.body}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
