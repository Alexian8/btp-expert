import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Trash2, Send, Check, X as XIcon, Info,
  Calendar, FileText, Receipt, Pencil, Eye, Download, Mail,
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
import { useQuotesStore } from "@/stores/quotesStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { useCompanyStore } from "@/stores/companyStore";
import { useLibraryStore } from "@/stores/libraryStore";
import { QuoteItemsEditor } from "./QuoteItemsEditor";
import { QuoteTotalsPanel } from "./QuoteTotalsPanel";
import { SendQuoteByEmailModal } from "./SendQuoteByEmailModal";
import { ConvertToInvoiceModal } from "@/features/invoices/components/ConvertToInvoiceModal";
import {
  EMPTY_QUOTE, QUOTE_STATUS_META, QUOTE_STATUS_ORDER,
  type Quote, type QuoteItem, type QuoteStatus, type LineWorkType,
} from "@btp/types";
import { computeQuoteTotals } from "../quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// QuoteEditorPage — Création / édition d'un devis
// ═══════════════════════════════════════════════════════════════════════════

export function QuoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";

  const { quotes, fetch, create, update, delete: deleteQuote, updateStatus } = useQuotesStore();
  const { fetch: fetchClients } = useClientsStore();
  const { chantiers, fetch: fetchChantiers, listByClient: listChantiersByClient } = useChantiersStore();
  const { company, fetch: fetchCompany } = useCompanyStore();
  const { incrementUsage } = useLibraryStore();

  const [formData, setFormData] = useState<Omit<Quote, "id" | "reference" | "createdAt" | "updatedAt">>({ ...EMPTY_QUOTE });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewPath, setPdfPreviewPath] = useState<string | null>(null);
  const [convertModalOpen, setConvertModalOpen] = useState(false);

  const existing = !isNew && id ? quotes.find((q) => q.id === id) : null;

  useEffect(() => {
    fetch();
    fetchClients();
    fetchChantiers();
    fetchCompany();
  }, []);

  // Hydrate form from existing quote
  useEffect(() => {
    if (existing) {
      const { id: _id, reference: _ref, createdAt: _c, updatedAt: _u, ...rest } = existing;
      setFormData({ ...EMPTY_QUOTE, ...rest });
      setDirty(false);
    } else if (isNew) {
      // Nouveau : initialise date d'émission à aujourd'hui + validité 30 jours
      const today = new Date();
      const validUntil = new Date(today);
      validUntil.setDate(validUntil.getDate() + 30);
      setFormData({
        ...EMPTY_QUOTE,
        issueDate: today.toISOString().slice(0, 10),
        validUntil: validUntil.toISOString().slice(0, 10),
      });
      setDirty(false);
    }
  }, [existing, isNew]);

  // ─── Champs ──────────────────────────────────────────────────────────
  const update_ = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const updateMulti = (patch: Partial<typeof formData>) => {
    setFormData((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  // ─── Calculs temps réel ─────────────────────────────────────────────
  const totals = useMemo(() => computeQuoteTotals(formData), [formData]);

  // ─── VAT enabled ? ───────────────────────────────────────────────────
  const vatEnabled = company?.tvaApplicable !== false;

  // ─── Chantiers du client sélectionné ─────────────────────────────────
  const availableChantiers = formData.clientId
    ? listChantiersByClient(formData.clientId)
    : [];

  // ─── Save ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData.clientId) {
      toast.error("Veuillez sélectionner un client");
      return;
    }
    if (formData.items.length === 0) {
      toast.error("Ajoutez au moins une ligne au devis");
      return;
    }
    setSaving(true);
    const payload = {
      ...formData,
      companySnapshot: company || {},
      totalHT: totals.totalHT,
      totalTTC: totals.totalTTC,
    };
    const result = existing
      ? await update(existing.id, payload)
      : await create(payload);
    setSaving(false);

    if (result.success) {
      toast.success(isNew ? "Devis créé" : "Devis enregistré");
      setDirty(false);
      if (isNew && "id" in result && result.id) {
        navigate(`/quotes/${result.id}`, { replace: true });
      }
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    await deleteQuote(existing.id);
    toast.success("Devis supprimé");
    navigate("/quotes");
  };

  const handleStatusChange = async (status: QuoteStatus) => {
    if (!existing) return;
    const r = await updateStatus(existing.id, status);
    if (r.success) toast.success(`Statut : ${QUOTE_STATUS_META[status].label}`);
  };

  const handleLibraryUse = (libraryId: string) => {
    incrementUsage(libraryId);
  };

  // ─── PDF ─────────────────────────────────────────────────────────────
  const handlePreviewPdf = async () => {
    if (!existing || !window.btpAPI?.quotesExportPdfPreview) return;
    // Sauvegarder d'abord si dirty
    if (dirty) {
      await handleSave();
    }
    setGeneratingPdf(true);
    const r = await window.btpAPI.quotesExportPdfPreview(existing.id);
    setGeneratingPdf(false);
    if (r.success && r.path) {
      // Ouvrir l'aperçu dans la modal interne (au lieu de l'app externe)
      setPdfPreviewPath(r.path);
      setPdfPreviewOpen(true);
      if (r.vault?.stored) {
        toast.success(r.vault.replaced ? "PDF mis à jour dans le coffre-fort" : "PDF rangé dans le coffre-fort", { duration: 3000 });
      } else if (r.vault && !r.vault.stored && !r.vault.error) {
        toast.info("PDF non rangé : aucun client/chantier lié", { duration: 4000 });
      }
    } else {
      toast.error(r.error || "Erreur lors de la génération");
    }
  };

  const handleDownloadPdf = async () => {
    if (!existing || !window.btpAPI?.quotesExportPdfSaveAs) return;
    if (dirty) await handleSave();
    setGeneratingPdf(true);
    const r = await window.btpAPI.quotesExportPdfSaveAs(existing.id);
    setGeneratingPdf(false);
    if (r.success && r.path) {
      toast.success("PDF enregistré");
      if (r.vault?.stored) {
        toast.success(r.vault.replaced ? "Aussi mis à jour dans le coffre-fort" : "Aussi rangé dans le coffre-fort", { duration: 3000 });
      }
    } else if (!r.cancelled) {
      toast.error(r.error || "Erreur");
    }
  };

  // ─── Email ───────────────────────────────────────────────────────────
  const handleOpenEmailModal = async () => {
    if (!existing) return;
    if (dirty) await handleSave();
    setEmailModalOpen(true);
  };

  const clientEmail = (() => {
    const c = useClientsStore.getState().clients.find((c) => c.id === formData.clientId);
    return c?.email || "";
  })();

  const defaultEmailSubject = existing
    ? `Devis ${existing.reference} — ${company?.companyName || "Votre entreprise"}`
    : "";

  const defaultEmailBody = (() => {
    const cname = (() => {
      const c = useClientsStore.getState().clients.find((c) => c.id === formData.clientId);
      if (!c) return "";
      return c.type === "pro" && c.companyName
        ? c.companyName
        : `${c.firstName} ${c.lastName}`.trim();
    })();
    const greeting = cname ? `Bonjour ${cname},` : "Bonjour,";
    return `${greeting}

Veuillez trouver ci-joint le devis ${existing?.reference || ""} pour ${formData.title || "votre projet"}.

Le devis est valable jusqu'au ${formData.validUntil ? new Date(formData.validUntil).toLocaleDateString("fr-FR") : "30 jours"}.

Restant à votre disposition pour toute question,

Cordialement,
${company?.companyName || ""}`;
  })();

  // ─── Rendu ──────────────────────────────────────────────────────────
  const meta = existing ? QUOTE_STATUS_META[existing.status] : QUOTE_STATUS_META.brouillon;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="p-4 md:p-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/quotes")} className="mb-3">
            <ArrowLeft className="w-4 h-4" />
            Tous les devis
          </Button>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="min-w-0 flex-1">
              {existing && (
                <p className="text-xs font-mono text-muted-foreground">{existing.reference}</p>
              )}
              <h1 className="text-xl md:text-2xl font-bold truncate">
                {isNew ? "Nouveau devis" : formData.title || "Devis sans titre"}
              </h1>
              {existing && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={cn(
                    "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium",
                    meta.color === "slate"   && "bg-slate-500/15 text-slate-500",
                    meta.color === "blue"    && "bg-blue-500/15 text-blue-500",
                    meta.color === "emerald" && "bg-emerald-500/15 text-emerald-500",
                    meta.color === "rose"    && "bg-rose-500/15 text-rose-500",
                  )}>
                    {meta.label}
                  </span>
                  {dirty && (
                    <span className="text-xs text-amber-500 font-medium">· Modifications non enregistrées</span>
                  )}
                </div>
              )}
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

                  {/* Session 10 — Convertir en facture */}
                  <Button variant="outline" size="sm" onClick={() => setConvertModalOpen(true)}>
                    <Receipt className="w-3.5 h-3.5" />
                    Convertir en facture
                  </Button>

                  {existing.status === "brouillon" && (
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange("envoye")}>
                      <Send className="w-3.5 h-3.5" />
                      Marquer envoyé
                    </Button>
                  )}
                  {existing.status === "envoye" && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleStatusChange("accepte")}>
                        <Check className="w-3.5 h-3.5" />
                        Accepté
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleStatusChange("refuse")}>
                        <XIcon className="w-3.5 h-3.5" />
                        Refusé
                      </Button>
                    </>
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
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Colonne gauche : formulaire */}
        <div className="space-y-4 min-w-0">
          {/* Infos générales */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              Informations générales
            </h3>
            <div>
              <Label>Titre du devis</Label>
              <Input
                value={formData.title}
                onChange={(e) => update_("title", e.target.value)}
                placeholder="Ex: Rénovation salle de bain Dupont"
              />
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
                <Label>Valable jusqu'au</Label>
                <Input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => update_("validUntil", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Client + Chantier */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Destinataire</h3>
            <div>
              <Label>Client *</Label>
              <ClientSelector
                value={formData.clientId}
                onChange={(clientId) => {
                  // Si on change de client, on vide le chantier
                  updateMulti({ clientId, chantierId: "" });
                }}
              />
            </div>
            {formData.clientId && availableChantiers.length > 0 && (
              <div>
                <Label>Chantier lié (optionnel)</Label>
                <NativeSelect
                  value={formData.chantierId}
                  onChange={(e) => update_("chantierId", e.target.value)}
                >
                  <option value="">— Aucun chantier lié —</option>
                  {availableChantiers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.reference} · {c.title || "Sans titre"}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Lier le devis à un chantier permet de le retrouver dans la fiche chantier.
                </p>
              </div>
            )}
          </div>

          {/* Intro */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            <Label>Introduction (optionnelle)</Label>
            <Textarea
              value={formData.introText}
              onChange={(e) => update_("introText", e.target.value)}
              rows={2}
              placeholder="Texte qui apparaîtra au-dessus des lignes du devis"
            />
          </div>

          {/* Toggle global Pose / Fourniture (Session 20) */}
          <div className="bg-card border border-border rounded-lg p-4">
            <Label className="text-xs">Type de prestation par défaut</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
              Sera appliqué automatiquement aux nouvelles lignes. Vous pouvez aussi définir un type différent par ligne.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {([
                { value: "", label: "Non spécifié", desc: "—" },
                { value: "P", label: "Pose", desc: "Main d'œuvre uniquement" },
                { value: "F", label: "Fourniture", desc: "Matériel uniquement" },
                { value: "PF", label: "Pose + Fourniture", desc: "Tout compris" },
              ] as Array<{ value: LineWorkType; label: string; desc: string }>).map((opt) => (
                <button
                  key={opt.value || "none"}
                  type="button"
                  onClick={() => update_("defaultLineType", opt.value)}
                  className={cn(
                    "p-2.5 rounded-md border text-left transition-all",
                    (formData.defaultLineType || "") === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-accent text-muted-foreground"
                  )}
                >
                  <p className="text-xs font-semibold">{opt.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-80">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Lignes */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <Receipt className="w-3 h-3" />
              Lignes du devis
            </h3>
            <QuoteItemsEditor
              items={formData.items}
              onChange={(items) => update_("items", items)}
              vatEnabled={vatEnabled}
              onLibraryUse={handleLibraryUse}
              defaultLineType={formData.defaultLineType || ""}
            />
          </div>

          {/* Conditions + Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <Label>Conditions de règlement</Label>
              <Textarea
                value={formData.conditionsText}
                onChange={(e) => update_("conditionsText", e.target.value)}
                rows={4}
                placeholder="Acompte à la commande, modalités de paiement..."
              />
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <Label>Notes internes (non imprimées)</Label>
              <Textarea
                value={formData.internalNotes}
                onChange={(e) => update_("internalNotes", e.target.value)}
                rows={4}
                placeholder="Remarques pour usage interne uniquement"
              />
            </div>
          </div>
        </div>

        {/* Colonne droite : totaux */}
        <div className="space-y-4">
          <div className="lg:sticky lg:top-[180px]">
            <QuoteTotalsPanel
              totals={totals}
              quote={formData}
              onDiscountChange={updateMulti}
              vatEnabled={vatEnabled}
            />

            {/* Bloc info entreprise */}
            <div className="mt-4 p-3 rounded-md bg-muted/40 text-xs space-y-0.5">
              <p className="flex items-center gap-1.5 font-medium">
                <Info className="w-3 h-3" />
                Entreprise émettrice
              </p>
              <p className="text-muted-foreground">
                {company?.companyName || "⚠ Non renseignée"}
              </p>
              {company?.siret && <p className="text-muted-foreground font-mono">SIRET {company.siret}</p>}
              {!vatEnabled && (
                <p className="text-amber-600 mt-1">TVA non applicable — art. 293 B du CGI</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Supprimer ce devis ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        destructive
      />

      {existing && (
        <SendQuoteByEmailModal
          open={emailModalOpen}
          quoteId={existing.id}
          quoteReference={existing.reference}
          defaultTo={clientEmail}
          defaultSubject={defaultEmailSubject}
          defaultBody={defaultEmailBody}
          onClose={() => setEmailModalOpen(false)}
          onSent={() => {
            fetch();
            // Session 12 : proposer un RDV signature 7 jours plus tard
            setTimeout(() => {
              toast("Programmer un RDV de signature ?", {
                description: "Pour ce devis, dans 7 jours par défaut",
                duration: 8000,
                action: {
                  label: "Créer le RDV",
                  onClick: async () => {
                    if (!existing || !window.btpAPI?.agendaEnsureSignatureEvent) return;
                    const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                    inSevenDays.setHours(14, 0, 0, 0);
                    const r = await window.btpAPI.agendaEnsureSignatureEvent({
                      quoteId: existing.id,
                      title: `Signature devis ${existing.reference}`,
                      dateStart: inSevenDays.toISOString(),
                      clientId: existing.clientId,
                      chantierId: existing.chantierId,
                      syncToOutlook: true,
                    });
                    if (r.success) {
                      if (r.alreadyExists) toast.info("Un RDV de signature existait déjà");
                      else toast.success("RDV de signature créé dans l'agenda");
                    } else {
                      toast.error(r.error || "Erreur");
                    }
                  },
                },
              });
            }, 800);
          }}
        />
      )}

      <ConvertToInvoiceModal
        open={convertModalOpen}
        quote={existing}
        onClose={() => setConvertModalOpen(false)}
        onSuccess={(invoiceId) => {
          navigate(`/invoices/${invoiceId}`);
        }}
      />

      <PdfPreviewModal
        open={pdfPreviewOpen}
        pdfPath={pdfPreviewPath}
        title={existing?.reference || "Devis"}
        subtitle={existing?.title || "Aperçu du devis"}
        onClose={() => setPdfPreviewOpen(false)}
        onDownload={handleDownloadPdf}
      />
    </div>
  );
}
