import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Seo } from "@/components/Seo";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";

const perks = [
  "Facturas con IVA e IRPF en segundos",
  "Escaneo de tickets y gastos con IA",
  "Modelo 303 y 130 calculados por trimestre",
];

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
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-white">
      <Seo path="/login" title="Iniciar sesión" description="Accede a tu panel de OpenFactura para gestionar facturas, IVA, IRPF y VeriFactu." />
      <div className="hidden lg:flex flex-col justify-between p-14 bg-[#0A1B3D] text-white relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-[#0052FF]/30 blur-3xl" />
        <div className="flex items-center gap-2.5 relative">
          <img src="/openfactura-logo-white.png" alt="OpenFactura by GoRoky" className="h-8 w-auto" />
        </div>
        <div className="relative">
          <h1 className="font-display text-4xl xl:text-5xl font-semibold tracking-tight leading-[1.1]">
            La facturación de tu negocio, sin complicaciones.
          </h1>
          <div className="mt-8 space-y-3">
            {perks.map((p) => (
              <div key={p} className="flex items-center gap-3 text-white/80">
                <CheckCircle2 className="w-5 h-5 text-[#4C8DFF]" strokeWidth={1.5} />
                <span className="text-[15px]">{p}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-white/40 text-xs">Diseñado para autónomos y empresas en España</div>
      </div>

      <div className="flex items-center justify-center p-6 bg-[#F8FAFC] lg:bg-white">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6" data-testid="login-form">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Bienvenido de nuevo</h2>
            <p className="text-sm text-slate-500 mt-1.5">Accede a tu panel de facturación</p>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg" data-testid="login-error">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.es" required data-testid="login-email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password" />
          </div>
          <Button type="submit" disabled={loading} data-testid="login-submit" className="w-full bg-[#0052FF] hover:bg-[#0040CC] text-white">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Entrar
          </Button>
          <p className="text-sm text-slate-500 text-center">
            ¿No tienes cuenta?{" "}
            <Link to="/registro" className="text-[#0052FF] font-medium hover:underline" data-testid="go-register">Crea una gratis</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
