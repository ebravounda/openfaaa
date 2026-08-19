import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, ShieldOff, FileText, Search, UserCog, Ban, CheckCircle2, Loader2, Save, CreditCard, History, TrendingUp, Euro, Rocket, UserPlus } from "lucide-react";

const PLAN_LABEL = { basico: "Básico", medio: "Medio", platino: "Platino" };
const actionLabel = (a) => {
  if (!a) return "—";
  if (a.startsWith("plan:")) return `Cambió plan a ${PLAN_LABEL[a.split(":")[1]] || a.split(":")[1]}`;
  return {
    block: "Bloqueó usuario", unblock: "Desbloqueó usuario", impersonate: "Personificó usuario",
    edit_plans: "Editó los planes", "edit_global_template:goroky": "Editó plantilla global GoRoky",
  }[a] || a;
};
const PLAN_BADGE = {
  basico: "bg-slate-100 text-slate-700",
  medio: "bg-blue-100 text-blue-700",
  platino: "bg-amber-100 text-amber-700",
};

export default function Admin() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [gk, setGk] = useState({ legal_notice: "", footer_message: "", defaults: {} });
  const [savingGk, setSavingGk] = useState(false);
  const [plans, setPlans] = useState([]);
  const [savingPlans, setSavingPlans] = useState(false);
  const [audit, setAudit] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [integ, setInteg] = useState(null);
  const [integForm, setIntegForm] = useState({ resend: {}, stripe: {}, ai: {} });
  const [savingInteg, setSavingInteg] = useState(false);

  const load = (query = "") => {
    setLoading(true);
    Promise.all([
      api.get(`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`),
      api.get("/admin/stats"),
    ])
      .then(([u, s]) => { setUsers(u.data); setStats(s.data); })
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get("/admin/global-templates/goroky").then((r) => setGk(r.data)).catch(() => {});
    api.get("/admin/plans").then((r) => setPlans(r.data)).catch(() => {});
    api.get("/admin/audit").then((r) => setAudit(r.data)).catch(() => {});
    api.get("/admin/revenue").then((r) => setRevenue(r.data)).catch(() => {});
    api.get("/admin/integrations").then((r) => {
      setInteg(r.data);
      setIntegForm({
        resend: { from_email: r.data.resend.from_email || "", from_name: r.data.resend.from_name || "", reply_to: r.data.resend.reply_to || "", api_key: "" },
        stripe: { publishable_key: r.data.stripe.publishable_key || "", mode: r.data.stripe.mode || "test", secret_key: "", webhook_secret: "" },
        ai: { provider: r.data.ai.provider || "emergent", model: r.data.ai.model || "", openai_key: "", groq_key: "" },
      });
    }).catch(() => {});
  }, []);

  if (user && (user.role !== "admin" || user.is_impersonating)) return <Navigate to="/" replace />;

  const search = (e) => { e.preventDefault(); load(q); };

  const saveInteg = async () => {
    setSavingInteg(true);
    try {
      await api.put("/admin/integrations", integForm);
      toast.success("Integraciones guardadas");
      const { data } = await api.get("/admin/integrations");
      setInteg(data);
      setIntegForm((f) => ({
        resend: { ...f.resend, api_key: "" },
        stripe: { ...f.stripe, secret_key: "", webhook_secret: "" },
        ai: { ...f.ai, openai_key: "", groq_key: "" },
      }));
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSavingInteg(false); }
  };
  const setR = (k, v) => setIntegForm((f) => ({ ...f, resend: { ...f.resend, [k]: v } }));
  const setS = (k, v) => setIntegForm((f) => ({ ...f, stripe: { ...f.stripe, [k]: v } }));
  const setA = (k, v) => setIntegForm((f) => ({ ...f, ai: { ...f.ai, [k]: v } }));

  const setPlan = async (u, plan) => {
    setBusyId(u.id);
    try {
      await api.post(`/admin/users/${u.id}/plan`, { plan });
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, plan } : x)));
      toast.success(`Plan de ${u.email} → ${PLAN_LABEL[plan]}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusyId(null); }
  };

  const toggleBlock = async (u) => {
    setBusyId(u.id);
    try {
      const path = u.is_blocked ? "unblock" : "block";
      const { data } = await api.post(`/admin/users/${u.id}/${path}`);
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, is_blocked: data.is_blocked } : x)));
      toast.success(data.is_blocked ? `${u.email} bloqueado` : `${u.email} desbloqueado`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusyId(null); }
  };

  const impersonate = async (u) => {
    setBusyId(u.id);
    try {
      const { data } = await api.post(`/admin/impersonate/${u.id}`);
      setUser(data);
      toast.success(`Ahora estás viendo como ${u.name || u.email}`);
      navigate("/");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusyId(null); }
  };

  const saveGk = async () => {
    setSavingGk(true);
    try {
      await api.put("/admin/global-templates/goroky", { legal_notice: gk.legal_notice, footer_message: gk.footer_message });
      toast.success("Textos globales de GoRoky guardados");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSavingGk(false); }
  };

  const patchPlan = (idx, field, value) => {
    setPlans((list) => list.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };
  const patchFeature = (idx, key, value) => {
    setPlans((list) => list.map((p, i) => (i === idx ? { ...p, features: { ...p.features, [key]: value } } : p)));
  };
  const savePlans = async () => {
    setSavingPlans(true);
    try {
      const payload = { plans: {} };
      plans.forEach((p) => {
        payload.plans[p.id] = {
          name: p.name,
          price: Number(p.price) || 0,
          max_invoices: p.max_invoices === "" || p.max_invoices === null ? null : Number(p.max_invoices),
          max_contacts: p.max_contacts === "" || p.max_contacts === null ? null : Number(p.max_contacts),
          features: { email: !!p.features.email, verifactu: !!p.features.verifactu, ocr: !!p.features.ocr },
        };
      });
      const { data } = await api.put("/admin/plans", payload);
      setPlans(data);
      toast.success("Planes actualizados");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSavingPlans(false); }
  };

  const statCards = [
    { label: "Usuarios", value: stats?.total_users, icon: Users, color: "text-[#0052FF] bg-[#0052FF]/10" },
    { label: "Bloqueados", value: stats?.blocked, icon: ShieldOff, color: "text-red-600 bg-red-50" },
    { label: "Facturas totales", value: stats?.total_invoices, icon: FileText, color: "text-emerald-600 bg-emerald-50" },
  ];

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Administración</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gestiona usuarios, planes y plantillas globales</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {statCards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex items-center gap-3" data-testid={`stat-${c.label}`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.color}`}><c.icon className="w-5 h-5" strokeWidth={1.5} /></div>
            <div>
              <div className="text-2xl font-semibold text-slate-900 tabular">{c.value ?? "—"}</div>
              <div className="text-xs text-slate-500">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden mb-8" data-testid="revenue-panel">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} />
          <div className="font-medium text-slate-900">Ingresos y suscripciones</div>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "MRR (ingreso mensual)", value: revenue ? `${Number(revenue.mrr).toFixed(2)}€` : "—", icon: Euro, color: "text-[#0052FF] bg-[#0052FF]/10" },
            { label: "ARR (ingreso anual)", value: revenue ? `${Number(revenue.arr).toFixed(2)}€` : "—", icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
            { label: "Altas este mes", value: revenue?.altas_mes ?? "—", icon: UserPlus, color: "text-violet-600 bg-violet-50" },
            { label: "Pruebas activas", value: revenue?.trials_activos ?? "—", icon: Rocket, color: "text-amber-600 bg-amber-50" },
          ].map((c) => (
            <div key={c.label} className="flex items-center gap-3" data-testid={`revenue-${c.label}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.color}`}><c.icon className="w-5 h-5" strokeWidth={1.5} /></div>
              <div>
                <div className="text-xl font-semibold text-slate-900 tabular">{c.value}</div>
                <div className="text-xs text-slate-500">{c.label}</div>
              </div>
            </div>
          ))}
        </div>
        {revenue?.by_plan && (
          <div className="px-5 pb-5 flex flex-wrap gap-2">
            {["basico", "medio", "platino"].map((pid) => (
              <Badge key={pid} className={`rounded-full ${PLAN_BADGE[pid]} hover:${PLAN_BADGE[pid]}`} data-testid={`revenue-plan-${pid}`}>
                {PLAN_LABEL[pid]}: {revenue.by_plan[pid] ?? 0}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="font-medium text-slate-900">Usuarios</div>
          <form onSubmit={search} className="flex items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por email o nombre…" className="w-64" data-testid="admin-search" />
            <Button type="submit" variant="outline" className="border-slate-200" data-testid="admin-search-btn"><Search className="w-4 h-4" strokeWidth={1.5} /></Button>
          </form>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Usuario</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Uso (mes)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} data-testid={`admin-user-${u.email}`}>
                  <TableCell>
                    <div className="text-sm font-medium text-slate-900">{u.name || "—"}</div>
                    <div className="text-xs text-slate-500">{u.email}{u.role === "admin" && <Badge className="ml-2 bg-[#0052FF]/10 text-[#0052FF] hover:bg-[#0052FF]/10 rounded-full text-[10px]">admin</Badge>}</div>
                  </TableCell>
                  <TableCell>
                    {u.role === "admin" ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <Select value={u.plan} onValueChange={(v) => setPlan(u, v)} disabled={busyId === u.id}>
                        <SelectTrigger className="w-32 h-8" data-testid={`plan-select-${u.email}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basico">Básico</SelectItem>
                          <SelectItem value="medio">Medio</SelectItem>
                          <SelectItem value="platino">Platino</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-slate-600 tabular">
                    {u.usage?.invoices_month ?? 0} fact · {u.usage?.contacts ?? 0} cont
                  </TableCell>
                  <TableCell>
                    {u.is_blocked
                      ? <Badge className="bg-red-100 text-red-700 hover:bg-red-100 rounded-full">Bloqueado</Badge>
                      : <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-full">Activo</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {u.role !== "admin" && (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => impersonate(u)} disabled={busyId === u.id} title="Entrar como este usuario" data-testid={`impersonate-${u.email}`} className="h-8 text-slate-600 hover:text-[#0052FF]">
                          <UserCog className="w-4 h-4 mr-1" strokeWidth={1.5} /> Entrar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleBlock(u)} disabled={busyId === u.id} title={u.is_blocked ? "Desbloquear" : "Bloquear"} data-testid={`block-${u.email}`} className={`h-8 ${u.is_blocked ? "text-emerald-600" : "text-red-600"}`}>
                          {u.is_blocked ? <CheckCircle2 className="w-4 h-4 mr-1" strokeWidth={1.5} /> : <Ban className="w-4 h-4 mr-1" strokeWidth={1.5} />}
                          {u.is_blocked ? "Desbloquear" : "Bloquear"}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden mb-8" data-testid="plans-editor">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} />
            <div className="font-medium text-slate-900">Planes de suscripción</div>
          </div>
          <Button onClick={savePlans} disabled={savingPlans} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="save-plans">
            {savingPlans ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" strokeWidth={1.5} />}Guardar planes
          </Button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p, idx) => (
            <div key={p.id} className="border border-slate-200 rounded-lg p-4 space-y-3" data-testid={`plan-card-${p.id}`}>
              <div className="space-y-2">
                <Label className="text-xs">Nombre</Label>
                <Input value={p.name} onChange={(e) => patchPlan(idx, "name", e.target.value)} data-testid={`plan-name-${p.id}`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Precio (€/mes)</Label>
                  <Input type="number" step="0.01" value={p.price} onChange={(e) => patchPlan(idx, "price", e.target.value)} data-testid={`plan-price-${p.id}`} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Facturas/mes</Label>
                  <Input type="number" placeholder="∞" value={p.max_invoices ?? ""} onChange={(e) => patchPlan(idx, "max_invoices", e.target.value)} data-testid={`plan-invoices-${p.id}`} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Contactos (vacío = ilimitado)</Label>
                <Input type="number" placeholder="∞" value={p.max_contacts ?? ""} onChange={(e) => patchPlan(idx, "max_contacts", e.target.value)} data-testid={`plan-contacts-${p.id}`} />
              </div>
              <div className="space-y-2 pt-1">
                {[["email", "Envío por email"], ["ocr", "Escaneo OCR"], ["verifactu", "VeriFactu AEAT"]].map(([key, lbl]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{lbl}</span>
                    <Switch checked={!!p.features?.[key]} onCheckedChange={(v) => patchFeature(idx, key, v)} data-testid={`plan-feat-${key}-${p.id}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm max-w-3xl overflow-hidden" data-testid="global-templates-section">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="font-medium text-slate-900">Plantilla global: GoRoky</div>
          <div className="text-sm text-slate-500">Estos textos los ven todos los usuarios. Cada usuario puede sobrescribirlos en su Configuración.</div>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Mensaje del pie (central)</Label>
            <Input value={gk.footer_message} onChange={(e) => setGk({ ...gk, footer_message: e.target.value })} data-testid="global-footer-message" />
          </div>
          <div className="space-y-2">
            <Label>Aviso Legal (2ª página)</Label>
            <Textarea value={gk.legal_notice} onChange={(e) => setGk({ ...gk, legal_notice: e.target.value })} rows={12} className="font-mono text-xs" data-testid="global-legal-notice" />
            <p className="text-xs text-slate-400">Usa '## Título' para encabezados, '- ' para viñetas y **negrita**.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveGk} disabled={savingGk} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="save-global-templates">
              {savingGk ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" strokeWidth={1.5} />}Guardar textos globales
            </Button>
            {gk.defaults?.legal_notice && (
              <Button variant="outline" className="border-slate-200" onClick={() => setGk({ ...gk, legal_notice: gk.defaults.legal_notice, footer_message: gk.defaults.footer_message })} data-testid="reset-global-templates">
                Restaurar texto por defecto
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm max-w-3xl overflow-hidden mt-8" data-testid="integrations-section">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} />
          <div>
            <div className="font-medium text-slate-900">Integraciones</div>
            <div className="text-sm text-slate-500">Configura tus propias claves. Se guardan cifradas y tienen prioridad sobre el servidor.</div>
          </div>
        </div>
        <div className="p-5 space-y-8">
          {/* RESEND */}
          <div className="space-y-3">
            <div className="font-medium text-slate-800">Email · Resend</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>API Key de Resend {integ?.resend?.api_key_set && <span className="text-xs text-emerald-600">· configurada {integ.resend.api_key_hint}</span>}</Label>
                <Input type="password" placeholder={integ?.resend?.api_key_set ? "•••• (dejar vacío para no cambiar)" : "re_..."} value={integForm.resend.api_key || ""} onChange={(e) => setR("api_key", e.target.value)} data-testid="integ-resend-key" />
              </div>
              <div className="space-y-2">
                <Label>Email remitente (dominio verificado)</Label>
                <Input placeholder="facturas@openfactura.es" value={integForm.resend.from_email || ""} onChange={(e) => setR("from_email", e.target.value)} data-testid="integ-resend-from-email" />
              </div>
              <div className="space-y-2">
                <Label>Nombre remitente</Label>
                <Input placeholder="OpenFactura" value={integForm.resend.from_name || ""} onChange={(e) => setR("from_name", e.target.value)} data-testid="integ-resend-from-name" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Responder a (opcional)</Label>
                <Input placeholder="soporte@openfactura.es" value={integForm.resend.reply_to || ""} onChange={(e) => setR("reply_to", e.target.value)} data-testid="integ-resend-reply" />
              </div>
            </div>
            <p className="text-xs text-slate-400">Verifica tu dominio en Resend antes de enviar. Si dejas la API key vacía, se usará el email gestionado por defecto.</p>
          </div>

          {/* STRIPE */}
          <div className="space-y-3 border-t border-slate-100 pt-6">
            <div className="font-medium text-slate-800">Pagos · Stripe</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Clave secreta {integ?.stripe?.secret_key_set && <span className="text-xs text-emerald-600">· {integ.stripe.secret_key_hint}</span>}</Label>
                <Input type="password" placeholder={integ?.stripe?.secret_key_set ? "•••• (dejar vacío para no cambiar)" : "sk_live_..."} value={integForm.stripe.secret_key || ""} onChange={(e) => setS("secret_key", e.target.value)} data-testid="integ-stripe-secret" />
              </div>
              <div className="space-y-2">
                <Label>Clave publicable</Label>
                <Input placeholder="pk_live_..." value={integForm.stripe.publishable_key || ""} onChange={(e) => setS("publishable_key", e.target.value)} data-testid="integ-stripe-pub" />
              </div>
              <div className="space-y-2">
                <Label>Webhook secret {integ?.stripe?.webhook_secret_set && <span className="text-xs text-emerald-600">· configurado</span>}</Label>
                <Input type="password" placeholder={integ?.stripe?.webhook_secret_set ? "•••• (dejar vacío para no cambiar)" : "whsec_..."} value={integForm.stripe.webhook_secret || ""} onChange={(e) => setS("webhook_secret", e.target.value)} data-testid="integ-stripe-webhook" />
              </div>
              <div className="space-y-2">
                <Label>Modo</Label>
                <Select value={integForm.stripe.mode || "test"} onValueChange={(v) => setS("mode", v)}>
                  <SelectTrigger data-testid="integ-stripe-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="live">Live (producción)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-slate-400">Webhook: apunta a <span className="font-mono">https://openfactura.es/api/stripe/webhook</span></p>
          </div>

          {/* IA */}
          <div className="space-y-3 border-t border-slate-100 pt-6">
            <div className="font-medium text-slate-800">Asistente IA</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Select value={integForm.ai.provider || "emergent"} onValueChange={(v) => setA("provider", v)}>
                  <SelectTrigger data-testid="integ-ai-provider"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergent">Emergent (incluido)</SelectItem>
                    <SelectItem value="openai">OpenAI (tu clave)</SelectItem>
                    <SelectItem value="groq">Groq (tu clave)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input placeholder={integForm.ai.provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-5.4"} value={integForm.ai.model || ""} onChange={(e) => setA("model", e.target.value)} data-testid="integ-ai-model" />
              </div>
              {integForm.ai.provider === "openai" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>API Key de OpenAI {integ?.ai?.openai_key_set && <span className="text-xs text-emerald-600">· {integ.ai.openai_key_hint}</span>}</Label>
                  <Input type="password" placeholder={integ?.ai?.openai_key_set ? "•••• (dejar vacío para no cambiar)" : "sk-..."} value={integForm.ai.openai_key || ""} onChange={(e) => setA("openai_key", e.target.value)} data-testid="integ-ai-openai-key" />
                </div>
              )}
              {integForm.ai.provider === "groq" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>API Key de Groq {integ?.ai?.groq_key_set && <span className="text-xs text-emerald-600">· {integ.ai.groq_key_hint}</span>}</Label>
                  <Input type="password" placeholder={integ?.ai?.groq_key_set ? "•••• (dejar vacío para no cambiar)" : "gsk_..."} value={integForm.ai.groq_key || ""} onChange={(e) => setA("groq_key", e.target.value)} data-testid="integ-ai-groq-key" />
                </div>
              )}
            </div>
          </div>

          <Button onClick={saveInteg} disabled={savingInteg} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="save-integrations">
            {savingInteg ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" strokeWidth={1.5} />}Guardar integraciones
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm max-w-4xl overflow-hidden mt-8" data-testid="audit-log-section">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} />
          <div className="font-medium text-slate-900">Registro de actividad</div>
        </div>
        {audit.length === 0 ? (
          <div className="p-5 text-sm text-slate-400">Aún no hay actividad registrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="px-5 py-2.5 font-medium">Acción</th>
                <th className="px-5 py-2.5 font-medium">Administrador</th>
                <th className="px-5 py-2.5 font-medium">Usuario afectado</th>
                <th className="px-5 py-2.5 font-medium text-right">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((e, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0" data-testid="audit-row">
                  <td className="px-5 py-2.5 text-slate-700">{actionLabel(e.action)}</td>
                  <td className="px-5 py-2.5 text-slate-600">{e.actor_email}</td>
                  <td className="px-5 py-2.5 text-slate-600">{e.target_email}</td>
                  <td className="px-5 py-2.5 text-right text-slate-500">{e.at ? new Date(e.at).toLocaleString("es-ES") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
