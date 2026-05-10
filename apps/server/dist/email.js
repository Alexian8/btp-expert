"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Email service — envoi via SMTP (Nodemailer)
//
// Si SMTP_HOST/USER/PASS ne sont pas configurés, sendMail() devient no-op
// et retourne { ok: false, skipped: true }. L'app continue de fonctionner :
// les credentials sont alors affichés dans l'UI admin (modal "tempPassword")
// que l'admin transmet manuellement.
//
// Pour activer en prod :
//   SMTP_HOST=smtp.example.com SMTP_PORT=587 SMTP_USER=...@... SMTP_PASS=...
//   SMTP_FROM="BatiDesk <noreply@example.com>"
// ═══════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = sendMail;
exports.welcomeEmailHtml = welcomeEmailHtml;
const nodemailer_1 = __importDefault(require("nodemailer"));
let cached = {
    cfg: null,
    transporter: null,
};
function getTransporter(cfg) {
    if (cached.cfg === cfg && cached.transporter !== null)
        return cached.transporter;
    if (!cfg.SMTP_HOST || !cfg.SMTP_USER || !cfg.SMTP_PASS) {
        cached = { cfg, transporter: null };
        return null;
    }
    const transporter = nodemailer_1.default.createTransport({
        host: cfg.SMTP_HOST,
        port: cfg.SMTP_PORT,
        secure: cfg.SMTP_PORT === 465, // 465 = SSL implicite, 587 = STARTTLS
        auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS },
    });
    cached = { cfg, transporter };
    return transporter;
}
/**
 * Envoie un email via SMTP. Si SMTP non configuré : skipped: true.
 * Best-effort : ne throw jamais. En cas d'erreur réseau/SMTP, log + retourne
 * { ok: false, error }.
 */
async function sendMail(cfg, input) {
    const transporter = getTransporter(cfg);
    if (!transporter) {
        console.log(`[email] SMTP non configuré, no-op pour: ${input.to} / ${input.subject}`);
        return { ok: false, skipped: true };
    }
    const from = cfg.SMTP_FROM || `BatiDesk <${cfg.SMTP_USER}>`;
    try {
        const info = await transporter.sendMail({
            from,
            to: input.to,
            subject: input.subject,
            html: input.html,
            text: input.text ?? stripHtml(input.html),
        });
        console.log(`[email] sent OK to=${input.to} messageId=${info.messageId}`);
        return { ok: true, messageId: info.messageId };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[email] send FAILED to=${input.to}: ${msg}`);
        return { ok: false, error: msg };
    }
}
function stripHtml(html) {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
/**
 * Email envoyé à un nouvel utilisateur lors de sa création par l'admin.
 * Contient identifiant, mot de passe temporaire, et lien de connexion.
 */
function welcomeEmailHtml(opts) {
    const firstName = escapeHtml(opts.firstName) || "Bonjour";
    const username = escapeHtml(opts.username);
    const tempPassword = escapeHtml(opts.tempPassword);
    const loginUrl = escapeHtml(opts.loginUrl);
    const companyName = escapeHtml(opts.companyName ?? "BatiDesk");
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bienvenue sur BatiDesk</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);padding:32px 40px;color:#ffffff;">
              <h1 style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.01em;">🏗️ BatiDesk</h1>
              <p style="margin:8px 0 0 0;font-size:14px;opacity:.9;">${companyName}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 12px 0;font-size:20px;font-weight:600;color:#0f172a;">Bienvenue ${firstName} 👋</h2>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#475569;">
                Un compte a été créé pour vous sur <strong>${companyName}</strong>.<br>
                Voici vos identifiants pour vous connecter à BatiDesk.
              </p>

              <!-- Credentials box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:24px 0;">
                <tr>
                  <td style="padding:20px;">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:6px;">Identifiant</div>
                    <div style="font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:16px;font-weight:600;color:#0f172a;margin-bottom:18px;">${username}</div>

                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:6px;">Mot de passe temporaire</div>
                    <div style="font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:16px;font-weight:600;color:#0f172a;background:#ffffff;border:1px dashed #cbd5e1;border-radius:6px;padding:10px 14px;display:inline-block;letter-spacing:.05em;">${tempPassword}</div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#475569;">
                ⚠️ <strong>Pour votre sécurité, vous devrez changer ce mot de passe à la première connexion.</strong>
              </p>

              <!-- CTA button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0;">
                <tr>
                  <td>
                    <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:8px;">
                      Se connecter à BatiDesk →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;">
                Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br>
                <a href="${loginUrl}" style="color:#2563eb;word-break:break-all;">${loginUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
              Cet email a été envoyé automatiquement. Si vous n'attendiez pas ce compte, contactez votre administrateur.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
function escapeHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
//# sourceMappingURL=email.js.map