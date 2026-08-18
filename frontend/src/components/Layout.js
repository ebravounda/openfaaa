import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AssistantWidget } from "@/components/AssistantWidget";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Users,
  Landmark,
  Settings,
  LogOut,
  Sparkles,
  Activity,
  Shield,
  UserCog,
  ArrowLeft,
  CreditCard,
  Menu,
  X,
} from "lucide-react";

const baseNav = [
  { to: "/", label: "Panel", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/facturas", label: "Facturas", icon: FileText, testid: "nav-invoices" },
  { to: "/gastos", label: "Gastos", icon: Receipt, testid: "nav-expenses" },
  { to: "/contactos", label: "Contactos", icon: Users, testid: "nav-contacts" },
  { to: "/impuestos", label: "Impuestos", icon: Landmark, testid: "nav-taxes" },
  { to: "/conexion", label: "Conexión", icon: Activity, testid: "nav-connection" },
  { to: "/precios", label: "Planes", icon: CreditCard, testid: "nav-pricing" },
  { to: "/configuracion", label: "Configuración", icon: Settings, testid: "nav-settings" },
];

const PLAN_LABEL = { basico: "Básico", medio: "Medio", platino: "Platino" };

function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "U";
}

export default function Layout({ children }) {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === "admin" && !user?.is_impersonating;
  const nav = isAdmin
    ? [...baseNav, { to: "/admin", label: "Administración", icon: Shield, testid: "nav-admin" }]
    : baseNav;

  const [usageWarn, setUsageWarn] = useState(null);
  useEffect(() => {
    if (!user || user.role === "admin") { setUsageWarn(null); return; }
    api.get("/plan").then(({ data }) => {
      const pl = data.plan, u = data.usage;
      const iPct = pl.max_invoices != null ? u.invoices_month / pl.max_invoices : 0;
      const cPct = pl.max_contacts != null ? u.contacts / pl.max_contacts : 0;
      if (iPct >= 0.8 || cPct >= 0.8) {
        const over = iPct >= 1 || cPct >= 1;
        setUsageWarn({
          over,
          text: over
            ? `Has alcanzado el límite de tu plan ${pl.name}.`
            : `Estás al ${Math.round(Math.max(iPct, cPct) * 100)}% del límite de tu plan ${pl.name}.`,
        });
      } else setUsageWarn(null);
    }).catch(() => {});
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const stopImpersonate = async () => {
    try {
      const { data } = await api.post("/admin/stop-impersonate");
      setUser(data);
      toast.success("Has vuelto a tu cuenta de administrador");
      navigate("/admin");
    } catch (e) {
      toast.error("No se pudo volver a la cuenta de administrador");
    }
  };

  const bannerH = user?.is_impersonating ? 36 : 0;

  let trialDays = null;
  if (user && user.role !== "admin" && (user.plan || "basico") === "basico" && user.trial_ends_at) {
    try {
      const end = new Date(user.trial_ends_at);
      const diffMs = end.getTime() - Date.now();
      if (diffMs > 0) trialDays = Math.ceil(diffMs / 86400000);
    } catch (_) { /* noop */ }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {user?.is_impersonating && (
        <div className="fixed top-0 left-0 right-0 z-[60] h-9 bg-amber-500 text-white text-xs sm:text-sm px-3 sm:px-5 flex items-center justify-center gap-2 sm:gap-3" data-testid="impersonation-banner">
          <UserCog className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span className="truncate">Viendo como <strong>{user?.name || user?.email}</strong></span>
          <button onClick={stopImpersonate} data-testid="stop-impersonate-button" className="ml-1 shrink-0 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-full px-3 py-1 font-medium transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} /> Volver a admin
          </button>
        </div>
      )}

      {/* Barra superior móvil */}
      <header className="lg:hidden fixed left-0 right-0 z-40 h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-4" style={{ top: bannerH }}>
        <button onClick={() => setMobileOpen(true)} data-testid="mobile-menu-button" className="p-1.5 -ml-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors" aria-label="Abrir menú">
          <Menu className="w-6 h-6" strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-2">
          <img src="/openfactura-logo.png" alt="OpenFactura by GoRoky" className="h-6 w-auto" />
        </div>
      </header>

      {/* Backdrop móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} data-testid="mobile-backdrop" />
      )}

      <aside
        className={`fixed left-0 w-[264px] max-w-[82vw] bg-white border-r border-slate-200 flex flex-col z-50 transform transition-transform duration-300 ease-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{ top: bannerH, height: `calc(100vh - ${bannerH}px)` }}
      >
        <div className="px-5 py-5 flex items-center gap-2.5">
          <img src="/openfactura-logo.png" alt="OpenFactura by GoRoky" className="h-7 w-auto flex-1 object-contain object-left" />
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" data-testid="mobile-menu-close" aria-label="Cerrar menú">
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={n.testid}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive ? "bg-slate-100 text-[#0052FF]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <n.icon className="w-[18px] h-[18px]" strokeWidth={1.5} style={isActive ? { color: "#0052FF" } : {}} />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center text-xs font-semibold">
              {initials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-900 truncate">{user?.name}</div>
              <div className="text-xs text-slate-500 truncate">
                {user?.role === "admin" && !user?.is_impersonating
                  ? "Administrador"
                  : (PLAN_LABEL[user?.plan] ? `Plan ${PLAN_LABEL[user?.plan]}` : (user?.tax_type === "empresa" ? "Empresa" : "Autónomo"))}
              </div>
            </div>
            <button onClick={handleLogout} data-testid="logout-button" title="Cerrar sesión" className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors duration-200">
              <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      <main className="lg:ml-[248px] min-h-screen pt-14 lg:pt-0" style={{ marginTop: bannerH }}>
        {trialDays != null && (
          <div className="px-4 sm:px-8 lg:px-10 py-2.5 flex items-center gap-3 text-xs sm:text-sm border-b bg-[#0052FF]/5 border-[#0052FF]/10 text-[#0052FF]" data-testid="trial-banner">
            <Sparkles className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span className="min-w-0">Prueba gratuita: te {trialDays === 1 ? "queda 1 día" : `quedan ${trialDays} días`} con todas las funciones.</span>
            <NavLink to="/precios" className="ml-auto shrink-0 font-medium underline underline-offset-2" data-testid="trial-upgrade">Ver planes</NavLink>
          </div>
        )}
        {usageWarn && (
          <div className={`px-4 sm:px-8 lg:px-10 py-2.5 flex items-center gap-3 text-xs sm:text-sm border-b ${usageWarn.over ? "bg-red-50 border-red-100 text-red-800" : "bg-amber-50 border-amber-100 text-amber-800"}`} data-testid="usage-warning-banner">
            <span className="min-w-0">{usageWarn.text} Mejora tu plan para seguir sin límites.</span>
            <NavLink to="/precios" className="ml-auto shrink-0 font-medium underline underline-offset-2 hover:opacity-80" data-testid="usage-warning-upgrade">Ver planes</NavLink>
          </div>
        )}
        <div className="px-4 sm:px-8 lg:px-10 py-6 lg:py-8 max-w-[1360px] w-full">{children}</div>
      </main>
      <AssistantWidget />
    </div>
  );
}
