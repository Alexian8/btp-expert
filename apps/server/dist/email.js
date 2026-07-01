"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Email service — client SMTP pur Node (zéro dépendance externe)
//
// Implémente le minimum nécessaire pour envoyer un email via SMTP avec
// authentification AUTH LOGIN. Compatible :
//   • Port 465 (SSL/TLS implicite) — recommandé sur o2switch
//   • Port 587 (STARTTLS) — mode upgrade depuis plain
//
// Si SMTP_HOST/USER/PASS ne sont pas configurés, sendMail() devient no-op
// et retourne { ok: false, skipped: true }. L'app continue de fonctionner :
// les credentials sont alors affichés dans l'UI admin (modal "tempPassword")
// que l'admin transmet manuellement.
// ═══════════════════════════════════════════════════════════════════════════
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = sendMail;
exports.buildMimeMessage = buildMimeMessage;
exports.welcomeEmailHtml = welcomeEmailHtml;
const net = __importStar(require("node:net"));
const tls = __importStar(require("node:tls"));
async function sendMail(cfg, input) {
    if (!cfg.SMTP_HOST || !cfg.SMTP_USER || !cfg.SMTP_PASS) {
        console.log(`[email] SMTP non configuré, no-op pour: ${input.to} / ${input.subject}`);
        return { ok: false, skipped: true };
    }
    const from = cfg.SMTP_FROM || `BatiDesk <${cfg.SMTP_USER}>`;
    try {
        const result = await smtpSend({
            host: cfg.SMTP_HOST,
            port: cfg.SMTP_PORT,
            user: cfg.SMTP_USER,
            pass: cfg.SMTP_PASS,
            from,
            to: input.to,
            subject: input.subject,
            html: input.html,
            text: input.text ?? stripHtml(input.html),
            attachments: input.attachments,
        });
        if (result.ok) {
            console.log(`[email] sent OK to=${input.to} messageId=${result.messageId}`);
        }
        else {
            console.error(`[email] send FAILED to=${input.to}: ${result.error}`);
        }
        return result;
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[email] send EXCEPTION to=${input.to}: ${msg}`);
        return { ok: false, error: msg };
    }
}
/**
 * Envoie un email via SMTP. Implémente le state machine SMTP :
 *   220 → EHLO → 250 → AUTH LOGIN → 334 → user(b64) → 334 → pass(b64) →
 *   235 → MAIL FROM → 250 → RCPT TO → 250 → DATA → 354 → body+. → 250 →
 *   QUIT → 221.
 */
function smtpSend(input) {
    return new Promise((resolve) => {
        const useSSL = input.port === 465;
        let socket;
        if (useSSL) {
            socket = tls.connect({
                host: input.host,
                port: input.port,
                servername: input.host,
            });
        }
        else {
            socket = net.connect({ host: input.host, port: input.port });
        }
        let buffer = "";
        let step = "greeting";
        let resolved = false;
        const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@batidesk>`;
        const finish = (result) => {
            if (resolved)
                return;
            resolved = true;
            clearTimeout(timer);
            try {
                socket.end();
            }
            catch {
                /* ignore */
            }
            resolve(result);
        };
        const timer = setTimeout(() => {
            finish({ ok: false, error: "SMTP timeout (30s)" });
        }, 30000);
        const write = (cmd) => {
            socket.write(cmd + "\r\n");
        };
        socket.setEncoding("utf8");
        socket.on("error", (err) => {
            finish({ ok: false, error: `SMTP socket error: ${err.message}` });
        });
        socket.on("end", () => {
            if (step !== "done") {
                finish({ ok: false, error: `Connection closed prematurely at step ${step}` });
            }
        });
        socket.on("data", (chunk) => {
            buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
            // Une réponse SMTP se termine quand on voit "XXX texte" (espace, pas tiret)
            // au début d'une ligne. Avant ça, "XXX-texte" (tiret) = continuation.
            const responses = [];
            while (true) {
                const lines = buffer.split(/\r?\n/);
                let endIdx = -1;
                for (let i = 0; i < lines.length - 1; i++) {
                    if (/^\d{3} /.test(lines[i] ?? "")) {
                        endIdx = i;
                        break;
                    }
                }
                if (endIdx === -1)
                    break;
                responses.push(lines.slice(0, endIdx + 1).join("\n"));
                buffer = lines.slice(endIdx + 1).join("\n");
            }
            for (const response of responses) {
                const code = parseInt(response.slice(0, 3), 10);
                if (Number.isNaN(code)) {
                    finish({ ok: false, error: `Réponse SMTP invalide: ${response.slice(0, 80)}` });
                    return;
                }
                if (code >= 400) {
                    finish({ ok: false, error: `SMTP error ${code}: ${response.slice(4, 200)}` });
                    return;
                }
                switch (step) {
                    case "greeting": // 220 server greeting
                        write(`EHLO batidesk`);
                        step = "ehlo";
                        break;
                    case "ehlo": // 250 EHLO response
                        write(`AUTH LOGIN`);
                        step = "auth-login";
                        break;
                    case "auth-login": // 334 (Username:)
                        write(Buffer.from(input.user, "utf8").toString("base64"));
                        step = "auth-user";
                        break;
                    case "auth-user": // 334 (Password:)
                        write(Buffer.from(input.pass, "utf8").toString("base64"));
                        step = "auth-pass";
                        break;
                    case "auth-pass": // 235 auth OK
                        write(`MAIL FROM:<${extractEmail(input.from)}>`);
                        step = "mail-from";
                        break;
                    case "mail-from": // 250
                        write(`RCPT TO:<${extractEmail(input.to)}>`);
                        step = "rcpt-to";
                        break;
                    case "rcpt-to": // 250
                        write(`DATA`);
                        step = "data";
                        break;
                    case "data": // 354 start input
                        socket.write(buildMimeMessage(input, messageId) + "\r\n.\r\n");
                        step = "body";
                        break;
                    case "body": // 250 message accepted
                        write(`QUIT`);
                        step = "quit";
                        break;
                    case "quit": // 221 bye
                        step = "done";
                        finish({ ok: true, messageId });
                        return;
                    case "done":
                        return;
                }
            }
        });
    });
}
/** Extrait l'adresse email depuis "Nom <email@x.com>" ou retourne tel quel. */
function extractEmail(s) {
    const m = s.match(/<([^>]+)>/);
    return m && m[1] ? m[1] : s.trim();
}
/** Wrap base64 à 76 chars/ligne (convention MIME ; évite l'erreur Exim
 *  "lines too long for transport" sur les contenus volumineux). */
function wrapB64(encoded) {
    const chunks = [];
    for (let i = 0; i < encoded.length; i += 76) {
        chunks.push(encoded.slice(i, i + 76));
    }
    return chunks.join("\r\n");
}
function buildMimeMessage(input, messageId) {
    const date = new Date().toUTCString();
    const rand = () => Math.random().toString(36).slice(2, 8);
    const altBoundary = `alt-${Date.now().toString(36)}-${rand()}`;
    const b64 = (s) => wrapB64(Buffer.from(s, "utf8").toString("base64"));
    // ─── Corps text/html (multipart/alternative) ────────────────────────────
    const alternative = [
        `--${altBoundary}`,
        `Content-Type: text/plain; charset=utf-8`,
        `Content-Transfer-Encoding: base64`,
        "",
        b64(input.text),
        "",
        `--${altBoundary}`,
        `Content-Type: text/html; charset=utf-8`,
        `Content-Transfer-Encoding: base64`,
        "",
        b64(input.html),
        "",
        `--${altBoundary}--`,
    ].join("\r\n");
    const attachments = input.attachments ?? [];
    // ─── Sans pièce jointe : multipart/alternative directement ───────────────
    if (attachments.length === 0) {
        const headers = [
            `From: ${input.from}`,
            `To: ${input.to}`,
            `Subject: ${encodeHeader(input.subject)}`,
            `Date: ${date}`,
            `Message-ID: ${messageId}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        ].join("\r\n");
        return headers + "\r\n\r\n" + alternative + "\r\n";
    }
    // ─── Avec pièces jointes : multipart/mixed enveloppant l'alternative ─────
    const mixedBoundary = `mix-${Date.now().toString(36)}-${rand()}`;
    const headers = [
        `From: ${input.from}`,
        `To: ${input.to}`,
        `Subject: ${encodeHeader(input.subject)}`,
        `Date: ${date}`,
        `Message-ID: ${messageId}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    ].join("\r\n");
    const parts = [
        `--${mixedBoundary}`,
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        "",
        alternative,
    ];
    for (const att of attachments) {
        const contentType = att.contentType || "application/octet-stream";
        // Le base64 fourni peut déjà contenir des retours ligne ou un préfixe
        // data: — on normalise puis on re-wrappe à 76 chars.
        const cleanB64 = att.contentBase64.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
        parts.push(`--${mixedBoundary}`, `Content-Type: ${contentType}; name="${att.filename}"`, `Content-Transfer-Encoding: base64`, `Content-Disposition: attachment; filename="${att.filename}"`, "", wrapB64(cleanB64));
    }
    parts.push(`--${mixedBoundary}--`);
    return headers + "\r\n\r\n" + parts.join("\r\n") + "\r\n";
}
/** RFC 2047 encoding pour les headers contenant du non-ASCII (sujet en UTF-8). */
function encodeHeader(s) {
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\x7F]*$/.test(s))
        return s;
    return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}
function stripHtml(html) {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n\s*\n/g, "\n\n")
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
    // Section optionnelle "Mailbox cPanel" avec guide Outlook complet
    const mailboxBlock = opts.mailbox
        ? buildMailboxBlock(opts.mailbox)
        : "";
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
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);padding:32px 40px;color:#ffffff;">
              <h1 style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.01em;">BatiDesk</h1>
              <p style="margin:8px 0 0 0;font-size:14px;opacity:.9;">${companyName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 12px 0;font-size:20px;font-weight:600;color:#0f172a;">Bienvenue ${firstName}</h2>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#475569;">
                Un compte a été créé pour vous sur <strong>${companyName}</strong>.<br>
                Voici vos identifiants pour vous connecter à BatiDesk.
              </p>

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
                <strong>Pour votre sécurité, vous devrez changer ce mot de passe à la première connexion.</strong>
              </p>${mailboxBlock}

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0;">
                <tr>
                  <td>
                    <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:8px;">
                      Se connecter à BatiDesk
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
/** Bloc HTML détaillé pour la mailbox : guide pas-à-pas Outlook + Mail.app +
 *  webmail + paramètres IMAP/SMTP techniques. */
function buildMailboxBlock(mb) {
    const email = escapeHtml(mb.email);
    const imap = escapeHtml(mb.imapHost);
    const smtp = escapeHtml(mb.smtpHost);
    const webmail = escapeHtml(mb.webmailUrl);
    return `
              <!-- Mailbox header -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin:24px 0 16px 0;">
                <tr>
                  <td style="padding:20px;">
                    <div style="font-size:14px;font-weight:600;color:#1e3a8a;margin-bottom:12px;">📬 Votre boîte mail professionnelle</div>

                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:4px;">Adresse email</div>
                    <div style="font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:14px;color:#0f172a;margin-bottom:14px;">${email}</div>

                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:4px;">Mot de passe mailbox</div>
                    <div style="font-size:13px;color:#0f172a;margin-bottom:6px;"><strong>Identique à votre mot de passe BatiDesk</strong></div>
                    <div style="font-size:12px;color:#1e40af;background:#dbeafe;border-radius:4px;padding:8px 10px;line-height:1.5;">
                      ✨ <strong>Synchronisation automatique :</strong> quand vous changez votre mot de passe BatiDesk, votre mailbox est mise à jour aussi. Vous gardez un seul mot de passe pour tout.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Guide configuration -->
              <h3 style="margin:28px 0 8px 0;font-size:16px;font-weight:600;color:#0f172a;">⚙️ Comment configurer votre email</h3>
              <p style="margin:0 0 18px 0;font-size:13px;color:#64748b;line-height:1.5;">Choisissez la méthode qui correspond à votre appareil. Le webmail est le plus simple si vous voulez juste tester.</p>

              <!-- Webmail -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 12px 0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:6px;">🌐 Webmail (sans rien installer)</div>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#475569;line-height:1.5;">Connectez-vous depuis n'importe quel navigateur :</p>
                    <a href="${webmail}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;padding:8px 16px;border-radius:6px;">Ouvrir le webmail</a>
                    <p style="margin:10px 0 0 0;font-size:12px;color:#64748b;">Identifiant : <strong>${email}</strong> · Mot de passe : votre mot de passe BatiDesk</p>
                  </td>
                </tr>
              </table>

              <!-- Outlook Windows -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 12px 0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px;">💻 Outlook sur Windows (PC)</div>
                    <ol style="margin:0;padding-left:20px;font-size:13px;color:#475569;line-height:1.7;">
                      <li>Ouvrir <strong>Outlook</strong></li>
                      <li><strong>Fichier</strong> → <strong>Ajouter un compte</strong></li>
                      <li>Saisir votre adresse <strong>${email}</strong> → <strong>Connecter</strong></li>
                      <li>Entrer votre mot de passe BatiDesk → <strong>OK</strong></li>
                      <li>Si la configuration auto échoue, choisir <strong>"IMAP"</strong> et utiliser les paramètres techniques en bas de cet email</li>
                    </ol>
                  </td>
                </tr>
              </table>

              <!-- Outlook iPhone / Android -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 12px 0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px;">📱 Outlook sur iPhone / Android</div>
                    <ol style="margin:0;padding-left:20px;font-size:13px;color:#475569;line-height:1.7;">
                      <li>Télécharger <strong>Outlook</strong> depuis l'App Store ou Google Play</li>
                      <li>Ouvrir l'app → <strong>Ajouter un compte</strong> → <strong>Compte de courrier</strong></li>
                      <li>Saisir votre adresse <strong>${email}</strong> → <strong>Continuer</strong></li>
                      <li>Si demandé, choisir le type <strong>IMAP</strong></li>
                      <li>Entrer votre mot de passe BatiDesk</li>
                      <li>Outlook va auto-détecter les serveurs ; si ça échoue, voir paramètres techniques</li>
                    </ol>
                  </td>
                </tr>
              </table>

              <!-- Mail.app iPhone -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 12px 0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px;">📧 App Mail iPhone (Mail.app)</div>
                    <ol style="margin:0;padding-left:20px;font-size:13px;color:#475569;line-height:1.7;">
                      <li><strong>Réglages</strong> → <strong>Mail</strong> → <strong>Comptes</strong> → <strong>Ajouter un compte</strong></li>
                      <li>Choisir <strong>Autre</strong> → <strong>Ajouter un compte Mail</strong></li>
                      <li>Remplir : Nom, Adresse <strong>${email}</strong>, Mot de passe (BatiDesk), Description "BatiDesk"</li>
                      <li><strong>Suivant</strong> → choisir <strong>IMAP</strong></li>
                      <li>Si l'auto-config échoue, utiliser les paramètres techniques en bas</li>
                    </ol>
                  </td>
                </tr>
              </table>

              <!-- Mail.app Mac -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 12px 0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px;">🖥️ App Mail Mac (macOS)</div>
                    <ol style="margin:0;padding-left:20px;font-size:13px;color:#475569;line-height:1.7;">
                      <li>Ouvrir <strong>Mail</strong></li>
                      <li>Menu <strong>Mail</strong> → <strong>Ajouter un compte</strong></li>
                      <li>Choisir <strong>Autre compte Mail…</strong> → <strong>Continuer</strong></li>
                      <li>Saisir nom, adresse <strong>${email}</strong>, mot de passe BatiDesk → <strong>Se connecter</strong></li>
                    </ol>
                  </td>
                </tr>
              </table>

              <!-- Paramètres techniques -->
              <h3 style="margin:24px 0 8px 0;font-size:14px;font-weight:600;color:#0f172a;">📋 Paramètres techniques (si auto-config échoue)</h3>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;color:#e2e8f0;border-radius:8px;margin:0 0 16px 0;font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:12px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="color:#60a5fa;font-weight:600;margin-bottom:8px;">Serveur entrant (IMAP)</div>
                    <div style="line-height:1.7;">
                      Hôte&nbsp;: <span style="color:#fbbf24;">${imap}</span><br>
                      Port&nbsp;: <span style="color:#fbbf24;">993</span><br>
                      Sécurité&nbsp;: <span style="color:#fbbf24;">SSL/TLS</span><br>
                      Username&nbsp;: <span style="color:#fbbf24;">${email}</span><br>
                      Password&nbsp;: <span style="color:#fbbf24;">votre mot de passe BatiDesk</span>
                    </div>
                    <div style="border-top:1px solid #334155;margin:12px 0;"></div>
                    <div style="color:#60a5fa;font-weight:600;margin-bottom:8px;">Serveur sortant (SMTP)</div>
                    <div style="line-height:1.7;">
                      Hôte&nbsp;: <span style="color:#fbbf24;">${smtp}</span><br>
                      Port&nbsp;: <span style="color:#fbbf24;">465</span><br>
                      Sécurité&nbsp;: <span style="color:#fbbf24;">SSL/TLS</span><br>
                      Username&nbsp;: <span style="color:#fbbf24;">${email}</span><br>
                      Password&nbsp;: <span style="color:#fbbf24;">votre mot de passe BatiDesk</span><br>
                      Authentification&nbsp;: <span style="color:#fbbf24;">requise</span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:16px 0 0 0;font-size:12px;color:#64748b;line-height:1.6;">
                <strong>💡 Astuce :</strong> mettez votre email pro sur <strong>tous</strong> vos appareils (PC + téléphone). Comme c'est de l'IMAP, les emails sont synchronisés partout : si vous lisez un email sur le téléphone, il apparaît comme lu sur le PC.
              </p>`;
}
