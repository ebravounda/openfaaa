import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import axios from "axios";
import { CheckCircle2, FileText, Loader2, Truck } from "lucide-react";
import { SignForm } from "@/components/albaranes/SignAlbaranDialog";
import { eur } from "@/lib/api";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/public/albaran-firma`;

export default function FirmarAlbaran() {
  const { token } = useParams();
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [sendErr, setSendErr] = useState("");
  useEffect(() => {
    axios.get(`${API}/${token}`).then((r) => setA(r.data)).catch((e) => setErr(e.response?.data?.detail || "No se ha podido cargar el albarán."));
  }, [token]);
  const submit = async (body) => {
    setBusy(true); setSendErr("");
    try { const { data } = await axios.post(`${API}/${token}`, body); setDone(data); }
    catch (e) { setSendErr(e.response?.data?.detail || "No se ha podido firmar. Inténtalo de nuevo."); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-[#F8FAFC] font-outfit text-slate-900">
      <Helmet><title>Firmar albarán | OpenFactura</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
        {!a && !err && <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>}
        {err && <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center" data-testid="public-sign-error"><Truck className="w-10 h-10 mx-auto text-slate-300" /><p className="mt-4 text-slate-600">{err}</p></div>}
        {a && done && (
          <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center" data-testid="public-sign-success">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
            <h1 className="text-2xl font-bold mt-4">¡Gracias! Entrega confirmada</h1>
            <p className="text-slate-600 mt-2">Has firmado el albarán {a.number} de {a.company}.{done.emailed_to ? ` Te hemos enviado una copia a ${done.emailed_to}.` : ""}</p>
          </div>
        )}
        {a && !done && (
          <div className="space-y-5" data-testid="public-sign-page">
            <div>
              <div className="text-sm text-slate-500">{a.company}</div>
              <h1 className="text-3xl font-extrabold tracking-tight">Albarán {a.number}</h1>
              <p className="text-slate-500 mt-1 text-sm">Para {a.client_name}{a.delivery_date ? ` · entrega ${a.delivery_date}` : ""}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <ul className="divide-y divide-slate-100" data-testid="public-sign-lines">
                {a.lines.map((l, i) => (
                  <li key={i} className="px-4 py-3 flex justify-between gap-3 text-sm">
                    <span><span className="font-medium">{l.description}</span>{l.detail && <span className="block text-xs text-slate-400">{l.detail}</span>}</span>
                    <span className="text-right whitespace-nowrap text-slate-600">× {l.quantity}{a.show_prices && <span className="block font-medium text-slate-900">{eur(l.amount)}</span>}</span>
                  </li>
                ))}
              </ul>
              {a.show_prices && <div className="px-4 py-3 bg-slate-50 flex justify-between text-sm font-semibold"><span>Total (IVA incl.)</span><span data-testid="public-sign-total">{eur(a.total)}</span></div>}
              {a.delivery_address && <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">Entrega en: {a.delivery_address}</div>}
            </div>
            <a href={`${API}/${token}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#0052FF] font-medium" data-testid="public-sign-pdf"><FileText className="w-4 h-4" /> Ver el albarán en PDF</a>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-bold mb-1">Confirma la recepción</h2>
              <p className="text-sm text-slate-500 mb-4">Al firmar confirmas que has recibido la mercancía o el servicio descrito.</p>
              <SignForm busy={busy} onSubmit={submit} submitLabel="Firmar y confirmar recepción" extra={sendErr && <div className="text-sm text-red-600" data-testid="public-sign-submit-error">{sendErr}</div>} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
