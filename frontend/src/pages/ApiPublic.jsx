import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Building2, Users, FileText, Receipt, FileDown, ShieldCheck, Webhook, KeyRound, Activity, Check } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Terminal } from "@/components/apipage/Terminal";
import { WebhookFlow } from "@/components/apipage/WebhookFlow";
import { usePublicPlans, fmtPrice } from "@/lib/publicPlans";

const RESOURCES = [
  [Building2, "Empresas", "Consulta la empresa vinculada a cada clave.", "GET", "/api/v1/me"],
  [Users, "Clientes", "Crea y lista clientes, también extranjeros con su VAT.", "POST", "/api/v1/clients"],
  [FileText, "Facturas", "Emite facturas con varios tipos de IVA, IRPF y numeración automática.", "POST", "/api/v1/invoices"],
  [FileDown, "PDF", "Descarga el PDF de cualquier factura con tu logo.", "GET", "/api/v1/invoices/{id}/pdf"],
  [ShieldCheck, "VeriFactu", "Envía la factura a la AEAT y consulta su estado y CSV.", "POST", "/api/v1/invoices/{id}/verifactu"],
  [Receipt, "Gastos", "Registra gastos y tickets desde tu sistema.", "POST", "/api/v1/expenses"],
];

const PILLARS = [
  [KeyRound, "Una clave por empresa", "Cada clave solo ve los datos de su empresa. Ideal para asesorías y grupos con varias sociedades."],
  [Webhook, "Avisos automáticos", "Recibe un aviso firmado (HMAC-SHA256) cuando se crea una factura o Hacienda la acepta."],
  [Activity, "Todo queda registrado", "Desde tu panel ves cada petición, su resultado y los avisos enviados."],
];

const FAQ = [
  ["¿Qué planes incluyen la API?", "Platino y Multiempresas. Las gestorías también pueden crear claves para las empresas de sus clientes."],
  ["¿Cómo me autentico?", "Con una clave de API en la cabecera Authorization: Bearer of_live_... Cada clave pertenece a una sola empresa y puede ser de solo lectura o de lectura y escritura."],
  ["¿Las facturas cumplen VeriFactu?", "Sí. Las facturas emitidas por la API siguen el mismo proceso que en la app: huella encadenada, QR y envío a la AEAT con el certificado de la empresa."],
  ["¿Dónde veo lo que hace mi sistema?", "En el panel «API» de tu cuenta verás cada petición, su resultado, los avisos (webhooks) enviados y el estado de la conexión."],
];

const up = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const InView = ({ children, className }) => (
  <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className={className}>{children}</motion.div>
);
const Kicker = ({ children }) => <motion.span variants={up} className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7EA6FF]">{children}</motion.span>;
const H2 = ({ children }) => <motion.h2 variants={up} className="text-3xl sm:text-4xl font-bold tracking-tight mt-3">{children}</motion.h2>;

const Pill = ({ to, children, testid, ghost }) => (
  <Link to={to} data-testid={testid}
    className={`group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 ${ghost ? "bg-white text-[#0052FF] hover:shadow-xl" : "bg-[#0052FF] text-white hover:bg-[#0046DB] shadow-[0_10px_40px_-10px_rgba(0,82,255,0.8)]"}`}>{children}</Link>
);

const Hero = () => (
  <section className="relative grid lg:grid-cols-2 gap-14 items-center">
    <InView className="min-w-0">
      <motion.span variants={up} className="inline-flex items-center gap-2 rounded-full border border-[#0052FF]/40 bg-[#0052FF]/10 px-3 py-1 text-xs font-medium text-[#A9C2FF]">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> API REST · v1 · VeriFactu AEAT
      </motion.span>
      <motion.h1 variants={up} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mt-6 leading-[1.05]" data-testid="api-page-title">
        Conecta tu plataforma con <span className="bg-gradient-to-r from-[#7EA6FF] via-[#3D7BFF] to-[#00D4FF] bg-clip-text text-transparent">OpenFactura</span>
      </motion.h1>
      <motion.p variants={up} className="text-slate-400 mt-6 text-base sm:text-lg leading-relaxed max-w-xl">Emite facturas, envíalas a VeriFactu, descarga los PDF y registra gastos directamente desde tu ERP, tienda online o CRM. Una API pensada para desarrolladores, con avisos automáticos y registro de cada petición.</motion.p>
      <motion.div variants={up} className="flex flex-wrap gap-3 mt-9">
        <Pill to="/registro" testid="api-page-register">Empieza gratis <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></Pill>
        <a href="/api/v1/docs" target="_blank" rel="noreferrer" data-testid="api-page-docs" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold border border-white/15 text-white hover:border-white/40 hover:bg-white/5 transition-colors">Ver documentación</a>
      </motion.div>
    </InView>
    <div className="min-w-0" style={{ perspective: 1200 }}><Terminal /></div>
  </section>
);

const Resources = () => (
  <InView className="mt-32">
    <Kicker>Endpoints</Kicker>
    <H2>Todo lo principal, en una sola API</H2>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
      {RESOURCES.map(([Icon, t, d, m, ep]) => (
        <motion.div key={t} variants={up} whileHover={{ y: -6 }} data-testid={`api-resource-${t.toLowerCase()}`}
          className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 overflow-hidden hover:border-[#0052FF]/60 transition-colors">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-[#0052FF]/0 group-hover:bg-[#0052FF]/25 blur-3xl transition-colors duration-500" />
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-[#0052FF]/15 flex items-center justify-center"><Icon className="w-5 h-5 text-[#7EA6FF]" /></div>
            <div className="font-semibold mt-5">{t}</div>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{d}</p>
            <div className="flex items-center gap-2 mt-5 font-mono text-[11px]">
              <span className={`rounded px-1.5 py-0.5 font-semibold ${m === "GET" ? "bg-emerald-400/15 text-emerald-300" : "bg-[#0052FF]/25 text-[#A9C2FF]"}`}>{m}</span>
              <span className="text-slate-300 truncate">{ep}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  </InView>
);

const Pillars = () => (
  <InView className="mt-32 grid lg:grid-cols-5 gap-10 items-center">
    <div className="lg:col-span-2">
      <Kicker>Webhooks</Kicker>
      <H2>Tu sistema se entera al instante</H2>
      <div className="mt-8 space-y-6">
        {PILLARS.map(([Icon, t, d]) => (
          <motion.div key={t} variants={up} className="flex gap-4">
            <Icon className="w-5 h-5 text-[#7EA6FF] shrink-0 mt-1" />
            <div><div className="font-semibold">{t}</div><p className="text-sm text-slate-400 mt-1 leading-relaxed">{d}</p></div>
          </motion.div>
        ))}
      </div>
    </div>
    <motion.div variants={up} className="lg:col-span-3 min-w-0"><WebhookFlow /></motion.div>
  </InView>
);

const PlanCard = ({ id, name, price, items, highlight }) => (
  <motion.div variants={up} whileHover={{ y: -6 }} data-testid={`api-plan-${id}`}
    className={`relative rounded-3xl p-8 border ${highlight ? "border-[#0052FF] bg-gradient-to-b from-[#0052FF]/20 to-transparent shadow-[0_0_60px_-15px_rgba(0,82,255,0.7)]" : "border-white/10 bg-white/[0.03]"}`}>
    {highlight && <span className="absolute -top-3 left-8 rounded-full bg-[#0052FF] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">Para asesorías</span>}
    <div className="font-semibold text-lg">{name}</div>
    <div className="mt-3"><span className="text-4xl font-extrabold tracking-tight">{price}</span><span className="text-slate-400 text-sm">/mes</span></div>
    <ul className="mt-6 space-y-3">
      {items.map((i) => <li key={i} className="flex gap-2.5 text-sm text-slate-300"><Check className="w-4 h-4 mt-0.5 text-[#7EA6FF] shrink-0" strokeWidth={2.5} />{i}</li>)}
    </ul>
  </motion.div>
);

const Plans = () => {
  const lp = usePublicPlans();
  const pl = lp.platino, me = lp.multiempresas;
  return (
    <InView className="mt-32">
      <Kicker>Planes</Kicker>
      <H2>Incluida en Platino y Multiempresas</H2>
      <div className="grid md:grid-cols-2 gap-6 mt-10 max-w-4xl">
        <PlanCard id="platino" name={pl?.name || "Platino"} price={pl ? fmtPrice(pl.price) : "24,99€"}
          items={["API REST completa", "1 empresa con su clave", "60 peticiones por minuto", "Webhooks firmados y registro de actividad"]} />
        <PlanCard id="multiempresas" highlight name={me?.name || "Multiempresas"} price={me ? fmtPrice(me.price) : "49,99€"}
          items={["API REST completa", `Una clave por cada empresa (hasta ${me?.max_companies ?? 20})`, "120 peticiones por minuto por clave", "Webhooks y registro por empresa"]} />
      </div>
      <Link to="/precios" className="inline-flex items-center gap-1.5 text-sm text-[#7EA6FF] hover:text-white mt-8 transition-colors" data-testid="api-page-pricing">Ver todos los planes <ArrowRight className="w-4 h-4" /></Link>
    </InView>
  );
};

const Faq = () => (
  <InView className="mt-32 max-w-3xl">
    <Kicker>FAQ</Kicker>
    <H2>Preguntas frecuentes</H2>
    <motion.div variants={up}>
      <Accordion type="single" collapsible className="mt-8">
        {FAQ.map(([q, a], i) => (
          <AccordionItem key={q} value={`f${i}`} className="border-white/10">
            <AccordionTrigger className="text-left hover:no-underline hover:text-[#7EA6FF]" data-testid={`api-faq-${i}`}>{q}</AccordionTrigger>
            <AccordionContent className="text-slate-400 leading-relaxed">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </motion.div>
  </InView>
);

const Backdrop = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse at top, black 30%, transparent 70%)" }} />
    <motion.div animate={{ x: [0, 60, 0], y: [0, 40, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-[#0052FF]/30 blur-[120px]" />
    <motion.div animate={{ x: [0, -50, 0], y: [0, 60, 0] }} transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }} className="absolute top-60 -right-40 w-[500px] h-[500px] rounded-full bg-[#00D4FF]/15 blur-[120px]" />
  </div>
);

export default function ApiPublic() {
  return (
    <div className="min-h-screen bg-[#060A14] text-white font-outfit selection:bg-[#0052FF]/40 overflow-x-hidden">
      <Seo path="/para-desarrolladores" title="API REST de facturación para desarrolladores"
        description="API REST de OpenFactura: emite facturas, envíalas a VeriFactu, descarga PDF y registra gastos desde tu sistema. Webhooks firmados y una clave por empresa. Incluida en Platino y Multiempresas." />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
        })}</script>
      </Helmet>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060A14]/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" data-testid="api-page-logo"><img src="/openfactura-logo.png" alt="OpenFactura" className="h-7 w-auto brightness-0 invert" /></Link>
          <div className="flex items-center gap-4">
            <a href="/api/v1/docs" target="_blank" rel="noreferrer" className="hidden sm:inline text-sm text-slate-300 hover:text-white transition-colors" data-testid="api-page-header-docs">Documentación</a>
            <Pill to="/registro" testid="api-page-header-register">Empieza gratis</Pill>
          </div>
        </div>
      </header>
      <div className="relative">
        <Backdrop />
        <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-12 transition-colors" data-testid="api-page-back"><ArrowLeft className="w-4 h-4" /> Volver al inicio</Link>
          <Hero />
          <Resources />
          <Pillars />
          <Plans />
          <Faq />
          <InView className="relative rounded-3xl overflow-hidden px-6 sm:px-14 py-16 mt-32 bg-[#0052FF]">
            <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white/20 blur-3xl" />
            <motion.h2 variants={up} className="relative text-3xl sm:text-4xl font-extrabold tracking-tight">Integra OpenFactura hoy</motion.h2>
            <motion.p variants={up} className="relative text-white/80 mt-3 max-w-xl">Prueba gratis 14 días. Crea tu clave en el panel «API» y emite tu primera factura en minutos.</motion.p>
            <motion.div variants={up} className="relative mt-8"><Pill to="/registro" testid="api-page-cta" ghost>Crear cuenta <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></Pill></motion.div>
          </InView>
        </main>
      </div>
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap gap-6 justify-center text-sm text-slate-500">
          <Link to="/" className="hover:text-white">Inicio</Link>
          <Link to="/precios" className="hover:text-white">Precios</Link>
          <Link to="/blog" className="hover:text-white">Blog</Link>
          <Link to="/terminos" className="hover:text-white">Términos</Link>
          <Link to="/privacidad" className="hover:text-white">Privacidad</Link>
        </div>
      </footer>
    </div>
  );
}
