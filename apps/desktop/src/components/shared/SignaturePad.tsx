import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { cn } from "@btp/ui";

// ═══════════════════════════════════════════════════════════════════════════
// SignaturePad — Canvas signature HTML5 (souris + tactile)
// Aucune dépendance externe. Export en data URL PNG.
// ═══════════════════════════════════════════════════════════════════════════

export interface SignaturePadRef {
  getDataUrl: () => string | null;  // null si le canvas est vide
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  className?: string;
  initialDataUrl?: string;
}

export const SignaturePad = forwardRef<SignaturePadRef, Props>(function SignaturePad(
  {
    width = 560,
    height = 200,
    strokeColor = "#111827",
    strokeWidth = 2.2,
    className,
    initialDataUrl,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  // ─── Init DPR scaling + clear ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      // Fond blanc pour export lisible
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }

    // Restaurer si fourni
    if (initialDataUrl && ctx) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        setHasInk(true);
      };
      img.src = initialDataUrl;
    }
  }, [width, height, strokeColor, strokeWidth, initialDataUrl]);

  // ─── Convertir coordonnées pointer/touch → canvas ────────────────────
  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // ─── Pointer events (unifie mouse + touch + stylus) ──────────────────
  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    e.preventDefault();
    setDrawing(false);
  };

  // ─── Clear ────────────────────────────────────────────────────────────
  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Refond blanc
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    // Re-set scaling + stroke
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    setHasInk(false);
  };

  // ─── Expose les méthodes au parent ────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getDataUrl: () => {
      if (!hasInk) return null;
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.toDataURL("image/png");
    },
    clear,
    isEmpty: () => !hasInk,
  }), [hasInk, strokeColor, strokeWidth]);

  return (
    <div className={cn("inline-block", className)}>
      <canvas
        ref={canvasRef}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onPointerLeave={handleUp}
        className="bg-white rounded-md border-2 border-dashed border-border hover:border-primary/40 transition-colors touch-none"
        style={{ touchAction: "none", cursor: "crosshair" }}
      />
    </div>
  );
});
