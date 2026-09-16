import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Landmark, RefreshCw, Plus, ArrowDownLeft, ArrowUpRight, CheckCircle2, Link2, Loader2, ShieldCheck } from "lucide-react";

const CARD = "bg-white border border-slate-200/60 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)]";

export default function Bancos() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [conns, setConns] = useState([]);
  const [txns, setTxns] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [banks, setBanks] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, t] = await Promise.all([api.get("/bank/connections"), api.get("/bank/transactions")]);
      setConns(c.data || []);
      setTxns(t.data || []);
    } catch (e) { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    if (code && state) {
      (async () => {
        try {
          const { data } = await api.post("/bank/callback", { code, state });
          toast.success(`Banco conectado · ${data.connected} cuenta(s)`);
        } catch (e) {
          toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudo completar la conexión");
        } finally {
          navigate("/bancos", { replace: true });
          load();
        }
      })();
    } else {
      load();
    }
  }, [params, navigate, load]);

  const openPicker = async () => {
    setPickOpen(true);
    if (banks === null) {
      try {
        const { data } = await api.get("/bank/institutions");
        setBanks(data || []);
      } catch (e) {
        setBanks([]);
        toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudieron cargar los bancos");
      }
    }
  };

  const connect = async (aspsp) => {
    try {
      const redirect_url = `${window.location.origin}/bancos/callback`;
      const { data } = await api.post("/bank/connect", { aspsp_name: aspsp, redirect_url });
      if (data.auth_url) window.location.href = data.auth_url;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudo iniciar la conexión");
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/bank/sync");
      toast.success(`Sincronizado · ${data.new} nuevos movimientos · ${data.matched} conciliados`);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudo sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-7 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Bancos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Conecta tu banco y concilia cobros automáticamente</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={sync} disabled={syncing || conns.length === 0} className="border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all" data-testid="bank-sync-button">
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" strokeWidth={1.5} />} Sincronizar
          </Button>
          <Button onClick={openPicker} className="bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl shadow-[0_4px_14px_0_rgba(0,82,255,0.39)] transition-all hover:-translate-y-0.5 active:scale-95" data-testid="bank-connect-button">
            <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} /> Conectar banco
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-24 rounded-[20px]" /><Skeleton className="h-80 rounded-[20px]" /></div>
      ) : (
        <>
          {conns.length === 0 ? (
            <div className={`${CARD} p-10 text-center of-fade-up`} data-testid="bank-empty">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center"><Landmark className="w-7 h-7 text-[#0052FF]" strokeWidth={1.5} /></div>
              <h3 className="font-display text-lg font-semibold text-slate-900 mt-4">Aún no has conectado ningún banco</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Conecta tu banco de forma segura (PSD2) para ver tus movimientos y conciliar automáticamente las facturas cobradas.</p>
              <Button onClick={openPicker} className="mt-5 bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl" data-testid="bank-connect-empty"><Plus className="w-4 h-4 mr-2" strokeWidth={1.5} /> Conectar banco</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
              {conns.map((c) => (
                <div key={c.account_uid} className={`${CARD} p-5 of-fade-up`} data-testid={`bank-conn-${c.account_uid}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Landmark className="w-5 h-5 text-[#0052FF]" strokeWidth={1.5} /></div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{c.aspsp || "Banco"}</div>
                      <div className="text-xs text-slate-500 truncate">{c.iban || c.name || c.account_uid}</div>
                    </div>
                    <Badge className="ml-auto bg-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-full text-[10px]"><Link2 className="w-3 h-3 mr-1" />Conectado</Badge>
                  </div>
                  {c.valid_until && <div className="text-[11px] text-slate-400 mt-3">Consentimiento válido hasta {new Date(c.valid_until).toLocaleDateString("es-ES")}</div>}
                </div>
              ))}
            </div>
          )}

          <div className={`${CARD} overflow-hidden of-fade-up`}>
            <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-display text-base font-semibold text-slate-900">Movimientos</h3></div>
            {txns.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">No hay movimientos todavía. Conecta un banco y pulsa "Sincronizar".</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-slate-100 [&>th]:text-[11px] [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-slate-500 [&>th]:font-semibold [&>th]:bg-slate-50/50 [&>th]:h-11">
                    <TableHead>Fecha</TableHead><TableHead>Concepto</TableHead><TableHead>Contraparte</TableHead>
                    <TableHead className="text-right">Importe</TableHead><TableHead>Conciliación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.map((t) => (
                    <TableRow key={t.id} className="hover:bg-slate-50/60 transition-colors border-b border-slate-100 last:border-0" data-testid={`bank-txn-${t.id}`}>
                      <TableCell className="text-sm text-slate-600">{t.booking_date}</TableCell>
                      <TableCell className="text-sm text-slate-700 max-w-[280px] truncate">{t.remittance || "—"}</TableCell>
                      <TableCell className="text-sm text-slate-600">{t.counterparty || "—"}</TableCell>
                      <TableCell className={`text-right text-sm font-semibold tabular ${t.direction === "in" ? "text-emerald-600" : "text-slate-900"}`}>
                        <span className="inline-flex items-center gap-1 justify-end">
                          {t.direction === "in" ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                          {t.direction === "in" ? "+" : "−"}{eur(Math.abs(t.amount))}
                        </span>
                      </TableCell>
                      <TableCell>
                        {t.matched_invoice ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-full text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />{t.matched_invoice}</Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
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

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent data-testid="bank-picker">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /> Elige tu banco</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {banks === null ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)
            ) : banks.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No hay bancos disponibles. Revisa la configuración de Enable Banking.</p>
            ) : (
              banks.map((b) => (
                <button key={b.name} onClick={() => connect(b.name)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-[#0052FF] hover:bg-blue-50/40 transition-all text-left" data-testid={`bank-option-${b.name}`}>
                  {b.logo ? <img src={b.logo} alt="" className="w-8 h-8 rounded object-contain" /> : <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center"><Landmark className="w-4 h-4 text-slate-400" /></div>}
                  <span className="font-medium text-slate-800">{b.name}</span>
                  {b.sandbox && <Badge variant="outline" className="ml-auto text-[10px] rounded-full">Sandbox</Badge>}
                </button>
              ))
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">Conexión segura vía Open Banking (PSD2). Solo lectura de movimientos.</p>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
