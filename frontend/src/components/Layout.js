import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Landmark,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Panel", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/facturas", label: "Facturas", icon: FileText, testid: "nav-invoices" },
  { to: "/gastos", label: "Gastos", icon: Receipt, testid: "nav-expenses" },
  { to: "/impuestos", label: "Impuestos", icon: Landmark, testid: "nav-taxes" },
  { to: "/configuracion", label: "Configuración", icon: Settings, testid: "nav-settings" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-[#E5E5E5] flex flex-col fixed h-screen">
        <div className="px-6 py-6 border-b border-[#E5E5E5]">
          <div className="font-heading text-xl font-extrabold tracking-tighter text-[#0A0A0A]">
            FiscalHub
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666] mt-1">
            España
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={n.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-[#0A0A0A] text-white"
                    : "text-[#333333] hover:bg-[#F4F4F4]"
                }`
              }
            >
              <n.icon className="w-[18px] h-[18px]" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-[#E5E5E5]">
          <div className="px-3 pb-3">
            <div className="text-sm font-semibold text-[#111111] truncate">{user?.name}</div>
            <div className="text-xs text-[#666666] truncate">{user?.email}</div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            data-testid="logout-button"
            className="w-full justify-start gap-3 text-[#333333] hover:bg-[#F4F4F4] rounded-md"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-6 sm:p-8 lg:p-10 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
