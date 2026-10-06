import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Activity, RefreshCw } from "lucide-react";

const fmt = (d) => (d ? new Date(d).toLocaleString("es-ES") : "Nunca");

export const PowensWebhookPanel = () => {
  const [data, setData] = useState(null);
  const load = () => api.get("/admin/powens/webhook-log").then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!data) return null;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm" data-testid="powens-webhook-panel">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Activity className="w-4 h-4 text-[#0052FF]" /> Estado de webhooks Powens <span className="text-xs font-normal text-slate-400">(solo admin)</span></h2>
        <button onClick={load} className="text-slate-500 hover:text-[#0052FF]" data-testid="powens-webhook-refresh"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-600">
        <span data-testid="powens-last-webhook">Último webhook: <b>{fmt(data.last_webhook_at)}</b></span>
        <span data-testid="powens-last-sync">Última sincronización: <b>{fmt(data.last_sync_at)}</b>{data.last_sync_at ? ` (${data.last_sync_count ?? 0} mov.)` : ""}</span>
      </div>
      {data.events.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-500" data-testid="powens-webhook-events">
          {data.events.map((e, i) => (
            <li key={i}>{fmt(e.received_at)} · {e.event || "evento"} · {e.result}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
