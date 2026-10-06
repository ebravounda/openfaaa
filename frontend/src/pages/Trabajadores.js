import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserRound, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

const empty = () => ({
  name: "", dni: "", naf: "", email: "", phone: "", position: "", contract_type: "indefinido",
  start_date: "", end_date: "", monthly_gross: "", irpf_rate: "", ss_rate: "6.47", iban: "", ss_group: "", notes: "", active: true,
});

export default function Trabajadores() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/employees").then((r) => setList(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditingId(null); setForm(empty()); setOpen(true); };
  const openEdit = (e) => {
    setEditingId(e.id);
    setForm({ ...empty(), ...e, monthly_gross: String(e.monthly_gross ?? ""), irpf_rate: String(e.irpf_rate ?? ""), ss_rate: String(e.ss_rate ?? "6.47") });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);
    try {
      const payload = { ...form, monthly_gross: Number(form.monthly_gross) || 0, irpf_rate: Number(form.irpf_rate) || 0, ss_rate: Number(form.ss_rate) || 6.47 };
      if (editingId) await api.patch(`/employees/${editingId}`, payload);
      else await api.post("/employees", payload);
      toast.success(editingId ? "Trabajador actualizado" : "Trabajador creado");
      setOpen(false); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setSaving(false); }
  };

  const remove = async (e) => {
    if (!window.confirm(`¿Eliminar a ${e.name}?`)) return;
    try { await api.delete(`/employees/${e.id}`); toast.success("Trabajador eliminado"); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const field = (label, key, props = {}) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input value={form[key]} onChange={(ev) => setForm({ ...form, [key]: ev.target.value })} data-testid={`emp-${key}`} {...props} />
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6" data-testid="employees-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2"><UserRound className="w-6 h-6 text-[#0052FF]" strokeWidth={1.5} /> Trabajadores</h1>
            <p className="text-sm text-slate-500 mt-0.5">Gestiona la plantilla y sus datos para generar nóminas.</p>
          </div>
          <Button onClick={openNew} className="bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl" data-testid="new-employee"><Plus className="w-4 h-4 mr-1.5" /> Nuevo trabajador</Button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          {list.length === 0 ? (
            <div className="text-center text-slate-400 py-16 text-sm">Aún no hay trabajadores. Añade el primero.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead><TableHead>DNI/NIE</TableHead><TableHead>Puesto</TableHead>
                  <TableHead>Contrato</TableHead><TableHead className="text-right">Bruto/mes</TableHead>
                  <TableHead className="text-right">IRPF</TableHead><TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((e, i) => (
                  <TableRow key={e.id} data-testid={`employee-row-${i}`} className="hover:bg-slate-50/60">
                    <TableCell className="font-medium text-slate-900">{e.name}</TableCell>
                    <TableCell className="text-sm text-slate-500">{e.dni || "—"}</TableCell>
                    <TableCell className="text-sm text-slate-500">{e.position || "—"}</TableCell>
                    <TableCell className="text-sm text-slate-500">{e.contract_type || "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular">{eur(e.monthly_gross || 0)}</TableCell>
                    <TableCell className="text-right text-sm text-slate-500">{e.irpf_rate || 0}%</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-[#0052FF]" onClick={() => openEdit(e)} data-testid={`emp-edit-${i}`}><Pencil className="w-4 h-4" strokeWidth={1.5} /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => remove(e)} data-testid={`emp-delete-${i}`}><Trash2 className="w-4 h-4" strokeWidth={1.5} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="employee-dialog">
            <DialogHeader><DialogTitle className="font-display">{editingId ? "Editar trabajador" : "Nuevo trabajador"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field("Nombre completo", "name")}
              {field("DNI / NIE", "dni")}
              {field("Nº Afiliación SS (NAF)", "naf")}
              {field("Email", "email")}
              {field("Teléfono", "phone")}
              {field("Puesto", "position")}
              {field("Tipo de contrato", "contract_type")}
              {field("Grupo de cotización", "ss_group")}
              {field("Fecha de alta", "start_date", { type: "date" })}
              {field("Fecha de baja", "end_date", { type: "date" })}
              {field("Salario bruto mensual (€)", "monthly_gross", { type: "number", step: "0.01" })}
              {field("Retención IRPF (%)", "irpf_rate", { type: "number", step: "0.01" })}
              {field("Seg. Social trabajador (%)", "ss_rate", { type: "number", step: "0.01" })}
              {field("IBAN", "iban")}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-200">Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl" data-testid="save-employee">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
