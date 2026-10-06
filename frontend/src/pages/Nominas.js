import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { API, eur, formatApiErrorDetail } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BadgeEuro, Plus, Trash2, Download, Loader2 } from "lucide-react";

const thisPeriod = () => new Date().toISOString().slice(0, 7);

export default function Nominas() {
  const [slips, setSlips] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employee_id: "", period: thisPeriod(), base_salary: "", complements: "0", ss_rate: "6.47", irpf_rate: "", company_ss_rate: "30", other_deductions: "0", notes: "" });

  const load = () => {
    api.get("/payroll").then((r) => setSlips(r.data)).catch(() => {});
    api.get("/employees").then((r) => setEmployees(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ employee_id: "", period: thisPeriod(), base_salary: "", complements: "0", ss_rate: "6.47", irpf_rate: "", company_ss_rate: "30", other_deductions: "0", notes: "" });
    setOpen(true);
  };

  const onEmployee = (id) => {
    const e = employees.find((x) => x.id === id);
    setForm((f) => ({ ...f, employee_id: id, base_salary: String(e?.monthly_gross ?? ""), irpf_rate: String(e?.irpf_rate ?? ""), ss_rate: String(e?.ss_rate ?? "6.47") }));
  };

  const n = (v) => Number(v) || 0;
  const gross = n(form.base_salary) + n(form.complements);
  const ss = gross * n(form.ss_rate) / 100;
  const irpf = gross * n(form.irpf_rate) / 100;
  const ded = ss + irpf + n(form.other_deductions);
  const net = gross - ded;
  const compCost = gross + gross * n(form.company_ss_rate) / 100;

  const save = async () => {
    if (!form.employee_id) { toast.error("Selecciona un trabajador"); return; }
    if (!/^\d{4}-\d{2}$/.test(form.period)) { toast.error("Periodo inválido (AAAA-MM)"); return; }
    setSaving(true);
    try {
      const payload = {
        employee_id: form.employee_id, period: form.period,
        base_salary: n(form.base_salary), complements: n(form.complements),
        ss_rate: n(form.ss_rate), irpf_rate: n(form.irpf_rate),
        company_ss_rate: n(form.company_ss_rate), other_deductions: n(form.other_deductions), notes: form.notes,
      };
      await api.post("/payroll", payload);
      toast.success("Nómina generada");
      setOpen(false); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setSaving(false); }
  };

  const remove = async (s) => {
    if (!window.confirm("¿Eliminar esta nómina?")) return;
    try { await api.delete(`/payroll/${s.id}`); toast.success("Nómina eliminada"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const downloadPdf = (s) => {
    const a = document.createElement("a");
    a.href = `${API}/payroll/${s.id}/pdf`;
    a.download = `nomina_${(s.employee_name || "trabajador").replace(/\s+/g, "_")}_${s.period}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="payroll-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2"><BadgeEuro className="w-6 h-6 text-[#0052FF]" strokeWidth={1.5} /> Nóminas</h1>
            <p className="text-sm text-slate-500 mt-0.5">Genera nóminas mensuales con el líquido a percibir y el coste de empresa.</p>
          </div>
          <Button onClick={openNew} disabled={employees.length === 0} className="bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl" data-testid="new-payslip"><Plus className="w-4 h-4 mr-1.5" /> Nueva nómina</Button>
        </div>

        {employees.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">Primero añade trabajadores en la sección <b>Trabajadores</b> para poder generar nóminas.</div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          {slips.length === 0 ? (
            <div className="text-center text-slate-400 py-16 text-sm">Aún no hay nóminas generadas.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead><TableHead>Trabajador</TableHead>
                  <TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Deducciones</TableHead>
                  <TableHead className="text-right">Líquido</TableHead><TableHead className="text-right">Coste empresa</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slips.map((s, i) => (
                  <TableRow key={s.id} data-testid={`payslip-row-${i}`} className="hover:bg-slate-50/60">
                    <TableCell className="text-sm text-slate-600 tabular">{s.period}</TableCell>
                    <TableCell className="font-medium text-slate-900">{s.employee_name}</TableCell>
                    <TableCell className="text-right text-sm tabular">{eur(s.gross)}</TableCell>
                    <TableCell className="text-right text-sm text-slate-500 tabular">{eur(s.deductions)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-[#0052FF] tabular">{eur(s.net)}</TableCell>
                    <TableCell className="text-right text-sm text-slate-500 tabular">{eur(s.company_cost)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-[#0052FF]" title="Descargar PDF" onClick={() => downloadPdf(s)} data-testid={`payslip-pdf-${i}`}><Download className="w-4 h-4" strokeWidth={1.5} /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => remove(s)} data-testid={`payslip-delete-${i}`}><Trash2 className="w-4 h-4" strokeWidth={1.5} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="payslip-dialog">
            <DialogHeader><DialogTitle className="font-display">Nueva nómina</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Trabajador</Label>
                <Select value={form.employee_id} onValueChange={onEmployee}>
                  <SelectTrigger data-testid="payslip-employee"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-sm">Periodo (AAAA-MM)</Label><Input type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} data-testid="payslip-period" /></div>
              <div className="space-y-1.5"><Label className="text-sm">Salario base (€)</Label><Input type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} data-testid="payslip-base" /></div>
              <div className="space-y-1.5"><Label className="text-sm">Complementos (€)</Label><Input type="number" step="0.01" value={form.complements} onChange={(e) => setForm({ ...form, complements: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-sm">Seg. Social trabajador (%)</Label><Input type="number" step="0.01" value={form.ss_rate} onChange={(e) => setForm({ ...form, ss_rate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-sm">Retención IRPF (%)</Label><Input type="number" step="0.01" value={form.irpf_rate} onChange={(e) => setForm({ ...form, irpf_rate: e.target.value })} data-testid="payslip-irpf" /></div>
              <div className="space-y-1.5"><Label className="text-sm">Otras deducciones (€)</Label><Input type="number" step="0.01" value={form.other_deductions} onChange={(e) => setForm({ ...form, other_deductions: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-sm">S.S. empresa (%)</Label><Input type="number" step="0.01" value={form.company_ss_rate} onChange={(e) => setForm({ ...form, company_ss_rate: e.target.value })} /></div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><div className="text-slate-400 text-xs">Bruto</div><div className="font-semibold text-slate-900 tabular">{eur(gross)}</div></div>
              <div><div className="text-slate-400 text-xs">Deducciones</div><div className="font-semibold text-slate-900 tabular">{eur(ded)}</div></div>
              <div><div className="text-slate-400 text-xs">Líquido a percibir</div><div className="font-bold text-[#0052FF] tabular" data-testid="payslip-net">{eur(net)}</div></div>
              <div><div className="text-slate-400 text-xs">Coste empresa</div><div className="font-semibold text-slate-900 tabular">{eur(compCost)}</div></div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-200">Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl" data-testid="save-payslip">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Generar nómina
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
