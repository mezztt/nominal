import { useCallback, useEffect, useState } from "react";
import { appApi, shortDate } from "../../config";
import { Empty, Loading, Pill, Seg, useFlash } from "../ui";
import { ars, can, Disclaimer } from "../g2/common";

export default function Sac() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [sem, setSem] = useState<"1" | "2">(hoy.getMonth() < 6 ? "1" : "2");
  const [prev, setPrev] = useState<any>(null);
  const [manual, setManual] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { show, fail, node } = useFlash();

  const cargar = useCallback(async () => {
    setPrev(null);
    try { setPrev(await appApi(`/sac/${sem}/previa?anio=${anio}`)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo armar la previa."); }
  }, [anio, sem]);
  useEffect(() => { void cargar(); }, [cargar]);

  const liquidar = async () => {
    setBusy(true);
    try {
      const mrmd: Record<string, number> = {};
      Object.entries(manual).forEach(([k, v]) => { const n = Number(v.replace(",", ".")); if (n > 0) mrmd[k] = n; });
      const r = await appApi(`/sac/${sem}/liquidar`, { method: "POST", body: { anio, mrmd_manual: mrmd } });
      show(`SAC calculado para ${r.resultado.calculadas} empleado(s). Revisalo y cerralo en Liquidaciones.`);
      await cargar();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="nm2-sub">
        <Seg value={sem} options={[["1", "1.º semestre"], ["2", "2.º semestre"]]} onChange={setSem} />
        <input className="nm2-input num" type="number" aria-label="Año" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
      </div>
      {error && <p className="nm-note nm-note-error">{error}</p>}
      {!prev && !error && <Loading />}
      {prev && (
        <>
          <div className="nm-kpis">
            <div className="nm-kpi"><span>Vence</span><strong>{shortDate(prev.fechas.fecha_legal)}</strong><small>Con tolerancia hasta el {shortDate(prev.fechas.fecha_con_tolerancia)}</small></div>
            <div className="nm-kpi"><span>SAC estimado</span><strong>{ars(prev.total_sac)}</strong></div>
            <div className="nm-kpi"><span>Aportes estimados</span><strong>{ars(prev.total_aportes)}</strong></div>
            <div className="nm-kpi"><span>Estado</span><strong style={{ fontSize: 18 }}>{prev.periodo ? prev.periodo.estado : "Sin liquidar"}</strong></div>
          </div>
          {prev.faltan_parametros.length > 0 && <p className="nm-note nm-note-warn" style={{ marginBottom: 12 }}>Faltan parámetros para estimar los aportes: {prev.faltan_parametros.join(", ")}.</p>}
          {prev.empleados.length === 0 ? <div className="nm-card"><Empty title="No hay empleados en este semestre">Revisá las fechas de ingreso y egreso en Legajos.</Empty></div> : (
            <div className="nm-table-wrap"><table className="nm-table">
              <thead><tr><th>Empleado</th><th className="num">Mayor remuneración</th><th className="num">Días</th><th className="num">SAC</th><th className="num">Aportes</th><th className="num">Neto estimado</th>{can("cerrar_liquidacion") && <th>Cargar a mano</th>}</tr></thead>
              <tbody>{prev.empleados.map((e: any) => (
                <tr key={e.employee_id}>
                  <td>{e.nombre}<small>Legajo {e.legajo || "—"}</small>{e.alertas.map((a: string, i: number) => <small key={i} style={{ color: "var(--nm-orange-text)" }}>{a}</small>)}</td>
                  <td className="num">{ars(e.mrmd)}<small>{e.mes_mrmd || ""}</small></td>
                  <td className="num">{e.proporcional ? <>{e.dias} / {e.dias_semestre} <Pill tone="blue">Proporcional</Pill></> : "Completo"}</td>
                  <td className="num"><strong>{ars(e.sac)}</strong></td><td className="num">{ars(e.aportes)}</td><td className="num">{ars(e.neto_estimado)}</td>
                  {can("cerrar_liquidacion") && <td><input className="nm2-input num" aria-label={`Mayor remuneración de ${e.nombre}`} inputMode="decimal" placeholder="Opcional" value={manual[e.employee_id] || ""} onChange={(ev) => setManual({ ...manual, [e.employee_id]: ev.target.value })} /></td>}
                </tr>))}</tbody>
            </table></div>
          )}
          <Disclaimer>{prev.aviso}</Disclaimer>
          {can("cerrar_liquidacion") && prev.empleados.length > 0 && (
            <button className="nm2-btn is-primary" disabled={busy || prev.periodo?.estado === "cerrada"} onClick={liquidar}>
              {busy ? "Calculando..." : prev.periodo ? "Recalcular SAC" : "Liquidar SAC"}</button>
          )}
        </>
      )}
      {node}
    </div>
  );
}
