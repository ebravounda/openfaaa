import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import {
  Sparkles, FileText, Landmark, ShieldCheck, ScanLine, Bot, Check, ArrowRight,
  Menu, TrendingUp, Zap, ReceiptText, Building2, Users, Briefcase, Star, MapPin,
} from "lucide-react";

const ACCENT = "#0052FF";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

function Reveal({ children, className, delay = 0, immediate = false }) {
  const anim = immediate
    ? { initial: "hidden", animate: "show" }
    : { initial: "hidden", whileInView: "show", viewport: { once: true, margin: "-80px" } };
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      {...anim}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

function BrowserFrame({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-[0_30px_60px_-15px_rgba(2,6,23,0.25)] overflow-hidden ${className}`}>
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex gap-1.5 items-center">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-amber-400" />
        <span className="w-3 h-3 rounded-full bg-emerald-400" />
        <span className="ml-3 text-[11px] text-slate-400 font-mono">openfactura.es</span>
      </div>
      {children}
    </div>
  );
}

/* ---------- Product mockups ---------- */
function DashboardMockup() {
  const bars = [40, 62, 48, 78, 56, 90, 70];
  return (
    <BrowserFrame>
      <div className="p-5 sm:p-6 bg-white">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs text-slate-400">Panel general</div>
            <div className="font-outfit text-lg font-semibold text-slate-900">Tu negocio</div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> En directo
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[["Ingresos", "18.420€", "+12%"], ["Facturas", "142", "+24"], ["Cobrado", "80%", "+8%"]].map(([l, v, d]) => (
            <div key={l} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <div className="text-[11px] text-slate-400">{l}</div>
              <div className="font-outfit text-base sm:text-lg font-semibold text-slate-900 tabular-nums">{v}</div>
              <div className="text-[11px] font-medium text-emerald-600">{d}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-slate-500">Ingresos · últimos 7 días</div>
            <div className="font-outfit text-sm font-semibold text-slate-900">18.420€</div>
          </div>
          <div className="flex items-end gap-2 h-24">
            {bars.map((h, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-t-md"
                style={{ background: i === 5 ? ACCENT : "#DBEAFE" }}
                initial={{ height: 0 }}
                whileInView={{ height: `${h}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: "easeOut" }}
              />
            ))}
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function InvoiceMockup() {
  return (
    <BrowserFrame>
      <div className="p-5 sm:p-6 bg-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="w-9 h-9 rounded-lg mb-2 flex items-center justify-center text-white" style={{ background: ACCENT }}>
              <Sparkles className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div className="font-outfit font-semibold text-slate-900">Factura F26012</div>
            <div className="text-[11px] text-slate-400">Emitida · 22/01/2026</div>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            <ShieldCheck className="w-3 h-3" strokeWidth={2} /> VeriFactu
          </span>
        </div>
        <div className="space-y-2">
          {[["Diseño web", "1.100€"], ["Branding", "546€"]].map(([c, p]) => (
            <div key={c} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2">
              <span className="text-slate-600">{c}</span>
              <span className="tabular-nums text-slate-900">{p}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tabular-nums">1.646,00€</span></div>
          <div className="flex justify-between text-slate-500"><span>IVA (21%)</span><span className="tabular-nums">345,66€</span></div>
          <div className="flex justify-between font-outfit font-semibold text-slate-900 text-base pt-1"><span>Total</span><span className="tabular-nums">1.991,66€</span></div>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: "80%", background: ACCENT }} />
        </div>
        <div className="text-[11px] text-slate-400 mt-1.5">1.593,33€ cobrado · 398,33€ pendiente</div>
      </div>
    </BrowserFrame>
  );
}

function TaxMockup() {
  return (
    <BrowserFrame>
      <div className="p-5 sm:p-6 bg-white">
        <div className="text-xs text-slate-400">Impuestos · T1 2026</div>
        <div className="font-outfit text-lg font-semibold text-slate-900 mb-4">Modelo 303</div>
        <div className="rounded-xl p-4 text-white mb-4" style={{ background: ACCENT }}>
          <div className="text-xs opacity-80">IVA a pagar este trimestre</div>
          <div className="font-outfit text-3xl font-bold tabular-nums">1.284,50€</div>
          <div className="text-xs opacity-80 mt-1">Vencimiento: 20 abr 2026</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[["IVA repercutido", "3.120€"], ["IVA soportado", "1.835€"], ["Rend. neto (130)", "9.450€"], ["IRPF 7%", "661€"]].map(([l, v]) => (
            <div key={l} className="rounded-lg border border-slate-100 p-3">
              <div className="text-[11px] text-slate-400">{l}</div>
              <div className="font-outfit text-sm font-semibold text-slate-900 tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

function ScanMockup() {
  return (
    <BrowserFrame>
      <div className="p-5 sm:p-6 bg-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white"><ScanLine className="w-5 h-5" strokeWidth={1.5} /></div>
          <div>
            <div className="font-outfit font-semibold text-slate-900">Ticket escaneado</div>
            <div className="text-[11px] text-emerald-600 font-medium">Leído con IA · 96% precisión</div>
          </div>
        </div>
        <div className="space-y-2.5">
          {[["Proveedor", "Suministros Delta S.L."], ["Base imponible", "82,64€"], ["IVA (21%)", "17,36€"], ["Categoría", "Material de oficina"]].map(([l, v], i) => (
            <motion.div
              key={l}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5"
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <span className="text-xs text-slate-400">{l}</span>
              <span className="text-sm font-medium text-slate-900">{v}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

function ChatMockup() {
  return (
    <BrowserFrame>
      <div className="p-5 sm:p-6 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: ACCENT }}><Bot className="w-4 h-4" strokeWidth={1.5} /></div>
          <div className="font-outfit font-semibold text-slate-900 text-sm">FiscalBot</div>
        </div>
        <div className="space-y-3">
          <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-slate-100 px-3.5 py-2.5 text-sm text-slate-700">¿Qué IRPF aplico si soy nuevo autónomo?</div>
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-white" style={{ background: ACCENT }}>
            Puedes aplicar el <strong>7% reducido</strong> durante tu año de alta y los dos siguientes. Después pasarás al 15% general.
          </div>
          <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500 flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

const MODULES = [
  { icon: FileText, label: "Facturación", title: "Facturas en segundos", subtitle: "Crea, envía y cobra facturas profesionales al instante.", bullets: ["Series, rectificativas y PDF automático", "15+ plantillas adaptadas por sector"], visual: InvoiceMockup },
  { icon: Landmark, label: "Impuestos", title: "IVA e IRPF automáticos", subtitle: "Tus impuestos se calculan solos mientras facturas.", bullets: ["Modelos 303, 130 y resumen anual 390 listos", "Aplica el 7% de IRPF reducido si eres nuevo autónomo"], visual: TaxMockup },
  { icon: ShieldCheck, label: "Cumplimiento", title: "Software compatible VeriFactu", subtitle: "Cumple con la normativa de la AEAT sin esfuerzo.", bullets: ["Registro y anulación con huella encadenada + QR", "Firma con tu certificado digital .pfx"], visual: DashboardMockup },
  { icon: ScanLine, label: "Gastos", title: "Escaneo de gastos con IA", subtitle: "Haz una foto a tus tickets y olvídate de picar datos.", bullets: ["Extracción automática de proveedor, base e IVA", "Almacenamiento digital seguro de tus recibos"], visual: ScanMockup },
  { icon: Bot, label: "Inteligencia", title: "Asistente con IA (FiscalBot)", subtitle: "Tu experto fiscal disponible 24/7.", bullets: ["Resuelve dudas de facturación e impuestos al instante", "Revisa tus facturas antes de emitirlas"], visual: ChatMockup },
];

const REASONS = [
  { n: "01", t: "Setup rápido", d: "Emite tu primera factura en menos de 5 minutos, sin curva de aprendizaje." },
  { n: "02", t: "Cumplimiento VeriFactu", d: "Adaptado a la nueva ley antifraude de la AEAT: huella, QR y certificado." },
  { n: "03", t: "Escáner OCR con IA", d: "Sube un ticket y la IA extrae proveedor, base e IVA por ti." },
  { n: "04", t: "Dashboard fiscal", d: "Controla cuánto IVA e IRPF tienes que pagar cada trimestre." },
  { n: "05", t: "Asistente IA", d: "No vuelvas a quedarte con una duda fiscal sin resolver." },
  { n: "06", t: "Diseñado para España", d: "Tipos de IVA e IRPF siempre actualizados a la normativa española." },
];

const AUDIENCES = [
  { icon: Briefcase, t: "Autónomos", d: "Facturación, gastos e impuestos en un solo lugar. Olvídate del Excel." },
  { icon: Building2, t: "Startups y pymes", d: "Facturación avanzada, control de caja y planes que crecen contigo." },
  { icon: Users, t: "Asesorías", d: "Exporta libros fiscales y colabora con tus clientes en tiempo real." },
];

const STATS = [
  { v: "15 h", l: "ahorradas al mes en gestión" },
  { v: "100%", l: "compatible con VeriFactu AEAT" },
  { v: "0", l: "errores en tus modelos de IVA" },
];

const TESTIMONIALS = [
  { q: "Emito mis facturas y controlo el IVA en minutos. Mi gestoría accede a todo sin llamarme.", n: "Alejandro G.", r: "Diseñador autónomo" },
  { q: "El escáner de tickets me ahorra horas cada mes. Hago la foto y ya está contabilizado.", n: "Lucía M.", r: "Fotógrafa" },
  { q: "Lo del 7% de IRPF me lo sugirió solo. Es como tener un asesor dentro de la app.", n: "Fincas Vega", r: "Administración" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-outfit selection:bg-[#0052FF]/20">
      <Seo
        path="/"
        title="Programa de facturación para autónomos y pymes en España"
        description="Crea facturas, calcula tu IVA e IRPF (modelos 303 y 130), escanea gastos con IA y cumple con VeriFactu de la AEAT. Prueba gratis 14 días, sin tarjeta. Disponible en Madrid, Barcelona, Valencia, Sevilla, Málaga, Granada, Fuengirola y toda España."
      />
      {/* Promo bar */}
      <div className="bg-slate-900 text-slate-100 text-center text-xs sm:text-sm py-2 px-4" data-testid="promo-bar">
        Prueba gratis 14 días · Planes con opción anual y <span className="text-white font-semibold">2 meses gratis</span>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/openfactura-logo.png" alt="OpenFactura by GoRoky" width="131" height="28" className="h-7 w-auto" fetchpriority="high" />
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#facturacion" className="hover:text-slate-900 transition-colors">Facturación</a>
            <a href="#impuestos" className="hover:text-slate-900 transition-colors">Impuestos</a>
            <a href="#funcionalidades" className="hover:text-slate-900 transition-colors">Funcionalidades</a>
            <Link to="/registro" className="hover:text-slate-900 transition-colors">Precios</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login"><Button variant="ghost" className="text-slate-600 rounded-full" data-testid="landing-login">Entrar</Button></Link>
            <Link to="/registro"><Button className="text-white rounded-full px-5" style={{ background: ACCENT }} data-testid="landing-register">Empieza gratis</Button></Link>
            <Menu className="w-5 h-5 text-slate-600 md:hidden" />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#F8FAFC] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <Reveal immediate>
              <span className="inline-flex items-center gap-2 bg-[#0052FF]/10 text-[#0052FF] rounded-full px-4 py-1.5 text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" strokeWidth={1.5} /> El software fiscal todo en uno para España
              </span>
            </Reveal>
            <Reveal immediate delay={0.05}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
                Facturación, impuestos <span style={{ color: ACCENT }}>y mucho más.</span>
              </h1>
            </Reveal>
            <Reveal immediate delay={0.1}>
              <p className="text-base sm:text-lg text-slate-500 mt-6 max-w-xl leading-relaxed">
                OpenFactura es la solución en la nube con todo lo que necesitas para gestionar tu negocio. Facturas, IVA, IRPF, VeriFactu y una IA que te ayuda, en una sola plataforma.
              </p>
            </Reveal>
            <Reveal immediate delay={0.15}>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <Link to="/registro"><Button size="lg" className="text-white rounded-full px-8 w-full sm:w-auto shadow-md hover:shadow-lg" style={{ background: ACCENT }} data-testid="hero-cta">Prueba gratis 14 días <ArrowRight className="w-4 h-4 ml-2" strokeWidth={2} /></Button></Link>
                <Link to="/login"><Button size="lg" variant="outline" className="border-slate-200 rounded-full px-8 w-full sm:w-auto">Ya tengo cuenta</Button></Link>
              </div>
            </Reveal>
            <Reveal immediate delay={0.2}>
              <p className="text-sm text-slate-400 mt-5 flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" strokeWidth={2} /> Sin tarjeta de crédito · Cancela cuando quieras</p>
            </Reveal>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 40, rotate: -1 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute -inset-6 bg-[#0052FF]/10 blur-3xl rounded-full -z-10" />
            <DashboardMockup />
            <motion.div
              className="hidden sm:block absolute -bottom-8 -left-6 w-56"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><ShieldCheck className="w-4 h-4" strokeWidth={1.5} /></div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">VeriFactu</div>
                    <div className="text-[11px] text-emerald-600">Registro enviado ✓</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <Reveal><p className="text-center text-sm font-medium text-slate-400 mb-10">La herramienta fiscal diseñada para autónomos y pymes en España</p></Reveal>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STATS.map((s) => (
              <motion.div key={s.l} variants={fadeUp} className="text-center">
                <div className="text-4xl sm:text-5xl font-extrabold tracking-tight" style={{ color: ACCENT }}>{s.v}</div>
                <div className="text-sm text-slate-500 mt-2">{s.l}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Feature modules (zig-zag) */}
      <section id="funcionalidades" className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 space-y-24 sm:space-y-32">
          {MODULES.map((m, i) => {
            const Visual = m.visual;
            const flip = i % 2 === 1;
            return (
              <div key={m.title} id={i === 0 ? "facturacion" : i === 1 ? "impuestos" : undefined} className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                <Reveal className={flip ? "lg:order-2" : ""}>
                  <div className="inline-flex items-center gap-2 text-sm font-semibold mb-4" style={{ color: ACCENT }}>
                    <m.icon className="w-4 h-4" strokeWidth={2} /> {m.label}
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{m.title}</h2>
                  <p className="text-base sm:text-lg text-slate-500 mt-4">{m.subtitle}</p>
                  <ul className="mt-6 space-y-3">
                    {m.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3 text-slate-700">
                        <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5"><Check className="w-3 h-3" strokeWidth={3} /></span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <Link to="/registro"><Button variant="outline" className="mt-8 rounded-full border-slate-200" data-testid={`explore-${i}`}>Explorar <ArrowRight className="w-4 h-4 ml-2" strokeWidth={2} /></Button></Link>
                </Reveal>
                <Reveal delay={0.1} className={flip ? "lg:order-1" : ""}>
                  <div className="relative">
                    <div className="absolute -inset-4 bg-slate-100 rounded-3xl -z-10" />
                    <Visual />
                  </div>
                </Reveal>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why - dark bento */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <Reveal>
            <span className="text-sm font-semibold" style={{ color: "#7DA2FF" }}>Por qué OpenFactura</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mt-3 max-w-2xl">Construido para hacerte la vida más fácil</h2>
            <p className="text-slate-400 mt-4 max-w-xl">Seis razones por las que los autónomos y pymes españolas nos eligen cada día.</p>
          </Reveal>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
            {REASONS.map((r) => (
              <motion.div key={r.n} variants={fadeUp} className="rounded-2xl border border-slate-800 bg-slate-800/40 p-6 hover:border-slate-700 hover:bg-slate-800/70 transition-colors duration-300">
                <div className="text-2xl font-extrabold mb-3" style={{ color: "#7DA2FF" }}>{r.n}</div>
                <div className="font-semibold text-lg mb-1.5">{r.t}</div>
                <div className="text-sm text-slate-400 leading-relaxed">{r.d}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <Reveal><h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">Lo que dicen quienes ya facturan con nosotros</h2></Reveal>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {TESTIMONIALS.map((t) => (
              <motion.div key={t.n} variants={fadeUp} className="rounded-2xl border border-slate-200 p-6 bg-[#F8FAFC]">
                <div className="flex gap-0.5 mb-4">{[0, 1, 2, 3, 4].map((s) => <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />)}</div>
                <p className="text-slate-700 leading-relaxed">"{t.q}"</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center font-semibold text-sm">{t.n[0]}</div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t.n}</div>
                    <div className="text-xs text-slate-400">{t.r}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Audiences */}
      <section className="bg-[#F8FAFC] border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <Reveal><h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">Diseñado para cada etapa de tu negocio</h2></Reveal>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {AUDIENCES.map((a) => (
              <motion.div key={a.t} variants={fadeUp} className="rounded-2xl bg-white border border-slate-200 p-8 hover:shadow-xl transition-shadow duration-300">
                <div className="w-12 h-12 rounded-xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center mb-5"><a.icon className="w-6 h-6" strokeWidth={1.5} /></div>
                <div className="font-semibold text-xl text-slate-900">{a.t}</div>
                <div className="text-slate-500 mt-2 leading-relaxed">{a.d}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Integrations */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <Reveal><h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Se conecta con tus herramientas favoritas</h2></Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              {["Stripe", "VeriFactu AEAT", "VIES", "Resend", "PayPal", "Google"].map((n) => (
                <span key={n} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
                  <Zap className="w-3.5 h-3.5" style={{ color: ACCENT }} strokeWidth={2} /> {n}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Cobertura nacional (SEO local) */}
      <section className="bg-[#F8FAFC] border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: ACCENT }}>
              <MapPin className="w-4 h-4" strokeWidth={2} /> Cobertura nacional
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-3 max-w-3xl mx-auto">
              El programa de facturación para autónomos y pymes en toda España
            </h2>
            <p className="text-slate-500 mt-4 max-w-2xl mx-auto leading-relaxed">
              OpenFactura funciona 100% en la nube, así que puedes facturar, controlar tu IVA e IRPF y cumplir con VeriFactu desde cualquier ciudad. Miles de autónomos y empresas ya lo usan en:
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-8 max-w-4xl mx-auto">
              {[
                "Madrid", "Barcelona", "Valencia", "Sevilla", "Málaga", "Granada", "Fuengirola",
                "Bilbao", "Zaragoza", "Murcia", "Alicante", "Palma de Mallorca", "Las Palmas",
                "Vigo", "Marbella", "Córdoba", "Valladolid", "Gijón", "A Coruña", "Santander",
              ].map((city) => (
                <span key={city} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} /> Facturación en {city}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-6xl mx-auto rounded-3xl text-white text-center px-6 py-16 sm:py-20" style={{ background: ACCENT }}>
          <Reveal>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">Prueba OpenFactura gratis durante 14 días</h2>
            <p className="text-white/80 mt-4 text-lg">Sin tarjeta de crédito. Sin compromiso. Cancela cuando quieras.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Link to="/registro"><Button size="lg" className="bg-white text-[#0052FF] hover:bg-slate-100 rounded-full px-8 w-full sm:w-auto font-semibold" data-testid="cta-bottom">Empezar ahora gratis <ArrowRight className="w-4 h-4 ml-2" strokeWidth={2} /></Button></Link>
              <Link to="/login"><Button size="lg" variant="outline" className="border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-8 w-full sm:w-auto">Ya tengo cuenta</Button></Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <img src="/openfactura-logo.png" alt="OpenFactura by GoRoky" className="h-6 w-auto" />
            <span className="text-slate-400">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <Link to="/terminos" className="hover:text-slate-900 transition-colors" data-testid="footer-terms">Términos y condiciones</Link>
            <Link to="/privacidad" className="hover:text-slate-900 transition-colors" data-testid="footer-privacy">Política de privacidad</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
