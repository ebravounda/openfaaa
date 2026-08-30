import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const ActiveCompanyBanner = ({ context }) => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  useEffect(() => {
    api.get("/companies").then((r) => setCompanies(r.data)).catch(() => {});
  }, []);
  if (!user) return null;
  if (!(user.multi_company_enabled || companies.length > 1)) return null;
  const active = companies.find((c) => c.id === user.active_company_id) || companies[0];
  if (!active) return null;
  return (
    <div
      className="mb-5 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
      data-testid="active-company-banner"
    >
      <Building2 className="w-4 h-4 mt-0.5 shrink-0 text-[#0052FF]" strokeWidth={1.5} />
      <span>
        Estás configurando {context ? `${context} de ` : ""}la empresa{" "}
        <strong data-testid="active-company-name">{active.name || "(Sin nombre)"}</strong>. Cada empresa tiene su
        propio certificado, plantilla y cobros.{" "}
        <a href="/empresas" className="underline font-medium hover:text-[#0052FF]">Cambiar empresa</a>
      </span>
    </div>
  );
};

export default ActiveCompanyBanner;
