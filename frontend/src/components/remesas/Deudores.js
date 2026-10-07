import { useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Users, AlertTriangle } from "lucide-react";

const EMPTY = { name: "", nif: "", iban: "", mandate: "", mandate_date: "", email: "", amount: "", iva_rate: 21, concept: "Asesoría mes vista", reference: "", active: true };
const FIELDS = [["name", "Nombre / razón social", "col-span-2"], ["nif", "NIF / CIF"], ["email", "Email"], ["iban", "IBAN", "col-span-2"], ["mandate", "Referencia de mandato"],
  ["mandate_date", "Fecha de firma del mandato", "", "date"], ["amount", "Importe habitual (IVA incluido)", "", "number"], ["iva_rate", "IVA %", "", "number"],
  ["concept", "Concepto", "col-span-2"], ["reference", "Referencia de operación", "col-span-2"]];

export const Deudores = ({ debtors, reload }) => {
  const [f, setF] = useState(null);
  const save = async () => {
    try {
      const body = { ...f, amount: Number(f.amount || 0), iva_rate: Number(f.iva_rate || 0) };
      if (f.id) await api.put(`/gestoria/remesas/deudores/${f.id}`, body); else await api.post("/gestoria/remesas/deudores", body);
      toast.success("Deudor guardado"); setF(null); reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const fromClients = async () => { const { data } = await api.post("/gestoria/remesas/deudores/desde-clientes"); toast.success(`${data.created} deudor(es) creados desde tus clientes`); reload(); };
  const del = async (d) => { if (window.confirm(`¿Eliminar a ${d.name || d.iban}?`)) { await api.delete(`/gestoria/remesas/deudores/${d.id}`); reload(); } };
  return (
    <div className="bg-white border border-slate-200 rounded-xl" data-testid="debtors-panel">
      <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2 justify-between items-center">
        <span className="text-sm text-slate-600">{debtors.length} deudores con mandato SEPA</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fromClients} data-testid="debtors-from-clients"><Users className="w-4 h-4 mr-1.5" /> Importar mis clientes</Button>
          <Button size="sm" className="bg-[#0052FF] hover:bg-[#0040CC] text-white" onClick={() => setF({ ...EMPTY })} data-testid="debtor-new"><Plus className="w-4 h-4 mr-1" /> Nuevo deudor</Button>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">Deudor</th><th className="px-3 py-2 text-left">IBAN</th><th className="px-3 py-2 text-left">Mandato</th><th className="px-3 py-2 text-right">Importe</th><th className="px-3 py-2 text-left">Estado</th><th /></tr></thead>
        <tbody>{debtors.map((d) => (
          <tr key={d.id} className="border-t border-slate-100" data-testid={`debtor-${d.id}`}>
            <td className="px-3 py-2"><div className="font-medium">{d.name || <span className="text-amber-600">Sin nombre</span>}</div><div className="text-xs text-slate-500">{d.nif}</div></td>
            <td className="px-3 py-2 font-mono text-xs">{d.iban}</td><td className="px-3 py-2 text-xs">{d.mandate}<div className="text-slate-400">{d.mandate_date}</div></td>
            <td className="px-3 py-2 text-right tabular">{Number(d.amount || 0).toFixed(2)} €</td>
            <td className="px-3 py-2">{d.warnings?.length ? <span className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{d.warnings.join(", ")}</span> : <span className="text-xs text-emerald-700">Listo</span>}{!d.active && <span className="text-xs text-slate-400 ml-2">(inactivo)</span>}</td>
            <td className="px-3 py-2 text-right whitespace-nowrap"><button className="text-xs text-[#0052FF] mr-2" onClick={() => setF({ ...d })} data-testid={`debtor-edit-${d.id}`}>Editar</button><button onClick={() => del(d)}><Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" /></button></td>
          </tr>
        ))}</tbody></table>
        {!debtors.length && <div className="text-center text-slate-400 py-12 text-sm">Añade deudores, importa tus clientes o sube un Excel de remesa.</div>}</div>
      <Dialog open={!!f} onOpenChange={(o) => !o && setF(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{f?.id ? "Editar deudor" : "Nuevo deudor"}</DialogTitle></DialogHeader>
          {f && <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(([k, l, cls, type]) => (
              <div key={k} className={cls || ""}><Label>{l}</Label><Input type={type || "text"} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`debtor-${k}`} /></div>
            ))}
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Incluir en las nuevas remesas</label>
          </div>}
          <Button onClick={save} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="debtor-save">Guardar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
