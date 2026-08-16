import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/configuracion");
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
            Empieza a facturar<br />en minutos.
          </h1>
          <p className="text-white/60 mt-4 max-w-md text-base leading-relaxed">
            Crea tu cuenta, añade los datos de tu empresa o actividad y emite tu primera factura hoy.
          </p>
        </div>
        <div className="text-white/40 text-xs">Modelo 303 · IVA · IRPF · Autónomos y empresas</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6" data-testid="register-form">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-[#111111]">Crear cuenta</h2>
            <p className="text-sm text-[#666666] mt-1">Es gratis y solo toma un momento</p>
          </div>
          {error && (
            <div className="text-sm text-[#E63946] bg-[#E63946]/10 px-3 py-2 rounded-md" data-testid="register-error">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="register-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="register-email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="register-password" />
          </div>
          <Button type="submit" disabled={loading} data-testid="register-submit" className="w-full bg-[#0A0A0A] hover:bg-[#262626] text-white rounded-md">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crear cuenta
          </Button>
          <p className="text-sm text-[#666666] text-center">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-[#0A0A0A] font-semibold underline" data-testid="go-login">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
