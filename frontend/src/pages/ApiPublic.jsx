import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, ArrowLeft, Building2, Users, FileText, Receipt, FileDown, ShieldCheck, Webhook, KeyRound, Activity, Check } from "lucide-react";
import { Seo } from "@/components/Seo";

const ACCENT = "#0052FF";

const RESOURCES = [
  [Building2, "Empresas", "Consulta la empresa vinculada a cada clave.", "GET /api/v1/companies"],
  [Users, "Clientes", "Crea y lista clientes, también extranjeros con su VAT.", "POST /api/v1/contacts"],
  [FileText, "Facturas", "Emite facturas con varios tipos de IVA, IRPF y numeración automática.", "POST /api/v1/invoices"],
  [FileDown, "PDF", "Descarga el PDF de cualquier factura con tu logo.", "GET /api/v1/invoices/{id}/pdf"],
  [ShieldCheck, "VeriFactu", "Envía la factura a la AEAT y consulta su estado y CSV.", "POST /api/v1/invoices/{id}/verifactu"],
  [Receipt, "Gastos", "Registra gastos y tickets desde tu sistema.", "POST /api/v1/expenses"],
];

const EVENTS = ["invoice.created", "invoice.verifactu.accepted", "invoice.verifactu.rejected", "client.created", "expense.created"];

const PLANS = [
  { name: "Platino", price: "24,99€", items: ["API REST completa", "1 empresa con su clave", "60 peticiones por minuto", "Webhooks firmados y registro de actividad"] },
  { name: "Multiempresas", price: "49,99€", items: ["API REST completa", "Una clave por cada empresa (hasta 20 o 50)", "120 peticiones por minuto por clave", "Webhooks y registro por empresa"], highlight: true },
];

const FAQ = [
  ["¿Qué planes incluyen la API?", "Platino y Multiempresas. Las gestorías también pueden crear claves para las empresas de sus clientes."],
  ["¿Cómo me autentico?", "Con una clave de API en la cabecera Authorization: Bearer of_live_... Cada clave pertenece a una sola empresa y puede ser de solo lectura o de lectura y escritura."],
  ["¿Las facturas cumplen VeriFactu?", "Sí. Las facturas emitidas por la API siguen el mismo proceso que en la app: huella encadenada, QR y envío a la AEAT con el certificado de la empresa."],
  ["¿Dónde veo lo que hace mi sistema?", "En el panel «API» de tu cuenta verás cada petición, su resultado, los avisos (webhooks) enviados y el estado de la conexión."],
];

const CODE = `curl -X POST https://openfactura.es/api/v1/invoices \\
  -H "Authorization: Bearer of_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "issue_date": "2026-01-15",
    "client": { "name": "Cliente S.L.", "nif": "B12345674" },
    "line_items": [
      { "description": "Consultoría", "quantity": 1,
        "unit_price": 100, "iva_rate": 21 }
    ]
  }'`;

const Btn = ({ to, children, testid, light }) => (
  <Link to={to} data-testid={testid}
    className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${light ? "bg-white text-[#0052FF]" : "text-white"}`}
    style={light ? undefined : { background: ACCENT }}>{children}</Link>
);

const Hero = () => (
  <section className="grid lg:grid-cols-2 gap-12 items-center">
    <div>
      <span className="text-xs font-semibold uppercase tracking-widest text-[#0052FF]">API REST · v1</span>
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mt-4" data-testid="api-page-title">Conecta tu plataforma con OpenFactura</h1>
      <p className="text-slate-500 mt-5 text-base sm:text-lg leading-relaxed">Emite facturas, envíalas a VeriFactu, descarga los PDF y registra gastos directamente desde tu ERP, tienda online o CRM. Una API pensada para desarrolladores, con avisos automáticos y registro de cada petición.</p>
      <div className="flex flex-wrap gap-3 mt-8">
        <Btn to="/registro" testid="api-page-register">Empieza gratis <ArrowRight className="w-4 h-4" /></Btn>
        <a href="/api/v1/docs" target="_blank" rel="noreferrer" data-testid="api-page-docs" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold border border-slate-200 hover:border-[#0052FF] hover:text-[#0052FF] transition-colors">Ver documentación</a>
      </div>
    </div>
    <pre className="bg-slate-950 text-slate-100 rounded-2xl p-6 text-xs sm:text-sm overflow-x-auto shadow-2xl leading-relaxed" data-testid="api-page-code"><code>{CODE}</code></pre>
  </section>
);

const Resources = () => (
  <section className="mt-24">
    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Todo lo principal, en una sola API</h2>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
      {RESOURCES.map(([Icon, t, d, ep]) => (
        <div key={t} className="rounded-2xl border border-slate-200 p-6 hover:border-[#0052FF]/40 hover:shadow-lg transition-shadow" data-testid={`api-resource-${t.toLowerCase()}`}>
          <Icon className="w-6 h-6 text-[#0052FF]" />
          <div className="font-semibold mt-4">{t}</div>
          <p className="text-sm text-slate-500 mt-1">{d}</p>
          <code className="block text-[11px] text-slate-600 bg-slate-50 rounded-md px-2 py-1.5 mt-4 font-mono">{ep}</code>
        </div>
      ))}
    </div>
  </section>
);

const Pillars = () => (
  <section className="mt-24 grid md:grid-cols-3 gap-6">
    {[[KeyRound, "Una clave por empresa", "Cada clave solo ve los datos de su empresa. Ideal para asesorías y grupos con varias sociedades."],
      [Webhook, "Avisos automáticos", "Recibe un aviso firmado (HMAC-SHA256) cuando se crea una factura o Hacienda la acepta."],
      [Activity, "Todo queda registrado", "Desde tu panel ves cada petición, su resultado y los avisos enviados."]].map(([Icon, t, d]) => (
      <div key={t} className="rounded-2xl bg-slate-50 p-7">
        <Icon className="w-6 h-6 text-[#0052FF]" />
        <div className="font-semibold mt-4">{t}</div>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{d}</p>
      </div>
    ))}
    <div className="md:col-span-3 flex flex-wrap gap-2" data-testid="api-page-events">
      {EVENTS.map((e) => <span key={e} className="font-mono text-xs bg-[#0052FF]/10 text-[#0052FF] rounded-full px-3 py-1">{e}</span>)}
    </div>
  </section>
);

const Plans = () => (
  <section className="mt-24">
    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Incluida en Platino y Multiempresas</h2>
    <div className="grid md:grid-cols-2 gap-6 mt-8 max-w-4xl">
      {PLANS.map((p) => (
        <div key={p.name} data-testid={`api-plan-${p.name.toLowerCase()}`} className={`rounded-2xl border p-7 ${p.highlight ? "border-[#0052FF] ring-1 ring-[#0052FF]/20 shadow-xl" : "border-slate-200"}`}>
          <div className="font-semibold text-lg">{p.name}</div>
          <div className="mt-2"><span className="text-3xl font-extrabold">{p.price}</span><span className="text-slate-400 text-sm">/mes</span></div>
          <ul className="mt-5 space-y-2.5">
            {p.items.map((i) => <li key={i} className="flex gap-2 text-sm text-slate-600"><Check className="w-4 h-4 mt-0.5 text-[#0052FF] shrink-0" strokeWidth={2.5} />{i}</li>)}
          </ul>
        </div>
      ))}
    </div>
    <Link to="/precios" className="inline-flex items-center gap-1.5 text-sm text-[#0052FF] mt-6" data-testid="api-page-pricing">Ver todos los planes <ArrowRight className="w-4 h-4" /></Link>
  </section>
);

const Faq = () => (
  <section className="mt-24 max-w-3xl">
    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>
    <div className="mt-8 space-y-4">
      {FAQ.map(([q, a]) => (
        <div key={q} className="rounded-xl border border-slate-200 p-5">
          <div className="font-semibold">{q}</div>
          <p className="text-slate-500 mt-1.5 text-sm leading-relaxed">{a}</p>
        </div>
      ))}
    </div>
  </section>
);

export default function ApiPublic() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-outfit">
      <Seo path="/para-desarrolladores" title="API REST de facturación para desarrolladores"
        description="API REST de OpenFactura: emite facturas, envíalas a VeriFactu, descarga PDF y registra gastos desde tu sistema. Webhooks firmados y una clave por empresa. Incluida en Platino y Multiempresas." />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
        })}</script>
      </Helmet>
      <header className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" data-testid="api-page-logo"><img src="/openfactura-logo.png" alt="OpenFactura" className="h-7 w-auto" /></Link>
          <Btn to="/registro" testid="api-page-header-register">Empieza gratis</Btn>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#0052FF] mb-10" data-testid="api-page-back"><ArrowLeft className="w-4 h-4" /> Volver al inicio</Link>
        <Hero />
        <Resources />
        <Pillars />
        <Plans />
        <Faq />
        <div className="rounded-3xl text-white px-6 sm:px-12 py-14 mt-24" style={{ background: ACCENT }}>
          <h2 className="text-3xl font-extrabold tracking-tight">Integra OpenFactura hoy</h2>
          <p className="text-white/80 mt-3 max-w-xl">Prueba gratis 14 días. Crea tu clave en el panel «API» y emite tu primera factura en minutos.</p>
          <div className="mt-7"><Btn to="/registro" testid="api-page-cta" light>Crear cuenta <ArrowRight className="w-4 h-4" /></Btn></div>
        </div>
      </main>
      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap gap-6 justify-center text-sm text-slate-500">
          <Link to="/" className="hover:text-slate-900">Inicio</Link>
          <Link to="/precios" className="hover:text-slate-900">Precios</Link>
          <Link to="/blog" className="hover:text-slate-900">Blog</Link>
          <Link to="/terminos" className="hover:text-slate-900">Términos</Link>
          <Link to="/privacidad" className="hover:text-slate-900">Privacidad</Link>
        </div>
      </footer>
    </div>
  );
}
