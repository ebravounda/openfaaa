import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays } from "lucide-react";
import api from "@/lib/api";
import { POSTS } from "@/pages/blogData";

export const fmtDate = (d) => {
  const x = d ? new Date(d) : null;
  return x && !isNaN(x) ? x.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "";
};

export const STATIC_POSTS = POSTS.map((p) => ({ id: `static-${p.slug}`, slug: p.slug, title: p.title, excerpt: p.description, published_at: p.date, cover_url: "", static: true }));

// Artículos del motor SEO (proxy /api/blog). null = cargando.
export function useBlogArticles() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.get("/blog/articles").then((r) => setItems(Array.isArray(r.data) ? r.data : [])).catch(() => setItems([]));
  }, []);
  return items;
}

export const BlogCard = ({ a, testid }) => (
  <Link to={`/blog/${a.slug}`} data-testid={testid || `blog-card-${a.slug}`}
    className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300">
    {a.cover_url
      ? <div className="aspect-[16/9] bg-slate-100 overflow-hidden"><img src={a.cover_url} alt={a.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" /></div>
      : <div className="aspect-[16/9] bg-gradient-to-br from-[#EEF4FF] to-[#DCE7FF] flex items-end p-5"><span className="text-[#0052FF] font-bold text-lg leading-tight line-clamp-3">{a.title}</span></div>}
    <div className="p-5 flex flex-col flex-1">
      {fmtDate(a.published_at) && <div className="text-xs text-slate-400 mb-2 inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {fmtDate(a.published_at)}</div>}
      <h2 className="text-lg font-bold tracking-tight text-slate-900 leading-snug">{a.title}</h2>
      {a.excerpt && <p className="text-slate-500 mt-2 text-sm leading-relaxed line-clamp-3">{a.excerpt}</p>}
      <span className="inline-flex items-center gap-1.5 text-[#0052FF] font-medium text-sm mt-auto pt-4">Leer artículo <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></span>
    </div>
  </Link>
);

// Sección de la home: solo visible si el blog SEO está conectado y tiene artículos.
export const LatestArticles = () => {
  const items = useBlogArticles();
  if (!items || !items.length) return null;
  return (
    <section className="bg-white border-t border-slate-100" data-testid="home-latest-articles">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex items-end justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Últimos artículos</h2>
            <p className="text-slate-500 mt-2">Guías de facturación, VeriFactu e impuestos para autónomos y pymes.</p>
          </div>
          <Link to="/blog" className="hidden sm:inline-flex items-center gap-1.5 text-[#0052FF] font-medium text-sm" data-testid="home-blog-all">Ver todos <ArrowRight className="w-4 h-4" /></Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.slice(0, 3).map((a) => <BlogCard key={a.id || a.slug} a={a} testid={`home-blog-card-${a.slug}`} />)}
        </div>
      </div>
    </section>
  );
};
