import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Users, Building2, Mail, Loader2 } from "lucide-react";

const emptyForm = () => ({ name: "", nif: "", address: "", email: "", phone: "" });

export default function Contacts() {
  const [kind, setKind] = useState("client");
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/contacts?kind=${kind}`).then((r) => setContacts(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [kind]);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Introduce el nombre");
    setSaving(true);
    try {
      await api.post("/contacts", { ...form, kind });
      toast.success(kind === "client" ? "Cliente guardado" : "Proveedor guardado");
      setOpen(false);
      setForm(emptyForm());
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`¿Eliminar a ${c.name}?`)) return;
    await api.delete(`/contacts/${c.id}`);
    toast.success("Eliminado");
    load();
  };

  const isClient = kind === "client";

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Contactos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Guarda clientes y proveedores para reutilizarlos</p>
        </div>
        <Button onClick={() => { setForm(emptyForm()); setOpen(true); }} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="new-contact-button">
          <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} /> {isClient ? "Nuevo cliente" : "Nuevo proveedor"}
        </Button>
      </div>

      <Tabs value={kind} onValueChange={setKind} className="mb-5">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="client" data-testid="tab-clients">Clientes</TabsTrigger>
          <TabsTrigger value="provider" data-testid="tab-providers">Proveedores</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      ) : contacts.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-12 text-center" data-testid="contacts-empty">
          {isClient ? <Users className="w-12 h-12 mx-auto text-slate-300" strokeWidth={1.25} /> : <Building2 className="w-12 h-12 mx-auto text-slate-300" strokeWidth={1.25} />}
          <p className="text-slate-500 mt-3">Aún no tienes {isClient ? "clientes" : "proveedores"} guardados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((c) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 group" data-testid={`contact-card-${c.id}`}>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center font-semibold text-sm">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <button onClick={() => remove(c)} className="p-1.5 rounded-md text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors duration-200" data-testid={`contact-delete-${c.id}`}>
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
              <div className="font-medium text-slate-900 mt-3">{c.name}</div>
              {c.nif && <div className="text-sm text-slate-500 tabular">{c.nif}</div>}
              {c.email && <div className="text-sm text-slate-400 flex items-center gap-1.5 mt-1"><Mail className="w-3.5 h-3.5" strokeWidth={1.5} />{c.email}</div>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="contact-dialog">
          <DialogHeader><DialogTitle className="font-display">{isClient ? "Nuevo cliente" : "Nuevo proveedor"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nombre / Razón social</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="contact-name" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>NIF / CIF</Label><Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} data-testid="contact-nif" /></div>
              <div className="space-y-2"><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="contact-phone" /></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="contact-email" /></div>
            <div className="space-y-2"><Label>Dirección</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="contact-address" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-200">Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="save-contact">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
