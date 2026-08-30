import { XCircle } from "lucide-react";

export default function PagoCancelado() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4" data-testid="pago-cancelado">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm max-w-md w-full p-10 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center">
          <XCircle className="w-9 h-9 text-slate-400" strokeWidth={1.5} />
        </div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 mt-5">Pago cancelado</h1>
        <p className="text-slate-500 mt-2 text-sm">
          No se ha realizado ningún cargo. Si quieres pagar la factura más tarde, vuelve a abrir el enlace del email.
        </p>
        <div className="text-xs text-slate-400 mt-8">Pago seguro procesado por Stripe</div>
      </div>
    </div>
  );
}
