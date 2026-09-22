import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ArrowLeft, KeyRound } from "lucide-react";

const inputCls =
  "h-12 rounded-xl bg-slate-50 border border-slate-200/70 focus:bg-white focus:border-[#0052FF] focus-visible:ring-4 focus-visible:ring-[#0052FF]/10 transition-all";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
      navigate("/login");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-10 bg-gradient-to-b from-white to-slate-50/60">
      <Seo path="/restablecer-contrasena" title="Restablecer contraseña" description="Crea una nueva contraseña para tu cuenta de OpenFactura." />
      <div className="w-full max-w-md space-y-7 of-fade-up">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0052FF] to-[#4C86FF] flex items-center justify-center text-white font-display font-bold shadow-[0_8px_20px_-4px_rgba(0,82,255,0.5)]">O</div>
          <span className="font-display text-xl font-semibold tracking-tight text-slate-900">openfactura</span>
        </div>

        {!token ? (
          <div className="space-y-4" data-testid="reset-invalid">
            <h2 className="font-display text-[1.75rem] font-bold tracking-tight text-slate-900">Enlace no válido</h2>
            <p className="text-sm text-slate-500">El enlace de recuperación no es válido o está incompleto. Solicita uno nuevo.</p>
            <Link to="/recuperar-contrasena" className="inline-flex items-center gap-2 text-[#0052FF] font-medium hover:underline text-sm" data-testid="request-new-link">
              <ArrowLeft className="w-4 h-4" strokeWidth={2} /> Solicitar nuevo enlace
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6" data-testid="reset-form">
            <div className="w-12 h-12 rounded-2xl bg-[#0052FF]/10 flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-[#0052FF]" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-display text-[2rem] font-bold tracking-tight text-slate-900">Nueva contraseña</h2>
              <p className="text-sm text-slate-500 mt-1.5">Crea una contraseña segura (mínimo 8 caracteres, con letras y números).</p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl" data-testid="reset-error">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <div className="relative">
                <Input id="password" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className={`${inputCls} pr-11`} data-testid="reset-password" />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1} aria-label="Mostrar contraseña" data-testid="reset-toggle-password">
                  {showPw ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Repite la contraseña</Label>
              <Input id="confirm" type={showPw ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputCls} data-testid="reset-confirm" />
            </div>

            <Button type="submit" disabled={loading} data-testid="reset-submit" className="w-full h-12 bg-gradient-to-r from-[#0052FF] to-[#2E6BFF] hover:from-[#0043CC] hover:to-[#245BE6] text-white rounded-xl shadow-[0_8px_20px_-4px_rgba(0,82,255,0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.98]">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Guardar nueva contraseña
            </Button>

            <Link to="/login" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm" data-testid="back-to-login">
              <ArrowLeft className="w-4 h-4" strokeWidth={2} /> Volver a iniciar sesión
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
