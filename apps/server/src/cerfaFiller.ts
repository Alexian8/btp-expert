// ═══════════════════════════════════════════════════════════════════════════
// cerfaFiller.ts — Remplit les CERFA officiels (PDF AcroForm) avec les
// données saisies dans BatiDesk. Résultat = PDF gouvernemental identique
// à l'original, avec les zones pré-remplies. Les champs restent éditables
// pour permettre au signataire de compléter ce qui manque.
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

const CERFA_DIR = path.join(__dirname, "cerfa-pdf");

function loadPdf(filename: string): Buffer {
  return fs.readFileSync(path.join(CERFA_DIR, filename));
}

// Helpers tolérants : si un champ n'existe pas ou n'a pas le bon type, on
// log et on continue — un mapping invalide ne doit pas casser tout le PDF.
function safeText(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string | undefined | null): void {
  if (value == null) return;
  try {
    form.getTextField(name).setText(String(value));
  } catch (e) {
    console.warn(`[cerfa] champ texte introuvable: ${name}`);
  }
}

function safeCheck(form: ReturnType<PDFDocument["getForm"]>, name: string, checked: boolean): void {
  try {
    const cb = form.getCheckBox(name);
    if (checked) cb.check();
    else cb.uncheck();
  } catch (e) {
    console.warn(`[cerfa] case à cocher introuvable: ${name}`);
  }
}

// ─── CERFA 1301-SD (N°13948*06) — Attestation simplifiée TVA réduite ──────
// Mapping établi par observation du PDF (cf. PDFTextField a1..a12, cac1..cac15)
export interface Cerfa1301SDData {
  // Cadre 1 — Identité
  nom?: string;
  prenom?: string;
  adresse?: string;
  codePostal?: string;
  commune?: string;
  // Cadre 2 — Nature des locaux
  typeLogement?: "maison" | "immeuble_collectif" | "appartement" | "autre";
  typeLogementPrecisAutre?: string;
  affectation?: "habitation" | "pieces" | "communes" | "transforme";
  affectationMilliemes?: string;
  adresseLogement?: string;
  communeLogement?: string;
  codePostalLogement?: string;
  qualite?: "proprietaire" | "locataire" | "autre";
  qualiteAutre?: string;
  // Cadre 3 — Nature des travaux (la plupart cochées par défaut pour TVA réduite)
  tauxReduit?: "5.5" | "10";
  // Signature
  faitA?: string;
  faitLe?: string; // jj/mm/aaaa
}

export async function fillCerfa1301SD(data: Cerfa1301SDData): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(loadPdf("cerfa-1301sd.pdf"));
  const form = pdf.getForm();

  // Cadre 1 — Identité (ordre déductible du PDF : nom, prénom, adresse, CP, commune)
  safeText(form, "a1", data.nom);
  safeText(form, "a2", data.prenom);
  safeText(form, "a3", data.adresse);
  safeText(form, "a4", data.codePostal);
  safeText(form, "a5", data.commune);

  // Cadre 2 — Type de logement (cac1=maison, cac2=collectif, cac3=appart, cac4=autre)
  safeCheck(form, "cac1", data.typeLogement === "maison");
  safeCheck(form, "cac2", data.typeLogement === "immeuble_collectif");
  safeCheck(form, "cac3", data.typeLogement === "appartement");
  safeCheck(form, "cac4", data.typeLogement === "autre");
  safeText(form, "a5a", data.typeLogementPrecisAutre);

  // Affectation (cac5..cac8)
  safeCheck(form, "cac5", data.affectation === "habitation" || !data.affectation);
  safeCheck(form, "cac6", data.affectation === "pieces");
  safeCheck(form, "cac7", data.affectation === "communes");
  safeCheck(form, "cac8", data.affectation === "transforme");
  safeText(form, "a6", data.affectationMilliemes);

  // Adresse logement (si différente) — a7=adresse, a8=commune, a9=CP
  safeText(form, "a7", data.adresseLogement);
  safeText(form, "a8", data.communeLogement);
  safeText(form, "a9", data.codePostalLogement);

  // Qualité (cac9=propriétaire, cac10=locataire, cac11=autre)
  safeCheck(form, "cac9", data.qualite === "proprietaire" || !data.qualite);
  safeCheck(form, "cac10", data.qualite === "locataire");
  safeCheck(form, "cac11", data.qualite === "autre");
  safeText(form, "a10", data.qualiteAutre);

  // Cadre 3 — engagements (cac12..cac15) cochés par défaut pour bénéficier
  // du taux réduit (les 4 conditions sont quasiment toujours respectées pour
  // les travaux d'amélioration éligibles).
  safeCheck(form, "cac12", true);
  safeCheck(form, "cac13", true);
  safeCheck(form, "cac14", true);
  safeCheck(form, "cac15", data.tauxReduit === "5.5"); // case "amélioration énergétique"

  // Signature
  safeText(form, "a11", data.faitA);
  safeText(form, "a12", data.faitLe);

  // On ne flatten pas → le client peut compléter à la main si besoin
  return pdf.save();
}

// ─── CERFA 13408*13 — DAACT (déclaration achèvement) ──────────────────────
// Mapping direct grâce aux noms parlants des champs.
export interface Cerfa13408Data {
  // Permis
  permitType: "permis_construire" | "permis_amenager" | "declaration_prealable";
  permitNumber?: string;
  voiriesDifferees?: boolean;
  voiriesDate?: string;
  // Déclarant
  declarantNom?: string;
  declarantPrenom?: string;
  denomination?: string;
  siret?: string;
  typeSociete?: string;
  representantNom?: string;
  representantPrenom?: string;
  // Coordonnées
  adresseNumero?: string;
  adresseVoie?: string;
  adresseLieuDit?: string;
  adresseLocalite?: string;
  adresseCodePostal?: string;
  adresseBoite?: string;
  adresseCedex?: string;
  adressePays?: string;
  adresseDivision?: string;
  email1?: string;
  email2?: string;
  acceptationEmail?: boolean;
  // Achèvement
  achievementDate?: string;
  destinationChangeDate?: string;
  totalTravaux?: boolean;
  trancheTravaux?: boolean;
  precisAchevement?: string;
  surfacePlancher?: string;
  nbLogementsTotal?: string;
  nbIndividuels?: string;
  nbCollectifs?: string;
  nbLLS?: string;
  nbAS?: string;
  nbPTZ?: string;
  nbAutres?: string;
  // Signatures
  signatureLieu?: string;
  signatureDate?: string;
  signatureNom?: string;
  architectLieu?: string;
  architectDate?: string;
  architectNom?: string;
}

export async function fillCerfa13408(data: Cerfa13408Data): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(loadPdf("cerfa-13408.pdf"));
  const form = pdf.getForm();

  // Permis
  safeCheck(form, "J2Q_PC", data.permitType === "permis_construire");
  safeCheck(form, "J2P_PA", data.permitType === "permis_amenager");
  safeCheck(form, "J2D_DP", data.permitType === "declaration_prealable");
  if (data.permitType === "permis_construire") safeText(form, "J2A_numero", data.permitNumber);
  if (data.permitType === "permis_amenager")   safeText(form, "J2R_numPA", data.permitNumber);
  if (data.permitType === "declaration_prealable") safeText(form, "J2E_numDP", data.permitNumber);

  // Voiries différées
  safeCheck(form, "J2Y_oui", data.voiriesDifferees === true);
  safeCheck(form, "J2N_non", data.voiriesDifferees === false);
  safeText(form, "J2C_date", data.voiriesDate);

  // Déclarant personne physique
  safeText(form, "D1N_nom", data.declarantNom);
  safeText(form, "D1P_prenom", data.declarantPrenom);
  // Déclarant personne morale
  safeText(form, "D2D_denomination", data.denomination);
  safeText(form, "D2R_raison", data.denomination); // souvent identique
  safeText(form, "D2S_siret", data.siret);
  safeText(form, "D2J_type", data.typeSociete);
  safeText(form, "D2N_nom", data.representantNom);
  safeText(form, "D2P_prenom", data.representantPrenom);

  // Coordonnées
  safeText(form, "D3N_numero", data.adresseNumero);
  safeText(form, "D3V_voie", data.adresseVoie);
  safeText(form, "D3W_lieudit", data.adresseLieuDit);
  safeText(form, "D3L_localite", data.adresseLocalite);
  safeText(form, "D3C_code", data.adresseCodePostal);
  safeText(form, "D3B_boite", data.adresseBoite);
  safeText(form, "D3X_cedex", data.adresseCedex);
  safeText(form, "D3P_pays", data.adressePays);
  safeText(form, "D3D_division", data.adresseDivision);
  safeText(form, "D5GE1_email", data.email1);
  safeText(form, "D5GE2_email", data.email2);
  safeCheck(form, "D5A_acceptation", !!data.acceptationEmail);

  // Achèvement
  safeText(form, "C9A_acheve", data.achievementDate);
  safeText(form, "C9D_destination", data.destinationChangeDate);
  safeCheck(form, "C9T_totaltravaux", data.totalTravaux !== false);
  safeCheck(form, "C9P_tranchetravaux", !!data.trancheTravaux);
  safeText(form, "C9C_precisacheve", data.precisAchevement);
  safeText(form, "W1SB1", data.surfacePlancher);
  safeText(form, "C5ZA1_logements", data.nbLogementsTotal);
  safeText(form, "C5ZA2_individuels", data.nbIndividuels);
  safeText(form, "C5ZA3_collectifs", data.nbCollectifs);
  safeText(form, "C5ZC1_nombreLLS", data.nbLLS);
  safeText(form, "C5ZC2_nombreAS", data.nbAS);
  safeText(form, "C5ZC3_nombrePTZ", data.nbPTZ);
  safeText(form, "C5ZC5_nombreautres", data.nbAutres);

  // Signatures (texte uniquement — pas d'image canvas dans AcroForm standard)
  safeText(form, "E1L_lieu", data.signatureLieu);
  safeText(form, "E1D_date", data.signatureDate);
  safeText(form, "E1S_signature", data.signatureNom);
  safeText(form, "E4G_lieuarchi", data.architectLieu);
  safeText(form, "E4D_datearcchi", data.architectDate);
  safeText(form, "E4S_signaturearchi", data.architectNom);

  return pdf.save();
}
