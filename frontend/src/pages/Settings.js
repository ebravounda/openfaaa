import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Building2, ShieldCheck, KeyRound, Upload, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  const [form, setForm] = useState({ name: "", nif: "", address: "", email: "", phone: "", tax_type: "autonomo", invoice_prefix: "", verifactu_enabled: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cert, setCert] = useState(null);
  const [certPwd, setCertPwd] = useState("");
  const [uploadingCert, setUploadingCert] = useState(false);
  const certRef = useRef(null);

  useEffect(() => {
    api.get("/company").then((r) => {
      if (r.data && r.data.name) setForm((f) => ({ ...f, ...r.data }));
    }).finally(() => setLoading(false));
    api.get("/verifactu/certificate").then((r) => setCert(r.data && r.data.meta ? r.data : null));
  }, []);

  const uploadCert = async (e) => {
    const file = e.target.files?.[0];
    if (certRef.current) certRef.current.value = "";
    if (!file) return;
    setUploadingCert(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("password", certPwd);
      const { data } = await api.post("/verifactu/certificate", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setCert(data);
      setCertPwd("");
      toast.success("Certificado subido y validado");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Certificado no válido");
    } finally {
      setUploadingCert(false);
    }
  };

  const deleteCert = async () => {
    if (!window.confirm("¿Eliminar el certificado?")) return;
    await api.delete("/verifactu/certificate");
    setCert(null);
    toast.success("Certificado eliminado");
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Introduce el nombre de tu empresa o actividad");
    setSaving(true);
    try {
      await api.put("/company", form);
      toast.success("Datos guardados correctamente");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Configuración</h1>
        <p className="text-sm text-slate-500 mt-0.5">Estos datos aparecerán como emisor en tus facturas</p>
      </div>

      {loading ? (
        <Skeleton className="h-96 max-w-2xl rounded-lg" />
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm max-w-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#0052FF]" strokeWidth={1.5} />
            </div>
            <div>
              <div className="font-medium text-slate-900">Datos fiscales</div>
              <div className="text-sm text-slate-500">Empresa o actividad</div>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nombre / Razón social</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="company-name" /></div>
              <div className="space-y-2"><Label>NIF / CIF</Label><Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} placeholder="B12345678 / 12345678Z" data-testid="company-nif" /></div>
            </div>
            <div className="space-y-2"><Label>Dirección fiscal</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="company-address" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="company-email" /></div>
              <div className="space-y-2"><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="company-phone" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de actividad</Label>
                <Select value={form.tax_type} onValueChange={(v) => setForm({ ...form, tax_type: v })}>
                  <SelectTrigger data-testid="company-tax-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autonomo">Autónomo</SelectItem>
                    <SelectItem value="empresa">Empresa / Sociedad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Serie de facturación</Label>
                <Input value={form.invoice_prefix} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} placeholder="FAC" data-testid="company-invoice-prefix" />
                <p className="text-xs text-slate-400">
                  Ejemplo: <span className="font-mono text-slate-600">{`${form.invoice_prefix ? form.invoice_prefix + "-" : ""}${new Date().getFullYear()}-0001`}</span>
                </p>
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 font-medium text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} /> VeriFactu
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Activa el registro VeriFactu: cada factura genera una huella SHA-256 encadenada, un código QR y la leyenda de la AEAT en el PDF.
                  El envío a la AEAT es una simulación (la transmisión real requiere tu certificado digital).
                </p>
              </div>
              <Switch checked={form.verifactu_enabled} onCheckedChange={(v) => setForm({ ...form, verifactu_enabled: v })} data-testid="verifactu-toggle" />
            </div>

            {form.verifactu_enabled && (
              <div className="border border-slate-200 rounded-lg p-4 space-y-3" data-testid="certificate-section">
                <div className="flex items-center gap-2 font-medium text-slate-900">
                  <KeyRound className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} /> Certificado digital
                </div>
                {cert ? (
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-sm">
                      <div className="flex items-center gap-2 text-slate-900 font-medium">
                        {cert.meta.expired
                          ? <AlertTriangle className="w-4 h-4 text-red-500" strokeWidth={1.5} />
                          : <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />}
                        {cert.meta.subject_cn}
                      </div>
                      <div className="text-slate-500 mt-1 tabular">NIF: {cert.meta.nif || "—"}</div>
                      <div className={`text-xs mt-0.5 ${cert.meta.expired ? "text-red-600" : "text-slate-400"}`}>
                        Válido hasta {new Date(cert.meta.valid_to).toLocaleDateString("es-ES")} · {cert.filename}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={deleteCert} className="h-8 w-8 text-slate-400 hover:text-red-600" data-testid="delete-certificate">
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">Sube tu certificado (.pfx / .p12). Se guarda cifrado y se usa para firmar y enviar tus registros a la AEAT.</p>
                    <div className="flex items-end gap-3">
                      <div className="space-y-1 flex-1">
                        <Label className="text-xs">Contraseña del certificado</Label>
                        <Input type="password" value={certPwd} onChange={(e) => setCertPwd(e.target.value)} placeholder="••••••" data-testid="cert-password" />
                      </div>
                      <input ref={certRef} type="file" accept=".pfx,.p12" onChange={uploadCert} className="hidden" data-testid="cert-file-input" />
                      <Button onClick={() => certRef.current?.click()} disabled={uploadingCert} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="upload-certificate">
                        {uploadingCert ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />}
                        Subir certificado
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5">
                  La transmisión real a la AEAT está simulada en este entorno; la firma y el registro son reales. Consulta la pestaña "Conexión" para ver el detalle.
                </p>
              </div>
            )}

            <Button onClick={save} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="save-company">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar datos
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}
