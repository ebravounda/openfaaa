import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Plus, Trash2, Receipt, Loader2, ScanLine, FileText, Sparkles, Paperclip, Pencil, Search,
  AlertTriangle, Files, X,
} from "lucide-react";

const IVA_OPTIONS = ["21", "10", "4", "0"];
const CATEGORIES = ["General", "Suministros", "Material", "Servicios", "Alquiler", "Software", "Transporte", "Otros"];

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  vendor_name: "", vendor_nif: "", description: "", category: "General",
  base_amount: "", iva_rate: "21", invoice_number: "", attachment_path: "", save_provider: false,
});

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState("");
  const fileRef = useRef(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchItems, setBatchItems] = useState([]);
  const [batchSaving, setBatchSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/expenses").then((r) => setExpenses(r.data)).finally(() => setLoading(false));
  };
  const loadProviders = () => api.get("/contacts?kind=provider").then((r) => setProviders(r.data));
  useEffect(() => { load(); loadProviders(); }, []);

  const base = Number(form.base_amount) || 0;
  const ivaAmount = (base * Number(form.iva_rate)) / 100;

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(""); setPreviewType("");
  };

  const loadPreview = async (path) => {
    try {
      const res = await api.get(`/files/${path}`, { responseType: "blob" });
      setPreviewType(res.data.type || "");
      setPreviewUrl(URL.createObjectURL(res.data));
    } catch (e) {}
  };

  const openManual = () => { clearPreview(); setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (exp) => {
    clearPreview();
    setEditingId(exp.id);
    setForm({
      date: exp.date, vendor_name: exp.vendor_name || "", vendor_nif: exp.vendor_nif || "",
      description: exp.description || "", category: CATEGORIES.includes(exp.category) ? exp.category : "General",
      base_amount: String(exp.base ?? exp.base_amount ?? ""), iva_rate: String(exp.iva_rate),
      invoice_number: exp.invoice_number || "",
      attachment_path: exp.attachment_path || "", save_provider: false,
    });
    if (exp.attachment_path) loadPreview(exp.attachment_path);
    setOpen(true);
  };

  const onScanFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = "";
    if (files.length === 0) return;
    if (files.length > 15) { toast.error("Máximo 15 archivos por lote"); return; }
    setScanning(true);
    try {
      if (files.length === 1) {
        const fd = new FormData();
        fd.append("file", files[0]);
        const { data } = await api.post("/expenses/scan", fd, { headers: { "Content-Type": "multipart/form-data" } });
        const ex = data.extracted || {};
        clearPreview();
        setEditingId(null);
        setForm({
          date: ex.date || new Date().toISOString().slice(0, 10),
          vendor_name: ex.vendor_name || "",
          vendor_nif: ex.vendor_nif || "",
          description: ex.description || "",
          category: CATEGORIES.includes(ex.category) ? ex.category : "General",
          base_amount: ex.base_amount ? String(ex.base_amount) : "",
          iva_rate: IVA_OPTIONS.includes(String(ex.iva_rate)) ? String(ex.iva_rate) : "21",
          invoice_number: ex.invoice_number || "",
          attachment_path: data.attachment_path || "",
          save_provider: false,
        });
        loadPreview(data.attachment_path);
        setOpen(true);
        if (data.duplicate) toast.warning("Posible duplicado: ya existe un gasto igual guardado. Revísalo antes de guardar.");
        else toast.success("Documento analizado. Revisa los datos y guarda.");
      } else {
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        const { data } = await api.post("/expenses/scan-batch", fd, { headers: { "Content-Type": "multipart/form-data" } });
        const items = (data.items || []).map((it) => {
          const ex = it.extracted || {};
          return {
            key: it.id,
            include: !it.duplicate && !it.error,
            duplicate: !!it.duplicate,
            duplicate_type: it.duplicate_type,
            error: it.error || null,
            filename: it.filename,
            page: it.page,
            attachment_path: it.attachment_path || "",
            date: ex.date || new Date().toISOString().slice(0, 10),
            vendor_name: ex.vendor_name || "",
            vendor_nif: ex.vendor_nif || "",
            description: ex.description || "",
            category: CATEGORIES.includes(ex.category) ? ex.category : "General",
            base_amount: ex.base_amount ? String(ex.base_amount) : "",
            iva_rate: IVA_OPTIONS.includes(String(ex.iva_rate)) ? String(ex.iva_rate) : "21",
            invoice_number: ex.invoice_number || "",
          };
        });
        setBatchItems(items);
        setBatchOpen(true);
        const dups = items.filter((i) => i.duplicate).length;
        toast.success(`${items.length} documento(s) analizados${dups ? ` · ${dups} posible(s) duplicado(s)` : ""}`);
      }
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "No se pudo escanear");
    } finally {
      setScanning(false);
    }
  };

  const updateBatchItem = (key, patch) => setBatchItems((arr) => arr.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const removeBatchItem = (key) => setBatchItems((arr) => arr.filter((i) => i.key !== key));
  const batchRowTotal = (i) => (Number(i.base_amount) || 0) * (1 + Number(i.iva_rate) / 100);

  const saveBatch = async () => {
    const toSave = batchItems.filter((i) => i.include && !i.error);
    if (toSave.length === 0) { toast.error("Marca al menos un gasto válido para guardar"); return; }
    const invalid = toSave.filter((i) => !i.vendor_name.trim() || !(Number(i.base_amount) > 0));
    if (invalid.length) { toast.error("Revisa: hay gastos sin proveedor o sin base imponible"); return; }
    setBatchSaving(true);
    try {
      const items = toSave.map((i) => ({
        date: i.date, vendor_name: i.vendor_name, vendor_nif: i.vendor_nif,
        description: i.description, category: i.category,
        base_amount: Number(i.base_amount), iva_rate: Number(i.iva_rate),
        invoice_number: i.invoice_number, attachment_path: i.attachment_path,
      }));
      const { data } = await api.post("/expenses/bulk", { items });
      toast.success(`${data.created} gasto(s) guardados`);
      setBatchOpen(false);
      setBatchItems([]);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudieron guardar");
    } finally {
      setBatchSaving(false);
    }
  };

  const pickProvider = (id) => {
    const p = providers.find((x) => x.id === id);
    if (p) setForm((f) => ({ ...f, vendor_name: p.name, vendor_nif: p.nif }));
  };

  const lookupVendorNif = async () => {
    const nif = form.vendor_nif.trim();
    if (!nif) return toast.error("Introduce el NIF/CIF a buscar");
    setLookingUp(true);
    try {
      const { data } = await api.get(`/lookup/nif?nif=${encodeURIComponent(nif)}`);
      if (!data.valid) return toast.error("NIF/CIF no válido según VIES");
      if (data.name) {
        setForm((f) => ({ ...f, vendor_name: data.name, description: f.description || (data.address || "") }));
        toast.success(data.source === "Contactos guardados" ? `Proveedor cargado de tus contactos: ${data.name}` : `Encontrado: ${data.name}`);
      } else {
        toast.success("NIF/CIF válido. VIES no facilita el nombre para este contribuyente; complétalo a mano.");
      }
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLookingUp(false);
    }
  };

  const save = async () => {
    if (!form.vendor_name.trim()) return toast.error("Introduce el proveedor");
    if (!base) return toast.error("Introduce el importe base");
    setSaving(true);
    const payload = {
      date: form.date, vendor_name: form.vendor_name, vendor_nif: form.vendor_nif,
      description: form.description, category: form.category, invoice_number: form.invoice_number,
      base_amount: base, iva_rate: Number(form.iva_rate), attachment_path: form.attachment_path,
    };
    try {
      if (editingId) {
        await api.put(`/expenses/${editingId}`, payload);
        toast.success("Gasto actualizado");
      } else {
        await api.post("/expenses", payload);
        if (form.save_provider) { try { await api.post("/contacts", { name: form.vendor_name, nif: form.vendor_nif, kind: "provider" }); loadProviders(); } catch (e) {} }
        toast.success("Gasto registrado");
      }
      setOpen(false); clearPreview(); setEditingId(null); setForm(emptyForm()); load();
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
  const totalIva = expenses.reduce((s, e) => s + (e.iva_amount || 0), 0);
  const hasPreview = !!form.attachment_path;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Gastos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Escanea uno o varios tickets y facturas a la vez (imágenes o PDF) o añádelos a mano</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" onChange={onScanFile} className="hidden" data-testid="scan-file-input" />
          <Button onClick={() => fileRef.current?.click()} disabled={scanning} className="bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl shadow-[0_4px_14px_0_rgba(0,82,255,0.39)] transition-all hover:-translate-y-0.5 active:scale-95" data-testid="scan-button">
            {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ScanLine className="w-4 h-4 mr-2" strokeWidth={1.5} />}
            {scanning ? "Analizando…" : "Escanear con IA"}
          </Button>
          <Button variant="outline" onClick={openManual} className="border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all" data-testid="new-expense-button">
            <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} /> Manual
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-w-md">
        <div className="bg-white border border-slate-200/60 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total gastos</div>
          <div className="font-display text-2xl font-semibold tracking-tight mt-1 tabular" data-testid="total-gastos">{eur(totalGastos)}</div>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">IVA soportado</div>
          <div className="font-display text-2xl font-semibold tracking-tight mt-1 tabular text-[#0052FF]" data-testid="total-iva-soportado">{eur(totalIva)}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
        ) : expenses.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 m-5 rounded-2xl py-14 text-center" data-testid="expenses-empty">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center"><Receipt className="w-7 h-7 text-slate-300" strokeWidth={1.25} /></div>
            <p className="text-slate-500 mt-3">Sin gastos todavía. Prueba a escanear un ticket con IA.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-slate-100 [&>th]:text-[11px] [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-slate-500 [&>th]:font-semibold [&>th]:bg-slate-50/50 [&>th]:h-11">
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((exp, i) => (
                <TableRow key={exp.id} data-testid={`expense-row-${i}`} className="hover:bg-slate-50/60 transition-colors border-b border-slate-100 last:border-0">
                  <TableCell className="text-sm text-slate-600 tabular">{exp.date}</TableCell>
                  <TableCell className="text-sm font-medium text-slate-900">
                    <span className="inline-flex items-center gap-1.5">
                      {exp.attachment_path && <Paperclip className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />}
                      {exp.vendor_name}
                    </span>
                    {exp.description ? <span className="text-slate-400 font-normal"> · {exp.description}</span> : null}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{exp.category}</TableCell>
                  <TableCell className="text-right text-sm tabular">{eur(exp.base)}</TableCell>
                  <TableCell className="text-right text-sm text-[#0052FF] tabular">{eur(exp.iva_amount)} <span className="text-slate-400">({exp.iva_rate}%)</span></TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular">{eur(exp.total)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(exp)} className="h-8 w-8 text-slate-500 hover:text-[#0052FF]" data-testid={`expense-edit-${i}`}><Pencil className="w-4 h-4" strokeWidth={1.5} /></Button>
                      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => remove(exp)} className="h-8 w-8 text-slate-400 hover:text-red-600" data-testid={`expense-delete-${i}`}><Trash2 className="w-4 h-4" strokeWidth={1.5} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) clearPreview(); }}>
        <DialogContent className={hasPreview ? "max-w-3xl max-h-[92vh] overflow-y-auto" : "max-w-lg"} data-testid="expense-dialog">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {hasPreview && !editingId && <Sparkles className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} />}
              {editingId ? "Editar gasto" : hasPreview ? "Revisar gasto escaneado" : "Nuevo gasto"}
            </DialogTitle>
          </DialogHeader>

          <div className={hasPreview ? "grid grid-cols-1 md:grid-cols-2 gap-5" : ""}>
            {hasPreview && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden md:sticky md:top-0 h-[360px] flex items-center justify-center" data-testid="scan-preview">
                {!previewUrl ? (
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                ) : previewType.includes("pdf") ? (
                  <div className="text-center text-slate-500 p-6"><FileText className="w-12 h-12 mx-auto text-slate-300" strokeWidth={1.25} /><p className="text-sm mt-2">Documento PDF adjunto</p></div>
                ) : (
                  <img src={previewUrl} alt="Documento" className="w-full h-full object-contain" />
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="expense-date" /></div>
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger data-testid="expense-category"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {providers.length > 0 && !editingId && (
                <div className="space-y-2">
                  <Label>Proveedor guardado</Label>
                  <Select onValueChange={pickProvider}>
                    <SelectTrigger data-testid="pick-provider"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                    <SelectContent>{providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Proveedor</Label><Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} data-testid="expense-vendor" /></div>
                <div className="space-y-2">
                  <Label>NIF/CIF</Label>
                  <div className="flex gap-2">
                    <Input value={form.vendor_nif} onChange={(e) => setForm({ ...form, vendor_nif: e.target.value })} placeholder="B12345678" data-testid="expense-vendor-nif" />
                    <Button type="button" variant="outline" onClick={lookupVendorNif} disabled={lookingUp} className="border-slate-200 shrink-0" data-testid="expense-lookup-nif" title="Buscar proveedor por NIF/CIF">
                      {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" strokeWidth={1.5} />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Descripción</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="expense-description" /></div>
                <div className="space-y-2"><Label>Nº factura</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="Opcional" data-testid="expense-invoice-number" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Base imponible (€)</Label><Input type="number" step="0.01" value={form.base_amount} onChange={(e) => setForm({ ...form, base_amount: e.target.value })} data-testid="expense-base" /></div>
                <div className="space-y-2">
                  <Label>Tipo de IVA</Label>
                  <Select value={form.iva_rate} onValueChange={(v) => setForm({ ...form, iva_rate: v })}>
                    <SelectTrigger data-testid="expense-iva"><SelectValue /></SelectTrigger>
                    <SelectContent>{IVA_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}%</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {!editingId && (
                <div className="flex items-center gap-2">
                  <Checkbox id="save_provider" checked={form.save_provider} onCheckedChange={(v) => setForm({ ...form, save_provider: !!v })} data-testid="save-provider-checkbox" />
                  <label htmlFor="save_provider" className="text-sm text-slate-600 cursor-pointer">Guardar como proveedor</label>
                </div>
              )}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between text-sm">
                <span className="text-slate-500">IVA soportado: <strong className="text-[#0052FF] tabular">{eur(ivaAmount)}</strong></span>
                <span className="font-display font-semibold text-slate-900 tabular">Total {eur(base + ivaAmount)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); clearPreview(); }} className="border-slate-200">Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl shadow-[0_4px_14px_0_rgba(0,82,255,0.39)] transition-all hover:-translate-y-0.5 active:scale-95" data-testid="save-expense">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingId ? "Guardar cambios" : "Guardar gasto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchOpen} onOpenChange={(v) => { setBatchOpen(v); if (!v) setBatchItems([]); }}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="batch-dialog">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Files className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} /> Revisar gastos escaneados
            </DialogTitle>
            <p className="text-sm text-slate-500">
              {batchItems.length} documento(s) detectado(s). Revisa, categoriza y guarda. Los posibles duplicados aparecen desmarcados por defecto.
            </p>
          </DialogHeader>

          <div className="space-y-3">
            {batchItems.map((it) => (
              <div key={it.key} className={`rounded-xl border p-4 ${it.error ? "border-red-200 bg-red-50/40" : it.duplicate ? "border-amber-200 bg-amber-50/40" : "border-slate-200"}`} data-testid={`batch-item-${it.key}`}>
                <div className="flex items-center justify-between mb-3 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {!it.error && (
                      <Checkbox checked={it.include} onCheckedChange={(v) => updateBatchItem(it.key, { include: !!v })} data-testid={`batch-include-${it.key}`} />
                    )}
                    <span className="text-xs text-slate-500 truncate">{it.filename}{it.page ? ` · pág. ${it.page}` : ""}</span>
                    {it.duplicate && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap"><AlertTriangle className="w-3 h-3" /> {it.duplicate_type === "existing" ? "Ya existe guardada" : "Duplicada en el lote"}</span>
                    )}
                    {it.error && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap"><AlertTriangle className="w-3 h-3" /> {it.error}</span>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 shrink-0" onClick={() => removeBatchItem(it.key)} data-testid={`batch-remove-${it.key}`}><X className="w-4 h-4" /></Button>
                </div>
                {!it.error && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1"><Label className="text-[11px] text-slate-500">Fecha</Label><Input type="date" value={it.date} onChange={(e) => updateBatchItem(it.key, { date: e.target.value })} className="h-9" /></div>
                    <div className="space-y-1 col-span-2"><Label className="text-[11px] text-slate-500">Proveedor</Label><Input value={it.vendor_name} onChange={(e) => updateBatchItem(it.key, { vendor_name: e.target.value })} className="h-9" data-testid={`batch-vendor-${it.key}`} /></div>
                    <div className="space-y-1"><Label className="text-[11px] text-slate-500">NIF/CIF</Label><Input value={it.vendor_nif} onChange={(e) => updateBatchItem(it.key, { vendor_nif: e.target.value })} className="h-9" /></div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-500">Categoría</Label>
                      <Select value={it.category} onValueChange={(v) => updateBatchItem(it.key, { category: v })}>
                        <SelectTrigger className="h-9" data-testid={`batch-category-${it.key}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-500">IVA</Label>
                      <Select value={it.iva_rate} onValueChange={(v) => updateBatchItem(it.key, { iva_rate: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{IVA_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}%</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label className="text-[11px] text-slate-500">Base (€)</Label><Input type="number" step="0.01" value={it.base_amount} onChange={(e) => updateBatchItem(it.key, { base_amount: e.target.value })} className="h-9" data-testid={`batch-base-${it.key}`} /></div>
                    <div className="space-y-1"><Label className="text-[11px] text-slate-500">Total</Label><div className="h-9 flex items-center px-2 text-sm font-semibold tabular text-slate-900">{eur(batchRowTotal(it))}</div></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <div className="mr-auto text-sm text-slate-500 flex items-center" data-testid="batch-selected-count">
              {batchItems.filter((i) => i.include && !i.error).length} seleccionado(s) para guardar
            </div>
            <Button variant="outline" onClick={() => { setBatchOpen(false); setBatchItems([]); }} className="border-slate-200">Cancelar</Button>
            <Button onClick={saveBatch} disabled={batchSaving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl shadow-[0_4px_14px_0_rgba(0,82,255,0.39)] transition-all hover:-translate-y-0.5 active:scale-95" data-testid="save-batch">
              {batchSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar seleccionados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
