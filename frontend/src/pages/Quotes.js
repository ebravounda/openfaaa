import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { API, eur, formatApiErrorDetail } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, FileSignature, Mail, Download, Loader2, Pencil, Search, FileCheck2,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

const Tip = ({ label, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

const LINE_IVA_OPTIONS = [
  { v: "21", l: "IVA 21%" },
  { v: "10", l: "IVA 10%" },
  { v: "4", l: "IVA 4%" },
  { v: "0", l: "IVA 0%" },
  { v: "exento", l: "Exento" },
  { v: "no_sujeto", l: "No sujeto" },
  { v: "suplido", l: "Suplido" },
];
const IRPF_OPTIONS = [
  { v: "0", l: "Sin retención" },
  { v: "7", l: "IRPF 7% (nuevos autónomos)" },
  { v: "15", l: "IRPF 15% (general)" },
];
const RE_MAP = { 21: 5.2, 10: 1.4, 4: 0.5, 0: 0 };
const STATUS_OPTIONS = [
  { v: "borrador", l: "Borrador" },
  { v: "enviado", l: "Enviado" },
  { v: "aceptado", l: "Aceptado" },
  { v: "rechazado", l: "Rechazado" },
];
const STATUS_BADGE = {
  borrador: "bg-slate-100 text-slate-600",
  enviado: "bg-blue-100 text-blue-700",
  aceptado: "bg-emerald-100 text-emerald-700",
  rechazado: "bg-red-100 text-red-700",
  facturado: "bg-purple-100 text-purple-700",
};
const STATUS_LABEL = { borrador: "Borrador", enviado: "Enviado", aceptado: "Aceptado", rechazado: "Rechazado", facturado: "Facturado" };

const emptyLine = () => ({ description: "", detail: "", quantity: 1, unit_price: 0, discount: 0, iva_sel: "21" });
const lineToSel = (i) => (i.iva_type && i.iva_type !== "general") ? i.iva_type : String(i.iva_rate ?? 21);
const selToTax = (sel) => (["exento", "no_sujeto", "suplido"].includes(sel))
  ? { iva_type: sel, iva_rate: 0 }
  : { iva_type: "general", iva_rate: Number(sel) };
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const emptyForm = () => ({
  issue_date: new Date().toISOString().slice(0, 10),
  valid_until: "",
  client: { name: "", nif: "", address: "", email: "" },
  line_items: [emptyLine()],
  irpf_rate: "0",
  recargo_equivalencia: false,
  global_discount: 0,
  notes: "",
  series: "",
  save_client: false,
});

export default function Quotes() {
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [nextNumber, setNextNumber] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [convertingId, setConvertingId] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/quotes").then((r) => setQuotes(r.data)).finally(() => setLoading(false));
  };
  const loadClients = () => api.get("/contacts?kind=client").then((r) => setClients(r.data));
  useEffect(() => { load(); loadClients(); }, []);

  const lookupNif = async () => {
    const nif = form.client.nif.trim();
    if (!nif) return toast.error("Introduce el NIF/CIF a buscar");
    setLookingUp(true);
    try {
      const { data } = await api.get(`/lookup/nif?nif=${encodeURIComponent(nif)}`);
      if (!data.valid) return toast.error("NIF/CIF no válido según VIES");
      if (data.name) {
        setForm((f) => ({ ...f, client: { ...f.client, name: data.name, address: data.address || f.client.address, email: data.email || f.client.email } }));
        toast.success(`Encontrado: ${data.name}`);
      } else {
        toast.success("NIF/CIF válido. Completa el nombre a mano.");
      }
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLookingUp(false); }
  };

  const gd = Number(form.global_discount) || 0;
  const lineNet = (it) => {
    const gross = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    if ((it.iva_sel ?? "21") === "suplido") return round2(gross);
    const ld = Number(it.discount) || 0;
    return round2(round2(gross * (1 - ld / 100)) * (1 - gd / 100));
  };
  const calc = (() => {
    const bd = {};
    let baseGeneral = 0, baseExenta = 0, baseNoSujeta = 0, suplidos = 0, subtotal = 0, discountTotal = 0;
    form.line_items.forEach((it) => {
      const gross = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      subtotal += gross;
      const sel = it.iva_sel ?? "21";
      if (sel === "suplido") { suplidos += gross; return; }
      const net = lineNet(it);
      discountTotal += (gross - net);
      if (sel === "no_sujeto") { baseNoSujeta += net; return; }
      if (sel === "exento") { baseExenta += net; return; }
      const r = Number(sel); baseGeneral += net; bd[r] = (bd[r] || 0) + net;
    });
    let ivaAmount = 0, reAmount = 0;
    const breakdown = Object.keys(bd).map(Number).sort((a, b) => b - a).map((r) => {
      const b = bd[r]; const cuota = (b * r) / 100;
      const reRate = form.recargo_equivalencia ? (RE_MAP[r] || 0) : 0;
      const reCuota = (b * reRate) / 100;
      ivaAmount += cuota; reAmount += reCuota;
      return { rate: r, base: b, cuota, reRate, reCuota };
    });
    const base = baseGeneral + baseExenta + baseNoSujeta;
    const irpfBase = baseGeneral + baseExenta;
    const irpfAmount = (irpfBase * Number(form.irpf_rate)) / 100;
    const total = base + suplidos + ivaAmount + reAmount - irpfAmount;
    return { subtotal, discountTotal, base, suplidos, breakdown, ivaAmount, reAmount, irpfAmount, total };
  })();

  const updateItem = (idx, field, value) => {
    const items = [...form.line_items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, line_items: items });
  };
  const addItem = () => setForm({ ...form, line_items: [...form.line_items, emptyLine()] });
  const removeItem = (idx) => setForm({ ...form, line_items: form.line_items.filter((_, i) => i !== idx) });
  const pickClient = (id) => {
    const c = clients.find((x) => x.id === id);
    if (c) setForm((f) => ({ ...f, client: { name: c.name, nif: c.nif, address: c.address, email: c.email } }));
  };

  const openNew = async () => {
    setEditingId(null); setNextNumber("");
    const base = emptyForm();
    const d = new Date(base.issue_date); d.setDate(d.getDate() + 30);
    base.valid_until = d.toISOString().slice(0, 10);
    try {
      const { data } = await api.get("/quotes/next-number", { params: { issue_date: base.issue_date } });
      setNextNumber(data.number); base.series = data.series;
    } catch (e) { /* noop */ }
    setForm(base); setOpen(true);
  };

  const openEdit = (q) => {
    setEditingId(q.id); setNextNumber(q.number);
    setForm({
      issue_date: q.issue_date,
      valid_until: q.valid_until || "",
      client: { name: q.client?.name || "", nif: q.client?.nif || "", address: q.client?.address || "", email: q.client?.email || "" },
      line_items: q.line_items?.length ? q.line_items.map((i) => ({ description: i.description, detail: i.detail || "", quantity: i.quantity, unit_price: i.unit_price, discount: i.discount || 0, iva_sel: lineToSel(i) })) : [emptyLine()],
      irpf_rate: String(q.irpf_rate || 0),
      recargo_equivalencia: !!q.recargo_equivalencia,
      global_discount: q.global_discount || 0,
      notes: q.notes || "",
      series: q.series || "",
      save_client: false,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.client.name.trim()) return toast.error("Introduce el nombre del cliente");
    if (form.line_items.some((i) => !i.description.trim())) return toast.error("Todas las líneas necesitan descripción");
    setSaving(true);
    const payload = {
      issue_date: form.issue_date,
      valid_until: form.valid_until,
      client: form.client,
      line_items: form.line_items.map((i) => ({ description: i.description, detail: i.detail || "", quantity: Number(i.quantity), unit_price: Number(i.unit_price), discount: Number(i.discount) || 0, ...selToTax(i.iva_sel ?? "21") })),
      irpf_rate: Number(form.irpf_rate),
      recargo_equivalencia: !!form.recargo_equivalencia,
      global_discount: Number(form.global_discount) || 0,
      notes: form.notes,
      series: form.series,
    };
    try {
      if (editingId) {
        await api.put(`/quotes/${editingId}`, payload);
        toast.success("Presupuesto actualizado");
      } else {
        await api.post("/quotes", payload);
        if (form.save_client) { try { await api.post("/contacts", { ...form.client, kind: "client" }); loadClients(); } catch (e) {} }
        toast.success("Presupuesto creado");
      }
      setOpen(false); setForm(emptyForm()); setEditingId(null); load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const openPdf = (q) => window.open(`${API}/quotes/${q.id}/pdf`, "_blank");

  const sendEmail = async (q) => {
    if (!q.client?.email) return toast.error("El cliente no tiene email registrado");
    setSendingId(q.id);
    try {
      await api.post(`/quotes/${q.id}/send-email`);
      toast.success(`Presupuesto enviado a ${q.client.email}`);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSendingId(null); }
  };

  const setStatus = async (q, status) => {
    try { await api.patch(`/quotes/${q.id}/status`, { status }); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const convert = async (q) => {
    if (!window.confirm(`¿Convertir el presupuesto ${q.number} en factura? Se generará una factura definitiva con la fecha de hoy.`)) return;
    setConvertingId(q.id);
    try {
      const { data } = await api.post(`/quotes/${q.id}/convert`);
      toast.success(`Factura ${data.number} creada desde el presupuesto`);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setConvertingId(null); }
  };

  const remove = async (q) => {
    if (!window.confirm(`¿Eliminar el presupuesto ${q.number}?`)) return;
    await api.delete(`/quotes/${q.id}`);
    toast.success("Presupuesto eliminado");
    load();
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Presupuestos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Crea presupuestos, envíalos a tus clientes y conviértelos en factura</p>
        </div>
        <Button onClick={openNew} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="new-quote-button">
          <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} /> Nuevo presupuesto
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
        ) : quotes.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 m-5 rounded-lg py-14 text-center" data-testid="quotes-empty">
            <FileSignature className="w-12 h-12 mx-auto text-slate-300" strokeWidth={1.25} />
            <p className="text-slate-500 mt-3">Aún no has creado ningún presupuesto.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nº</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id} data-testid={`quote-row-${q.number}`}>
                  <TableCell className="font-mono text-sm font-medium text-slate-900">{q.number}</TableCell>
                  <TableCell className="text-sm text-slate-600 tabular">{q.issue_date}</TableCell>
                  <TableCell className="text-sm font-medium text-slate-900">{q.client?.name}</TableCell>
                  <TableCell className="text-right text-sm tabular">{eur(q.base)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular">{eur(q.total)}</TableCell>
                  <TableCell>
                    {q.status === "facturado" ? (
                      <Badge className={`${STATUS_BADGE.facturado} hover:${STATUS_BADGE.facturado} rounded-full`} data-testid={`quote-status-${q.number}`}>
                        Facturado{q.invoice_number ? ` · ${q.invoice_number}` : ""}
                      </Badge>
                    ) : (
                      <Select value={q.status || "borrador"} onValueChange={(v) => setStatus(q, v)}>
                        <SelectTrigger className={`h-7 w-[130px] rounded-full border-0 text-xs font-medium ${STATUS_BADGE[q.status] || STATUS_BADGE.borrador}`} data-testid={`quote-status-${q.number}`}>
                          <SelectValue>{STATUS_LABEL[q.status] || "Borrador"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider delayDuration={150}>
                      <div className="flex items-center justify-end gap-0.5">
                        {q.status !== "facturado" && (
                          <Tip label="Convertir en factura">
                            <Button variant="ghost" size="icon" onClick={() => convert(q)} disabled={convertingId === q.id} data-testid={`quote-convert-${q.number}`} className="h-8 w-8 text-slate-500 hover:text-purple-600">
                              {convertingId === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" strokeWidth={1.5} />}
                            </Button>
                          </Tip>
                        )}
                        {q.status !== "facturado" && (
                          <Tip label="Editar presupuesto">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(q)} data-testid={`quote-edit-${q.number}`} className="h-8 w-8 text-slate-500 hover:text-[#0052FF]"><Pencil className="w-4 h-4" strokeWidth={1.5} /></Button>
                          </Tip>
                        )}
                        <Tip label="Ver / descargar PDF">
                          <Button variant="ghost" size="icon" onClick={() => openPdf(q)} data-testid={`quote-pdf-${q.number}`} className="h-8 w-8 text-slate-500 hover:text-slate-900"><Download className="w-4 h-4" strokeWidth={1.5} /></Button>
                        </Tip>
                        <Tip label="Enviar por email al cliente">
                          <Button variant="ghost" size="icon" onClick={() => sendEmail(q)} disabled={sendingId === q.id} data-testid={`quote-email-${q.number}`} className="h-8 w-8 text-slate-500 hover:text-[#0052FF]">
                            {sendingId === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" strokeWidth={1.5} />}
                          </Button>
                        </Tip>
                        <Tip label="Eliminar presupuesto">
                          <Button variant="ghost" size="icon" onClick={() => remove(q)} data-testid={`quote-delete-${q.number}`} className="h-8 w-8 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></Button>
                        </Tip>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="quote-dialog">
          <DialogHeader><DialogTitle className="font-display">{editingId ? "Editar presupuesto" : "Nuevo presupuesto"}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {nextNumber && (
              <div className="text-sm text-slate-500" data-testid="quote-next-number">Número de presupuesto: <span className="font-mono font-semibold text-slate-800">{nextNumber}</span></div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} data-testid="quote-date" /></div>
              <div className="space-y-2"><Label>Válido hasta</Label><Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} data-testid="quote-valid-until" /></div>
              {clients.length > 0 && (
                <div className="space-y-2">
                  <Label>Cliente guardado</Label>
                  <Select onValueChange={pickClient}>
                    <SelectTrigger data-testid="pick-client"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg p-4 space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Datos del cliente</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nombre / Razón social</Label><Input value={form.client.name} onChange={(e) => setForm({ ...form, client: { ...form.client, name: e.target.value } })} data-testid="client-name" /></div>
                <div className="space-y-2"><Label>NIF / CIF</Label>
                  <div className="flex gap-2">
                    <Input value={form.client.nif} onChange={(e) => setForm({ ...form, client: { ...form.client, nif: e.target.value } })} placeholder="B12345678" data-testid="client-nif" />
                    <Button type="button" variant="outline" onClick={lookupNif} disabled={lookingUp} className="border-slate-200 shrink-0" data-testid="lookup-nif" title="Buscar datos por NIF/CIF (VIES)">
                      {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" strokeWidth={1.5} />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.client.email} onChange={(e) => setForm({ ...form, client: { ...form.client, email: e.target.value } })} data-testid="client-email" /></div>
                <div className="space-y-2"><Label>Dirección</Label><Input value={form.client.address} onChange={(e) => setForm({ ...form, client: { ...form.client, address: e.target.value } })} data-testid="client-address" /></div>
              </div>
              {!editingId && (
                <div className="flex items-center gap-2">
                  <Checkbox id="save_client_q" checked={form.save_client} onCheckedChange={(v) => setForm({ ...form, save_client: !!v })} data-testid="save-client-checkbox" />
                  <label htmlFor="save_client_q" className="text-sm text-slate-600 cursor-pointer">Guardar como cliente para reutilizar</label>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Líneas</div>
                <Button variant="outline" size="sm" onClick={addItem} className="border-slate-200" data-testid="add-line-item"><Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} /> Añadir línea</Button>
              </div>
              {form.line_items.map((it, idx) => (
                <div key={idx} className="rounded-lg border border-slate-100 p-3 space-y-2" data-testid={`line-item-${idx}`}>
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4 space-y-1">{idx === 0 && <Label className="text-xs">Concepto</Label>}<Input value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} data-testid={`line-desc-${idx}`} /></div>
                    <div className="col-span-1 space-y-1">{idx === 0 && <Label className="text-xs">Cant.</Label>}<Input type="number" step="0.01" value={it.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} data-testid={`line-qty-${idx}`} /></div>
                    <div className="col-span-2 space-y-1">{idx === 0 && <Label className="text-xs">Precio (€)</Label>}<Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(idx, "unit_price", e.target.value)} data-testid={`line-price-${idx}`} /></div>
                    <div className="col-span-1 space-y-1">{idx === 0 && <Label className="text-xs">Dto.%</Label>}<Input type="number" step="0.01" min="0" max="100" value={it.discount} onChange={(e) => updateItem(idx, "discount", e.target.value)} data-testid={`line-discount-${idx}`} /></div>
                    <div className="col-span-3 space-y-1">{idx === 0 && <Label className="text-xs">Impuesto</Label>}
                      <Select value={it.iva_sel ?? "21"} onValueChange={(v) => updateItem(idx, "iva_sel", v)}>
                        <SelectTrigger data-testid={`line-iva-${idx}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{LINE_IVA_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={form.line_items.length === 1} className="h-9 w-9 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></Button></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input className="text-sm h-8 flex-1" placeholder="Descripción (opcional)" value={it.detail || ""} onChange={(e) => updateItem(idx, "detail", e.target.value)} data-testid={`line-detail-${idx}`} />
                    <div className="text-sm text-slate-500 whitespace-nowrap">Total: <span className="font-medium text-slate-800 tabular" data-testid={`line-total-${idx}`}>{eur(lineNet(it))}</span></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Retención IRPF (global)</Label>
                <Select value={form.irpf_rate} onValueChange={(v) => setForm({ ...form, irpf_rate: v })}>
                  <SelectTrigger data-testid="irpf-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{IRPF_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descuento global (%)</Label>
                <Input type="number" step="0.01" min="0" max="100" value={form.global_discount} onChange={(e) => setForm({ ...form, global_discount: e.target.value })} data-testid="global-discount" />
              </div>
              <div className="space-y-2">
                <Label>Recargo de equivalencia</Label>
                <div className="flex items-center gap-2 h-9 px-3 border border-slate-200 rounded-md bg-white">
                  <Checkbox id="recargo_eq_q" checked={form.recargo_equivalencia} onCheckedChange={(v) => setForm({ ...form, recargo_equivalencia: !!v })} data-testid="recargo-checkbox" />
                  <label htmlFor="recargo_eq_q" className="text-sm text-slate-600 cursor-pointer">Cliente en RE</label>
                </div>
              </div>
            </div>

            <div className="space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} data-testid="quote-notes" /></div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5 text-sm">
              {calc.discountTotal > 0 && <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tabular">{eur(calc.subtotal)}</span></div>}
              {calc.discountTotal > 0 && <div className="flex justify-between text-slate-500"><span>Descuento{gd ? ` global (-${gd}%)` : ""}</span><span className="tabular">-{eur(calc.discountTotal)}</span></div>}
              <div className="flex justify-between text-slate-500"><span>Base imponible</span><span className="tabular" data-testid="summary-base">{eur(calc.base)}</span></div>
              {calc.breakdown.map((b) => (
                <div key={b.rate} className="flex justify-between text-slate-500"><span>IVA ({b.rate}%)</span><span className="tabular">{eur(b.cuota)}</span></div>
              ))}
              {calc.reAmount > 0 && calc.breakdown.filter((b) => b.reCuota > 0).map((b) => (
                <div key={`re-${b.rate}`} className="flex justify-between text-slate-500"><span>Recargo equiv. ({b.reRate}%)</span><span className="tabular">{eur(b.reCuota)}</span></div>
              ))}
              {calc.suplidos > 0 && <div className="flex justify-between text-slate-500"><span>Suplidos</span><span className="tabular">{eur(calc.suplidos)}</span></div>}
              {Number(form.irpf_rate) > 0 && <div className="flex justify-between text-slate-500"><span>Retención IRPF (-{form.irpf_rate}%)</span><span className="tabular">-{eur(calc.irpfAmount)}</span></div>}
              <div className="flex justify-between font-display text-lg font-semibold text-slate-900 pt-2 border-t border-slate-200 mt-2"><span>Total</span><span className="tabular" data-testid="summary-total">{eur(calc.total)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-200">Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="save-quote">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingId ? "Guardar cambios" : "Crear presupuesto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
