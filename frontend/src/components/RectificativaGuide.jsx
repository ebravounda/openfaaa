import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Undo2, ChevronLeft, ChevronRight, ScrollText, ListChecks, Scale, FileWarning, CheckCircle2,
} from "lucide-react";

export const RECTIFY_GUIDE_KEY = "of_rectify_guide_dismissed";

const STEPS = [
  {
    icon: FileWarning,
    title: "¿Qué es una factura rectificativa?",
    body: (
      <div className="space-y-3">
        <p>
          Una <strong>factura rectificativa</strong> es el documento que corrige una factura ya emitida.
          En España <strong>no se pueden borrar ni modificar facturas</strong> una vez emitidas: la forma
          legal de corregir un error o anular efectos es emitir una rectificativa.
        </p>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900 mb-1">Base legal</p>
          <p>
            Artículo <strong>15 del Real Decreto 1619/2012</strong> (Reglamento de facturación) y
            artículo <strong>80 de la Ley del IVA (Ley 37/1992)</strong> para la modificación de la base imponible.
          </p>
        </div>
      </div>
    ),
  },
  {
    icon: ListChecks,
    title: "¿Cuándo debes emitir una rectificativa?",
    body: (
      <div className="space-y-3">
        <p>Debes emitir una rectificativa (y NO borrar la factura) cuando:</p>
        <ul className="space-y-2">
          {[
            "La factura original tiene un error en los datos obligatorios (NIF, importe, IVA, concepto, fecha…).",
            "Aplicaste un tipo de IVA o una cuota incorrectos.",
            "Se produce una devolución de productos o de envases y embalajes.",
            "Concedes un descuento o rappel después de haber emitido la factura.",
            "Se resuelve la operación total o parcialmente (el cliente cancela).",
            "El crédito resulta incobrable (impago), en concurso de acreedores, etc.",
          ].map((t, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-[#0052FF] shrink-0 mt-0.5" strokeWidth={1.5} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-500">
          <strong>Plazo:</strong> puedes rectificar en un plazo máximo de <strong>4 años</strong> desde el
          devengo del impuesto o desde que se produzca la circunstancia que motiva la rectificación.
        </p>
      </div>
    ),
  },
  {
    icon: ScrollText,
    title: "Qué datos debe contener (obligatorio)",
    body: (
      <div className="space-y-3">
        <p>Toda factura rectificativa debe incluir, según el RD 1619/2012:</p>
        <ul className="space-y-2 text-sm text-slate-700">
          {[
            ["Serie específica", "Debe llevar una numeración/serie propia y diferenciada (por ejemplo, serie \"R\")."],
            ["Condición de rectificativa", "Debe indicar expresamente que es una \"Factura rectificativa\"."],
            ["Referencia a la original", "Nº y fecha de la factura o facturas que se rectifican."],
            ["Motivo", "La causa que motiva la rectificación."],
            ["Rectificación", "La corrección efectuada (nuevos importes de base, IVA y total)."],
          ].map(([k, v], i) => (
            <li key={i} className="flex gap-2">
              <span className="font-medium text-slate-900 whitespace-nowrap">{k}:</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    icon: Scale,
    title: "Dos formas de rectificar",
    body: (
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="font-medium text-slate-900 mb-1">1. Por diferencias (abono)</p>
          <p className="text-sm text-slate-600">
            Refleja <strong>solo la diferencia</strong> respecto a la original (normalmente con importes negativos).
            Es la opción más habitual y la que aplica esta app al pulsar <em>«Crear rectificativa»</em>: precarga
            el cliente y las líneas en negativo para abonar total o parcialmente.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="font-medium text-slate-900 mb-1">2. Por sustitución</p>
          <p className="text-sm text-slate-600">
            Indica la <strong>rectificación completa</strong> reflejando los importes correctos de forma total,
            junto con el importe que se rectificó. Suele usarse cuando se rehace por completo la factura.
          </p>
        </div>
      </div>
    ),
  },
  {
    icon: Undo2,
    title: "Tipos R1–R5 (VeriFactu / AEAT)",
    body: (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Para VeriFactu, la AEAT clasifica las rectificativas según su causa. La app usa por defecto <strong>R1</strong>:
        </p>
        <ul className="space-y-2 text-sm text-slate-700">
          {[
            ["R1", "Error fundado en derecho y art. 80.Uno, .Dos y .Seis de la Ley del IVA (lo más común)."],
            ["R2", "Concurso de acreedores (art. 80.Tres)."],
            ["R3", "Créditos incobrables (art. 80.Cuatro)."],
            ["R4", "Resto de causas de rectificación."],
            ["R5", "Rectificación de facturas simplificadas (tickets)."],
          ].map(([k, v], i) => (
            <li key={i} className="flex gap-2">
              <Badge className="bg-slate-900 text-white hover:bg-slate-900 rounded-md font-mono text-[11px] shrink-0">{k}</Badge>
              <span>{v}</span>
            </li>
          ))}
        </ul>
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800">
          Consejo: si la factura <strong>ya la cobraste o la enviaste al cliente</strong>, emite una rectificativa
          en lugar de «Anular». La anulación de VeriFactu está pensada para registros emitidos por error.
        </div>
      </div>
    ),
  },
  {
    icon: CheckCircle2,
    title: "Cómo hacerlo en OpenFactura (paso a paso)",
    body: (
      <div className="space-y-3">
        <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
          <li>En el listado de <strong>Facturas</strong>, localiza la factura original.</li>
          <li>Pulsa el icono <span className="inline-flex items-center gap-1"><Undo2 className="w-3.5 h-3.5 text-purple-600" strokeWidth={1.5} /> <strong>«Crear rectificativa»</strong></span>.</li>
          <li>La app precarga el cliente y las líneas <strong>en negativo</strong> (abono por diferencias).</li>
          <li>Ajusta los importes: deja en negativo solo lo que quieras corregir/abonar.</li>
          <li>Revisa la serie <strong>«R»</strong> y el número, y comprueba el total.</li>
          <li>Pulsa <strong>«Emitir factura»</strong>. Se generará con la referencia a la original.</li>
          <li>Si usas VeriFactu, envíala a la AEAT desde el icono de escudo del listado.</li>
        </ol>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm text-emerald-800">
          Listo. La rectificativa queda registrada con su serie propia y se refleja correctamente (restando)
          en tus modelos 303 y 130.
        </div>
      </div>
    ),
  },
];

export default function RectificativaGuide({ open, onOpenChange, onContinue }) {
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];
  const Icon = s.icon;

  const close = (proceed) => {
    if (dontShow) {
      try { localStorage.setItem(RECTIFY_GUIDE_KEY, "1"); } catch (e) {}
    }
    onOpenChange(false);
    setStep(0);
    if (proceed && onContinue) onContinue();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(false); }}>
      <DialogContent className="max-w-lg" data-testid="rectify-guide-dialog">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-[#0052FF]">
              <Icon className="w-4 h-4" strokeWidth={1.6} />
            </span>
            {s.title}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-[240px] text-slate-700" data-testid={`rectify-guide-step-${step}`}>
          {s.body}
        </div>

        <div className="flex items-center justify-center gap-1.5 py-1">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-[#0052FF]" : "w-1.5 bg-slate-200"}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="rectify-dont-show"
            checked={dontShow}
            onCheckedChange={(v) => setDontShow(!!v)}
            data-testid="rectify-guide-dont-show"
          />
          <label htmlFor="rectify-dont-show" className="text-sm text-slate-600 cursor-pointer">No mostrar más</label>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((v) => Math.max(0, v - 1))}
            disabled={step === 0}
            className="border-slate-200"
            data-testid="rectify-guide-prev"
          >
            <ChevronLeft className="w-4 h-4 mr-1" strokeWidth={1.5} /> Anterior
          </Button>
          {isLast ? (
            <Button
              onClick={() => close(true)}
              className="bg-[#0052FF] hover:bg-[#0040CC] text-white"
              data-testid="rectify-guide-finish"
            >
              {onContinue ? "Crear rectificativa" : "Entendido"}
            </Button>
          ) : (
            <Button
              onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))}
              className="bg-[#0052FF] hover:bg-[#0040CC] text-white"
              data-testid="rectify-guide-next"
            >
              Siguiente <ChevronRight className="w-4 h-4 ml-1" strokeWidth={1.5} />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
