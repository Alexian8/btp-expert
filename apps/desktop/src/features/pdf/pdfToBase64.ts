import type { ReactElement } from "react";
import { pdf } from "@react-pdf/renderer";

// ═══════════════════════════════════════════════════════════════════════════
// pdfToBase64 — génère un PDF depuis un élément React-PDF et le retourne en
// base64 (sans préfixe data:). Utilisé pour joindre le PDF d'un devis/facture
// à un email envoyé en SMTP côté web (où le PDF est généré dans le navigateur).
// ═══════════════════════════════════════════════════════════════════════════

export async function pdfElementToBase64(element: ReactElement): Promise<string> {
  const blob = await pdf(element).toBlob();
  return await blobToBase64(blob);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      // FileReader renvoie "data:application/pdf;base64,XXXX" → on retire le préfixe
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Lecture du PDF échouée"));
    reader.readAsDataURL(blob);
  });
}
