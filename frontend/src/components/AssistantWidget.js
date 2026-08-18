import { useState, useRef, useEffect } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, X, Send, Loader2 } from "lucide-react";

export const AssistantWidget = () => {
  const [open, setOpen] = useState(false);
  const [sessionId] = useState(() => `assist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "¡Hola! Soy FiscalBot. Puedo ayudarte a crear facturas y con dudas de IVA, IRPF y VeriFactu. ¿En qué te ayudo?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const { data } = await api.post("/assistant/chat", { message: text, session_id: sessionId });
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: formatApiErrorDetail(e.response?.data?.detail) || "Ahora mismo no puedo responder. Inténtalo de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} data-testid="assistant-fab"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-full pl-4 pr-5 py-3 shadow-lg transition-colors">
          <Sparkles className="w-5 h-5" strokeWidth={1.5} /> <span className="text-sm font-medium">Asistente</span>
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-3rem)] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden" data-testid="assistant-panel">
          <div className="flex items-center justify-between px-4 py-3 bg-[#0052FF] text-white">
            <div className="flex items-center gap-2 font-medium"><Sparkles className="w-4 h-4" strokeWidth={1.5} /> FiscalBot</div>
            <button onClick={() => setOpen(false)} data-testid="assistant-close" className="hover:opacity-80"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-[#0052FF] text-white" : "bg-white border border-slate-200 text-slate-700"}`}>{m.text}</div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-white border border-slate-200 rounded-2xl px-3 py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div></div>}
            <div ref={endRef} />
          </div>
          <div className="p-3 border-t border-slate-100 flex items-center gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Escribe tu duda…" data-testid="assistant-input" />
            <Button onClick={send} disabled={loading || !input.trim()} size="icon" className="bg-[#0052FF] hover:bg-[#0040CC] text-white shrink-0" data-testid="assistant-send"><Send className="w-4 h-4" strokeWidth={1.5} /></Button>
          </div>
        </div>
      )}
    </>
  );
};
