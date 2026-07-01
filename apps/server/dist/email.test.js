"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const email_1 = require("./email");
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
(0, vitest_1.describe)("buildMimeMessage", () => {
    (0, vitest_1.it)("produit un multipart/alternative sans pièce jointe", () => {
        const mime = (0, email_1.buildMimeMessage)(baseInput, "<id@batidesk>");
        (0, vitest_1.expect)(mime).toContain("Content-Type: multipart/alternative;");
        (0, vitest_1.expect)(mime).not.toContain("multipart/mixed");
        (0, vitest_1.expect)(mime).toContain("Content-Type: text/plain; charset=utf-8");
        (0, vitest_1.expect)(mime).toContain("Content-Type: text/html; charset=utf-8");
    });
    (0, vitest_1.it)("encode l'objet non-ASCII en RFC 2047", () => {
        const mime = (0, email_1.buildMimeMessage)({ ...baseInput, subject: "Facture éà payée" }, "<id@batidesk>");
        (0, vitest_1.expect)(mime).toContain("Subject: =?UTF-8?B?");
    });
    (0, vitest_1.it)("enveloppe dans un multipart/mixed avec la pièce jointe PDF", () => {
        const mime = (0, email_1.buildMimeMessage)({
            ...baseInput,
            attachments: [
                { filename: "DEVIS-2026-0001.pdf", contentType: "application/pdf", contentBase64: PDF_B64 },
            ],
        }, "<id@batidesk>");
        (0, vitest_1.expect)(mime).toContain("Content-Type: multipart/mixed;");
        // L'alternative texte/html reste imbriquée
        (0, vitest_1.expect)(mime).toContain("Content-Type: multipart/alternative;");
        // La pièce jointe est bien déclarée
        (0, vitest_1.expect)(mime).toContain('Content-Type: application/pdf; name="DEVIS-2026-0001.pdf"');
        (0, vitest_1.expect)(mime).toContain('Content-Disposition: attachment; filename="DEVIS-2026-0001.pdf"');
        (0, vitest_1.expect)(mime).toContain("Content-Transfer-Encoding: base64");
        (0, vitest_1.expect)(mime).toContain(PDF_B64);
    });
    (0, vitest_1.it)("nettoie un préfixe data: et les espaces dans le base64 fourni", () => {
        const mime = (0, email_1.buildMimeMessage)({
            ...baseInput,
            attachments: [
                {
                    filename: "f.pdf",
                    contentType: "application/pdf",
                    contentBase64: `data:application/pdf;base64,${PDF_B64}\n`,
                },
            ],
        }, "<id@batidesk>");
        (0, vitest_1.expect)(mime).toContain(PDF_B64);
        (0, vitest_1.expect)(mime).not.toContain("data:application/pdf;base64,");
    });
});
