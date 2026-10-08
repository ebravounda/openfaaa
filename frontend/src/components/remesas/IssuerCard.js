import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building2, AlertTriangle, CheckCircle2 } from "lucide-react";

const FIELDS = [
  ["legal_name", "Razón social (como en el registro)", "col-span-2", "Asesoría Ejemplo SL"],
  ["name", "Nombre comercial *", "", "Asesoría Ejemplo"],
  ["nif", "NIF / CIF *", "", "B12345678"],
  ["address", "Domicilio fiscal completo * (calle, nº, CP, ciudad, provincia)", "col-span-2", "C/ Mayor 1, 2ºA, 28001 Madrid (Madrid)"],
  ["email", "Email de facturación", "", "facturas@asesoria.es"],
  ["phone", "Teléfono", "", "910 000 000"],
];

export const IssuerCard = ({ openSignal }) => {
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const load = () => api.get("/gestoria/remesas/ajustes/emisor").then((r) => setD(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => { if (openSignal && d) setF({ ...d }); }, [openSignal]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/gestoria/remesas/ajustes/emisor", f);
      setD(data);
      if (data.missing.length) toast.error(`Falta: ${data.missing.join(", ")}`);
      else { toast.success("Datos fiscales guardados. Ya puedes emitir las facturas."); setF(null); }
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setSaving(false); }
  };
  if (!d) return null;
  const ok = !d.missing.length;
  return (
    <>
      <div className={`border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 ${ok ? "bg-white border-slate-200" : "bg-amber-50 border-amber-200"}`} data-testid="issuer-card">
        <div className="flex items-center gap-3 text-sm">
          <Building2 className={`w-5 h-5 ${ok ? "text-[#0052FF]" : "text-amber-600"}`} />
          {ok ? (
            <div><div className="font-semibold text-slate-900 flex items-center gap-1.5">{d.legal_name || d.name} <CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
              <div className="text-slate-500">NIF {d.nif} · {d.address}</div></div>
          ) : (
            <div><div className="font-semibold text-amber-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Faltan los datos fiscales de la gestoría</div>
              <div className="text-amber-700">Aparecen como emisor en todas las facturas de las remesas. Falta: {d.missing.join(", ")}.</div></div>
          )}
        </div>
        <Button size="sm" variant={ok ? "outline" : "default"} className={ok ? "" : "bg-amber-600 hover:bg-amber-700 text-white"} onClick={() => setF({ ...d })} data-testid="issuer-edit">
          {ok ? "Editar datos fiscales" : "Completar datos fiscales"}
        </Button>
      </div>
      <Dialog open={!!f} onOpenChange={(o) => !o && setF(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Datos fiscales de la gestoría</DialogTitle>
            <DialogDescription>Son los datos legales del emisor que aparecen en cada factura (art. 6 RD 1619/2012).</DialogDescription>
          </DialogHeader>
          {f && <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(([k, l, cls, ph]) => (
              <div key={k} className={cls}><Label>{l}</Label><Input value={f[k] || ""} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`issuer-${k}`} /></div>
            ))}
            <div><Label>Forma jurídica</Label>
              <select value={f.tax_type || "sociedad"} onChange={(e) => setF({ ...f, tax_type: e.target.value })} className="w-full h-10 border border-slate-200 rounded-md px-2 text-sm" data-testid="issuer-tax_type">
                <option value="sociedad">Sociedad (SL, SA…)</option><option value="autonomo">Autónomo</option>
              </select></div>
            <div className="col-span-2"><Label>Texto legal (inscripción en el Registro Mercantil, protección de datos…)</Label>
              <Textarea rows={2} value={f.legal_notice || ""} onChange={(e) => setF({ ...f, legal_notice: e.target.value })} placeholder="Inscrita en el Registro Mercantil de Madrid, Tomo…, Folio…, Hoja…" data-testid="issuer-legal_notice" /></div>
          </div>}
          <Button onClick={save} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="issuer-save">Guardar datos fiscales</Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
