import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, Activity, KeyRound, Webhook, AlertTriangle, Lock } from "lucide-react";
import { KeysPanel, LogsPanel, WebhooksPanel, DocsPanel } from "@/components/developer/DevParts";

const Stat = ({ icon: Icon, label, value, testid }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm" data-testid={testid}>
    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500"><Icon className="w-3.5 h-3.5" />{label}</div>
    <div className="mt-1 text-2xl font-semibold text-slate-900 tabular">{value}</div>
  </div>
);

const Locked = ({ plan }) => (
  <div className="max-w-xl bg-white border border-slate-200 rounded-xl p-8 shadow-sm" data-testid="api-locked">
    <Lock className="w-8 h-8 text-[#0052FF]" strokeWidth={1.5} />
    <h2 className="mt-4 text-lg font-semibold text-slate-900">La API está incluida en Platino y Multiempresas</h2>
    <p className="mt-2 text-sm text-slate-600">Conecta tu tienda online, ERP o CRM con OpenFactura: crea facturas, envíalas a VeriFactu y recibe avisos automáticos. Tu plan actual: {plan || "—"}.</p>
    <Link to="/precios" className="mt-5 inline-flex rounded-lg bg-[#0052FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#0040CC]" data-testid="api-upgrade-link">Ver planes</Link>
  </div>
);

export default function Developer() {
  const [st, setSt] = useState(null);
  const [companies, setCompanies] = useState([]);
  const loadStatus = () => api.get("/developer/status").then((r) => setSt(r.data)).catch(() => {});
  useEffect(() => {
    loadStatus();
    api.get("/developer/companies").then((r) => setCompanies(r.data || [])).catch(() => {});
  }, []);
  if (!st) return <Layout><div data-testid="developer-loading" /></Layout>;
  const connected = st.keys > 0;
  return (
    <Layout>
    <div className="space-y-6" data-testid="developer-page">
      <div>
        <h1 className="font-[Outfit] text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 flex items-center gap-3"><Code2 className="w-8 h-8 text-[#0052FF]" />API para desarrolladores</h1>
        <p className="mt-2 text-sm text-slate-500">Conecta tus sistemas con OpenFactura mediante la API REST v1.</p>
      </div>
      {!st.allowed ? <Locked plan={st.plan} /> : (
        <>
          <div className="flex items-center gap-2 text-sm" data-testid="api-connection-status">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
            {connected ? <span className="text-slate-700">API activa · plan {st.plan} · último uso {st.last_request ? new Date(st.last_request).toLocaleString("es-ES") : "nunca"}</span>
              : <span className="text-slate-500">Sin conexión: crea una clave para empezar</span>}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={KeyRound} label="Claves activas" value={st.keys} testid="stat-keys" />
            <Stat icon={Activity} label="Peticiones 24 h" value={st.requests_24h} testid="stat-requests" />
            <Stat icon={AlertTriangle} label="Errores 24 h" value={st.errors_24h} testid="stat-errors" />
            <Stat icon={Webhook} label="Webhooks" value={st.webhooks} testid="stat-webhooks" />
          </div>
          <Tabs defaultValue="keys">
            <TabsList>
              <TabsTrigger value="keys" data-testid="tab-keys">Claves de API</TabsTrigger>
              <TabsTrigger value="logs" data-testid="tab-logs">Actividad</TabsTrigger>
              <TabsTrigger value="webhooks" data-testid="tab-webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="docs" data-testid="tab-docs">Documentación</TabsTrigger>
            </TabsList>
            <TabsContent value="keys" className="mt-4"><KeysPanel companies={companies} onChange={loadStatus} /></TabsContent>
            <TabsContent value="logs" className="mt-4"><LogsPanel /></TabsContent>
            <TabsContent value="webhooks" className="mt-4"><WebhooksPanel companies={companies} events={st.events} /></TabsContent>
            <TabsContent value="docs" className="mt-4"><DocsPanel /></TabsContent>
          </Tabs>
        </>
      )}
    </div>
    </Layout>
  );
}
