import { useRef, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, PenLine, Link2, Copy, Mail, MessageCircle } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";

export const SignForm = ({ onSubmit, busy, extra, submitLabel = "Confirmar entrega" }) => {
  const pad = useRef(null);
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const go = () => {
    if (name.trim().length < 2) return toast.error("Escribe el nombre de quien recibe la entrega");
    const sig = pad.current?.toDataURL();
    if (!sig) return toast.error("Falta la firma: firma dentro del recuadro");
    onSubmit({ name, dni, signature: sig });
  };
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Nombre de quien recibe</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" data-testid="sign-name" /></div>
        <div className="space-y-1.5"><Label>DNI / NIE (opcional)</Label><Input value={dni} onChange={(e) => setDni(e.target.value)} data-testid="sign-dni" /></div>
      </div>
      <div className="space-y-1.5"><Label>Firma</Label><SignaturePad ref={pad} /></div>
      {extra}
      <Button onClick={go} disabled={busy} className="w-full h-11 bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-xl" data-testid="sign-submit">
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PenLine className="w-4 h-4 mr-2" />}{submitLabel}</Button>
    </div>
  );
};

const LinkBox = ({ a }) => {
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState("");
  const create = async (email) => {
    setBusy(email ? "mail" : "link");
    try {
      const { data } = await api.post(`/albaranes/${a.id}/enlace-firma`, { email });
      setLink(data.url);
      if (email) toast.success(`Enlace enviado a ${data.emailed_to}`);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setBusy(""); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.success("Enlace copiado"); } catch { toast.message(link); } };
  const wa = `https://wa.me/?text=${encodeURIComponent(`Hola, puedes revisar y firmar el albarán ${a.number} aquí: ${link}`)}`;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3" data-testid="sign-link-box">
      <div className="text-sm font-medium text-slate-800 flex items-center gap-1.5"><Link2 className="w-4 h-4 text-[#0052FF]" /> ¿El cliente no está contigo? Envíale un enlace</div>
      {link ? (
        <div className="space-y-2">
          <Input readOnly value={link} className="text-xs bg-white" data-testid="sign-link-url" onFocus={(e) => e.target.select()} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copy} data-testid="sign-link-copy"><Copy className="w-3.5 h-3.5 mr-1" />Copiar</Button>
            <a href={wa} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" data-testid="sign-link-whatsapp"><MessageCircle className="w-3.5 h-3.5 mr-1" />WhatsApp</Button></a>
          </div>
          <p className="text-xs text-slate-500">Válido 7 días. Cuando firme, el albarán pasará a «Entregado» y recibirá el PDF firmado.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => create(false)} disabled={!!busy} data-testid="sign-link-create">{busy === "link" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Link2 className="w-3.5 h-3.5 mr-1" />}Crear enlace</Button>
          <Button size="sm" variant="outline" onClick={() => create(true)} disabled={!!busy || !a.client?.email} data-testid="sign-link-email">{busy === "mail" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1" />}Enviar por email{!a.client?.email ? " (sin email)" : ""}</Button>
        </div>
      )}
    </div>
  );
};

export const SignAlbaranDialog = ({ a, onClose, onDone }) => {
  const [busy, setBusy] = useState(false);
  const [send, setSend] = useState(true);
  const submit = async (body) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/albaranes/${a.id}/firmar`, { ...body, send_email: send });
      toast.success(data.emailed_to ? `Entrega firmada · PDF enviado a ${data.emailed_to}` : "Entrega firmada");
      onDone();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto" data-testid="sign-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Firmar entrega · {a?.number}</DialogTitle>
          <DialogDescription>Pasa el móvil o la tablet a {a?.client?.name || "tu cliente"} para que firme la recepción.</DialogDescription>
        </DialogHeader>
        {a && <SignForm busy={busy} onSubmit={submit} extra={a.client?.email && (
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><Checkbox checked={send} onCheckedChange={(v) => setSend(!!v)} data-testid="sign-send-email" /> Enviar el PDF firmado a {a.client.email}</label>
        )} />}
        {a && <LinkBox a={a} />}
      </DialogContent>
    </Dialog>
  );
};
