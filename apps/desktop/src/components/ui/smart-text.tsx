import * as React from "react";
import { cn } from "@btp/ui";
import {
  loadSpellchecker,
  checkWord,
  suggestWord,
  addCustomWord,
} from "@/lib/spellcheck/spellchecker";
import {
  loadPredictionDictionary,
  predict,
  learnFromText,
} from "@/lib/spellcheck/prediction";

// ═══════════════════════════════════════════════════════════════════════════
// SmartTextarea / SmartInput — champs de saisie avec :
//   • correction orthographique FR (Hunspell) : fautes soulignées en rouge
//     ondulé, clic pour corriger / ignorer / ajouter au dictionnaire ;
//   • prédiction de mots (FR + BTP + apprentissage) : suggestions sous le
//     champ, Tab/Entrée pour compléter.
//
// Les moteurs sont chargés à la demande au premier focus (lazy, ~1.4 Mo).
// ═══════════════════════════════════════════════════════════════════════════

// Découpe un texte en tokens { text, start, end, isWord }
interface Token { text: string; start: number; end: number; isWord: boolean }
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /[A-Za-zÀ-ÿœæ]+(?:['-][A-Za-zÀ-ÿœæ]+)*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ text: text.slice(last, m.index), start: last, end: m.index, isWord: false });
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length, isWord: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), start: last, end: text.length, isWord: false });
  return tokens;
}

interface MisspelledRange { word: string; start: number; end: number }

function useEngines(enabled: boolean) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    Promise.all([loadSpellchecker(), loadPredictionDictionary()]).then(() => {
      if (alive) setReady(true);
    });
    return () => { alive = false; };
  }, [enabled]);
  return ready;
}

// ─── Popover de correction d'un mot ────────────────────────────────────────
interface CorrectionState {
  range: MisspelledRange;
  suggestions: string[];
  x: number;
  y: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// SmartTextarea
// ═══════════════════════════════════════════════════════════════════════════

export interface SmartTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onValueChange: (value: string) => void;
}

export const SmartTextarea = React.forwardRef<HTMLTextAreaElement, SmartTextareaProps>(
  ({ className, value, onValueChange, onBlur, onFocus, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null);
    const ref = (forwardedRef as React.RefObject<HTMLTextAreaElement>) || innerRef;
    const backdropRef = React.useRef<HTMLDivElement>(null);

    const [active, setActive] = React.useState(false);
    const ready = useEngines(active);

    const [misspelled, setMisspelled] = React.useState<MisspelledRange[]>([]);
    const [correction, setCorrection] = React.useState<CorrectionState | null>(null);
    const [predictions, setPredictions] = React.useState<string[]>([]);
    const [predIndex, setPredIndex] = React.useState(0);

    // Recalcule les fautes quand le texte change (et que le moteur est prêt)
    React.useEffect(() => {
      if (!ready) { setMisspelled([]); return; }
      const ranges: MisspelledRange[] = [];
      for (const t of tokenize(value)) {
        if (t.isWord && !checkWord(t.text)) {
          ranges.push({ word: t.text, start: t.start, end: t.end });
        }
      }
      setMisspelled(ranges);
    }, [value, ready]);

    // Prédiction : mot en cours avant le curseur
    const updatePredictions = React.useCallback((el: HTMLTextAreaElement) => {
      if (!ready) { setPredictions([]); return; }
      const pos = el.selectionStart ?? 0;
      if (pos !== (el.selectionEnd ?? 0)) { setPredictions([]); return; }
      const before = value.slice(0, pos);
      const m = before.match(/[A-Za-zÀ-ÿœæ]{2,}$/);
      // On ne prédit que si on est en fin de mot (pas suivi d'une lettre)
      const after = value.slice(pos, pos + 1);
      if (m && !/[A-Za-zÀ-ÿœæ]/.test(after)) {
        const sugg = predict(m[0], 5).filter((s) => s.toLowerCase() !== m[0].toLowerCase());
        setPredictions(sugg);
        setPredIndex(0);
      } else {
        setPredictions([]);
      }
    }, [value, ready]);

    const syncScroll = () => {
      if (backdropRef.current && ref.current) {
        backdropRef.current.scrollTop = ref.current.scrollTop;
        backdropRef.current.scrollLeft = ref.current.scrollLeft;
      }
    };

    const applyPrediction = (word: string) => {
      const el = ref.current;
      if (!el) return;
      const pos = el.selectionStart ?? value.length;
      const before = value.slice(0, pos);
      const m = before.match(/[A-Za-zÀ-ÿœæ]{2,}$/);
      if (!m) return;
      const wordStart = pos - m[0].length;
      const newValue = value.slice(0, wordStart) + word + value.slice(pos);
      onValueChange(newValue);
      setPredictions([]);
      requestAnimationFrame(() => {
        const np = wordStart + word.length;
        el.setSelectionRange(np, np);
        el.focus();
      });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (predictions.length > 0) {
        if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && predictions.length)) {
          // Tab complète toujours ; Enter complète seulement s'il y a une prédiction visible
          if (e.key === "Tab") {
            e.preventDefault();
            applyPrediction(predictions[predIndex]);
            return;
          }
        }
        if (e.key === "ArrowDown") { e.preventDefault(); setPredIndex((i) => (i + 1) % predictions.length); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); setPredIndex((i) => (i - 1 + predictions.length) % predictions.length); return; }
        if (e.key === "Escape") { setPredictions([]); return; }
      }
    };

    const openCorrection = (e: React.MouseEvent<HTMLTextAreaElement>) => {
      if (!ready || misspelled.length === 0) return;
      const el = ref.current;
      if (!el) return;
      // Position approximative du clic → on récupère le mot fautif le plus proche
      const pos = el.selectionStart ?? 0;
      const hit = misspelled.find((r) => pos >= r.start && pos <= r.end);
      if (hit) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        setCorrection({
          range: hit,
          suggestions: suggestWord(hit.word),
          x: Math.min(e.clientX - rect.left, rect.width - 220),
          y: e.clientY - rect.top + 18,
        });
      } else {
        setCorrection(null);
      }
    };

    const replaceRange = (range: MisspelledRange, replacement: string) => {
      const newValue = value.slice(0, range.start) + replacement + value.slice(range.end);
      onValueChange(newValue);
      setCorrection(null);
    };

    return (
      <div className="relative">
        {/* Backdrop de soulignement (sous le textarea) */}
        <div
          ref={backdropRef}
          aria-hidden
          className={cn(
            "absolute inset-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none",
            "rounded-md border border-transparent px-3 py-2 text-sm",
            className,
          )}
          style={{ color: "transparent" }}
        >
          {ready && misspelled.length > 0
            ? renderHighlighted(value, misspelled)
            : value}
        </div>

        <textarea
          ref={ref}
          value={value}
          onChange={(e) => { onValueChange(e.target.value); updatePredictions(e.target); }}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => updatePredictions(e.currentTarget)}
          onClick={openCorrection}
          onFocus={(e) => { setActive(true); onFocus?.(e); }}
          onBlur={(e) => {
            learnFromText(value);
            setTimeout(() => { setPredictions([]); setCorrection(null); }, 150);
            onBlur?.(e);
          }}
          spellCheck={false}
          className={cn(
            "relative flex min-h-[80px] w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm",
            "ring-offset-background placeholder:text-muted-foreground transition-colors resize-y",
            "hover:border-muted-foreground/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          style={{ background: "transparent", position: "relative" }}
          {...props}
        />

        {/* Dropdown de prédiction */}
        {predictions.length > 0 && (
          <div className="absolute left-3 z-30 mt-1 bg-card border border-border rounded-md shadow-soft-lg py-1 min-w-[160px]" style={{ top: "100%" }}>
            <div className="px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Suggestions · Tab pour compléter
            </div>
            {predictions.map((s, i) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyPrediction(s); }}
                className={cn(
                  "w-full text-left px-3 py-1 text-sm transition-colors",
                  i === predIndex ? "bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Popover de correction */}
        {correction && (
          <CorrectionPopover
            state={correction}
            onReplace={(rep) => replaceRange(correction.range, rep)}
            onIgnore={() => setCorrection(null)}
            onAdd={() => { addCustomWord(correction.range.word); setMisspelled((m) => m.filter((r) => r !== correction.range)); setCorrection(null); }}
          />
        )}
      </div>
    );
  },
);
SmartTextarea.displayName = "SmartTextarea";

// ═══════════════════════════════════════════════════════════════════════════
// SmartInput (une ligne)
// ═══════════════════════════════════════════════════════════════════════════

export interface SmartInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  value: string;
  onValueChange: (value: string) => void;
}

export const SmartInput = React.forwardRef<HTMLInputElement, SmartInputProps>(
  ({ className, value, onValueChange, onBlur, onFocus, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    const ref = (forwardedRef as React.RefObject<HTMLInputElement>) || innerRef;
    const [active, setActive] = React.useState(false);
    const ready = useEngines(active);
    const [predictions, setPredictions] = React.useState<string[]>([]);
    const [predIndex, setPredIndex] = React.useState(0);

    const updatePredictions = React.useCallback((el: HTMLInputElement) => {
      if (!ready) { setPredictions([]); return; }
      const pos = el.selectionStart ?? 0;
      const before = value.slice(0, pos);
      const m = before.match(/[A-Za-zÀ-ÿœæ]{2,}$/);
      const after = value.slice(pos, pos + 1);
      if (m && !/[A-Za-zÀ-ÿœæ]/.test(after)) {
        setPredictions(predict(m[0], 5).filter((s) => s.toLowerCase() !== m[0].toLowerCase()));
        setPredIndex(0);
      } else {
        setPredictions([]);
      }
    }, [value, ready]);

    const applyPrediction = (word: string) => {
      const el = ref.current;
      if (!el) return;
      const pos = el.selectionStart ?? value.length;
      const before = value.slice(0, pos);
      const m = before.match(/[A-Za-zÀ-ÿœæ]{2,}$/);
      if (!m) return;
      const wordStart = pos - m[0].length;
      const newValue = value.slice(0, wordStart) + word + value.slice(pos);
      onValueChange(newValue);
      setPredictions([]);
      requestAnimationFrame(() => {
        const np = wordStart + word.length;
        el.setSelectionRange(np, np);
        el.focus();
      });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (predictions.length === 0) return;
      if (e.key === "Tab") { e.preventDefault(); applyPrediction(predictions[predIndex]); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setPredIndex((i) => (i + 1) % predictions.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setPredIndex((i) => (i - 1 + predictions.length) % predictions.length); }
      else if (e.key === "Escape") { setPredictions([]); }
    };

    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => { onValueChange(e.target.value); updatePredictions(e.target); }}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => updatePredictions(e.currentTarget)}
          onFocus={(e) => { setActive(true); onFocus?.(e); }}
          onBlur={(e) => { learnFromText(value); setTimeout(() => setPredictions([]), 150); onBlur?.(e); }}
          spellCheck
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 py-1 text-sm shadow-soft-sm transition-colors",
            "placeholder:text-muted-foreground hover:border-muted-foreground/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        {predictions.length > 0 && (
          <div className="absolute left-0 z-30 mt-1 bg-card border border-border rounded-md shadow-soft-lg py-1 min-w-[160px]" style={{ top: "100%" }}>
            <div className="px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Suggestions · Tab
            </div>
            {predictions.map((s, i) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyPrediction(s); }}
                className={cn(
                  "w-full text-left px-3 py-1 text-sm transition-colors",
                  i === predIndex ? "bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);
SmartInput.displayName = "SmartInput";

// ─── Helpers de rendu ───────────────────────────────────────────────────────

function renderHighlighted(text: string, ranges: MisspelledRange[]): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) parts.push(text.slice(cursor, r.start));
    parts.push(
      <mark
        key={i}
        style={{
          background: "transparent",
          color: "transparent",
          textDecoration: "underline wavy #ef4444",
          textDecorationSkipInk: "none",
        }}
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function CorrectionPopover({
  state, onReplace, onIgnore, onAdd,
}: {
  state: CorrectionState;
  onReplace: (s: string) => void;
  onIgnore: () => void;
  onAdd: () => void;
}) {
  return (
    <div
      className="absolute z-40 bg-card border border-border rounded-md shadow-soft-lg py-1 min-w-[200px] max-w-[260px]"
      style={{ left: Math.max(0, state.x), top: state.y }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1 text-[11px] text-muted-foreground border-b border-border">
        « {state.range.word} »
      </div>
      {state.suggestions.length > 0 ? (
        state.suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onReplace(s)}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {s}
          </button>
        ))
      ) : (
        <div className="px-3 py-1.5 text-xs text-muted-foreground">Aucune suggestion</div>
      )}
      <div className="border-t border-border mt-1 pt-1">
        <button type="button" onClick={onAdd} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
          Ajouter au dictionnaire
        </button>
        <button type="button" onClick={onIgnore} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
          Ignorer
        </button>
      </div>
    </div>
  );
}
