import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { downloadFile } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowUp, ArrowDown, Trash2, Plus, FileText, Download, Save, Loader2, CheckCircle2, AlertTriangle, Copy, Receipt, FileCode2 } from "lucide-react";
import { lineTax } from "./tax";

const STATUS = { borrador: "Borrador", emitida: "Facturas emitidas · pendiente de cobro", enviada: "Enviada al banco", parcial: "Cobrada parcialmente", cobrada: "Cobrada" };
const blank = () => ({ id: "", name: "", nif: "", iban: "", mandate: "", mandate_date: "", amount: 0, iva_rate: 21, vat_exempt: false, exempt_reason: "", concept: "", reference: "", invoice_id: "", paid: false });
const COLS = [["name", "Cliente", "w-44"], ["nif", "NIF", "w-28"], ["iban", "IBAN", "w-56"], ["mandate", "Mandato", "w-32"], ["mandate_date", "F. mandato", "w-36", "date"],
  ["amount", "Total (IVA incl.)", "w-24", "number"]];
const ivaValue = (l) => (l.vat_exempt ? "exento" : String(Number(l.iva_rate ?? 21)));

const Totals = ({ r, lines }) => {
  const t = lines.reduce((s, l) => { const x = lineTax(l); return { base: s.base + x.base, iva: s.iva + x.iva, total: s.total + x.total }; }, { base: 0, iva: 0, total: 0 });
  return (
    <div className="text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1 items-center" data-testid="remesa-totals">
      <span>{lines.length} recibos</span>
      <span>Base imponible <b className="tabular" data-testid="remesa-base-total">{eur(t.base)}</b></span>
      <span>+ IVA <b className="tabular" data-testid="remesa-iva-total">{eur(t.iva)}</b></span>
      <span>= Total <b className="tabular text-slate-900" data-testid="remesa-total">{eur(t.total)}</b></span>
      <span className="text-emerald-700">cobrado {eur(r.paid_total)}</span>
      <span className="text-amber-700" data-testid="remesa-pending-total">pendiente {eur(r.pending_total)}</span>
      <span>{r.invoiced} facturados</span>
      {r.warnings > 0 && <span className="text-amber-700"><AlertTriangle className="inline w-3.5 h-3.5" /> {r.warnings} con avisos</span>}
    </div>
  );
};

const ResultDialog = ({ res, onClose }) => (
  <Dialog open={!!res} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-lg" data-testid="invoice-result-dialog">
      <DialogHeader><DialogTitle>Resultado de la emisión</DialogTitle>
        <DialogDescription>{res?.created} factura(s) nuevas · {res?.skipped} ya estaban facturadas{res?.errors.length ? ` · ${res.errors.length} cliente(s) sin factura` : ""}</DialogDescription></DialogHeader>
      {res?.errors.length > 0 && <ul className="text-sm space-y-1.5 max-h-72 overflow-y-auto" data-testid="invoice-result-errors">
        {res.errors.map((e) => <li key={e} className="flex gap-2 text-amber-800"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{e}</li>)}</ul>}
      {res?.errors.length > 0 && <p className="text-xs text-slate-500">Corrige los datos de esas líneas, guarda y vuelve a pulsar «Emitir facturas»: solo se crearán las que faltan.</p>}
      <Button onClick={onClose} data-testid="invoice-result-close">Entendido</Button>
    </DialogContent>
  </Dialog>
);

export const RemesaEditor = ({ id, debtors, onChanged, onNeedIssuer }) => {
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);
  const [res, setRes] = useState(null);
  useEffect(() => { setR(null); api.get(`/gestoria/remesas/${id}`).then((x) => { setR(x.data); setDirty(false); }); }, [id]);
  if (!r) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;
  const upd = (patch) => { setR({ ...r, ...patch }); setDirty(true); };
  const setLine = (i, patch) => upd({ lines: r.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const setIva = (i, v) => setLine(i, v === "exento" ? { vat_exempt: true, iva_rate: 0 } : { vat_exempt: false, iva_rate: Number(v) });
  const move = (i, d) => { const ls = [...r.lines]; const j = i + d; if (j < 0 || j >= ls.length) return; [ls[i], ls[j]] = [ls[j], ls[i]]; upd({ lines: ls }); };
  const sortBy = (k) => upd({ lines: [...r.lines].sort((a, b) => (k === "amount" ? b.amount - a.amount : String(a[k]).localeCompare(String(b[k])))) });
  const addDebtor = (did) => { const d = debtors.find((x) => x.id === did); if (d) upd({ lines: [...r.lines, { ...blank(), ...d, id: "", debtor_id: d.id }] }); };
  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (e) {
      let detail = e.response?.data?.detail;
      if (detail instanceof Blob) { try { detail = JSON.parse(await detail.text()).detail; } catch { detail = "Error"; } }
      const msg = formatApiErrorDetail(detail);
      if (msg.startsWith("DATOS_FISCALES:")) { toast.error(msg.replace("DATOS_FISCALES: ", "")); onNeedIssuer?.(); }
      else toast.error(msg, { duration: 10000 });
    } finally { setBusy(""); }
  };
  const persist = async () => {
    const { data } = await api.put(`/gestoria/remesas/${id}`, { name: r.name, charge_date: r.charge_date, reference: r.reference, lines: r.lines.map((l) => ({ ...l, amount: Number(l.amount || 0), iva_rate: Number(l.iva_rate ?? 21), vat_exempt: !!l.vat_exempt })) });
    setR(data); setDirty(false); onChanged(); return data;
  };
  const save = () => run("save", async () => { await persist(); toast.success("Remesa guardada"); });
  const invoices = () => run("inv", async () => {
    if (dirty) await persist();
    const { data } = await api.post(`/gestoria/remesas/${id}/facturas`);
    setR(data.remesa); onChanged(); setRes(data);
  });
  const doc = (key, url, name) => run(key, async () => { if (dirty) await persist(); await downloadFile(url, name); });
  const status = (s) => run("st", async () => { await api.post(`/gestoria/remesas/${id}/estado`, { status: s }); setR({ ...r, status: s }); onChanged(); });
  const paid = (l) => run("p", async () => { const { data } = await api.post(`/gestoria/remesas/${id}/lineas/${l.id}/cobro`, { paid: !l.paid }); setR(data); onChanged(); });
  const dup = () => run("dup", async () => { const n = window.prompt("Nombre de la nueva remesa", `${r.name} (copia)`); if (!n) return; await api.post(`/gestoria/remesas/${id}/duplicar`, { name: n, charge_date: "" }); toast.success("Remesa duplicada"); onChanged(); });
  const spin = (k, Icon) => (busy === k ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Icon className="w-4 h-4 mr-1" />);
  return (
    <div className="bg-white border border-slate-200 rounded-xl min-w-0" data-testid="remesa-editor">
      <div className="p-4 border-b border-slate-100 grid sm:grid-cols-4 gap-3">
        <Input value={r.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Nombre" data-testid="remesa-name" />
        <Input type="date" value={r.charge_date || ""} onChange={(e) => upd({ charge_date: e.target.value })} data-testid="remesa-charge-date" />
        <Input value={r.reference || ""} onChange={(e) => upd({ reference: e.target.value })} placeholder="Referencia" data-testid="remesa-reference" />
        <Select value={r.status} onValueChange={status}><SelectTrigger data-testid="remesa-status"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3 border-b border-slate-100">
        <Totals r={r} lines={r.lines} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={!dirty || !!busy} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="remesa-save">{spin("save", Save)}Guardar</Button>
          <Button size="sm" variant="outline" onClick={invoices} disabled={!!busy} data-testid="remesa-invoices">{spin("inv", FileText)}Emitir facturas</Button>
          <Button size="sm" variant="outline" onClick={() => doc("rec", `/gestoria/remesas/${id}/recibos`, `Recibos ${r.name}.pdf`)} disabled={!!busy} data-testid="remesa-receipts-pdf">{spin("rec", Receipt)}Recibos PDF</Button>
          <Button size="sm" variant="outline" onClick={() => doc("xml", `/gestoria/remesas/${id}/sepa-xml`, `${r.name}_pain008.xml`)} disabled={!!busy} data-testid="remesa-sepa-xml">{spin("xml", FileCode2)}XML SEPA</Button>
          <Button size="sm" variant="outline" onClick={() => doc("x", `/gestoria/remesas/${id}/exportar?formato=xlsx`, `${r.name}.xlsx`)} disabled={!!busy} data-testid="remesa-export-xlsx"><Download className="w-4 h-4 mr-1" />Excel</Button>
          <Button size="sm" variant="outline" onClick={() => doc("c", `/gestoria/remesas/${id}/exportar?formato=csv`, `${r.name}.csv`)} disabled={!!busy} data-testid="remesa-export-csv"><Download className="w-4 h-4 mr-1" />CSV</Button>
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
        <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-2 py-2">Nº</th>{COLS.map(([k, l]) => <th key={k} className="px-2 py-2 text-left whitespace-nowrap">{l}</th>)}
          <th className="px-2 py-2 text-left">IVA</th><th className="px-2 py-2 text-right">Base</th><th className="px-2 py-2 text-right">Cuota IVA</th><th className="px-2 py-2 text-left">Concepto</th>
          <th className="px-2 py-2 text-left">Factura</th><th className="px-2 py-2 text-left">Cobro</th><th /></tr></thead>
        <tbody>{r.lines.map((l, i) => {
          const t = lineTax(l);
          const locked = !!l.invoice_id;
          return (
            <tr key={l.id || `n${i}`} className={`border-t border-slate-100 ${l.paid ? "bg-emerald-50/40" : ""}`} data-testid={`remesa-line-${i}`}>
              <td className="px-2 text-slate-400 text-xs whitespace-nowrap">{i + 1}<div className="flex"><button onClick={() => move(i, -1)}><ArrowUp className="w-3 h-3" /></button><button onClick={() => move(i, 1)}><ArrowDown className="w-3 h-3" /></button></div></td>
              {COLS.map(([k, , w, type]) => (
                <td key={k} className="px-1 py-1"><Input type={type || "text"} value={l[k] ?? ""} disabled={k === "amount" && locked} onChange={(e) => setLine(i, { [k]: e.target.value })}
                  className={`h-8 text-xs ${w} ${l.warnings?.some((x) => x.toLowerCase().includes(k === "name" ? "nombre" : k)) ? "border-amber-400" : ""}`} data-testid={`line-${k}-${i}`} /></td>
              ))}
              <td className="px-1 py-1"><select value={ivaValue(l)} disabled={locked} onChange={(e) => setIva(i, e.target.value)} className="h-8 text-xs border border-slate-200 rounded-md px-1 w-24 bg-white" data-testid={`line-iva-${i}`}>
                {["21", "10", "4", "0"].map((v) => <option key={v} value={v}>{v}%</option>)}<option value="exento">Exento</option></select></td>
              <td className="px-2 text-xs text-right tabular whitespace-nowrap" data-testid={`line-base-${i}`}>{eur(t.base)}</td>
              <td className="px-2 text-xs text-right tabular whitespace-nowrap" data-testid={`line-cuota-${i}`}>{l.vat_exempt ? <span className="text-slate-400">Exento</span> : eur(t.iva)}</td>
              <td className="px-1 py-1"><Input value={l.concept ?? ""} onChange={(e) => setLine(i, { concept: e.target.value })} className="h-8 text-xs w-56" data-testid={`line-concept-${i}`} /></td>
              <td className="px-2 text-xs whitespace-nowrap">{locked
                ? <button className="text-[#0052FF] hover:underline" onClick={() => doc(`f${i}`, `/invoices/${l.invoice_id}/pdf`, `Factura ${l.invoice_number}.pdf`)} data-testid={`line-invoice-pdf-${i}`}>{l.invoice_number}</button>
                : <span className="text-slate-400">—</span>}</td>
              <td className="px-2"><button onClick={() => paid(l)} disabled={!l.id} className={`text-xs flex items-center gap-1 whitespace-nowrap ${l.paid ? "text-emerald-700" : "text-slate-400 hover:text-[#0052FF]"}`} data-testid={`line-paid-${i}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />{l.paid ? `Cobrado ${l.paid_date || ""}` : "Pendiente"}</button></td>
              <td className="px-2 whitespace-nowrap">
                {l.id && <button title="Recibo PDF" className="mr-2" onClick={() => doc(`r${i}`, `/gestoria/remesas/${id}/recibos?line_id=${l.id}`, `Recibo ${l.name || i + 1}.pdf`)} data-testid={`line-receipt-${i}`}><Receipt className="w-4 h-4 text-slate-400 hover:text-[#0052FF]" /></button>}
                {!locked && <button onClick={() => upd({ lines: r.lines.filter((_, j) => j !== i) })} data-testid={`line-delete-${i}`}><Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" /></button>}
              </td>
            </tr>
          );
        })}</tbody></table>
        {!r.lines.length && <div className="text-center text-slate-400 py-10 text-sm">La remesa está vacía. Añade deudores o líneas.</div>}</div>
      <ResultDialog res={res} onClose={() => setRes(null)} />
    </div>
  );
};
