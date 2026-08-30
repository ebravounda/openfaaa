import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Seo } from "@/components/Seo";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, CheckCircle2, TrendingUp, ArrowRight } from "lucide-react";

const perks = [
  "Facturas con IVA e IRPF en segundos",
  "Escaneo de tickets y gastos con IA",
  "Modelo 303 y 130 calculados por trimestre",
];

const SIDE_IMG =
  "https://images.unsplash.com/photo-1653299832314-5d3dc1e5a83c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzN8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMGJsdWUlMjBncmFkaWVudCUyMDNkJTIwc2hhcGVzfGVufDB8fHx8MTc4ODEwMjI1OXww&ixlib=rb-4.1.0&q=85";

const inputCls =
  "h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <Seo path="/login" title="Iniciar sesión" description="Accede a tu panel de OpenFactura para gestionar facturas, IVA, IRPF y VeriFactu." />

      {/* Form side */}
      <div className="flex items-center justify-center p-6 sm:p-10 order-2 lg:order-1">
        <form onSubmit={submit} className="w-full max-w-md space-y-7 of-fade-up" data-testid="login-form">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0052FF] flex items-center justify-center text-white font-display font-bold shadow-[0_4px_14px_0_rgba(0,82,255,0.39)]">O</div>
            <span className="font-display text-xl font-semibold tracking-tight text-slate-900">openfactura</span>
          </div>

          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900">Bienvenido de nuevo</h2>
            <p className="text-sm text-slate-500 mt-1.5">Accede a tu panel de facturación</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl" data-testid="login-error">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.es" required className={inputCls} data-testid="login-email" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
            </div>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} data-testid="login-password" />
          </div>

          <Button type="submit" disabled={loading} data-testid="login-submit" className="w-full h-12 bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl shadow-[0_4px_14px_0_rgba(0,82,255,0.39)] transition-all hover:-translate-y-0.5 active:scale-[0.98] group">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Entrar
            {!loading && <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />}
          </Button>

          <p className="text-sm text-slate-500 text-center">
            ¿No tienes cuenta?{" "}
            <Link to="/registro" className="text-[#0052FF] font-medium hover:underline" data-testid="go-register">Crea una gratis</Link>
          </p>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.75} />
            Homologado VeriFactu · Datos cifrados
          </div>
        </form>
      </div>

      {/* Visual side */}
      <div className="hidden lg:block relative order-1 lg:order-2 overflow-hidden">
        <img src={SIDE_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A1B3D]/85 via-[#0A1B3D]/70 to-[#0052FF]/50" />

        <div className="absolute inset-0 flex flex-col justify-between p-12 xl:p-16 text-white">
          <img src="/openfactura-logo-white.png" alt="OpenFactura by GoRoky" className="h-8 w-auto" />

          <div className="of-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-2 text-sm mb-7">
              <ShieldCheck className="w-4 h-4 text-emerald-300" strokeWidth={2} /> Homologado VeriFactu · AEAT
            </div>
            <h1 className="font-display text-4xl xl:text-5xl font-semibold tracking-tight leading-[1.08] max-w-lg">
              La facturación de tu negocio, sin complicaciones.
            </h1>
            <div className="mt-8 space-y-3.5">
              {perks.map((p) => (
                <div key={p} className="flex items-center gap-3 text-white/85">
                  <CheckCircle2 className="w-5 h-5 text-[#7FB0FF] shrink-0" strokeWidth={1.75} />
                  <span className="text-[15px]">{p}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-5 max-w-xs of-float shadow-2xl">
              <div className="text-white/60 text-xs">Facturado este trimestre</div>
              <div className="font-display text-3xl font-bold mt-1 tabular">24.980 €</div>
              <div className="flex items-center gap-1.5 text-emerald-300 text-xs mt-1.5">
                <TrendingUp className="w-3.5 h-3.5" strokeWidth={2} /> +18% vs. trimestre anterior
              </div>
            </div>
          </div>

          <div className="text-white/40 text-xs">Diseñado para autónomos y empresas en España</div>
        </div>
      </div>
    </div>
  );
}
