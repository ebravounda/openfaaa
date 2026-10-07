import api from "@/lib/api";

export const EXPENSE_CATEGORIES = [
  "General", "Suministros", "Telefonía e internet", "Combustible", "Restauración y dietas", "Viajes y alojamiento",
  "Alquiler", "Reparaciones y mantenimiento", "Servicios profesionales", "Transporte", "Seguros", "Servicios bancarios",
  "Publicidad y marketing", "Material de oficina", "Material", "Compras de mercaderías", "Trabajos de otras empresas",
  "Software", "Formación", "Tributos", "Seguridad Social autónomo", "Intereses y gastos financieros", "Servicios", "Otros",
];

export async function downloadFile(url, filename) {
  const res = await api.get(url, { responseType: "blob" });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = href; a.download = filename; a.click();
  URL.revokeObjectURL(href);
}
