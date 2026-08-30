import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Seo } from "@/components/Seo";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ExternalLink, ShieldCheck, CreditCard } from "lucide-react";

export default function PaymentMethods() {
  const [stripe, setStripe] = useState(null);
  const [stripeKey, setStripeKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/stripe/status").then((r) => setStripe(r.data)).catch(() => setStripe({ connected: false })); }, []);

  const connect = async () => {
    if (!stripeKey.trim()) { toast.error("Pega tu clave secreta de Stripe"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/stripe/connect", { secret_key: stripeKey.trim() });
      setStripe({ connected: true, ...data });
      setStripeKey("");
      toast.success(`Stripe conectado: ${data.account_name}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "No se pudo conectar Stripe");
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!window.confirm("¿Desconectar tu cuenta de Stripe? Dejarás de poder enviar cobros.")) return;
    await api.delete("/stripe/connect");
    setStripe({ connected: false });
    toast.success("Stripe desconectado");
  };

  return (
    <Layout>
      <Seo title="Métodos de pago" description="Conecta tu cuenta de Stripe para cobrar tus facturas con tarjeta." noindex />
      <div className="max-w-2xl space-y-6" data-testid="payment-methods-page">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-[#635BFF]" strokeWidth={1.6} /> Métodos de pago
          </h1>
          <p className="text-slate-500 text-sm mt-1">Cobra tus facturas con tarjeta. Conecta tu propia cuenta de Stripe: el dinero llega directamente a ti.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5" data-testid="stripe-section">
          <div className="flex items-center gap-2 font-medium text-slate-900">
            <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-[#635BFF] text-white font-bold tracking-tight lowercase">stripe</span>
            <span>Cobros con tarjeta</span>
          </div>

          {stripe === null ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
          ) : stripe.connected ? (
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <div className="flex items-center gap-2 text-emerald-700 font-medium"><CheckCircle2 className="w-4 h-4" strokeWidth={1.5} /> Conectada</div>
                <div className="text-slate-500 mt-1">Cuenta: <strong>{stripe.account_name}</strong> · Modo {stripe.mode === "live" ? "Real (cobros reales)" : "Pruebas"}</div>
                {!stripe.charges_enabled && <div className="text-xs text-amber-600 mt-1">Tu cuenta aún no puede recibir cobros: completa la verificación (KYC) en Stripe.</div>}
              </div>
              <Button variant="outline" size="sm" className="border-slate-200 text-red-600 hover:text-red-700" onClick={disconnect} data-testid="stripe-disconnect">Desconectar</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Clave secreta de Stripe</Label>
                  <Input type="password" value={stripeKey} onChange={(e) => setStripeKey(e.target.value)} placeholder="sk_live_… o sk_test_…" data-testid="stripe-key-input" />
                </div>
                <Button onClick={connect} disabled={busy} className="bg-[#635BFF] hover:bg-[#544bff] text-white" data-testid="stripe-connect">
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Conectar
                </Button>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 text-xs text-slate-600 space-y-1.5">
                <div className="font-medium text-slate-900">Cómo conectar tu cuenta (2 minutos):</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Crea tu cuenta gratis en <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer" className="text-[#635BFF] font-medium">dashboard.stripe.com/register <ExternalLink className="inline w-3 h-3" /></a></li>
                  <li>Abre <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-[#635BFF] font-medium">Desarrolladores → Claves API <ExternalLink className="inline w-3 h-3" /></a></li>
                  <li>Copia tu <strong>Clave secreta</strong> (empieza por <code>sk_</code>) y pégala arriba.</li>
                </ol>
                <div className="text-slate-400 pt-1">Tu clave se guarda cifrada. Usa <code>sk_test_…</code> para probar y <code>sk_live_…</code> para cobrar de verdad.</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 text-slate-900 font-medium mb-2"><ShieldCheck className="w-5 h-5 text-emerald-600" strokeWidth={1.6} /> Cómo funciona</div>
          <ul className="text-sm text-slate-600 space-y-1.5 list-disc list-inside">
            <li>En <strong>Facturas</strong>, pulsa <strong>«Enviar Cobro»</strong> en cualquier factura pendiente.</li>
            <li>Tu cliente recibe un email con un botón <strong>Pagar</strong> y el PDF de la factura adjunto.</li>
            <li>Paga con tarjeta de crédito o débito de forma segura (procesado por Stripe).</li>
            <li>Cuando el pago se completa, la factura se marca <strong>Pagada</strong> automáticamente.</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
