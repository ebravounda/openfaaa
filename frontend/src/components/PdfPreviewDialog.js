import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Loader2 } from "lucide-react";

// Vista previa de un PDF. `load` devuelve una promesa con el Blob del PDF.
export const PdfPreviewDialog = ({ open, title, load, filename, onClose }) => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!open) return undefined;
    let u = "";
    setUrl("");
    load().then((blob) => { u = URL.createObjectURL(new Blob([blob], { type: "application/pdf" })); setUrl(u); })
      .catch(async (e) => {
        let d = e.response?.data;
        if (d instanceof Blob) { try { d = JSON.parse(await d.text()); } catch { d = {}; } }
        toast.error(formatApiErrorDetail(d?.detail) || "No se pudo generar la vista previa"); onClose();
      });
    return () => { if (u) URL.revokeObjectURL(u); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-4 sm:p-6" data-testid="pdf-preview-dialog">
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 pr-8">
          <DialogTitle className="font-display truncate">{title}</DialogTitle>
          {url && <a href={url} download={filename}><Button size="sm" variant="outline" data-testid="pdf-preview-download"><Download className="w-4 h-4 mr-1.5" />Descargar</Button></a>}
        </DialogHeader>
        <div className="flex-1 min-h-0 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
          {url ? <iframe src={url} title={title} className="w-full h-full" data-testid="pdf-preview-frame" />
            : <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
};
