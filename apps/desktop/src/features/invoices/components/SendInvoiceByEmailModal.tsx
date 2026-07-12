import { useEffect, useState } from "react";
import { Send, FileText } from "lucide-react";
import { toast } from "sonner";

import { SideDrawer } from "@/components/shared/SideDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ═══════════════════════════════════════════════════════════════════════════
// SendInvoiceByEmailModal — Envoi d'une facture par email (Outlook Graph)
// Supporte aussi le mode "relance" qui marque markAsReminder=true
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  invoiceId: string;
  invoiceReference: string;
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
  isReminder?: boolean;
  /** Génère le PDF de la facture en base64 (utilisé côté web pour l'envoi SMTP
   *  avec pièce jointe ; ignoré côté desktop qui génère le PDF lui-même). */
  getPdfBase64?: () => Promise<string>;
  onClose: () => void;
  onSent: () => void;
}

export function SendInvoiceByEmailModal({
  open, invoiceId, invoiceReference, defaultTo, defaultSubject, defaultBody,
  isReminder = false, getPdfBase64, onClose, onSent,
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
    if (!window.btpAPI?.invoicesSendViaOutlook) return;

    setSending(true);

    // Côté web : on génère le PDF dans le navigateur et on le joint (l'envoi
    // passe par SMTP). Côté desktop : le PDF est généré par le main process.
    let attachmentBase64: string | undefined;
    let attachmentName: string | undefined;
    if ((window.btpAPI as { isWeb?: boolean })?.isWeb && getPdfBase64) {
      try {
        attachmentBase64 = await getPdfBase64();
        attachmentName = `${invoiceReference}.pdf`;
      } catch {
        setSending(false);
        toast.error("Impossible de générer le PDF de la facture");
        return;
      }
    }

    const r = await window.btpAPI.invoicesSendViaOutlook({
      invoiceId,
      to: to.trim(),
      cc: cc.trim(),
      subject: subject.trim() || `${isReminder ? "Relance : " : "Votre facture "}${invoiceReference}`,
      body: body.trim(),
      markAsReminder: isReminder,
      ...(attachmentBase64 ? { attachmentBase64, attachmentName } : {}),
    });
    setSending(false);

    if (r.success) {
      toast.success(isReminder ? "Relance envoyée" : "Facture envoyée");
      onSent();
      onClose();
    } else if (r.needsLogin) {
      toast.error("Connectez-vous d'abord à Microsoft dans Paramètres > Sauvegarde");
    } else {
      toast.error(r.error || "Échec de l'envoi");
    }
  };

  const title = isReminder ? "Envoyer une relance" : "Envoyer la facture par email";

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" onClick={onClose}>Annuler</Button>
      <Button onClick={handleSend} loading={sending}>
        <Send className="w-4 h-4" />
        {isReminder ? "Envoyer la relance" : "Envoyer"}
      </Button>
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      widthClass="max-w-xl"
      title={title}
      subtitle={`${invoiceReference} · PDF joint automatiquement`}
      footer={footer}
    >
            <div className="p-5 space-y-3">
              <div>
                <Label htmlFor="to">Destinataire *</Label>
                <Input
                  id="to"
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="email@exemple.com"
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="cc">Copie (CC) — optionnel</Label>
                <Input
                  id="cc"
                  type="email"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="autre@exemple.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="subject">Objet</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="body">Message</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="mt-1.5"
                />
              </div>

              <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-xs">
                <FileText className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <p>
                  Le PDF de la facture <strong>{invoiceReference}</strong> sera joint automatiquement.
                  L'email sera envoyé depuis votre compte Outlook connecté.
                </p>
              </div>
            </div>
    </SideDrawer>
  );
}
