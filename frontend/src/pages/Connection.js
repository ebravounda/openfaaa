import { useEffect, useState } from "react";
import api, { API } from "@/lib/api";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity, ShieldCheck, ShieldAlert, ChevronDown, ChevronRight, KeyRound, Info, Download,
} from "lucide-react";

export default function Connection() {
  const [cert, setCert] = useState(null);
  const [company, setCompany] = useState(null);
  const [log, setLog] = useState(null);
  const [open, setOpen] = useState({});

  const loadLog = () => api.get("/verifactu/connection-log").then((r) => setLog(r.data));
  useEffect(() => {
    api.get("/verifactu/certificate").then((r) => setCert(r.data && r.data.meta ? r.data : null));
    api.get("/company").then((r) => setCompany(r.data || {}));
    loadLog();
  }, []);

  const preprod = company?.verifactu_mode === "preproduccion";

  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Conexión AEAT</h1>
        <p className="text-sm text-slate-500 mt-0.5">Registro VeriFactu: certificado, firma y comunicación con la Agencia Tributaria</p>
      </div>

      {/* Estado */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" strokeWidth={1.5} /> Certificado</div>
          {cert ? (
            <>
              <div className="font-medium text-slate-900 mt-2 text-sm">{cert.meta.subject_cn}</div>
              <div className="text-xs text-slate-400 mt-0.5">Válido hasta {new Date(cert.meta.valid_to).toLocaleDateString("es-ES")}</div>
            </>
          ) : (
            <div className="text-sm text-slate-400 mt-2">Sin certificado. Súbelo en Configuración.</div>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" strokeWidth={1.5} /> Estado del servicio</div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-2.5 h-2.5 rounded-full ${preprod ? "bg-blue-500" : "bg-amber-400"} animate-pulse`} />
            <span className="font-medium text-slate-900 text-sm">{preprod ? "Preproducción AEAT (mTLS)" : "Simulado (pruebas locales)"}</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{preprod ? "Envío real con tu certificado" : "Cámbialo en Configuración → Modo de envío"}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Registros enviados</div>
          <div className="font-display text-2xl font-semibold tracking-tight mt-2 tabular">{log ? log.length : "—"}</div>
        </div>
      </div>

      <div className="flex gap-3 p-4 mb-5 bg-blue-50 border border-blue-100 rounded-lg">
        <Info className="w-5 h-5 text-[#0052FF] shrink-0 mt-0.5" strokeWidth={1.5} />
        <div className="text-sm text-slate-600">
          Aquí se registra cada comunicación con la AEAT: el documento XML (RegistroAlta) que se envía y la respuesta que devuelve la Agencia (estado, CSV).
          <strong className="text-slate-900"> Este log se borra automáticamente el día 3 de cada mes.</strong>
        </div>
      </div>

      {/* Log */}
      {!log ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : log.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-lg py-14 text-center" data-testid="log-empty">
          <Activity className="w-12 h-12 mx-auto text-slate-300" strokeWidth={1.25} />
          <p className="text-slate-500 mt-3">Aún no hay comunicaciones con la AEAT. Envía una factura VeriFactu desde Facturas.</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="connection-log">
          {log.map((e) => (
            <div key={e.id} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden" data-testid={`log-entry-${e.invoice_number}`}>
              <button onClick={() => toggle(e.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors duration-200">
                <div className="flex items-center gap-3">
                  {open[e.id] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  {e.estado === "Correcto"
                    ? <ShieldCheck className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />
                    : <ShieldAlert className="w-4 h-4 text-amber-500" strokeWidth={1.5} />}
                  <span className="font-mono text-sm font-medium text-slate-900">{e.invoice_number}</span>
                  <span className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString("es-ES")}</span>
                </div>
                <div className="flex items-center gap-2">
                  {e.mode && <Badge className={`rounded-full text-[10px] ${e.mode === "preproduccion" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : "bg-slate-100 text-slate-500 hover:bg-slate-100"}`}>{e.mode === "preproduccion" ? "Preprod" : "Simulado"}</Badge>}
                  {e.signed && <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 rounded-full text-[10px]">Firmado</Badge>}
                  <Badge className={`rounded-full ${e.estado === "Correcto" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-red-100 text-red-700 hover:bg-red-100"}`}>{e.estado_registro}</Badge>
                  {e.csv && <span className="font-mono text-xs text-slate-400">{e.csv}</span>}
                </div>
              </button>
              {open[e.id] && (
                <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-500">
                    <div><span className="font-semibold text-slate-700">Endpoint:</span> {e.endpoint}</div>
                    <div><span className="font-semibold text-slate-700">Firmante:</span> {e.signer || "— (sin certificado)"}</div>
                    <div className="md:col-span-2 break-all"><span className="font-semibold text-slate-700">Huella:</span> <span className="font-mono">{e.huella}</span></div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">→ Enviado a la AEAT (SOAP RegistroAlta)</div>
                    <pre className="bg-slate-900 text-slate-100 text-[11px] rounded-md p-3 overflow-x-auto max-h-64" data-testid={`log-request-${e.invoice_number}`}>{e.request_xml}</pre>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">← Respuesta de la AEAT</div>
                    <pre className="bg-slate-50 border border-slate-200 text-slate-700 text-[11px] rounded-md p-3 overflow-x-auto max-h-64" data-testid={`log-response-${e.invoice_number}`}>{e.response_xml}</pre>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" className="border-slate-200" onClick={() => window.open(`${API}/invoices/${e.invoice_id}/verifactu/xml`, "_blank")} data-testid={`download-xml-${e.invoice_number}`}>
                      <Download className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} /> Descargar XML firmado
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
