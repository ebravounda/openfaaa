import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Loader2, Power } from "lucide-react";

export const MaintenanceSection = () => {
  const [cfg, setCfg] = useState(null);
  const [message, setMessage] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/admin/maintenance").then((r) => { setCfg(r.data); setMessage(r.data.message || ""); setUntil(r.data.until || ""); }).catch(() => {});
  }, []);
  const save = async (enabled) => {
    if (enabled && !cfg?.enabled && !window.confirm("¿Poner el sitio en mantenimiento? Todos los usuarios y visitantes verán la pantalla de mantenimiento.")) return;
    setBusy(true);
    try {
      const { data } = await api.put("/admin/maintenance", { enabled, message, until });
      setCfg(data);
      toast.success(enabled ? "Sitio en mantenimiento" : "Sitio activo de nuevo");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Error");
    } finally { setBusy(false); }
  };
  const on = cfg?.enabled;
  return (
    <div className={`bg-white border rounded-lg shadow-sm max-w-3xl overflow-hidden mt-8 ${on ? "border-amber-300" : "border-slate-200"}`} data-testid="maintenance-section">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} />
          <div>
            <div className="font-medium text-slate-900">Sitio en mantenimiento</div>
            <div className="text-sm text-slate-500">Muestra a todos (menos a los super admin) una pantalla de «Volvemos pronto».</div>
          </div>
        </div>
        <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${on ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`} data-testid="maintenance-status">{on ? "En mantenimiento" : "Sitio activo"}</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="space-y-2">
          <Label>Mensaje (opcional)</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={500} placeholder="Estamos mejorando OpenFactura para ti…" data-testid="maintenance-message-input" />
        </div>
        <div className="space-y-2">
          <Label>Hora de vuelta (opcional, muestra cuenta atrás)</Label>
          <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className="max-w-xs" data-testid="maintenance-until-input" />
        </div>
        <div className="flex flex-wrap gap-2">
          {on ? (
            <>
              <Button onClick={() => save(false)} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="maintenance-disable">{busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Power className="w-4 h-4 mr-1.5" />}Quitar mantenimiento</Button>
              <Button variant="outline" onClick={() => save(true)} disabled={busy} data-testid="maintenance-update">Actualizar mensaje</Button>
            </>
          ) : (
            <Button onClick={() => save(true)} disabled={busy} className="bg-amber-500 hover:bg-amber-600 text-white" data-testid="maintenance-enable">{busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wrench className="w-4 h-4 mr-1.5" />}Poner sitio en mantenimiento</Button>
          )}
        </div>
      </div>
    </div>
  );
};
