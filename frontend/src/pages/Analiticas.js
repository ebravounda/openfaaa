import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { eur } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, Clock, CheckCircle2, AlertTriangle, Download, Trophy, Coins,
} from "lucide-react";

const CARD = "bg-white border border-slate-200/60 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)]";

function Metric({ label, value, icon: Icon, tone, chip, sub, testid, delay }) {
  const tones = { danger: "text-red-600", success: "text-emerald-600", default: "text-slate-900" };
  return (
    <div data-testid={testid} className={`${CARD} p-6 of-fade-up transition-all duration-200 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-0.5`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`w-10 h-10 rounded-full flex items-center justify-center ${chip}`}><Icon className="w-5 h-5" strokeWidth={1.75} /></span>
      </div>
      <div className={`font-display text-3xl font-bold tracking-tight mt-3 tabular ${tones[tone] || tones.default}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function StatusCard({ label, count, amount, icon: Icon, chip, testid }) {
  return (
    <div className={`${CARD} p-5 flex items-center gap-4`} data-testid={testid}>
      <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${chip}`}><Icon className="w-5 h-5" strokeWidth={1.75} /></span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="font-display text-xl font-bold text-slate-900 tabular">{eur(amount)}</div>
        <div className="text-xs text-slate-400">{count} {count === 1 ? "factura" : "facturas"}</div>
      </div>
    </div>
  );
}

export default function Analiticas() {
  const [data, setData] = useState(null);
  const [years, setYears] = useState([new Date().getFullYear()]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { api.get("/available-years").then((r) => setYears(r.data)).catch(() => {}); }, []);
  useEffect(() => { setData(null); api.get(`/analytics?year=${year}`).then((r) => setData(r.data)).catch((e) => toast.error(e.response?.data?.detail || "Error al cargar analíticas")); }, [year]);

  const exportCsv = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/analytics/export?year=${year}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `analiticas_${year}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Informe exportado");
    } catch (e) {
      toast.error("No se pudo exportar el informe");
    } finally {
      setDownloading(false);
    }
  };

  const b = data?.balance;
  const st = data?.invoice_status;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-7 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Analíticas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Balance, ventas y estado de cobros del ejercicio</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[140px] h-11 rounded-xl bg-white border-slate-200" data-testid="analytics-year-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>Ejercicio {y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={exportCsv} disabled={downloading || !data} className="h-11 bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl shadow-[0_4px_14px_0_rgba(0,82,255,0.39)] transition-all hover:-translate-y-0.5 active:scale-95" data-testid="analytics-export-btn">
            <Download className="w-4 h-4 mr-2" strokeWidth={1.75} /> Exportar (Excel/CSV)
          </Button>
        </div>
      </div>

      {!data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-[20px]" />)}</div>
          <Skeleton className="h-80 w-full rounded-[20px]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
            <Metric label="Cobrado" value={eur(b.total_cobrado)} icon={Coins} tone="success" chip="bg-emerald-50 text-emerald-600" sub={`De ${eur(b.total_facturado)} facturado`} testid="metric-cobrado" delay={0} />
            <Metric label="Pendiente de cobro" value={eur(b.pendiente_cobro)} icon={Clock} tone={b.pendiente_cobro > 0 ? "danger" : "default"} chip="bg-amber-50 text-amber-600" sub="Facturas por cobrar" testid="metric-pendiente" delay={70} />
            <Metric label="Gastos" value={eur(b.total_gastos)} icon={TrendingDown} chip="bg-slate-100 text-slate-500" sub={`${data.expense_count} gastos`} testid="metric-gastos" delay={140} />
            <Metric label="Beneficio" value={eur(b.beneficio)} icon={PiggyBank} tone={b.beneficio >= 0 ? "success" : "danger"} chip="bg-blue-50 text-[#0052FF]" sub="Cobrado − Gastos" testid="metric-beneficio" delay={210} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
            <StatusCard label="Cobradas" count={st.cobradas.count} amount={st.cobradas.amount} icon={CheckCircle2} chip="bg-emerald-50 text-emerald-600" testid="status-cobradas" />
            <StatusCard label="Pendientes" count={st.pendientes.count} amount={st.pendientes.amount} icon={Clock} chip="bg-amber-50 text-amber-600" testid="status-pendientes" />
            <StatusCard label="Vencidas" count={st.vencidas.count} amount={st.vencidas.amount} icon={AlertTriangle} chip="bg-red-50 text-red-600" testid="status-vencidas" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className={`lg:col-span-2 ${CARD} p-6 of-fade-up`} style={{ animationDelay: "280ms" }}>
              <h3 className="font-display text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0052FF]" strokeWidth={1.75} /> Evolución mensual
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={data.monthly.map((m) => ({ name: m.label, Ingresos: m.ingresos, Gastos: m.gastos, Beneficio: m.beneficio }))} barGap={6}>
                  <defs>
                    <linearGradient id="gradIng" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0052FF" stopOpacity={1} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="gradGas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FCA5A5" stopOpacity={1} />
                      <stop offset="100%" stopColor="#FECACA" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(0,82,255,0.04)" }} formatter={(v) => eur(v)} contentStyle={{ borderRadius: 14, border: "1px solid #E2E8F0", fontSize: 13, boxShadow: "0 8px 30px rgb(0,0,0,0.08)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Ingresos" fill="url(#gradIng)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                  <Bar dataKey="Gastos" fill="url(#gradGas)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                  <Line type="monotone" dataKey="Beneficio" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className={`${CARD} p-6 of-fade-up`} style={{ animationDelay: "340ms" }}>
              <h3 className="font-display text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" strokeWidth={1.75} /> Top clientes
              </h3>
              {data.top_clients.length === 0 ? (
                <div className="text-sm text-slate-400 py-8 text-center">Aún no hay facturas este ejercicio.</div>
              ) : (
                <div className="space-y-1" data-testid="top-clients-list">
                  {data.top_clients.map((c, i) => (
                    <div key={c.client + i} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0" data-testid={`top-client-${i}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{c.client}</div>
                          <div className="text-xs text-slate-400">{c.count} {c.count === 1 ? "factura" : "facturas"}</div>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 tabular shrink-0 ml-2">{eur(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
