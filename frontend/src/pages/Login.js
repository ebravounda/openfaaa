import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Seo } from "@/components/Seo";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, TrendingUp, ArrowRight, Eye, EyeOff, FileText, ScanLine, Receipt } from "lucide-react";

const perks = [
  { icon: FileText, t: "Facturas con IVA e IRPF en segundos" },
  { icon: ScanLine, t: "Escaneo de tickets y gastos con IA" },
  { icon: Receipt, t: "Modelo 303 y 130 calculados por trimestre" },
];

const inputCls =
  "h-12 rounded-xl bg-slate-50 border border-slate-200/70 focus:bg-white focus:border-[#0052FF] focus-visible:ring-4 focus-visible:ring-[#0052FF]/10 transition-all";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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

      {/* Visual side */}
      <div className="hidden lg:block relative overflow-hidden bg-[#070C1B]">
        {/* animated aurora orbs */}
        <div className="absolute -top-24 -left-20 w-[26rem] h-[26rem] rounded-full bg-[#0052FF]/40 blur-[110px] of-float" />
        <div className="absolute bottom-[-6rem] right-[-4rem] w-[30rem] h-[30rem] rounded-full bg-indigo-500/30 blur-[130px] of-float" style={{ animationDelay: "1.8s" }} />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-cyan-400/20 blur-[110px] of-float" style={{ animationDelay: "3.4s" }} />
        {/* dotted grid overlay */}
        <div className="absolute inset-0 opacity-[0.5]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)", backgroundSize: "30px 30px", maskImage: "radial-gradient(ellipse at center, black 40%, transparent 78%)" }} />

        <div className="absolute inset-0 flex flex-col justify-between p-12 xl:p-16 text-white">
          <img src="/openfactura-logo-white.png" alt="OpenFactura by GoRoky" className="h-8 w-auto max-w-[220px] object-contain self-start" />

          <div className="of-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 px-4 py-2 text-sm mb-7 shadow-lg shadow-black/20">
              <ShieldCheck className="w-4 h-4 text-emerald-300" strokeWidth={2} /> Homologado VeriFactu · AEAT
            </div>
            <h1 className="font-display text-4xl xl:text-[3.25rem] font-bold tracking-tight leading-[1.06] max-w-lg">
              La facturación de tu negocio, <span className="bg-gradient-to-r from-[#7FB0FF] to-[#B9CCFF] bg-clip-text text-transparent">sin complicaciones.</span>
            </h1>

            <div className="mt-9 space-y-4">
              {perks.map((p, i) => (
                <div key={p.t} className="flex items-center gap-3.5 text-white/85 of-fade-up" style={{ animationDelay: `${200 + i * 90}ms` }}>
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
                    <p.icon className="w-4 h-4 text-[#9CC0FF]" strokeWidth={1.75} />
                  </div>
                  <span className="text-[15px]">{p.t}</span>
                </div>
              ))}
            </div>

            {/* floating glass stat cards */}
            <div className="mt-11 flex items-end gap-4">
              <div className="rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/15 p-5 w-56 of-float shadow-2xl shadow-black/30">
                <div className="text-white/55 text-xs">Facturado este trimestre</div>
                <div className="font-display text-3xl font-bold mt-1 tabular-nums">24.980 €</div>
                <div className="flex items-center gap-1.5 text-emerald-300 text-xs mt-1.5">
                  <TrendingUp className="w-3.5 h-3.5" strokeWidth={2} /> +18% vs. anterior
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-400/15 backdrop-blur-2xl border border-emerald-300/25 p-4 w-40 of-float shadow-xl shadow-black/20" style={{ animationDelay: "2.2s" }}>
                <div className="flex items-center gap-1.5 text-emerald-200 text-xs font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> Factura cobrada</div>
                <div className="font-display text-xl font-bold mt-1 tabular-nums">1.815 €</div>
                <div className="text-white/45 text-[11px] mt-0.5">Stripe · hace 2 min</div>
              </div>
            </div>
          </div>

          <div className="text-white/40 text-xs">Diseñado para autónomos y empresas en España</div>
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-gradient-to-b from-white to-slate-50/60">
        <form onSubmit={submit} className="w-full max-w-md space-y-7 of-fade-up" data-testid="login-form">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0052FF] to-[#4C86FF] flex items-center justify-center text-white font-display font-bold shadow-[0_8px_20px_-4px_rgba(0,82,255,0.5)]">O</div>
            <span className="font-display text-xl font-semibold tracking-tight text-slate-900">openfactura</span>
          </div>

          <div>
            <h2 className="font-display text-[2rem] font-bold tracking-tight text-slate-900">Bienvenido de nuevo</h2>
            <p className="text-sm text-slate-500 mt-1.5">Accede a tu panel de facturación</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl of-fade-up" data-testid="login-error">
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
              <Link to="/recuperar-contrasena" className="text-sm text-[#0052FF] font-medium hover:underline" data-testid="login-forgot-password-link">¿Olvidaste tu contraseña?</Link>
            </div>
            <div className="relative">
              <Input id="password" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className={`${inputCls} pr-11`} data-testid="login-password" />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1} aria-label="Mostrar contraseña" data-testid="toggle-password">
                {showPw ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} data-testid="login-submit" className="w-full h-12 bg-gradient-to-r from-[#0052FF] to-[#2E6BFF] hover:from-[#0043CC] hover:to-[#245BE6] text-white rounded-xl shadow-[0_8px_20px_-4px_rgba(0,82,255,0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.98] group">
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
    </div>
  );
}
