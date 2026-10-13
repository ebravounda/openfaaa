import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Loader2, Send, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { Seo } from "@/components/Seo";
import { getPost, POSTS } from "@/pages/blogData";
import { fmtDate } from "@/components/blog/BlogCards";
import { BlogHeader, BlogFooter } from "@/pages/Blog";

const SITE = "https://openfactura.es";
const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;
const track = (type, article_id) => api.post("/blog/track", { type, article_id }).catch(() => {});

const NotFound = () => (
  <div className="min-h-screen bg-white text-slate-900 font-outfit">
    <Helmet><title>Artículo no encontrado | OpenFactura.es</title><meta name="robots" content="noindex" /></Helmet>
    <BlogHeader />
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center" data-testid="blog-not-found">
      <h1 className="text-3xl font-extrabold tracking-tight">Artículo no encontrado</h1>
      <Link to="/blog" className="inline-flex items-center gap-2 text-[#0052FF] mt-6" data-testid="blog-not-found-back"><ArrowLeft className="w-4 h-4" /> Volver al blog</Link>
    </div>
  </div>
);

const LeadForm = ({ articleId }) => {
  const [f, setF] = useState({ name: "", email: "", message: "" });
  const [state, setState] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setState("sending"); setErr("");
    try { await api.post("/blog/lead", { ...f, article_id: articleId }); setState("done"); }
    catch (x) { setErr(x.response?.data?.detail || "No se ha podido enviar el mensaje."); setState(""); }
  };
  if (state === "done") return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800 flex items-center gap-2" data-testid="blog-lead-success"><CheckCircle2 className="w-5 h-5" /> ¡Gracias! Te contactaremos pronto</div>;
  const cls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30 focus:border-[#0052FF]";
  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 space-y-3" data-testid="blog-lead-form">
      <div className="font-bold text-lg">¿Tienes dudas? Escríbenos</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nombre" className={cls} data-testid="blog-lead-name" />
        <input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email" className={cls} data-testid="blog-lead-email" />
      </div>
      <textarea required rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Mensaje" className={cls} data-testid="blog-lead-message" />
      {err && <div className="text-sm text-red-600" data-testid="blog-lead-error">{err}</div>}
      <button disabled={state === "sending"} className="rounded-full text-white px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60" style={{ background: "#0052FF" }} data-testid="blog-lead-submit">
        {state === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar</button>
    </form>
  );
};

const RemotePost = ({ a }) => {
  const body = useRef(null);
  useEffect(() => { track("view", a.id); }, [a.id]);
  const onClick = (e) => { const el = e.target.closest?.("[data-track]"); if (el) track(el.getAttribute("data-track"), a.id); };
  const author = a.author || {};
  const url = `${SITE}/blog/${a.slug}`;
  return (
    <div className="min-h-screen bg-white text-slate-900 font-outfit">
      <Helmet prioritizeSeoTags>
        <title>{a.meta_title || a.title}</title>
        {a.meta_description && <meta name="description" content={a.meta_description} />}
        <link rel="canonical" href={url} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={url} />
        <meta property="og:title" content={a.meta_title || a.title} />
        {a.meta_description && <meta property="og:description" content={a.meta_description} />}
        {a.cover_url && <meta property="og:image" content={a.cover_url} />}
        <link rel="stylesheet" href={`${API_BASE}/blog/styles.css`} />
        {a.jsonld && <script type="application/ld+json">{JSON.stringify(a.jsonld)}</script>}
      </Helmet>
      <BlogHeader />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-14" data-testid="blog-article">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-[#0052FF] mb-6"><ArrowLeft className="w-4 h-4" /> Todos los artículos</Link>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight" data-testid="blog-article-title">{a.title}</h1>
        <div className="flex items-center gap-3 text-sm text-slate-500 mt-5" data-testid="blog-article-meta">
          {author.photo_url && <img src={author.photo_url} alt={author.name} className="w-9 h-9 rounded-full object-cover" />}
          <span>{author.name && <b className="text-slate-800 font-semibold">{author.name}</b>}{author.name && fmtDate(a.published_at) ? " · " : ""}{fmtDate(a.published_at)}</span>
        </div>
        {a.cover_url && <img src={a.cover_url} alt={a.title} className="w-full rounded-2xl mt-8 aspect-[16/9] object-cover" data-testid="blog-article-cover" />}
        <div ref={body} onClick={onClick} className="mseo-root mt-10" data-testid="blog-article-body" dangerouslySetInnerHTML={{ __html: a.html || "" }} />
        {(author.name || author.bio) && (
          <div className="mt-14 rounded-2xl border border-slate-200 p-6 flex gap-4 items-start" data-testid="blog-author-box">
            {author.photo_url && <img src={author.photo_url} alt={author.name} className="w-16 h-16 rounded-full object-cover shrink-0" />}
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Sobre el autor</div>
              <div className="font-bold text-slate-900 mt-1">{author.name}</div>
              {author.credentials && <div className="text-sm text-[#0052FF]">{author.credentials}</div>}
              {author.bio && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{author.bio}</p>}
            </div>
          </div>
        )}
        <div className="mt-10"><LeadForm articleId={a.id} /></div>
      </article>
      <BlogFooter />
    </div>
  );
};

const StaticPost = ({ post }) => {
  const related = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);
  return (
    <div className="min-h-screen bg-white text-slate-900 font-outfit">
      <Seo path={`/blog/${post.slug}`} title={post.title} description={post.description} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "Article", headline: post.title, description: post.description,
          datePublished: post.date, dateModified: post.date, inLanguage: "es-ES", author: { "@type": "Organization", name: "OpenFactura" },
          publisher: { "@type": "Organization", name: "OpenFactura", logo: { "@type": "ImageObject", url: `${SITE}/openfactura-logo.png` } },
          mainEntityOfPage: `${SITE}/blog/${post.slug}`,
        })}</script>
      </Helmet>
      <BlogHeader />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-14" data-testid="blog-static-article">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-[#0052FF] mb-6"><ArrowLeft className="w-4 h-4" /> Todos los artículos</Link>
        <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {fmtDate(post.date)}</span>
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
      <BlogFooter />
    </div>
  );
};

export default function BlogPost() {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    setState({ loading: true });
    api.get(`/blog/articles/${encodeURIComponent(slug)}`)
      .then((r) => setState({ article: r.data }))
      .catch(() => setState({ notFound: true }));
  }, [slug]);
  if (state.article) return <RemotePost a={state.article} />;
  if (state.loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;
  const post = getPost(slug);
  return post ? <StaticPost post={post} /> : <NotFound />;
}
