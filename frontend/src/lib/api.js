import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: { "X-OF-Client": "web" },
});

let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = error.config || {};
    const url = cfg.url || "";
    if (error.response?.status !== 401 || cfg._retried || url.includes("/auth/")) return Promise.reject(error);
    cfg._retried = true;
    try {
      refreshing = refreshing || api.post("/auth/refresh").finally(() => { refreshing = null; });
      await refreshing;
      return api(cfg);
    } catch {
      return Promise.reject(error);
    }
  },
);

export const eur = (v) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v || 0);

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Algo salió mal. Inténtalo de nuevo.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
