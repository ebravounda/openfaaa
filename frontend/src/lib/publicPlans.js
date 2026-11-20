import { useEffect, useState } from "react";
import axios from "axios";
import { API } from "@/lib/api";

export const fmtPrice = (n) => `${Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}€`;
export const invoicesText = (p) => (p.max_invoices == null ? "Facturas ilimitadas" : `Hasta ${p.max_invoices} facturas al mes`);
export const companiesText = (p) => `Hasta ${p.max_companies} empresas y autónomos`;

// Planes reales configurados por el super admin (precios y límites)
export function usePublicPlans() {
  const [plans, setPlans] = useState({});
  useEffect(() => {
    axios.get(`${API}/public/plans`).then((r) => setPlans(Object.fromEntries(r.data.map((p) => [p.id, p])))).catch(() => {});
  }, []);
  return plans;
}

// Sustituye precio y textos de límites del plan estático por los valores reales
export function applyLive(p, live) {
  if (!live) return p;
  const features = p.features.map((f) => {
    if (/facturas al mes|facturas ilimitadas/i.test(f)) return invoicesText(live);
    if (/empresas y autónomos/i.test(f)) return companiesText(live);
    return f;
  });
  return { ...p, name: live.name || p.name, price: fmtPrice(live.price), features };
}
