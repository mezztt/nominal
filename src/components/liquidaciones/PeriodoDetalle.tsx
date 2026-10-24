import { Fragment, useCallback, useEffect, useState } from "react";
import { appApi, shortDate } from "../../config";
import { Empty, Loading, Modal, Pill, Tabs, useFlash } from "../ui";
import { ars, can, Disclaimer, EstadoPill } from "../g2/common";
import RunModal from "./RunModal";

export default function PeriodoDetalle({ id, onBack, onChanged }: { id: number; onBack: () => void; onChanged: () => void }) {
  const [p, setP] = useState<any>(null);
  const [runs, setRuns] = useState<any[] | null>(null);
  const [resumen, setResumen] = useState<any>(null);
  const [tab, setTab] = useState<"corridas" | "resumen">("corridas");
  const [run, setRun] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const [reabrir, setReabrir] = useState<string | null>(null);
  const [confirmarNeg, setConfirmarNeg] = useState(false);
  const [error, setError] = useState("");
  const { show, fail, node } = useFlash();
  const verSueldos = can("ver_sueldos");
  const cierra = can("cerrar_liquidacion");

  const cargar = useCallback(async () => {
    try {
      const per = await appApi(`/periodos/${id}`);
      setP(per);
      if (verSueldos) {
        setRuns(await appApi(`/periodos/${id}/corridas`));
        if (tab === "resumen") setResumen(await appApi(`/periodos/${id}/resumen`));
      } else setRuns([]);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el período."); }
  }, [id, tab, verSueldos]);
  useEffect(() => { void cargar(); }, [cargar]);

  const accion = async (nombre: string, path: string, body?: unknown, ok?: string, method = "POST") => {
    setBusy(nombre);
    try {
      const r = await appApi(path, { method, body });
      if (nombre === "calcular" && r?.omitidos?.length) show(`Calculado. ${r.omitidos.length} empleado(s) sin liquidar: ${r.omitidos.map((o: any) => o.nombre).join(", ")}.`, true);
      else show(ok || "Listo.");
      await cargar(); onChanged();
    } catch (e) { fail(e); } finally { setBusy(""); }
  };

  const abrirRun = async (r: any) => {
    try { setRun(await appApi(`/corridas/${r.id}`)); } catch (e) { fail(e); }
  };
  const refrescarRun = async () => { if (run) { setRun(await appApi(`/corridas/${run.id}`)); } await cargar(); onChanged(); };

  if (error) return <div className="nm-card"><button className="nm2-back" onClick={onBack}>← Volver</button><p className="nm-note nm-note-error">{error}</p></div>;
  if (!p) return <Loading />;
  const cerrada = p.estado === "cerrada";
  const bloqueos: any[] = p.bloqueos || [];
  const hayNeg = bloqueos.some((b) => b.confirmable);

  return (
    <div>
      <button className="nm2-back" onClick={onBack}>← Volver a los períodos</button>
      <div className="nm-spread" style={{ marginBottom: 14 }}>
        <div className="nm-row"><h2 style={{ margin: 0 }}>{p.etiqueta}</h2><EstadoPill estado={p.estado} />
          {p.fecha_pago_limite && <Pill tone="gray">Pago hasta el {shortDate(p.fecha_pago_limite)}</Pill>}</div>
        {cierra && (
          <div className="nm-row">
            {!cerrada && <button className="nm2-btn is-primary" disabled={!!busy} onClick={() => accion("calcular", `/periodos/${id}/calcular`, {}, "Período calculado.")}>{busy === "calcular" ? "Calculando..." : p.estado === "borrador" ? "Calcular" : "Recalcular"}</button>}
            {p.estado === "calculada" && <button className="nm2-btn" disabled={!!busy} onClick={() => accion("revisar", `/periodos/${id}/revisar`, undefined, "Marcado como revisado.")}>Marcar revisado</button>}
            {!cerrada && p.estado !== "borrador" && <button className="nm2-btn" disabled={!!busy || (bloqueos.some((b) => !b.confirmable)) || (hayNeg && !confirmarNeg)} onClick={() => accion("cerrar", `/periodos/${id}/cerrar`, { confirmar_neto_negativo: confirmarNeg }, "Período cerrado. Ya podés emitir los recibos.")}>Cerrar período</button>}
            {cerrada && <button className="nm2-btn is-danger" onClick={() => setReabrir("")}>Reabrir</button>}
          </div>
        )}
      </div>

      {!cerrada && bloqueos.length > 0 && (
        <div className="nm-card nm-card-warn" style={{ marginBottom: 14 }}>
          <strong>Antes de cerrar</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{bloqueos.map((b, i) => <li key={i}>{b.mensaje}</li>)}</ul>
          {hayNeg && <label className="nm-inline-checks" style={{ marginTop: 8 }}><input type="checkbox" checked={confirmarNeg} onChange={(e) => setConfirmarNeg(e.target.checked)} /> Confirmo que los netos negativos son correctos</label>}
        </div>
      )}

      <div className="nm-kpis">
        <div className="nm-kpi"><span>Empleados</span><strong>{p.empleados}</strong>{p.alertas > 0 && <small>{p.alertas} aviso(s)</small>}</div>
        {verSueldos && <><div className="nm-kpi"><span>Bruto</span><strong>{ars(p.bruto)}</strong></div>
          <div className="nm-kpi"><span>Neto a pagar</span><strong>{ars(p.neto)}</strong></div>
          <div className="nm-kpi"><span>Costo laboral</span><strong>{ars(p.costo_laboral)}</strong></div></>}
      </div>

      {verSueldos && <Tabs value={tab} options={[["corridas", "Liquidaciones"], ["resumen", "Resumen y costo"]]} onChange={setTab} />}
      {!verSueldos && <Empty title="No tenés permiso para ver sueldos">Pedile a quien administra la empresa que te lo habilite.</Empty>}

      {verSueldos && tab === "corridas" && (runs === null ? <Loading /> : runs.length === 0 ? (
        <Empty title="Todavía no hay liquidaciones">{cierra ? "Tocá «Calcular» para liquidar a todos los empleados del período." : "Quien liquida va a calcular el período."}</Empty>
      ) : (
        <div className="nm-table-wrap"><table className="nm-table">
          <thead><tr><th>Empleado</th><th className="num">Bruto</th><th className="num">Aportes</th><th className="num">Ganancias</th><th className="num">Neto</th><th className="num">Costo laboral</th><th /></tr></thead>
          <tbody>{runs.map((r) => (
            <tr key={r.id} className="is-click" onClick={() => abrirRun(r)}>
              <td>{r.nombre}<small>Legajo {r.legajo || "—"}</small></td>
              <td className="num">{ars(r.bruto)}</td><td className="num">{ars(r.aportes_total)}</td><td className="num">{ars(r.ganancias)}</td>
              <td className="num"><strong>{ars(r.neto)}</strong></td><td className="num">{ars(r.costo_laboral_total)}</td>
              <td>{(r.alertas || []).some((a: any) => a.nivel === "error" || a.nivel === "bloqueo") ? <Pill tone="red">Revisar</Pill> : (r.alertas || []).length ? <Pill tone="orange">Aviso</Pill> : ""}</td>
            </tr>))}</tbody>
        </table></div>
      ))}

      {verSueldos && tab === "resumen" && (!resumen ? <Loading /> : (
        <div className="nm-grid-2">
          <div className="nm-card">
            <div className="nm-card-head"><div><h2>Totales</h2></div></div>
            <dl className="nm2-kv">
              <dt>Remunerativo</dt><dd>{ars(resumen.totales.bruto_rem)}</dd>
              <dt>No remunerativo</dt><dd>{ars(resumen.totales.bruto_nr)}</dd>
              <dt>Aportes del trabajador</dt><dd>{ars(resumen.totales.aportes)}</dd>
              <dt>Ganancias</dt><dd>{ars(resumen.totales.ganancias)}</dd>
              <dt>Otros descuentos</dt><dd>{ars(resumen.totales.neutros)}</dd>
              <dt><strong>Neto</strong></dt><dd><strong>{ars(resumen.totales.neto)}</strong></dd>
              <dt>Contribuciones del empleador</dt><dd>{ars(resumen.totales.contribuciones)}</dd>
              <dt><strong>Costo laboral</strong></dt><dd><strong>{ars(resumen.totales.costo_laboral)}</strong></dd>
            </dl>
            {resumen.anterior && <p className="nm-hint">Mes anterior ({resumen.anterior.periodo}): neto {ars(resumen.anterior.neto)}, costo laboral {ars(resumen.anterior.costo_laboral)}, {resumen.anterior.empleados} empleado(s).</p>}
          </div>
          <div className="nm-card">
            <div className="nm-card-head"><div><h2>Contribuciones por rubro</h2></div></div>
            <dl className="nm2-kv">{Object.entries(resumen.costo_por_rubro as Record<string, number>).filter(([, v]) => v > 0).map(([k, v]) => <Fragment key={k}><dt>{resumen.etiquetas_rubro[k] || k}</dt><dd>{ars(v)}</dd></Fragment>)}</dl>
          </div>
          <div style={{ gridColumn: "1 / -1" }}><Disclaimer>{resumen.aviso}</Disclaimer></div>
        </div>
      ))}

      {run && <RunModal run={run} cerrada={cerrada} onClose={() => setRun(null)} onChanged={refrescarRun} />}
      {reabrir !== null && (
        <Modal title="Reabrir el período" onClose={() => setReabrir(null)}
          footer={<><button className="nm2-btn" onClick={() => setReabrir(null)}>Cancelar</button>
            <button className="nm2-btn is-danger" disabled={reabrir.trim().length < 3 || !!busy} onClick={async () => { await accion("reabrir", `/periodos/${id}/reabrir`, { motivo: reabrir }, "Período reabierto."); setReabrir(null); }}>Reabrir</button></>}>
          <p className="nm-note nm-note-warn">Reabrir un período cerrado queda registrado. Los recibos ya emitidos siguen siendo válidos hasta que los anules.</p>
          <label className="nm2-label" style={{ marginTop: 10 }}>Motivo<input className="nm2-input" value={reabrir} onChange={(e) => setReabrir(e.target.value)} autoFocus /></label>
        </Modal>
      )}
      {node}
    </div>
  );
}
