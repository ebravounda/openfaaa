import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api, { API, eur } from "@/lib/api";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Info, FileSpreadsheet, FileText } from "lucide-react";

const fmtDate = (d) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

export default function Taxes() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [years, setYears] = useState([new Date().getFullYear()]);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => { api.get("/available-years").then((r) => setYears(r.data)); }, []);
  useEffect(() => { setData(null); api.get(`/dashboard?year=${year}`).then((r) => setData(r.data)); }, [year]);

  const isAutonomo = (data?.tax_type || user?.tax_type) === "autonomo";
  const nextQ = data?.next_deadline?.quarter;
  const exportLibros = (format) => window.open(`${API}/export/libros?year=${year}&format=${format}`, "_blank");

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Impuestos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Liquidaciones trimestrales según el calendario de Hacienda</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => exportLibros("xlsx")} className="border-slate-200 text-slate-700" data-testid="export-xlsx">
            <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" strokeWidth={1.5} /> Excel
          </Button>
          <Button variant="outline" onClick={() => exportLibros("csv")} className="border-slate-200 text-slate-700" data-testid="export-csv">
            <FileText className="w-4 h-4 mr-2 text-slate-500" strokeWidth={1.5} /> CSV
          </Button>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[130px] bg-white" data-testid="tax-year-select"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>Ejercicio {y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {!data ? (
        <div className="space-y-4"><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-64 rounded-lg" /></div>
      ) : (
        <>
          <div className="flex gap-3 p-4 mb-6 bg-blue-50 border border-blue-100 rounded-lg">
            <Info className="w-5 h-5 text-[#0052FF] shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="text-sm text-slate-600">
              <strong className="text-slate-900">Modelo 303 (IVA):</strong> IVA repercutido − IVA soportado, cada trimestre.
              Fechas límite: 20 abril, 20 julio, 20 octubre y 30 enero.
              {isAutonomo && <> <strong className="text-slate-900">Modelo 130 (IRPF):</strong> 20% del rendimiento neto acumulado menos retenciones y pagos previos.</>}
              {" "}Cifras orientativas.
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900">Modelo 303 · IVA</h2>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden mb-8">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
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
                  <TableRow key={q.quarter} data-testid={`tax-quarter-${q.quarter}`} className={q.quarter === nextQ ? "bg-blue-50/40" : ""}>
                    <TableCell className="font-medium">{q.label}</TableCell>
                    <TableCell className="text-right tabular">{eur(q.ingresos)}</TableCell>
                    <TableCell className="text-right tabular">{eur(q.iva_repercutido)}</TableCell>
                    <TableCell className="text-right tabular text-slate-500">{eur(q.iva_soportado)}</TableCell>
                    <TableCell className={`text-right tabular font-semibold ${q.iva_a_pagar >= 0 ? "text-red-600" : "text-emerald-600"}`}>{eur(q.iva_a_pagar)}</TableCell>
                    <TableCell className="text-sm text-slate-600">{fmtDate(q.deadline)}</TableCell>
                    <TableCell>{q.quarter === nextQ && <Badge className="bg-[#0052FF] hover:bg-[#0052FF] text-white rounded-full">Próximo</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {isAutonomo && (
            <>
              <div className="mb-3">
                <h2 className="font-display text-lg font-semibold text-slate-900">Modelo 130 · IRPF (pagos fraccionados)</h2>
                <p className="text-sm text-slate-500 mt-0.5">Solo para autónomos en estimación directa</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden" data-testid="modelo-130-table">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Trimestre</TableHead>
                      <TableHead className="text-right">Rendimiento acumulado</TableHead>
                      <TableHead className="text-right">IRPF retenido (acum.)</TableHead>
                      <TableHead className="text-right">Pago fraccionado (20%)</TableHead>
                      <TableHead>Fecha límite</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.modelo_130.map((m) => (
                      <TableRow key={m.quarter} data-testid={`m130-quarter-${m.quarter}`}>
                        <TableCell className="font-medium">{m.label}</TableCell>
                        <TableCell className="text-right tabular">{eur(m.rendimiento_acumulado)}</TableCell>
                        <TableCell className="text-right tabular text-slate-500">{eur(m.irpf_retenido_acumulado)}</TableCell>
                        <TableCell className="text-right tabular font-semibold text-amber-600">{eur(m.pago_fraccionado)}</TableCell>
                        <TableCell className="text-sm text-slate-600">{fmtDate(m.deadline)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-slate-400 mt-3">Total pagos fraccionados IRPF del ejercicio: <strong className="text-slate-600 tabular">{eur(data.modelo_130_total)}</strong></p>
            </>
          )}
        </>
      )}
    </Layout>
  );
}
