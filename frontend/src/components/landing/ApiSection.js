import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Code2, KeyRound, Webhook, ShieldCheck, ArrowRight } from "lucide-react";

const POINTS = [
  [Code2, "Conecta tu ERP, tienda o CRM", "Emite facturas, descarga PDF, crea clientes y registra gastos desde tu propio sistema."],
  [ShieldCheck, "VeriFactu automático", "Las facturas de la API se firman y se envían a la AEAT igual que en la app."],
  [Webhook, "Avisos al instante", "Webhooks firmados cuando se crea una factura o Hacienda la acepta."],
  [KeyRound, "Una clave por empresa", "Ideal para asesorías: cada empresa con su conexión y su registro de actividad."],
];

const SNIPPET = `POST /api/v1/invoices
Authorization: Bearer of_live_••••

{ "client": { "name": "Cliente S.L." },
  "line_items": [{ "description": "Servicio",
    "unit_price": 100, "iva_rate": 21 }] }

→ 201  F-2026-0042 · VeriFactu ✓`;

export const ApiSection = () => (
  <section id="api" className="bg-slate-950 text-white overflow-hidden relative" data-testid="landing-api-section">
    <div className="absolute -bottom-32 -left-24 w-96 h-96 bg-[#0052FF]/25 blur-3xl rounded-full" />
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 grid lg:grid-cols-2 gap-14 items-center">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest bg-[#0052FF]/20 text-[#7EA6FF] rounded-full px-3 py-1">Nuevo · API REST</span>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-5" data-testid="landing-api-title">Integra OpenFactura en tu propia plataforma</h2>
        <p className="text-slate-400 mt-4 leading-relaxed max-w-xl">Con nuestra API para desarrolladores, tu software factura solo. Incluida en los planes Platino y Multiempresas.</p>
        <div className="grid sm:grid-cols-2 gap-5 mt-9">
          {POINTS.map(([Icon, t, d]) => (
            <div key={t} className="flex gap-3">
              <Icon className="w-5 h-5 text-[#7EA6FF] shrink-0 mt-0.5" strokeWidth={1.75} />
              <div><div className="font-semibold text-sm">{t}</div><p className="text-sm text-slate-400 mt-1 leading-relaxed">{d}</p></div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-10">
          <Link to="/para-desarrolladores" data-testid="landing-api-cta" className="inline-flex items-center gap-2 rounded-full bg-[#0052FF] hover:bg-[#0040CC] px-6 py-3 text-sm font-semibold transition-colors">Descubre la API <ArrowRight className="w-4 h-4" /></Link>
          <a href="/api/v1/docs" target="_blank" rel="noreferrer" data-testid="landing-api-docs" className="inline-flex items-center rounded-full border border-white/20 hover:border-white/50 px-6 py-3 text-sm font-semibold transition-colors">Ver documentación</a>
        </div>
      </motion.div>
      <motion.pre initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }}
        className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 text-xs sm:text-sm text-slate-200 overflow-x-auto leading-relaxed font-mono" data-testid="landing-api-code">
        <code>{SNIPPET}</code>
      </motion.pre>
    </div>
  </section>
);
