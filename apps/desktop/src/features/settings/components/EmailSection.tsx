import { useEffect, useState } from "react";
import { Mail, Send, CheckCircle2, XCircle, AlertTriangle, Server } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSectionWrapper } from "./SettingsPage";
import { useAuthStore } from "@/stores/authStore";

// ═══════════════════════════════════════════════════════════════════════════
// EmailSection — diagnostic de l'envoi d'emails (SMTP), admin only, web.
// Affiche la config SMTP vue par le serveur (jamais le mot de passe) et
// permet d'envoyer un email de test : l'erreur SMTP EXACTE est remontée,
// ce qui permet de distinguer .env non chargé / mauvais hôte / mauvais mot
// de passe / problème de délivrabilité (email envoyé mais jamais reçu).
// ═══════════════════════════════════════════════════════════════════════════

const TOKEN_KEY = "btp.web.token";

interface SmtpStatus {
  configured: boolean;
  host: string;
  port: number;
  user: string;
  from: string;
}

interface TestResult {
  success: boolean;
  error?: string;
  messageId?: string;
  durationMs?: number;
  host?: string;
  port?: number;
  user?: string;
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as T | { message?: string } | null;
  if (!res.ok) {
    const msg = (data as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export function EmailSection() {
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<SmtpStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  useEffect(() => {
    setTestTo(user?.email ?? "");
  }, [user?.email]);

  useEffect(() => {
    let alive = true;
    api<SmtpStatus>("GET", "/api/email/smtp-status")
      .then((s) => {
        if (alive) setStatus(s);
      })
      .catch((e) => {
        if (alive) setStatusError(e instanceof Error ? e.message : "Erreur");
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleTest = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!testTo.trim() || !testTo.includes("@")) {
      toast.error("Renseignez une adresse email de test valide");
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const r = await api<TestResult>("POST", "/api/email/test-smtp", { to: testTo.trim() });
      setResult(r);
      if (r.success) {
        toast.success("Email de test envoyé — vérifiez la boîte (et les spams)");
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : "Erreur inattendue" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Config vue par le serveur */}
      <SettingsSectionWrapper
        title="Configuration SMTP"
        description="Paramètres d'envoi vus par le serveur (variables SMTP_* du .env). Utilisés pour les devis/factures (web), les invitations et le « mot de passe oublié »."
      >
        {statusError ? (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {statusError}
          </div>
        ) : !status ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="space-y-2">
            <div
              className={
                status.configured
                  ? "flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-400"
                  : "flex items-center gap-2 p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-sm text-rose-700 dark:text-rose-400"
              }
            >
              {status.configured ? (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  SMTP configuré côté serveur
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 shrink-0" />
                  SMTP NON configuré — le serveur ne voit pas SMTP_HOST / SMTP_USER / SMTP_PASS
                  (fichier .env absent ou app non redémarrée)
                </>
              )}
            </div>
            {status.configured && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="p-3 rounded-md bg-muted flex items-center gap-2">
                  <Server className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs truncate">
                    {status.host}:{status.port}
                  </span>
                </div>
                <div className="p-3 rounded-md bg-muted flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs truncate">{status.user}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </SettingsSectionWrapper>

      {/* Test d'envoi */}
      <SettingsSectionWrapper
        title="Tester l'envoi d'email"
        description="Envoie un vrai email de test et affiche l'erreur exacte en cas d'échec."
      >
        <form onSubmit={handleTest} className="space-y-3 max-w-md">
          <div className="grid gap-2">
            <Label htmlFor="test-email">Envoyer un test à</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="test-email"
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="vous@exemple.fr"
                className="pl-9"
              />
            </div>
          </div>
          <Button type="submit" loading={testing} disabled={!testTo.trim()}>
            <Send className="w-4 h-4" />
            Envoyer l'email de test
          </Button>
        </form>

        {result && (
          <div
            className={
              result.success
                ? "mt-4 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-sm"
                : "mt-4 p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-sm"
            }
          >
            {result.success ? (
              <div className="text-emerald-700 dark:text-emerald-400">
                <p className="font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Email accepté par le serveur SMTP ({result.durationMs} ms)
                </p>
                <p className="text-xs mt-1 opacity-90">
                  S'il n'arrive pas dans la boîte : regardez les <strong>spams</strong>. S'il n'y
                  est pas non plus, c'est un problème de délivrabilité (SPF/DKIM à activer dans
                  cPanel → Email Deliverability, ou adresse expéditrice sur un sous-domaine de
                  dev rejetée par Gmail).
                </p>
              </div>
            ) : (
              <div className="text-rose-700 dark:text-rose-400">
                <p className="font-medium flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  Échec de l'envoi
                </p>
                <code className="block mt-1.5 text-xs bg-background/60 rounded p-2 break-all">
                  {result.error}
                </code>
                <ul className="text-xs mt-2 space-y-1 opacity-90 list-disc pl-4">
                  <li>
                    <strong>SMTP error 535 / auth</strong> : mot de passe ou identifiant de la
                    boîte incorrects — vérifiez que la boîte existe (cPanel → Comptes de
                    messagerie) et testez-la au webmail.
                  </li>
                  <li>
                    <strong>socket error / timeout / certificat</strong> : mauvais hôte SMTP —
                    essayez le nom du serveur o2switch (ex. <code>loris.o2switch.net</code>)
                    dans SMTP_HOST, port 465.
                  </li>
                  <li>
                    <strong>SMTP non configuré</strong> : le .env n'est pas lu — placez-le à la
                    racine du dépôt cloné puis redémarrez l'app Node.
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}
      </SettingsSectionWrapper>
    </div>
  );
}
