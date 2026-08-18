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
  Plus, Trash2, FileText, Mail, Download, CheckCircle2, Loader2, Pencil, Undo2, ShieldCheck, ShieldAlert, Search, Ban, Sparkles,
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
  invoice_type: "normal",
  rectifies: "",
  rectifies_number: "",
  save_client: false,
  due_date: "",
  period: "",
  payment_method: "",
  iban: "",
  concept_label: "",
});

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [prefix, setPrefix] = useState("");
  const [rectifyPrefix, setRectifyPrefix] = useState("R");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);

  const lookupNif = async () => {
    const nif = form.client.nif.trim();
    if (!nif) return toast.error("Introduce el NIF/CIF a buscar");
    setLookingUp(true);
    try {
      const { data } = await api.get(`/lookup/nif?nif=${encodeURIComponent(nif)}`);
      if (!data.valid) return toast.error("NIF/CIF no válido según VIES");
      if (data.name) {
        setForm((f) => ({
          ...f,
          client: {
            ...f.client,
            name: data.name,
            address: data.address || f.client.address,
            email: data.email || f.client.email,
          },
        }));
        toast.success(data.source === "Contactos guardados" ? `Datos cargados de tus contactos: ${data.name}` : `Encontrado: ${data.name}`);
      } else {
        toast.success("NIF/CIF válido. VIES no facilita el nombre para este contribuyente; complétalo a mano.");
      }
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLookingUp(false);
    }
  };

  const load = () => {
    setLoading(true);
    api.get("/invoices").then((r) => setInvoices(r.data)).finally(() => setLoading(false));
  };
  const loadClients = () => api.get("/contacts?kind=client").then((r) => setClients(r.data));
  useEffect(() => {
    load(); loadClients(); loadIrpfHint();
    api.get("/company").then((r) => {
      setPrefix(r.data?.invoice_prefix || "");
      setRectifyPrefix(r.data?.rectify_prefix || "R");
    });
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

  const openNew = () => { setEditingId(null); setReview(null); setForm({ ...emptyForm(), series: prefix }); setOpen(true); };
  const openRectify = (inv) => {
    setEditingId(null);
    setForm({
      issue_date: new Date().toISOString().slice(0, 10),
      client: { name: inv.client?.name || "", nif: inv.client?.nif || "", address: inv.client?.address || "", email: inv.client?.email || "" },
      line_items: (inv.line_items?.length ? inv.line_items : [{ description: "", quantity: 1, unit_price: 0 }])
        .map((i) => ({ description: i.description, quantity: i.quantity, unit_price: -Math.abs(i.unit_price) })),
      iva_rate: String(inv.iva_rate),
      irpf_rate: String(inv.irpf_rate || 0),
      notes: `Rectifica a la factura ${inv.number}`,
      series: rectifyPrefix,
      invoice_type: "rectificativa",
      rectifies: inv.id,
      rectifies_number: inv.number,
      save_client: false,
    });
    setOpen(true);
  };
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
      due_date: inv.due_date || "",
      period: inv.period || "",
      payment_method: inv.payment_method || "",
      iban: inv.iban || "",
      concept_label: inv.concept_label || "",
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
      invoice_type: form.invoice_type,
      rectifies: form.rectifies,
      rectifies_number: form.rectifies_number,
      due_date: form.due_date,
      period: form.period,
      payment_method: form.payment_method,
      iban: form.iban,
      concept_label: form.concept_label,
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

  const submitVf = async (inv) => {
    try {
      const { data } = await api.post(`/invoices/${inv.id}/verifactu/submit`);
      toast.success(data.status);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const anular = async (inv) => {
    if (!window.confirm(`¿Anular la factura ${inv.number}? Esta acción registra la anulación en VeriFactu y no se puede deshacer.`)) return;
    try {
      const { data } = await api.post(`/invoices/${inv.id}/anular`);
      toast.success(data.verifactu ? `Factura anulada · ${data.verifactu.status}` : "Factura anulada");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const [irpfHint, setIrpfHint] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState(null);

  const loadIrpfHint = async () => {
    try {
      const { data } = await api.get("/irpf/suggestion");
      setIrpfHint(data);
    } catch (e) { setIrpfHint(null); }
  };

  const reviewWithAI = async () => {
    setReviewing(true);
    setReview(null);
    try {
      const { data } = await api.post("/invoices/review", {
        client: form.client,
        line_items: form.line_items.map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
        iva_rate: Number(form.iva_rate),
        irpf_rate: Number(form.irpf_rate),
        issue_date: form.issue_date,
      });
      setReview(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setReviewing(false);
    }
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
                  <TableCell className="font-mono text-sm font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {inv.number}
                      {inv.invoice_type === "rectificativa" && (
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 rounded-full text-[10px] px-2">Rectificativa</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 tabular">{inv.issue_date}</TableCell>
                  <TableCell className="text-sm font-medium text-slate-900">{inv.client?.name}</TableCell>
                  <TableCell className="text-right text-sm tabular">{eur(inv.base)}</TableCell>
                  <TableCell className="text-right text-sm text-slate-500 tabular">{eur(inv.iva_amount)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular">{eur(inv.total)}</TableCell>
                  <TableCell>
                    {inv.status === "anulada"
                      ? <Badge className="bg-red-100 text-red-700 hover:bg-red-100 rounded-full">Anulada</Badge>
                      : inv.status === "paid"
                      ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-full">Pagada</Badge>
                      : <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 rounded-full">Pendiente</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      {inv.verifactu && (inv.verifactu.submitted ? (
                        <Button variant="ghost" size="icon" disabled title={`VeriFactu enviado (simulado) · ${inv.verifactu.csv || ""}`} data-testid={`invoice-vf-${inv.number}`} className="h-8 w-8 text-emerald-600 opacity-100"><ShieldCheck className="w-4 h-4" strokeWidth={1.5} /></Button>
                      ) : (
                        <Button variant="ghost" size="icon" title="Enviar a AEAT (VeriFactu, simulado)" onClick={() => submitVf(inv)} data-testid={`invoice-vf-${inv.number}`} className="h-8 w-8 text-amber-500 hover:text-amber-600"><ShieldAlert className="w-4 h-4" strokeWidth={1.5} /></Button>
                      ))}
                      {inv.invoice_type !== "rectificativa" && inv.status !== "anulada" && (
                        <Button variant="ghost" size="icon" title="Crear rectificativa (abono)" onClick={() => openRectify(inv)} data-testid={`invoice-rectify-${inv.number}`} className="h-8 w-8 text-slate-500 hover:text-purple-600"><Undo2 className="w-4 h-4" strokeWidth={1.5} /></Button>
                      )}
                      {inv.status !== "anulada" && (
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(inv)} data-testid={`invoice-edit-${inv.number}`} className="h-8 w-8 text-slate-500 hover:text-[#0052FF]"><Pencil className="w-4 h-4" strokeWidth={1.5} /></Button>
                      )}
                      <Button variant="ghost" size="icon" title="Ver PDF" onClick={() => openPdf(inv)} data-testid={`invoice-pdf-${inv.number}`} className="h-8 w-8 text-slate-500 hover:text-slate-900"><Download className="w-4 h-4" strokeWidth={1.5} /></Button>
                      <Button variant="ghost" size="icon" title="Enviar por email" onClick={() => sendEmail(inv)} disabled={sendingId === inv.id} data-testid={`invoice-email-${inv.number}`} className="h-8 w-8 text-slate-500 hover:text-[#0052FF]">
                        {sendingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" strokeWidth={1.5} />}
                      </Button>
                      {inv.status !== "anulada" && (
                        <Button variant="ghost" size="icon" title="Marcar pagada" onClick={() => markPaid(inv)} data-testid={`invoice-paid-${inv.number}`} className="h-8 w-8 text-slate-500 hover:text-emerald-600"><CheckCircle2 className={`w-4 h-4 ${inv.status === "paid" ? "text-emerald-600" : ""}`} strokeWidth={1.5} /></Button>
                      )}
                      {inv.status !== "anulada" && (
                        <Button variant="ghost" size="icon" title="Anular factura (con VeriFactu)" onClick={() => anular(inv)} data-testid={`invoice-anular-${inv.number}`} className="h-8 w-8 text-slate-400 hover:text-red-600"><Ban className="w-4 h-4" strokeWidth={1.5} /></Button>
                      )}
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
          <DialogHeader><DialogTitle className="font-display">{editingId ? "Editar factura" : form.invoice_type === "rectificativa" ? "Nueva factura rectificativa" : "Nueva factura"}</DialogTitle></DialogHeader>
          {form.invoice_type === "rectificativa" && (
            <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2" data-testid="rectify-banner">
              <Undo2 className="w-4 h-4" strokeWidth={1.5} />
              Abono que rectifica a la factura <strong>{form.rectifies_number}</strong>. Los importes negativos restan del total original.
            </div>
          )}
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                {irpfHint && (
                  <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-md p-2 flex items-start gap-2" data-testid="irpf-hint">
                    <Sparkles className="w-3.5 h-3.5 text-[#0052FF] shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span>
                      {irpfHint.reason}{" "}
                      {irpfHint.suggested_rate > 0 && String(irpfHint.suggested_rate) !== form.irpf_rate && (
                        <button type="button" className="text-[#0052FF] font-medium underline" onClick={() => setForm({ ...form, irpf_rate: String(irpfHint.suggested_rate) })} data-testid="apply-irpf-suggestion">Aplicar {irpfHint.suggested_rate}%</button>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} data-testid="invoice-notes" /></div>

            <div className="border border-slate-200 rounded-lg p-4 space-y-4" data-testid="payment-section">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Datos de pago y periodo (opcional · plantilla GoRoky)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Vencimiento</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} data-testid="invoice-due-date" /></div>
                <div className="space-y-2"><Label>Periodo</Label><Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="agosto 2026" data-testid="invoice-period" /></div>
                <div className="space-y-2"><Label>Concepto</Label><Input value={form.concept_label} onChange={(e) => setForm({ ...form, concept_label: e.target.value })} placeholder="PAGO" data-testid="invoice-concept" /></div>
                <div className="space-y-2">
                  <Label>Método de pago</Label>
                  <Select value={form.payment_method || "none"} onValueChange={(v) => setForm({ ...form, payment_method: v === "none" ? "" : v })}>
                    <SelectTrigger data-testid="invoice-payment-method"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin especificar</SelectItem>
                      <SelectItem value="CARD">CARD</SelectItem>
                      <SelectItem value="TRANSFERENCIA">TRANSFERENCIA</SelectItem>
                      <SelectItem value="EFECTIVO">EFECTIVO</SelectItem>
                      <SelectItem value="DOMICILIACION">DOMICILIACIÓN</SelectItem>
                      <SelectItem value="BIZUM">BIZUM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2"><Label>IBAN</Label><Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} placeholder="ES46 1583 0001 1290 8062 6801" data-testid="invoice-iban" /></div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500"><span>Base imponible</span><span className="tabular" data-testid="summary-base">{eur(base)}</span></div>
              <div className="flex justify-between text-slate-500"><span>IVA ({form.iva_rate}%)</span><span className="tabular">{eur(ivaAmount)}</span></div>
              {Number(form.irpf_rate) > 0 && <div className="flex justify-between text-slate-500"><span>Retención IRPF (-{form.irpf_rate}%)</span><span className="tabular">-{eur(irpfAmount)}</span></div>}
              <div className="flex justify-between font-display text-lg font-semibold text-slate-900 pt-2 border-t border-slate-200 mt-2"><span>Total</span><span className="tabular" data-testid="summary-total">{eur(total)}</span></div>
            </div>

            {review && (
              <div className={`rounded-lg p-4 text-sm border ${review.ok ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`} data-testid="ai-review-result">
                <div className="font-medium mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} />
                  {review.ok ? "Revisión IA: todo correcto" : "Revisión IA: revisa estos puntos"}
                </div>
                {review.summary && <p className="text-slate-600 mb-2">{review.summary}</p>}
                <ul className="space-y-1">
                  {(review.issues || []).map((it, i) => (
                    <li key={i} className={it.severity === "error" ? "text-red-700" : "text-amber-700"}>• {it.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={reviewWithAI} disabled={reviewing} className="border-slate-200 mr-auto" data-testid="review-ai">
              {reviewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" strokeWidth={1.5} />}Revisar con IA
            </Button>
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
