import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#FAFAFA]">
      <div className="hidden lg:flex flex-col justify-between bg-[#0A0A0A] text-white p-12">
        <div className="font-heading text-2xl font-extrabold tracking-tighter">FiscalHub España</div>
        <div>
          <h1 className="font-heading text-4xl xl:text-5xl font-black tracking-tighter leading-tight">
            Tu facturación e IVA,<br />bajo control.
          </h1>
          <p className="text-white/60 mt-4 max-w-md text-base leading-relaxed">
            Emite facturas con IVA e IRPF, registra tus gastos y consulta cuánto debes pagar
            en cada trimestre según el calendario de Hacienda.
          </p>
        </div>
        <div className="text-white/40 text-xs">Modelo 303 · IVA · IRPF · Autónomos y empresas</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6" data-testid="login-form">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-[#111111]">Iniciar sesión</h2>
            <p className="text-sm text-[#666666] mt-1">Accede a tu panel de facturación</p>
          </div>
          {error && (
            <div className="text-sm text-[#E63946] bg-[#E63946]/10 px-3 py-2 rounded-md" data-testid="login-error">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.es"
              required
              data-testid="login-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="login-password"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            data-testid="login-submit"
            className="w-full bg-[#0A0A0A] hover:bg-[#262626] text-white rounded-md"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Entrar
          </Button>
          <p className="text-sm text-[#666666] text-center">
            ¿No tienes cuenta?{" "}
            <Link to="/registro" className="text-[#0A0A0A] font-semibold underline" data-testid="go-register">
              Regístrate
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
