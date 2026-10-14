import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, Mail, Eye, Pencil, FileCheck2, Truck, Loader2 } from "lucide-react";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { AlbaranDialog, FacturarDialog, emptyAlbaran, albaranToForm, formToPayload } from "./AlbaranDialogs";

const ST = { pendiente: ["Pendiente", "bg-amber-100 text-amber-800"], entregado: ["Entregado", "bg-emerald-100 text-emerald-700"], facturado: ["Facturado", "bg-purple-100 text-purple-700"] };
const Tip = ({ label, children }) => <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;

export const AlbaranesTab = ({ clients, reloadSignal }) => {
  const [list, setList] = useState(null);
  const [sel, setSel] = useState([]);
  const [dlg, setDlg] = useState(null);
  const [form, setForm] = useState(emptyAlbaran());
  const [preview, setPreview] = useState(null);
  const [facturar, setFacturar] = useState(null);
  const [sending, setSending] = useState("");
  const load = () => api.get("/albaranes").then((r) => { setList(r.data); setSel([]); });
  useEffect(() => { load(); }, [reloadSignal]);

  const openNew = async () => {
    const f = emptyAlbaran();
    let number = "";
    try { number = (await api.get("/albaranes/next-number", { params: { issue_date: f.issue_date } })).data.number; } catch (e) { /* noop */ }
    setForm(f); setDlg({ editing: null, number });
  };
  const openEdit = (a) => { setForm(albaranToForm(a)); setDlg({ editing: a.id, number: a.number }); };
  const status = async (a, s) => { try { await api.patch(`/albaranes/${a.id}/status`, { status: s }); load(); } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } };
  const remove = async (a) => { if (!window.confirm(`¿Eliminar el albarán ${a.number}?`)) return; try { await api.delete(`/albaranes/${a.id}`); toast.success("Albarán eliminado"); load(); } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } };
  const email = async (a) => {
    if (!a.client?.email) return toast.error("El cliente no tiene email registrado");
    setSending(a.id);
    try { await api.post(`/albaranes/${a.id}/send-email`); toast.success(`Albarán enviado a ${a.client.email}`); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setSending(""); }
  };
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const open = (list || []).filter((a) => a.status !== "facturado");

  return (
    <div data-testid="albaranes-tab">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-slate-500">Documenta las entregas a tus clientes y factúralas cuando quieras, una a una o agrupadas.</p>
        <div className="flex gap-2">
          {sel.length > 0 && <Button variant="outline" onClick={() => setFacturar(list.filter((a) => sel.includes(a.id)))} data-testid="albaranes-facturar-selected"><FileCheck2 className="w-4 h-4 mr-1.5" />Facturar seleccionados ({sel.length})</Button>}
          <Button onClick={openNew} className="bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl" data-testid="new-albaran-button"><Plus className="w-4 h-4 mr-2" />Nuevo albarán</Button>
        </div>
      </div>
      <div className="bg-white border border-slate-200/60 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        {!list ? <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
          : !list.length ? (
            <div className="border-2 border-dashed border-slate-200 m-5 rounded-2xl py-14 text-center" data-testid="albaranes-empty">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center"><Truck className="w-7 h-7 text-slate-300" strokeWidth={1.25} /></div>
              <p className="text-slate-500 mt-3">Aún no has creado ningún albarán. También puedes crearlo desde un presupuesto.</p>
            </div>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow className="[&>th]:text-[11px] [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-slate-500 [&>th]:bg-slate-50/50">
                <TableHead className="w-8"><Checkbox checked={open.length > 0 && sel.length === open.length} onCheckedChange={(v) => setSel(v ? open.map((a) => a.id) : [])} data-testid="albaranes-select-all" /></TableHead>
                <TableHead>Nº</TableHead><TableHead>Entrega</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead>
              </TableRow></TableHeader>
              <TableBody>{list.map((a) => (
                <TableRow key={a.id} data-testid={`albaran-row-${a.number}`}>
                  <TableCell>{a.status !== "facturado" && <Checkbox checked={sel.includes(a.id)} onCheckedChange={() => toggle(a.id)} data-testid={`albaran-select-${a.number}`} />}</TableCell>
                  <TableCell className="font-mono text-sm font-medium">{a.number}{a.quote_number && <div className="text-[11px] text-slate-400 font-sans">de {a.quote_number}</div>}</TableCell>
                  <TableCell className="text-sm text-slate-600 tabular">{a.delivery_date || a.issue_date}</TableCell>
                  <TableCell className="text-sm font-medium">{a.client?.name}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular">{eur(a.total)}{a.show_prices === false && <div className="text-[11px] text-slate-400 font-normal">PDF sin precios</div>}</TableCell>
                  <TableCell>{a.status === "facturado"
                    ? <Badge className={`${ST.facturado[1]} rounded-full`} data-testid={`albaran-status-${a.number}`}>Facturado · {a.invoice_number}</Badge>
                    : <Select value={a.status} onValueChange={(v) => status(a, v)}><SelectTrigger className={`h-7 w-[120px] rounded-full border-0 text-xs font-medium ${ST[a.status]?.[1]}`} data-testid={`albaran-status-${a.number}`}><SelectValue>{ST[a.status]?.[0]}</SelectValue></SelectTrigger>
                      <SelectContent><SelectItem value="pendiente">Pendiente</SelectItem><SelectItem value="entregado">Entregado</SelectItem></SelectContent></Select>}</TableCell>
                  <TableCell className="text-right"><TooltipProvider delayDuration={150}><div className="flex justify-end gap-0.5">
                    {a.status !== "facturado" && <Tip label="Facturar"><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-purple-600" onClick={() => setFacturar([a])} data-testid={`albaran-facturar-${a.number}`}><FileCheck2 className="w-4 h-4" /></Button></Tip>}
                    {a.status !== "facturado" && <Tip label="Editar"><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-[#0052FF]" onClick={() => openEdit(a)} data-testid={`albaran-edit-${a.number}`}><Pencil className="w-4 h-4" /></Button></Tip>}
                    <Tip label="Vista previa PDF"><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => setPreview({ title: `Albarán ${a.number}`, filename: `albaran-${a.number}.pdf`, load: () => api.get(`/albaranes/${a.id}/pdf`, { responseType: "blob" }).then((r) => r.data) })} data-testid={`albaran-pdf-${a.number}`}><Eye className="w-4 h-4" /></Button></Tip>
                    <Tip label="Enviar por email"><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-[#0052FF]" disabled={sending === a.id} onClick={() => email(a)} data-testid={`albaran-email-${a.number}`}>{sending === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}</Button></Tip>
                    {a.status !== "facturado" && <Tip label="Eliminar"><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => remove(a)} data-testid={`albaran-delete-${a.number}`}><Trash2 className="w-4 h-4" /></Button></Tip>}
                  </div></TooltipProvider></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
          )}
      </div>
      <AlbaranDialog open={!!dlg} onClose={() => setDlg(null)} editing={dlg?.editing} number={dlg?.number} form={form} setForm={setForm} clients={clients}
        onSaved={() => { setDlg(null); load(); }}
        onPreview={() => setPreview({ title: "Vista previa del albarán", filename: "albaran-borrador.pdf", load: () => api.post("/albaranes/preview-pdf", formToPayload(form), { responseType: "blob" }).then((r) => r.data) })} />
      <FacturarDialog items={facturar} onClose={() => setFacturar(null)} onDone={() => { setFacturar(null); load(); }} />
      <PdfPreviewDialog open={!!preview} title={preview?.title} filename={preview?.filename} load={preview?.load || (() => Promise.reject())} onClose={() => setPreview(null)} />
    </div>
  );
};
