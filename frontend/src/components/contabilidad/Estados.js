import { Fragment, useState } from "react";
import { Box, ExportBtn, Loading, Th, Td, Num, useFetch } from "./shared";
import { CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";

const Line = ({ l }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-t border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => setOpen(!open)}>
        <Td className="pl-6 text-slate-700"><ChevronRight className={`inline w-3 h-3 mr-1 transition-transform ${open ? "rotate-90" : ""} ${l.detail?.length ? "" : "invisible"}`} />{l.label}</Td>
        <Td right><Num v={l.amount} /></Td>
      </tr>
      {open && (l.detail || []).map((d) => (
        <tr key={d.account} className="text-xs text-slate-500"><Td className="pl-12"><span className="font-mono">{d.account}</span> {d.name}</Td><Td right><Num v={d.amount} /></Td></tr>
      ))}
    </>
  );
};

const Side = ({ title, side, testid }) => (
  <Box className="overflow-hidden" data-testid={testid}>
    <table className="w-full text-sm">
      <thead className="bg-slate-50"><tr><Th>{title}</Th><Th right>Importe</Th></tr></thead>
      <tbody>
        {side.sections.map((s) => (
          <Fragment key={s.label}>
            <tr className="border-t border-slate-200 bg-slate-50/50 font-semibold"><Td>{s.label}</Td><Td right><Num v={s.amount} /></Td></tr>
            {s.lines.map((l) => <Line key={s.label + l.label} l={l} />)}
          </Fragment>
        ))}
        <tr className="border-t-2 border-slate-300 font-bold"><Td>TOTAL {title}</Td><Td right><Num v={side.total} /></Td></tr>
      </tbody>
    </table>
  </Box>
);

export const Balance = ({ year }) => {
  const [d] = useFetch(`/contabilidad/balance?year=${year}`);
  if (!d) return <Loading />;
  return (
    <div className="space-y-4" data-testid="balance-situacion">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">Balance de situación a 31/12/{year} · {d.modelo}</div>
        <div className="flex items-center gap-3">
          {d.cuadra ? <span className="text-emerald-700 text-sm flex items-center gap-1" data-testid="balance-cuadra"><CheckCircle2 className="w-4 h-4" /> Cuadra</span>
            : <span className="text-red-600 text-sm flex items-center gap-1" data-testid="balance-descuadre"><AlertTriangle className="w-4 h-4" /> Descuadre</span>}
          <ExportBtn libro="balance" year={year} />
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Side title="ACTIVO" side={d.activo} testid="balance-activo" />
        <Side title="PATRIMONIO NETO Y PASIVO" side={d.pasivo} testid="balance-pasivo" />
      </div>
    </div>
  );
};

export const Pyg = ({ year }) => {
  const [d] = useFetch(`/contabilidad/pyg?year=${year}`);
  if (!d) return <Loading />;
  return (
    <Box className="overflow-hidden" data-testid="pyg">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <span className="text-sm">Cuenta de pérdidas y ganancias {year} · Resultado <Num v={d.result} className="font-bold" /></span>
        <ExportBtn libro="pyg" year={year} />
      </div>
      <table className="w-full text-sm"><tbody>
        {d.rows.map((r) => r.total
          ? <tr key={r.label} className="border-t-2 border-slate-200 bg-slate-50 font-bold"><Td>{r.label}</Td><Td right><Num v={r.amount} /></Td></tr>
          : <Line key={r.label} l={r} />)}
      </tbody></table>
    </Box>
  );
};

export const Volumen = ({ year }) => {
  const [d] = useFetch(`/contabilidad/volumen?year=${year}`);
  if (!d) return <Loading />;
  const Party = ({ title, rows, testid }) => (
    <Box className="overflow-x-auto" data-testid={testid}>
      <div className="p-3 border-b border-slate-100 text-sm font-semibold">{title}</div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50"><tr><Th>Nombre</Th><Th>NIF</Th><Th right>Docs</Th><Th right>Base</Th><Th right>Total</Th><Th>347</Th></tr></thead>
        <tbody>{rows.slice(0, 50).map((r, i) => (
          <tr key={i} className="border-t border-slate-100"><Td>{r.name}</Td><Td className="text-slate-500">{r.nif}</Td><Td right>{r.count}</Td><Td right><Num v={r.base} /></Td><Td right><Num v={r.total} /></Td>
            <Td>{r.modelo_347 && <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">Declarar</span>}</Td></tr>
        ))}</tbody>
      </table>
    </Box>
  );
  return (
    <div className="space-y-4" data-testid="volumen">
      <Box className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><Th>Trimestre</Th><Th right>Facturas</Th><Th right>Ventas (base)</Th><Th right>IVA repercutido</Th><Th right>Gastos</Th><Th right>Compras (base)</Th><Th right>IVA soportado</Th></tr></thead>
          <tbody>
            {d.quarters.map((q) => (
              <tr key={q.q} className="border-t border-slate-100"><Td className="font-semibold">{q.q}</Td><Td right>{q.facturas}</Td><Td right><Num v={q.ventas} /></Td><Td right><Num v={q.iva_repercutido} /></Td>
                <Td right>{q.gastos}</Td><Td right><Num v={q.compras} /></Td><Td right><Num v={q.iva_soportado} /></Td></tr>
            ))}
            <tr className="border-t-2 border-slate-300 font-bold"><Td>Año {year}</Td><Td /><Td right><Num v={d.ventas} /></Td><Td /><Td /><Td right><Num v={d.compras} /></Td><Td /></tr>
          </tbody>
        </table>
      </Box>
      <p className="text-xs text-slate-500">Las operaciones con un mismo cliente o proveedor de más de 3.005,06 € al año (IVA incluido) deben declararse en el modelo 347.</p>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Party title="Volumen por cliente" rows={d.clientes} testid="volumen-clientes" />
        <Party title="Volumen por proveedor" rows={d.proveedores} testid="volumen-proveedores" />
      </div>
    </div>
  );
};
