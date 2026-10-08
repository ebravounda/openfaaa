import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { downloadFile } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, ArrowDown, Trash2, Plus, FileText, Download, Save, Loader2, CheckCircle2, AlertTriangle, Copy } from "lucide-react";

const STATUS = { borrador: "Borrador", enviada: "Enviada al banco", parcial: "Cobrada parcialmente", cobrada: "Cobrada" };
const blank = () => ({ id: "", name: "", nif: "", iban: "", mandate: "", mandate_date: "", amount: 0, iva_rate: 21, concept: "", reference: "", invoice_id: "", paid: false });
const COLS = [["name", "Deudor", "w-44"], ["nif", "NIF", "w-28"], ["iban", "IBAN", "w-56"], ["mandate", "Mandato", "w-32"], ["mandate_date", "F. mandato", "w-36", "date"],
  ["amount", "Importe", "w-24", "number"], ["concept", "Concepto", "w-56"]];

export const RemesaEditor = ({ id, debtors, onChanged, onNeedIssuer }) => {
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setR(null); api.get(`/gestoria/remesas/${id}`).then((x) => { setR(x.data); setDirty(false); }); }, [id]);
  if (!r) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;
  const upd = (patch) => { setR({ ...r, ...patch }); setDirty(true); };
  const setLine = (i, k, v) => upd({ lines: r.lines.map((l, j) => (j === i ? { ...l, [k]: k === "amount" ? v : v } : l)) });
  const move = (i, d) => { const ls = [...r.lines]; const j = i + d; if (j < 0 || j >= ls.length) return; [ls[i], ls[j]] = [ls[j], ls[i]]; upd({ lines: ls }); };
  const sortBy = (k) => upd({ lines: [...r.lines].sort((a, b) => (k === "amount" ? b.amount - a.amount : String(a[k]).localeCompare(String(b[k])))) });
  const addDebtor = (did) => { const d = debtors.find((x) => x.id === did); if (d) upd({ lines: [...r.lines, { ...blank(), ...d, id: "", debtor_id: d.id }] }); };
  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (e) {
      const msg = formatApiErrorDetail(e.response?.data?.detail);
      if (msg.startsWith("DATOS_FISCALES:")) { toast.error(msg.replace("DATOS_FISCALES: ", "")); onNeedIssuer?.(); }
      else toast.error(msg);
    } finally { setBusy(""); }
  };
  const save = () => run("save", async () => {
    const { data } = await api.put(`/gestoria/remesas/${id}`, { name: r.name, charge_date: r.charge_date, reference: r.reference, lines: r.lines.map((l) => ({ ...l, amount: Number(l.amount || 0), iva_rate: Number(l.iva_rate ?? 21) })) });
    setR(data); setDirty(false); toast.success("Remesa guardada"); onChanged();
  });
  const invoices = () => run("inv", async () => {
    if (dirty) await save();
    const { data } = await api.post(`/gestoria/remesas/${id}/facturas`);
    setR(data.remesa); onChanged();
    toast.success(`${data.created} factura(s) emitidas`);
    if (data.errors.length) toast.error(data.errors.join(" · "), { duration: 10000 });
  });
  const status = (s) => run("st", async () => { await api.post(`/gestoria/remesas/${id}/estado`, { status: s }); setR({ ...r, status: s }); onChanged(); });
  const paid = (l) => run("p", async () => { const { data } = await api.post(`/gestoria/remesas/${id}/lineas/${l.id}/cobro`, { paid: !l.paid }); setR(data); onChanged(); });
  const dup = () => run("dup", async () => { const n = window.prompt("Nombre de la nueva remesa", `${r.name} (copia)`); if (!n) return; await api.post(`/gestoria/remesas/${id}/duplicar`, { name: n, charge_date: "" }); toast.success("Remesa duplicada"); onChanged(); });
  const total = r.lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  return (
    <div className="bg-white border border-slate-200 rounded-xl min-w-0" data-testid="remesa-editor">
      <div className="p-4 border-b border-slate-100 grid sm:grid-cols-4 gap-3">
        <Input value={r.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Nombre" data-testid="remesa-name" />
        <Input type="date" value={r.charge_date || ""} onChange={(e) => upd({ charge_date: e.target.value })} data-testid="remesa-charge-date" />
        <Input value={r.reference || ""} onChange={(e) => upd({ reference: e.target.value })} placeholder="Referencia" />
        <Select value={r.status} onValueChange={status}><SelectTrigger data-testid="remesa-status"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="px-4 py-3 flex flex-wrap gap-2 items-center justify-between border-b border-slate-100">
        <div className="text-sm text-slate-600" data-testid="remesa-totals">{r.lines.length} recibos · <b className="tabular">{eur(total)}</b> · cobrado {eur(r.paid_total)} · {r.invoiced} facturados
          {r.warnings > 0 && <span className="text-amber-700 ml-2"><AlertTriangle className="inline w-3.5 h-3.5" /> {r.warnings} con avisos</span>}</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={!dirty || busy} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="remesa-save">{busy === "save" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Guardar</Button>
          <Button size="sm" variant="outline" onClick={invoices} disabled={!!busy} data-testid="remesa-invoices">{busy === "inv" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}Emitir facturas</Button>
          <Button size="sm" variant="outline" onClick={() => downloadFile(`/gestoria/remesas/${id}/exportar?formato=xlsx`, `${r.name}.xlsx`)} data-testid="remesa-export-xlsx"><Download className="w-4 h-4 mr-1" />Excel</Button>
          <Button size="sm" variant="outline" onClick={() => downloadFile(`/gestoria/remesas/${id}/exportar?formato=csv`, `${r.name}.csv`)} data-testid="remesa-export-csv"><Download className="w-4 h-4 mr-1" />CSV</Button>
          <Button size="sm" variant="ghost" onClick={dup} data-testid="remesa-duplicate"><Copy className="w-4 h-4 mr-1" />Duplicar</Button>
        </div>
      </div>
      <div className="px-4 py-2 flex flex-wrap gap-2 items-center text-xs text-slate-500">
        Ordenar: {[["name", "Nombre"], ["amount", "Importe"], ["iban", "IBAN"]].map(([k, l]) => <button key={k} onClick={() => sortBy(k)} className="text-[#0052FF] hover:underline" data-testid={`remesa-sort-${k}`}>{l}</button>)}
        <span className="mx-2">·</span>
        <Select onValueChange={addDebtor}><SelectTrigger className="h-8 w-56 text-xs" data-testid="remesa-add-debtor"><SelectValue placeholder="Añadir deudor guardado" /></SelectTrigger>
          <SelectContent>{debtors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name || d.iban}</SelectItem>)}</SelectContent></Select>
        <button onClick={() => upd({ lines: [...r.lines, blank()] })} className="text-[#0052FF] flex items-center gap-1" data-testid="remesa-add-line"><Plus className="w-3.5 h-3.5" /> Línea vacía</button>
      </div>
      <div className="overflow-x-auto"><table className="text-sm min-w-full">
        <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-2 py-2">Nº</th>{COLS.map(([k, l]) => <th key={k} className="px-2 py-2 text-left">{l}</th>)}<th className="px-2 py-2 text-left">Factura</th><th className="px-2 py-2 text-left">Cobro</th><th /></tr></thead>
        <tbody>{r.lines.map((l, i) => (
          <tr key={l.id || `n${i}`} className={`border-t border-slate-100 ${l.paid ? "bg-emerald-50/40" : ""}`} data-testid={`remesa-line-${i}`}>
            <td className="px-2 text-slate-400 text-xs whitespace-nowrap">{i + 1}<div className="flex"><button onClick={() => move(i, -1)}><ArrowUp className="w-3 h-3" /></button><button onClick={() => move(i, 1)}><ArrowDown className="w-3 h-3" /></button></div></td>
            {COLS.map(([k, , w, type]) => (
              <td key={k} className="px-1 py-1"><Input type={type || "text"} value={l[k] ?? ""} disabled={k === "amount" && !!l.invoice_id} onChange={(e) => setLine(i, k, e.target.value)}
                className={`h-8 text-xs ${w} ${l.warnings?.some((x) => x.toLowerCase().includes(k === "name" ? "nombre" : k)) ? "border-amber-400" : ""}`} data-testid={`line-${k}-${i}`} /></td>
            ))}
            <td className="px-2 text-xs whitespace-nowrap">{l.invoice_number || <span className="text-slate-400">—</span>}</td>
            <td className="px-2"><button onClick={() => paid(l)} disabled={!l.id} className={`text-xs flex items-center gap-1 whitespace-nowrap ${l.paid ? "text-emerald-700" : "text-slate-400 hover:text-[#0052FF]"}`} data-testid={`line-paid-${i}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />{l.paid ? `Cobrado ${l.paid_date || ""}` : "Pendiente"}</button></td>
            <td className="px-2">{!l.invoice_id && <button onClick={() => upd({ lines: r.lines.filter((_, j) => j !== i) })}><Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" /></button>}</td>
          </tr>
        ))}</tbody></table>
        {!r.lines.length && <div className="text-center text-slate-400 py-10 text-sm">La remesa está vacía. Añade deudores o líneas.</div>}</div>
    </div>
  );
};
