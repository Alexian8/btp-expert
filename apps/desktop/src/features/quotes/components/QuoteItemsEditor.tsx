import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, GripVertical, BookOpen, ChevronDown, ChevronUp,
  Percent, Euro, FolderOpen, Info,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { LibraryPicker } from "./LibraryPicker";
import { DesignationInput } from "./DesignationInput";
import { CategorySelect } from "@/features/chantiers/components/CategorySelect";
import type { QuoteItem, VatRate, LibraryItem, LineWorkType } from "@btp/types";
import {
  EMPTY_QUOTE_LINE, EMPTY_QUOTE_SECTION, VAT_RATES, QUOTE_UNITS,
} from "@btp/types";
import { calculateLineHT, calculateLineTTC, formatEuros } from "../quoteEngine";

// ═══════════════════════════════════════════════════════════════════════════
// QuoteItemsEditor — Éditeur des lignes du devis (lignes + sections)
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  items: QuoteItem[];
  onChange: (items: QuoteItem[]) => void;
  vatEnabled: boolean;
  onLibraryUse?: (libraryId: string) => void;
  defaultLineType?: LineWorkType;
}

function newId() {
  return `itm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function QuoteItemsEditor({ items, onChange, vatEnabled, onLibraryUse, defaultLineType = "" }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ─── Actions sur la liste ──────────────────────────────────────────────
  const addLine = () => {
    onChange([...items, { ...EMPTY_QUOTE_LINE, id: newId(), lineType: defaultLineType } as QuoteItem]);
  };

  const addSection = () => {
    onChange([...items, { ...EMPTY_QUOTE_SECTION, id: newId() } as QuoteItem]);
  };

  const addFromLibrary = (lib: LibraryItem) => {
    const line: QuoteItem = {
      id: newId(),
      kind: "line",
      title: lib.title,
      description: lib.description,
      quantity: 1,
      unit: lib.unit,
      unitPriceHT: lib.unitPriceHT,
      vatRate: lib.vatRate,
      lineType: defaultLineType,
      discountPercent: 0,
      discountAmount: 0,
      discountMode: "none",
    };
    onChange([...items, line]);
    onLibraryUse?.(lib.id);
  };

  const updateItem = (idx: number, patch: Partial<QuoteItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, delta: number) => {
    const target = idx + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  // ─── Drag & drop natif ────────────────────────────────────────────────
  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(draggedIdx, 1);
    next.splice(idx, 0, moved);
    onChange(next);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="space-y-3">
      {/* Barre d'actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={addLine}>
          <Plus className="w-3.5 h-3.5" />
          Ajouter une ligne
        </Button>
        <Button variant="outline" size="sm" onClick={addSection}>
          <FolderOpen className="w-3.5 h-3.5" />
          Ajouter un chapitre
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <BookOpen className="w-3.5 h-3.5" />
          Depuis la bibliothèque
        </Button>
      </div>

      {/* Liste des items */}
      {items.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-lg">
          <Plus className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Aucune ligne dans ce devis</p>
          <Button onClick={addLine} size="sm">
            <Plus className="w-3.5 h-3.5" />
            Commencer par une ligne
          </Button>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <div
                  draggable
                  onDragStart={handleDragStart(idx)}
                  onDragOver={handleDragOver(idx)}
                  onDrop={handleDrop(idx)}
                  onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                  className={cn(
                    "transition-all",
                    draggedIdx === idx && "opacity-30",
                    dragOverIdx === idx && draggedIdx !== idx && "ring-2 ring-primary/40 rounded-lg",
                  )}
                >
                  {item.kind === "section" ? (
                    <SectionRow
                      item={item}
                      onUpdate={(patch) => updateItem(idx, patch)}
                      onRemove={() => removeItem(idx)}
                      onMoveUp={() => moveItem(idx, -1)}
                      onMoveDown={() => moveItem(idx, 1)}
                      isFirst={idx === 0}
                      isLast={idx === items.length - 1}
                    />
                  ) : (
                    <LineRow
                      item={item}
                      vatEnabled={vatEnabled}
                      onUpdate={(patch) => updateItem(idx, patch)}
                      onRemove={() => removeItem(idx)}
                      onMoveUp={() => moveItem(idx, -1)}
                      onMoveDown={() => moveItem(idx, 1)}
                      isFirst={idx === 0}
                      isLast={idx === items.length - 1}
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      <LibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addFromLibrary}
      />
    </div>
  );
}

// ─── Section / Chapitre ──────────────────────────────────────────────────
function SectionRow({
  item, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  item: QuoteItem;
  onUpdate: (patch: Partial<QuoteItem>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="bg-primary/5 border-2 border-primary/30 rounded-lg p-3 flex items-center gap-2">
      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
      <FolderOpen className="w-4 h-4 text-primary shrink-0" />
      <Input
        value={item.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        placeholder="Nom du chapitre (ex: Plomberie)"
        className="flex-1 font-semibold !text-sm border-0 bg-transparent focus-visible:ring-1"
      />
      <div className="flex gap-0.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}>
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}>
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// ─── Ligne devis ─────────────────────────────────────────────────────────
function LineRow({
  item, vatEnabled, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  item: QuoteItem;
  vatEnabled: boolean;
  onUpdate: (patch: Partial<QuoteItem>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [discountOpen, setDiscountOpen] = useState(item.discountMode !== "none");
  const lineHT = calculateLineHT(item);
  const lineTTC = calculateLineTTC(item);

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      {/* Ligne 1 : grab + titre + total */}
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0 mt-2.5" />
        <div className="flex-1 min-w-0 grid grid-cols-12 gap-2">
          {/* Description large */}
          <div className="col-span-12">
            <DesignationInput
              value={item.title}
              onChange={(v) => onUpdate({ title: v })}
              onApply={(s) => {
                onUpdate({
                  title: s.title,
                  description: s.description,
                  unit: s.unit,
                  unitPriceHT: s.unitPriceHT,
                  vatRate: s.vatRate as any,
                });
              }}
              placeholder="Désignation (ex: Pose de carrelage 30×30)"
            />
          </div>
          <div className="col-span-12">
            <Textarea
              value={item.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Détail optionnel (matériaux, spécificités...)"
              rows={1}
              className="text-xs resize-none min-h-[32px]"
            />
          </div>

          {/* Catégorie / poste (Session 22) */}
          <div className="col-span-12 flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground font-medium shrink-0">Poste :</label>
            <CategorySelect
              value={item.categoryId}
              onChange={(id) => onUpdate({ categoryId: id })}
              placeholder="Aucun poste"
              size="sm"
              className="max-w-[220px]"
            />
          </div>

          {/* Type Pose/Fourniture + Quantité + unité + PU + TVA */}
          <div className="col-span-2">
            <label className="text-[10px] text-muted-foreground font-medium" title="Pose / Fourniture / Pose+Fourniture">Type</label>
            <NativeSelect
              value={item.lineType || ""}
              onChange={(e) => onUpdate({ lineType: e.target.value as LineWorkType })}
              className="h-8"
            >
              <option value="">—</option>
              <option value="P">P (Pose)</option>
              <option value="F">F (Fourniture)</option>
              <option value="PF">PF (Pose+Fourn.)</option>
            </NativeSelect>
          </div>
          <div className="col-span-1">
            <label className="text-[10px] text-muted-foreground font-medium">Qté</label>
            <Input
              type="number"
              step="0.01"
              value={item.quantity || ""}
              onChange={(e) => onUpdate({ quantity: Number(e.target.value) || 0 })}
              className="h-8 tabular-nums"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-muted-foreground font-medium">Unité</label>
            <NativeSelect
              value={item.unit}
              onChange={(e) => onUpdate({ unit: e.target.value })}
              className="h-8"
            >
              {QUOTE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </NativeSelect>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-muted-foreground font-medium">PU HT</label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={item.unitPriceHT || ""}
                onChange={(e) => onUpdate({ unitPriceHT: Number(e.target.value) || 0 })}
                className="h-8 pr-6 tabular-nums"
              />
              <Euro className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            </div>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
              TVA
              <span
                className="cursor-help text-muted-foreground/70 hover:text-foreground"
                title={"Aide à choisir le bon taux :\n\n• 20% — Taux normal (construction neuve, vente)\n• 10% — Travaux d'amélioration / transformation / aménagement / entretien (logement +2 ans)\n• 5,5% — Travaux d'amélioration de la qualité énergétique (isolation, équipements éco)\n• 0% — Exonération (autoliquidation BTP, exports...)\n\nCondition pour 5,5% et 10% :\nLogement à usage d'habitation achevé depuis +2 ans + attestation TVA signée par le client."}
              >
                <Info className="w-2.5 h-2.5" />
              </span>
            </label>
            {vatEnabled ? (
              <NativeSelect
                value={String(item.vatRate)}
                onChange={(e) => onUpdate({ vatRate: Number(e.target.value) as VatRate })}
                className="h-8"
              >
                {VAT_RATES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </NativeSelect>
            ) : (
              <div className="h-8 flex items-center text-xs text-muted-foreground italic">Exonérée</div>
            )}
          </div>

          {/* Total ligne */}
          <div className="col-span-3 text-right">
            <label className="text-[10px] text-muted-foreground font-medium">Total HT</label>
            <div className="h-8 flex items-center justify-end font-semibold tabular-nums">
              {formatEuros(lineHT.netHT)}
            </div>
            {vatEnabled && lineHT.netHT !== lineTTC.ttc && (
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {formatEuros(lineTTC.ttc)} TTC
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}>
            <ChevronUp className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}>
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Remise ligne (repliable) */}
      <div className="pl-6">
        {!discountOpen ? (
          <button
            type="button"
            onClick={() => setDiscountOpen(true)}
            className="text-xs font-medium text-primary hover:text-primary/80 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-primary/40 hover:border-primary/60 hover:bg-primary/5 transition-colors"
          >
            <Percent className="w-3.5 h-3.5" />
            Ajouter une remise sur cette ligne
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Remise :</span>
            <NativeSelect
              value={item.discountMode}
              onChange={(e) => onUpdate({ discountMode: e.target.value as any })}
              className="h-7 w-auto min-w-[80px]"
            >
              <option value="none">Aucune</option>
              <option value="percent">En %</option>
              <option value="amount">En €</option>
            </NativeSelect>
            {item.discountMode === "percent" && (
              <div className="relative w-24">
                <Input
                  type="number"
                  step="0.1"
                  value={item.discountPercent || ""}
                  onChange={(e) => onUpdate({ discountPercent: Number(e.target.value) || 0 })}
                  className="h-7 pr-5 tabular-nums"
                />
                <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              </div>
            )}
            {item.discountMode === "amount" && (
              <div className="relative w-28">
                <Input
                  type="number"
                  step="0.01"
                  value={item.discountAmount || ""}
                  onChange={(e) => onUpdate({ discountAmount: Number(e.target.value) || 0 })}
                  className="h-7 pr-5 tabular-nums"
                />
                <Euro className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              </div>
            )}
            {lineHT.discount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                (− {formatEuros(lineHT.discount)})
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                onUpdate({ discountMode: "none", discountPercent: 0, discountAmount: 0 });
                setDiscountOpen(false);
              }}
              className="ml-auto text-[11px] text-muted-foreground hover:text-destructive"
            >
              Retirer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
