import { useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Check, X, Sparkles, AlertTriangle, Infinity as InfinityIcon } from "lucide-react";

const FEATURES = [
  { key: "email", label: "Envío de facturas por email" },
  { key: "ocr", label: "Escaneo de recibos con IA (OCR)" },
  { key: "verifactu", label: "VeriFactu AEAT" },
];

function limitText(v) {
  return v === null || v === undefined ? "Ilimitadas" : v;
}

export default function Pricing() {
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/plans"), api.get("/plan")])
      .then(([pl, mine]) => {
        setPlans(pl.data);
        setCurrent(mine.data.plan);
        setUsage(mine.data.usage);
      })
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = current?.id === "admin";
  const invLimit = current?.max_invoices;
  const conLimit = current?.max_contacts;
  const invReached = invLimit != null && (usage?.invoices_month ?? 0) >= invLimit;
  const conReached = conLimit != null && (usage?.contacts ?? 0) >= conLimit;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-slate-900">Planes y precios</h1>
        <p className="text-sm text-slate-500 mt-0.5">Elige el plan que mejor se adapta a tu negocio</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80 rounded-lg" />)}</div>
      ) : (
        <>
          {(invReached || conReached) && (
            <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4" data-testid="limit-warning">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="text-sm text-amber-800">
                <strong>Has alcanzado el límite de tu plan {current?.name}.</strong>{" "}
                {invReached && `Facturas este mes: ${usage.invoices_month}/${invLimit}. `}
                {conReached && `Contactos: ${usage.contacts}/${conLimit}. `}
                Mejora tu plan para seguir emitiendo sin límites.
              </div>
            </div>
          )}

          {!isAdmin && usage && (
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl" data-testid="usage-panel">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">Facturas este mes</span>
                  <span className="font-medium tabular">{usage.invoices_month} / {limitText(invLimit)}</span>
                </div>
                <Progress value={invLimit ? Math.min(100, (usage.invoices_month / invLimit) * 100) : 8} className={invReached ? "[&>div]:bg-amber-500" : ""} />
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">Contactos</span>
                  <span className="font-medium tabular">{usage.contacts} / {limitText(conLimit)}</span>
                </div>
                <Progress value={conLimit ? Math.min(100, (usage.contacts / conLimit) * 100) : 8} className={conReached ? "[&>div]:bg-amber-500" : ""} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map((p) => {
              const isCurrent = current?.id === p.id;
              const popular = p.id === "medio";
              return (
                <div key={p.id} data-testid={`pricing-card-${p.id}`}
                  className={`relative bg-white rounded-xl border p-6 flex flex-col ${isCurrent ? "border-[#0052FF] ring-2 ring-[#0052FF]/20" : "border-slate-200"}`}>
                  {popular && !isCurrent && (
                    <div className="absolute -top-3 left-6 bg-[#0052FF] text-white text-[11px] font-medium px-3 py-1 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" strokeWidth={2} /> Más popular
                    </div>
                  )}
                  {isCurrent && (
                    <Badge className="absolute -top-3 left-6 bg-[#0052FF] text-white hover:bg-[#0052FF] rounded-full">Tu plan actual</Badge>
                  )}
                  <div className="font-display text-lg font-semibold text-slate-900">{p.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-semibold tracking-tight tabular">{p.price === 0 ? "Gratis" : `${Number(p.price).toFixed(2)}€`}</span>
                    {p.price > 0 && <span className="text-sm text-slate-400">/mes</span>}
                  </div>

                  <div className="mt-5 space-y-2.5 text-sm flex-1">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={2} />
                      {p.max_invoices == null ? <span className="flex items-center gap-1"><InfinityIcon className="w-3.5 h-3.5" /> Facturas ilimitadas</span> : <span><strong>{p.max_invoices}</strong> facturas/mes</span>}
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={2} />
                      {p.max_contacts == null ? <span className="flex items-center gap-1"><InfinityIcon className="w-3.5 h-3.5" /> Contactos ilimitados</span> : <span><strong>{p.max_contacts}</strong> contactos</span>}
                    </div>
                    {FEATURES.map((f) => (
                      <div key={f.key} className={`flex items-center gap-2 ${p.features?.[f.key] ? "text-slate-700" : "text-slate-400"}`}>
                        {p.features?.[f.key]
                          ? <Check className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={2} />
                          : <X className="w-4 h-4 text-slate-300 shrink-0" strokeWidth={2} />}
                        {f.label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    {isCurrent ? (
                      <div className="text-center text-sm text-[#0052FF] font-medium py-2.5 bg-[#0052FF]/5 rounded-lg" data-testid={`current-badge-${p.id}`}>Plan activo</div>
                    ) : (
                      <div className="text-center text-sm text-slate-500 py-2.5 border border-dashed border-slate-200 rounded-lg" data-testid={`upgrade-note-${p.id}`}>
                        Contacta con soporte para cambiar de plan
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Layout>
  );
}
