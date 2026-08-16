import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

const MAX_POLLS = 8;

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { reload } = useAuth();
  const [state, setState] = useState("checking"); // checking | paid | timeout | error
  const polls = useRef(0);

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) { setState("error"); return; }
    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") {
          await reload();
          if (active) setState("paid");
          return;
        }
        if (["expired", "failed"].includes(data.payment_status)) { setState("error"); return; }
      } catch (e) { /* keep trying */ }
      polls.current += 1;
      if (polls.current >= MAX_POLLS) { setState("timeout"); return; }
      setTimeout(poll, 2000);
    };
    poll();
    return () => { active = false; };
  }, [params, reload]);

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-16 bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center" data-testid="payment-success-page">
        {state === "checking" && (
          <>
            <Loader2 className="w-12 h-12 text-[#0052FF] mx-auto animate-spin" strokeWidth={1.5} />
            <h1 className="font-display text-xl font-semibold text-slate-900 mt-4">Confirmando tu pago…</h1>
            <p className="text-sm text-slate-500 mt-1">Un momento, estamos activando tu plan.</p>
          </>
        )}
        {state === "paid" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" strokeWidth={1.5} />
            <h1 className="font-display text-xl font-semibold text-slate-900 mt-4">¡Pago completado!</h1>
            <p className="text-sm text-slate-500 mt-1">Tu plan se ha actualizado correctamente. La suscripción se renovará automáticamente cada mes.</p>
            <Button onClick={() => navigate("/")} className="mt-6 bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="success-go-dashboard">Ir al panel</Button>
          </>
        )}
        {(state === "timeout" || state === "error") && (
          <>
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" strokeWidth={1.5} />
            <h1 className="font-display text-xl font-semibold text-slate-900 mt-4">Estamos procesando tu pago</h1>
            <p className="text-sm text-slate-500 mt-1">Si el cargo se ha realizado, tu plan se activará en unos instantes. Puedes revisar tu plan en la página de Planes.</p>
            <Button onClick={() => navigate("/precios")} variant="outline" className="mt-6 border-slate-200" data-testid="success-go-pricing">Ver mis planes</Button>
          </>
        )}
      </div>
    </Layout>
  );
}
