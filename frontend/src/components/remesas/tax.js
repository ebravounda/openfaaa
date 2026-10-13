const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;

// El importe del recibo es el TOTAL con IVA incluido; mismo cálculo que el servidor.
export const lineTax = (l) => {
  const total = r2(l.amount);
  const rate = l.vat_exempt ? 0 : Number(l.iva_rate ?? 21) || 0;
  let base = r2(total / (1 + rate / 100));
  for (const d of [0, 0.01, -0.01, 0.02, -0.02]) {
    const b = r2(base + d);
    if (r2(b + r2((b * rate) / 100)) === total) { base = b; break; }
  }
  return { base, iva: r2(total - base), total, rate };
};
