import { useEffect, useState } from "react";
import { Landmark, Plug, Loader2, CheckCircle2, ExternalLink, RefreshCw, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

// ═══════════════════════════════════════════════════════════════════════════
// QontoSection — connexion du compte bancaire Qonto (intégration en préparation).
// Lecture seule : solde + transactions. Le rapprochement automatique et
// l'import en comptabilité viendront ensuite.
// ═══════════════════════════════════════════════════════════════════════════

interface QontoAccount {
  slug: string;
  name: string;
  iban: string;
  balance: number;
  currency: string;
}
interface QontoStatus {
  connected: boolean;
  loginMasked?: string;
  organizationName?: string;
  connectedAt?: string;
}

type Api = {
  qontoStatus?: () => Promise<QontoStatus>;
  qontoConnect?: (login: string, secretKey: string) => Promise<{ success: boolean; organizationName?: string; accountsCount?: number; error?: string }>;
  qontoDisconnect?: () => Promise<{ success: boolean; error?: string }>;
  qontoAccounts?: () => Promise<{ organizationName?: string; accounts: QontoAccount[]; error?: string }>;
};

function fmtEuro(n: number): string {
  return (n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }).replace(/ | /g, " ");
}

export function QontoSection() {
  const api = (typeof window !== "undefined" ? (window as unknown as { btpAPI?: Api }).btpAPI : undefined);
  const available = !!api?.qontoStatus;

  const [status, setStatus] = useState<QontoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [login, setLogin] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [accounts, setAccounts] = useState<QontoAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const refreshStatus = async () => {
    if (!api?.qontoStatus) { setLoading(false); return; }
    setLoading(true);
    const s = await api.qontoStatus();
    setStatus(s);
    setLoading(false);
    if (s.connected) loadAccounts();
  };

  const loadAccounts = async () => {
    if (!api?.qontoAccounts) return;
    setLoadingAccounts(true);
    const r = await api.qontoAccounts();
    setLoadingAccounts(false);
    if (r.error) { toast.error(r.error); return; }
    setAccounts(r.accounts || []);
  };

  useEffect(() => { refreshStatus(); /* eslint-disable-next-line */ }, []);

  const handleConnect = async () => {
    if (!api?.qontoConnect) return;
    if (!login.trim() || !secretKey.trim()) { toast.error("Renseignez le login et la secret key."); return; }
    setConnecting(true);
    const r = await api.qontoConnect(login.trim(), secretKey.trim());
    setConnecting(false);
    if (r.success) {
      toast.success(`Connecté à Qonto${r.organizationName ? ` (${r.organizationName})` : ""}`);
      setLogin(""); setSecretKey("");
      refreshStatus();
    } else {
      toast.error(r.error || "Connexion échouée");
    }
  };

  const handleDisconnect = async () => {
    if (!api?.qontoDisconnect) return;
    await api.qontoDisconnect();
    setConfirmDisconnect(false);
    setAccounts([]);
    toast.success("Compte Qonto déconnecté");
    refreshStatus();
  };

  // ─── Indisponible (desktop / API absente) ──────────────────────────────
  if (!available) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Landmark className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Banque Qonto</h3>
            <p className="text-sm text-muted-foreground mt-1">
              L'intégration Qonto est disponible sur la <strong>version web</strong> de
              BatiDesk (via le serveur). Connectez-vous depuis le navigateur.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Banque Qonto</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Connectez votre compte Qonto pour voir vos soldes et transactions, et
              (bientôt) rapprocher automatiquement vos paiements avec votre comptabilité.
            </p>
          </div>
          {status?.connected && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-500 font-medium shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connecté
            </span>
          )}
        </div>
      </Card>

      {/* Non connecté : formulaire */}
      {!status?.connected && (
        <Card className="p-5 space-y-4">
          <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-3 text-sm space-y-1">
            <div className="flex items-center gap-1.5 text-blue-500 font-medium text-xs uppercase tracking-wider">
              <Info className="w-3.5 h-3.5" /> Où trouver ma clé API
            </div>
            <p className="text-foreground/90">
              Sur <strong>app.qonto.com</strong> → Paramètres → Intégrations &amp;
              partenaires → API &amp; Webhooks → générez une clé. Vous obtenez un
              <strong> login</strong> et une <strong>secret key</strong> (copiez-la, elle
              ne s'affiche qu'une fois).
            </p>
            <a
              href="https://app.qonto.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-500 hover:underline text-xs"
            >
              Ouvrir Qonto <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Login API</Label>
              <Input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="ex: jacob-habitat-5678"
                className="mt-1"
                autoComplete="off"
              />
            </div>
            <div>
              <Label>Secret key</Label>
              <Input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="••••••••••••••••"
                className="mt-1"
                autoComplete="off"
              />
            </div>
            <Button onClick={handleConnect} loading={connecting}>
              <Plug className="w-4 h-4" /> Connecter mon compte Qonto
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Vos identifiants sont stockés chiffrés sur votre serveur et ne sont jamais
              exposés. La connexion est en lecture seule.
            </p>
          </div>
        </Card>
      )}

      {/* Connecté : comptes */}
      {status?.connected && (
        <>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium">{status.organizationName || "Compte Qonto"}</div>
                <div className="text-xs text-muted-foreground">
                  {status.loginMasked} · connecté le {status.connectedAt ? new Date(status.connectedAt).toLocaleDateString("fr-FR") : "—"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadAccounts} disabled={loadingAccounts}>
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAccounts ? "animate-spin" : ""}`} />
                  Actualiser
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDisconnect(true)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>

            {loadingAccounts && accounts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin inline" /> Chargement des comptes…</div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Aucun compte récupéré.</div>
            ) : (
              <div className="space-y-2">
                {accounts.map((a) => (
                  <div key={a.slug} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{a.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{a.iban}</div>
                    </div>
                    <div className="text-lg font-semibold tabular-nums">{fmtEuro(a.balance)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 bg-muted/20">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Prochaines étapes (à venir) : rapprochement automatique des transactions
              avec vos factures et dépenses, et génération des écritures de banque dans
              la comptabilité.
            </p>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
        onConfirm={handleDisconnect}
        title="Déconnecter Qonto ?"
        description="Vos identifiants API seront supprimés du serveur. Vous pourrez vous reconnecter à tout moment."
        confirmLabel="Déconnecter"
        destructive
      />
    </div>
  );
}
