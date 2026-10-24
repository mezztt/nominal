import { useCallback, useEffect, useState } from "react";
import { appApi, shortDate } from "../../config";
import { Empty, Field, Loading, Modal, Pill, Tabs, useFlash } from "../ui";
import { MESES } from "../g2/common";

const TONO: Record<string, string> = { pendiente: "gray", aprobada: "blue", gozada: "green", rechazada: "red" };

export default function Vacaciones() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [vista, setVista] = useState<"saldos" | "cronograma">("saldos");
  const [saldos, setSaldos] = useState<any[] | null>(null);
  const [crono, setCrono] = useState<any>(null);
  const [nueva, setNueva] = useState<{ employee_id: number; desde: string; hasta: string; nota: string } | null>(null);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [error, setError] = useState("");
  const { show, fail, node } = useFlash();

  const cargar = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([appApi(`/vacaciones/saldos?anio=${anio}`), appApi(`/vacaciones/cronograma?anio=${anio}`)]);
      setSaldos(s.saldos); setCrono(c); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron cargar las vacaciones."); }
  }, [anio]);
  useEffect(() => { void cargar(); }, [cargar]);

  const guardar = async () => {
    if (!nueva) return;
    try {
      const r = await appApi("/vacaciones/solicitudes", { method: "POST", body: { ...nueva, nota: nueva.nota || null } });
      if (r.alertas?.length) setAlertas(r.alertas); else setAlertas([]);
      show("Solicitud registrada." + (r.alertas?.length ? " Mirá los avisos." : ""));
      setNueva(null); await cargar();
    } catch (e) { fail(e); }
  };
  const estado = async (id: number, st: string) => {
    try { await appApi(`/vacaciones/solicitudes/${id}`, { method: "PUT", body: { estado: st } }); await cargar(); } catch (e) { fail(e); }
  };

  return (
    <div>
      <div className="nm2-sub">
        <Tabs value={vista} options={[["saldos", "Saldos"], ["cronograma", "Cronograma"]]} onChange={setVista} />
        <input className="nm2-input num" type="number" aria-label="Año" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        <button className="nm2-btn is-primary" onClick={() => setNueva({ employee_id: saldos?.[0]?.employee_id || 0, desde: "", hasta: "", nota: "" })} disabled={!saldos || saldos.length === 0}>Cargar vacaciones</button>
      </div>
      {error && <p className="nm-note nm-note-error">{error}</p>}
      {alertas.length > 0 && <div className="nm-note nm-note-warn" style={{ marginBottom: 12 }}>{alertas.map((a, i) => <div key={i}>{a}</div>)}</div>}
      {!error && saldos === null && <Loading />}
      {saldos && vista === "saldos" && (saldos.length === 0 ? <div className="nm-card"><Empty title="No hay empleados con vacaciones en este año">Cargá legajos con fecha de ingreso.</Empty></div> : (
        <div className="nm-table-wrap"><table className="nm-table">
          <thead><tr><th>Empleado</th><th>Ingreso</th><th className="num">Corresponden</th><th className="num">Gozados</th><th className="num">Pendientes</th></tr></thead>
          <tbody>{saldos.map((s) => (
            <tr key={s.employee_id}><td>{s.nombre}<small>Legajo {s.legajo || "—"}</small></td><td>{shortDate(s.ingreso)}<small>{s.antiguedad_anios != null ? `${s.antiguedad_anios} años` : ""}</small></td>
              <td className="num">{s.dias_corresponden}</td><td className="num">{s.dias_gozados}</td>
              <td className="num">{s.dias_pendientes > 0 ? <Pill tone="orange">{s.dias_pendientes}</Pill> : s.dias_pendientes}</td></tr>))}</tbody>
        </table></div>
      ))}
      {crono && vista === "cronograma" && (
        <div className="nm-stack">
          {crono.sin_fecha.length > 0 && <div className="nm-note nm-note-warn">Sin fechas de vacaciones este año: {crono.sin_fecha.map((s: any) => s.nombre).join(", ")}.</div>}
          {crono.solicitudes.length === 0 ? <div className="nm-card"><Empty title="No hay vacaciones cargadas">Usá «Cargar vacaciones» para armar el cronograma.</Empty></div> : (
            <div className="nm-table-wrap"><table className="nm-table">
              <thead><tr><th>Empleado</th><th>Desde</th><th>Hasta</th><th className="num">Días</th><th>Estado</th><th /></tr></thead>
              <tbody>{crono.solicitudes.map((r: any) => (
                <tr key={r.id}><td>{r.nombre}{r.nota && <small>{r.nota}</small>}</td><td>{shortDate(r.desde)}</td><td>{shortDate(r.hasta)}</td><td className="num">{r.dias}</td>
                  <td><Pill tone={TONO[r.estado] || "gray"}>{r.estado}</Pill></td>
                  <td><div className="nm-row">
                    {r.estado === "pendiente" && <button className="nm2-btn is-small" onClick={() => estado(r.id, "aprobada")}>Aprobar</button>}
                    {r.estado === "pendiente" && <button className="nm2-btn is-small is-danger" onClick={() => estado(r.id, "rechazada")}>Rechazar</button>}
                    {r.estado === "aprobada" && <button className="nm2-btn is-small" onClick={() => estado(r.id, "gozada")}>Marcar gozada</button>}
                  </div></td></tr>))}</tbody>
            </table></div>
          )}
          <div className="nm2-grid-meses">{MESES.map((m) => {
            const lista = crono.por_mes[m] || [];
            return <div className="nm2-mes" key={m}><h3>{m}</h3>{lista.length === 0 ? <p className="nm-muted">Nadie de vacaciones</p> : lista.map((r: any) => <p key={r.id}>{r.nombre} · {shortDate(r.desde)} al {shortDate(r.hasta)}</p>)}</div>;
          })}</div>
        </div>
      )}
      {nueva && saldos && (
        <Modal title="Cargar vacaciones" onClose={() => setNueva(null)} footer={<><button className="nm2-btn" onClick={() => setNueva(null)}>Cancelar</button><button className="nm2-btn is-primary" disabled={!nueva.desde || !nueva.hasta} onClick={guardar}>Guardar</button></>}>
          <div className="nm2-form">
            <Field label="Empleado" wide><select className="nm2-select" value={nueva.employee_id} onChange={(e) => setNueva({ ...nueva, employee_id: Number(e.target.value) })}>{saldos.map((s) => <option key={s.employee_id} value={s.employee_id}>{s.nombre}</option>)}</select></Field>
            <Field label="Desde"><input className="nm2-input" type="date" value={nueva.desde} onChange={(e) => setNueva({ ...nueva, desde: e.target.value })} /></Field>
            <Field label="Hasta"><input className="nm2-input" type="date" value={nueva.hasta} onChange={(e) => setNueva({ ...nueva, hasta: e.target.value })} /></Field>
            <Field label="Nota" wide hint="Las vacaciones se otorgan en tramos de 7 días o más, entre el 1.º de octubre y el 30 de abril, avisando con 45 días (art. 154). Te avisamos si algo no se cumple."><input className="nm2-input" value={nueva.nota} onChange={(e) => setNueva({ ...nueva, nota: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {node}
    </div>
  );
}
