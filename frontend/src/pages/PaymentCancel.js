import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function PaymentCancel() {
  const navigate = useNavigate();
  return (
    <Layout>
      <div className="max-w-md mx-auto mt-16 bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center" data-testid="payment-cancel-page">
        <XCircle className="w-12 h-12 text-slate-400 mx-auto" strokeWidth={1.5} />
        <h1 className="font-display text-xl font-semibold text-slate-900 mt-4">Pago cancelado</h1>
        <p className="text-sm text-slate-500 mt-1">No se ha realizado ningún cargo. Puedes volver a intentarlo cuando quieras.</p>
        <Button onClick={() => navigate("/precios")} className="mt-6 bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="cancel-go-pricing">Volver a Planes</Button>
      </div>
    </Layout>
  );
}
