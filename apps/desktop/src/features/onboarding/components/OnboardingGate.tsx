import { useEffect, useState } from "react";
import { useCompanyStore } from "@/stores/companyStore";
import { OnboardingWizard } from "./OnboardingWizard";

// ═══════════════════════════════════════════════════════════════════════════
// OnboardingGate — Détecte si premier lancement et lance le wizard
// Conditions pour afficher :
//   1. La table company est vide (pas de companyName)
//   2. ET localStorage 'batidesk.onboarding.done' n'est pas défini
// ═══════════════════════════════════════════════════════════════════════════

export function OnboardingGate() {
  const { company, fetch: fetchCompany } = useCompanyStore();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  // 1. Charger company au démarrage
  useEffect(() => {
    fetchCompany();
  }, []);

  // 2. Décider si on ouvre le wizard
  useEffect(() => {
    if (checked) return;

    // Attendre que company soit chargé
    if (!company) return;

    let alreadyDone = false;
    try {
      alreadyDone = localStorage.getItem("batidesk.onboarding.done") === "1";
    } catch {}

    const isFirstRun = !company.companyName && !alreadyDone;
    if (isFirstRun) {
      // Léger délai pour laisser le layout se monter avant
      setTimeout(() => setOpen(true), 800);
    }
    setChecked(true);
  }, [company.companyName, checked]);

  return <OnboardingWizard open={open} onClose={() => setOpen(false)} />;
}
