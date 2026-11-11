import { useState } from "react";
import { Globe2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { CountryCombobox } from "@/components/CountryCombobox";
import { isExtraEU, looksSpanishId, countryName } from "@/lib/countries";

// País + aviso «¿VAT extracomunitario?» bajo el NIF del cliente.
export const ClientCountryField = ({ country, nif, onChange, testid = "client-country" }) => {
  const [open, setOpen] = useState(false);
  const c = country || "ES";
  const foreign = isExtraEU(c);
  const suggest = c === "ES" && (nif || "").trim().length >= 5 && !looksSpanishId(nif);
  return (
    <div className="space-y-2 sm:col-span-2">
      <Label>País del cliente</Label>
      <div className="max-w-xs"><CountryCombobox value={c} onChange={onChange} testid={testid} open={open} onOpenChange={setOpen} /></div>
      {suggest && (
        <div className="text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-800 p-2 flex items-start gap-2" data-testid={`${testid}-suggest`}>
          <Globe2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>No parece un NIF, CIF, NIE o DNI español. ¿Deseas agregar un <b>VAT extracomunitario</b> (por ejemplo, un RUT de Chile)?{" "}
            <button type="button" className="underline font-medium" onClick={() => setOpen(true)} data-testid={`${testid}-suggest-yes`}>Sí, elegir país</button>
          </span>
        </div>
      )}
      {foreign && (
        <div className="text-xs rounded-md border border-blue-100 bg-blue-50 text-slate-700 p-2 flex items-start gap-2" data-testid={`${testid}-foreign-note`}>
          <Globe2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0052FF]" />
          <span>Cliente de <b>{countryName(c)}</b>, fuera de la UE: la factura queda <b>sin IVA</b> (servicio no sujeto, art. 69 LIVA) y sin IRPF.</span>
        </div>
      )}
    </div>
  );
};
