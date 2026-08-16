import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Receipt, Loader2 } from "lucide-react";

const IVA_OPTIONS = ["21", "10", "4", "0"];
const CATEGORIES = ["General", "Suministros", "Material", "Servicios", "Alquiler", "Software", "Transporte", "Otros"];

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  vendor_name: "",
  vendor_nif: "",
  description: "",
  category: "General",
  base_amount: "",
  iva_rate: "21",
});

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/expenses").then((r) => setExpenses(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const base = Number(form.base_amount) || 0;
  const ivaAmount = (base * Number(form.iva_rate)) / 100;

  const save = async () => {
    if (!form.vendor_name.trim()) return toast.error("Introduce el proveedor");
    if (!base) return toast.error("Introduce el importe base");
    setSaving(true);
    try {
      await api.post("/expenses", {
        date: form.date,
        vendor_name: form.vendor_name,
        vendor_nif: form.vendor_nif,
        description: form.description,
        category: form.category,
        base_amount: base,
        iva_rate: Number(form.iva_rate),
      });
      toast.success("Gasto registrado");
      setOpen(false);
      setForm(emptyForm());
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (exp) => {
    if (!window.confirm("¿Eliminar este gasto?")) return;
    await api.delete(`/expenses/${exp.id}`);
    toast.success("Gasto eliminado");
    load();
  };

  const totalGastos = expenses.reduce((s, e) => s + (e.base || 0), 0);
  const totalIvaSoportado = expenses.reduce((s, e) => s + (e.iva_amount || 0), 0);

  return (
    <Layout>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter text-[#111111]">Gastos</h1>
          <p className="text-sm text-[#666666] mt-1">Registra tus compras para deducir el IVA soportado</p>
        </div>
        <Button onClick={() => { setForm(emptyForm()); setOpen(true); }} className="bg-[#0A0A0A] hover:bg-[#262626] text-white rounded-md" data-testid="new-expense-button">
          <Plus className="w-4 h-4 mr-2" /> Nuevo gasto
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <div className="bg-white border border-[#E5E5E5] rounded-md p-4">
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#666666]">Total gastos</div>
          <div className="font-heading text-2xl font-black mt-1" data-testid="total-gastos">{eur(totalGastos)}</div>
        </div>
        <div className="bg-white border border-[#E5E5E5] rounded-md p-4">
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#666666]">IVA soportado</div>
          <div className="font-heading text-2xl font-black mt-1 text-[#2A9D8F]" data-testid="total-iva-soportado">{eur(totalIvaSoportado)}</div>
        </div>
      </div>

      <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16 text-[#666666]" data-testid="expenses-empty">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Aún no has registrado ningún gasto.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA]">
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((exp, i) => (
                <TableRow key={exp.id} className="row-in" style={{ animationDelay: `${i * 30}ms` }} data-testid={`expense-row-${i}`}>
                  <TableCell className="text-sm">{exp.date}</TableCell>
                  <TableCell className="text-sm font-medium">{exp.vendor_name}{exp.description ? <span className="text-[#666666] font-normal"> · {exp.description}</span> : null}</TableCell>
                  <TableCell className="text-sm text-[#666666]">{exp.category}</TableCell>
                  <TableCell className="text-right text-sm">{eur(exp.base)}</TableCell>
                  <TableCell className="text-right text-sm text-[#2A9D8F]">{eur(exp.iva_amount)} ({exp.iva_rate}%)</TableCell>
                  <TableCell className="text-right text-sm font-bold">{eur(exp.total)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(exp)} className="h-8 w-8 text-[#E63946]" data-testid={`expense-delete-${i}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" data-testid="expense-dialog">
          <DialogHeader><DialogTitle className="font-heading text-xl">Nuevo gasto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="expense-date" />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="expense-category"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} data-testid="expense-vendor" />
              </div>
              <div className="space-y-2">
                <Label>NIF/CIF proveedor</Label>
                <Input value={form.vendor_nif} onChange={(e) => setForm({ ...form, vendor_nif: e.target.value })} data-testid="expense-vendor-nif" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="expense-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base imponible (€)</Label>
                <Input type="number" step="0.01" value={form.base_amount} onChange={(e) => setForm({ ...form, base_amount: e.target.value })} data-testid="expense-base" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de IVA</Label>
                <Select value={form.iva_rate} onValueChange={(v) => setForm({ ...form, iva_rate: v })}>
                  <SelectTrigger data-testid="expense-iva"><SelectValue /></SelectTrigger>
                  <SelectContent>{IVA_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-md p-4 flex justify-between text-sm">
              <span className="text-[#666666]">IVA soportado: <strong className="text-[#2A9D8F]">{eur(ivaAmount)}</strong></span>
              <span className="font-heading font-black text-[#111111]">Total {eur(base + ivaAmount)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-md">Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-[#0A0A0A] hover:bg-[#262626] text-white rounded-md" data-testid="save-expense">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
