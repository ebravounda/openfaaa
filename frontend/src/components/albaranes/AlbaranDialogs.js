import { useState } from "react";
import { toast } from "sonner";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, Eye } from "lucide-react";

const IVA = [["21", "IVA 21%"], ["10", "IVA 10%"], ["4", "IVA 4%"], ["0", "IVA 0%"], ["exento", "Exento"], ["no_sujeto", "No sujeto"]];
export const emptyLine = () => ({ description: "", detail: "", quantity: 1, unit_price: 0, discount: 0, iva_sel: "21" });
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const lineNet = (it) => r2((Number(it.quantity) || 0) * (Number(it.unit_price) || 0) * (1 - (Number(it.discount) || 0) / 100));
const toTax = (s) => (["exento", "no_sujeto"].includes(s) ? { iva_type: s, iva_rate: 0 } : { iva_type: "general", iva_rate: Number(s) });
const toSel = (i) => (i.iva_type && i.iva_type !== "general" ? i.iva_type : String(i.iva_rate ?? 21));

export const emptyAlbaran = () => {
  const today = new Date().toISOString().slice(0, 10);
  return { issue_date: today, delivery_date: today, client: { name: "", nif: "", address: "", email: "" }, delivery_address: "", line_items: [emptyLine()], show_prices: true, notes: "" };
};
export const albaranToForm = (a) => ({
  issue_date: a.issue_date, delivery_date: a.delivery_date || "", delivery_address: a.delivery_address || "", show_prices: a.show_prices !== false, notes: a.notes || "",
  client: { name: a.client?.name || "", nif: a.client?.nif || "", address: a.client?.address || "", email: a.client?.email || "" },
  line_items: a.line_items?.length ? a.line_items.map((i) => ({ description: i.description, detail: i.detail || "", quantity: i.quantity, unit_price: i.unit_price, discount: i.discount || 0, iva_sel: toSel(i) })) : [emptyLine()],
});
export const formToPayload = (f) => ({
  ...f, line_items: f.line_items.map((i) => ({ description: i.description, detail: i.detail || "", quantity: Number(i.quantity), unit_price: Number(i.unit_price), discount: Number(i.discount) || 0, ...toTax(i.iva_sel) })),
});

const Totals = ({ items }) => {
  let base = 0, iva = 0;
  items.forEach((it) => { const n = lineNet(it); base += n; const t = toTax(it.iva_sel); iva += (n * t.iva_rate) / 100; });
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-1" data-testid="albaran-totals">
      <div className="flex justify-between text-slate-500"><span>Base imponible</span><span className="tabular">{eur(base)}</span></div>
      <div className="flex justify-between text-slate-500"><span>IVA</span><span className="tabular">{eur(iva)}</span></div>
      <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-1.5 mt-1.5"><span>Total</span><span className="tabular" data-testid="albaran-total">{eur(base + iva)}</span></div>
    </div>
  );
};

const Lines = ({ form, setForm }) => {
  const upd = (i, k, v) => setForm({ ...form, line_items: form.line_items.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Productos / servicios entregados</div>
        <Button variant="outline" size="sm" onClick={() => setForm({ ...form, line_items: [...form.line_items, emptyLine()] })} data-testid="albaran-add-line"><Plus className="w-3.5 h-3.5 mr-1" /> Añadir línea</Button>
      </div>
      {form.line_items.map((it, i) => (
        <div key={i} className="rounded-lg border border-slate-100 p-3 space-y-2" data-testid={`albaran-line-${i}`}>
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-12 sm:col-span-4 space-y-1"><Label className="text-xs">Concepto</Label><Input value={it.description} onChange={(e) => upd(i, "description", e.target.value)} data-testid={`albaran-line-desc-${i}`} /></div>
            <div className="col-span-3 sm:col-span-2 space-y-1"><Label className="text-xs">Cant.</Label><Input type="number" min="0" value={it.quantity} onChange={(e) => upd(i, "quantity", e.target.value)} data-testid={`albaran-line-qty-${i}`} /></div>
            <div className="col-span-4 sm:col-span-2 space-y-1"><Label className="text-xs">Precio (€)</Label><Input type="number" step="0.01" value={it.unit_price} onChange={(e) => upd(i, "unit_price", e.target.value)} data-testid={`albaran-line-price-${i}`} /></div>
            <div className="col-span-5 sm:col-span-3 space-y-1"><Label className="text-xs">Impuesto</Label>
              <Select value={it.iva_sel} onValueChange={(v) => upd(i, "iva_sel", v)}><SelectTrigger data-testid={`albaran-line-iva-${i}`}><SelectValue /></SelectTrigger>
                <SelectContent>{IVA.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
            <div className="col-span-12 sm:col-span-1 flex justify-end"><Button variant="ghost" size="icon" disabled={form.line_items.length === 1} onClick={() => setForm({ ...form, line_items: form.line_items.filter((_, j) => j !== i) })} className="h-9 w-9 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button></div>
          </div>
          <div className="flex items-center gap-3">
            <Input className="text-sm h-8 flex-1" placeholder="Detalle, lote, nº de serie… (opcional)" value={it.detail} onChange={(e) => upd(i, "detail", e.target.value)} data-testid={`albaran-line-detail-${i}`} />
            <span className="text-sm text-slate-500 whitespace-nowrap">{eur(lineNet(it))}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export const AlbaranDialog = ({ open, onClose, editing, number, form, setForm, clients, onSaved, onPreview }) => {
  const [saving, setSaving] = useState(false);
  const setC = (k, v) => setForm({ ...form, client: { ...form.client, [k]: v } });
  const pick = (id) => { const c = clients.find((x) => x.id === id); if (c) setForm({ ...form, client: { name: c.name, nif: c.nif, address: c.address, email: c.email }, delivery_address: form.delivery_address || c.address || "" }); };
  const save = async () => {
    if (!form.client.name.trim()) return toast.error("Introduce el nombre del cliente");
    if (form.line_items.some((i) => !i.description.trim())) return toast.error("Todas las líneas necesitan concepto");
    setSaving(true);
    try {
      if (editing) await api.put(`/albaranes/${editing}`, formToPayload(form)); else await api.post("/albaranes", formToPayload(form));
      toast.success(editing ? "Albarán actualizado" : "Albarán creado"); onSaved();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="albaran-dialog">
        <DialogHeader><DialogTitle className="font-display">{editing ? "Editar albarán" : "Nuevo albarán"}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          {number && <div className="text-sm text-slate-500" data-testid="albaran-next-number">Número de albarán: <span className="font-mono font-semibold text-slate-800">{number}</span></div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} data-testid="albaran-date" /></div>
            <div className="space-y-2"><Label>Fecha de entrega</Label><Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} data-testid="albaran-delivery-date" /></div>
            {clients.length > 0 && <div className="space-y-2"><Label>Cliente guardado</Label>
              <Select onValueChange={pick}><SelectTrigger data-testid="albaran-pick-client"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>}
          </div>
          <div className="border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Cliente</Label><Input value={form.client.name} onChange={(e) => setC("name", e.target.value)} data-testid="albaran-client-name" /></div>
            <div className="space-y-2"><Label>NIF / CIF</Label><Input value={form.client.nif} onChange={(e) => setC("nif", e.target.value)} data-testid="albaran-client-nif" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.client.email} onChange={(e) => setC("email", e.target.value)} data-testid="albaran-client-email" /></div>
            <div className="space-y-2"><Label>Dirección fiscal</Label><Input value={form.client.address} onChange={(e) => setC("address", e.target.value)} data-testid="albaran-client-address" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Dirección de entrega</Label><Input value={form.delivery_address} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} placeholder="Si es distinta de la fiscal" data-testid="albaran-delivery-address" /></div>
          </div>
          <Lines form={form} setForm={setForm} />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><Checkbox checked={form.show_prices} onCheckedChange={(v) => setForm({ ...form, show_prices: !!v })} data-testid="albaran-show-prices" /> Mostrar precios e importes en el PDF</label>
          <div className="space-y-2"><Label>Observaciones</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="albaran-notes" /></div>
          <Totals items={form.line_items} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onPreview} data-testid="albaran-preview"><Eye className="w-4 h-4 mr-1.5" />Vista previa</Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="albaran-save">{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editing ? "Guardar cambios" : "Crear albarán"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const FacturarDialog = ({ items, onClose, onDone }) => {
  const sameClient = items && new Set(items.map((a) => (a.client?.nif || a.client?.name || "").toUpperCase())).size === 1;
  const [mode, setMode] = useState("single");
  const [irpf, setIrpf] = useState("0");
  const [re, setRe] = useState(false);
  const [busy, setBusy] = useState(false);
  const effMode = items?.length > 1 && sameClient ? mode : "each";
  const go = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/albaranes/facturar", { ids: items.map((a) => a.id), mode: effMode, irpf_rate: Number(irpf), recargo_equivalencia: re });
      toast.success(data.invoices.length === 1 ? `Factura ${data.invoices[0].number} creada` : `${data.invoices.length} facturas creadas: ${data.invoices.map((i) => i.number).join(", ")}`);
      onDone();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!items} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="facturar-dialog">
        <DialogHeader><DialogTitle className="font-display">Facturar {items?.length} albarán{items?.length > 1 ? "es" : ""}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="text-slate-500">{items?.map((a) => a.number).join(", ")}</div>
          {items?.length > 1 && (
            <div className="space-y-2" data-testid="facturar-mode">
              <label className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer ${effMode === "single" ? "border-[#0052FF] bg-[#0052FF]/5" : "border-slate-200"} ${!sameClient ? "opacity-50 cursor-not-allowed" : ""}`}>
                <input type="radio" disabled={!sameClient} checked={effMode === "single"} onChange={() => setMode("single")} data-testid="facturar-mode-single" />
                <span><b>Una sola factura</b> con todos los albaranes{!sameClient && <span className="block text-xs text-amber-700">Solo si son del mismo cliente</span>}</span></label>
              <label className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer ${effMode === "each" ? "border-[#0052FF] bg-[#0052FF]/5" : "border-slate-200"}`}>
                <input type="radio" checked={effMode === "each"} onChange={() => setMode("each")} data-testid="facturar-mode-each" />
                <span><b>Una factura por cada albarán</b></span></label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Retención IRPF</Label>
              <Select value={irpf} onValueChange={setIrpf}><SelectTrigger data-testid="facturar-irpf"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="0">Sin retención</SelectItem><SelectItem value="7">IRPF 7%</SelectItem><SelectItem value="15">IRPF 15%</SelectItem></SelectContent></Select></div>
            <label className="flex items-center gap-2 mt-6 cursor-pointer"><Checkbox checked={re} onCheckedChange={(v) => setRe(!!v)} data-testid="facturar-re" /> Recargo equiv.</label>
          </div>
          <p className="text-xs text-slate-500">Se emitirá{effMode === "each" && items?.length > 1 ? "n las facturas" : " la factura"} con fecha de hoy y los albaranes quedarán como facturados.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={go} disabled={busy} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="facturar-confirm">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Emitir factura{effMode === "each" && items?.length > 1 ? "s" : ""}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
