import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
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
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import Landing from "@/pages/Landing";
import { Terms, Privacy } from "@/pages/Legal";
import Welcome from "@/pages/Welcome";

function Home() {
  const { user, checking } = useAuth();
  if (checking) return null;
  return user ? <Dashboard /> : <Landing />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/terminos" element={<Terms />} />
          <Route path="/privacidad" element={<Privacy />} />
          <Route path="/bienvenida" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
          <Route path="/" element={<Home />} />
          <Route path="/facturas" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
          <Route path="/gastos" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
          <Route path="/contactos" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
          <Route path="/impuestos" element={<ProtectedRoute><Taxes /></ProtectedRoute>} />
          <Route path="/conexion" element={<ProtectedRoute><Connection /></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/precios" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
          <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
          <Route path="/payment/cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
