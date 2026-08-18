import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText, ShieldCheck, Bot, ScanLine, Landmark, Check, ArrowRight } from "lucide-react";

const FEATURES = [
  { icon: FileText, t: "Facturas en segundos", d: "Crea, envía y cobra facturas profesionales con series, rectificativas y PDF automático." },
  { icon: Landmark, t: "IVA e IRPF automáticos", d: "Modelos 303 y 130 calculados solos, con el 7% reducido para nuevos autónomos." },
  { icon: ShieldCheck, t: "VeriFactu AEAT", d: "Registro y anulación con huella encadenada y código QR, listo para la nueva normativa." },
  { icon: ScanLine, t: "Escaneo de gastos", d: "Sube una foto del ticket y la IA extrae proveedor, base e IVA por ti." },
  { icon: Bot, t: "Asistente con IA", d: "FiscalBot resuelve tus dudas de facturación e impuestos al instante." },
  { icon: Sparkles, t: "15 plantillas", d: "Diseños por sector personalizables con tu logo, color y pie de página." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0052FF] flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" strokeWidth={1.5} /></div>
            <span className="font-display text-lg font-semibold tracking-tight">OpenFactura<span className="text-[#0052FF]">.es</span></span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login"><Button variant="ghost" className="text-slate-600" data-testid="landing-login">Entrar</Button></Link>
            <Link to="/registro"><Button className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="landing-register">Empieza gratis</Button></Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-[#0052FF]/10 text-[#0052FF] rounded-full px-4 py-1.5 text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" strokeWidth={1.5} /> 14 días de prueba gratis · sin tarjeta
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] max-w-3xl mx-auto">
          La facturación para autónomos y pymes, <span className="text-[#0052FF]">simple de verdad</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-500 mt-6 max-w-2xl mx-auto">
          Emite facturas, controla tu IVA e IRPF, cumple con VeriFactu y deja que la IA te ayude. Todo en un panel bonito y fácil.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link to="/registro"><Button size="lg" className="bg-[#0052FF] hover:bg-[#0040CC] text-white w-full sm:w-auto" data-testid="hero-cta">Crear mi cuenta gratis <ArrowRight className="w-4 h-4 ml-2" strokeWidth={2} /></Button></Link>
          <Link to="/login"><Button size="lg" variant="outline" className="border-slate-200 w-full sm:w-auto">Ya tengo cuenta</Button></Link>
        </div>
      </section>

      <section className="bg-[#F8FAFC] border-y border-slate-100 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-center font-display text-2xl sm:text-3xl font-semibold tracking-tight mb-12">Todo lo que necesitas para facturar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.t} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="w-11 h-11 rounded-lg bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center mb-4"><f.icon className="w-5 h-5" strokeWidth={1.5} /></div>
                <div className="font-semibold mb-1">{f.t}</div>
                <div className="text-sm text-slate-500">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Empieza hoy, sin compromiso</h2>
        <p className="text-slate-500 mt-3">Prueba todas las funciones 14 días gratis. Luego elige el plan que mejor te venga, con opción anual y 2 meses gratis.</p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6 text-sm text-slate-600">
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" strokeWidth={2} /> Sin permanencia</span>
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" strokeWidth={2} /> Cancela cuando quieras</span>
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" strokeWidth={2} /> Datos en España</span>
        </div>
        <Link to="/registro"><Button size="lg" className="bg-[#0052FF] hover:bg-[#0040CC] text-white mt-8" data-testid="cta-bottom">Probar gratis 14 días</Button></Link>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} OpenFactura.es</span>
          <div className="flex gap-5">
            <Link to="/terminos" className="hover:text-slate-900" data-testid="footer-terms">Términos y condiciones</Link>
            <Link to="/privacidad" className="hover:text-slate-900" data-testid="footer-privacy">Política de privacidad</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
