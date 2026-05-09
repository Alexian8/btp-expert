import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, X, Send, Paperclip, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ═══════════════════════════════════════════════════════════════════════════
// SendDocumentMailModal — Envoi de devis/facture par mail (Session S28)
// Utilise les templates emailQuoteSubject/Body, emailInvoiceSubject/Body,
// emailReminderSubject/Body avec remplacement de variables.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
  docType: "quote" | "invoice";
  docId: number;
  /** Pour les factures : "send" (envoi initial) ou "reminder" (relance) */
  invoiceMode?: "send" | "reminder";
  /** Callback quand l'envoi a réussi */
  onSent?: () => void;
}

export function SendDocumentMailModal({
  open, onClose, docType, docId, invoiceMode = "send", onSent,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [docRef, setDocRef] = useState("");

  // Charge la prévisualisation à l'ouverture
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const api = (window as any).btpAPI;
        let r;
        if (docType === "quote") {
          if (!api?.emailPrepareQuoteMail) {
            throw new Error("API d'email indisponible");
          }
          r = await api.emailPrepareQuoteMail(docId);
        } else {
          if (!api?.emailPrepareInvoiceMail) {
            throw new Error("API d'email indisponible");
          }
          r = await api.emailPrepareInvoiceMail({ invoiceId: docId, mode: invoiceMode });
        }
        if (!mounted) return;
        if (r?.success) {
          setTo(r.to || "");
          setSubject(r.subject || "");
          setBody(r.body || "");
          setDocRef(r.quoteRef || r.invoiceRef || "");
        } else {
          setError(r?.error || "Erreur lors de la préparation");
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || "Erreur inattendue");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, docType, docId, invoiceMode]);

  const handleSend = async () => {
    if (!to.trim() || !to.includes("@")) {
      toast.error("Adresse email invalide");
      return;
    }
    if (!subject.trim()) {
      toast.error("L'objet ne peut pas être vide");
      return;
    }

    setSending(true);
    try {
      const api = (window as any).btpAPI;
      if (!api?.emailSendDocument) {
        throw new Error("API d'email indisponible");
      }
      const r = await api.emailSendDocument({
        docType,
        docId,
        to: to.trim(),
        subject: subject.trim(),
        body: body,
      });
      if (r?.success) {
        toast.success("Mail envoyé !", {
          description: `À ${to} avec le PDF en pièce jointe`,
        });
        onSent?.();
        onClose();
      } else {
        toast.error(r?.error || "L'envoi a échoué");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur inattendue");
    } finally {
      setSending(false);
    }
  };

  const docLabel = docType === "quote"
    ? `Devis ${docRef}`
    : invoiceMode === "reminder"
      ? `Relance facture ${docRef}`
      : `Facture ${docRef}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !sending) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold leading-tight">Envoyer par mail</h2>
                  <p className="text-xs text-muted-foreground">
                    {docLabel} — via votre compte Outlook
                  </p>
                </div>
              </div>
              <button
                onClick={() => !sending && onClose()}
                disabled={sending}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Préparation du mail...
                </div>
              ) : error ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">À</Label>
                    <Input
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="email@exemple.fr"
                      type="email"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Objet</Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Message</Label>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={10}
                      className="mt-1 text-sm font-sans"
                    />
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-accent/50 border border-border rounded-md">
                    <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      Le PDF du {docType === "quote" ? "devis" : "facture"} sera ajouté en pièce jointe
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={onClose} disabled={sending}>
                Annuler
              </Button>
              <Button
                onClick={handleSend}
                loading={sending}
                disabled={loading || !!error || sending}
              >
                <Send className="w-4 h-4" />
                Envoyer le mail
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
