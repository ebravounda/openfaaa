import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

const SNIPPETS = {
  cURL: `curl -X POST https://openfactura.es/api/v1/invoices \\
  -H "Authorization: Bearer of_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "issue_date": "2026-01-15",
    "client": { "name": "Cliente S.L.", "nif": "B12345674" },
    "line_items": [
      { "description": "Consultoría", "quantity": 1,
        "unit_price": 100, "iva_rate": 21 }
    ]
  }'`,
  "Node.js": `const res = await fetch("https://openfactura.es/api/v1/invoices", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.OPENFACTURA_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    issue_date: "2026-01-15",
    client: { name: "Cliente S.L.", nif: "B12345674" },
    line_items: [{ description: "Consultoría", unit_price: 100, iva_rate: 21 }],
  }),
});
const factura = await res.json();`,
  Python: `import os, requests

r = requests.post(
    "https://openfactura.es/api/v1/invoices",
    headers={"Authorization": f"Bearer {os.environ['OPENFACTURA_KEY']}"},
    json={
        "issue_date": "2026-01-15",
        "client": {"name": "Cliente S.L.", "nif": "B12345674"},
        "line_items": [{"description": "Consultoría",
                        "unit_price": 100, "iva_rate": 21}],
    },
)
factura = r.json()`,
  Respuesta: `HTTP/1.1 200 OK
X-OpenFactura-Api-Version: 1

{
  "id": "9b1f…",
  "number": "F-2026-0042",
  "status": "emitida",
  "subtotal": 100.0,
  "iva_amount": 21.0,
  "total": 121.0,
  "client": { "name": "Cliente S.L." }
}`,
};

const useTyping = (text) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 4)), 12);
    return () => clearInterval(id);
  }, [text]);
  return text.slice(0, n);
};

export const Terminal = () => {
  const [tab, setTab] = useState("cURL");
  const [copied, setCopied] = useState(false);
  const shown = useTyping(SNIPPETS[tab]);
  const copy = () => {
    navigator.clipboard?.writeText(SNIPPETS[tab]);
    setCopied(true);
    toast.success("Código copiado");
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <motion.div initial={{ opacity: 0, y: 30, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
      className="relative rounded-2xl border border-white/10 bg-[#0B1120]/80 backdrop-blur-xl shadow-[0_0_80px_-20px_rgba(0,82,255,0.6)] overflow-hidden" data-testid="api-page-code">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-[#FF5F57]" /><span className="w-3 h-3 rounded-full bg-[#FEBC2E]" /><span className="w-3 h-3 rounded-full bg-[#28C840]" />
        <div className="flex gap-1 ml-4 overflow-x-auto">
          {Object.keys(SNIPPETS).map((k) => (
            <button key={k} onClick={() => setTab(k)} data-testid={`api-code-tab-${k.toLowerCase().replace(".", "")}`}
              className={`relative px-3 py-1 text-xs rounded-md transition-colors ${tab === k ? "text-white" : "text-slate-400 hover:text-slate-200"}`}>
              {tab === k && <motion.span layoutId="tabbg" className="absolute inset-0 rounded-md bg-white/10" />}
              <span className="relative">{k}</span>
            </button>
          ))}
        </div>
        <button onClick={copy} className="ml-auto text-slate-400 hover:text-white transition-colors" data-testid="api-code-copy" aria-label="Copiar código">
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="p-5 text-[11px] sm:text-[13px] leading-relaxed font-mono text-slate-200 overflow-x-auto h-[330px]">
        <code>{shown}</code><span className="inline-block w-2 h-4 bg-[#7EA6FF] align-middle animate-pulse" />
      </pre>
      <AnimatePresence>
        {shown.length === SNIPPETS[tab].length && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-5 py-3 border-t border-white/10 text-xs text-emerald-300" data-testid="api-code-status">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Factura emitida · lista para VeriFactu
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
