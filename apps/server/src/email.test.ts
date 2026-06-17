import { describe, it, expect } from "vitest";
import { buildMimeMessage } from "./email";

// Contenu PDF factice encodé en base64 ("PDF-DUMMY")
const PDF_B64 = Buffer.from("PDF-DUMMY").toString("base64");

const baseInput = {
  host: "smtp.example.com",
  port: 465,
  user: "noreply@example.com",
  pass: "secret",
  from: "BatiDesk <noreply@example.com>",
  to: "client@example.com",
  subject: "Votre devis DEVIS-2026-0001",
  html: "<p>Bonjour, voici votre devis.</p>",
  text: "Bonjour, voici votre devis.",
};

describe("buildMimeMessage", () => {
  it("produit un multipart/alternative sans pièce jointe", () => {
    const mime = buildMimeMessage(baseInput, "<id@batidesk>");
    expect(mime).toContain("Content-Type: multipart/alternative;");
    expect(mime).not.toContain("multipart/mixed");
    expect(mime).toContain("Content-Type: text/plain; charset=utf-8");
    expect(mime).toContain("Content-Type: text/html; charset=utf-8");
  });

  it("encode l'objet non-ASCII en RFC 2047", () => {
    const mime = buildMimeMessage({ ...baseInput, subject: "Facture éà payée" }, "<id@batidesk>");
    expect(mime).toContain("Subject: =?UTF-8?B?");
  });

  it("enveloppe dans un multipart/mixed avec la pièce jointe PDF", () => {
    const mime = buildMimeMessage(
      {
        ...baseInput,
        attachments: [
          { filename: "DEVIS-2026-0001.pdf", contentType: "application/pdf", contentBase64: PDF_B64 },
        ],
      },
      "<id@batidesk>"
    );
    expect(mime).toContain("Content-Type: multipart/mixed;");
    // L'alternative texte/html reste imbriquée
    expect(mime).toContain("Content-Type: multipart/alternative;");
    // La pièce jointe est bien déclarée
    expect(mime).toContain('Content-Type: application/pdf; name="DEVIS-2026-0001.pdf"');
    expect(mime).toContain('Content-Disposition: attachment; filename="DEVIS-2026-0001.pdf"');
    expect(mime).toContain("Content-Transfer-Encoding: base64");
    expect(mime).toContain(PDF_B64);
  });

  it("nettoie un préfixe data: et les espaces dans le base64 fourni", () => {
    const mime = buildMimeMessage(
      {
        ...baseInput,
        attachments: [
          {
            filename: "f.pdf",
            contentType: "application/pdf",
            contentBase64: `data:application/pdf;base64,${PDF_B64}\n`,
          },
        ],
      },
      "<id@batidesk>"
    );
    expect(mime).toContain(PDF_B64);
    expect(mime).not.toContain("data:application/pdf;base64,");
  });
});
