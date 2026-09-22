import { useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, MailCheck, ShieldCheck } from "lucide-react";

const inputCls =
  "h-12 rounded-xl bg-slate-50 border border-slate-200/70 focus:bg-white focus:border-[#0052FF] focus-visible:ring-4 focus-visible:ring-[#0052FF]/10 transition-all";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-10 bg-gradient-to-b from-white to-slate-50/60">
      <Seo path="/recuperar-contrasena" title="Recuperar contraseña" description="Recupera el acceso a tu cuenta de OpenFactura." />
      <div className="w-full max-w-md space-y-7 of-fade-up">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0052FF] to-[#4C86FF] flex items-center justify-center text-white font-display font-bold shadow-[0_8px_20px_-4px_rgba(0,82,255,0.5)]">O</div>
          <span className="font-display text-xl font-semibold tracking-tight text-slate-900">openfactura</span>
        </div>

        {sent ? (
          <div className="space-y-5" data-testid="forgot-success">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100">
              <MailCheck className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-display text-[1.75rem] font-bold tracking-tight text-slate-900">Revisa tu correo</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Si <span className="font-medium text-slate-700">{email}</span> corresponde a una cuenta, te hemos enviado un enlace para restablecer tu contraseña. Revisa también la carpeta de spam. El enlace caduca en 1 hora.
              </p>
            </div>
            <Link to="/login" className="inline-flex items-center gap-2 text-[#0052FF] font-medium hover:underline text-sm" data-testid="back-to-login">
              <ArrowLeft className="w-4 h-4" strokeWidth={2} /> Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6" data-testid="forgot-form">
            <div>
              <h2 className="font-display text-[2rem] font-bold tracking-tight text-slate-900">Recupera tu contraseña</h2>
              <p className="text-sm text-slate-500 mt-1.5">Introduce tu email y te enviaremos un enlace para crear una nueva contraseña.</p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl" data-testid="forgot-error">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.es" required className={inputCls} data-testid="forgot-email" />
            </div>

            <Button type="submit" disabled={loading} data-testid="forgot-submit" className="w-full h-12 bg-gradient-to-r from-[#0052FF] to-[#2E6BFF] hover:from-[#0043CC] hover:to-[#245BE6] text-white rounded-xl shadow-[0_8px_20px_-4px_rgba(0,82,255,0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.98]">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Enviar enlace de recuperación
            </Button>

            <Link to="/login" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm" data-testid="back-to-login">
              <ArrowLeft className="w-4 h-4" strokeWidth={2} /> Volver a iniciar sesión
            </Link>

            <div className="flex items-center gap-2 text-xs text-slate-400 pt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.75} /> Datos cifrados · Enlace de un solo uso
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
