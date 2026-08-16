import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, User, Building2 } from "lucide-react";
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

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      navigate("/configuracion");
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
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
      <form onSubmit={submit} className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-6" data-testid="register-form">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#0052FF] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-slate-900">FiscalHub España</span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Crea tu cuenta</h2>
          <p className="text-sm text-slate-500 mt-1.5">Empieza a facturar en minutos</p>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg" data-testid="register-error">{error}</div>
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
                className={`text-left p-3 rounded-lg border transition-colors duration-200 ${
                  taxType === o.v ? "border-[#0052FF] bg-[#0052FF]/5 ring-1 ring-[#0052FF]" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <o.icon className={`w-5 h-5 mb-1.5 ${taxType === o.v ? "text-[#0052FF]" : "text-slate-400"}`} strokeWidth={1.5} />
                <div className="text-sm font-medium text-slate-900">{o.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

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
        <div className="space-y-2">
          <Label>Tipo de actividad (para sugerir tu plantilla)</Label>
          <Select value={activity} onValueChange={setActivity}>
            <SelectTrigger data-testid="register-activity"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVITIES.map((a) => <SelectItem key={a.v} value={a.v}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={loading} data-testid="register-submit" className="w-full bg-[#0052FF] hover:bg-[#0040CC] text-white">
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Crear cuenta
        </Button>
        <p className="text-sm text-slate-500 text-center">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-[#0052FF] font-medium hover:underline" data-testid="go-login">Inicia sesión</Link>
        </p>
      </form>
    </div>
  );
}
