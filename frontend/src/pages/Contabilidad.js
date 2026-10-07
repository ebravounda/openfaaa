import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Diario, Mayor, SumasSaldos } from "@/components/contabilidad/Libros";
import { Balance, Pyg, Volumen } from "@/components/contabilidad/Estados";
import { Activos, Asientos } from "@/components/contabilidad/Activos";
import { Categorias, PlanCuentas } from "@/components/contabilidad/Categorias";
import { BookOpen } from "lucide-react";

const TABS = [
  ["balance", "Balance de situación"], ["pyg", "Pérdidas y ganancias"], ["diario", "Libro diario"], ["mayor", "Libro mayor"],
  ["sumas", "Sumas y saldos"], ["volumen", "Volumen"], ["amortizaciones", "Amortizaciones"], ["categorias", "Categorías"],
  ["asientos", "Asientos manuales"], ["pgc", "Plan de cuentas"],
];

export default function Contabilidad() {
  const now = new Date().getFullYear();
  const [year, setYear] = useState(now);
  const [plan, setPlan] = useState("pymes");
  const [tab, setTab] = useState("balance");
  const [k, setK] = useState(0);
  useEffect(() => { api.get("/contabilidad/config").then((r) => setPlan(r.data.plan)); }, []);
  const changePlan = async (v) => {
    await api.put("/contabilidad/config", { plan: v }); setPlan(v); setK(k + 1);
    toast.success(v === "normal" ? "Plan General Contable normal" : "Plan General Contable de PYMES");
  };
  const view = {
    balance: <Balance year={year} />, pyg: <Pyg year={year} />, diario: <Diario year={year} />, mayor: <Mayor year={year} />,
    sumas: <SumasSaldos year={year} />, volumen: <Volumen year={year} />, amortizaciones: <Activos />, categorias: <Categorias year={year} />,
    asientos: <Asientos year={year} />, pgc: <PlanCuentas />,
  };
  return (
    <Layout>
      <div className="space-y-5" data-testid="contabilidad-page">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2"><BookOpen className="w-6 h-6 text-[#0052FF]" strokeWidth={1.5} /> Contabilidad</h1>
            <p className="text-sm text-slate-500 mt-0.5">Plan General Contable español. Los asientos se generan solos desde tus facturas, gastos, cobros, nóminas y amortizaciones.</p>
          </div>
          <div className="flex gap-2">
            <Select value={plan} onValueChange={changePlan}>
              <SelectTrigger className="w-56 h-10 bg-white" data-testid="pgc-plan-select"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="pymes">PGC PYMES (RD 1515/2007)</SelectItem><SelectItem value="normal">PGC normal (RD 1514/2007)</SelectItem></SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-36 h-10 bg-white" data-testid="acc-year-select"><SelectValue /></SelectTrigger>
              <SelectContent>{[now, now - 1, now - 2, now - 3].map((y) => <SelectItem key={y} value={String(y)}>Ejercicio {y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto justify-start bg-slate-100 p-1">
            {TABS.map(([v, l]) => <TabsTrigger key={v} value={v} data-testid={`acc-tab-${v}`}>{l}</TabsTrigger>)}
          </TabsList>
          <TabsContent value={tab} className="mt-4" key={`${tab}-${year}-${k}`}>{view[tab]}</TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
