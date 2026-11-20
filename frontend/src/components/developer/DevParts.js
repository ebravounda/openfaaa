import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, KeyRound, Trash2, Webhook, Send, ExternalLink, Loader2 } from "lucide-react";

const err = (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Error");
const fmt = (d) => (d ? new Date(d).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium" }) : "—");
const copy = (t) => { navigator.clipboard?.writeText(t); toast.success("Copiado"); };
const Card = ({ children, className = "", ...p }) => <div className={`bg-white border border-slate-200 rounded-xl shadow-sm ${className}`} {...p}>{children}</div>;

const CompanySelect = ({ companies, value, onChange, testid }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger data-testid={testid}><SelectValue placeholder="Elige empresa" /></SelectTrigger>
    <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.nif || c.id}</SelectItem>)}</SelectContent>
  </Select>
);

const NewKeyBanner = ({ k, onClose }) => (
  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4" data-testid="new-key-banner">
    <div className="text-sm font-medium text-emerald-900">Clave creada. Cópiala ahora: no se volverá a mostrar.</div>
    <div className="mt-2 flex gap-2">
      <code className="flex-1 truncate rounded-md bg-white border border-emerald-200 px-3 py-2 font-mono text-xs" data-testid="new-key-value">{k}</code>
      <Button size="sm" variant="outline" onClick={() => copy(k)} data-testid="copy-new-key"><Copy className="w-4 h-4" /></Button>
      <Button size="sm" variant="ghost" onClick={onClose} data-testid="close-new-key">Hecho</Button>
    </div>
  </div>
);

export const KeysPanel = ({ companies, onChange }) => {
  const [keys, setKeys] = useState([]);
  const [form, setForm] = useState({ name: "", company_id: companies[0]?.id || "", scope: "write" });
  const [created, setCreated] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/developer/keys").then((r) => setKeys(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const create = async () => {
    setBusy(true);
    try { const { data } = await api.post("/developer/keys", form); setCreated(data.key); setForm({ ...form, name: "" }); load(); onChange?.(); }
    catch (e) { err(e); } finally { setBusy(false); }
  };
  const revoke = async (k) => {
    if (!window.confirm(`¿Revocar la clave «${k.name}»? Los sistemas que la usen dejarán de funcionar.`)) return;
    try { await api.delete(`/developer/keys/${k.id}`); load(); onChange?.(); } catch (e) { err(e); }
  };
  return (
    <div className="space-y-4">
      {created && <NewKeyBanner k={created} onClose={() => setCreated("")} />}
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Tienda online" data-testid="key-name-input" /></div>
          <div className="space-y-1.5"><Label>Empresa</Label><CompanySelect companies={companies} value={form.company_id} onChange={(v) => setForm({ ...form, company_id: v })} testid="key-company-select" /></div>
          <div className="space-y-1.5"><Label>Permisos</Label>
            <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
              <SelectTrigger data-testid="key-scope-select"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="write">Lectura y escritura</SelectItem><SelectItem value="read">Solo lectura</SelectItem></SelectContent>
            </Select>
          </div>
          <Button onClick={create} disabled={busy || !form.name.trim() || !form.company_id} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="create-key-button">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}Crear clave
          </Button>
        </div>
      </Card>
      <Card className="divide-y divide-slate-100" data-testid="keys-list">
        {keys.length === 0 && <div className="p-6 text-sm text-slate-500">Aún no tienes claves de API.</div>}
        {keys.map((k) => (
          <div key={k.id} className="p-4 flex flex-wrap items-center gap-3" data-testid={`key-row-${k.id}`}>
            <KeyRound className="w-4 h-4 text-slate-400" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-900">{k.name} <span className="font-mono text-xs text-slate-400">{k.prefix}…</span></div>
              <div className="text-xs text-slate-500">{k.company_name} · creada {fmt(k.created_at)} · último uso {fmt(k.last_used_at)}</div>
            </div>
            <Badge variant="outline">{k.scope === "read" ? "Solo lectura" : "Lectura y escritura"}</Badge>
            {k.revoked ? <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100">Revocada</Badge>
              : <Button size="sm" variant="ghost" className="text-red-600" onClick={() => revoke(k)} data-testid={`revoke-key-${k.id}`}><Trash2 className="w-4 h-4 mr-1" />Revocar</Button>}
          </div>
        ))}
      </Card>
    </div>
  );
};

const statusCls = (s) => (s < 300 ? "bg-emerald-100 text-emerald-700" : s < 500 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700");

export const LogsPanel = () => {
  const [logs, setLogs] = useState([]);
  const load = () => api.get("/developer/logs?limit=200").then((r) => setLogs(r.data)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  return (
    <Card className="overflow-x-auto" data-testid="logs-table">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
          <th className="text-left p-3">Fecha</th><th className="text-left p-3">Petición</th><th className="text-left p-3">Estado</th>
          <th className="text-right p-3">Tiempo</th><th className="text-left p-3">Clave</th><th className="text-left p-3">IP</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {logs.length === 0 && <tr><td colSpan={6} className="p-6 text-slate-500">Todavía no hay peticiones. Aparecerán aquí en cuanto tu sistema use la API.</td></tr>}
          {logs.map((l) => (
            <tr key={l.id} data-testid={`log-row-${l.id}`}>
              <td className="p-3 text-slate-500 whitespace-nowrap">{fmt(l.at)}</td>
              <td className="p-3 font-mono text-xs"><b className="text-slate-700">{l.method}</b> {l.path}</td>
              <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs font-medium ${statusCls(l.status)}`}>{l.status}</span></td>
              <td className="p-3 text-right tabular text-slate-500">{l.ms} ms</td>
              <td className="p-3 text-slate-600">{l.key_name}</td>
              <td className="p-3 text-slate-400 text-xs">{l.ip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

export const WebhooksPanel = ({ companies, events }) => {
  const [data, setData] = useState({ webhooks: [], deliveries: [] });
  const [form, setForm] = useState({ url: "", company_id: companies[0]?.id || "" });
  const load = () => api.get("/developer/webhooks").then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const add = async () => { try { await api.post("/developer/webhooks", { ...form, events }); setForm({ ...form, url: "" }); load(); toast.success("Webhook añadido"); } catch (e) { err(e); } };
  const test = async (h) => { try { const { data: d } = await api.post(`/developer/webhooks/${h.id}/test`); d?.ok ? toast.success(`Respuesta ${d.status}`) : toast.error(`Sin éxito (${d?.status || d?.error})`); load(); } catch (e) { err(e); } };
  const del = async (h) => { if (window.confirm("¿Eliminar este webhook?")) { await api.delete(`/developer/webhooks/${h.id}`); load(); } };
  return (
    <div className="space-y-4">
      <Card className="p-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="space-y-1.5 md:col-span-2"><Label>URL (https)</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://tu-sistema.com/webhooks/openfactura" data-testid="webhook-url-input" /></div>
        <div className="space-y-1.5"><Label>Empresa</Label><CompanySelect companies={companies} value={form.company_id} onChange={(v) => setForm({ ...form, company_id: v })} testid="webhook-company-select" /></div>
        <Button onClick={add} disabled={!form.url.startsWith("https://") || !form.company_id} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="add-webhook-button"><Webhook className="w-4 h-4 mr-2" />Añadir webhook</Button>
        <div className="md:col-span-4 text-xs text-slate-500">Eventos: {events.map((e) => <code key={e} className="mr-2">{e}</code>)}</div>
      </Card>
      <Card className="divide-y divide-slate-100" data-testid="webhooks-list">
        {data.webhooks.length === 0 && <div className="p-6 text-sm text-slate-500">Sin webhooks configurados.</div>}
        {data.webhooks.map((h) => (
          <div key={h.id} className="p-4 space-y-2" data-testid={`webhook-row-${h.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-slate-800 break-all flex-1">{h.url}</span>
              <Button size="sm" variant="outline" onClick={() => test(h)} data-testid={`test-webhook-${h.id}`}><Send className="w-4 h-4 mr-1" />Probar</Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(h)} data-testid={`delete-webhook-${h.id}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">{h.company_name} · Secreto de firma:
              <code className="bg-slate-50 border rounded px-1.5">{h.secret}</code>
              <button onClick={() => copy(h.secret)} className="text-[#0052FF]" data-testid={`copy-secret-${h.id}`}>copiar</button></div>
          </div>
        ))}
      </Card>
      {data.deliveries.length > 0 && (
        <Card className="p-4" data-testid="webhook-deliveries">
          <div className="text-sm font-medium mb-2">Últimos envíos</div>
          {data.deliveries.slice(0, 20).map((d) => (
            <div key={d.id} className="flex gap-3 text-xs py-1 border-b border-slate-50 last:border-0">
              <span className="text-slate-400 w-36">{fmt(d.at)}</span><code className="flex-1">{d.event}</code>
              <span className={`rounded px-1.5 ${d.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{d.status || d.error}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

const BASE = process.env.REACT_APP_BACKEND_URL;
const EXAMPLE = `curl -X POST ${BASE}/api/v1/invoices \\
  -H "Authorization: Bearer of_live_TU_CLAVE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "issue_date": "2026-11-20",
    "client": {"name": "Cliente SL", "nif": "B12345678", "country": "ES"},
    "line_items": [{"description": "Servicio", "quantity": 1, "unit_price": 100, "iva_type": "general", "iva_rate": 21}]
  }'`;

export const DocsPanel = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <Card className="p-5 lg:col-span-2 space-y-3">
      <div className="font-medium text-slate-900">Primeros pasos</div>
      <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-1">
        <li>Crea una clave en «Claves de API» para la empresa que quieras conectar.</li>
        <li>Envía la clave en cada petición: <code>Authorization: Bearer of_live_…</code></li>
        <li>Prueba con <code>GET /api/v1/me</code> y después crea tu primera factura:</li>
      </ol>
      <pre className="bg-slate-950 text-slate-100 text-xs rounded-lg p-4 overflow-x-auto" data-testid="docs-example">{EXAMPLE}</pre>
      <Button variant="outline" size="sm" onClick={() => copy(EXAMPLE)} data-testid="copy-example"><Copy className="w-4 h-4 mr-1" />Copiar ejemplo</Button>
    </Card>
    <Card className="p-5 space-y-3">
      <div className="font-medium text-slate-900">Referencia completa</div>
      <p className="text-sm text-slate-600">Todos los endpoints, campos y respuestas, con pruebas en vivo (OpenAPI 3).</p>
      <a href={`${BASE}/api/v1/docs`} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm font-medium text-[#0052FF]" data-testid="open-api-docs"><ExternalLink className="w-4 h-4 mr-1" />Abrir documentación</a>
      <div className="text-xs text-slate-500 space-y-1 pt-2 border-t">
        <div><b>Webhooks:</b> firma HMAC-SHA256 del cuerpo con tu secreto, en <code>X-OpenFactura-Signature</code>.</div>
        <div><b>Límites:</b> Platino 60 y Multiempresas 120 peticiones por minuto, por clave.</div>
        <div><b>Errores:</b> 401 clave no válida · 403 sin permiso · 422 datos no válidos · 429 límite superado.</div>
      </div>
    </Card>
  </div>
);
