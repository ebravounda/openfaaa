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
  Plus, Trash2, FileText, Mail, Download, CheckCircle2, Loader2, Pencil,
} from "lucide-react";

const IVA_OPTIONS = [
  { v: "21", l: "IVA General 21%" },
  { v: "10", l: "IVA Reducido 10%" },
  { v: "4", l: "IVA Superreducido 4%" },
  { v: "0", l: "IVA 0% / Exento" },
];
const IRPF_OPTIONS = [
  { v: "0", l: "Sin retención" },
  { v: "7", l: "IRPF 7% (nuevos autónomos)" },
  { v: "15", l: "IRPF 15% (general)" },
];

const emptyForm = () => ({
  issue_date: new Date().toISOString().slice(0, 10),
  client: { name: "", nif: "", address: "", email: "" },
  line_items: [{ description: "", quantity: 1, unit_price: 0 }],
  iva_rate: "21",
  irpf_rate: "0",
  notes: "",
  series: "",
  save_client: false,
});

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [prefix, setPrefix] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/invoices").then((r) => setInvoices(r.data)).finally(() => setLoading(false));
  };
  const loadClients = () => api.get("/contacts?kind=client").then((r) => setClients(r.data));
  useEffect(() => {
    load(); loadClients();
    api.get("/company").then((r) => setPrefix(r.data?.invoice_prefix || ""));
  }, []);

  const base = form.line_items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
  const ivaAmount = (base * Number(form.iva_rate)) / 100;
  const irpfAmount = (base * Number(form.irpf_rate)) / 100;
  const total = base + ivaAmount - irpfAmount;

  const updateItem = (idx, field, value) => {
    const items = [...form.line_items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, line_items: items });
  };
  const addItem = () => setForm({ ...form, line_items: [...form.line_items, { description: "", quantity: 1, unit_price: 0 }] });
  const removeItem = (idx) => setForm({ ...form, line_items: form.line_items.filter((_, i) => i !== idx) });

  const pickClient = (id) => {
    const c = clients.find((x) => x.id === id);
    if (c) setForm((f) => ({ ...f, client: { name: c.name, nif: c.nif, address: c.address, email: c.email } }));
  };

  const openNew = () => { setEditingId(null); setForm({ ...emptyForm(), series: prefix }); setOpen(true); };
  const openEdit = (inv) => {
    setEditingId(inv.id);
    setForm({
      issue_date: inv.issue_date,
      client: { name: inv.client?.name || "", nif: inv.client?.nif || "", address: inv.client?.address || "", email: inv.client?.email || "" },
      line_items: inv.line_items?.length ? inv.line_items.map((i) => ({ ...i })) : [{ description: "", quantity: 1, unit_price: 0 }],
      iva_rate: String(inv.iva_rate),
      irpf_rate: String(inv.irpf_rate || 0),
      notes: inv.notes || "",
      series: inv.series || "",
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
      client: form.client,
      line_items: form.line_items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
      iva_rate: Number(form.iva_rate),
      irpf_rate: Number(form.irpf_rate),
      notes: form.notes,
      series: form.series,
    };
    try {
      if (editingId) {
        await api.put(`/invoices/${editingId}`, payload);
        toast.success("Factura actualizada");
      } else {
        await api.post("/invoices", payload);
        if (form.save_client) { try { await api.post("/contacts", { ...form.client, kind: "client" }); loadClients(); } catch (e) {} }
        toast.success("Factura emitida");
      }
      setOpen(false);
      setForm(emptyForm());
      setEditingId(null);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const openPdf = (inv) => window.open(`${API}/invoices/${inv.id}/pdf`, "_blank");

  const sendEmail = async (inv) => {
    if (!inv.client?.email) return toast.error("El cliente no tiene email registrado");
    setSendingId(inv.id);
    try {
      await api.post(`/invoices/${inv.id}/send-email`);
      toast.success(`Factura enviada a ${inv.client.email}`);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSendingId(null);
    }
  };

  const markPaid = async (inv) => {
    await api.patch(`/invoices/${inv.id}/status`, { status: inv.status === "paid" ? "pending" : "paid" });
    load();
  };

  const remove = async (inv) => {
    if (!window.confirm(`¿Eliminar la factura ${inv.number}?`)) return;
    await api.delete(`/invoices/${inv.id}`);
    toast.success("Factura eliminada");
    load();
  };

  const nextPreview = `${form.series ? form.series + "-" : ""}${form.issue_date.slice(0, 4)}-XXXX`;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Facturas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Emite y gestiona tus facturas de venta</p>
        </div>
        <Button onClick={openNew} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="new-invoice-button">
          <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} /> Nueva factura
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
        ) : invoices.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 m-5 rounded-lg py-14 text-center" data-testid="invoices-empty">
            <FileText className="w-12 h-12 mx-auto text-slate-300" strokeWidth={1.25} />
            <p className="text-slate-500 mt-3">Aún no has creado ninguna factura.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nº</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} data-testid={`invoice-row-${inv.number}`}>
                  <TableCell className="font-mono text-sm font-medium text-slate-900">{inv.number}</TableCell>
                  <TableCell className="text-sm text-slate-600 tabular">{inv.issue_date}</TableCell>
                  <TableCell className="text-sm font-medium text-slate-900">{inv.client?.name}</TableCell>
                  <TableCell className="text-right text-sm tabular">{eur(inv.base)}</TableCell>
                  <TableCell className="text-right text-sm text-slate-500 tabular">{eur(inv.iva_amount)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular">{eur(inv.total)}</TableCell>
                  <TableCell>
                    {inv.status === "paid"
                      ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-full">Pagada</Badge>
                      : <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 rounded-full">Pendiente</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(inv)} data-testid={`invoice-edit-${inv.number}`} className="h-8 w-8 text-slate-500 hover:text-[#0052FF]"><Pencil className="w-4 h-4" strokeWidth={1.5} /></Button>
                      <Button variant="ghost" size="icon" title="Ver PDF" onClick={() => openPdf(inv)} data-testid={`invoice-pdf-${inv.number}`} className="h-8 w-8 text-slate-500 hover:text-slate-900"><Download className="w-4 h-4" strokeWidth={1.5} /></Button>
                      <Button variant="ghost" size="icon" title="Enviar por email" onClick={() => sendEmail(inv)} disabled={sendingId === inv.id} data-testid={`invoice-email-${inv.number}`} className="h-8 w-8 text-slate-500 hover:text-[#0052FF]">
                        {sendingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" strokeWidth={1.5} />}
                      </Button>
                      <Button variant="ghost" size="icon" title="Marcar pagada" onClick={() => markPaid(inv)} data-testid={`invoice-paid-${inv.number}`} className="h-8 w-8 text-slate-500 hover:text-emerald-600"><CheckCircle2 className={`w-4 h-4 ${inv.status === "paid" ? "text-emerald-600" : ""}`} strokeWidth={1.5} /></Button>
                      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => remove(inv)} data-testid={`invoice-delete-${inv.number}`} className="h-8 w-8 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="invoice-dialog">
          <DialogHeader><DialogTitle className="font-display">{editingId ? "Editar factura" : "Nueva factura"}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Fecha de emisión</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} data-testid="invoice-date" /></div>
              {!editingId && (
                <div className="space-y-2">
                  <Label>Serie</Label>
                  <Input value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })} placeholder="FAC" data-testid="invoice-series" />
                </div>
              )}
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
            {!editingId && <p className="text-xs text-slate-400 -mt-2">Nº que se generará: <span className="font-mono text-slate-600">{nextPreview}</span></p>}

            <div className="border border-slate-200 rounded-lg p-4 space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Datos del cliente</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nombre / Razón social</Label><Input value={form.client.name} onChange={(e) => setForm({ ...form, client: { ...form.client, name: e.target.value } })} data-testid="client-name" /></div>
                <div className="space-y-2"><Label>NIF / CIF</Label><Input value={form.client.nif} onChange={(e) => setForm({ ...form, client: { ...form.client, nif: e.target.value } })} placeholder="B12345678" data-testid="client-nif" /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.client.email} onChange={(e) => setForm({ ...form, client: { ...form.client, email: e.target.value } })} data-testid="client-email" /></div>
                <div className="space-y-2"><Label>Dirección</Label><Input value={form.client.address} onChange={(e) => setForm({ ...form, client: { ...form.client, address: e.target.value } })} data-testid="client-address" /></div>
              </div>
              {!editingId && (
                <div className="flex items-center gap-2">
                  <Checkbox id="save_client" checked={form.save_client} onCheckedChange={(v) => setForm({ ...form, save_client: !!v })} data-testid="save-client-checkbox" />
                  <label htmlFor="save_client" className="text-sm text-slate-600 cursor-pointer">Guardar como cliente para reutilizar</label>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Líneas</div>
                <Button variant="outline" size="sm" onClick={addItem} className="border-slate-200" data-testid="add-line-item"><Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} /> Añadir línea</Button>
              </div>
              {form.line_items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end" data-testid={`line-item-${idx}`}>
                  <div className="col-span-6 space-y-1">{idx === 0 && <Label className="text-xs">Descripción</Label>}<Input value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} data-testid={`line-desc-${idx}`} /></div>
                  <div className="col-span-2 space-y-1">{idx === 0 && <Label className="text-xs">Cant.</Label>}<Input type="number" step="0.01" value={it.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} data-testid={`line-qty-${idx}`} /></div>
                  <div className="col-span-3 space-y-1">{idx === 0 && <Label className="text-xs">Precio (€)</Label>}<Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(idx, "unit_price", e.target.value)} data-testid={`line-price-${idx}`} /></div>
                  <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={form.line_items.length === 1} className="h-9 w-9 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></Button></div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de IVA</Label>
                <Select value={form.iva_rate} onValueChange={(v) => setForm({ ...form, iva_rate: v })}>
                  <SelectTrigger data-testid="iva-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{IVA_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Retención IRPF</Label>
                <Select value={form.irpf_rate} onValueChange={(v) => setForm({ ...form, irpf_rate: v })}>
                  <SelectTrigger data-testid="irpf-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{IRPF_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} data-testid="invoice-notes" /></div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500"><span>Base imponible</span><span className="tabular" data-testid="summary-base">{eur(base)}</span></div>
              <div className="flex justify-between text-slate-500"><span>IVA ({form.iva_rate}%)</span><span className="tabular">{eur(ivaAmount)}</span></div>
              {Number(form.irpf_rate) > 0 && <div className="flex justify-between text-slate-500"><span>Retención IRPF (-{form.irpf_rate}%)</span><span className="tabular">-{eur(irpfAmount)}</span></div>}
              <div className="flex justify-between font-display text-lg font-semibold text-slate-900 pt-2 border-t border-slate-200 mt-2"><span>Total</span><span className="tabular" data-testid="summary-total">{eur(total)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-200">Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="save-invoice">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingId ? "Guardar cambios" : "Emitir factura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
