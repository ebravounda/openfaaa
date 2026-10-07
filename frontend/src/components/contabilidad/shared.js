import { useEffect, useState, useCallback } from "react";
import api, { eur } from "@/lib/api";
import { downloadFile } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2 } from "lucide-react";

export const Box = ({ children, className = "", ...p }) => (
  <div className={`bg-white border border-slate-200 rounded-xl ${className}`} {...p}>{children}</div>
);

export const Num = ({ v, className = "" }) => <span className={`tabular ${v < 0 ? "text-red-600" : ""} ${className}`}>{v ? eur(v) : "—"}</span>;

export const ExportBtn = ({ libro, year }) => (
  <Button variant="outline" size="sm" className="border-slate-200" data-testid={`export-${libro}`}
    onClick={() => downloadFile(`/contabilidad/exportar?libro=${libro}&year=${year}`, `${libro}_${year}.xlsx`)}>
    <Download className="w-4 h-4 mr-1.5" /> Excel
  </Button>
);

export const useFetch = (url) => {
  const [data, setData] = useState(null);
  const load = useCallback(() => { setData(null); api.get(url).then((r) => setData(r.data)).catch(() => setData({ error: true })); }, [url]);
  useEffect(() => { load(); }, [load]);
  return [data, load];
};

export const Loading = () => <div className="flex justify-center py-14"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;

export const SearchBox = ({ value, onChange, placeholder = "Buscar…", testid }) => (
  <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-64" data-testid={testid} />
);

export const Th = ({ children, right }) => <th className={`px-3 py-2 text-xs font-semibold text-slate-500 ${right ? "text-right" : "text-left"}`}>{children}</th>;
export const Td = ({ children, right, className = "" }) => <td className={`px-3 py-2 ${right ? "text-right" : ""} ${className}`}>{children}</td>;
