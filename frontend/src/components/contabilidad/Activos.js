import { Fragment, useState } from "react";
import { toast } from "sonner";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Box, Loading, Th, Td, Num, useFetch } from "./shared";
import { Plus, Trash2, ChevronDown } from "lucide-react";

const EMPTY = { name: "", asset_type: "informatica", cost: "", iva_amount: "", residual: "", start_date: new Date().toISOString().slice(0, 10), rate: "", register_purchase: false };

export const Activos = () => {
  const [rows, reload] = useFetch("/contabilidad/activos");
  const [types] = useFetch("/contabilidad/tablas-amortizacion");
  const [f, setF] = useState(null);
  const [open, setOpen] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e });
  const save = async () => {
    try {
      const body = { ...f, cost: Number(f.cost || 0), iva_amount: Number(f.iva_amount || 0), residual: Number(f.residual || 0), rate: Number(f.rate || 0) };
      if (f.id) await api.put(`/contabilidad/activos/${f.id}`, body); else await api.post("/contabilidad/activos", body);
      toast.success("Activo guardado"); setF(null); reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const del = async (a) => { if (!window.confirm(`¿Eliminar ${a.name}?`)) return; await api.delete(`/contabilidad/activos/${a.id}`); reload(); };
  if (!rows || !types) return <Loading />;
  const t = types.find?.((x) => x.key === f?.asset_type);
  return (
    <Box data-testid="activos">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <span className="text-sm text-slate-600">Inmovilizado y amortizaciones (método lineal, tabla oficial de coeficientes del art. 12 LIS)</span>
        <Button size="sm" className="bg-[#0052FF] hover:bg-[#0040CC] text-white" onClick={() => setF({ ...EMPTY })} data-testid="activo-new"><Plus className="w-4 h-4 mr-1" /> Nuevo activo</Button>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-slate-50"><tr><Th>Activo</Th><Th>Tipo</Th><Th>Alta</Th><Th right>Coef.</Th><Th right>Valor</Th><Th right>Amort. año</Th><Th right>Acumulada</Th><Th right>Valor neto</Th><Th /></tr></thead>
        <tbody>{rows.map((a) => (
          <Fragment key={a.id}>
            <tr className="border-t border-slate-100" data-testid={`activo-${a.id}`}>
              <Td><button className="text-left hover:text-[#0052FF]" onClick={() => setOpen(open === a.id ? "" : a.id)}><ChevronDown className={`inline w-3 h-3 mr-1 transition-transform ${open === a.id ? "" : "-rotate-90"}`} />{a.name}</button></Td>
              <Td className="text-slate-500">{a.type_label} <span className="font-mono text-xs">({a.account})</span></Td><Td>{a.start_date}</Td><Td right>{a.rate} %</Td>
              <Td right><Num v={a.cost} /></Td><Td right><Num v={a.amort_year} /></Td><Td right><Num v={a.acumulada} /></Td><Td right><Num v={a.valor_neto} className="font-medium" /></Td>
              <Td right><button onClick={() => setF({ ...a })} className="text-xs text-[#0052FF] mr-2">Editar</button><button onClick={() => del(a)}><Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" /></button></Td>
            </tr>
            {open === a.id && <tr><td colSpan={9} className="bg-slate-50 px-6 py-3"><div className="text-xs font-semibold text-slate-500 mb-2">Cuadro de amortización</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">{a.schedule.map((s) => (
                <div key={s.year} className="bg-white border border-slate-200 rounded-lg p-2 text-xs"><b>{s.year}</b><div>{eur(s.amortizacion)}</div><div className="text-slate-400">Neto {eur(s.valor_neto)}</div></div>))}</div></td></tr>}
          </Fragment>
        ))}</tbody>
      </table>
      {!rows.length && <div className="text-center text-slate-400 py-12 text-sm">Aún no hay inmovilizado. Añade ordenadores, vehículos, mobiliario…</div>}</div>
      <Dialog open={!!f} onOpenChange={(o) => !o && setF(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{f?.id ? "Editar activo" : "Nuevo activo"}</DialogTitle></DialogHeader>
          {f && <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Descripción</Label><Input value={f.name} onChange={set("name")} placeholder="Portátil, furgoneta…" data-testid="activo-name" /></div>
            <div className="col-span-2"><Label>Tipo de elemento</Label>
              <Select value={f.asset_type} onValueChange={set("asset_type")}><SelectTrigger data-testid="activo-type"><SelectValue /></SelectTrigger>
                <SelectContent>{types.map((x) => <SelectItem key={x.key} value={x.key}>{x.label} · máx. {x.rate} % / {x.max_years} años</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Valor de adquisición (sin IVA)</Label><Input type="number" value={f.cost} onChange={set("cost")} data-testid="activo-cost" /></div>
            <div><Label>Fecha de puesta en marcha</Label><Input type="date" value={f.start_date} onChange={set("start_date")} data-testid="activo-date" /></div>
            <div><Label>Coeficiente % (máx. {t?.rate})</Label><Input type="number" value={f.rate} onChange={set("rate")} placeholder={String(t?.rate || "")} data-testid="activo-rate" /></div>
            <div><Label>Valor residual</Label><Input type="number" value={f.residual} onChange={set("residual")} /></div>
            <label className="col-span-2 flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" checked={!!f.register_purchase} onChange={set("register_purchase")} className="mt-1" data-testid="activo-register" />
              Registrar también el asiento de compra (marca solo si no lo has metido ya como gasto)</label>
            {f.register_purchase && <div><Label>IVA de la compra</Label><Input type="number" value={f.iva_amount} onChange={set("iva_amount")} /></div>}
          </div>}
          <Button onClick={save} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="activo-save">Guardar</Button>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

const newLine = () => ({ account: "", debe: "", haber: "" });

export const Asientos = ({ year }) => {
  const [rows, reload] = useFetch(`/contabilidad/asientos?year=${year}`);
  const [f, setF] = useState(null);
  const tot = (k) => (f?.lines || []).reduce((s, l) => s + Number(l[k] || 0), 0);
  const setLine = (i, k, v) => setF({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });
  const save = async () => {
    try {
      const body = { ...f, lines: f.lines.map((l) => ({ account: l.account, debe: Number(l.debe || 0), haber: Number(l.haber || 0) })) };
      if (f.id) await api.put(`/contabilidad/asientos/${f.id}`, body); else await api.post("/contabilidad/asientos", body);
      toast.success("Asiento guardado"); setF(null); reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  if (!rows) return <Loading />;
  const diff = Math.round((tot("debe") - tot("haber")) * 100) / 100;
  return (
    <Box data-testid="asientos">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center gap-3">
        <span className="text-sm text-slate-600">Asientos manuales (apertura, préstamos, capital, regularizaciones…). El resto se genera solo desde facturas, gastos, nóminas y amortizaciones.</span>
        <Button size="sm" className="bg-[#0052FF] hover:bg-[#0040CC] text-white shrink-0" onClick={() => setF({ date: `${year}-01-01`, concept: "", lines: [newLine(), newLine()] })} data-testid="asiento-new"><Plus className="w-4 h-4 mr-1" /> Nuevo asiento</Button>
      </div>
      <table className="w-full text-sm"><tbody>{rows.map((e) => (
        <tr key={e.id} className="border-t border-slate-100"><Td className="text-slate-500 w-28">{e.date}</Td><Td>{e.concept}</Td>
          <Td className="text-xs text-slate-500">{e.lines.map((l) => l.account).join(" · ")}</Td><Td right><Num v={e.lines.reduce((s, l) => s + l.debe, 0)} /></Td>
          <Td right><button onClick={() => setF({ ...e })} className="text-xs text-[#0052FF] mr-2">Editar</button>
            <button onClick={async () => { if (window.confirm("¿Eliminar asiento?")) { await api.delete(`/contabilidad/asientos/${e.id}`); reload(); } }}><Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" /></button></Td></tr>
      ))}</tbody></table>
      {!rows.length && <div className="text-center text-slate-400 py-12 text-sm">No hay asientos manuales en {year}.</div>}
      <Dialog open={!!f} onOpenChange={(o) => !o && setF(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{f?.id ? "Editar asiento" : "Nuevo asiento"}</DialogTitle></DialogHeader>
          {f && <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3"><div><Label>Fecha</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} data-testid="asiento-date" /></div>
              <div className="col-span-2"><Label>Concepto</Label><Input value={f.concept} onChange={(e) => setF({ ...f, concept: e.target.value })} data-testid="asiento-concept" /></div></div>
            {f.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <Input placeholder="Cuenta (572)" value={l.account} onChange={(e) => setLine(i, "account", e.target.value)} data-testid={`asiento-acc-${i}`} />
                <Input type="number" placeholder="Debe" value={l.debe} onChange={(e) => setLine(i, "debe", e.target.value)} data-testid={`asiento-debe-${i}`} />
                <Input type="number" placeholder="Haber" value={l.haber} onChange={(e) => setLine(i, "haber", e.target.value)} data-testid={`asiento-haber-${i}`} />
                <button onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })}><Trash2 className="w-4 h-4 text-slate-400" /></button>
              </div>
            ))}
            <div className="flex justify-between items-center text-sm">
              <button className="text-[#0052FF]" onClick={() => setF({ ...f, lines: [...f.lines, newLine()] })} data-testid="asiento-add-line">+ Añadir línea</button>
              <span className={diff ? "text-red-600" : "text-emerald-700"} data-testid="asiento-diff">Debe {eur(tot("debe"))} · Haber {eur(tot("haber"))}{diff ? ` · Descuadre ${eur(diff)}` : " · Cuadra"}</span>
            </div>
          </div>}
          <Button onClick={save} disabled={!!diff} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="asiento-save">Guardar asiento</Button>
        </DialogContent>
      </Dialog>
    </Box>
  );
};
