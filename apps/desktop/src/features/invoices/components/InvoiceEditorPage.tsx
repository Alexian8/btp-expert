import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Save, Trash2, Send, Eye, Download, Mail, Bell,
  CreditCard, FileText, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { ClientSelector } from "@/components/shared/ClientSelector";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PdfPreviewModal } from "@/components/shared/PdfPreviewModal";
import { useInvoicesStore } from "@/stores/invoicesStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useCompanyStore } from "@/stores/companyStore";
import { QuoteItemsEditor } from "@/features/quotes/components/QuoteItemsEditor";
import { QuoteTotalsPanel } from "@/features/quotes/components/QuoteTotalsPanel";
import { PaymentModal } from "./PaymentModal";
import { PaymentsHistory } from "./PaymentsHistory";
import { SendInvoiceByEmailModal } from "./SendInvoiceByEmailModal";
import {
  EMPTY_INVOICE,
  INVOICE_STATUS_META,
  INVOICE_TYPE_META,
  computeDueDate,
  type Invoice,
  type InvoiceStatus,
  type InvoiceType,
  type QuoteItem,
} from "@btp/types";
import { computeQuoteTotals, formatEuros } from "@/features/quotes/quoteEngine";
import { formatDateFR, isInvoiceOverdue, daysOverdue } from "../invoiceEngine";
import { PAYMENT_TERM_PRESETS, findPresetByDays } from "@/lib/paymentTerms";

// ═══════════════════════════════════════════════════════════════════════════
// InvoiceEditorPage — Éditeur de facture
// ═══════════════════════════════════════════════════════════════════════════

export function InvoiceEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { invoices, fetch, getById, create, update, updateStatus, delete: deleteInvoice } = useInvoicesStore();
  const fetchClients = useClientsStore((s) => s.fetch);
  const chantiers = useChantiersStore((s) => s.chantiers);
  const fetchChantiers = useChantiersStore((s) => s.fetch);
  const company = useCompanyStore((s) => s.company);
  const fetchCompany = useCompanyStore((s) => s.fetch);

  const isNew = id === "new";
  const existing = isNew ? null : getById(id || "");

  const [formData, setFormData] = useState<Omit<Invoice, "id" | "reference" | "createdAt" | "updatedAt">>({ ...EMPTY_INVOICE });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewPath, setPdfPreviewPath] = useState<string | null>(null);

  useEffect(() => {
    fetch();
    fetchClients();
    fetchChantiers();
    fetchCompany();
  }, []);

  useEffect(() => {
    if (existing) {
      const { id: _a, reference: _b, createdAt: _c, updatedAt: _d, ...rest } = existing;
      setFormData({ ...rest });
      setDirty(false);
    } else if (isNew) {
      setFormData({ ...EMPTY_INVOICE });
      setDirty(false);
    }
  }, [existing?.id, isNew]);

  // ─── Calcul des totaux en live ────────────────────────────────────────
  const totals = useMemo(() => computeQuoteTotals(formData as any), [formData]);

  // ─── Recalculer la date d'échéance quand issueDate ou termsDays change
  useEffect(() => {
    if (formData.issueDate && formData.paymentTermsDays) {
      const newDue = computeDueDate(formData.issueDate, formData.paymentTermsDays);
      if (newDue !== formData.dueDate) {
        setFormData((f) => ({ ...f, dueDate: newDue }));
      }
    }
  }, [formData.issueDate, formData.paymentTermsDays]);

  // ─── Filtrer les chantiers par client ─────────────────────────────────
  const availableChantiers = useMemo(() => {
    if (!formData.clientId) return [];
    return chantiers.filter((c) => c.clientId === formData.clientId);
  }, [chantiers, formData.clientId]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const update_ = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!formData.clientId) {
      toast.error("Sélectionnez un client");
      return;
    }
    if (formData.items.length === 0) {
      toast.error("Ajoutez au moins une ligne à la facture");
      return;
    }

    setSaving(true);
    const payload = {
      ...formData,
      totalHT: totals.totalHT,
      totalTTC: totals.totalTTC,
      companySnapshot: company,
    };

    if (existing) {
      const r = await update(existing.id, payload);
      setSaving(false);
      if (r.success) {
        toast.success("Facture enregistrée");
        setDirty(false);
      } else {
        toast.error(r.error || "Erreur");
      }
    } else {
      const r = await create(payload);
      setSaving(false);
      if (r.success) {
        toast.success("Facture créée");
        setDirty(false);
        if (r.id) {
          navigate(`/invoices/${r.id}`, { replace: true });
        }
      } else {
        toast.error(r.error || "Erreur");
      }
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const r = await deleteInvoice(existing.id);
    if (r.success) {
      toast.success("Facture supprimée");
      navigate("/quotes");
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleStatusChange = async (status: InvoiceStatus) => {
    if (!existing) return;
    const r = await updateStatus(existing.id, status);
    if (r.success) toast.success(`Statut : ${INVOICE_STATUS_META[status].label}`);
  };

  // ─── PDF ─────────────────────────────────────────────────────────
  const handlePreviewPdf = async () => {
    if (!existing || !window.btpAPI?.invoicesExportPdfPreview) return;
    setGeneratingPdf(true);
    const r = await window.btpAPI.invoicesExportPdfPreview(existing.id);
    setGeneratingPdf(false);
    if (r.success && r.path) {
      // Ouvrir l'aperçu dans la modal interne (au lieu de l'app externe)
      setPdfPreviewPath(r.path);
      setPdfPreviewOpen(true);
      // Notif coffre-fort
      if (r.vault?.stored) {
        toast.success(r.vault.replaced ? "PDF mis à jour dans le coffre-fort" : "PDF rangé dans le coffre-fort", { duration: 3000 });
      } else if (r.vault && !r.vault.stored && !r.vault.error) {
        toast.info("PDF non rangé : aucun client/chantier lié", { duration: 4000 });
      }
    } else {
      toast.error(r.error || "Erreur de génération du PDF");
    }
  };

  const handleDownloadPdf = async () => {
    if (!existing || !window.btpAPI?.invoicesExportPdfSaveAs) return;
    const r = await window.btpAPI.invoicesExportPdfSaveAs(existing.id);
    if (r.success && r.path) {
      toast.success("PDF enregistré");
      if (r.vault?.stored) {
        toast.success(r.vault.replaced ? "Aussi mis à jour dans le coffre-fort" : "Aussi rangé dans le coffre-fort", { duration: 3000 });
      }
    } else if (!r.cancelled) {
      toast.error(r.error || "Erreur");
    }
  };

  // ─── Email ──────────────────────────────────────────────────────
  const handleOpenEmailModal = () => {
    if (!existing) return;
    setEmailModalOpen(true);
  };

  const handleOpenReminderModal = () => {
    if (!existing) return;
    setReminderModalOpen(true);
  };

  // Récupérer l'email du client pour pré-remplir
  const clientForEmail = existing
    ? useClientsStore.getState().clients.find((c) => c.id === existing.clientId)
    : null;
  const clientEmail = clientForEmail?.email || "";

  const meta = existing ? INVOICE_STATUS_META[existing.status] : INVOICE_STATUS_META.brouillon;
  const typeMeta = existing ? INVOICE_TYPE_META[existing.type] : INVOICE_TYPE_META[formData.type];
  const overdue = existing ? isInvoiceOverdue(existing) : false;
  const daysLate = existing ? daysOverdue(existing) : 0;
  const remaining = existing ? (existing.totalTTC - existing.totalPaid) : 0;

  // Templates email avec variables inline (complétés par les settings au Msg3 Part 2)
  const buildEmailBody = (isReminder: boolean): { subject: string; body: string } => {
    if (!existing) return { subject: "", body: "" };
    const companyName = (company as any)?.entreprise || "votre prestataire";
    const clientName = clientForEmail
      ? (clientForEmail.type === "pro" && clientForEmail.companyName
        ? clientForEmail.companyName
        : `${clientForEmail.firstName || ""} ${clientForEmail.lastName || ""}`.trim())
      : "Madame, Monsieur";
    const totalTTCStr = formatEuros(existing.totalTTC || 0);
    const dueDateStr = existing.dueDate ? new Date(existing.dueDate).toLocaleDateString("fr-FR") : "—";

    if (isReminder) {
      return {
        subject: `Relance : facture ${existing.reference}`,
        body: `Bonjour ${clientName},

Sauf erreur de notre part, votre facture ${existing.reference} d'un montant de ${totalTTCStr} reste impayée à ce jour.
Échéance : ${dueDateStr} (${daysLate} jours de retard)

Nous vous serions reconnaissants de bien vouloir procéder au règlement dans les meilleurs délais.
Si le paiement vient d'être effectué, veuillez ignorer ce message.

Vous trouverez en pièce jointe un rappel de la facture concernée.

Cordialement,
${companyName}`,
      };
    }

    return {
      subject: `Votre facture ${existing.reference} - ${companyName}`,
      body: `Bonjour ${clientName},

Vous trouverez ci-joint la facture ${existing.reference} d'un montant de ${totalTTCStr}.
Échéance de paiement : ${dueDateStr}

Je reste à votre disposition pour toute question.

Cordialement,
${companyName}`,
    };
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight">
                  {existing ? existing.reference : "Nouvelle facture"}
                </h1>
                {existing && (
                  <>
                    <span className={cn(
                      "text-[10px] uppercase font-semibold px-2 py-0.5 rounded",
                      existing.type === "standard" && "bg-slate-500/15 text-slate-500",
                      existing.type === "acompte"  && "bg-amber-500/15 text-amber-500",
                      existing.type === "avoir"    && "bg-rose-500/15 text-rose-500",
                    )}>
                      {typeMeta.shortLabel}
                    </span>
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded",
                      meta.color === "slate"   && "bg-slate-500/15 text-slate-500",
                      meta.color === "blue"    && "bg-blue-500/15 text-blue-500",
                      meta.color === "amber"   && "bg-amber-500/15 text-amber-500",
                      meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                      meta.color === "rose"    && "bg-rose-500/15 text-rose-500",
                    )}>
                      {meta.label}
                    </span>
                    {overdue && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-rose-500/15 text-rose-500 inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {daysLate}j de retard
                      </span>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {existing ? formatDateFR(existing.issueDate) : "Brouillon"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            {existing && (
              <>
                {/* PDF */}
                <Button variant="outline" size="sm" onClick={handlePreviewPdf} loading={generatingPdf}>
                  <Eye className="w-3.5 h-3.5" />
                  Aperçu PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                  <Download className="w-3.5 h-3.5" />
                  Télécharger
                </Button>
                <Button variant="outline" size="sm" onClick={handleOpenEmailModal}>
                  <Mail className="w-3.5 h-3.5" />
                  Envoyer par email
                </Button>

                {/* Paiement */}
                {(existing.status === "envoyee" || existing.status === "partiellement-payee") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentModalOpen(true)}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Enregistrer un paiement
                  </Button>
                )}

                {/* Relance : facture impayée et en retard */}
                {overdue && (
                  <Button variant="outline" size="sm" onClick={handleOpenReminderModal}>
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    Envoyer une relance
                  </Button>
                )}

                {existing.status === "brouillon" && (
                  <Button variant="outline" size="sm" onClick={() => handleStatusChange("envoyee")}>
                    <Send className="w-3.5 h-3.5" />
                    Marquer envoyée
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </>
            )}
            <Button onClick={handleSave} loading={saving} size="sm">
              <Save className="w-4 h-4" />
              Enregistrer
            </Button>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Colonne principale */}
        <div className="space-y-4">
          {/* Infos générales */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <FileText className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              Informations générales
            </h3>

            <div>
              <Label>Titre de la facture</Label>
              <Input
                value={formData.title}
                onChange={(e) => update_("title", e.target.value)}
                placeholder="Ex: Rénovation salle de bain"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <NativeSelect
                  value={formData.type}
                  onChange={(e) => update_("type", e.target.value as InvoiceType)}
                  disabled={!!existing}
                >
                  <option value="standard">Standard</option>
                  <option value="acompte">Acompte</option>
                  <option value="avoir">Avoir</option>
                </NativeSelect>
              </div>
              <div>
                <Label>Conditions de règlement</Label>
                <select
                  value={findPresetByDays(formData.paymentTermsDays).id}
                  onChange={(e) => {
                    const preset = PAYMENT_TERM_PRESETS.find((p) => p.id === e.target.value);
                    if (!preset) return;
                    if (preset.id === "custom") {
                      // Reste sur la valeur actuelle, l'utilisateur va la modifier
                      update_("paymentTermsDays", formData.paymentTermsDays || 30);
                    } else {
                      update_("paymentTermsDays", preset.days);
                    }
                  }}
                  className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                >
                  {PAYMENT_TERM_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                {findPresetByDays(formData.paymentTermsDays).id === "custom" && (
                  <Input
                    type="number"
                    min="0"
                    value={formData.paymentTermsDays}
                    onChange={(e) => update_("paymentTermsDays", Number(e.target.value) || 0)}
                    placeholder="Nombre de jours"
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date d'émission</Label>
                <Input
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => update_("issueDate", e.target.value)}
                />
              </div>
              <div>
                <Label>Date d'échéance</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => update_("dueDate", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Destinataire */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Destinataire
            </h3>
            <div>
              <Label>Client *</Label>
              <ClientSelector
                value={formData.clientId}
                onChange={(v) => update_("clientId", v)}
              />
            </div>
            {availableChantiers.length > 0 && (
              <div>
                <Label>Chantier lié (optionnel)</Label>
                <NativeSelect
                  value={formData.chantierId}
                  onChange={(e) => update_("chantierId", e.target.value)}
                >
                  <option value="">— Aucun —</option>
                  {availableChantiers.map((c) => (
                    <option key={c.id} value={c.id}>{c.reference} · {c.title}</option>
                  ))}
                </NativeSelect>
              </div>
            )}
          </div>

          {/* Intro */}
          <div className="bg-card border border-border rounded-lg p-4">
            <Label>Introduction (optionnelle)</Label>
            <Textarea
              value={formData.introText}
              onChange={(e) => update_("introText", e.target.value)}
              rows={2}
              placeholder="Texte qui apparaîtra au-dessus des lignes..."
            />
          </div>

          {/* Lignes */}
          <div className="bg-card border border-border rounded-lg p-4">
            <QuoteItemsEditor
              items={formData.items as QuoteItem[]}
              onChange={(items) => update_("items", items)}
              vatEnabled={company?.tvaApplicable !== false}
              onLibraryUse={() => {}}
            />
          </div>

          {/* Conditions */}
          <div className="bg-card border border-border rounded-lg p-4">
            <Label>Conditions de règlement</Label>
            <Textarea
              value={formData.conditionsText}
              onChange={(e) => update_("conditionsText", e.target.value)}
              rows={3}
            />
          </div>

          {/* Historique paiements */}
          {existing && (
            <PaymentsHistory
              invoice={existing}
              onAddPayment={() => setPaymentModalOpen(true)}
            />
          )}
        </div>

        {/* Totaux sticky */}
        <div className="lg:sticky lg:top-24 h-fit">
          <QuoteTotalsPanel
            totals={totals}
            quote={{
              globalDiscountMode: formData.globalDiscountMode,
              globalDiscountPercent: formData.globalDiscountPercent,
              globalDiscountAmount: formData.globalDiscountAmount,
            }}
            onDiscountChange={(patch) => {
              if (patch.globalDiscountMode !== undefined) update_("globalDiscountMode", patch.globalDiscountMode);
              if (patch.globalDiscountPercent !== undefined) update_("globalDiscountPercent", patch.globalDiscountPercent);
              if (patch.globalDiscountAmount !== undefined) update_("globalDiscountAmount", patch.globalDiscountAmount);
            }}
            vatEnabled={company?.tvaApplicable !== false}
          />

          {existing && existing.totalPaid > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-card border border-border space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total TTC</span>
                <span className="font-medium tabular-nums">{formatEuros(existing.totalTTC)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Payé</span>
                <span className="font-medium tabular-nums text-emerald-500">{formatEuros(existing.totalPaid)}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                <span className="font-semibold">Reste dû</span>
                <span className="font-bold tabular-nums text-primary">{formatEuros(remaining)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Supprimer cette facture ?"
        description="Cette action est irréversible et supprimera aussi les paiements liés."
        confirmLabel="Supprimer"
        destructive
      />

      {existing && (
        <PaymentModal
          open={paymentModalOpen}
          invoiceId={existing.id}
          invoiceReference={existing.reference}
          totalTTC={existing.totalTTC}
          totalPaid={existing.totalPaid}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={() => fetch()}
        />
      )}

      {existing && (
        <>
          <SendInvoiceByEmailModal
            open={emailModalOpen}
            invoiceId={existing.id}
            invoiceReference={existing.reference}
            defaultTo={clientEmail}
            defaultSubject={buildEmailBody(false).subject}
            defaultBody={buildEmailBody(false).body}
            isReminder={false}
            onClose={() => setEmailModalOpen(false)}
            onSent={() => fetch()}
          />
          <SendInvoiceByEmailModal
            open={reminderModalOpen}
            invoiceId={existing.id}
            invoiceReference={existing.reference}
            defaultTo={clientEmail}
            defaultSubject={buildEmailBody(true).subject}
            defaultBody={buildEmailBody(true).body}
            isReminder={true}
            onClose={() => setReminderModalOpen(false)}
            onSent={() => fetch()}
          />
        </>
      )}

      <PdfPreviewModal
        open={pdfPreviewOpen}
        pdfPath={pdfPreviewPath}
        title={existing?.reference || "Facture"}
        subtitle={existing?.title || "Aperçu de la facture"}
        onClose={() => setPdfPreviewOpen(false)}
        onDownload={handleDownloadPdf}
      />
    </div>
  );
}
