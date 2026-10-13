import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building2, AlertTriangle, CheckCircle2, KeyRound, Upload, Trash2, Loader2 } from "lucide-react";

const FIELDS = [
  ["legal_name", "Razón social (como en el registro)", "col-span-2", "Asesoría Ejemplo SL"],
  ["name", "Nombre comercial *", "", "Asesoría Ejemplo"],
  ["nif", "NIF / CIF *", "", "B12345678"],
  ["address", "Domicilio fiscal completo * (calle, nº, CP, ciudad, provincia)", "col-span-2", "C/ Mayor 1, 2ºA, 28001 Madrid (Madrid)"],
  ["email", "Email de facturación", "", "facturas@asesoria.es"],
  ["phone", "Teléfono", "", "910 000 000"],
];
const VF_LABEL = { simulado: "Simulado (pruebas)", preproduccion: "Preproducción AEAT", produccion: "Producción AEAT (real)" };
const SEPA = [
  ["sepa_iban", "IBAN donde se abonan las remesas", "col-span-2", "ES00 0000 0000 0000 0000 0000"],
  ["sepa_creditor_id", "Identificador de acreedor SEPA", "", ""],
  ["sepa_bic", "BIC del banco (opcional)", "", "CAIXESBBXXX"],
];

export const IssuerCard = ({ openSignal }) => {
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [cert, setCert] = useState(null);
  const [pwd, setPwd] = useState("");
  const [upl, setUpl] = useState(false);
  const load = () => api.get("/gestoria/remesas/ajustes/emisor").then((r) => setD(r.data)).catch(() => {});
  const loadCert = () => api.get("/verifactu/certificate").then((r) => setCert(r.data?.meta ? r.data : null)).catch(() => {});
  useEffect(() => { load(); loadCert(); }, []);
  const uploadCert = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setUpl(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("password", pwd);
      const { data } = await api.post("/verifactu/certificate", fd);
      setCert(data); setPwd(""); toast.success("Certificado subido y validado");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Certificado no válido"); } finally { setUpl(false); }
  };
  const delCert = async () => { if (!window.confirm("¿Eliminar el certificado?")) return; await api.delete("/verifactu/certificate"); setCert(null); };
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
              <div className="text-slate-500">NIF {d.nif} · {d.address}</div>
              {d.sepa_missing?.length > 0 && <div className="text-amber-700 text-xs mt-0.5" data-testid="issuer-sepa-missing">Para el XML SEPA falta: {d.sepa_missing.join(", ")}</div>}
              <div className="text-xs mt-0.5" data-testid="issuer-vf-summary">{d.verifactu_enabled
                ? <span className={d.verifactu_mode === "produccion" ? "text-emerald-700" : "text-slate-500"}>VeriFactu activo · {VF_LABEL[d.verifactu_mode] || "Simulado"}{!cert && d.verifactu_mode !== "simulado" ? <span className="text-amber-700"> · falta el certificado digital</span> : ""}</span>
                : <span className="text-amber-700">VeriFactu desactivado: las facturas de las remesas no se registran en la AEAT</span>}</div></div>
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
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
            <div className="col-span-2 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cobro por adeudo directo SEPA (fichero XML)</div>
            {SEPA.map(([k, l, cls, ph]) => (
              <div key={k} className={cls}><Label>{l}</Label><Input value={f[k] || ""} placeholder={k === "sepa_creditor_id" ? (d.suggested_creditor_id || "ES00000B12345678") : ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`issuer-${k}`} /></div>
            ))}
            <p className="col-span-2 text-xs text-slate-500">Si no indicas el identificador de acreedor, se calcula a partir del NIF ({d.suggested_creditor_id || "—"}). Confírmalo con tu banco.</p>
            <div className="col-span-2 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">VeriFactu (envío a la AEAT)</div>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.verifactu_enabled} onChange={(e) => setF({ ...f, verifactu_enabled: e.target.checked })} data-testid="issuer-verifactu_enabled" /> Registrar las facturas en VeriFactu (huella, QR y envío a la AEAT)</label>
            {f.verifactu_enabled && <>
              <div><Label>Modo de envío</Label>
                <select value={f.verifactu_mode || "simulado"} onChange={(e) => setF({ ...f, verifactu_mode: e.target.value })} className="w-full h-10 border border-slate-200 rounded-md px-2 text-sm bg-white" data-testid="issuer-verifactu_mode">
                  {Object.entries(VF_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><Label>Tipo de certificado</Label>
                <select value={f.verifactu_cert_type || "personal"} onChange={(e) => setF({ ...f, verifactu_cert_type: e.target.value })} className="w-full h-10 border border-slate-200 rounded-md px-2 text-sm bg-white" data-testid="issuer-verifactu_cert_type">
                  <option value="personal">Personal / representante</option><option value="sello">Sello de entidad</option></select></div>
              {f.verifactu_mode === "produccion" && <p className="col-span-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2" data-testid="issuer-vf-prod-warning"><AlertTriangle className="inline w-3.5 h-3.5 mr-1" />Producción: cada envío se registra de forma real e irreversible en la AEAT. El NIF de la gestoría debe coincidir con el certificado.</p>}
              <div className="col-span-2 border border-slate-200 rounded-lg p-3" data-testid="issuer-cert">
                <div className="flex items-center gap-2 text-sm font-medium mb-2"><KeyRound className="w-4 h-4 text-[#0052FF]" /> Certificado digital</div>
                {cert ? (
                  <div className="flex justify-between items-start gap-3 text-sm">
                    <div><div className="font-medium">{cert.meta.subject_cn}</div><div className="text-xs text-slate-500">NIF {cert.meta.nif || "—"} · válido hasta {new Date(cert.meta.valid_to).toLocaleDateString("es-ES")}{cert.meta.expired && <span className="text-red-600"> · CADUCADO</span>}</div></div>
                    <button onClick={delCert} data-testid="issuer-cert-delete"><Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" /></button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="flex-1"><Label className="text-xs">Contraseña del certificado</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} data-testid="issuer-cert-password" /></div>
                    <label className="inline-flex items-center gap-2 text-sm bg-[#0052FF] text-white rounded-md px-3 h-10 cursor-pointer" data-testid="issuer-cert-upload">
                      {upl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Subir .pfx/.p12
                      <input type="file" accept=".pfx,.p12" className="hidden" onChange={uploadCert} data-testid="issuer-cert-file" /></label>
                  </div>
                )}
              </div>
            </>}
          </div>}
          <Button onClick={save} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="issuer-save">Guardar datos fiscales</Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
