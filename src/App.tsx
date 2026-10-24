import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { THEME_KEY } from "./config";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

// Panel general (Mezztt)
import AdminLayout from "./pages/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import Sistemas from "./pages/admin/Sistemas";
import AdminParametros from "./pages/admin/AdminParametros";
import Pagos from "./pages/admin/Pagos";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminSettings from "./pages/admin/AdminSettings";
import MailCenter from "./pages/admin/MailCenter";

// Sistema del cliente
import ClientLayout from "./pages/app/ClientLayout";
import Inicio from "./pages/app/Inicio";
import Usuarios from "./pages/app/Usuarios";
import Configuracion from "./pages/app/Configuracion";
// un archivo por módulo (cada agente completa el suyo)
import LegajosPage from "./pages/app/legajos/Index";
import ConveniosPage from "./pages/app/convenios/Index";
import NovedadesPage from "./pages/app/novedades/Index";
import LiquidacionesPage from "./pages/app/liquidaciones/Index";
import RecibosPage from "./pages/app/recibos/Index";
import AguinaldoVacacionesPage from "./pages/app/aguinaldo-vacaciones/Index";
import LiquidacionFinalPage from "./pages/app/liquidacion-final/Index";
import GananciasPage from "./pages/app/ganancias/Index";
import DescuentosPage from "./pages/app/descuentos/Index";
import ArcaExportacionPage from "./pages/app/arca/Index";
import MultiempresaPage from "./pages/app/multiempresa/Index";
import PortalAccesosPage from "./pages/app/portal/Index";

// Públicas: verificación de recibos (QR) y portal del empleado
import Verificar from "./pages/public/Verificar";
import Portal from "./pages/public/Portal";
import Legal from "./pages/public/Legal";

function App() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) || "light";
    // las páginas públicas se ven siempre en claro (lo fuerza useLightPage)
    if (/^\/(verificar|v|portal|legal)(\/|$)/.test(window.location.pathname)) return;
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* PANEL GENERAL (Mezztt) */}
        <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/sistemas" element={<Sistemas />} />
          <Route path="/admin/parametros" element={<AdminParametros />} />
          <Route path="/admin/pagos" element={<Pagos />} />
          <Route path="/admin/facturacion" element={<AdminBilling />} />
          <Route path="/admin/correos" element={<MailCenter />} />
          <Route path="/admin/configuracion" element={<AdminSettings />} />
        </Route>

        {/* SISTEMA DEL CLIENTE */}
        <Route element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
          <Route path="/app" element={<Inicio />} />
          <Route path="/app/legajos" element={<LegajosPage />} />
          <Route path="/app/convenios" element={<ConveniosPage />} />
          <Route path="/app/novedades" element={<NovedadesPage />} />
          <Route path="/app/liquidaciones" element={<LiquidacionesPage />} />
          <Route path="/app/recibos" element={<RecibosPage />} />
          <Route path="/app/aguinaldo-vacaciones" element={<AguinaldoVacacionesPage />} />
          <Route path="/app/liquidacion-final" element={<LiquidacionFinalPage />} />
          <Route path="/app/ganancias" element={<GananciasPage />} />
          <Route path="/app/descuentos" element={<DescuentosPage />} />
          <Route path="/app/arca" element={<ArcaExportacionPage />} />
          <Route path="/app/portal" element={<PortalAccesosPage />} />
          <Route path="/app/multiempresa" element={<MultiempresaPage />} />
          <Route path="/app/usuarios" element={<Usuarios />} />
          <Route path="/app/configuracion" element={<Configuracion />} />
        </Route>

        {/* WEBS PÚBLICAS (sin login) */}
        <Route path="/verificar/:token" element={<Verificar />} />
        <Route path="/v/:token" element={<Verificar />} />
        <Route path="/portal" element={<Portal />} />

        {/* LEGALES (sin login) */}
        <Route path="/legal/terminos" element={<Legal doc="terminos" />} />
        <Route path="/legal/privacidad" element={<Legal doc="privacidad" />} />
        <Route path="/legal/baja" element={<Legal doc="baja" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
