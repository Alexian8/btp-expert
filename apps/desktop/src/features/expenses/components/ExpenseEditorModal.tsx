import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Save, Trash2, Calendar, Euro, FileText, Upload,
  CreditCard, Tag, Hammer, CheckCircle2, Receipt,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPENSE_CATEGORY_META, EXPENSE_STATUS_META, PAYMENT_METHOD_LABEL,
  type Expense, type ExpenseCategory, type ExpenseStatus, type PaymentMethod,
} from "@btp/types";
import { useExpensesStore } from "@/stores/expensesStore";
import { useChantiersStore } from "@/stores/chantiersStore";
import { SupplierSelector } from "./SupplierSelector";

// ═══════════════════════════════════════════════════════════════════════════
// ExpenseEditorModal — Création / édition d'une dépense
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  expense: Expense | null;     // null = création
  onClose: () => void;
  onSaved: () => void;
}

const VAT_RATES = [20, 10, 5.5, 2.1, 0];

export function ExpenseEditorModal({ open, expense, onClose, onSaved }: Props) {
  const { create, update, remove, markPaid } = useExpensesStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();

  // Champs
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [chantierId, setChantierId] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("materiaux");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const [amountTtc, setAmountTtc] = useState("");
  const [vatRate, setVatRate] = useState(20);
  // Calcul auto HT à partir TTC + taux
  const ttcNum = parseFloat(amountTtc.replace(",", ".")) || 0;
  const amountHt = vatRate > 0 ? ttcNum / (1 + vatRate / 100) : ttcNum;
  const amountVat = ttcNum - amountHt;

  const [expenseDate, setExpenseDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [status, setStatus] = useState<ExpenseStatus>("a_payer");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cb");

  const [receiptVaultDocumentId, setReceiptVaultDocumentId] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [bankTransactionId, setBankTransactionId] = useState("");

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEditing = !!expense;

  useEffect(() => {
    if (!open) return;
    fetchChantiers();

    if (expense) {
      setSupplierId(expense.supplierId);
      setSupplierName(expense.supplierName);
      setChantierId(expense.chantierId);
      setCategory(expense.category);
      setDescription(expense.description);
      setNotes(expense.notes);
      setAmountTtc(String(expense.amountTtc).replace(".", ","));
      setVatRate(expense.vatRate);
      setExpenseDate(expense.expenseDate);
      setDueDate(expense.dueDate);
      setPaidDate(expense.paidDate);
      setStatus(expense.status);
      setPaymentMethod(expense.paymentMethod);
      setReceiptVaultDocumentId(expense.receiptVaultDocumentId);
      setSupplierInvoiceNumber(expense.supplierInvoiceNumber || "");
      setBankTransactionId(expense.bankTransactionId || "");
    } else {
      // Reset pour création
      setSupplierId("");
      setSupplierName("");
      setChantierId("");
      setCategory("materiaux");
      setDescription("");
      setNotes("");
      setAmountTtc("");
      setVatRate(20);
      const today = new Date().toISOString().slice(0, 10);
      setExpenseDate(today);
      setDueDate("");
      setPaidDate("");
      setStatus("a_payer");
      setPaymentMethod("cb");
      setReceiptVaultDocumentId("");
      setSupplierInvoiceNumber("");
      setBankTransactionId("");
    }
    setConfirmDelete(false);
  }, [open, expense?.id]);

  const filteredChantiers = chantiers; // pas de filtre client ici

  const handleSubmit = async () => {
    if (!supplierName.trim() && !supplierId) {
      toast.error("Renseignez un fournisseur (ou un nom libre)");
      return;
    }
    if (ttcNum <= 0) {
      toast.error("Le montant TTC doit être supérieur à 0");
      return;
    }
    if (!expenseDate) {
      toast.error("Date de la facture requise");
      return;
    }

    const payload: Partial<Expense> = {
      supplierId,
      supplierName: supplierName.trim() || (supplierId ? supplierName : ""),
      chantierId,
      category,
      description: description.trim(),
      notes: notes.trim(),
      amountHt: parseFloat(amountHt.toFixed(2)),
      amountVat: parseFloat(amountVat.toFixed(2)),
      amountTtc: parseFloat(ttcNum.toFixed(2)),
      vatRate,
      expenseDate,
      dueDate,
      paidDate: status === "payee" ? (paidDate || expenseDate) : "",
      status,
      paymentMethod,
      receiptVaultDocumentId,
      supplierInvoiceNumber: supplierInvoiceNumber.trim(),
      bankTransactionId: bankTransactionId.trim(),
    };

    setSaving(true);
    if (isEditing && expense) {
      const r = await update(expense.id, payload);
      setSaving(false);
      if (r.success) {
        toast.success("Dépense mise à jour");
        onSaved();
        onClose();
      } else {
        toast.error(r.error || "Erreur");
      }
    } else {
      const r = await create(payload);
      setSaving(false);
      if (r.success) {
        toast.success(r.reference ? `Dépense créée (${r.reference})` : "Dépense créée");
        onSaved();
        onClose();
      } else {
        toast.error(r.error || "Erreur");
      }
    }
  };

  const handleDelete = async () => {
    if (!expense) return;
    setSaving(true);
    const r = await remove(expense.id);
    setSaving(false);
    if (r.success) {
      toast.success("Dépense supprimée");
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleMarkPaid = async () => {
    if (!expense) return;
    const today = new Date().toISOString().slice(0, 10);
    const r = await markPaid(expense.id, today, paymentMethod);
    if (r.success) {
      toast.success("Marqué comme payé");
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleUploadReceipt = async () => {
    if (!window.btpAPI?.vaultPickFiles) {
      toast.error("Coffre-fort non disponible");
      return;
    }
    setUploadingReceipt(true);
    const pickResult = await window.btpAPI.vaultPickFiles();
    if (!pickResult.success || pickResult.paths.length === 0) {
      setUploadingReceipt(false);
      return;
    }

    // Trouver/créer dossier "Justificatifs" sous Entreprise
    let folderId = "root_company";
    try {
      const folders = await window.btpAPI.vaultListFolders!();
      const existing = folders.find((f: any) => f.name === "Justificatifs dépenses" && f.parentId === "root_company");
      if (existing) {
        folderId = existing.id;
      } else {
        const r = await window.btpAPI.vaultCreateFolder!({
          name: "Justificatifs dépenses",
          iconKey: "fileText",
          colorKey: "amber",
          parentId: "root_company",
        });
        if (r.success && r.id) folderId = r.id;
      }
    } catch {}

    // Upload du fichier
    const sourcePath = pickResult.paths[0];
    const fileName = sourcePath.split(/[/\\]/).pop() || "Justificatif";
    const uploadResult = await window.btpAPI.vaultUploadDocument!({
      folderId,
      sourcePath,
      fileName,
      description: `Justificatif dépense${expense ? ` ${expense.reference}` : ""}`,
      tags: [{ name: "Justificatif" }],
    });

    setUploadingReceipt(false);
    if (uploadResult.success && uploadResult.id) {
      setReceiptVaultDocumentId(uploadResult.id);
      toast.success("Justificatif uploadé et chiffré");
    } else {
      toast.error(uploadResult.error || "Erreur upload");
    }
  };

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
            className="bg-card border border-border rounded-lg shadow-soft-xl max-w-2xl w-full max-h-[92vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    {isEditing
                      ? `Dépense ${expense?.reference || ""}`
                      : "Nouvelle dépense"}
                  </h2>
                  {isEditing && (
                    <span className={cn(
                      "inline-block text-[11px] font-medium px-1.5 py-0.5 rounded mt-0.5",
                      EXPENSE_STATUS_META[status].colorTw
                    )}>
                      {EXPENSE_STATUS_META[status].label}
                    </span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Fournisseur */}
              <div>
                <Label>Fournisseur *</Label>
                <div className="mt-1.5">
                  <SupplierSelector
                    value={supplierId}
                    freeText={supplierName}
                    onChange={(id, name) => {
                      setSupplierId(id);
                      setSupplierName(name);
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="desc">Description</Label>
                <Input
                  id="desc"
                  smart
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Carrelage chantier Dupont"
                  className="mt-1.5"
                />
              </div>

              {/* N° facture fournisseur + n° transaction bancaire */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="supInv">N° facture fournisseur</Label>
                  <Input
                    id="supInv"
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                    placeholder="Ex: FA-2024-0512"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="bankTx" className="flex items-center gap-1.5">
                    N° transaction
                    <span className="text-[10px] text-muted-foreground">(banque/Qonto)</span>
                  </Label>
                  <Input
                    id="bankTx"
                    value={bankTransactionId}
                    onChange={(e) => setBankTransactionId(e.target.value)}
                    placeholder="Réf. du paiement bancaire"
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Catégorie */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Catégorie
                </Label>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5 mt-1.5">
                  {Object.entries(EXPENSE_CATEGORY_META).map(([key, meta]) => {
                    const selected = category === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCategory(key as ExpenseCategory)}
                        className={cn(
                          // min-h-11 garantit une hauteur uniforme même quand
                          // le label wrappe sur 2 lignes (Téléphone/Internet,
                          // Frais bancaires) — toutes les pastilles s'alignent.
                          "flex items-center justify-center text-center min-h-11 py-1.5 px-2 rounded-md border text-xs font-medium transition-all leading-tight",
                          selected
                            ? meta.colorTw + " border-transparent"
                            : "border-border bg-card hover:bg-accent text-muted-foreground"
                        )}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Montants */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-muted/30 border border-border">
                <div className="col-span-2">
                  <Label htmlFor="ttc" className="flex items-center gap-1.5">
                    <Euro className="w-3.5 h-3.5" />
                    Montant TTC *
                  </Label>
                  <Input
                    id="ttc"
                    type="text"
                    inputMode="decimal"
                    value={amountTtc}
                    onChange={(e) => setAmountTtc(e.target.value)}
                    placeholder="0,00"
                    className="mt-1.5 text-base font-semibold tabular-nums"
                  />
                </div>

                <div>
                  <Label>Taux TVA</Label>
                  <select
                    value={String(vatRate)}
                    onChange={(e) => setVatRate(parseFloat(e.target.value))}
                    className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-muted/50 text-sm"
                  >
                    {VAT_RATES.map((rate) => (
                      <option key={rate} value={rate}>{rate}%</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 text-right">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Montant HT :</span>
                    <span className="tabular-nums">{amountHt.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>TVA ({vatRate}%) :</span>
                    <span className="tabular-nums">{amountVat.toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="expenseDate" className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Date de la facture *
                  </Label>
                  <Input
                    id="expenseDate"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="dueDate">Échéance (optionnel)</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Statut */}
              <div>
                <Label>Statut</Label>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {(["a_payer", "payee", "annulee"] as ExpenseStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        "py-2 px-2 rounded-md border text-xs font-medium transition-all",
                        status === s
                          ? EXPENSE_STATUS_META[s].colorTw + " border-transparent"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      )}
                    >
                      {EXPENSE_STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Si payée : date paiement + mode */}
              {status === "payee" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="grid grid-cols-2 gap-3 overflow-hidden"
                >
                  <div>
                    <Label htmlFor="paidDate">Date de paiement</Label>
                    <Input
                      id="paidDate"
                      type="date"
                      value={paidDate}
                      onChange={(e) => setPaidDate(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      Mode de paiement
                    </Label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-muted/50 text-sm"
                    >
                      {Object.entries(PAYMENT_METHOD_LABEL).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              )}

              {/* Chantier */}
              <div>
                <Label htmlFor="chantier" className="flex items-center gap-1.5">
                  <Hammer className="w-3.5 h-3.5" />
                  Chantier (optionnel)
                </Label>
                <select
                  id="chantier"
                  value={chantierId}
                  onChange={(e) => setChantierId(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-muted/50 text-sm"
                >
                  <option value="">Aucun chantier</option>
                  {filteredChantiers.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.reference} · {ch.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Justificatif */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Justificatif
                </Label>
                <div className="mt-1.5">
                  {receiptVaultDocumentId ? (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="text-xs flex-1">Justificatif chiffré dans le coffre-fort</span>
                      <Button variant="ghost" size="sm" onClick={() => setReceiptVaultDocumentId("")}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleUploadReceipt} loading={uploadingReceipt} className="w-full">
                      <Upload className="w-3.5 h-3.5" />
                      Ajouter un justificatif (PDF, image)
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Le justificatif sera automatiquement chiffré et rangé dans le coffre-fort.
                </p>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Détails additionnels..."
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/20">
              <div className="flex items-center gap-2">
                {isEditing && (
                  <>
                    {confirmDelete ? (
                      <>
                        <span className="text-xs text-destructive">Confirmer ?</span>
                        <Button variant="destructive" size="sm" onClick={handleDelete} loading={saving}>
                          Oui
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                          Non
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          Supprimer
                        </Button>
                        {expense?.status === "a_payer" && (
                          <Button variant="outline" size="sm" onClick={handleMarkPaid}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Marquer payée
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button onClick={handleSubmit} loading={saving}>
                  <Save className="w-4 h-4" />
                  {isEditing ? "Enregistrer" : "Créer"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
