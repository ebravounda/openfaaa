import { useState } from "react";
import { toast } from "sonner";
import api, { eur } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, CheckCircle2, FileSpreadsheet, Users, Receipt, FileText } from "lucide-react";

const ENTITIES = [
  { key: "contacts", label: "Clientes / Proveedores", icon: Users },
  { key: "invoices", label: "Facturas emitidas", icon: FileText },
  { key: "expenses", label: "Gastos / Compras", icon: Receipt },
];
const NONE = "__none__";

export default function Importar() {
  const [entity, setEntity] = useState("contacts");
  const [kind, setKind] = useState("client");
  const [preset, setPreset] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null); // {headers, sample, rows, fields, suggested}
  const [mapping, setMapping] = useState({});
  const [result, setResult] = useState(null);

  const reset = () => { setData(null); setMapping({}); };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data: d } = await api.post(`/import/preview?entity=${entity}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setData(d);
      const init = {};
      Object.entries(d.suggested || {}).forEach(([k, v]) => { init[k] = String(v); });
      setMapping(init);
      toast.success(`${d.total} fila(s) detectada(s). Revisa el mapeo de columnas.`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo leer el archivo");
    } finally { setLoading(false); }
  };

  const setMap = (key, val) => setMapping((m) => ({ ...m, [key]: val === NONE ? "" : val }));

  const previewRows = (data?.sample || []).slice(0, 5);
  const cellFor = (row, key) => {
    const i = mapping[key];
    return i !== undefined && i !== "" && row[Number(i)] !== undefined ? row[Number(i)] : "";
  };

  const commit = async () => {
    if (!data) return;
    const required = data.fields.filter((f) => f.required);
    const missing = required.filter((f) => !mapping[f.key] && mapping[f.key] !== "0");
    if (missing.length) { toast.error(`Asigna una columna a: ${missing.map((f) => f.label).join(", ")}`); return; }
    setSaving(true);
    try {
      const cleanMap = {};
      Object.entries(mapping).forEach(([k, v]) => { if (v !== "" && v !== undefined && v !== null) cleanMap[k] = Number(v); });
      const { data: res } = await api.post("/import/commit", { entity, kind, mapping: cleanMap, rows: data.rows });
      toast.success(`Importación completada: ${res.created} creados, ${res.skipped} omitidos.`);
      setResult({ ...res, entity });
      setData(null);
      setMapping({});
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo importar");
    } finally { setSaving(false); }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6" data-testid="import-page">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-6 h-6 text-[#0052FF]" strokeWidth={1.5} /> Importar datos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Trae tu contabilidad desde Holded, NCS, Contaplus u otros sistemas en CSV o Excel.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>¿Qué quieres importar?</Label>
              <Select value={entity} onValueChange={(v) => { setEntity(v); reset(); }}>
                <SelectTrigger data-testid="import-entity"><SelectValue /></SelectTrigger>
                <SelectContent>{ENTITIES.map((e) => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {entity === "contacts" && (
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger data-testid="import-kind"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="client">Clientes</SelectItem><SelectItem value="provider">Proveedores</SelectItem></SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Origen</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger data-testid="import-preset"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (detectar columnas)</SelectItem>
                  <SelectItem value="holded">Holded</SelectItem>
                  <SelectItem value="ncs">NCS</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl py-10 cursor-pointer hover:border-[#0052FF]/40 hover:bg-slate-50/60 transition-all" data-testid="import-dropzone">
            {loading ? <Loader2 className="w-7 h-7 text-[#0052FF] animate-spin" /> : <FileSpreadsheet className="w-7 h-7 text-slate-400" strokeWidth={1.5} />}
            <span className="text-sm text-slate-600 mt-2 font-medium">{loading ? "Analizando archivo…" : "Haz clic para subir un CSV o Excel"}</span>
            <span className="text-xs text-slate-400 mt-0.5">.csv, .xlsx — exportado desde tu sistema actual</span>
            <input type="file" accept=".csv,.txt,.xlsx,.xlsm" onChange={onFile} className="hidden" data-testid="import-file-input" />
          </label>
        </div>

        {result && (
          <div className="bg-white border border-slate-200 rounded-xl p-5" data-testid="import-result">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" strokeWidth={2} />
              <h2 className="font-semibold text-slate-900">Importación completada</h2>
            </div>
            <div className="flex gap-6 text-sm mb-3">
              <div><span className="text-slate-400">Creados: </span><span className="font-semibold text-emerald-700">{result.created}</span></div>
              <div><span className="text-slate-400">Omitidos (duplicados/incompletos): </span><span className="font-semibold text-amber-700">{result.skipped}</span></div>
            </div>
            {result.errors?.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 max-h-48 overflow-y-auto">
                <div className="text-xs font-semibold text-amber-800 mb-1.5">Avisos por fila ({result.errors.length}):</div>
                <ul className="text-xs text-amber-700 space-y-0.5 list-disc pl-4">
                  {result.errors.map((er, i) => <li key={i}>{er}</li>)}
                </ul>
              </div>
            )}
            <Button variant="outline" className="border-slate-200 mt-4" onClick={() => setResult(null)} data-testid="import-again">Importar otro archivo</Button>
          </div>
        )}

        {data && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5" data-testid="import-mapping">
            <div>
              <h2 className="font-semibold text-slate-900">Asigna las columnas</h2>
              <p className="text-sm text-slate-500">Relaciona cada campo de OpenFactura con la columna de tu archivo. Hemos rellenado lo que hemos reconocido.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.fields.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <Label className="w-40 shrink-0 text-sm">{f.label}{f.required && <span className="text-red-500"> *</span>}</Label>
                  <Select value={mapping[f.key] ?? NONE} onValueChange={(v) => setMap(f.key, v)}>
                    <SelectTrigger className="h-9" data-testid={`map-${f.key}`}><SelectValue placeholder="— Ninguna —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Ninguna —</SelectItem>
                      {data.headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Columna ${i + 1}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">Vista previa</div>
              <div className="border border-slate-100 rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>{data.fields.map((f) => <TableHead key={f.key} className="whitespace-nowrap">{f.label}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, ri) => (
                      <TableRow key={ri}>
                        {data.fields.map((f) => <TableCell key={f.key} className="text-sm text-slate-600 whitespace-nowrap">{cellFor(row, f.key) || <span className="text-slate-300">—</span>}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{data.total} fila(s) listas para importar</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset} className="border-slate-200">Cancelar</Button>
                <Button onClick={commit} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl" data-testid="import-commit">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Importar {data.total}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
