import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Rocket, Users, Hammer, Receipt, FileText, Wallet, HardHat,
  Calendar, BookOpen, Archive, Settings as SettingsIcon, Lightbulb,
  GraduationCap, Workflow, CreditCard,
} from "lucide-react";
import { cn } from "@btp/ui";

// ═══════════════════════════════════════════════════════════════════════════
// AppGuide — guide complet de l'application BatiDesk.
// Modale plein écran : sommaire à gauche, contenu de la section à droite.
// Accessible depuis la topbar (bouton aide), partout dans l'app.
// ═══════════════════════════════════════════════════════════════════════════

function Étape({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </div>
      <div className="text-sm leading-relaxed text-foreground/90 flex-1">{children}</div>
    </div>
  );
}

function Astuce({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 flex items-start gap-2">
      <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="text-sm text-foreground/90">{children}</div>
    </div>
  );
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

interface GuideSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

const SECTIONS: GuideSection[] = [
  {
    id: "start",
    label: "Prise en main",
    icon: Rocket,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          BatiDesk gère votre activité d'artisan du bâtiment de A à Z : clients,
          chantiers, devis, factures, dépenses et comptabilité. Voici le parcours type.
        </p>
        <div className="space-y-3">
          <Étape n={1}>Renseignez votre entreprise dans <strong>Paramètres → Entreprise</strong> (nom, SIRET, assurance décennale, IBAN, logo). Ces infos apparaîtront sur vos devis et factures.</Étape>
          <Étape n={2}>Créez vos <strong>Clients</strong>.</Étape>
          <Étape n={3}>Créez un <strong>Chantier</strong> rattaché à un client (optionnel mais conseillé).</Étape>
          <Étape n={4}>Faites un <strong>Devis</strong> → envoyez-le → une fois accepté, <strong>convertissez-le en facture</strong>.</Étape>
          <Étape n={5}>Enregistrez vos <strong>Dépenses</strong> (matériaux, fournisseurs) au fil de l'eau.</Étape>
          <Étape n={6}>La <strong>Comptabilité</strong> se remplit automatiquement. Consultez-la et exportez le FEC pour votre comptable.</Étape>
        </div>
        <Astuce>
          Le bouton <strong>Synchroniser</strong> (en haut) recharge toutes vos
          données. Le thème clair/sombre se règle juste à côté.
        </Astuce>
      </div>
    ),
  },
  {
    id: "clients",
    label: "Clients",
    icon: Users,
    content: (
      <div className="space-y-4">
        <Pratique>
          <p><strong>Clients → Nouveau client.</strong> Choisissez Particulier ou
            Professionnel, remplissez les coordonnées. Pour un pro, ajoutez le SIRET
            et le n° de TVA (repris sur les documents).</p>
        </Pratique>
        <Astuce>
          Chaque client reçoit automatiquement un <strong>numéro de compte
          comptable</strong> (411001, 411002…) dès sa première facture. Vous n'avez
          rien à faire.
        </Astuce>
      </div>
    ),
  },
  {
    id: "chantiers",
    label: "Chantiers",
    icon: Hammer,
    content: (
      <div className="space-y-4">
        <Pratique>
          <p><strong>Chantiers → Nouveau chantier.</strong> Rattachez-le à un client.
            Vous pouvez y stocker des photos, documents, notes et signatures (PV
            d'ouverture / réception).</p>
          <p>Les devis, factures et dépenses rattachés à un chantier permettent de
            suivre sa <strong>marge</strong> (CA − dépenses) dans Finances.</p>
        </Pratique>
        <Astuce>
          Rattacher systématiquement vos devis/factures/dépenses à un chantier vous
          donne la rentabilité réelle de chaque projet.
        </Astuce>
      </div>
    ),
  },
  {
    id: "quotes",
    label: "Devis",
    icon: FileText,
    content: (
      <div className="space-y-4">
        <Pratique>
          <div className="space-y-3">
            <Étape n={1}>Devis & Factures → <strong>Nouveau devis</strong>. Choisissez le client.</Étape>
            <Étape n={2}>Ajoutez des <strong>lignes</strong> (désignation, quantité, prix unitaire, TVA) ou des <strong>chapitres</strong> pour structurer. Utilisez « Depuis la bibliothèque » pour réutiliser des prestations.</Étape>
            <Étape n={3}>Besoin d'une remise ? Bouton <strong>« Ajouter une remise sur cette ligne »</strong>, ou remise globale dans le panneau Totaux.</Étape>
            <Étape n={4}>Choisissez le style PDF (Moderne / Sobre / Classique) via le menu <strong>⋯</strong>, puis <strong>Télécharger PDF</strong> ou <strong>Envoyer par email</strong>.</Étape>
            <Étape n={5}>Marquez-le <strong>Envoyé</strong>, puis <strong>Accepté</strong> quand le client signe.</Étape>
            <Étape n={6}><strong>Convertir en facture</strong> (standard, acompte, ou avoir) une fois accepté.</Étape>
          </div>
        </Pratique>
        <Astuce>
          La <strong>correction orthographique</strong> souligne les fautes en rouge
          (clic pour corriger) et la <strong>prédiction</strong> propose des mots
          (Tab pour compléter) dans les descriptions.
        </Astuce>
      </div>
    ),
  },
  {
    id: "invoices",
    label: "Factures",
    icon: Receipt,
    content: (
      <div className="space-y-4">
        <Pratique>
          <p>Une facture naît le plus souvent de la <strong>conversion d'un devis</strong>
            accepté. Vous pouvez aussi en créer une directement.</p>
          <div className="space-y-3 mt-2">
            <Étape n={1}>Ouvrez la facture → <strong>Enregistrer un paiement</strong> quand le client règle (total ou partiel).</Étape>
            <Étape n={2}>Une facture en retard peut faire l'objet d'une <strong>relance</strong> (menu ⋯).</Étape>
            <Étape n={3}>Facture d'<strong>acompte</strong> : reprend les lignes du devis au prorata du pourcentage choisi.</Étape>
          </div>
        </Pratique>
        <Théorie>
          <p>Chaque facture et chaque paiement génèrent <strong>automatiquement</strong>
            les écritures comptables correspondantes. Vous n'avez rien à saisir en compta.</p>
        </Théorie>
      </div>
    ),
  },
  {
    id: "expenses",
    label: "Dépenses & Notes de frais",
    icon: Wallet,
    content: (
      <div className="space-y-4">
        <Pratique>
          <p><strong>Dépenses</strong> : vos achats fournisseurs (matériaux, outillage,
            carburant…). Renseignez le montant HT/TVA, la catégorie, le fournisseur et
            le statut (à payer / payée).</p>
          <p><strong>Notes de frais</strong> : les frais avancés par le dirigeant ou un
            employé (repas, péage…), à rembourser. Workflow : brouillon → validée →
            remboursée.</p>
        </Pratique>
        <Théorie>
          <p>Dépenses et notes de frais génèrent automatiquement les écritures d'achat
            (et de TVA déductible). Catégorisez bien : la catégorie détermine le compte
            comptable utilisé.</p>
        </Théorie>
      </div>
    ),
  },
  {
    id: "subcontractors",
    label: "Sous-traitants",
    icon: HardHat,
    content: (
      <div className="space-y-4">
        <Pratique>
          <p><strong>Sous-traitants</strong> : gérez vos partenaires, leurs attestations
            (URSSAF, assurance…) et leurs échéances. Vous pouvez convertir un devis en
            <strong> bon de commande sous-traitant</strong> depuis la liste des devis (menu ⋯).</p>
        </Pratique>
      </div>
    ),
  },
  {
    id: "agenda",
    label: "Agenda",
    icon: Calendar,
    content: (
      <div className="space-y-4">
        <Pratique>
          <p><strong>Agenda</strong> : planifiez RDV, interventions et rappels. Les
            événements peuvent être synchronisés avec <strong>Outlook</strong> (via
            Paramètres → Microsoft).</p>
        </Pratique>
      </div>
    ),
  },
  {
    id: "accounting",
    label: "Comptabilité",
    icon: BookOpen,
    content: (
      <div className="space-y-4">
        <Théorie>
          <p>La compta en <strong>partie double</strong> : chaque opération est notée
            deux fois (d'où vient l'argent / où il va), avec toujours
            <strong> débit = crédit</strong>.</p>
          <p>Bonne nouvelle : <strong>tout est automatique</strong>. Vos factures,
            paiements, dépenses et notes de frais créent les écritures. Vous venez
            ici pour <strong>consulter</strong> et déclarer la TVA.</p>
        </Théorie>
        <Pratique>
          <p>Au premier accès, choisissez votre <strong>mode</strong> : Trésorerie
            (micro/EI) ou Engagement (SARL/SAS). Puis les onglets :</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li><strong>Livre Journal</strong> : toutes les écritures.</li>
            <li><strong>Grand Livre</strong> : mouvements compte par compte.</li>
            <li><strong>Balance</strong> : solde de chaque compte.</li>
            <li><strong>Compte de Résultat</strong> : bénéfice ou perte.</li>
            <li><strong>Bilan</strong> : ce que vous possédez / devez.</li>
            <li><strong>TVA</strong> : montant à reverser, par période.</li>
            <li><strong>Plan Comptable</strong> et <strong>Paramètres</strong>.</li>
          </ul>
        </Pratique>
        <Astuce>
          Onglet <strong>Comptabilité</strong> dans le menu de gauche pour le détail
          complet. <strong>Paramètres → Régénérer</strong> reconstruit les écritures
          sans risque si besoin. Exportez le <strong>FEC</strong> pour votre comptable.
        </Astuce>
      </div>
    ),
  },
  {
    id: "vault",
    label: "Coffre-fort & Documents",
    icon: Archive,
    content: (
      <div className="space-y-4">
        <Pratique>
          <p><strong>Coffre-fort</strong> : stockez vos documents sensibles (contrats,
            attestations, justificatifs) de façon chiffrée et classée. Les PDF générés
            (devis, factures) peuvent y être rangés automatiquement.</p>
          <p><strong>Documents admin</strong> : générez les CERFA et documents
            obligatoires (PV de réception, attestation TVA, DC4 sous-traitance…).</p>
        </Pratique>
      </div>
    ),
  },
  {
    id: "settings",
    label: "Paramètres",
    icon: SettingsIcon,
    content: (
      <div className="space-y-4">
        <Pratique>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Entreprise</strong> : identité, SIRET, assurances, IBAN, logo.</li>
            <li><strong>Documents</strong> : style des PDF, taille du logo et du nom,
              couleur d'accent, mentions, préfixes de numérotation.</li>
            <li><strong>Sauvegarde</strong> : sauvegardes locales et OneDrive.</li>
            <li><strong>Microsoft</strong> : connexion Outlook / OneDrive.</li>
          </ul>
        </Pratique>
        <Astuce>
          Pensez à bien remplir l'<strong>assurance décennale</strong> et l'<strong>IBAN</strong> :
          ils apparaissent en pied de vos devis et factures (la décennale est
          obligatoire en BTP).
        </Astuce>
      </div>
    ),
  },
  {
    id: "tips",
    label: "Astuces",
    icon: Lightbulb,
    content: (
      <div className="space-y-3">
        <Astuce>Le bouton <strong>⋯</strong> sur chaque ligne (devis, factures) regroupe toutes les actions : dupliquer, convertir, supprimer…</Astuce>
        <Astuce>La <strong>correction orthographique</strong> et la <strong>prédiction de mots</strong> fonctionnent dans toutes les zones de rédaction.</Astuce>
        <Astuce>Sur <strong>iPhone</strong>, l'app s'adapte : les actions passent dans des menus pour rester lisibles.</Astuce>
        <Astuce>Tout est <strong>relié</strong> : un devis → facture → écriture comptable → TVA → FEC. Vous saisissez une fois, tout se propage.</Astuce>
      </div>
    ),
  },
];

interface AppGuideProps {
  open: boolean;
  onClose: () => void;
}

export function AppGuide({ open, onClose }: AppGuideProps) {
  const [activeId, setActiveId] = useState<string>("start");
  const active = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-2 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.97, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-xl shadow-soft-xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <GraduationCap className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="font-semibold leading-tight">Guide BatiDesk</h2>
                  <p className="text-[11px] text-muted-foreground">Tout pour bien utiliser l'application</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="Fermer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sélecteur mobile */}
            <div className="md:hidden border-b border-border p-2 shrink-0">
              <select
                value={activeId}
                onChange={(e) => setActiveId(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-muted/50 px-3 text-sm"
              >
                {SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 flex min-h-0">
              {/* Sommaire (desktop) */}
              <nav className="hidden md:block w-56 border-r border-border overflow-y-auto p-2 shrink-0">
                {SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const isActive = s.id === activeId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveId(s.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors mb-0.5",
                        isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {s.label}
                    </button>
                  );
                })}
              </nav>

              {/* Contenu */}
              <div className="flex-1 overflow-y-auto p-5 md:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <active.icon className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">{active.label}</h3>
                </div>
                {active.content}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
