import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Server, Zap } from "lucide-react";

export const EVENTS = ["invoice.created", "invoice.verifactu.accepted", "invoice.verifactu.rejected", "invoice.verifactu.error", "client.created", "expense.created"];

export const WebhookFlow = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % EVENTS.length), 2400);
    return () => clearInterval(id);
  }, []);
  const ev = EVENTS[i];
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-10" data-testid="api-webhook-flow">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-[#0052FF] flex items-center justify-center shadow-[0_0_40px_rgba(0,82,255,0.7)]"><Zap className="w-6 h-6 text-white" /></div>
          <span className="text-xs text-slate-400">OpenFactura</span>
        </div>
        <div className="relative flex-1 h-12">
          <div className="absolute top-1/2 inset-x-0 h-px bg-gradient-to-r from-[#0052FF] via-white/20 to-emerald-400" />
          <AnimatePresence mode="wait">
            <motion.div key={ev} initial={{ left: "0%", opacity: 0 }} animate={{ left: "100%", opacity: [0, 1, 1, 0] }} transition={{ duration: 2.2, ease: "easeInOut" }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_20px_6px_rgba(126,166,255,0.8)]" />
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div key={ev + "l"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] sm:text-xs text-[#7EA6FF] whitespace-nowrap" data-testid="api-webhook-current">{ev}</motion.div>
          </AnimatePresence>
          <div className="hidden sm:block absolute -bottom-3 left-1/2 -translate-x-1/2 font-mono text-[10px] text-slate-500 whitespace-nowrap">X-OpenFactura-Signature: sha256=…</div>
        </div>
        <div className="flex flex-col items-center gap-2 shrink-0">
          <motion.div key={ev + "s"} initial={{ scale: 1 }} animate={{ scale: [1, 1, 1.12, 1] }} transition={{ duration: 2.3, times: [0, 0.85, 0.93, 1] }}
            className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center"><Server className="w-6 h-6 text-emerald-300" /></motion.div>
          <span className="text-xs text-slate-400">Tu servidor</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-10" data-testid="api-page-events">
        {EVENTS.map((e, k) => (
          <span key={e} className={`font-mono text-xs rounded-full px-3 py-1 border transition-colors duration-500 ${k === i ? "bg-[#0052FF] border-[#0052FF] text-white" : "border-white/10 text-slate-400"}`}>{e}</span>
        ))}
      </div>
    </div>
  );
};
