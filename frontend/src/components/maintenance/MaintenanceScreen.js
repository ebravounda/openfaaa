import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wrench, Clock, RefreshCw } from "lucide-react";

const pad = (n) => String(n).padStart(2, "0");

const useCountdown = (until) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = until ? new Date(until).getTime() : NaN;
  if (!target || Number.isNaN(target) || target <= now) return null;
  const s = Math.floor((target - now) / 1000);
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
};

const Blob = ({ className, delay }) => (
  <motion.div
    className={`absolute rounded-full blur-3xl opacity-40 ${className}`}
    animate={{ x: [0, 60, -40, 0], y: [0, -50, 30, 0], scale: [1, 1.15, 0.9, 1] }}
    transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay }}
  />
);

const Countdown = ({ until }) => {
  const c = useCountdown(until);
  const when = until ? new Date(until) : null;
  if (!when || Number.isNaN(when.getTime())) return null;
  return (
    <div className="mt-8" data-testid="maintenance-countdown">
      <div className="flex items-center gap-2 text-sm text-slate-400"><Clock className="w-4 h-4" /> Volvemos el {when.toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}</div>
      {c && (
        <div className="mt-4 flex gap-3">
          {[["h", "horas"], ["m", "min"], ["s", "seg"]].map(([k, l]) => (
            <div key={k} className="w-20 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md py-3 text-center">
              <motion.div key={c[k]} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-mono text-3xl text-white">{pad(c[k])}</motion.div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">{l}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const MaintenanceScreen = ({ message, until }) => (
  <div className="fixed inset-0 z-[9999] overflow-hidden bg-[#070B18] text-white flex items-center" data-testid="maintenance-screen">
    <Blob className="w-[520px] h-[520px] bg-[#0052FF] -top-40 -left-32" delay={0} />
    <Blob className="w-[420px] h-[420px] bg-cyan-500 bottom-[-120px] right-[-80px]" delay={3} />
    <Blob className="w-[300px] h-[300px] bg-indigo-500 top-1/3 right-1/4" delay={6} />
    <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
    <div className="relative w-full max-w-5xl mx-auto px-6 sm:px-12">
      <motion.img src="/openfactura-logo-white.png" alt="OpenFactura" className="h-7 w-auto mb-14" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} />
      <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 120 }}
        className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center mb-8">
        <motion.div animate={{ rotate: [0, -25, 15, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
          <Wrench className="w-8 h-8 text-cyan-300" strokeWidth={1.5} />
        </motion.div>
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="font-[Outfit] text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]" data-testid="maintenance-title">
        Estamos en mantenimiento.<br /><span className="bg-gradient-to-r from-cyan-300 to-[#5B8CFF] bg-clip-text text-transparent">Volvemos pronto.</span>
      </motion.h1>
      <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="mt-6 max-w-xl text-base md:text-lg text-slate-300 whitespace-pre-line" data-testid="maintenance-message">
        {message || "Estamos mejorando OpenFactura para ti. Tus datos están a salvo y en unos minutos todo volverá a funcionar."}
      </motion.p>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
        <Countdown until={until} />
        <div className="mt-10 h-1 w-full max-w-md rounded-full bg-white/10 overflow-hidden">
          <motion.div className="h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-400 to-[#0052FF]"
            animate={{ x: ["-100%", "300%"] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><RefreshCw className="w-3.5 h-3.5 animate-spin [animation-duration:3s]" /> Esta página se actualizará sola cuando volvamos.</div>
      </motion.div>
    </div>
  </div>
);
