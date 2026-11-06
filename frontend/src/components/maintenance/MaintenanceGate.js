import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { MaintenanceScreen } from "./MaintenanceScreen";

const OPEN_PATHS = ["/login", "/recuperar-contrasena", "/restablecer-contrasena"];

export const MaintenanceGate = ({ children }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [state, setState] = useState(null);
  useEffect(() => {
    const load = () => api.get("/maintenance").then((r) => setState(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  const isAdmin = user && user.role === "admin" && !user.is_impersonating;
  if (!state?.enabled || OPEN_PATHS.includes(pathname)) return children;
  if (isAdmin) {
    return (
      <>
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] rounded-full bg-amber-500 text-white text-xs font-medium px-4 py-2 shadow-lg" data-testid="maintenance-admin-badge">
          Modo mantenimiento activo · solo tú ves la app
        </div>
        {children}
      </>
    );
  }
  return <MaintenanceScreen message={state.message} until={state.until} />;
};
