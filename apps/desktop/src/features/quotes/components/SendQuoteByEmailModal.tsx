import { useEffect, useState } from "react";
import { Send, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { SideDrawer } from "@/components/shared/SideDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ═══════════════════════════════════════════════════════════════════════════
// SendQuoteByEmailModal — Envoi par email via Outlook Graph
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  quoteId: string;
  quoteReference: string;
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
  /** Génère le PDF du devis en base64 (utilisé côté web pour l'envoi SMTP avec
   *  pièce jointe ; ignoré côté desktop qui génère le PDF lui-même). */
  getPdfBase64?: () => Promise<string>;
  onClose: () => void;
  onSent: () => void;
}

export function SendQuoteByEmailModal({
  open, quoteId, quoteReference, defaultTo, defaultSubject, defaultBody, getPdfBase64, onClose, onSent,
}: Props) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setCc("");
    }
  }, [open, defaultTo, defaultSubject, defaultBody]);

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error("Veuillez renseigner un destinataire");
      return;
    }
    if (!window.btpAPI?.quotesSendViaOutlook) return;

    setSending(true);

    // Côté web : génération du PDF dans le navigateur + pièce jointe (envoi SMTP).
    // Côté desktop : le PDF est généré par le main process.
    let attachmentBase64: string | undefined;
    let attachmentName: string | undefined;
    if ((window.btpAPI as { isWeb?: boolean })?.isWeb && getPdfBase64) {
      try {
        attachmentBase64 = await getPdfBase64();
        attachmentName = `${quoteReference}.pdf`;
      } catch {
        setSending(false);
        toast.error("Impossible de générer le PDF du devis");
        return;
      }
    }

    const r = await window.btpAPI.quotesSendViaOutlook({
      quoteId,
      to: to.trim(),
      cc: cc.trim(),
      subject: subject.trim() || `Votre devis ${quoteReference}`,
      body: body.trim(),
      ...(attachmentBase64 ? { attachmentBase64, attachmentName } : {}),
    });
    setSending(false);

    if (r.success) {
      toast.success("Email envoyé avec succès");
      onSent();
      onClose();
    } else if (r.needsLogin) {
      toast.error("Connectez-vous d'abord à Microsoft dans Paramètres > Sauvegarde");
    } else {
      toast.error(r.error || "Échec de l'envoi");
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" onClick={onClose}>Annuler</Button>
      <Button onClick={handleSend} loading={sending}>
        <Send className="w-4 h-4" />
        Envoyer
      </Button>
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      widthClass="max-w-xl"
      title="Envoyer par email"
      subtitle={'Via votre compte Outlook · Le devis sera marqué "Envoyé"'}
      footer={footer}
    >
            {/* Body */}
            <div className="p-5 space-y-3">
              <div>
                <Label>Destinataire *</Label>
                <Input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="client@exemple.fr"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Séparer plusieurs adresses par une virgule
                </p>
              </div>

              <div>
                <Label>Copie (CC)</Label>
                <Input
                  type="email"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="Optionnel"
                />
              </div>

              <div>
                <Label>Objet</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div>
                <Label>Message</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                />
              </div>

              {/* Pièce jointe */}
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted text-sm">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="font-mono text-xs">{quoteReference}.pdf</span>
                <span className="text-xs text-muted-foreground ml-auto">généré automatiquement</span>
              </div>

              {/* Alerte OAuth */}
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  L'email sera envoyé depuis votre compte Microsoft et apparaîtra dans vos "Éléments envoyés".
                  Si c'est votre premier envoi, Microsoft pourrait demander d'autoriser l'accès <strong>Mail.Send</strong>.
                </div>
              </div>
            </div>
    </SideDrawer>
  );
}
