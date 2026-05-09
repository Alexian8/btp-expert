import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Send, FileText, Bell } from "lucide-react";
import { toast } from "sonner";

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
  onClose: () => void;
  onSent: () => void;
}

export function SendInvoiceByEmailModal({
  open, invoiceId, invoiceReference, defaultTo, defaultSubject, defaultBody,
  isReminder = false, onClose, onSent,
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
    const r = await window.btpAPI.invoicesSendViaOutlook({
      invoiceId,
      to: to.trim(),
      cc: cc.trim(),
      subject: subject.trim() || `${isReminder ? "Relance : " : "Votre facture "}${invoiceReference}`,
      body: body.trim(),
      markAsReminder: isReminder,
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

  const accentIcon = isReminder ? Bell : Mail;
  const AccentIcon = accentIcon;
  const title = isReminder ? "Envoyer une relance" : "Envoyer la facture par email";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-xl w-full max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${isReminder ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-primary/15 text-primary"} flex items-center justify-center`}>
                  <AccentIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{title}</h2>
                  <p className="text-xs text-muted-foreground">{invoiceReference} · PDF joint automatiquement</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
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

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSend} loading={sending}>
                <Send className="w-4 h-4" />
                {isReminder ? "Envoyer la relance" : "Envoyer"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
