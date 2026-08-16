import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { eur } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  Wallet,
  CalendarClock,
  ArrowRight,
  Loader2,
} from "lucide-react";

function Metric({ label, value, icon: Icon, accent, sub, testid }) {
  return (
    <Card
      data-testid={testid}
      className="p-6 bg-white border border-[#E5E5E5] rounded-md shadow-none transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#666666]">{label}</span>
        <Icon className="w-4 h-4" style={{ color: accent || "#666666" }} />
      </div>
      <div className="font-heading text-3xl font-black tracking-tighter mt-3" style={{ color: accent || "#111111" }}>
        {value}
      </div>
      {sub && <div className="text-xs text-[#666666] mt-1">{sub}</div>}
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    api.get(`/dashboard?year=${year}`).then((r) => setData(r.data));
  }, [year]);

  if (!data)
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Layout>
    );

  const chartData = data.quarters.map((q) => ({
    name: q.label.split(" ")[0],
    "IVA Repercutido": q.iva_repercutido,
    "IVA Soportado": q.iva_soportado,
  }));

  return (
    <Layout>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter text-[#111111]">
            Panel
          </h1>
          <p className="text-sm text-[#666666] mt-1">Resumen fiscal del ejercicio {data.year}</p>
        </div>
        <Link to="/facturas">
          <Button className="bg-[#0A0A0A] hover:bg-[#262626] text-white rounded-md" data-testid="dashboard-new-invoice">
            Nueva factura <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      {/* Next deadline */}
      {data.next_deadline && (
        <Card className="p-6 mb-6 bg-[#0A0A0A] text-white border-0 rounded-md" data-testid="next-deadline-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-md bg-white/10 flex items-center justify-center">
                <CalendarClock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.15em] text-white/50">
                  Próximo pago · Modelo 303 · {data.next_deadline.label}
                </div>
                <div className="font-heading text-2xl font-bold mt-1">
                  Vence el {new Date(data.next_deadline.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                </div>
                <div className="text-sm text-white/60 mt-0.5">Faltan {data.next_deadline.days_left} días</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-[0.15em] text-white/50">A pagar (estimado)</div>
              <div className="font-heading text-3xl font-black tracking-tighter mt-1">
                {eur(Math.max(0, data.next_deadline.amount))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Metric label="IVA a pagar" value={eur(data.iva_a_pagar)} icon={Landmark} accent="#E63946" sub="Repercutido − Soportado" testid="metric-iva-pagar" />
        <Metric label="Ingresos" value={eur(data.total_ingresos)} icon={TrendingUp} accent="#2A9D8F" sub={`${data.invoice_count} facturas`} testid="metric-ingresos" />
        <Metric label="Gastos" value={eur(data.total_gastos)} icon={TrendingDown} sub={`${data.expense_count} gastos`} testid="metric-gastos" />
        <Metric label="Beneficio" value={eur(data.beneficio)} icon={Wallet} accent={data.beneficio >= 0 ? "#2A9D8F" : "#E63946"} sub="Ingresos − Gastos" testid="metric-beneficio" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <Card className="lg:col-span-2 p-6 bg-white border border-[#E5E5E5] rounded-md shadow-none">
          <h3 className="font-heading text-lg font-bold text-[#111111] mb-4">IVA por trimestre</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#666" }} axisLine={{ stroke: "#E5E5E5" }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#666" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => eur(v)} contentStyle={{ borderRadius: 6, border: "1px solid #E5E5E5", fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="IVA Repercutido" fill="#0A0A0A" radius={[3, 3, 0, 0]} />
              <Bar dataKey="IVA Soportado" fill="#2A9D8F" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Quarter summary */}
        <Card className="p-6 bg-white border border-[#E5E5E5] rounded-md shadow-none">
          <h3 className="font-heading text-lg font-bold text-[#111111] mb-4">Trimestres</h3>
          <div className="space-y-3">
            {data.quarters.map((q) => (
              <div key={q.quarter} className="flex items-center justify-between pb-3 border-b border-[#F0F0F0] last:border-0" data-testid={`quarter-row-${q.quarter}`}>
                <div>
                  <div className="text-sm font-semibold text-[#111111]">{q.label}</div>
                  <div className="text-xs text-[#666666]">Límite {new Date(q.deadline).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</div>
                </div>
                <div className={`text-sm font-bold ${q.iva_a_pagar >= 0 ? "text-[#E63946]" : "text-[#2A9D8F]"}`}>
                  {eur(q.iva_a_pagar)}
                </div>
              </div>
            ))}
          </div>
          <Link to="/impuestos">
            <Button variant="outline" className="w-full mt-4 rounded-md" data-testid="dashboard-view-taxes">
              Ver detalle de impuestos
            </Button>
          </Link>
        </Card>
      </div>
    </Layout>
  );
}
