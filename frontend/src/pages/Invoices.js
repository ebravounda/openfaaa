import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { API, eur, formatApiErrorDetail } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  FileText,
  Mail,
  Download,
  CheckCircle2,
  Loader2,
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
});

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/invoices").then((r) => setInvoices(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

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

  const save = async () => {
    if (!form.client.name.trim()) return toast.error("Introduce el nombre del cliente");
    if (form.line_items.some((i) => !i.description.trim())) return toast.error("Todas las líneas necesitan descripción");
    setSaving(true);
    try {
      await api.post("/invoices", {
        issue_date: form.issue_date,
        client: form.client,
        line_items: form.line_items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
        })),
        iva_rate: Number(form.iva_rate),
        irpf_rate: Number(form.irpf_rate),
        notes: form.notes,
      });
      toast.success("Factura creada");
      setOpen(false);
      setForm(emptyForm());
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const openPdf = (inv) => window.open(`${API}/invoices/${inv.id}/pdf`, "_blank");

  const sendEmail = async (inv) => {
    if (!inv.client?.email) return toast.error("El cliente no tiene email");
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

  return (
    <Layout>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter text-[#111111]">Facturas</h1>
          <p className="text-sm text-[#666666] mt-1">Emite y gestiona tus facturas de venta</p>
        </div>
        <Button onClick={() => { setForm(emptyForm()); setOpen(true); }} className="bg-[#0A0A0A] hover:bg-[#262626] text-white rounded-md" data-testid="new-invoice-button">
          <Plus className="w-4 h-4 mr-2" /> Nueva factura
        </Button>
      </div>

      <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-[#666666]" data-testid="invoices-empty">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Aún no has creado ninguna factura.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA]">
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
              {invoices.map((inv, i) => (
                <TableRow key={inv.id} className="row-in" style={{ animationDelay: `${i * 30}ms` }} data-testid={`invoice-row-${inv.number}`}>
                  <TableCell className="font-mono text-sm font-semibold">{inv.number}</TableCell>
                  <TableCell className="text-sm">{inv.issue_date}</TableCell>
                  <TableCell className="text-sm font-medium">{inv.client?.name}</TableCell>
                  <TableCell className="text-right text-sm">{eur(inv.base)}</TableCell>
                  <TableCell className="text-right text-sm text-[#666666]">{eur(inv.iva_amount)}</TableCell>
                  <TableCell className="text-right text-sm font-bold">{eur(inv.total)}</TableCell>
                  <TableCell>
                    {inv.status === "paid" ? (
                      <Badge className="bg-[#2A9D8F]/15 text-[#2A9D8F] hover:bg-[#2A9D8F]/15 rounded-sm">Pagada</Badge>
                    ) : (
                      <Badge className="bg-[#E9C46A]/25 text-[#8a6d10] hover:bg-[#E9C46A]/25 rounded-sm">Pendiente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Ver PDF" onClick={() => openPdf(inv)} data-testid={`invoice-pdf-${inv.number}`} className="h-8 w-8">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Enviar por email" onClick={() => sendEmail(inv)} disabled={sendingId === inv.id} data-testid={`invoice-email-${inv.number}`} className="h-8 w-8">
                        {sendingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" title="Marcar pagada" onClick={() => markPaid(inv)} data-testid={`invoice-paid-${inv.number}`} className="h-8 w-8">
                        <CheckCircle2 className={`w-4 h-4 ${inv.status === "paid" ? "text-[#2A9D8F]" : ""}`} />
                      </Button>
                      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => remove(inv)} data-testid={`invoice-delete-${inv.number}`} className="h-8 w-8 text-[#E63946]">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="invoice-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Nueva factura</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de emisión</Label>
                <Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} data-testid="invoice-date" />
              </div>
            </div>

            <div className="border border-[#E5E5E5] rounded-md p-4 space-y-4">
              <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#666666]">Datos del cliente</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre / Razón social</Label>
                  <Input value={form.client.name} onChange={(e) => setForm({ ...form, client: { ...form.client, name: e.target.value } })} data-testid="client-name" />
                </div>
                <div className="space-y-2">
                  <Label>NIF / CIF</Label>
                  <Input value={form.client.nif} onChange={(e) => setForm({ ...form, client: { ...form.client, nif: e.target.value } })} placeholder="B12345678" data-testid="client-nif" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.client.email} onChange={(e) => setForm({ ...form, client: { ...form.client, email: e.target.value } })} data-testid="client-email" />
                </div>
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Input value={form.client.address} onChange={(e) => setForm({ ...form, client: { ...form.client, address: e.target.value } })} data-testid="client-address" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#666666]">Líneas</div>
                <Button variant="outline" size="sm" onClick={addItem} className="rounded-md" data-testid="add-line-item">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Añadir línea
                </Button>
              </div>
              {form.line_items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end" data-testid={`line-item-${idx}`}>
                  <div className="col-span-6 space-y-1">
                    {idx === 0 && <Label className="text-xs">Descripción</Label>}
                    <Input value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} data-testid={`line-desc-${idx}`} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {idx === 0 && <Label className="text-xs">Cant.</Label>}
                    <Input type="number" step="0.01" value={it.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} data-testid={`line-qty-${idx}`} />
                  </div>
                  <div className="col-span-3 space-y-1">
                    {idx === 0 && <Label className="text-xs">Precio (€)</Label>}
                    <Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(idx, "unit_price", e.target.value)} data-testid={`line-price-${idx}`} />
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={form.line_items.length === 1} className="h-9 w-9 text-[#E63946]">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de IVA</Label>
                <Select value={form.iva_rate} onValueChange={(v) => setForm({ ...form, iva_rate: v })}>
                  <SelectTrigger data-testid="iva-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IVA_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Retención IRPF</Label>
                <Select value={form.irpf_rate} onValueChange={(v) => setForm({ ...form, irpf_rate: v })}>
                  <SelectTrigger data-testid="irpf-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IRPF_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} data-testid="invoice-notes" />
            </div>

            <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-md p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-[#666666]"><span>Base imponible</span><span data-testid="summary-base">{eur(base)}</span></div>
              <div className="flex justify-between text-[#666666]"><span>IVA ({form.iva_rate}%)</span><span>{eur(ivaAmount)}</span></div>
              {Number(form.irpf_rate) > 0 && (
                <div className="flex justify-between text-[#666666]"><span>Retención IRPF (-{form.irpf_rate}%)</span><span>-{eur(irpfAmount)}</span></div>
              )}
              <div className="flex justify-between font-heading text-lg font-black text-[#111111] pt-2 border-t border-[#E5E5E5] mt-2">
                <span>Total</span><span data-testid="summary-total">{eur(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-md">Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-[#0A0A0A] hover:bg-[#262626] text-white rounded-md" data-testid="save-invoice">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Emitir factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
