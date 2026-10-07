import { useEffect, useState } from "react";
import api, { eur } from "@/lib/api";
import { CalendarRange } from "lucide-react";

const fmt = (d) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "long" });

export const QuarterCard = () => {
  const [q, setQ] = useState(null);
  useEffect(() => { api.get("/contabilidad/trimestre").then((r) => setQ(r.data)).catch(() => {}); }, []);
  if (!q) return null;
  return (
    <div className="bg-white border border-slate-200/60 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 mb-5 of-fade-up" data-testid="quarter-card">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5 justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center ring-1 ring-blue-100">
            <CalendarRange className="w-6 h-6 text-[#0052FF]" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Periodo en curso</div>
            <div className="font-display text-2xl font-bold text-slate-900" data-testid="quarter-label">{q.quarter}º trimestre {q.year}</div>
            <div className="text-sm text-slate-500">Del {fmt(q.start)} al {fmt(q.end)} · quedan {q.days_left_quarter} días · presentación hasta el {fmt(q.deadline)}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div><div className="text-slate-500 text-xs">Ingresos del trimestre</div><div className="font-semibold text-emerald-700 tabular" data-testid="quarter-income">{eur(q.ingresos)}</div></div>
          <div><div className="text-slate-500 text-xs">Gastos del trimestre</div><div className="font-semibold text-slate-800 tabular">{eur(q.gastos)}</div></div>
          <div><div className="text-slate-500 text-xs">IVA estimado</div><div className="font-semibold text-red-600 tabular">{eur(q.iva_estimado)}</div></div>
        </div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-[#0052FF] rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, q.progress)}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-slate-400 mt-1.5">
        {[1, 2, 3, 4].map((n) => <span key={n} className={n === q.quarter ? "text-[#0052FF] font-semibold" : ""}>{n}T</span>)}
      </div>
    </div>
  );
};
