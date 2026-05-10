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

import * as net from "node:net";
import * as tls from "node:tls";
import type { Config } from "./config";

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendMailResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  messageId?: string;
}

export async function sendMail(cfg: Config, input: SendMailInput): Promise<SendMailResult> {
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
    });
    if (result.ok) {
      console.log(`[email] sent OK to=${input.to} messageId=${result.messageId}`);
    } else {
      console.error(`[email] send FAILED to=${input.to}: ${result.error}`);
    }
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[email] send EXCEPTION to=${input.to}: ${msg}`);
    return { ok: false, error: msg };
  }
}

// ─── Implémentation SMTP minimale ────────────────────────────────────────

interface SmtpSendInput {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Envoie un email via SMTP. Implémente le state machine SMTP :
 *   220 → EHLO → 250 → AUTH LOGIN → 334 → user(b64) → 334 → pass(b64) →
 *   235 → MAIL FROM → 250 → RCPT TO → 250 → DATA → 354 → body+. → 250 →
 *   QUIT → 221.
 */
function smtpSend(input: SmtpSendInput): Promise<SendMailResult> {
  return new Promise((resolve) => {
    const useSSL = input.port === 465;
    let socket: net.Socket | tls.TLSSocket;
    if (useSSL) {
      socket = tls.connect({
        host: input.host,
        port: input.port,
        servername: input.host,
      });
    } else {
      socket = net.connect({ host: input.host, port: input.port });
    }

    let buffer = "";
    let step: SmtpStep = "greeting";
    let resolved = false;
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@batidesk>`;

    const finish = (result: SendMailResult): void => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try {
        socket.end();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ ok: false, error: "SMTP timeout (30s)" });
    }, 30000);

    const write = (cmd: string): void => {
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

    socket.on("data", (chunk: string | Buffer) => {
      buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");

      // Une réponse SMTP se termine quand on voit "XXX texte" (espace, pas tiret)
      // au début d'une ligne. Avant ça, "XXX-texte" (tiret) = continuation.
      const responses: string[] = [];
      while (true) {
        const lines = buffer.split(/\r?\n/);
        let endIdx = -1;
        for (let i = 0; i < lines.length - 1; i++) {
          if (/^\d{3} /.test(lines[i] ?? "")) {
            endIdx = i;
            break;
          }
        }
        if (endIdx === -1) break;
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

type SmtpStep =
  | "greeting"
  | "ehlo"
  | "auth-login"
  | "auth-user"
  | "auth-pass"
  | "mail-from"
  | "rcpt-to"
  | "data"
  | "body"
  | "quit"
  | "done";

/** Extrait l'adresse email depuis "Nom <email@x.com>" ou retourne tel quel. */
function extractEmail(s: string): string {
  const m = s.match(/<([^>]+)>/);
  return m && m[1] ? m[1] : s.trim();
}

function buildMimeMessage(input: SmtpSendInput, messageId: string): string {
  const date = new Date().toUTCString();
  const boundary = `bd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // Encoding base64 : auto-wrap à 76 chars/ligne (max RFC 5322 = 998 mais
  // base64 est conventionnellement à 76). Évite l'erreur Exim
  // "lines too long for transport" sur les emails HTML volumineux.
  const b64 = (s: string): string => {
    const encoded = Buffer.from(s, "utf8").toString("base64");
    // Wrap à 76 chars
    const chunks: string[] = [];
    for (let i = 0; i < encoded.length; i += 76) {
      chunks.push(encoded.slice(i, i + 76));
    }
    return chunks.join("\r\n");
  };

  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join("\r\n");

  const body = [
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    "",
    b64(input.text),
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    "",
    b64(input.html),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return headers + "\r\n" + body;
}

/** RFC 2047 encoding pour les headers contenant du non-ASCII (sujet en UTF-8). */
function encodeHeader(s: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

function stripHtml(html: string): string {
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

// ─── Templates ───────────────────────────────────────────────────────────

export interface WelcomeEmailInput {
  firstName: string;
  username: string;
  tempPassword: string;
  loginUrl: string;
  companyName?: string;
  /** Si fourni, ajoute une section avec les paramètres IMAP/SMTP de la
   *  mailbox cPanel créée pour le user. */
  mailbox?: {
    email: string;
    imapHost: string;
    smtpHost: string;
    webmailUrl: string;
  };
}

/**
 * Email envoyé à un nouvel utilisateur lors de sa création par l'admin.
 * Contient identifiant, mot de passe temporaire, et lien de connexion.
 */
export function welcomeEmailHtml(opts: WelcomeEmailInput): string {
  const firstName = escapeHtml(opts.firstName) || "Bonjour";
  const username = escapeHtml(opts.username);
  const tempPassword = escapeHtml(opts.tempPassword);
  const loginUrl = escapeHtml(opts.loginUrl);
  const companyName = escapeHtml(opts.companyName ?? "BatiDesk");

  // Section optionnelle "Mailbox cPanel"
  const mailboxBlock = opts.mailbox
    ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin:16px 0;">
                <tr>
                  <td style="padding:20px;">
                    <div style="font-size:13px;font-weight:600;color:#1e3a8a;margin-bottom:8px;">📬 Votre boîte mail professionnelle</div>
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:4px;">Adresse email</div>
                    <div style="font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:14px;color:#0f172a;margin-bottom:12px;">${escapeHtml(opts.mailbox.email)}</div>
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:4px;">Mot de passe mailbox</div>
                    <div style="font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:14px;color:#0f172a;margin-bottom:12px;">Identique au mot de passe BatiDesk ci-dessus</div>
                    <div style="font-size:12px;line-height:1.6;color:#475569;margin-top:12px;border-top:1px solid #bfdbfe;padding-top:12px;">
                      <strong>Webmail :</strong> <a href="${escapeHtml(opts.mailbox.webmailUrl)}" style="color:#2563eb;">${escapeHtml(opts.mailbox.webmailUrl)}</a><br>
                      <strong>IMAP entrant :</strong> ${escapeHtml(opts.mailbox.imapHost)} · port 993 (SSL)<br>
                      <strong>SMTP sortant :</strong> ${escapeHtml(opts.mailbox.smtpHost)} · port 465 (SSL)<br>
                      <strong>Username :</strong> ${escapeHtml(opts.mailbox.email)}
                    </div>
                  </td>
                </tr>
              </table>`
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
