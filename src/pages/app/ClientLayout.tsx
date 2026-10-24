import { useEffect, useState } from "react";
import Icon from "../../components/Icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  appApi, canAccess, getEmployerId, getSessionUser, setEmployerId, ROLE_LABELS, THEME_KEY, TOKEN_KEY, USER_KEY, longDate, NAV, APP_NAME,
} from "../../config";
import type { SessionUser } from "../../config";
import NotificationsBell from "../../components/NotificationsBell";
import { NominalLogo, SidebarSignature } from "../../components/Brand";
import Tour, { startTour } from "../../components/tour/Tour";
import { tourSteps } from "../../components/tour/steps";
import AsistenteNominal from "../../components/AsistenteNominal";
import { BajaBanner } from "../../components/BajaServicio";

function ClientLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(getSessionUser());
  const [clock, setClock] = useState(new Date());
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [refreshKey, setRefreshKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);   // en el celular el menú se abre con un botón
  const [employerId, setEmployer] = useState(getEmployerId());

  // refresca módulos/rol por si los cambiaron desde el panel general
  useEffect(() => {
    appApi<SessionUser>("/auth/me")
      .then((me) => { localStorage.setItem(USER_KEY, JSON.stringify(me)); setUser(me); })
      .catch(() => {});
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // si el plan no tiene la pantalla o el rol no puede verla, vuelve al inicio
  useEffect(() => {
    if (!user) return;
    const item = NAV.find((n) => n.path !== "/app" && (location.pathname === n.path || location.pathname.startsWith(n.path + "/")));
    if (item && !canAccess(user, item.module)) navigate("/app", { replace: true });
  }, [user, location.pathname, navigate]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // la empresa elegida tiene que ser una de las que el usuario puede ver; si no, se usa la primera (la principal)
  const employers = user?.employers || [];
  useEffect(() => {
    if (!employers.length) return;
    if (!employers.some((e) => String(e.id) === employerId)) {
      const first = String((employers.find((e) => e.es_principal) || employers[0]).id);
      setEmployerId(first); setEmployer(first);
    }
  }, [employers, employerId]);

  function pickEmployer(id: string) {
    setEmployerId(id); setEmployer(id);
    setRefreshKey((k) => k + 1);     // las pantallas se recargan con la otra empresa
  }

  const visible = NAV.filter((n) => canAccess(user, n.module));
  const sections = (["LIQUIDACIÓN", "GESTIÓN", "EMPRESA"] as const)
    .map((s) => ({ section: s, items: visible.filter((n) => n.section === s) }))
    .filter((s) => s.items.length);
  const current = NAV.filter((n) => n.path !== "/app" && (location.pathname === n.path || location.pathname.startsWith(n.path + "/")))[0]?.module || "inicio";

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/";
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <div className={`app-layout ${menuOpen ? "nm-menu-open" : ""}`}>
      {menuOpen && <button type="button" className="nm-menu-backdrop" aria-label="Cerrar el menú" onClick={() => setMenuOpen(false)} />}
      <aside className="sidebar" id="nm-sidebar">
        <div className="sidebar-brand">
          <NominalLogo size={40} />
          <div className="sidebar-brand-text">
            <strong>{user?.company_name || APP_NAME}</strong>
            <span>{APP_NAME} · sueldos y recibos</span>
          </div>
        </div>
        <nav className="sidebar-nav" data-tour="menu">
          {sections.map((s) => (
            <div key={s.section}>
              {sections.length > 1 && <div className="nav-section">{s.section}</div>}
              {s.items.map((n) => (
                <button key={n.module} data-tour={`nav-${n.module}`} className={`nav-item ${current === n.module ? "active" : ""}`} onClick={() => navigate(n.path)}>
                  <span aria-hidden="true"><Icon name={n.icon} /></span>
                  <span className="nav-item-text">{n.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="nm-user-mini">
            <strong>{user?.name}</strong>
            <span>{ROLE_LABELS[user?.role || ""] || user?.role}</span>
          </div>
          <button className="logout-button" data-tour="theme" onClick={toggleTheme} style={{ marginBottom: 6 }}>
            <span className="nav-item-text with-icon"><Icon name={theme === "dark" ? "sun" : "moon"} size={15} />{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
          </button>
          <button className="logout-button" data-tour="tour-help" onClick={startTour} style={{ marginBottom: 6 }}><span className="nav-item-text with-icon"><Icon name="help" size={15} />¿Cómo funcionamos?</span></button>
          {(user?.role === "ADMINISTRADOR" || user?.role === "ESTUDIO_ADMIN") && <button className="logout-button" data-testid="baja-link" onClick={() => { setMenuOpen(false); navigate("/app/configuracion", { state: { tab: "plan" } }); }} style={{ marginBottom: 6 }}><span className="nav-item-text with-icon"><Icon name="logout" size={15} />Dar de baja el servicio</span></button>}
          <button className="logout-button" onClick={logout}><span className="nav-item-text with-icon"><Icon name="logout" size={15} />Cerrar sesión</span></button>
          <SidebarSignature />
        </div>
      </aside>
      {user && <Tour steps={tourSteps(user)} storageKey={`nominal_${user.role.toLowerCase()}_${user.id ?? "x"}`} />}
      <div className="main-area">
        <header className="nm-topbar">
          <button type="button" className="nm-menu-button" aria-label="Abrir el menú" aria-expanded={menuOpen} aria-controls="nm-sidebar"
            onClick={() => setMenuOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="nm-topbar-when">
            <span className="nm-topbar-date">{longDate(clock)}</span>
            <strong className="nm-topbar-clock">{clock.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}</strong>
          </div>
          {employers.length > 1 && (
            <label className="nm-employer-pick" data-tour="empresa">
              <span>Empresa</span>
              <select value={employerId} onChange={(e) => pickEmployer(e.target.value)} aria-label="Empresa empleadora">
                {employers.map((e) => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
              </select>
            </label>
          )}
          <div className="nm-topbar-right">
            <span data-tour="bell" className="nm-tour-wrap"><NotificationsBell onNew={() => setRefreshKey((k) => k + 1)} /></span>
          </div>
        </header>
        <main className="page-content">
          {/* refreshKey: cuando llega un aviso nuevo, las pantallas se recargan solas */}
          {(user?.role === "ADMINISTRADOR" || user?.role === "ESTUDIO_ADMIN") && <BajaBanner />}
          <Outlet key={employerId} context={{ refreshKey }} />
        </main>
      </div>
      <AsistenteNominal user={user} />
    </div>
  );
}

export default ClientLayout;
