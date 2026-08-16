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

function Metric({ label, value, icon: Icon, tone, sub, testid }) {
  const tones = {
    danger: "text-red-600", success: "text-emerald-600", default: "text-slate-900",
  };
  return (
    <div data-testid={testid} className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 transition-colors duration-200 hover:border-slate-300">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <Icon className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
      </div>
      <div className={`font-display text-[26px] font-semibold tracking-tight mt-2 tabular ${tones[tone] || tones.default}`}>{value}</div>
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
            <SelectTrigger className="w-[130px] bg-white" data-testid="year-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>Ejercicio {y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Link to="/facturas">
            <Button className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="dashboard-new-invoice">
              Nueva factura <ArrowRight className="w-4 h-4 ml-2" strokeWidth={1.5} />
            </Button>
          </Link>
        </div>
      </div>

      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      ) : (
        <>
          {data.next_deadline && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" data-testid="next-deadline-card">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-amber-50 flex items-center justify-center">
                  <CalendarClock className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
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
              <div className="sm:text-right">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">IVA a pagar (est.)</div>
                <div className="font-display text-2xl font-semibold tracking-tight text-slate-900 tabular mt-0.5">
                  {eur(Math.max(0, data.next_deadline.amount))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <Metric label="IVA a pagar" value={eur(data.iva_a_pagar)} icon={Landmark} tone="danger" sub="Repercutido − Soportado" testid="metric-iva-pagar" />
            <Metric label="Ingresos" value={eur(data.total_ingresos)} icon={TrendingUp} tone="success" sub={`${data.invoice_count} facturas`} testid="metric-ingresos" />
            <Metric label="Gastos" value={eur(data.total_gastos)} icon={TrendingDown} sub={`${data.expense_count} gastos`} testid="metric-gastos" />
            <Metric label="Beneficio" value={eur(data.beneficio)} icon={Wallet} tone={data.beneficio >= 0 ? "success" : "danger"} sub="Ingresos − Gastos" testid="metric-beneficio" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg shadow-sm p-5">
              <h3 className="font-display text-base font-semibold text-slate-900 mb-4">IVA por trimestre</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.quarters.map((q) => ({ name: q.label.split(" ")[0], "Repercutido": q.iva_repercutido, "Soportado": q.iva_soportado }))} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => eur(v)} contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Repercutido" fill="#0052FF" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Soportado" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
              <h3 className="font-display text-base font-semibold text-slate-900 mb-3">Trimestres</h3>
              <div className="space-y-1">
                {data.quarters.map((q) => (
                  <div key={q.quarter} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0" data-testid={`quarter-row-${q.quarter}`}>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{q.label}</div>
                      <div className="text-xs text-slate-400">Límite {new Date(q.deadline).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</div>
                    </div>
                    <div className={`text-sm font-semibold tabular ${q.iva_a_pagar >= 0 ? "text-red-600" : "text-emerald-600"}`}>{eur(q.iva_a_pagar)}</div>
                  </div>
                ))}
              </div>
              <Link to="/impuestos">
                <Button variant="outline" className="w-full mt-4 border-slate-200 text-slate-700 hover:bg-slate-50" data-testid="dashboard-view-taxes">
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
