import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Newspaper, Loader2, CheckCircle2, Unplug, Save, PlugZap } from "lucide-react";

export const BlogSeoSection = () => {
  const [cfg, setCfg] = useState(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [test, setTest] = useState(null);
  useEffect(() => { api.get("/admin/blog").then((r) => setCfg(r.data)).catch(() => setCfg({ connected: false })); }, []);
  const run = async (k, fn) => {
    setBusy(k);
    try { await fn(); } catch (e) { setTest(null); toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Error de conexión"); } finally { setBusy(""); }
  };
  const probe = () => run("test", async () => { const { data } = await api.post("/admin/blog/test", { url }); setTest(data); });
  const save = () => run("save", async () => { const { data } = await api.post("/admin/blog", { url }); setCfg(data); setUrl(""); setTest(null); toast.success("Blog SEO conectado"); });
  const disconnect = () => run("del", async () => {
    if (!window.confirm("¿Desconectar el blog? Los artículos del motor dejarán de mostrarse.")) return;
    const { data } = await api.delete("/admin/blog"); setCfg(data); toast.success("Blog desconectado");
  });
  const spin = (k, Icon) => (busy === k ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Icon className="w-4 h-4 mr-1.5" />);
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm max-w-3xl overflow-hidden mt-8" data-testid="blog-seo-section">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Newspaper className="w-4 h-4 text-[#0052FF]" strokeWidth={1.5} />
        <div>
          <div className="font-medium text-slate-900">Blog SEO</div>
          <div className="text-sm text-slate-500">Conecta el motor de contenidos: los artículos que publique aparecerán solos en /blog.</div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {cfg?.connected && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex flex-wrap items-start justify-between gap-3" data-testid="blog-seo-connected">
            <div className="text-sm">
              <div className="font-medium text-emerald-800 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Conectado{cfg.brand ? ` a ${cfg.brand}` : ""}</div>
              <div className="text-slate-600 mt-1 break-all">API: {cfg.api_base}</div>
              <div className="text-slate-600">Clave: <span className="font-mono" data-testid="blog-seo-key-masked">{cfg.key_masked}</span></div>
            </div>
            <Button variant="outline" size="sm" onClick={disconnect} disabled={!!busy} className="border-red-200 text-red-600 hover:bg-red-50" data-testid="blog-seo-disconnect">{spin("del", Unplug)}Desconectar</Button>
          </div>
        )}
        <div className="space-y-2">
          <Label>Enlace de conexión {cfg?.connected && <span className="text-xs text-slate-400">(pega uno nuevo para cambiarlo)</span>}</Label>
          <Input value={url} onChange={(e) => { setUrl(e.target.value); setTest(null); }} placeholder="https://.../api/public/{id}/connect?key={clave}" data-testid="blog-seo-url" />
        </div>
        {test && <div className="text-sm text-emerald-700 flex items-center gap-1.5" data-testid="blog-seo-test-result"><CheckCircle2 className="w-4 h-4" /> Conectado a {test.brand} · {test.published} artículos publicados</div>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={probe} disabled={!url.trim() || !!busy} data-testid="blog-seo-test">{spin("test", PlugZap)}Probar conexión</Button>
          <Button onClick={save} disabled={!url.trim() || !!busy} className="bg-[#0052FF] hover:bg-[#0040CC] text-white" data-testid="blog-seo-save">{spin("save", Save)}Guardar</Button>
        </div>
      </div>
    </div>
  );
};
