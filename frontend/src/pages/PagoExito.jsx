import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API } from "@/lib/api";
import { CheckCircle2, Loader2, Clock } from "lucide-react";

export default function PagoExito() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [state, setState] = useState("checking"); // checking | paid | pending
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!sessionId) { setState("pending"); return; }
    let tries = 0;
    let timer;
    const poll = async () => {
      try {
        const r = await fetch(`${API}/public/payment-status/${sessionId}`);
        const d = await r.json();
        setInfo(d);
        if (d.payment_status === "paid") { setState("paid"); return; }
      } catch (e) {}
      tries += 1;
      if (tries < 15) timer = setTimeout(poll, 2500);
      else setState("pending");
    };
    poll();
    return () => clearTimeout(timer);
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4" data-testid="pago-exito">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm max-w-md w-full p-10 text-center">
        {state === "checking" && (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-[#635BFF] animate-spin" strokeWidth={1.5} />
            <h1 className="font-display text-2xl font-semibold text-slate-900 mt-5">Confirmando tu pago…</h1>
            <p className="text-slate-500 mt-2 text-sm">Un momento, estamos verificando con Stripe.</p>
          </>
        )}
        {state === "paid" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-2xl font-semibold text-slate-900 mt-5">¡Pago recibido!</h1>
            <p className="text-slate-500 mt-2 text-sm">
              Gracias. Tu pago de la factura {info?.invoice_number ? <strong>{info.invoice_number}</strong> : ""} se ha completado correctamente.
            </p>
          </>
        )}
        {state === "pending" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 flex items-center justify-center">
              <Clock className="w-9 h-9 text-amber-500" strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-2xl font-semibold text-slate-900 mt-5">Pago en proceso</h1>
            <p className="text-slate-500 mt-2 text-sm">Tu pago se está procesando. Recibirás confirmación en breve; puedes cerrar esta ventana.</p>
          </>
        )}
        <div className="text-xs text-slate-400 mt-8">Pago seguro procesado por Stripe</div>
      </div>
    </div>
  );
}
