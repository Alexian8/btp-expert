import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Save, Trash2, Calendar, Euro, FileText, Upload,
  Tag, Hammer, CheckCircle2, Wallet, User, RefreshCw, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPENSE_NOTE_CATEGORY_META, EXPENSE_NOTE_STATUS_META, EXPENSE_NOTE_PAYER_META,
  type ExpenseNote, type ExpenseNoteCategory, type ExpenseNoteStatus, type ExpenseNotePayer,
} from "@btp/types";
import { useExpenseNotesStore } from "@/stores/expenseNotesStore";
import { useChantiersStore } from "@/stores/chantiersStore";

// ═══════════════════════════════════════════════════════════════════════════
// ExpenseNoteEditorModal — Création / édition d'une note de frais
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  note: ExpenseNote | null;     // null = création
  onClose: () => void;
  onSaved: () => void;
}

const VAT_RATES = [20, 10, 5.5, 2.1, 0];

export function ExpenseNoteEditorModal({ open, note, onClose, onSaved }: Props) {
  const { create, update, remove, validate, markReimbursed } = useExpenseNotesStore();
  const { chantiers, fetch: fetchChantiers } = useChantiersStore();

  // Champs
  const [payerType, setPayerType] = useState<ExpenseNotePayer>("dirigeant");
  const [payerName, setPayerName] = useState("");
  const [chantierId, setChantierId] = useState("");
  const [category, setCategory] = useState<ExpenseNoteCategory>("carburant");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const [amountTtc, setAmountTtc] = useState("");
  const [vatRate, setVatRate] = useState(20);
  const ttcNum = parseFloat(amountTtc.replace(",", ".")) || 0;
  const amountHt = vatRate > 0 ? ttcNum / (1 + vatRate / 100) : ttcNum;
  const amountVat = ttcNum - amountHt;

  const [expenseDate, setExpenseDate] = useState("");
  const [refacturable, setRefacturable] = useState(false);
  const [refacturationMargePct, setRefacturationMargePct] = useState(0);
  const [status, setStatus] = useState<ExpenseNoteStatus>("brouillon");

  const [receiptVaultDocumentId, setReceiptVaultDocumentId] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEditing = !!note;

  // Quand on change de catégorie en CRÉATION, on adapte le taux TVA par défaut
  useEffect(() => {
    if (!isEditing) {
      const defaultVat = EXPENSE_NOTE_CATEGORY_META[category]?.defaultVatRate;
      if (defaultVat !== undefined) setVatRate(defaultVat);
    }
  }, [category, isEditing]);

  useEffect(() => {
    if (!open) return;
    fetchChantiers();

    if (note) {
      setPayerType(note.payerType);
      setPayerName(note.payerName);
      setChantierId(note.chantierId);
      setCategory(note.category);
      setDescription(note.description);
      setNotes(note.notes);
      setAmountTtc(String(note.amountTtc).replace(".", ","));
      setVatRate(note.vatRate);
      setExpenseDate(note.expenseDate);
      setRefacturable(note.refacturable);
      setRefacturationMargePct(note.refacturationMargePct);
      setStatus(note.status);
      setReceiptVaultDocumentId(note.receiptVaultDocumentId);
    } else {
      setPayerType("dirigeant");
      setPayerName("");
      setChantierId("");
      setCategory("carburant");
      setDescription("");
      setNotes("");
      setAmountTtc("");
      setVatRate(20);
      const today = new Date().toISOString().slice(0, 10);
      setExpenseDate(today);
      setRefacturable(false);
      setRefacturationMargePct(0);
      setStatus("brouillon");
      setReceiptVaultDocumentId("");
    }
    setConfirmDelete(false);
  }, [open, note?.id]);

  const handleSubmit = async () => {
    if (ttcNum <= 0) {
      toast.error("Le montant TTC doit être supérieur à 0");
      return;
    }
    if (!expenseDate) {
      toast.error("Date requise");
      return;
    }
    if (refacturable && !chantierId) {
      toast.error("Un chantier est requis pour refacturer la note de frais");
      return;
    }

    const payload: Partial<ExpenseNote> = {
      payerType,
      payerName: payerName.trim(),
      chantierId,
      category,
      description: description.trim(),
      notes: notes.trim(),
      amountTtc: parseFloat(ttcNum.toFixed(2)),
      amountHt: parseFloat(amountHt.toFixed(2)),
      amountVat: parseFloat(amountVat.toFixed(2)),
      vatRate,
      expenseDate,
      refacturable,
      refacturationMargePct: refacturable ? refacturationMargePct : 0,
      status,
      receiptVaultDocumentId,
    };

    setSaving(true);
    if (isEditing && note) {
      const r = await update(note.id, payload);
      setSaving(false);
      if (r.success) {
        toast.success("Note de frais mise à jour");
        onSaved();
        onClose();
      } else {
        toast.error(r.error || "Erreur");
      }
    } else {
      const r = await create(payload);
      setSaving(false);
      if (r.success) {
        toast.success(r.reference ? `Note créée (${r.reference})` : "Note créée");
        onSaved();
        onClose();
      } else {
        toast.error(r.error || "Erreur");
      }
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    setSaving(true);
    const r = await remove(note.id);
    setSaving(false);
    if (r.success) {
      toast.success("Note de frais supprimée");
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleValidate = async () => {
    if (!note) return;
    const r = await validate(note.id);
    if (r.success) {
      toast.success("Note validée");
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const handleReimburse = async () => {
    if (!note) return;
    const r = await markReimbursed(note.id);
    if (r.success) {
      toast.success("Marquée comme remboursée");
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

    let folderId = "root_company";
    try {
      const folders = await window.btpAPI.vaultListFolders!();
      const existing = folders.find((f: any) => f.name === "Notes de frais" && f.parentId === "root_company");
      if (existing) {
        folderId = existing.id;
      } else {
        const r = await window.btpAPI.vaultCreateFolder!({
          name: "Notes de frais",
          iconKey: "fileText",
          colorKey: "violet",
          parentId: "root_company",
        });
        if (r.success && r.id) folderId = r.id;
      }
    } catch {}

    const sourcePath = pickResult.paths[0];
    const fileName = sourcePath.split(/[/\\]/).pop() || "Justificatif";
    const uploadResult = await window.btpAPI.vaultUploadDocument!({
      folderId,
      sourcePath,
      fileName,
      description: `Justificatif note de frais${note ? ` ${note.reference}` : ""}`,
      tags: [{ name: "Note de frais" }],
    });

    setUploadingReceipt(false);
    if (uploadResult.success && uploadResult.id) {
      setReceiptVaultDocumentId(uploadResult.id);
      toast.success("Justificatif uploadé et chiffré");
    } else {
      toast.error(uploadResult.error || "Erreur upload");
    }
  };

  const refacturationHtAmount = refacturable
    ? amountHt * (1 + (refacturationMargePct || 0) / 100)
    : 0;

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
                <div className="w-10 h-10 rounded-lg bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    {isEditing
                      ? `Note de frais ${note?.reference || ""}`
                      : "Nouvelle note de frais"}
                  </h2>
                  {isEditing && (
                    <span className={cn(
                      "inline-block text-[11px] font-medium px-1.5 py-0.5 rounded mt-0.5",
                      EXPENSE_NOTE_STATUS_META[status].colorTw
                    )}>
                      {EXPENSE_NOTE_STATUS_META[status].label}
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
              {/* Payeur */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Qui a payé ?
                </Label>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {(Object.keys(EXPENSE_NOTE_PAYER_META) as ExpenseNotePayer[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPayerType(p)}
                      className={cn(
                        "py-2 px-2 rounded-md border text-xs font-medium transition-all",
                        payerType === p
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      )}
                    >
                      {EXPENSE_NOTE_PAYER_META[p].label}
                    </button>
                  ))}
                </div>
                {payerType === "employe" && (
                  <Input
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Nom de l'employé"
                    className="mt-2"
                  />
                )}
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="desc">Description *</Label>
                <Input
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Café avec client Dupont"
                  className="mt-1.5"
                  autoFocus={!isEditing}
                />
              </div>

              {/* Catégorie */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Catégorie
                </Label>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5 mt-1.5">
                  {Object.entries(EXPENSE_NOTE_CATEGORY_META).map(([key, meta]) => {
                    const selected = category === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCategory(key as ExpenseNoteCategory)}
                        className={cn(
                          "py-1.5 px-2 rounded-md border text-xs font-medium transition-all",
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

              {/* Date */}
              <div>
                <Label htmlFor="expenseDate" className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Date *
                </Label>
                <Input
                  id="expenseDate"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              {/* Chantier */}
              <div>
                <Label htmlFor="chantier" className="flex items-center gap-1.5">
                  <Hammer className="w-3.5 h-3.5" />
                  Chantier {refacturable && "*"}
                </Label>
                <select
                  id="chantier"
                  value={chantierId}
                  onChange={(e) => setChantierId(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 rounded-md border border-input bg-muted/50 text-sm"
                >
                  <option value="">{refacturable ? "Sélectionnez un chantier" : "Aucun chantier"}</option>
                  {chantiers.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.reference} · {ch.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Refacturable */}
              <div className="p-3 rounded-md bg-muted/30 border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-violet-500" />
                    <div>
                      <p className="text-sm font-medium">Refacturable au client</p>
                      <p className="text-[11px] text-muted-foreground">
                        Cette dépense sera intégrée à une facture future
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={refacturable}
                    onClick={() => setRefacturable(!refacturable)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                      refacturable ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-soft-sm transform transition",
                        refacturable ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {refacturable && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 space-y-2 overflow-hidden"
                  >
                    <div>
                      <Label className="text-xs">Marge appliquée (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={refacturationMargePct}
                        onChange={(e) => setRefacturationMargePct(parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-violet-500/10 border border-violet-500/20">
                      <span className="text-muted-foreground">Refacturation :</span>
                      <span className="tabular-nums">{amountHt.toFixed(2)} € HT</span>
                      <ArrowRight className="w-3 h-3 text-violet-500" />
                      <span className="font-semibold tabular-nums text-violet-500">
                        {refacturationHtAmount.toFixed(2)} € HT
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Statut */}
              <div>
                <Label>Statut</Label>
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {(["brouillon", "validee", "remboursee", "refacturee"] as ExpenseNoteStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        "py-2 px-2 rounded-md border text-xs font-medium transition-all",
                        status === s
                          ? EXPENSE_NOTE_STATUS_META[s].colorTw + " border-transparent"
                          : "border-border bg-card hover:bg-accent text-muted-foreground"
                      )}
                    >
                      {EXPENSE_NOTE_STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Justificatif */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Justificatif (photo / PDF)
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
                      Ajouter un justificatif (photo, PDF)
                    </Button>
                  )}
                </div>
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
                        <Button variant="destructive" size="sm" onClick={handleDelete} loading={saving}>Oui</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Non</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          Supprimer
                        </Button>
                        {note?.status === "brouillon" && (
                          <Button variant="outline" size="sm" onClick={handleValidate}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Valider
                          </Button>
                        )}
                        {note?.status === "validee" && note?.payerType !== "carte_pro" && (
                          <Button variant="outline" size="sm" onClick={handleReimburse}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Marquer remboursée
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
