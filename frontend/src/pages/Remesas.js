import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { Deudores } from "@/components/remesas/Deudores";
import { RemesaEditor } from "@/components/remesas/RemesaEditor";
import { ArrowLeft, Plus, Upload, RefreshCw, Landmark, Loader2, Trash2 } from "lucide-react";

const BADGE = { borrador: "bg-slate-100 text-slate-600", enviada: "bg-blue-50 text-[#0052FF]", parcial: "bg-amber-50 text-amber-700", cobrada: "bg-emerald-50 text-emerald-700" };
const LABEL = { borrador: "Borrador", enviada: "Enviada", parcial: "Parcial", cobrada: "Cobrada" };

const Shell = ({ isG, navigate, children }) => isG ? (
  <div className="min-h-screen bg-slate-50" data-testid="remesas-page">
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate("/gestoria")} data-testid="remesas-back"><ArrowLeft className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Panel de gestoría</span></Button>
        <Button variant="outline" onClick={() => navigate("/conciliacion")} data-testid="remesas-bank"><Landmark className="w-4 h-4 mr-2" /> Banco<span className="hidden sm:inline">&nbsp;y conciliación</span></Button>
      </div>
    </header>
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5">{children}</main>
  </div>
) : <Layout><div className="space-y-5" data-testid="remesas-page">{children}</div></Layout>;

export default function Remesas() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [sel, setSel] = useState("");
  const [tab, setTab] = useState("remesas");
  const [nw, setNw] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api.get("/gestoria/remesas").then((r) => setList(r.data));
    api.get("/gestoria/remesas/deudores").then((r) => setDebtors(r.data));
  }, []);
  useEffect(() => { load(); }, [load]);
  const create = async () => {
    try { const { data } = await api.post("/gestoria/remesas", nw); setNw(null); setSel(data.id); load(); toast.success("Remesa creada"); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const importFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/gestoria/remesas/importar", fd);
      toast.success(`Remesa importada: ${data.remesa.count} recibos (${eur(data.remesa.total)}) · ${data.new_debtors} deudores nuevos`);
      setSel(data.remesa.id); setTab("remesas"); load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(false); }
  };
  const check = async () => {
    const { data } = await api.post("/gestoria/remesas/comprobar-cobros");
    if (data.found.length) data.found.forEach((f) => toast.success(`Cobro de ${eur(f.amount)} conciliado · ${f.remesa}: ${f.detail}`));
    else toast.message("No hay cobros nuevos de remesas en el banco");
    load();
  };
  const del = async (r) => {
    if (!window.confirm(`¿Eliminar la remesa ${r.name}?`)) return;
    try { await api.delete(`/gestoria/remesas/${r.id}`); if (sel === r.id) setSel(""); load(); } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const { user } = useAuth();
  const isG = user?.role === "gestoria";
  return (
    <Shell isG={isG} navigate={navigate}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Remesas SEPA</h1>
            <p className="text-sm text-slate-500 mt-0.5">Crea y ordena los recibos que envías al banco, emite la factura de cada cliente y detecta los cobros automáticamente.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={check} data-testid="remesas-check"><RefreshCw className="w-4 h-4 mr-2" /> Comprobar cobros</Button>
            <label className="inline-flex items-center gap-2 text-sm border border-slate-200 bg-white rounded-md px-3 h-10 cursor-pointer hover:bg-slate-50" data-testid="remesas-import-label">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Importar Excel/CSV
              <input type="file" accept=".csv,.xlsx" className="hidden" onChange={importFile} data-testid="remesas-import-input" />
            </label>
            <Button className="bg-[#0052FF] hover:bg-[#0040CC] text-white" onClick={() => setNw({ name: `Remesa ${new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`, charge_date: "", reference: "", from_debtors: true })} data-testid="remesas-new"><Plus className="w-4 h-4 mr-2" /> Nueva remesa</Button>
          </div>
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit bg-white">
          {[["remesas", `Remesas (${list.length})`], ["deudores", `Deudores (${debtors.length})`]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 h-9 text-sm transition-colors ${tab === k ? "bg-[#0052FF] text-white" : "text-slate-600 hover:bg-slate-50"}`} data-testid={`remesas-tab-${k}`}>{l}</button>
          ))}
        </div>
        {tab === "deudores" ? <Deudores debtors={debtors} reload={load} /> : (
          <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
            <div className="space-y-2" data-testid="remesas-list">
              {list.map((r) => (
                <div key={r.id} onClick={() => setSel(r.id)} className={`bg-white border rounded-xl p-3 cursor-pointer transition-colors ${sel === r.id ? "border-[#0052FF] ring-1 ring-[#0052FF]/20" : "border-slate-200 hover:border-slate-300"}`} data-testid={`remesa-card-${r.id}`}>
                  <div className="flex justify-between gap-2"><span className="font-medium text-sm text-slate-900 truncate">{r.name}</span><button onClick={(e) => { e.stopPropagation(); del(r); }}><Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-600" /></button></div>
                  <div className="flex justify-between items-center mt-1 text-xs"><span className={`rounded px-1.5 py-0.5 ${BADGE[r.status]}`}>{LABEL[r.status]}</span><span className="tabular font-semibold">{eur(r.total)}</span></div>
                  <div className="text-[11px] text-slate-400 mt-1">{r.count} recibos{r.charge_date ? ` · cobro ${r.charge_date}` : ""}</div>
                </div>
              ))}
              {!list.length && <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">Aún no hay remesas.</div>}
            </div>
            {sel ? <RemesaEditor id={sel} debtors={debtors} onChanged={load} /> : <div className="bg-white border border-dashed border-slate-200 rounded-xl p-16 text-center text-slate-400 text-sm">Selecciona o crea una remesa.</div>}
          </div>
        )}
      <Dialog open={!!nw} onOpenChange={(o) => !o && setNw(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva remesa</DialogTitle></DialogHeader>
          {nw && <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} data-testid="new-remesa-name" /></div>
            <div><Label>Fecha de cobro</Label><Input type="date" value={nw.charge_date} onChange={(e) => setNw({ ...nw, charge_date: e.target.value })} data-testid="new-remesa-date" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={nw.from_debtors} onChange={(e) => setNw({ ...nw, from_debtors: e.target.checked })} data-testid="new-remesa-from-debtors" /> Incluir todos los deudores activos con su importe habitual</label>
          </div>}
          <Button onClick={create} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="new-remesa-create">Crear remesa</Button>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
