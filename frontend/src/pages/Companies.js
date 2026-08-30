import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Building2, Loader2, CheckCircle2, ArrowRightCircle } from "lucide-react";

const emptyForm = () => ({ name: "", nif: "", tax_type: "autonomo", address: "", email: "", phone: "", invoice_prefix: "" });

export default function Companies() {
  const { user, reload } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const activeId = user?.active_company_id;
  const multiOn = !!user?.multi_company_enabled;

  const load = () => {
    setLoading(true);
    api.get("/companies").then((r) => setCompanies(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toggleMulti = async (val) => {
    setToggling(true);
    try {
      await api.post("/companies/multi-toggle", { enabled: val });
      await reload();
      toast.success(val ? "Multiempresas activado" : "Multiempresas desactivado");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setToggling(false); }
  };

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({ name: c.name || "", nif: c.nif || "", tax_type: c.tax_type || "autonomo", address: c.address || "", email: c.email || "", phone: c.phone || "", invoice_prefix: c.invoice_prefix || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Introduce el nombre de la empresa/autónomo");
    setSaving(true);
    try {
      if (editingId) {
        const existing = companies.find((c) => c.id === editingId) || {};
        await api.put(`/companies/${editingId}`, { ...existing, ...form });
        toast.success("Empresa actualizada");
      } else {
        await api.post("/companies", form);
        await reload();
        toast.success("Empresa creada y seleccionada");
      }
      setOpen(false); setForm(emptyForm()); setEditingId(null); load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const switchTo = async (id) => {
    try { await api.post("/companies/switch", { company_id: id }); await reload(); window.location.reload(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const goAccounting = async (id) => {
    if (id !== activeId) { await api.post("/companies/switch", { company_id: id }); await reload(); }
    navigate("/");
  };

  const remove = async (c) => {
    if (!window.confirm(`¿Eliminar la empresa "${c.name}"? Solo se puede si no tiene facturas.`)) return;
    try { await api.delete(`/companies/${c.id}`); await reload(); toast.success("Empresa eliminada"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Empresas y autónomos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestiona varias empresas y autónomos desde una sola cuenta</p>
        </div>
        <Button onClick={openNew} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="new-company-button">
          <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} /> Nueva empresa
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-5 flex items-center justify-between gap-4" data-testid="multi-toggle-card">
        <div>
          <div className="font-medium text-slate-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} /> Activar multiempresas</div>
          <p className="text-sm text-slate-500 mt-0.5">Permite crear y alternar entre varias empresas y autónomos, cada uno con su contabilidad, numeración y certificado propios.</p>
        </div>
        <Switch checked={multiOn} onCheckedChange={toggleMulti} disabled={toggling} data-testid="multi-toggle-switch" />
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : (
        <Accordion type="single" collapsible className="space-y-3" data-testid="companies-accordion">
          {companies.map((c) => (
            <AccordionItem key={c.id} value={c.id} className="bg-white border border-slate-200 rounded-lg px-4" data-testid={`company-item-${c.id}`}>
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 flex items-center gap-2">
                      {c.name || "(Sin nombre)"}
                      {c.id === activeId && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-full text-[10px]">Activa</Badge>}
                    </div>
                    <div className="text-xs text-slate-500">{c.tax_type === "empresa" ? "Empresa" : "Autónomo"}{c.nif ? ` · ${c.nif}` : ""}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-600 mb-4">
                  <div><span className="text-slate-400">NIF/CIF:</span> {c.nif || "—"}</div>
                  <div><span className="text-slate-400">Serie facturas:</span> {c.invoice_prefix || "—"}</div>
                  <div><span className="text-slate-400">Email:</span> {c.email || "—"}</div>
                  <div><span className="text-slate-400">Teléfono:</span> {c.phone || "—"}</div>
                  <div className="sm:col-span-2"><span className="text-slate-400">Dirección:</span> {c.address || "—"}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => goAccounting(c.id)} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid={`company-accounting-${c.id}`}>
                    <ArrowRightCircle className="w-4 h-4 mr-1.5" strokeWidth={1.5} /> Ver contabilidad
                  </Button>
                  {c.id !== activeId && (
                    <Button size="sm" variant="outline" onClick={() => switchTo(c.id)} className="border-slate-200" data-testid={`company-activate-${c.id}`}>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" strokeWidth={1.5} /> Establecer activa
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="border-slate-200" data-testid={`company-edit-${c.id}`}>
                    <Pencil className="w-4 h-4 mr-1.5" strokeWidth={1.5} /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(c)} className="border-slate-200 text-red-600 hover:text-red-700" data-testid={`company-delete-${c.id}`}>
                    <Trash2 className="w-4 h-4 mr-1.5" strokeWidth={1.5} /> Eliminar
                  </Button>
                </div>
                <p className="text-xs text-slate-400 mt-3">El certificado VeriFactu, la plantilla y la cuenta de Stripe se configuran por empresa: selecciónala como activa y ve a Configuración / Conexión / Métodos de pago.</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" data-testid="company-dialog">
          <DialogHeader><DialogTitle className="font-display">{editingId ? "Editar empresa" : "Nueva empresa / autónomo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nombre / Razón social</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="company-name" /></div>
              <div className="space-y-2"><Label>NIF / CIF</Label><Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} placeholder="B12345678" data-testid="company-nif" /></div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tax_type} onValueChange={(v) => setForm({ ...form, tax_type: v })}>
                  <SelectTrigger data-testid="company-tax-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autonomo">Autónomo</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Serie de facturas</Label><Input value={form.invoice_prefix} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} placeholder="FAC" data-testid="company-prefix" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="company-email" /></div>
              <div className="space-y-2"><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="company-phone" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Dirección</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="company-address" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-200">Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="save-company">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingId ? "Guardar cambios" : "Crear empresa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
