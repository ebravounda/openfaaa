import { Link, useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowRight, CalendarDays, Clock } from "lucide-react";
import { Seo } from "@/components/Seo";
import { getPost, POSTS } from "@/pages/blogData";

const SITE = "https://openfactura.es";

export default function BlogPost() {
  const { slug } = useParams();
  const post = getPost(slug);
  if (!post) return <Navigate to="/blog" replace />;
  const related = POSTS.filter((p) => p.slug !== slug).slice(0, 2);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-outfit">
      <Seo path={`/blog/${post.slug}`} title={post.title} description={post.description} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "Article",
          headline: post.title, description: post.description,
          datePublished: post.date, dateModified: post.date,
          inLanguage: "es-ES",
          author: { "@type": "Organization", name: "OpenFactura" },
          publisher: { "@type": "Organization", name: "OpenFactura", logo: { "@type": "ImageObject", url: `${SITE}/openfactura-logo.png` } },
          mainEntityOfPage: `${SITE}/blog/${post.slug}`,
        })}</script>
      </Helmet>

      <header className="border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/"><img src="/openfactura-logo.png" alt="OpenFactura" className="h-7 w-auto" /></Link>
          <Link to="/registro"><button className="rounded-full text-white px-5 py-2 text-sm font-semibold" style={{ background: "#0052FF" }}>Empieza gratis</button></Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-[#0052FF] mb-6"><ArrowLeft className="w-4 h-4" /> Todos los artículos</Link>
        <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {new Date(post.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {post.read}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">{post.title}</h1>
        <div className="prose prose-slate max-w-none mt-8 text-slate-600 leading-relaxed prose-headings:font-bold prose-headings:text-slate-900 prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-a:text-[#0052FF] prose-strong:text-slate-900"
          dangerouslySetInnerHTML={{ __html: post.html }} />

        <div className="rounded-2xl text-white text-center px-6 py-10 mt-12" style={{ background: "#0052FF" }}>
          <div className="text-xl font-bold">Factura sin complicarte con OpenFactura</div>
          <p className="text-white/80 mt-2 text-sm">VeriFactu, IVA e IRPF automáticos, presupuestos y multiempresa. Prueba 14 días gratis.</p>
          <Link to="/registro" className="inline-block mt-5"><button className="bg-white text-[#0052FF] rounded-full px-6 py-2.5 font-semibold inline-flex items-center gap-2 text-sm">Empezar gratis <ArrowRight className="w-4 h-4" /></button></Link>
        </div>

        {related.length > 0 && (
          <div className="mt-14">
            <h2 className="text-lg font-bold mb-4">Sigue leyendo</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map((p) => (
                <Link key={p.slug} to={`/blog/${p.slug}`} className="rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                  <div className="font-semibold text-slate-900 text-sm">{p.title}</div>
                  <div className="text-slate-500 text-xs mt-1 line-clamp-2">{p.description}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
