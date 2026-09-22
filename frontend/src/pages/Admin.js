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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Users, ShieldOff, FileText, Search, UserCog, Ban, CheckCircle2, Loader2, Save, CreditCard, History, TrendingUp, Euro, Rocket, UserPlus, Mail, Store, Eye, Phone, MapPin, IdCard, Percent, Clock, UserMinus, UserCheck, Building2, Plus } from "lucide-react";

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
  const [testTo, setTestTo] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkAudience, setBulkAudience] = useState("all");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkJob, setBulkJob] = useState(null);
  const [gestorias, setGestorias] = useState([]);
  const [gForm, setGForm] = useState({ firm_name: "", email: "", password: "", max_clients: 0, iban: "" });
  const [gSaving, setGSaving] = useState(false);

  const loadGestorias = () => api.get("/admin/gestorias").then((r) => setGestorias(r.data)).catch(() => {});

  const createGestoria = async () => {
    if (!gForm.firm_name.trim() || !gForm.email.trim() || gForm.password.length < 8) {
      toast.error("Completa nombre, email y una contraseña de al menos 8 caracteres.");
      return;
    }
    setGSaving(true);
    try {
      await api.post("/admin/gestorias", { ...gForm, max_clients: Number(gForm.max_clients) || 0 });
      toast.success("Gestoría creada");
      setGForm({ firm_name: "", email: "", password: "", max_clients: 0, iban: "" });
      loadGestorias();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudo crear la gestoría");
    } finally { setGSaving(false); }
  };

  const editGestoriaMax = async (g) => {
    const v = window.prompt(`Cupo máximo de clientes para ${g.firm_name} (0 = ilimitado):`, g.max_clients);
    if (v === null) return;
    try { await api.patch(`/admin/gestorias/${g.id}`, { max_clients: Number(v) || 0 }); toast.success("Cupo actualizado"); loadGestorias(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const editGestoriaIban = async (g) => {
    const v = window.prompt(`IBAN de cobro para ${g.firm_name}:`, g.iban || "");
    if (v === null) return;
    try { await api.patch(`/admin/gestorias/${g.id}`, { iban: v.trim() }); toast.success("IBAN actualizado"); loadGestorias(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const sendSepaLink = async (u) => {
    try {
      const { data } = await api.post("/admin/sepa-link", { user_id: u.id, origin_url: window.location.origin });
      try { await navigator.clipboard.writeText(data.url); } catch (e) {}
      toast.success(`Enlace SEPA ${data.email_sent ? `enviado a ${data.email} y ` : ""}copiado al portapapeles`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudo generar el enlace SEPA");
    }
  };

  const audienceCount = (aud) => {
    const clients = (users || []).filter((u) => u.role !== "admin");
    if (aud === "active") return clients.filter((u) => !u.is_blocked).length;
    if (aud === "blocked") return clients.filter((u) => u.is_blocked).length;
    return clients.length;
  };

  const sendBulk = async () => {
    if (!bulkSubject.trim() || !bulkMessage.trim()) { toast.error("Indica un asunto y un mensaje."); return; }
    const n = audienceCount(bulkAudience);
    if (n === 0) { toast.error("No hay destinatarios para ese criterio."); return; }
    if (!window.confirm(`¿Enviar este email a ${n} cliente(s)? Esta acción no se puede deshacer.`)) return;
    setBulkSending(true);
    setBulkJob(null);
    try {
      const { data } = await api.post("/admin/broadcast", { subject: bulkSubject, message: bulkMessage, audience: bulkAudience });
      setBulkJob({ ...data, sent: 0, failed: 0 });
      const poll = setInterval(async () => {
        try {
          const r = await api.get(`/admin/broadcast/${data.job_id}`);
          setBulkJob(r.data);
          if (r.data.status === "done") {
            clearInterval(poll);
            setBulkSending(false);
            toast.success(`Envío completado: ${r.data.sent} enviados, ${r.data.failed} fallidos.`);
          }
        } catch { clearInterval(poll); setBulkSending(false); }
      }, 1500);
    } catch (e) {
      setBulkSending(false);
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudo iniciar el envío");
    }
  };

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
    api.get("/admin/gestorias").then((r) => setGestorias(r.data)).catch(() => {});
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
  const sendTestEmail = async () => {
    setSendingTest(true);
    try {
      const { data } = await api.post("/admin/test-email", { to: testTo });
      toast.success(`Email de prueba enviado a ${data.to} (vía ${data.provider})`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSendingTest(false); }
  };

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

  const togglePos = async (u) => {
    setBusyId(u.id);
    try {
      const { data } = await api.post(`/admin/users/${u.id}/pos-toggle`);
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, is_pos_enabled: data.is_pos_enabled } : x)));
      toast.success(data.is_pos_enabled ? `TPV activado para ${u.email}` : `TPV desactivado para ${u.email}`);
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
    { label: "Clientes", value: stats?.clients, icon: Users, color: "text-[#0052FF] bg-[#0052FF]/10" },
    { label: "Activos", value: stats?.active_clients, icon: UserCheck, color: "text-emerald-600 bg-emerald-50" },
    { label: "Clientes de baja", value: stats?.bajas, icon: UserMinus, color: "text-red-600 bg-red-50" },
    { label: "Altas este mes", value: stats?.altas_mes, icon: UserPlus, color: "text-violet-600 bg-violet-50" },
    { label: "Retención", value: stats ? `${stats.retention_rate}%` : undefined, icon: Percent, color: "text-emerald-600 bg-emerald-50" },
    { label: "Churn (bajas)", value: stats ? `${stats.churn_rate}%` : undefined, icon: TrendingUp, color: "text-red-600 bg-red-50" },
    { label: "Permanencia media", value: stats ? `${stats.avg_permanencia_days} d` : undefined, icon: Clock, color: "text-amber-600 bg-amber-50" },
    { label: "Facturas totales", value: stats?.total_invoices, icon: FileText, color: "text-slate-700 bg-slate-100" },
  ];
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—");

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Administración</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gestiona usuarios, planes y plantillas globales</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setDetailUser(u)} title="Ver detalles" data-testid={`details-${u.email}`} className="h-8 text-slate-600 hover:text-[#0052FF]">
                        <Eye className="w-4 h-4 mr-1" strokeWidth={1.5} /> Detalles
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => sendSepaLink(u)} title="Enviar enlace de domiciliación SEPA" data-testid={`sepa-${u.email}`} className="h-8 text-slate-600 hover:text-[#0052FF]">
                        <Mail className="w-4 h-4 mr-1" strokeWidth={1.5} /> SEPA
                      </Button>
                      {u.role !== "admin" && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => impersonate(u)} disabled={busyId === u.id} title="Entrar como este usuario" data-testid={`impersonate-${u.email}`} className="h-8 text-slate-600 hover:text-[#0052FF]">
                            <UserCog className="w-4 h-4 mr-1" strokeWidth={1.5} /> Entrar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => togglePos(u)} disabled={busyId === u.id} title={u.is_pos_enabled ? "Desactivar TPV" : "Activar TPV"} data-testid={`pos-${u.email}`} className={`h-8 ${u.is_pos_enabled ? "text-[#0052FF]" : "text-slate-500"}`}>
                            <Store className="w-4 h-4 mr-1" strokeWidth={1.5} />
                            {u.is_pos_enabled ? "TPV ✓" : "TPV"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleBlock(u)} disabled={busyId === u.id} title={u.is_blocked ? "Desbloquear" : "Bloquear"} data-testid={`block-${u.email}`} className={`h-8 ${u.is_blocked ? "text-emerald-600" : "text-red-600"}`}>
                            {u.is_blocked ? <CheckCircle2 className="w-4 h-4 mr-1" strokeWidth={1.5} /> : <Ban className="w-4 h-4 mr-1" strokeWidth={1.5} />}
                            {u.is_blocked ? "Desbloquear" : "Bloquear"}
                          </Button>
                        </>
                      )}
                    </div>
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
            <div className="flex flex-wrap items-end gap-2 pt-1">
              <div className="space-y-1 flex-1 min-w-[220px]">
                <Label className="text-xs">Enviar email de prueba a</Label>
                <Input type="email" placeholder="tu@correo.com (vacío = tu email admin)" value={testTo} onChange={(e) => setTestTo(e.target.value)} data-testid="test-email-to" />
              </div>
              <Button variant="outline" onClick={sendTestEmail} disabled={sendingTest} className="border-slate-200" data-testid="send-test-email">
                {sendingTest ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" strokeWidth={1.5} />}Enviar prueba
              </Button>
            </div>
            <p className="text-xs text-amber-600">Guarda las integraciones antes de enviar la prueba (usa la configuración guardada).</p>
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

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm max-w-4xl overflow-hidden mt-8" data-testid="gestorias-section">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} />
          <div className="font-medium text-slate-900">Gestorías (revendedores)</div>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Nombre / Razón social</Label><Input value={gForm.firm_name} onChange={(e) => setGForm({ ...gForm, firm_name: e.target.value })} placeholder="Gestoría Pérez S.L." data-testid="gestoria-firm" /></div>
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Email de acceso</Label><Input type="email" value={gForm.email} onChange={(e) => setGForm({ ...gForm, email: e.target.value })} placeholder="admin@gestoria.es" data-testid="gestoria-email" /></div>
            <div className="space-y-1"><Label className="text-xs">Contraseña</Label><Input type="text" value={gForm.password} onChange={(e) => setGForm({ ...gForm, password: e.target.value })} placeholder="mín. 8" data-testid="gestoria-password" /></div>
            <div className="space-y-1"><Label className="text-xs">Cupo clientes (0 = ilimitado)</Label><Input type="number" value={gForm.max_clients} onChange={(e) => setGForm({ ...gForm, max_clients: e.target.value })} data-testid="gestoria-max" /></div>
            <div className="space-y-1 sm:col-span-3"><Label className="text-xs">IBAN (cobro SEPA)</Label><Input value={gForm.iban} onChange={(e) => setGForm({ ...gForm, iban: e.target.value })} placeholder="ES.. (opcional)" data-testid="gestoria-iban" /></div>
            <div className="sm:col-span-1">
              <Button onClick={createGestoria} disabled={gSaving} className="w-full bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="gestoria-create">
                {gSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" strokeWidth={2} />}Crear
              </Button>
            </div>
          </div>

          {gestorias.length === 0 ? (
            <div className="text-sm text-slate-400">Aún no hay gestorías. Crea la primera arriba.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-100">
                  <tr>
                    <th className="text-left py-2">Gestoría</th>
                    <th className="text-right py-2">Clientes</th>
                    <th className="text-left py-2 pl-4">Planes</th>
                    <th className="text-right py-2">Facturación mensual (50%)</th>
                    <th className="text-right py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {gestorias.map((g) => (
                    <tr key={g.id} className="border-b border-slate-50" data-testid={`gestoria-row-${g.email}`}>
                      <td className="py-3">
                        <div className="font-medium text-slate-900">{g.firm_name}</div>
                        <div className="text-xs text-slate-400">{g.email}{g.iban ? ` · ${g.iban}` : ""}</div>
                      </td>
                      <td className="py-3 text-right tabular-nums">{g.clients_count}{g.max_clients ? <span className="text-slate-400"> / {g.max_clients}</span> : ""}</td>
                      <td className="py-3 pl-4 text-xs text-slate-500">
                        {Object.keys(g.plan_breakdown || {}).length === 0 ? "—" : Object.entries(g.plan_breakdown).map(([p, n]) => `${PLAN_LABEL[p] || p}: ${n}`).join(" · ")}
                      </td>
                      <td className="py-3 text-right font-medium tabular-nums">{(g.monthly_value || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => sendSepaLink(g)} className="h-8 text-[#0052FF]" data-testid={`gestoria-sepa-${g.email}`}>Enviar enlace SEPA</Button>
                        <Button size="sm" variant="ghost" onClick={() => editGestoriaMax(g)} className="h-8 text-slate-600" data-testid={`gestoria-editmax-${g.email}`}>Cupo</Button>
                        <Button size="sm" variant="ghost" onClick={() => editGestoriaIban(g)} className="h-8 text-slate-600" data-testid={`gestoria-editiban-${g.email}`}>IBAN</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm max-w-3xl overflow-hidden mt-8" data-testid="bulk-email-section">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} />
          <div className="font-medium text-slate-900">Envíos masivos</div>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-500">Envía un correo a todos tus clientes de una vez. Puedes usar <span className="font-mono text-[13px] bg-slate-100 px-1 rounded">{"{nombre}"}</span> en el mensaje para personalizarlo con el nombre de cada cliente.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Destinatarios</Label>
              <Select value={bulkAudience} onValueChange={setBulkAudience} disabled={bulkSending}>
                <SelectTrigger data-testid="bulk-audience"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes ({audienceCount("all")})</SelectItem>
                  <SelectItem value="active">Solo activos ({audienceCount("active")})</SelectItem>
                  <SelectItem value="blocked">Solo de baja ({audienceCount("blocked")})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Asunto</Label>
              <Input placeholder="Novedades de OpenFactura" value={bulkSubject} onChange={(e) => setBulkSubject(e.target.value)} disabled={bulkSending} data-testid="bulk-subject" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mensaje</Label>
            <Textarea rows={7} placeholder={"Hola {nombre},\n\nQueremos contarte que..."} value={bulkMessage} onChange={(e) => setBulkMessage(e.target.value)} disabled={bulkSending} data-testid="bulk-message" />
          </div>

          {bulkJob && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm" data-testid="bulk-progress">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-700">
                  {bulkJob.status === "done" ? "Envío completado" : "Enviando…"}
                </span>
                <span className="text-slate-500 tabular-nums">{(bulkJob.sent || 0) + (bulkJob.failed || 0)} / {bulkJob.total}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-[#0052FF] transition-all" style={{ width: `${bulkJob.total ? Math.round(((bulkJob.sent || 0) + (bulkJob.failed || 0)) / bulkJob.total * 100) : 0}%` }} />
              </div>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                <span className="text-emerald-600">✓ {bulkJob.sent || 0} enviados</span>
                {(bulkJob.failed || 0) > 0 && <span className="text-red-600">✕ {bulkJob.failed} fallidos</span>}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={sendBulk} disabled={bulkSending} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="bulk-send">
              {bulkSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" strokeWidth={1.5} />}
              Enviar a {audienceCount(bulkAudience)} cliente{audienceCount(bulkAudience) === 1 ? "" : "s"}
            </Button>
            <span className="text-xs text-amber-600">Requiere Resend configurado en Integraciones.</span>
          </div>
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
      <Dialog open={!!detailUser} onOpenChange={(o) => !o && setDetailUser(null)}>
        <DialogContent className="sm:max-w-lg" data-testid="user-detail-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailUser?.name || detailUser?.email}
              {detailUser?.role === "admin" && <Badge className="bg-[#0052FF]/10 text-[#0052FF] hover:bg-[#0052FF]/10 rounded-full text-[10px]">admin</Badge>}
            </DialogTitle>
            <DialogDescription>Datos de la cuenta y de facturación del cliente</DialogDescription>
          </DialogHeader>
          {detailUser && (
            <div className="space-y-1 text-sm" data-testid="user-detail-body">
              {[
                { icon: Users, label: "Nombre / Razón social", value: [detailUser.name, detailUser.last_name].filter(Boolean).join(" ") || "—" },
                { icon: IdCard, label: "DNI / NIE / CIF", value: detailUser.tax_id || "—" },
                { icon: Mail, label: "Email", value: detailUser.email },
                { icon: Phone, label: "Teléfono", value: detailUser.phone || "—" },
                { icon: MapPin, label: "Dirección", value: detailUser.address || "—" },
                { icon: Store, label: "Empresa", value: detailUser.company_name || "—" },
                { icon: CreditCard, label: "Plan", value: PLAN_LABEL[detailUser.plan] || detailUser.plan },
                { icon: FileText, label: "Facturas (total / mes)", value: `${detailUser.usage?.invoices_total ?? 0} / ${detailUser.usage?.invoices_month ?? 0}` },
                { icon: UserPlus, label: "Alta", value: fmtDate(detailUser.created_at) },
                { icon: Clock, label: "Fin de prueba", value: detailUser.trial_ends_at ? fmtDate(detailUser.trial_ends_at) : "—" },
                { icon: detailUser.is_blocked ? Ban : CheckCircle2, label: "Estado", value: detailUser.is_blocked ? "De baja / bloqueado" : "Activo" },
              ].map((row) => (
                <div key={row.label} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5"><row.icon className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-400">{row.label}</div>
                    <div className="text-slate-800 font-medium break-words">{row.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
