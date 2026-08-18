import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { PartyPopper, ArrowRight } from "lucide-react";

export default function Welcome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 sm:p-10 max-w-md w-full text-center" data-testid="welcome-page">
        <div className="w-16 h-16 rounded-2xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center mx-auto mb-5">
          <PartyPopper className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">¡Felicidades{user?.name ? `, ${user.name.split(" ")[0]}` : ""}! 🎊</h1>
        <p className="text-slate-500 mt-3">
          Ya puedes empezar a facturar. Tienes <strong>14 días de prueba gratis</strong> con todas las funciones desbloqueadas: facturas, IVA/IRPF, VeriFactu y el asistente con IA.
        </p>
        <p className="text-sm text-slate-400 mt-2">Configura los datos de tu empresa y emite tu primera factura en menos de un minuto.</p>
        <Button onClick={() => navigate("/")} className="mt-7 w-full bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="welcome-start">
          Ir a mi panel <ArrowRight className="w-4 h-4 ml-2" strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}
