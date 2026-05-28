import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccountingStore } from "@/stores/accountingStore";
import type { Account, JournalLine, Journal } from "@btp/types";
import { fmtMoneyAlways } from "../lib/accountingFormatters";

// ═══════════════════════════════════════════════════════════════════════════
// ManualEntryModal — Saisie d'une écriture manuelle (OD)
// Multi-lignes débit/crédit, validation partie double
// ═══════════════════════════════════════════════════════════════════════════

interface Line {
  compteNum: string;
  compAuxNum: string;
  compAuxLib: string;
  libelle: string;
  debit: number;
  credit: number;
}

const emptyLine = (): Line => ({
  compteNum: "",
  compAuxNum: "",
  compAuxLib: "",
  libelle: "",
  debit: 0,
  credit: 0,
});

interface ManualEntryModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function ManualEntryModal({ open, onClose, onCreated }: ManualEntryModalProps) {
  const createManualEntry = useAccountingStore((s) => s.createManualEntry);
  const journals = useAccountingStore((s) => s.journals);
  const fetchJournals = useAccountingStore((s) => s.fetchJournals);
  const fetchAccounts = useAccountingStore((s) => s.fetchAccounts);
  const accounts = useAccountingStore((s) => s.accounts);

  const [journalCode, setJournalCode] = useState("OD");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [libelle, setLibelle] = useState("");
  const [pieceRef, setPieceRef] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (journals.length === 0) fetchJournals();
      if (accounts.length === 0) fetchAccounts();
    }
  }, [open, journals.length, accounts.length, fetchJournals, fetchAccounts]);

  useEffect(() => {
    if (!open) {
      setJournalCode("OD");
      setDate(new Date().toISOString().slice(0, 10));
      setLibelle("");
      setPieceRef("");
      setLines([emptyLine(), emptyLine()]);
    }
  }, [open]);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((p) => [...p, emptyLine()]);
  const removeLine = (idx: number) => setLines((p) => p.length > 2 ? p.filter((_, i) => i !== idx) : p);

  const handleSubmit = async () => {
    if (!journalCode) return toast.error("Journal requis");
    if (!libelle.trim()) return toast.error("Libellé requis");
    if (!balanced) return toast.error("L'écriture doit être équilibrée");
    if (lines.some((l) => !l.compteNum)) return toast.error("Chaque ligne doit avoir un compte");

    setSubmitting(true);
    const r = await createManualEntry({
      journalCode,
      date,
      libelle,
      pieceRef: pieceRef || undefined,
      pieceDate: date,
      lines: lines.map((l) => ({
        compteNum: l.compteNum,
        compAuxNum: l.compAuxNum || undefined,
        compAuxLib: l.compAuxLib || undefined,
        libelle: l.libelle || libelle,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      })) as Partial<JournalLine>[],
    });
    setSubmitting(false);
    if (r.success) {
      toast.success(`Écriture ${journalCode} n°${r.numero} créée`);
      onCreated?.();
    } else {
      toast.error(r.error || "Erreur");
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
            className="bg-card border border-border rounded-xl shadow-soft-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Nouvelle écriture comptable</h2>
                <p className="text-xs text-muted-foreground">Saisie manuelle (opération diverse)</p>
              </div>
              <button onClick={onClose} className="p-1 rounded hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              {/* En-tête de l'écriture */}
              <div className="grid sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Journal</label>
                  <select
                    value={journalCode}
                    onChange={(e) => setJournalCode(e.target.value)}
                    className="mt-1 w-full h-10 rounded-md border border-border bg-muted/50 px-3 text-sm"
                  >
                    {journals.map((j: Journal) => (
                      <option key={j.code} value={j.code}>{j.code} — {j.libelle}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Date</label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">N° de pièce</label>
                  <Input value={pieceRef} onChange={(e) => setPieceRef(e.target.value)} placeholder="Optionnel" className="mt-1" />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-xs text-muted-foreground">Libellé</label>
                  <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} className="mt-1" placeholder="Ex: Régularisation TVA" />
                </div>
              </div>

              {/* Lignes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Lignes</span>
                  <Button variant="ghost" size="sm" onClick={addLine}>
                    <Plus className="w-4 h-4 mr-1" /> Ajouter
                  </Button>
                </div>
                <div className="overflow-x-auto border border-border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left w-28">Compte</th>
                        <th className="px-2 py-2 text-left w-28">Auxiliaire</th>
                        <th className="px-2 py-2 text-left">Libellé</th>
                        <th className="px-2 py-2 text-right w-28">Débit</th>
                        <th className="px-2 py-2 text-right w-28">Crédit</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => (
                        <tr key={idx} className="border-t border-border">
                          <td className="px-1 py-1">
                            <AccountPicker
                              value={line.compteNum}
                              onChange={(numero) => updateLine(idx, { compteNum: numero })}
                              accounts={accounts}
                            />
                          </td>
                          <td className="px-1 py-1">
                            <Input
                              value={line.compAuxNum}
                              onChange={(e) => updateLine(idx, { compAuxNum: e.target.value })}
                              className="h-9 font-mono text-xs"
                              placeholder=""
                            />
                          </td>
                          <td className="px-1 py-1">
                            <Input
                              value={line.libelle}
                              onChange={(e) => updateLine(idx, { libelle: e.target.value })}
                              className="h-9"
                              placeholder={libelle || "Libellé ligne"}
                            />
                          </td>
                          <td className="px-1 py-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={line.debit || ""}
                              onChange={(e) => {
                                const v = Number(e.target.value) || 0;
                                updateLine(idx, { debit: v, credit: v > 0 ? 0 : line.credit });
                              }}
                              className="h-9 text-right tabular-nums"
                              placeholder="0,00"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={line.credit || ""}
                              onChange={(e) => {
                                const v = Number(e.target.value) || 0;
                                updateLine(idx, { credit: v, debit: v > 0 ? 0 : line.debit });
                              }}
                              className="h-9 text-right tabular-nums"
                              placeholder="0,00"
                            />
                          </td>
                          <td className="px-1 py-1">
                            {lines.length > 2 && (
                              <button
                                onClick={() => removeLine(idx)}
                                className="p-1 rounded hover:bg-destructive/15 hover:text-destructive"
                                title="Retirer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30 font-medium">
                        <td colSpan={3} className="px-2 py-2 text-right">Totaux</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmtMoneyAlways(totalDebit)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmtMoneyAlways(totalCredit)}</td>
                        <td></td>
                      </tr>
                      {!balanced && totalDebit + totalCredit > 0 && (
                        <tr className="bg-destructive/5">
                          <td colSpan={6} className="px-2 py-1.5 text-xs text-destructive text-center">
                            Écart : {fmtMoneyAlways(Math.abs(totalDebit - totalCredit))} € — l'écriture doit être équilibrée
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={!balanced || submitting} loading={submitting}>
                Enregistrer l'écriture
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Picker minimal de compte (autocomplete liste filtrée)
function AccountPicker({ value, onChange, accounts }: { value: string; onChange: (numero: string) => void; accounts: Account[] }) {
  const [query, setQuery] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => { setQuery(value); }, [value]);

  const matches = accounts
    .filter((a) =>
      !query ||
      a.numero.toLowerCase().startsWith(query.toLowerCase()) ||
      a.libelle.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 8);

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        className="h-9 font-mono text-xs"
        placeholder="411000"
      />
      {showSuggestions && matches.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-card border border-border rounded-md shadow-soft-md z-10">
          {matches.map((a) => (
            <button
              key={a.numero}
              type="button"
              onMouseDown={() => { onChange(a.numero); setQuery(a.numero); setShowSuggestions(false); }}
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted flex items-start gap-2"
            >
              <span className="font-mono font-semibold shrink-0">{a.numero}</span>
              <span className="text-muted-foreground truncate">{a.libelle}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
