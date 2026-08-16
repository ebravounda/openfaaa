import { useEffect, useState } from "react";
import api, { eur } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info, Loader2 } from "lucide-react";

export default function Taxes() {
  const [data, setData] = useState(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    api.get(`/dashboard?year=${year}`).then((r) => setData(r.data));
  }, [year]);

  if (!data)
    return (
      <Layout>
        <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin" /></div>
      </Layout>
    );

  const nextQ = data.next_deadline?.quarter;

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter text-[#111111]">Impuestos</h1>
        <p className="text-sm text-[#666666] mt-1">Liquidación de IVA (Modelo 303) por trimestre · Ejercicio {data.year}</p>
      </div>

      <Card className="p-5 mb-6 bg-[#E9C46A]/10 border border-[#E9C46A]/40 rounded-md shadow-none">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-[#8a6d10] shrink-0 mt-0.5" />
          <div className="text-sm text-[#5c4a0a]">
            <strong>Modelo 303 – IVA trimestral.</strong> El IVA a pagar es el IVA repercutido (de tus facturas)
            menos el IVA soportado (de tus gastos). Se presenta el mes siguiente al fin de cada trimestre.
            Fechas límite: <strong>20 abril</strong> (1T), <strong>20 julio</strong> (2T),
            <strong> 20 octubre</strong> (3T) y <strong>30 enero</strong> (4T). Cifras orientativas.
          </div>
        </div>
      </Card>

      <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#FAFAFA]">
              <TableHead>Trimestre</TableHead>
              <TableHead className="text-right">Ingresos</TableHead>
              <TableHead className="text-right">IVA Repercutido</TableHead>
              <TableHead className="text-right">IVA Soportado</TableHead>
              <TableHead className="text-right">IVA a pagar</TableHead>
              <TableHead>Fecha límite</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.quarters.map((q) => (
              <TableRow key={q.quarter} data-testid={`tax-quarter-${q.quarter}`} className={q.quarter === nextQ ? "bg-[#0A0A0A]/[0.03]" : ""}>
                <TableCell className="font-semibold text-sm">{q.label}</TableCell>
                <TableCell className="text-right text-sm">{eur(q.ingresos)}</TableCell>
                <TableCell className="text-right text-sm">{eur(q.iva_repercutido)}</TableCell>
                <TableCell className="text-right text-sm text-[#2A9D8F]">{eur(q.iva_soportado)}</TableCell>
                <TableCell className={`text-right text-sm font-bold ${q.iva_a_pagar >= 0 ? "text-[#E63946]" : "text-[#2A9D8F]"}`}>
                  {eur(q.iva_a_pagar)}
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(q.deadline).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                </TableCell>
                <TableCell>
                  {q.quarter === nextQ && <Badge className="bg-[#0A0A0A] text-white hover:bg-[#0A0A0A] rounded-sm">Próximo</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <Card className="p-6 bg-white border border-[#E5E5E5] rounded-md shadow-none">
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#666666]">IVA repercutido anual</div>
          <div className="font-heading text-2xl font-black mt-2">{eur(data.iva_repercutido)}</div>
        </Card>
        <Card className="p-6 bg-white border border-[#E5E5E5] rounded-md shadow-none">
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#666666]">IVA soportado anual</div>
          <div className="font-heading text-2xl font-black mt-2 text-[#2A9D8F]">{eur(data.iva_soportado)}</div>
        </Card>
        <Card className="p-6 bg-white border border-[#E5E5E5] rounded-md shadow-none">
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#666666]">IRPF retenido (info)</div>
          <div className="font-heading text-2xl font-black mt-2">{eur(data.irpf_retenido)}</div>
        </Card>
      </div>
    </Layout>
  );
}
