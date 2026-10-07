import { useState } from "react";
import { Box, ExportBtn, Loading, SearchBox, Th, Td, Num, useFetch } from "./shared";

const SRC = { factura: "Factura", cobro: "Cobro", gasto: "Gasto", pago: "Pago", nomina: "Nómina", amortizacion: "Amortización", inmovilizado: "Inmovilizado", manual: "Manual" };

export const Diario = ({ year }) => {
  const [d] = useFetch(`/contabilidad/diario?year=${year}`);
  const [q, setQ] = useState("");
  if (!d) return <Loading />;
  const t = q.toLowerCase();
  const rows = (d.entries || []).filter((e) => !t || e.concept.toLowerCase().includes(t) || e.lines.some((l) => l.account.startsWith(t)));
  return (
    <Box data-testid="libro-diario">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100">
        <div className="text-sm text-slate-600">{rows.length} asientos · Debe <b className="tabular">{d.debe?.toLocaleString("es-ES")} €</b> · Haber <b className="tabular">{d.haber?.toLocaleString("es-ES")} €</b></div>
        <div className="flex gap-2"><SearchBox value={q} onChange={setQ} placeholder="Concepto o cuenta" testid="diario-search" /><ExportBtn libro="diario" year={year} /></div>
      </div>
      <div className="overflow-x-auto max-h-[65vh]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0"><tr><Th>Nº</Th><Th>Fecha</Th><Th>Cuenta</Th><Th>Concepto</Th><Th right>Debe</Th><Th right>Haber</Th></tr></thead>
          <tbody>
            {rows.map((e) => e.lines.map((l, i) => (
              <tr key={`${e.number}-${i}`} className={i === 0 ? "border-t border-slate-200" : ""}>
                <Td className="text-slate-400">{i === 0 ? e.number : ""}</Td>
                <Td className="text-slate-500 whitespace-nowrap">{i === 0 ? e.date : ""}</Td>
                <Td><span className="font-mono text-xs text-[#0052FF]">{l.account}</span> <span className="text-slate-500 text-xs">{l.name}</span></Td>
                <Td className="text-slate-700">{i === 0 ? <>{e.concept} <span className="text-[10px] uppercase text-slate-400 ml-1">{SRC[e.source]}</span></> : ""}</Td>
                <Td right><Num v={l.debe} /></Td><Td right><Num v={l.haber} /></Td>
              </tr>
            )))}
          </tbody>
        </table>
        {!rows.length && <div className="text-center text-slate-400 py-12 text-sm">No hay asientos en {year}.</div>}
      </div>
    </Box>
  );
};

export const Mayor = ({ year }) => {
  const [list] = useFetch(`/contabilidad/mayor?year=${year}`);
  const [acc, setAcc] = useState("");
  const [d] = useFetch(acc ? `/contabilidad/mayor?year=${year}&account=${acc}` : `/contabilidad/config`);
  if (!list) return <Loading />;
  return (
    <div className="grid lg:grid-cols-3 gap-4" data-testid="libro-mayor">
      <Box className="max-h-[70vh] overflow-y-auto">
        <div className="p-3 border-b border-slate-100 flex justify-between items-center"><span className="text-sm font-semibold">Cuentas</span><ExportBtn libro="mayor" year={year} /></div>
        {(list.accounts || []).map((a) => (
          <button key={a.account} onClick={() => setAcc(a.account)} data-testid={`mayor-acc-${a.account}`}
            className={`w-full text-left px-3 py-2 text-sm flex justify-between gap-2 border-b border-slate-50 transition-colors ${acc === a.account ? "bg-blue-50" : "hover:bg-slate-50"}`}>
            <span><span className="font-mono text-xs text-[#0052FF]">{a.account}</span> <span className="text-slate-600">{a.name}</span></span>
            <Num v={a.saldo_deudor - a.saldo_acreedor} className="text-xs" />
          </button>
        ))}
      </Box>
      <Box className="lg:col-span-2 overflow-x-auto">
        {!acc ? <div className="text-center text-slate-400 py-16 text-sm">Elige una cuenta para ver sus movimientos.</div> : !d?.moves ? <Loading /> : (
          <>
            <div className="p-4 border-b border-slate-100 text-sm"><b className="font-mono">{d.account}</b> · {d.name} · Saldo <Num v={d.saldo} className="font-semibold" /></div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><Th>Fecha</Th><Th>Asiento</Th><Th>Concepto</Th><Th right>Debe</Th><Th right>Haber</Th><Th right>Saldo</Th></tr></thead>
              <tbody>{d.moves.map((m, i) => (
                <tr key={i} className="border-t border-slate-100"><Td className="text-slate-500">{m.date}</Td><Td className="text-slate-400">{m.number}</Td><Td>{m.concept}</Td>
                  <Td right><Num v={m.debe} /></Td><Td right><Num v={m.haber} /></Td><Td right><Num v={m.saldo} className="font-medium" /></Td></tr>
              ))}</tbody>
            </table>
          </>
        )}
      </Box>
    </div>
  );
};

export const SumasSaldos = ({ year }) => {
  const [d] = useFetch(`/contabilidad/sumas-saldos?year=${year}`);
  if (!d) return <Loading />;
  return (
    <Box className="overflow-x-auto" data-testid="sumas-saldos">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center"><span className="text-sm font-semibold">Balance de sumas y saldos {year}</span><ExportBtn libro="sumas" year={year} /></div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50"><tr><Th>Cuenta</Th><Th>Descripción</Th><Th right>Debe</Th><Th right>Haber</Th><Th right>Saldo deudor</Th><Th right>Saldo acreedor</Th></tr></thead>
        <tbody>
          {(d.rows || []).map((r) => (
            <tr key={r.account} className="border-t border-slate-100"><Td className="font-mono text-xs text-[#0052FF]">{r.account}</Td><Td>{r.name}</Td>
              <Td right><Num v={r.debe} /></Td><Td right><Num v={r.haber} /></Td><Td right><Num v={r.saldo_deudor} /></Td><Td right><Num v={r.saldo_acreedor} /></Td></tr>
          ))}
          {d.totals && <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50"><Td /><Td>Totales</Td>
            <Td right><Num v={d.totals.debe} /></Td><Td right><Num v={d.totals.haber} /></Td><Td right><Num v={d.totals.saldo_deudor} /></Td><Td right><Num v={d.totals.saldo_acreedor} /></Td></tr>}
        </tbody>
      </table>
    </Box>
  );
};
