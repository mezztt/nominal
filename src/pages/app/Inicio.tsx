import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, canAccess, getSessionUser, longDate, pathFor, iconFor, moduleLabel, shortDate } from "../../config";
import Icon from "../../components/Icons";
import { Loading, PageHeader, useRefreshKey } from "../../components/ui";
import Pendientes from "../../components/Pendientes";

interface Overview {
  date: string;
  employer: { id: number; razon_social: string; cuit: string | null };
  employees_active: number;
  params: { vigente: number; por_vencer: number; vencido: number };
  open_period: { id: number; anio: number; mes: number; tipo: string; estado: string } | null;
  next_due: { tipo: string; periodo: string; vence: string; dias: number } | null;
}

/** Atajos del día a día (solo los módulos que el cliente tiene y el rol puede abrir) */
const SHORTCUTS = ["liquidaciones", "novedades", "recibos", "legajos", "ganancias", "arca_exportacion"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function Inicio() {
  const user = getSessionUser();
  const navigate = useNavigate();
  const refreshKey = useRefreshKey();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => appApi<Overview>("/dashboard").then(setData).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [refreshKey]);

  if (error) return <div className="nm-note nm-note-error">{error}</div>;
  if (!data) return <Loading />;

  const hour = new Date().getHours();
  const hello = hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const shortcuts = SHORTCUTS.filter((m) => canAccess(user, m));
  const p = data.open_period;
  const paramsTone = data.params.vencido ? "alert" : data.params.por_vencer ? "warn" : "ok";

  return (
    <section className="products-page">
      <PageHeader eyebrow="INICIO" title={`${hello}, ${(user?.name || "").split(" ")[0]}`}
        subtitle={`${data.employer.razon_social} · ${longDate(new Date(data.date + "T12:00:00"))}`} />

      <Pendientes />

      <div className="nm-kpis" data-tour="inicio-numeros">
        <div className="nm-kpi"><span>Empleados activos</span><strong>{data.employees_active}</strong><small>Sin contar bajas</small></div>
        <div className="nm-kpi">
          <span>Período abierto</span>
          <strong>{p ? `${MONTHS[p.mes - 1]} ${p.anio}` : "Ninguno"}</strong>
          <small>{p ? `${p.tipo} · ${p.estado}` : "Cuando abras una liquidación, aparece acá"}</small>
        </div>
        <div className="nm-kpi">
          <span>Próximo vencimiento</span>
          <strong>{data.next_due ? shortDate(data.next_due.vence) : "Sin cargar"}</strong>
          <small>{data.next_due ? `${data.next_due.tipo} ${data.next_due.periodo} · en ${data.next_due.dias} día(s)` : "Los vencimientos de ARCA se cargan con la liquidación"}</small>
        </div>
        <div className={`nm-kpi is-${paramsTone}`}>
          <span>Parámetros legales</span>
          <strong>{data.params.vencido + data.params.por_vencer === 0 ? "Al día" : `${data.params.vencido + data.params.por_vencer} por revisar`}</strong>
          <small>{data.params.vigente} vigentes · {data.params.por_vencer} por vencer · {data.params.vencido} vencidos</small>
        </div>
      </div>

      {shortcuts.length > 0 && (
        <div className="nm-card" data-tour="atajos">
          <div className="nm-card-head"><div><h2>Atajos</h2><p>Lo que más se usa durante la liquidación.</p></div></div>
          <div className="nm-shortcuts">
            {shortcuts.map((m) => (
              <button key={m} type="button" className="nm-shortcut" onClick={() => navigate(pathFor(m))}>
                <span aria-hidden="true"><Icon name={iconFor(m)} size={20} /></span>
                <strong>{moduleLabel(m)}</strong>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default Inicio;
