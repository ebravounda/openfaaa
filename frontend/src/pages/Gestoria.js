import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Users, Euro, Wallet, LogOut, Plus, LogIn, Upload, Loader2, Building2, FileText } from "lucide-react";

const PLAN_OPTS = [
  { id: "basico", name: "Básico" },
  { id: "medio", name: "Medio" },
  { id: "platino", name: "Platino" },
  { id: "multiempresas", name: "Multiempresas 20" },
  { id: "multiempresas_50", name: "Multiempresas 50" },
];
const eur = (n) => `${(Number(n) || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const CARD = "bg-white border border-slate-200 rounded-2xl shadow-sm";

export default function Gestoria() {
  const { user, reload, logout } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", plan: "basico", mode: "invite", password: "", tax_id: "", phone: "" });

  const load = () => {
    setLoading(true);
    Promise.all([api.get("/gestoria/summary"), api.get("/gestoria/clients")])
      .then(([s, c]) => { setSummary(s.data); setClients(c.data); })
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (user && user.role !== "gestoria") {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Acceso restringido a gestorías.</div>;
  }

  const createClient = async () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error("Indica nombre y email."); return; }
    if (form.mode === "password" && form.password.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres."); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/gestoria/clients", form);
      toast.success(data.invite_sent ? "Cliente creado. Invitación enviada por email." : "Cliente creado correctamente.");
      setOpen(false);
      setForm({ name: "", email: "", plan: "basico", mode: "invite", password: "", tax_id: "", phone: "" });
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudo crear el cliente");
    } finally { setSaving(false); }
  };

  const enterClient = async (c) => {
    try {
      await api.post(`/gestoria/clients/${c.id}/enter`);
      await reload();
      navigate("/");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudo entrar en la cuenta");
    }
  };

  const sepaCheckout = async () => {
    try {
      const { data } = await api.post("/gestoria/billing/checkout", { origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudo iniciar la domiciliación");
    }
  };

  const changePlan = async (c, plan) => {    try { await api.post(`/gestoria/clients/${c.id}/plan`, { plan }); toast.success("Plan actualizado"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post("/gestoria/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Logo actualizado. Tus clientes lo verán al acceder.");
      load();
    } catch (err) { toast.error("No se pudo subir el logo"); }
    finally { setUploading(false); }
  };

  const cap = summary?.max_clients || 0;
  const used = summary?.clients_count || 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Seo path="/gestoria" title="Panel de gestoría" description="Gestiona las cuentas de tus clientes en OpenFactura." />
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {summary?.logo
              ? <img src={summary.logo} alt="Logo" className="h-8 w-auto max-w-[160px] object-contain" data-testid="gestoria-logo" />
              : <span className="font-display text-lg font-bold text-[#0052FF]">openfactura</span>}
            <span className="text-slate-300">·</span>
            <span className="text-sm font-medium text-slate-600 truncate">{summary?.firm_name || user?.firm_name || "Gestoría"}</span>
          </div>
          <Button variant="ghost" onClick={() => { logout(); navigate("/login"); }} className="text-slate-500" data-testid="gestoria-logout">
            <LogOut className="w-4 h-4 mr-2" strokeWidth={1.75} /> Salir
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Panel de gestoría</h1>
            <p className="text-sm text-slate-500 mt-0.5">Da de alta y gestiona las cuentas de tus clientes.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer hover:bg-slate-50 transition" data-testid="gestoria-logo-upload-label">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" strokeWidth={1.75} />} Subir logo
              <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} data-testid="gestoria-logo-input" />
            </label>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl" data-testid="gestoria-new-client">
                  <Plus className="w-4 h-4 mr-2" strokeWidth={2} /> Nuevo cliente
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="gestoria-client-dialog">
                <DialogHeader><DialogTitle>Nueva cuenta de cliente</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Nombre / Razón social</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="client-name" /></div>
                    <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="client-email" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>DNI/NIE/CIF</Label><Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} data-testid="client-tax" /></div>
                    <div className="space-y-1"><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="client-phone" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Plan</Label>
                      <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                        <SelectTrigger data-testid="client-plan"><SelectValue /></SelectTrigger>
                        <SelectContent>{PLAN_OPTS.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Acceso</Label>
                      <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                        <SelectTrigger data-testid="client-mode"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="invite">Enviar invitación por email</SelectItem>
                          <SelectItem value="password">Definir contraseña ahora</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {form.mode === "password" && (
                    <div className="space-y-1"><Label>Contraseña (mín. 8, letras y números)</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="client-password" /></div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={createClient} disabled={saving} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="client-create-submit">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Crear cliente
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`${CARD} p-5`} data-testid="summary-clients">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clientes</span><Users className="w-5 h-5 text-[#0052FF]" strokeWidth={1.75} /></div>
            <div className="font-display text-3xl font-bold mt-2">{used}{cap ? <span className="text-lg text-slate-400"> / {cap}</span> : ""}</div>
            <div className="text-xs text-slate-400 mt-1">{cap ? `Cupo máximo: ${cap}` : "Sin límite de cupo"}</div>
          </div>
          <div className={`${CARD} p-5`} data-testid="summary-value">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coste mensual (50%)</span><Wallet className="w-5 h-5 text-emerald-600" strokeWidth={1.75} /></div>
            <div className="font-display text-3xl font-bold mt-2">{eur(summary?.monthly_value)}</div>
            <button onClick={sepaCheckout} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#0052FF] hover:underline" data-testid="gestoria-sepa-btn">
              <Wallet className="w-3.5 h-3.5" strokeWidth={2} /> Domiciliar pago (SEPA)
            </button>
          </div>
          <div className={`${CARD} p-5`} data-testid="summary-iban">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">IBAN de cobro</span><Euro className="w-5 h-5 text-slate-500" strokeWidth={1.75} /></div>
            <div className="font-mono text-sm mt-3 text-slate-700 break-all">{summary?.iban || "—"}</div>
            <div className="text-xs text-slate-400 mt-1">Configurado por OpenFactura</div>
          </div>
        </div>

        {/* Clients table */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-slate-100 font-medium text-slate-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-[#0052FF]" strokeWidth={1.75} /> Mis clientes</div>
          {loading ? (
            <div className="p-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
          ) : clients.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Aún no has dado de alta ningún cliente.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-3">Cliente</th>
                    <th className="text-left px-5 py-3">Plan</th>
                    <th className="text-right px-5 py-3">Coste (50%)</th>
                    <th className="text-right px-5 py-3"><FileText className="w-3.5 h-3.5 inline" /> Facturas</th>
                    <th className="text-right px-5 py-3">Facturado</th>
                    <th className="text-right px-5 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`client-row-${c.email}`}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{c.name || "—"}</div>
                        <div className="text-xs text-slate-400">{c.email}{c.pending_setup ? " · pendiente de activar" : ""}</div>
                      </td>
                      <td className="px-5 py-3">
                        <Select value={c.plan} onValueChange={(v) => changePlan(c, v)}>
                          <SelectTrigger className="h-8 w-[150px]" data-testid={`client-plan-${c.email}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{PLAN_OPTS.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{eur(c.reseller_value)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{c.invoices_total}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{eur(c.billed)}</td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => enterClient(c)} data-testid={`enter-${c.email}`}>
                          <LogIn className="w-4 h-4 mr-1.5" strokeWidth={1.75} /> Entrar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
