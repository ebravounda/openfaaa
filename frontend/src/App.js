import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Invoices from "@/pages/Invoices";
import Expenses from "@/pages/Expenses";
import Contacts from "@/pages/Contacts";
import Taxes from "@/pages/Taxes";
import Connection from "@/pages/Connection";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";
import Pricing from "@/pages/Pricing";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/facturas" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
          <Route path="/gastos" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
          <Route path="/contactos" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
          <Route path="/impuestos" element={<ProtectedRoute><Taxes /></ProtectedRoute>} />
          <Route path="/conexion" element={<ProtectedRoute><Connection /></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/precios" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
