import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "../../../g1.css";
import { appApi, downloadCsv, shortDate } from "../../../config";
import { Empty, Loading, PageHeader, Pill, useFlash, useRefreshKey } from "../../../components/ui";
import { can } from "../../../components/g2/common";
import { ImportCsv } from "../../../components/g1/common";
import EmpleadoForm from "../../../components/legajos/EmpleadoForm";
import Ficha, { EstadoEmp } from "../../../components/legajos/Ficha";

const EJEMPLO = `nombre;cuil;fecha_ingreso;convenio;categoria;tarea
Pérez, Ana;27-12345678-0;01/03/2021;130/75;Maestranza A;Limpieza
Gómez, Luis;20-23456789-6;15/08/2023;;;Administración`;

/** Módulo `legajos` (spec I.2). Backend: backend/routes/legajos.py */
export default function LegajosPage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<any | null>(null);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("activos");
  const [incompletos, setIncompletos] = useState(params.get("filtro") === "incompletos");
  const [sel, setSel] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [importar, setImportar] = useState(false);
  const [error, setError] = useState("");
  const { show, node } = useFlash();
  const refresh = useRefreshKey();
  const edita = can("editar_legajos");

  const cargar = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ estado });
      if (q.trim()) qs.set("q", q.trim());
      if (incompletos) qs.set("filtro", "incompletos");
      setData(await appApi(`/empleados?${qs}`));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron cargar los legajos."); }
  }, [q, estado, incompletos]);
  useEffect(() => { const t = window.setTimeout(() => void cargar(), q ? 250 : 0); return () => window.clearTimeout(t); }, [cargar, refresh, q]);

  const exportar = () => {
    if (!data) return;
    downloadCsv("legajos.csv", ["Legajo", "Nombre", "CUIL", "Convenio", "Categoría", "Ingreso", "Estado"],
      data.items.map((e: any) => [e.legajo, e.nombre, e.cuil_formato || "", e.cct_numero || "Fuera de convenio", e.categoria_nombre || "", e.fecha_ingreso || "", e.estado]));
  };
  const r = data?.resumen;

  return (
    <section className="products-page">
      <PageHeader eyebrow="LEGAJOS" title="Legajos" subtitle="La ficha de cada empleado: datos, contrato, familia y documentos.">
        {!sel && <button className="nm2-btn" onClick={exportar} disabled={!data?.items?.length}>Exportar lista</button>}
        {!sel && edita && <button className="nm2-btn" onClick={() => setImportar(true)}>Importar CSV</button>}
        {!sel && edita && <button className="primary-button" onClick={() => setNuevo(true)}>Nuevo empleado</button>}
      </PageHeader>
      {error && <p className="nm-note nm-note-error" style={{ marginBottom: 14 }}>{error}</p>}

      {sel ? <Ficha id={sel} onBack={() => { setSel(null); void cargar(); }} onChanged={() => void cargar()} /> : !data && !error ? <Loading /> : data && (
        <>
          <div className="nm-kpis">
            <button className="nm-kpi" onClick={() => { setIncompletos(false); setEstado("activos"); setParams({}); }}><span>Activos</span><strong>{r.activos + r.licencia + r.suspendidos}</strong><small>{r.licencia ? `${r.licencia} en licencia` : "Todos en actividad"}</small></button>
            <button className={`nm-kpi ${r.incompletos ? "is-warn" : ""}`} onClick={() => { setIncompletos(true); setEstado("activos"); }}><span>Datos incompletos</span><strong>{r.incompletos}</strong><small>{r.incompletos ? "Falta CUIL, categoría, CBU o ingreso" : "Todo en orden"}</small></button>
            <button className="nm-kpi" onClick={() => { setIncompletos(false); setEstado("baja"); }}><span>Bajas</span><strong>{r.bajas}</strong><small>Se conservan 10 años</small></button>
          </div>
          <div className="nm-toolbar">
            <input className="nm-search" placeholder="Buscar por nombre, legajo, CUIL o DNI" aria-label="Buscar empleado" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="nm-filters">
              <select className="nm-select" aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="activos">En actividad</option><option value="activo">Solo activos</option><option value="licencia">En licencia</option><option value="suspendido">Suspendidos</option><option value="baja">Bajas</option><option value="todos">Todos</option>
              </select>
              <label><input type="checkbox" checked={incompletos} onChange={(e) => setIncompletos(e.target.checked)} /> Solo datos incompletos</label>
            </div>
          </div>
          {data.items.length === 0 ? (
            <div className="nm-card">
              {r.activos + r.bajas + r.licencia + r.suspendidos === 0
                ? <Empty title="Todavía no cargaste empleados">{edita ? "Creá el primer legajo con «Nuevo empleado» o importá una planilla en CSV." : "Cuando se carguen, los vas a ver acá."}</Empty>
                : <Empty title="No hay empleados con ese filtro">Probá con otra búsqueda o sacá los filtros.</Empty>}
            </div>
          ) : (
            <div className="nm-table-wrap"><table className="nm-table">
              <thead><tr><th>Legajo</th><th>Empleado</th><th>Convenio y categoría</th><th>Ingreso</th><th>Estado</th><th>Datos</th></tr></thead>
              <tbody>{data.items.map((e: any) => (
                <tr key={e.id} className="is-click" tabIndex={0} onClick={() => setSel(e.id)} onKeyDown={(ev) => { if (ev.key === "Enter") setSel(e.id); }}>
                  <td>{e.legajo}</td>
                  <td><strong>{e.nombre}</strong><small>{e.cuil_formato || "Sin CUIL"}{e.tarea ? ` · ${e.tarea}` : ""}</small></td>
                  <td>{e.cct_numero ? <>{e.cct_numero}<small>{e.categoria_nombre || "Sin categoría"}</small></> : <>Fuera de convenio<small>{e.sueldo_basico_pactado != null ? "Sueldo pactado" : ""}</small></>}</td>
                  <td>{shortDate(e.fecha_ingreso)}<small>{e.antiguedad.anios} año(s) y {e.antiguedad.meses} mes(es)</small></td>
                  <td><EstadoEmp estado={e.estado} /></td>
                  <td>{e.faltantes.length ? <span className="nm1-chips">{e.faltantes.map((f: any) => <Pill key={f.campo} tone="orange">{{ cuil: "CUIL", categoria: "Categoría", cbu: "CBU", fecha_ingreso: "Ingreso" }[f.campo as string] || f.campo}</Pill>)}</span> : <Pill tone="green">Completo</Pill>}</td>
                </tr>))}</tbody>
            </table></div>
          )}
          {data.total > data.items.length && <p className="nm-muted" style={{ marginTop: 10 }}>Mostrando {data.items.length} de {data.total}. Afiná la búsqueda para ver el resto.</p>}
        </>
      )}

      {nuevo && <EmpleadoForm emp={null} onClose={() => setNuevo(false)} onSaved={(e, avisos) => { setNuevo(false); void cargar(); setSel(e.id); if (avisos.length) show(`Legajo creado. Ojo: ${avisos.join(" ")}`); else show("Legajo creado"); }} />}
      {importar && (
        <ImportCsv title="Importar empleados" endpoint="/empleados/importar" ejemplo={EJEMPLO} onClose={() => setImportar(false)} onDone={(m) => { show(m); void cargar(); }}
          ayuda={<>Columnas que entendemos: <strong>nombre</strong> (obligatoria), legajo, cuil, dni, fecha_ingreso, fecha_nac, convenio (número, por ejemplo 130/75), categoria, tarea, modalidad, jornada_horas, sueldo (fuera de convenio), obra_social, cbu, banco, email, telefono, domicilio, afiliado. Hasta 500 empleados por vez.</>} />
      )}
      {node}
    </section>
  );
}
