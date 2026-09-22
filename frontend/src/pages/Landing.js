import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import {
  Sparkles, FileText, Landmark, ShieldCheck, ScanLine, Bot, Check, ArrowRight,
  Menu, TrendingUp, Zap, ReceiptText, Building2, Users, Briefcase, Star, MapPin,
  CreditCard, Clock, Store, ShoppingBag, MessageCircle, Wallet, Utensils, Mail, HelpCircle,
  MousePointerClick, MousePointer2, Palette,
} from "lucide-react";

const FAQS = [
  {
    q: "¿Qué es OpenFactura?",
    a: "OpenFactura es un sistema de facturación online para autónomos y empresas en España. Te permite crear y enviar facturas legales en segundos, controlar tus gastos, calcular automáticamente el IVA y el IRPF, y llevar al día tus impuestos (modelos 303, 130, 111, 115) desde un único panel.",
  },
  {
    q: "¿Puedo personalizar mis facturas con mi logo?",
    a: "Sí. Puedes subir tu logo, elegir el color de marca, añadir tus datos fiscales, textos legales y el pie de página. Dispones de varias plantillas profesionales para que tus facturas reflejen la imagen de tu negocio.",
  },
  {
    q: "¿Es compatible con VeriFactu y la Agencia Tributaria?",
    a: "Totalmente. OpenFactura está homologado con VeriFactu (AEAT): cada factura se firma y registra conforme a la normativa antifraude, con su código QR y encadenamiento. Cumples con la ley sin complicaciones y con la tranquilidad de estar al día con Hacienda.",
  },
  {
    q: "¿Puedo conectar mi cuenta bancaria?",
    a: "Sí. Podrás conectar tu banco de forma segura para conciliar automáticamente los cobros con tus facturas y ver qué está pagado y qué está pendiente, sin introducir los movimientos a mano.",
  },
  {
    q: "¿Sirve para autónomos y para empresas (SL)?",
    a: "Para ambos. Si eres autónomo, calculamos tu IVA e IRPF (incluido el 7% de nuevos autónomos). Si eres una sociedad (SL), gestionamos el IVA de tus facturas emitidas. Todo se adapta automáticamente a tu tipo de actividad.",
  },
  {
    q: "¿Puedo escanear tickets y facturas de gastos?",
    a: "Sí. Con el escáner inteligente solo tienes que subir una foto o el PDF del ticket y la IA extrae el proveedor, el NIF, la fecha, la base, el IVA y el total automáticamente, listo para guardarlo como gasto.",
  },
  {
    q: "¿Tiene TPV para tienda u hostelería?",
    a: "Sí. Incluye un TPV (punto de venta) con modos Retail y Hostelería: gestión de productos, stock, mesas, caja y tickets de 80/58 mm, todo integrado con tu facturación.",
  },
  {
    q: "¿Cuánto cuesta y hay permanencia?",
    a: "Puedes empezar gratis durante 14 días sin tarjeta de crédito. Después eliges el plan que mejor se adapte a ti. Sin permanencia: puedes cancelar cuando quieras.",
  },
];

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

function PaymentMockup() {
  return (
    <BrowserFrame>
      <div className="p-5 sm:p-6 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="font-outfit font-semibold text-slate-900">Cobro de factura F26012</div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#635BFF] text-white font-bold text-[11px] tracking-tight lowercase">stripe</span>
        </div>
        <div className="rounded-xl border border-slate-100 p-4 mb-4">
          <div className="text-[11px] text-slate-400">Importe a pagar</div>
          <div className="font-outfit text-3xl font-bold tabular-nums text-slate-900">1.991,66€</div>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5">
            <CreditCard className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
            <span className="text-sm text-slate-500 tabular-nums tracking-wider">4242 4242 4242 4242</span>
          </div>
        </div>
        <button className="w-full rounded-lg py-3 text-white font-semibold text-sm" style={{ background: "#635BFF" }}>Pagar 1.991,66€</button>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-emerald-600 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} /> Pago seguro · La factura se marca pagada al instante
        </div>
      </div>
    </BrowserFrame>
  );
}

function PosMockup() {
  const prods = [["Café", "1,40€"], ["Tostada", "2,20€"], ["Zumo", "2,80€"], ["Menú del día", "12,50€"], ["Caña", "1,80€"], ["Ración", "8,00€"]];
  return (
    <BrowserFrame>
      <div className="p-5 sm:p-6 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-md" style={{ background: ACCENT }}><Store className="w-4 h-4" strokeWidth={1.5} /></div>
            <div>
              <div className="font-outfit font-semibold text-slate-900 text-sm">TPV · Hostelería</div>
              <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Mesa 4 · Caja abierta</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">Ticket 80mm</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {prods.map(([n, p], i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-xl border p-2.5 ${i === 3 ? "border-[#0052FF] shadow-[0_6px_18px_rgba(0,82,255,0.12)]" : "border-slate-100 bg-slate-50/60"}`}
            >
              <div className="text-[11px] font-medium text-slate-700 truncate">{n}</div>
              <div className="text-xs font-bold tabular-nums" style={{ color: ACCENT }}>{p}</div>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-slate-900 text-white p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400">Total ticket</div>
            <div className="font-outfit text-xl font-bold tabular-nums">27,90€</div>
          </div>
          <span className="rounded-lg px-4 py-2 text-sm font-semibold shadow-lg" style={{ background: ACCENT }}>Cobrar</span>
        </div>
      </div>
    </BrowserFrame>
  );
}

const MODULES = [
  { id: "facturacion", icon: FileText, label: "Facturación", title: "Facturas en segundos", subtitle: "Crea, envía y cobra facturas profesionales al instante.", bullets: ["Series, rectificativas y PDF automático", "Plantillas personalizables con tu logo por sector"], visual: InvoiceMockup },
  { id: "tpv", icon: Store, label: "TPV / Punto de venta", title: "TPV para hostelería y retail", subtitle: "Vende en tu bar, restaurante o tienda con un punto de venta rápido y profesional.", bullets: ["Modo hostelería (mesas, comandas, propinas y notas) y modo retail (stock, variantes talla/color, códigos de barras)", "Cobro en efectivo, tarjeta o mixto, arqueo de caja y tickets imprimibles en 80 y 58 mm"], visual: PosMockup },
  { id: "cobros", icon: CreditCard, label: "Cobros", title: "Cobra con tarjeta por Stripe", subtitle: "Envía un enlace de pago y cobra tus facturas más rápido.", bullets: ["Botón «Enviar Cobro»: tu cliente paga con tarjeta desde el email", "La factura se marca pagada automáticamente al cobrar", "Próximamente también RedSys (TPV bancario español)"], visual: PaymentMockup },
  { id: "impuestos", icon: Landmark, label: "Impuestos", title: "IVA e IRPF automáticos", subtitle: "Tus impuestos se calculan solos mientras facturas.", bullets: ["Modelos 303, 130 y resumen anual 390 listos", "Aplica el 7% de IRPF reducido si eres nuevo autónomo"], visual: TaxMockup },
  { id: "cumplimiento", icon: ShieldCheck, label: "Cumplimiento", title: "Software compatible VeriFactu", subtitle: "Cumple con la normativa de la AEAT sin esfuerzo.", bullets: ["Registro y anulación con huella encadenada + QR", "Firma con tu certificado digital .pfx"], visual: DashboardMockup },
  { id: "gastos", icon: ScanLine, label: "Gastos", title: "Escaneo de gastos con IA", subtitle: "Haz una foto a tus tickets y olvídate de picar datos.", bullets: ["Extracción automática de proveedor, base e IVA", "Almacenamiento digital seguro de tus recibos"], visual: ScanMockup },
  { id: "inteligencia", icon: Bot, label: "Inteligencia", title: "Asistente con IA (FiscalBot)", subtitle: "Tu experto fiscal disponible 24/7.", bullets: ["Resuelve dudas de facturación e impuestos al instante", "Revisa tus facturas antes de emitirlas"], visual: ChatMockup },
];

const REASONS = [
  { n: "01", t: "Setup rápido", d: "Emite tu primera factura en menos de 5 minutos, sin curva de aprendizaje." },
  { n: "02", t: "Cumplimiento VeriFactu", d: "Adaptado a la nueva ley antifraude de la AEAT: huella, QR y certificado." },
  { n: "03", t: "Cobros con tarjeta", d: "Envía enlaces de pago por Stripe y cobra tus facturas al instante. RedSys llegará pronto." },
  { n: "04", t: "Escáner OCR con IA", d: "Sube un ticket y la IA extrae proveedor, base e IVA por ti." },
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

const NOVEDADES = [
  { icon: FileText, t: "Presupuestos", d: "Crea presupuestos profesionales, envíalos a tus clientes y conviértelos en factura con un solo clic." },
  { icon: Building2, t: "Multiempresa", d: "Gestiona varias empresas y autónomos desde una sola cuenta, cada uno con su contabilidad, numeración y certificado propios." },
  { icon: Landmark, t: "Facturación intracomunitaria", d: "Emite facturas exentas por operaciones intracomunitarias (art. 25) con su leyenda legal y el Modelo 349." },
  { icon: CreditCard, t: "Cobro con tarjeta", d: "Envía un enlace de pago por Stripe y cobra tus facturas al instante, con conciliación automática." },
];

const PROXIMAMENTE = [
  { icon: Landmark, t: "Conciliación bancaria", d: "Conecta tu banco de forma segura y concilia automáticamente las transferencias recibidas con tus facturas pendientes.", banks: true },
  { icon: MessageCircle, t: "Facturas por WhatsApp", d: "Envía facturas, presupuestos y recordatorios de cobro directamente al WhatsApp de tus clientes." },
  { icon: CreditCard, t: "Cobros con RedSys", d: "Cobra con el TPV bancario español RedSys, además de Stripe, tanto en tus facturas como en tu punto de venta." },
];

const BANKS = ["Santander", "CaixaBank", "BBVA", "Sabadell", "Bankinter", "ING"];

const PLANS = [
  { name: "Básico", price: "0€", per: "/mes", desc: "Para empezar a facturar", features: ["Hasta 10 facturas al mes", "Clientes y presupuestos", "Cálculo de IVA e IRPF"], cta: "Empezar gratis", highlight: false },
  { name: "Medio", price: "9,99€", per: "/mes", desc: "Para autónomos en activo", features: ["Hasta 100 facturas al mes", "Envío de facturas por email", "Escáner de gastos con IA"], cta: "Probar 14 días gratis", highlight: false },
  { name: "Platino", price: "24,99€", per: "/mes", desc: "Sin límites y con VeriFactu", features: ["Facturas ilimitadas", "VeriFactu AEAT + tu certificado", "Cobros con tarjeta (Stripe)"], cta: "Probar 14 días gratis", highlight: true },
  { name: "Multiempresas", price: "49,99€", per: "/mes", desc: "Para asesorías y grupos", features: ["Hasta 20 empresas y autónomos", "Todo lo de Platino en cada empresa", "Certificado y contabilidad por empresa"], cta: "Probar 14 días gratis", highlight: false, badge: "Nuevo" },
];

function CursorPointer({ clicking }) {
  return (
    <div className="relative">
      <MousePointer2 className="w-6 h-6 text-slate-900 drop-shadow-lg" fill="white" strokeWidth={1.5} />
      <AnimatePresence>
        {clicking && (
          <motion.span
            className="absolute -top-2 -left-2 w-9 h-9 rounded-full"
            style={{ background: ACCENT }}
            initial={{ scale: 0, opacity: 0.55 }}
            animate={{ scale: 2.1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TwoClicksInvoice() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 4), 1800);
    return () => clearInterval(id);
  }, []);

  const positions = [
    { top: "30%", left: "54%" },
    { top: "30%", left: "54%" },
    { top: "85%", left: "58%" },
    { top: "85%", left: "58%" },
  ];
  const clicking = step === 1 || step === 3;
  const filled = step >= 1;
  const generated = step >= 3;

  return (
    <BrowserFrame>
      <div className="relative p-5 sm:p-6 bg-white min-h-[372px]" data-testid="two-clicks-mockup">
        <AnimatePresence>
          {generated && (
            <motion.div
              key="flash"
              className="absolute inset-0 z-10 pointer-events-none"
              style={{ background: ACCENT }}
              initial={{ opacity: 0.22 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            />
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs text-slate-400">Nueva factura</div>
            <div className="font-outfit text-lg font-semibold text-slate-900">Crear en 2 clics</div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#0052FF] bg-[#0052FF]/10 px-2.5 py-1 rounded-full">
            <Zap className="w-3 h-3" strokeWidth={2} /> Al instante
          </span>
        </div>

        <div className="mb-4">
          <div className="text-[11px] text-slate-400 mb-1.5">Cliente</div>
          <motion.div
            className="rounded-lg border px-3 py-2.5 flex items-center justify-between text-sm"
            animate={{ borderColor: step === 1 ? ACCENT : "#e2e8f0", backgroundColor: filled ? "#EFF4FF" : "#ffffff" }}
            transition={{ duration: 0.3 }}
          >
            <span className={filled ? "text-slate-900 font-medium" : "text-slate-400"}>
              {filled ? "Estudio Marín S.L." : "Selecciona un cliente…"}
            </span>
            <Users className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
          </motion.div>
        </div>

        <div className="space-y-2 mb-4 min-h-[64px]">
          <AnimatePresence>
            {filled &&
              [["Diseño web", "1.100€"], ["Branding", "546€"]].map(([c, p], i) => (
                <motion.div
                  key={c}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.12 }}
                  className="flex items-center justify-between text-sm border-b border-slate-50 pb-2"
                >
                  <span className="text-slate-600">{c}</span>
                  <span className="tabular-nums text-slate-900">{p}</span>
                </motion.div>
              ))}
          </AnimatePresence>
        </div>

        <div className="flex justify-between font-outfit font-semibold text-slate-900 mb-4">
          <span>Total (IVA incl.)</span>
          <motion.span className="tabular-nums" animate={{ opacity: filled ? 1 : 0.35 }}>
            {filled ? "1.991,66€" : "0,00€"}
          </motion.span>
        </div>

        <div className="relative">
          {!generated ? (
            <motion.button
              className="w-full rounded-full text-white text-sm font-medium py-2.5 flex items-center justify-center gap-2"
              style={{ background: ACCENT }}
              animate={{ scale: step === 3 ? 0.96 : 1 }}
            >
              <FileText className="w-4 h-4" strokeWidth={2} /> Emitir factura
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" strokeWidth={3} />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Factura F26012 emitida</div>
                <div className="text-[11px] text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" strokeWidth={2} /> Registrada en VeriFactu
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <motion.div
          className="absolute z-20 pointer-events-none"
          animate={positions[step]}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        >
          <CursorPointer clicking={clicking} />
          <motion.span
            className="absolute top-6 left-4 text-[10px] font-semibold text-white px-2 py-0.5 rounded-full whitespace-nowrap shadow-md"
            style={{ background: ACCENT }}
            animate={{ opacity: clicking ? 1 : 0, scale: clicking ? 1 : 0.8 }}
          >
            {step === 1 ? "clic 1" : step === 3 ? "clic 2" : ""}
          </motion.span>
        </motion.div>
      </div>
    </BrowserFrame>
  );
}

function GestoriaMockup() {
  return (
    <BrowserFrame>
      <div className="flex min-h-[320px] bg-white">
        <div className="w-40 border-r border-slate-100 p-4 bg-slate-50/60 hidden sm:block">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: ACCENT }}>TG</div>
            <div className="text-xs font-semibold text-slate-900">Tu Gestoría</div>
          </div>
          {["Clientes", "Facturas", "Impuestos", "Ajustes"].map((t, i) => (
            <div key={t} className={`text-xs px-2.5 py-2 rounded-lg mb-1 ${i === 0 ? "bg-white text-slate-900 font-medium shadow-sm" : "text-slate-400"}`}>{t}</div>
          ))}
          <div className="mt-6 rounded-lg border border-dashed border-slate-200 p-2.5 text-center">
            <Palette className="w-4 h-4 mx-auto text-slate-300 mb-1" strokeWidth={1.5} />
            <div className="text-[9px] text-slate-400">Tu logo aquí</div>
          </div>
        </div>
        <div className="flex-1 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-outfit font-semibold text-slate-900">Tus clientes</div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white px-2.5 py-1 rounded-full" style={{ background: ACCENT }}>+ Añadir</span>
          </div>
          <div className="space-y-2">
            {[["Estudio Marín S.L.", "Al día"], ["Panadería Sol", "Al día"], ["Tech Nomads", "Pendiente"]].map(([n, s]) => (
              <div key={n} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center text-xs font-semibold">{n[0]}</div>
                  <span className="text-sm text-slate-700">{n}</span>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${s === "Al día" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

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
            <a href="#tpv" className="hover:text-slate-900 transition-colors">TPV</a>
            <a href="#cobros" className="hover:text-slate-900 transition-colors">Cobros</a>
            <a href="#impuestos" className="hover:text-slate-900 transition-colors">Impuestos</a>
            <a href="#funcionalidades" className="hover:text-slate-900 transition-colors">Funcionalidades</a>
            <a href="#gestorias" className="hover:text-slate-900 transition-colors">Gestorías</a>
            <a href="#precios" className="hover:text-slate-900 transition-colors">Precios</a>
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
                OpenFactura es la solución en la nube con todo lo que necesitas para gestionar tu negocio: facturas con plantillas propias, <strong>TPV para hostelería y retail</strong>, cobros con tarjeta, IVA, IRPF, VeriFactu y una IA que te ayuda. Todo en una sola plataforma.
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
            <motion.div
              className="absolute -inset-6 bg-[#0052FF]/10 blur-3xl rounded-full -z-10"
              animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.08, 1] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <DashboardMockup />
            </motion.div>
            <motion.div
              className="hidden sm:block absolute -bottom-8 -left-6 w-56"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: [0, -10, 0] }}
              transition={{ opacity: { delay: 0.5, duration: 0.6 }, y: { duration: 4.5, repeat: Infinity, ease: "easeInOut" } }}
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
            <motion.div
              className="hidden sm:flex absolute -top-6 -right-4 items-center gap-2.5 bg-white rounded-xl border border-slate-200 shadow-xl px-3.5 py-2.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: [0, 10, 0] }}
              transition={{ opacity: { delay: 0.7, duration: 0.6 }, y: { duration: 5.5, repeat: Infinity, ease: "easeInOut" } }}
            >
              <span className="w-8 h-8 rounded-lg bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center shrink-0"><FileText className="w-4 h-4" strokeWidth={1.5} /></span>
              <div>
                <div className="text-xs font-semibold text-slate-900">Nueva factura</div>
                <div className="text-[11px] text-slate-400 tabular-nums">1.991,66€ · enviada</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Acompañamiento */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl px-6 sm:px-8 py-6 sm:py-7 text-white flex flex-col sm:flex-row items-center gap-5 sm:gap-8 shadow-[0_20px_45px_-15px_rgba(0,82,255,0.5)]" style={{ background: ACCENT }}>
              <div className="absolute -right-10 -bottom-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
              <div className="flex items-center gap-4 relative">
                <span className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Users className="w-6 h-6" strokeWidth={1.5} /></span>
                <div>
                  <div className="font-outfit text-lg sm:text-xl font-semibold">Te acompañamos en toda tu integración, paso a paso</div>
                  <div className="text-sm text-white/80 mt-0.5">De la mano hasta que crees tu primera factura. Sin tecnicismos.</div>
                </div>
              </div>
              <a href="https://wa.me/34633377358" target="_blank" rel="noopener noreferrer" className="sm:ml-auto relative w-full sm:w-auto" data-testid="onboarding-whatsapp">
                <Button className="bg-white text-[#0052FF] hover:bg-white/90 rounded-full px-6 font-semibold w-full sm:w-auto">
                  <MessageCircle className="w-4 h-4 mr-2" strokeWidth={2} /> Habla con nosotros
                </Button>
              </a>
            </div>
          </Reveal>
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
              <div key={m.title} id={m.id} className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
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

      {/* Facturas en 2 clics */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(0,82,255,0.28)" }} />
        <div className="absolute -bottom-24 -right-24 w-[28rem] h-[28rem] rounded-full blur-3xl" style={{ background: "rgba(0,82,255,0.16)" }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center relative">
          <Reveal>
            <span className="inline-flex items-center gap-2 bg-white/10 text-white rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <MousePointerClick className="w-4 h-4" strokeWidth={1.5} /> Rápido de verdad
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
              OpenFactura, <span style={{ color: "#7DA2FF" }}>tus facturas a solo dos clics</span>
            </h2>
            <p className="text-slate-300 mt-5 text-base sm:text-lg max-w-lg leading-relaxed">
              Elige el cliente y emite. Nosotros calculamos el IVA, generamos el PDF con tu marca y lo registramos en VeriFactu automáticamente.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                "Clic 1: selecciona el cliente y los conceptos",
                "Clic 2: emite y se registra en VeriFactu",
                "PDF profesional listo para enviar al instante",
              ].map((b) => (
                <li key={b} className="flex items-start gap-3 text-slate-200">
                  <span className="w-5 h-5 rounded-full bg-[#0052FF] text-white flex items-center justify-center shrink-0 mt-0.5"><Check className="w-3 h-3" strokeWidth={3} /></span>
                  {b}
                </li>
              ))}
            </ul>
            <Link to="/registro"><Button size="lg" className="mt-8 text-white rounded-full px-8 shadow-lg" style={{ background: ACCENT }} data-testid="two-clicks-cta">Crear mi primera factura <ArrowRight className="w-4 h-4 ml-2" strokeWidth={2} /></Button></Link>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="relative">
              <div className="absolute -inset-6 bg-[#0052FF]/25 blur-3xl rounded-full -z-10" />
              <TwoClicksInvoice />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Integra tu gestoría */}
      <section id="gestorias" className="bg-gradient-to-b from-[#EEF4FF] to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal delay={0.1} className="lg:order-2">
            <div className="relative">
              <div className="absolute -inset-4 bg-white rounded-3xl shadow-[0_30px_60px_-20px_rgba(2,6,23,0.15)] -z-10" />
              <GestoriaMockup />
              <motion.div
                className="hidden sm:flex absolute -top-5 -right-4 items-center gap-2 bg-white rounded-full border border-slate-200 shadow-xl px-3.5 py-2"
                initial={{ opacity: 0, y: -12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
              >
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: ACCENT }}><Palette className="w-3.5 h-3.5" strokeWidth={2} /></span>
                <span className="text-xs font-semibold text-slate-900">Marca blanca</span>
              </motion.div>
            </div>
          </Reveal>
          <Reveal className="lg:order-1">
            <div className="inline-flex items-center gap-2 text-sm font-semibold mb-4" style={{ color: ACCENT }}>
              <Building2 className="w-4 h-4" strokeWidth={2} /> Para gestorías y asesorías
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Integra tu gestoría</h2>
            <p className="text-base sm:text-lg text-slate-500 mt-4 max-w-lg leading-relaxed">
              Incorpora a todos tus clientes bajo <strong className="text-slate-700">tu propia marca</strong>. Tu logo, tus colores, tu identidad. Tus clientes verán tu marca en todo momento, no la nuestra.
            </p>
            <ul className="mt-6 space-y-3.5">
              {[
                ["Tu logo y tu branding", "Personaliza el panel y las facturas con tu identidad."],
                ["Todos tus clientes en un sitio", "Crea, gestiona y factura por cada cliente desde un panel central."],
                ["Marca blanca real", "Tus clientes ven tu marca, no OpenFactura."],
                ["Reventa con margen", "Precios especiales para revender a toda tu cartera."],
              ].map(([t, d]) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center shrink-0 mt-0.5"><Check className="w-3 h-3" strokeWidth={3} /></span>
                  <span><span className="font-semibold text-slate-900">{t}.</span> <span className="text-slate-500">{d}</span></span>
                </li>
              ))}
            </ul>
            <Link to="/registro"><Button className="mt-8 text-white rounded-full px-6" style={{ background: ACCENT }} data-testid="gestoria-cta">Empieza como gestoría <ArrowRight className="w-4 h-4 ml-2" strokeWidth={2} /></Button></Link>
          </Reveal>
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
              {["Stripe", "VeriFactu AEAT", "VIES", "Resend", "Certificado digital", "Google"].map((n) => (
                <span key={n} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
                  <Zap className="w-3.5 h-3.5" style={{ color: ACCENT }} strokeWidth={2} /> {n}
                </span>
              ))}
              <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-[#635BFF]/40 bg-[#635BFF]/5 px-4 py-2 text-sm font-medium text-[#635BFF]">
                <Clock className="w-3.5 h-3.5" strokeWidth={2} /> RedSys · Próximamente
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-emerald-500/40 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-600">
                <Clock className="w-3.5 h-3.5" strokeWidth={2} /> WhatsApp · Próximamente
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-[#0052FF]/40 bg-[#0052FF]/5 px-4 py-2 text-sm font-medium text-[#0052FF]">
                <Clock className="w-3.5 h-3.5" strokeWidth={2} /> Conciliación bancaria · Próximamente
              </span>
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

      {/* Novedades */}
      <section id="novedades" className="bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <Reveal>
            <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: ACCENT }}><Sparkles className="w-4 h-4" strokeWidth={2} /> Novedades</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-3">Más potente que nunca</h2>
            <p className="text-slate-500 mt-3 max-w-2xl leading-relaxed">Presupuestos, multiempresa para asesorías, facturación intracomunitaria y cobros con tarjeta. Todo dentro de OpenFactura.</p>
          </Reveal>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {NOVEDADES.map((f) => (
              <motion.div key={f.t} variants={fadeUp} className="rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow duration-300" data-testid={`novedad-${f.t}`}>
                <div className="w-11 h-11 rounded-xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center mb-4"><f.icon className="w-5 h-5" strokeWidth={1.5} /></div>
                <div className="font-semibold text-slate-900">{f.t}</div>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{f.d}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Próximamente */}
      <section id="proximamente" className="bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#0052FF]/20 blur-3xl rounded-full" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 relative">
          <Reveal>
            <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "#7DA2FF" }}><Clock className="w-4 h-4" strokeWidth={2} /> Próximamente</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mt-3 max-w-2xl">Lo que estamos construyendo para ti</h2>
            <p className="text-slate-400 mt-4 max-w-xl">Estas potentes funciones llegarán muy pronto a OpenFactura. Ve preparando tu negocio.</p>
          </Reveal>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
            {PROXIMAMENTE.map((f) => (
              <motion.div key={f.t} variants={fadeUp} className="group rounded-2xl border border-slate-800 bg-slate-800/40 p-6 hover:border-[#0052FF]/50 hover:bg-slate-800/70 transition-colors duration-300 backdrop-blur-sm" data-testid={`soon-${f.t}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-[#0052FF]/15 text-[#7DA2FF] flex items-center justify-center"><f.icon className="w-5 h-5" strokeWidth={1.5} /></div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-slate-300 rounded-full px-2.5 py-1">Pronto</span>
                </div>
                <div className="font-semibold text-lg">{f.t}</div>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{f.d}</p>
                {f.banks && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {BANKS.map((b) => (
                      <span key={b} className="text-[11px] font-semibold rounded-md bg-white/90 text-slate-800 px-2.5 py-1">{b}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precios" className="bg-[#F8FAFC] border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">Planes para cada negocio</h2>
            <p className="text-slate-500 mt-3 text-center max-w-2xl mx-auto leading-relaxed">14 días gratis en cualquier plan. Opción anual con 2 meses gratis. Sin permanencia.</p>
          </Reveal>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 items-stretch">
            {PLANS.map((p) => (
              <motion.div key={p.name} variants={fadeUp} data-testid={`plan-${p.name}`} className={`rounded-2xl border p-6 bg-white flex flex-col ${p.highlight ? "border-[#0052FF] shadow-xl ring-1 ring-[#0052FF]/20" : "border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-lg text-slate-900">{p.name}</div>
                  {p.badge ? <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#0052FF]/10 text-[#0052FF] rounded-full px-2 py-0.5">{p.badge}</span>
                    : p.highlight ? <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#0052FF] text-white rounded-full px-2 py-0.5">Popular</span> : null}
                </div>
                <div className="mt-3 flex items-end gap-1"><span className="text-3xl font-extrabold tracking-tight text-slate-900">{p.price}</span><span className="text-slate-400 text-sm mb-1">{p.per}</span></div>
                <p className="text-sm text-slate-500 mt-1">{p.desc}</p>
                <ul className="mt-5 space-y-2.5 flex-1">
                  {p.features.map((f) => (<li key={f} className="flex items-start gap-2 text-sm text-slate-600"><span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} /> {f}</li>))}
                </ul>
                <Link to="/registro" className="mt-6"><Button className="w-full rounded-full text-white" style={{ background: ACCENT }} data-testid={`plan-cta-${p.name}`}>{p.cta}</Button></Link>
              </motion.div>
            ))}
          </motion.div>
          <p className="text-center text-sm text-slate-500 mt-8">¿Gestionas más de 20 empresas? Disponemos de un plan de <strong>50 empresas</strong> y planes a medida. <a href="mailto:soporte@goroky.com" className="font-medium" style={{ color: ACCENT }}>Escríbenos</a> y lo adaptamos a tu asesoría.</p>
        </div>
      </section>

      {/* Alternativa (SEO competidores) */}
      <section className="bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">La alternativa española a Holded, FacturaDirecta, Quipu y Billin</h2>
            <p className="text-slate-500 mt-4 leading-relaxed">Si buscas un <strong>programa de facturación</strong> sencillo y 100% adaptado a España —con VeriFactu, IVA e IRPF automáticos, presupuestos, multiempresa y cobros con tarjeta— OpenFactura reúne lo mejor de las soluciones más conocidas a un precio justo y sin curva de aprendizaje.</p>
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

      {/* FAQ */}
      <section id="faq" className="bg-[#F8FAFC] border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <Reveal className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#0052FF]/10 text-[#0052FF] px-4 py-1.5 text-sm font-medium mb-4">
              <HelpCircle className="w-4 h-4" strokeWidth={2} /> Preguntas frecuentes
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Todo lo que necesitas saber</h2>
            <p className="text-slate-500 mt-4 text-lg">Resolvemos las dudas más habituales sobre OpenFactura.</p>
          </Reveal>
          <Reveal delay={0.1} className="mt-10">
            <Accordion type="single" collapsible className="space-y-3" data-testid="faq-accordion">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-slate-200 rounded-2xl bg-white px-5 data-[state=open]:shadow-md transition-shadow" data-testid={`faq-item-${i}`}>
                  <AccordionTrigger className="text-left text-base font-semibold text-slate-900 hover:no-underline py-5">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-slate-600 text-[15px] leading-relaxed pb-5">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* Inversionistas */}
      <section id="inversores" className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-6xl mx-auto rounded-3xl bg-slate-900 text-white overflow-hidden relative px-6 py-16 sm:py-20">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#0052FF]/25 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />
          <Reveal className="relative text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-1.5 text-sm font-medium mb-5 backdrop-blur-sm">
              <TrendingUp className="w-4 h-4 text-[#7FB0FF]" strokeWidth={2} /> Oportunidad de inversión
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">¿Eres inversionista?</h2>
            <p className="text-white/75 mt-5 text-lg leading-relaxed">
              Estamos construyendo el software de facturación de referencia para autónomos y pymes en España.
              Si deseas contactar al equipo, escríbenos y nos pondremos en contacto contigo.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <a href="mailto:soporte@goroky.com?subject=Interés%20de%20inversión%20en%20OpenFactura&body=Hola%20equipo%20OpenFactura%2C%0A%0AEstoy%20interesado%2Fa%20en%20conocer%20la%20oportunidad%20de%20inversión.%20Estos%20son%20mis%20datos%20de%20contacto%3A%0A%0ANombre%3A%0AEmpresa%2FFondo%3A%0ATeléfono%3A%0A%0AGracias." data-testid="investor-contact-btn">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 rounded-full px-8 w-full sm:w-auto font-semibold">
                  <Mail className="w-4 h-4 mr-2" strokeWidth={2} /> Contactar al equipo
                </Button>
              </a>
            </div>
            <p className="text-white/50 text-sm mt-5">
              O escríbenos directamente a{" "}
              <a href="mailto:soporte@goroky.com" className="text-white underline decoration-white/30 hover:decoration-white transition" data-testid="investor-email-link">soporte@goroky.com</a>
            </p>
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
            <Link to="/blog" className="hover:text-slate-900 transition-colors" data-testid="footer-blog">Blog</Link>
            <Link to="/terminos" className="hover:text-slate-900 transition-colors" data-testid="footer-terms">Términos y condiciones</Link>
            <Link to="/privacidad" className="hover:text-slate-900 transition-colors" data-testid="footer-privacy">Política de privacidad</Link>
          </div>
        </div>
      </footer>

      {/* WhatsApp flotante */}
      <a
        href="https://wa.me/34633377358"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="whatsapp-float"
        aria-label="Escríbenos por WhatsApp"
        className="fixed bottom-6 right-6 z-50 group flex items-center"
      >
        <span className="hidden sm:block mr-3 bg-white text-slate-800 text-sm font-medium px-3.5 py-1.5 rounded-full shadow-lg border border-slate-100 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap">¿Hablamos? Estamos aquí</span>
        <span className="relative flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-transform duration-300 group-hover:scale-110" style={{ background: "#25D366" }}>
          <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "#25D366", opacity: 0.35 }} />
          <MessageCircle className="w-7 h-7 text-white relative" strokeWidth={2} />
        </span>
      </a>
    </div>
  );
}
