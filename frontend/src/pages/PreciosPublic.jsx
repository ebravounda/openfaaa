import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Check, ArrowRight, ArrowLeft } from "lucide-react";
import { Seo } from "@/components/Seo";

const ACCENT = "#0052FF";

const PLANS = [
  { name: "Básico", price: "0€", per: "/mes", desc: "Para empezar a facturar", features: ["Hasta 10 facturas al mes", "Clientes y presupuestos", "Cálculo de IVA e IRPF", "Facturas en PDF"], highlight: false },
  { name: "Medio", price: "9,99€", per: "/mes", desc: "Para autónomos en activo", features: ["Hasta 100 facturas al mes", "Envío de facturas por email", "Escáner de gastos con IA (OCR)", "Todo lo del plan Básico"], highlight: false },
  { name: "Platino", price: "24,99€", per: "/mes", desc: "Sin límites y con VeriFactu", features: ["Facturas ilimitadas", "VeriFactu AEAT + tu certificado", "Cobros con tarjeta (Stripe)", "Todo lo del plan Medio"], highlight: true },
  { name: "Multiempresas", price: "49,99€", per: "/mes", desc: "Para asesorías y grupos", features: ["Hasta 20 empresas y autónomos", "Certificado y contabilidad por empresa", "Todo lo de Platino en cada empresa", "Plan de 50 empresas disponible"], highlight: false, badge: "Nuevo" },
];

const COMPARISON = [
  ["Facturas al mes", "10", "100", "Ilimitadas", "Ilimitadas"],
  ["Presupuestos", "Sí", "Sí", "Sí", "Sí"],
  ["Escáner de gastos (IA)", "—", "Sí", "Sí", "Sí"],
  ["Envío por email", "—", "Sí", "Sí", "Sí"],
  ["VeriFactu AEAT", "—", "—", "Sí", "Sí"],
  ["Cobros con tarjeta", "—", "—", "Sí", "Sí"],
  ["Nº de empresas", "1", "1", "1", "20 (o 50)"],
];

const FAQ = [
  ["¿Hay una prueba gratuita?", "Sí, 14 días gratis con todas las funciones y sin tarjeta de crédito."],
  ["¿Puedo cancelar cuando quiera?", "Claro. No hay permanencia; puedes cancelar tu suscripción desde tu panel en cualquier momento."],
  ["¿El plan Platino cumple con VeriFactu?", "Sí. Incluye registro con huella encadenada, QR y firma con tu certificado digital, enviando a la AEAT."],
  ["¿Qué incluye el plan Multiempresas?", "Gestionas hasta 20 empresas o autónomos (o 50 con el tramo superior), cada uno con su contabilidad, numeración y certificado. Ideal para asesorías."],
  ["¿Necesito más de 20 empresas?", "Disponemos de un plan de 50 empresas y planes a medida. Escríbenos a soporte@goroky.com y lo adaptamos."],
];

export default function PreciosPublic() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-outfit">
      <Seo path="/precios" title="Precios y planes de facturación"
        description="Planes de OpenFactura desde 0€: facturación, VeriFactu, presupuestos, multiempresa y cobros con tarjeta. Compara Básico, Medio, Platino y Multiempresas. 14 días gratis." />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
        })}</script>
      </Helmet>

      <header className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/"><img src="/openfactura-logo.png" alt="OpenFactura" className="h-7 w-auto" /></Link>
          <Link to="/registro"><button className="rounded-full text-white px-5 py-2 text-sm font-semibold" style={{ background: ACCENT }} data-testid="pricing-register">Empieza gratis</button></Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#0052FF] mb-8"><ArrowLeft className="w-4 h-4" /> Volver al inicio</Link>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-center">Precios de OpenFactura</h1>
        <p className="text-slate-500 mt-4 text-center max-w-2xl mx-auto text-lg">El programa de facturación para autónomos, pymes y asesorías en España. 14 días gratis, opción anual con 2 meses gratis y sin permanencia.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-14 items-stretch">
          {PLANS.map((p) => (
            <div key={p.name} data-testid={`ppub-plan-${p.name}`} className={`rounded-2xl border p-6 flex flex-col ${p.highlight ? "border-[#0052FF] shadow-xl ring-1 ring-[#0052FF]/20" : "border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-lg">{p.name}</div>
                {p.badge ? <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#0052FF]/10 text-[#0052FF] rounded-full px-2 py-0.5">{p.badge}</span>
                  : p.highlight ? <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#0052FF] text-white rounded-full px-2 py-0.5">Popular</span> : null}
              </div>
              <div className="mt-3 flex items-end gap-1"><span className="text-3xl font-extrabold tracking-tight">{p.price}</span><span className="text-slate-400 text-sm mb-1">{p.per}</span></div>
              <p className="text-sm text-slate-500 mt-1">{p.desc}</p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {p.features.map((f) => (<li key={f} className="flex items-start gap-2 text-sm text-slate-600"><Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: ACCENT }} strokeWidth={2.5} /> {f}</li>))}
              </ul>
              <Link to="/registro" className="mt-6"><button className="w-full rounded-full text-white py-2.5 text-sm font-semibold" style={{ background: ACCENT }}>Probar gratis</button></Link>
            </div>
          ))}
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mt-20">Compara los planes</h2>
        <div className="overflow-x-auto mt-8">
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-700">
              <tr><th className="text-left p-3 font-semibold">Característica</th><th className="p-3 font-semibold">Básico</th><th className="p-3 font-semibold">Medio</th><th className="p-3 font-semibold text-[#0052FF]">Platino</th><th className="p-3 font-semibold">Multiempresas</th></tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={row[0]} className={i % 2 ? "bg-white" : "bg-slate-50/40"}>
                  <td className="p-3 text-slate-600">{row[0]}</td>
                  {row.slice(1).map((c, j) => <td key={j} className="p-3 text-center text-slate-700">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mt-20">Preguntas frecuentes</h2>
        <div className="max-w-3xl mx-auto mt-8 space-y-4">
          {FAQ.map(([q, a]) => (
            <div key={q} className="rounded-xl border border-slate-200 p-5">
              <div className="font-semibold text-slate-900">{q}</div>
              <p className="text-slate-500 mt-1.5 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl text-white text-center px-6 py-14 mt-20" style={{ background: ACCENT }}>
          <h2 className="text-3xl font-extrabold tracking-tight">Empieza a facturar hoy mismo</h2>
          <p className="text-white/80 mt-3">Prueba gratis 14 días. Sin tarjeta. Cancela cuando quieras.</p>
          <Link to="/registro" className="inline-block mt-7"><button className="bg-white text-[#0052FF] rounded-full px-8 py-3 font-semibold inline-flex items-center gap-2">Empezar gratis <ArrowRight className="w-4 h-4" /></button></Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap gap-6 justify-center text-sm text-slate-500">
          <Link to="/" className="hover:text-slate-900">Inicio</Link>
          <Link to="/blog" className="hover:text-slate-900">Blog</Link>
          <Link to="/terminos" className="hover:text-slate-900">Términos</Link>
          <Link to="/privacidad" className="hover:text-slate-900">Privacidad</Link>
        </div>
      </footer>
    </div>
  );
}
