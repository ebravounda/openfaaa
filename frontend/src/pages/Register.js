import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Seo } from "@/components/Seo";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Building2, Eye, EyeOff, ArrowRight, ShieldCheck, Sparkles, Rocket, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ACTIVITIES = [
  { v: "none", label: "Otro / General" },
  { v: "electricista", label: "Electricista" },
  { v: "fontanero", label: "Fontanero" },
  { v: "fotografo", label: "Fotógrafo" },
  { v: "chef", label: "Chef / Catering" },
  { v: "transportista", label: "Transportista" },
  { v: "informatico", label: "Informático" },
  { v: "telecomunicaciones", label: "Telecomunicaciones" },
  { v: "medico", label: "Médico" },
  { v: "dentista", label: "Dentista" },
  { v: "inmobiliaria", label: "Inmobiliaria" },
  { v: "restaurante", label: "Restaurante" },
  { v: "gasolina", label: "Gasolinera" },
  { v: "peluqueria", label: "Peluquería" },
  { v: "abogado", label: "Abogado / Asesoría" },
];

const inputCls =
  "h-12 rounded-xl bg-slate-50 border border-slate-200/70 focus:bg-white focus:border-[#0052FF] focus-visible:ring-4 focus-visible:ring-[#0052FF]/10 transition-all";

const perks = [
  { icon: Rocket, t: "Crea tu primera factura en 2 minutos" },
  { icon: ShieldCheck, t: "Homologado VeriFactu con la AEAT" },
  { icon: Clock, t: "14 días gratis · sin tarjeta" },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [taxType, setTaxType] = useState("autonomo");
  const [activity, setActivity] = useState("none");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password, taxType, activity === "none" ? "" : activity);
      navigate("/bienvenida");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const options = [
    { v: "autonomo", label: "Autónomo", desc: "IVA + IRPF (303 y 130)", icon: User },
    { v: "empresa", label: "Empresa", desc: "Sociedad · IVA (303)", icon: Building2 },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <Seo path="/registro" title="Crea tu cuenta gratis" description="Regístrate en OpenFactura y prueba gratis 14 días. Facturación, IVA, IRPF y VeriFactu para autónomos y pymes en España." />

      {/* Visual side */}
      <div className="hidden lg:block relative overflow-hidden bg-[#070C1B]">
        <div className="absolute -top-24 -left-20 w-[26rem] h-[26rem] rounded-full bg-[#0052FF]/40 blur-[110px] of-float" />
        <div className="absolute bottom-[-6rem] right-[-4rem] w-[30rem] h-[30rem] rounded-full bg-indigo-500/30 blur-[130px] of-float" style={{ animationDelay: "1.8s" }} />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-cyan-400/20 blur-[110px] of-float" style={{ animationDelay: "3.4s" }} />
        <div className="absolute inset-0 opacity-[0.5]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)", backgroundSize: "30px 30px", maskImage: "radial-gradient(ellipse at center, black 40%, transparent 78%)" }} />

        <div className="absolute inset-0 flex flex-col justify-between p-12 xl:p-16 text-white">
          <img src="/openfactura-logo-white.png" alt="OpenFactura by GoRoky" className="h-8 w-auto max-w-[220px] object-contain self-start" />

          <div className="of-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 px-4 py-2 text-sm mb-7 shadow-lg shadow-black/20">
              <Sparkles className="w-4 h-4 text-amber-300" strokeWidth={2} /> 14 días gratis · sin tarjeta
            </div>
            <h1 className="font-display text-4xl xl:text-[3.25rem] font-bold tracking-tight leading-[1.06] max-w-lg">
              Empieza a facturar <span className="bg-gradient-to-r from-[#7FB0FF] to-[#B9CCFF] bg-clip-text text-transparent">hoy mismo.</span>
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

            <div className="mt-11 rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/15 p-5 w-64 of-float shadow-2xl shadow-black/30">
              <div className="text-white/55 text-xs">Únete a cientos de negocios</div>
              <div className="font-display text-2xl font-bold mt-1">TPV · Facturas · Impuestos</div>
              <div className="flex items-center gap-1.5 text-emerald-300 text-xs mt-2">
                <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} /> Todo en una sola plataforma
              </div>
            </div>
          </div>

          <div className="text-white/40 text-xs">Diseñado para autónomos y empresas en España</div>
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-gradient-to-b from-white to-slate-50/60">
        <form onSubmit={submit} className="w-full max-w-md space-y-6 of-fade-up py-4" data-testid="register-form">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0052FF] to-[#4C86FF] flex items-center justify-center text-white font-display font-bold shadow-[0_8px_20px_-4px_rgba(0,82,255,0.5)]">O</div>
            <span className="font-display text-xl font-semibold tracking-tight text-slate-900">openfactura</span>
          </div>

          <div>
            <h2 className="font-display text-[2rem] font-bold tracking-tight text-slate-900">Crea tu cuenta</h2>
            <p className="text-sm text-slate-500 mt-1.5">Empieza a facturar en minutos</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl of-fade-up" data-testid="register-error">{error}</div>
          )}

          <div className="space-y-2">
            <Label>¿Cómo trabajas?</Label>
            <div className="grid grid-cols-2 gap-3">
              {options.map((o) => (
                <button
                  type="button"
                  key={o.v}
                  onClick={() => setTaxType(o.v)}
                  data-testid={`tax-type-${o.v}`}
                  className={`text-left p-3.5 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
                    taxType === o.v ? "border-[#0052FF] bg-[#0052FF]/5 ring-2 ring-[#0052FF]/15 shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <o.icon className={`w-5 h-5 mb-1.5 ${taxType === o.v ? "text-[#0052FF]" : "text-slate-400"}`} strokeWidth={1.5} />
                  <div className="text-sm font-semibold text-slate-900">{o.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} data-testid="register-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.es" required className={inputCls} data-testid="register-email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input id="password" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className={`${inputCls} pr-11`} data-testid="register-password" />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1} aria-label="Mostrar contraseña" data-testid="toggle-password">
                {showPw ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tipo de actividad <span className="text-slate-400 font-normal">(sugiere tu plantilla)</span></Label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200/70" data-testid="register-activity"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVITIES.map((a) => <SelectItem key={a.v} value={a.v}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={loading} data-testid="register-submit" className="w-full h-12 bg-gradient-to-r from-[#0052FF] to-[#2E6BFF] hover:from-[#0043CC] hover:to-[#245BE6] text-white rounded-xl shadow-[0_8px_20px_-4px_rgba(0,82,255,0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.98] group">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Crear cuenta gratis
            {!loading && <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />}
          </Button>

          <p className="text-sm text-slate-500 text-center">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-[#0052FF] font-medium hover:underline" data-testid="go-login">Inicia sesión</Link>
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.75} />
            Sin permanencia · Cancela cuando quieras
          </div>
        </form>
      </div>
    </div>
  );
}
