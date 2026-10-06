import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { PowensWebhookPanel } from "@/components/PowensWebhookPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Landmark, Loader2, RefreshCw, Link2, Unlink, ArrowDownLeft, ArrowUpRight, CheckCircle2, Search } from "lucide-react";

const FILTERS = [["all", "Todos"], ["pending", "Sin conciliar"], ["matched", "Conciliados"], ["in", "Ingresos"], ["out", "Cargos"]];
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const matchesTx = (t, q, f) => {
  if (f === "pending" && t.matched) return false;
  if (f === "matched" && !t.matched) return false;
  if (f === "in" && t.value < 0) return false;
  if (f === "out" && t.value >= 0) return false;
  const term = norm(q).trim();
  if (!term) return true;
  const num = term.replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const abs = Math.abs(Number(t.value) || 0).toFixed(2);
  if (/^-?\d+(\.\d+)?$/.test(num) && abs.startsWith(String(Math.abs(Number(num))))) return true;
  return norm(t.label).includes(term) || String(t.date || "").includes(term);
};

export default function Conciliacion() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" && !user?.is_impersonating;
  const [status, setStatus] = useState(null);
  const [txs, setTxs] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const shown = txs.filter((t) => matchesTx(t, q, filter));

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, g] = await Promise.all([
        api.get("/powens/status"),
        api.get("/bank/transactions"),
        api.get("/bank/suggestions"),
      ]);
      setStatus(s.data); setTxs(t.data); setSuggestions(g.data.suggestions || []);
    } catch (e) { /* noop */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (params.get("status") === "connected") toast.success("Banco conectado. Sincronizando movimientos…");
    if (params.get("status") === "cancelled") toast.message("Conexión cancelada");
    loadAll();
  }, [params, loadAll]);

  const connect = async () => {
    setConnecting(true);
    try {
      const { data } = await api.post("/powens/connect-url");
      window.location.assign(data.url);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudo iniciar la conexión"); setConnecting(false); }
  };

  const sync = async () => {
    setSyncing(true);
    try { const { data } = await api.post("/powens/sync"); toast.success(`${data.synced} movimiento(s) sincronizados`); await loadAll(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setSyncing(false); }
  };

  const reconcile = async (transaction_id, cand) => {
    try {
      await api.post("/bank/reconcile", { transaction_id, type: cand.type, target_id: cand.target_id });
      toast.success(cand.type === "invoice" ? "Factura marcada como cobrada" : "Gasto conciliado");
      await loadAll();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const unmatch = async (t) => {
    try { await api.post(`/bank/unmatch/${t.id}`); toast.success("Conciliación deshecha"); await loadAll(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="bank-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2"><Landmark className="w-6 h-6 text-[#0052FF]" strokeWidth={1.5} /> Conciliación bancaria</h1>
            <p className="text-sm text-slate-500 mt-0.5">Conecta tu banco (vía Powens) y concilia ingresos con facturas y cargos con gastos.</p>
          </div>
          <div className="flex gap-2">
            {status?.connected && <Button variant="outline" onClick={sync} disabled={syncing} className="border-slate-200" data-testid="bank-sync">{syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}Sincronizar</Button>}
            <Button onClick={connect} disabled={connecting} className="bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl" data-testid="bank-connect">
              {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Landmark className="w-4 h-4 mr-2" strokeWidth={1.5} />}{status?.connected ? "Conectar otro banco" : "Conectar banco"}
            </Button>
          </div>
        </div>

        {status && !status.configured && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">⚠️ Powens aún no está configurado en el servidor (falta el dominio sandbox). La conexión real no funcionará hasta completarlo.</div>
        )}

        {isAdmin && <PowensWebhookPanel />}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : (
          <>
            {suggestions.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5" data-testid="bank-suggestions">
                <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Link2 className="w-4 h-4 text-[#0052FF]" /> Sugerencias de conciliación ({suggestions.length})</h2>
                <div className="space-y-3">
                  {suggestions.map((s) => (
                    <div key={s.transaction.id} className="border border-slate-100 rounded-lg p-3" data-testid={`suggestion-${s.transaction.id}`}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 text-sm">
                          {s.transaction.value >= 0 ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                          <span className="text-slate-700">{s.transaction.date}</span>
                          <span className="text-slate-500 truncate max-w-[280px]">{s.transaction.label}</span>
                        </div>
                        <span className={`text-sm font-semibold tabular ${s.transaction.value >= 0 ? "text-emerald-700" : "text-red-600"}`}>{eur(s.transaction.value)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {s.candidates.map((c) => (
                          <Button key={c.type + c.target_id} size="sm" variant="outline" className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/5" onClick={() => reconcile(s.transaction.id, c)} data-testid={`reconcile-${s.transaction.id}`}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {c.label} · {eur(c.amount)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
              <div className="px-5 pt-4 pb-2 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">Movimientos bancarios <span className="font-normal text-slate-400" data-testid="bank-tx-count">({shown.length}{shown.length !== txs.length ? ` de ${txs.length}` : ""})</span></span>
                {txs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar concepto, importe o fecha" className="pl-8 h-9 w-64" data-testid="bank-search" />
                    </div>
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                      {FILTERS.map(([k, l]) => (
                        <button key={k} onClick={() => setFilter(k)} className={`px-2.5 h-9 text-xs whitespace-nowrap transition-colors ${filter === k ? "bg-[#0052FF] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`} data-testid={`bank-filter-${k}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {txs.length === 0 ? (
                <div className="text-center text-slate-400 py-14 text-sm">{status?.connected ? "No hay movimientos. Pulsa Sincronizar." : "Conecta tu banco para ver los movimientos."}</div>
              ) : shown.length === 0 ? (
                <div className="text-center text-slate-400 py-14 text-sm" data-testid="bank-no-results">Ningún movimiento coincide con la búsqueda.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Fecha</TableHead><TableHead>Concepto</TableHead><TableHead className="text-right">Importe</TableHead><TableHead className="text-right">Estado</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((t, i) => (
                      <TableRow key={t.id} data-testid={`bank-tx-${i}`} className="hover:bg-slate-50/60">
                        <TableCell className="text-sm text-slate-600 tabular">{t.date}</TableCell>
                        <TableCell className="text-sm text-slate-700">{t.label}</TableCell>
                        <TableCell className={`text-right text-sm font-medium tabular ${t.value >= 0 ? "text-emerald-700" : "text-red-600"}`}>{eur(t.value)}</TableCell>
                        <TableCell className="text-right">
                          {t.matched ? (
                            <Button variant="ghost" size="sm" className="h-7 text-emerald-700 hover:text-red-600" onClick={() => unmatch(t)} data-testid={`unmatch-${i}`}><Unlink className="w-3.5 h-3.5 mr-1" /> Conciliado</Button>
                          ) : (
                            <span className="text-xs text-slate-400">Sin conciliar</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
