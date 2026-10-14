import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";

// Recuadro para firmar con el dedo, lápiz o ratón. ref.current.toDataURL() devuelve un PNG o "" si está vacío.
export const SignaturePad = forwardRef(({ height = 200 }, ref) => {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [empty, setEmpty] = useState(true);

  const setup = () => {
    const c = canvas.current;
    if (!c) return;
    const r = window.devicePixelRatio || 1;
    const w = c.parentElement.clientWidth;
    c.width = w * r; c.height = height * r;
    c.style.width = `${w}px`; c.style.height = `${height}px`;
    const ctx = c.getContext("2d");
    ctx.scale(r, r);
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0F172A";
    setEmpty(true);
  };
  useEffect(() => { setup(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = (e) => { const b = canvas.current.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  const down = (e) => { e.preventDefault(); canvas.current.setPointerCapture?.(e.pointerId); drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pos(e); const ctx = canvas.current.getContext("2d");
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p; if (empty) setEmpty(false);
  };
  const up = () => { drawing.current = false; };

  useImperativeHandle(ref, () => ({ toDataURL: () => (empty ? "" : canvas.current.toDataURL("image/png")), clear: setup, isEmpty: () => empty }));

  return (
    <div className="space-y-1.5">
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden" data-testid="signature-pad">
        <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
          className="block cursor-crosshair" style={{ touchAction: "none" }} data-testid="signature-canvas" />
        {empty && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-300 text-sm">Firma aquí con el dedo</div>}
        <div className="pointer-events-none absolute left-6 right-6 bottom-8 border-b border-slate-200" />
      </div>
      <button type="button" onClick={setup} className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1" data-testid="signature-clear"><Eraser className="w-3.5 h-3.5" /> Borrar y volver a firmar</button>
    </div>
  );
});
SignaturePad.displayName = "SignaturePad";
