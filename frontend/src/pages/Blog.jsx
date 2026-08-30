import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Clock } from "lucide-react";
import { Seo } from "@/components/Seo";
import { POSTS } from "@/pages/blogData";

export default function Blog() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-outfit">
      <Seo path="/blog" title="Blog de facturación y fiscalidad para autónomos"
        description="Guías prácticas sobre facturación, VeriFactu, IVA, IRPF y gestión para autónomos y pymes en España. Aprende a facturar bien y cumplir con la AEAT." />
      <header className="border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/"><img src="/openfactura-logo.png" alt="OpenFactura" className="h-7 w-auto" /></Link>
          <Link to="/registro"><button className="rounded-full text-white px-5 py-2 text-sm font-semibold" style={{ background: "#0052FF" }}>Empieza gratis</button></Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#0052FF] mb-8"><ArrowLeft className="w-4 h-4" /> Volver al inicio</Link>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Blog de OpenFactura</h1>
        <p className="text-slate-500 mt-4 text-lg">Guías de facturación, VeriFactu e impuestos para autónomos y pymes en España.</p>

        <div className="mt-12 space-y-6">
          {POSTS.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} data-testid={`blog-card-${p.slug}`} className="block rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4 text-xs text-slate-400 mb-2">
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {new Date(p.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>
                <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {p.read}</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{p.title}</h2>
              <p className="text-slate-500 mt-2 leading-relaxed">{p.description}</p>
              <span className="inline-flex items-center gap-1.5 text-[#0052FF] font-medium text-sm mt-4">Leer artículo <ArrowRight className="w-4 h-4" /></span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-wrap gap-6 justify-center text-sm text-slate-500">
          <Link to="/" className="hover:text-slate-900">Inicio</Link>
          <Link to="/precios" className="hover:text-slate-900">Precios</Link>
          <Link to="/terminos" className="hover:text-slate-900">Términos</Link>
          <Link to="/privacidad" className="hover:text-slate-900">Privacidad</Link>
        </div>
      </footer>
    </div>
  );
}
