import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { eur } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Landmark, Wallet, CalendarClock, ArrowRight,
} from "lucide-react";

const CARD = "bg-white border border-slate-200/60 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)]";

function Metric({ label, value, icon: Icon, tone, chip, sub, testid, delay }) {
  const tones = {
    danger: "text-red-600", success: "text-emerald-600", default: "text-slate-900",
  };
  return (
    <div
      data-testid={testid}
      className={`${CARD} p-6 of-fade-up transition-all duration-200 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-0.5`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`w-10 h-10 rounded-full flex items-center justify-center ${chip}`}>
          <Icon className="w-5 h-5" strokeWidth={1.75} />
        </span>
      </div>
      <div className={`font-display text-3xl font-bold tracking-tight mt-3 tabular ${tones[tone] || tones.default}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [years, setYears] = useState([new Date().getFullYear()]);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => { api.get("/available-years").then((r) => setYears(r.data)); }, []);
  useEffect(() => { setData(null); api.get(`/dashboard?year=${year}`).then((r) => setData(r.data)); }, [year]);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-7 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Panel</h1>
          <p className="text-sm text-slate-500 mt-0.5">Resumen fiscal del ejercicio</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[140px] h-11 rounded-xl bg-white border-slate-200" data-testid="year-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>Ejercicio {y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Link to="/facturas">
            <Button className="h-11 bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl shadow-[0_4px_14px_0_rgba(0,82,255,0.39)] transition-all hover:-translate-y-0.5 active:scale-95 group" data-testid="dashboard-new-invoice">
              Nueva factura <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
            </Button>
          </Link>
        </div>
      </div>

      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-[20px]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-[20px]" />)}
          </div>
          <Skeleton className="h-80 w-full rounded-[20px]" />
        </div>
      ) : (
        <>
          {data.next_deadline && (
            <div className={`${CARD} relative overflow-hidden p-6 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 of-fade-up`} data-testid="next-deadline-card">
              <div className="absolute -left-8 -top-8 w-40 h-40 rounded-full bg-amber-100/40 blur-2xl pointer-events-none" />
              <div className="flex items-center gap-4 relative">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center ring-1 ring-amber-100">
                  <CalendarClock className="w-6 h-6 text-amber-500" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Próximo pago · Modelo 303 · {data.next_deadline.label}
                  </div>
                  <div className="font-display text-lg font-semibold text-slate-900 mt-0.5">
                    Vence el {new Date(data.next_deadline.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                    <span className="text-slate-400 font-normal text-sm ml-2">· faltan {data.next_deadline.days_left} días</span>
                  </div>
                </div>
              </div>
              <div className="sm:text-right relative">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">IVA a pagar (est.)</div>
                <div className="font-display text-3xl font-bold tracking-tight text-slate-900 tabular mt-0.5">
                  {eur(Math.max(0, data.next_deadline.amount))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
            <Metric label="IVA a pagar" value={eur(data.iva_a_pagar)} icon={Landmark} tone="danger" chip="bg-red-50 text-red-600" sub="Repercutido − Soportado" testid="metric-iva-pagar" delay={0} />
            <Metric label="Ingresos" value={eur(data.total_ingresos)} icon={TrendingUp} tone="success" chip="bg-emerald-50 text-emerald-600" sub={`${data.invoice_count} facturas`} testid="metric-ingresos" delay={70} />
            <Metric label="Gastos" value={eur(data.total_gastos)} icon={TrendingDown} chip="bg-slate-100 text-slate-500" sub={`${data.expense_count} gastos`} testid="metric-gastos" delay={140} />
            <Metric label="Beneficio" value={eur(data.beneficio)} icon={Wallet} tone={data.beneficio >= 0 ? "success" : "danger"} chip="bg-blue-50 text-[#0052FF]" sub="Ingresos − Gastos" testid="metric-beneficio" delay={210} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className={`lg:col-span-2 ${CARD} p-6 of-fade-up`} style={{ animationDelay: "280ms" }}>
              <h3 className="font-display text-base font-semibold text-slate-900 mb-4">IVA por trimestre</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.quarters.map((q) => ({ name: q.label.split(" ")[0], "Repercutido": q.iva_repercutido, "Soportado": q.iva_soportado }))} barGap={6}>
                  <defs>
                    <linearGradient id="gradRep" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0052FF" stopOpacity={1} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="gradSop" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#93C5FD" stopOpacity={1} />
                      <stop offset="100%" stopColor="#BFDBFE" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(0,82,255,0.04)" }} formatter={(v) => eur(v)} contentStyle={{ borderRadius: 14, border: "1px solid #E2E8F0", fontSize: 13, boxShadow: "0 8px 30px rgb(0,0,0,0.08)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Repercutido" fill="url(#gradRep)" radius={[6, 6, 0, 0]} maxBarSize={54} />
                  <Bar dataKey="Soportado" fill="url(#gradSop)" radius={[6, 6, 0, 0]} maxBarSize={54} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={`${CARD} p-6 of-fade-up`} style={{ animationDelay: "340ms" }}>
              <h3 className="font-display text-base font-semibold text-slate-900 mb-3">Trimestres</h3>
              <div className="space-y-1">
                {data.quarters.map((q) => (
                  <div key={q.quarter} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0" data-testid={`quarter-row-${q.quarter}`}>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{q.label}</div>
                      <div className="text-xs text-slate-400">Límite {new Date(q.deadline).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</div>
                    </div>
                    <span className={`text-sm font-semibold tabular rounded-full px-2.5 py-1 ${q.iva_a_pagar > 0 ? "bg-red-50 text-red-600" : q.iva_a_pagar < 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{eur(q.iva_a_pagar)}</span>
                  </div>
                ))}
              </div>
              <Link to="/impuestos">
                <Button variant="outline" className="w-full mt-4 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-all" data-testid="dashboard-view-taxes">
                  Ver impuestos
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
