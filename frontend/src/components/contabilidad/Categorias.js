import { useState } from "react";
import { toast } from "sonner";
import api, { eur } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Box, Loading, SearchBox, Th, Td, Num, useFetch } from "./shared";
import { Wand2 } from "lucide-react";

const CatSelect = ({ value, options, onChange, testid }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-8 w-56 text-xs" data-testid={testid}><SelectValue /></SelectTrigger>
    <SelectContent>{options.map((o) => <SelectItem key={o.name} value={o.name}>{o.name} · {o.account}</SelectItem>)}</SelectContent>
  </Select>
);

export const Categorias = ({ year }) => {
  const [d, reload] = useFetch(`/contabilidad/categorias?year=${year}`);
  const [tab, setTab] = useState("gastos");
  const [onlyPending, setOnlyPending] = useState(false);
  const setCat = async (kind, id, category) => {
    try { await api.put("/contabilidad/categorias", { kind, id, category }); toast.success("Categoría actualizada"); reload(); }
    catch { toast.error("No se pudo actualizar"); }
  };
  const auto = async () => {
    const { data } = await api.post("/contabilidad/auto-categorizar");
    toast.success(`Categorizados automáticamente: ${data.gastos} gastos y ${data.facturas} facturas`); reload();
  };
  if (!d) return <Loading />;
  const exps = d.expenses.filter((e) => !onlyPending || ["General", "Otros", "", undefined].includes(e.category));
  return (
    <div className="space-y-4" data-testid="categorias">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {[["gastos", `Gastos (${d.expenses.length})`], ["ingresos", `Ingresos (${d.invoices.length})`], ["resumen", "Resumen"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 h-9 text-sm transition-colors ${tab === k ? "bg-[#0052FF] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`} data-testid={`cat-tab-${k}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          {tab === "gastos" && <label className="text-sm text-slate-600 flex items-center gap-1.5"><input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} data-testid="cat-only-pending" /> Solo sin categorizar</label>}
          <Button size="sm" variant="outline" onClick={auto} data-testid="cat-auto"><Wand2 className="w-4 h-4 mr-1.5" /> Categorizar automáticamente</Button>
        </div>
      </div>
      {tab === "gastos" && <Box className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-slate-50"><tr><Th>Fecha</Th><Th>Proveedor</Th><Th>Descripción</Th><Th right>Base</Th><Th>Categoría · cuenta</Th><Th>Sugerencia</Th></tr></thead>
        <tbody>{exps.map((e) => (
          <tr key={e.id} className="border-t border-slate-100"><Td className="text-slate-500">{e.date}</Td><Td>{e.vendor_name}</Td><Td className="text-slate-500 max-w-[220px] truncate">{e.description}</Td><Td right><Num v={e.base} /></Td>
            <Td><CatSelect value={e.category || "General"} options={d.expense_categories} onChange={(v) => setCat("gasto", e.id, v)} testid={`cat-exp-${e.id}`} /></Td>
            <Td>{e.suggested && e.suggested !== e.category && <button className="text-xs text-[#0052FF] hover:underline" onClick={() => setCat("gasto", e.id, e.suggested)}>{e.suggested}</button>}</Td></tr>
        ))}</tbody></table>{!exps.length && <div className="text-center text-slate-400 py-10 text-sm">No hay gastos.</div>}</Box>}
      {tab === "ingresos" && <Box className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-slate-50"><tr><Th>Fecha</Th><Th>Factura</Th><Th>Cliente</Th><Th right>Base</Th><Th>Categoría · cuenta</Th><Th>Sugerencia</Th></tr></thead>
        <tbody>{d.invoices.map((i) => (
          <tr key={i.id} className="border-t border-slate-100"><Td className="text-slate-500">{i.issue_date}</Td><Td>{i.number}</Td><Td>{i.client_name}</Td><Td right><Num v={i.base} /></Td>
            <Td><CatSelect value={i.income_category} options={d.income_categories} onChange={(v) => setCat("factura", i.id, v)} testid={`cat-inv-${i.id}`} /></Td>
            <Td>{i.suggested && i.suggested !== i.income_category && <button className="text-xs text-[#0052FF] hover:underline" onClick={() => setCat("factura", i.id, i.suggested)}>{i.suggested}</button>}</Td></tr>
        ))}</tbody></table></Box>}
      {tab === "resumen" && <Box className="p-4"><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(d.expense_totals).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
          <div key={k} className="border border-slate-100 rounded-lg p-3"><div className="text-xs text-slate-500">{k} · {d.expense_categories.find((c) => c.name === k)?.account}</div><div className="font-semibold tabular">{eur(v)}</div></div>
        ))}</div></Box>}
    </div>
  );
};

export const PlanCuentas = () => {
  const [d] = useFetch("/contabilidad/cuentas");
  const [q, setQ] = useState("");
  if (!d) return <Loading />;
  const t = q.toLowerCase();
  const rows = d.filter((a) => !t || a.code.startsWith(t) || a.name.toLowerCase().includes(t));
  return (
    <Box data-testid="plan-cuentas">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center"><span className="text-sm text-slate-600">{rows.length} cuentas</span><SearchBox value={q} onChange={setQ} placeholder="Código o nombre" testid="pgc-search" /></div>
      <div className="max-h-[65vh] overflow-y-auto"><table className="w-full text-sm"><tbody>{rows.map((a) => (
        <tr key={a.code} className={`border-t border-slate-50 ${a.level <= 2 ? "bg-slate-50 font-semibold" : ""}`}>
          <Td className="font-mono text-xs text-[#0052FF] w-24" ><span style={{ paddingLeft: `${(a.level - 1) * 8}px` }}>{a.code}</span></Td><Td>{a.name}</Td></tr>
      ))}</tbody></table></div>
    </Box>
  );
};
