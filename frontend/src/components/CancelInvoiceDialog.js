import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Scale } from "lucide-react";

const HINT = {
  R2: "Requisito legal: el auto de declaración de concurso debe ser posterior al devengo y la rectificativa se emite en el plazo de 3 meses desde su publicación en el BOE.",
  R3: "Requisito legal: deben haber pasado 6 meses o 1 año desde el devengo, estar contabilizado y haber reclamado el cobro judicialmente o por requerimiento notarial. Plazo: 6 meses desde ese periodo.",
  ANULACION: "Solo si la factura NUNCA se entregó al cliente. Se registra la anulación en VeriFactu y no se emite rectificativa.",
};

export const CancelInvoiceDialog = ({ invoice, onClose, onDone }) => {
  const [reasons, setReasons] = useState([]);
  const [reason, setReason] = useState("error_datos");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/rectify-reasons").then((r) => setReasons(r.data)); }, []);
  useEffect(() => { setReason("error_datos"); setDetail(""); }, [invoice]);
  const annulled = invoice?.status === "anulada";
  const options = reasons.filter((r) => !(annulled && r.code === "ANULACION"));
  const sel = options.find((r) => r.key === reason);
  const go = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/invoices/${invoice.id}/cancel`, { reason, detail });
      if (data.mode === "anulacion") toast.success(`Factura ${invoice.number} anulada${data.verifactu ? ` · ${data.verifactu.status}` : ""}`);
      else {
        const r = data.rectificativa;
        toast.success(`Rectificativa ${r.number} (${r.code}) emitida por ${eur(r.total)}`, {
          description: [data.verifactu && `VeriFactu: ${data.verifactu}`, data.email && `Email: ${data.email}`,
            data.refund_pending && "La factura estaba cobrada: queda pendiente devolver el importe al cliente."].filter(Boolean).join(" · "),
          duration: 12000,
        });
      }
      onDone();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail), { duration: 10000 }); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl" data-testid="cancel-invoice-dialog">
        <DialogHeader>
          <DialogTitle>{annulled ? "Emitir rectificativa de" : "Anular factura"} {invoice?.number}</DialogTitle>
          <DialogDescription>Una factura emitida no se borra: el sistema emite la rectificativa por el total, la registra en VeriFactu y la envía al cliente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
          {options.map((r) => (
            <label key={r.key} className={`flex gap-3 items-start border rounded-lg p-3 cursor-pointer transition-colors ${reason === r.key ? "border-[#0052FF] bg-blue-50/50" : "border-slate-200 hover:bg-slate-50"}`} data-testid={`cancel-reason-${r.key}`}>
              <input type="radio" name="reason" checked={reason === r.key} onChange={() => setReason(r.key)} className="mt-1" />
              <div className="text-sm">
                <div className="font-medium text-slate-900">{r.label}</div>
                <div className="text-xs text-slate-500">{r.code === "ANULACION" ? "Registro de anulación" : `Rectificativa ${r.code}`} · {r.legal}</div>
              </div>
            </label>
          ))}
        </div>
        {sel && HINT[sel.code] && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex gap-2"><Scale className="w-4 h-4 shrink-0" />{HINT[sel.code]}</p>}
        <div><Label>Explicación (aparecerá en la rectificativa)</Label>
          <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} placeholder="Ej.: se facturó 2 unidades en lugar de 1" data-testid="cancel-detail" /></div>
        <Button onClick={go} disabled={busy || !reasons.length} className="bg-red-600 hover:bg-red-700 text-white" data-testid="cancel-confirm">
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{sel?.code === "ANULACION" ? "Anular factura" : "Emitir rectificativa y anular"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
