import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Seo } from "@/components/Seo";
import { BlogCard, STATIC_POSTS, useBlogArticles } from "@/components/blog/BlogCards";

export const BlogHeader = ({ wide }) => (
  <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-30">
    <div className={`${wide ? "max-w-6xl" : "max-w-3xl"} mx-auto px-4 sm:px-6 h-16 flex items-center justify-between`}>
      <Link to="/" data-testid="blog-home-link"><img src="/openfactura-logo.png" alt="OpenFactura" className="h-7 w-auto" /></Link>
      <div className="flex items-center gap-4">
        <Link to="/blog" className="text-sm font-medium text-slate-600 hover:text-slate-900" data-testid="blog-nav-link">Blog</Link>
        <Link to="/registro"><button className="rounded-full text-white px-5 py-2 text-sm font-semibold" style={{ background: "#0052FF" }} data-testid="blog-register">Empieza gratis</button></Link>
      </div>
    </div>
  </header>
);

export const BlogFooter = () => (
  <footer className="border-t border-slate-100 py-8">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-wrap gap-6 justify-center text-sm text-slate-500">
      <Link to="/" className="hover:text-slate-900">Inicio</Link>
      <Link to="/blog" className="hover:text-slate-900">Blog</Link>
      <Link to="/precios" className="hover:text-slate-900">Precios</Link>
      <Link to="/terminos" className="hover:text-slate-900">Términos</Link>
      <Link to="/privacidad" className="hover:text-slate-900">Privacidad</Link>
    </div>
  </footer>
);

export default function Blog() {
  const remote = useBlogArticles();
  const slugs = new Set((remote || []).map((a) => a.slug));
  const all = remote ? [...remote, ...STATIC_POSTS.filter((p) => !slugs.has(p.slug))] : null;
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-outfit">
      <Seo path="/blog" title="Blog de facturación y fiscalidad para autónomos"
        description="Guías prácticas sobre facturación, VeriFactu, IVA, IRPF y gestión para autónomos y pymes en España. Aprende a facturar bien y cumplir con la AEAT." />
      <BlogHeader wide />
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#0052FF] mb-8"><ArrowLeft className="w-4 h-4" /> Volver al inicio</Link>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight" data-testid="blog-title">Blog de OpenFactura</h1>
        <p className="text-slate-500 mt-4 text-base md:text-lg max-w-2xl">Guías de facturación, VeriFactu e impuestos para autónomos y pymes en España.</p>
        {!all && <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>}
        {all && !all.length && <div className="mt-16 text-center text-slate-500" data-testid="blog-empty">Pronto publicaremos artículos</div>}
        {all && all.length > 0 && (
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="blog-grid">
            {all.map((a) => <BlogCard key={a.id || a.slug} a={a} />)}
          </div>
        )}
      </section>
      <BlogFooter />
    </div>
  );
}
