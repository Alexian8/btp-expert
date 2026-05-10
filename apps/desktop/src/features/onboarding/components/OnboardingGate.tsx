import { useEffect, useState } from "react";
import { useCompanyStore } from "@/stores/companyStore";
import { useAuthStore } from "@/stores/authStore";
import { OnboardingWizard } from "./OnboardingWizard";

// ═══════════════════════════════════════════════════════════════════════════
// OnboardingGate — Détecte si premier lancement et lance le wizard
//
// Multi-tenant + role-aware :
//   • Si user.role === "admin" ET la company n'a PAS isSetupComplete=1
//     → ouvre le wizard d'onboarding (tutoriel "ma société").
//   • Si user n'est PAS admin (manager/worker/...) → JAMAIS de wizard,
//     accès direct au dashboard. Les employés ne peuvent ni voir ni modifier
//     les paramètres de l'entreprise.
//   • Garde de compatibilité : si l'ancien flag localStorage
//     'batidesk.onboarding.done' est défini, on ne ré-affiche pas.
// ═══════════════════════════════════════════════════════════════════════════

export function OnboardingGate() {
  const { company, fetch: fetchCompany } = useCompanyStore();
  const user = useAuthStore((s) => s.user) as { role?: string; isSetupComplete?: boolean } | null;
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  // 1. Charger company au démarrage
  useEffect(() => {
    fetchCompany();
  }, []);

  // 2. Décider si on ouvre le wizard
  useEffect(() => {
    if (checked) return;
    if (!user) return;

    // RÈGLE 1 : seul l'admin voit le tutoriel
    if (user.role !== "admin") {
      setChecked(true);
      return;
    }

    // RÈGLE 2 : si la DB indique que le setup est terminé → pas de wizard
    // (source de vérité côté serveur, exposée dans /api/auth/login + /me)
    if (user.isSetupComplete === true) {
      setChecked(true);
      return;
    }

    // RÈGLE 3 : compatibilité avec l'ancien flag localStorage
    let alreadyDoneLocally = false;
    try {
      alreadyDoneLocally = localStorage.getItem("batidesk.onboarding.done") === "1";
    } catch {}

    // Attendre que company soit chargé pour décider
    if (!company) return;

    // Si companyName déjà rempli (cas legacy avant le flag isSetupComplete)
    // ou flag local déjà set → on considère terminé.
    const looksDone =
      Boolean(company.companyName) || alreadyDoneLocally;

    if (!looksDone) {
      setTimeout(() => setOpen(true), 800);
    }
    setChecked(true);
  }, [company.companyName, checked, user]);

  // Les non-admins ne voient JAMAIS le wizard, même s'il devait s'ouvrir.
  if (user && user.role !== "admin") return null;

  return <OnboardingWizard open={open} onClose={() => setOpen(false)} />;
}
