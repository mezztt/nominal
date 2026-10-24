import { useCallback, useEffect, useState } from "react";
import { appApi, shortDate } from "../../config";
import { Empty, Field, Loading, Pill, Switch, useFlash } from "../ui";
import { ars, can, Disclaimer } from "../g2/common";

const PASOS = ["Datos del egreso", "Base de cálculo", "Conceptos", "Resumen y emisión"];
const GRUPO: Record<string, string> = { haberes: "Haberes finales", indemnizaciones: "Indemnizaciones" };

export default function Asistente({ id, causas, onClose }: { id: number | null; causas: Record<string, string>; onClose: () => void }) {
  const [paso, setPaso] = useState(id ? 2 : 0);
  const [eg, setEg] = useState<any>(null);
  const [emps, setEmps] = useState<any[]>([]);
  const [datos, setDatos] = useState({ employee_id: 0, fecha_egreso: "", causa: "sin_causa", preaviso_otorgado: false, fecha_vencimiento_plazo: "" });
  const [base, setBase] = useState({ remuneracion_base: "", mrmd: "", sueldo_vacaciones: "", tope_cct: "", dias_vacaciones_gozadas: "", motivo: "" });
  const [docs, setDocs] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { show, fail, node } = useFlash();
  const cierra = can("cerrar_liquidacion");

  const aplicar = (e: any) => {
    setEg(e);
    const b = e.base || {};
    const s = (v: any) => (v == null ? "" : String(v));
    setBase((x) => ({ ...x, remuneracion_base: s(b.remuneracion_base), mrmd: s(b.mrmd), sueldo_vacaciones: s(b.sueldo_vacaciones), tope_cct: s(b.tope_cct), dias_vacaciones_gozadas: s(b.dias_vacaciones_gozadas) }));
  };
  const cargar = useCallback(async (egId: number) => {
    try { aplicar(await appApi(`/egresos/${egId}`)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el egreso."); }
  }, []);
  useEffect(() => { if (id) void cargar(id); else appApi("/empleados?estado=activos&limit=500").then((r) => { setEmps(r.items || []); if (r.items?.[0]) setDatos((d) => ({ ...d, employee_id: r.items[0].id })); }).catch((e) => setError(e.message)); }, [id, cargar]);

  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  const baseBody = () => ({
    remuneracion_base: num(base.remuneracion_base), mrmd: num(base.mrmd), sueldo_vacaciones: num(base.sueldo_vacaciones), tope_cct: num(base.tope_cct),
    dias_vacaciones_gozadas: num(base.dias_vacaciones_gozadas), motivo: base.motivo || null,
  });

  const crear = async () => {
    setBusy(true);
    try {
      const e = await appApi("/egresos", { method: "POST", body: { ...datos, fecha_vencimiento_plazo: datos.fecha_vencimiento_plazo || null } });
      aplicar(e); setPaso(1);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const guardarBase = async () => {
    setBusy(true);
    try { aplicar(await appApi(`/egresos/${eg.id}`, { method: "PUT", body: { base: baseBody() } })); setPaso(2); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const criterio = async (k: string, v: boolean | string | number) => {
    try { aplicar(await appApi(`/egresos/${eg.id}/criterios`, { method: "PUT", body: { [k]: v } })); } catch (e) { fail(e); }
  };
  const emitir = async () => {
    setBusy(true);
    try {
      const r = await appApi(`/egresos/${eg.id}/emitir`, { method: "POST" });
      aplicar(await appApi(`/egresos/${eg.id}`));
      if (r.avisos?.length) show("Liquidación final generada. Falta cerrarla: " + r.avisos.join(" "), true);
      else show("Liquidación final emitida con su recibo.");
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const verDocs = async () => { try { setDocs(await appApi(`/egresos/${eg.id}/documentos`)); } catch (e) { fail(e); } };
  const entregado = async () => { try { setEg(await appApi(`/egresos/${eg.id}/art80`, { method: "POST", body: {} })); show("Entrega del certificado registrada."); } catch (e) { fail(e); } };

  const res = eg?.resultado;
  const crit = eg?.criterios_vigentes || {};
  const emitida = eg?.estado === "emitida";
  const sinCalculo = eg && (!res || res.conceptos.length === 0);

  return (
    <div>
      <button className="nm2-back" onClick={onClose}>← Volver a los egresos</button>
      <Disclaimer>{eg?.leyenda || "Borrador a validar con el profesional: no reemplaza el criterio del contador ni del abogado laboralista."}</Disclaimer>
      <div className="nm2-steps">{PASOS.map((p, i) => <span key={p} className={`nm2-step ${i === paso ? "is-on" : i < paso ? "is-done" : ""}`}>{i + 1}. {p}</span>)}</div>
      {error && <p className="nm-note nm-note-error">{error}</p>}

      {paso === 0 && (
        <div className="nm-card">
          {emps.length === 0 ? <Empty title="No hay empleados activos">Cargá o reactivá un legajo para registrar un egreso.</Empty> : (
            <>
              <div className="nm2-form">
                <Field label="Empleado" wide><select className="nm2-select" value={datos.employee_id} onChange={(e) => setDatos({ ...datos, employee_id: Number(e.target.value) })}>{emps.map((e) => <option key={e.id} value={e.id}>{e.nombre} · legajo {e.legajo}</option>)}</select></Field>
                <Field label="Fecha de egreso"><input className="nm2-input" type="date" value={datos.fecha_egreso} onChange={(e) => setDatos({ ...datos, fecha_egreso: e.target.value })} /></Field>
                <Field label="Causa"><select className="nm2-select" value={datos.causa} onChange={(e) => setDatos({ ...datos, causa: e.target.value })}>{Object.entries(causas).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                {datos.causa === "fin_plazo" && <Field label="Vencimiento pactado del plazo" hint="Si se rompe antes, la antigüedad se proyecta hasta esa fecha (art. 95)."><input className="nm2-input" type="date" value={datos.fecha_vencimiento_plazo} onChange={(e) => setDatos({ ...datos, fecha_vencimiento_plazo: e.target.value })} /></Field>}
              </div>
              {datos.causa === "sin_causa" && <Switch on={datos.preaviso_otorgado} onChange={(v) => setDatos({ ...datos, preaviso_otorgado: v })} label="Se otorgó el preaviso" hint="Si se otorgó, no se liquidan preaviso ni integración." />}
              <div className="nm-row" style={{ marginTop: 14 }}><button className="nm2-btn is-primary" disabled={busy || !datos.fecha_egreso || !datos.employee_id || !cierra} onClick={crear}>{busy ? "Calculando..." : "Continuar"}</button>
                {!cierra && <span className="nm-hint">Tu rol no puede registrar egresos.</span>}</div>
            </>
          )}
        </div>
      )}

      {paso === 1 && eg && (
        <div className="nm-card">
          <div className="nm-card-head"><div><h2>{eg.nombre}</h2><p>Egreso {shortDate(eg.fecha_egreso)} · {eg.causa_label}</p></div></div>
          <p className="nm-note nm-note-info" style={{ marginBottom: 12 }}>{eg.base?.sugerida?.fuente}</p>
          <div className="nm2-form">
            <Field label="Mejor remuneración mensual normal y habitual" hint="Base del art. 245, preaviso e integración."><input className="nm2-input" inputMode="decimal" value={base.remuneracion_base} onChange={(e) => setBase({ ...base, remuneracion_base: e.target.value })} /></Field>
            <Field label="Mayor remuneración del semestre" hint="Para el SAC proporcional."><input className="nm2-input" inputMode="decimal" value={base.mrmd} onChange={(e) => setBase({ ...base, mrmd: e.target.value })} /></Field>
            <Field label="Sueldo para vacaciones"><input className="nm2-input" inputMode="decimal" value={base.sueldo_vacaciones} onChange={(e) => setBase({ ...base, sueldo_vacaciones: e.target.value })} /></Field>
            <Field label="Tope del convenio (3 x promedio)" hint="Vacío = sin tope cargado en el convenio."><input className="nm2-input" inputMode="decimal" value={base.tope_cct} onChange={(e) => setBase({ ...base, tope_cct: e.target.value })} /></Field>
            <Field label="Días de vacaciones ya gozados este año"><input className="nm2-input" inputMode="decimal" value={base.dias_vacaciones_gozadas} onChange={(e) => setBase({ ...base, dias_vacaciones_gozadas: e.target.value })} /></Field>
            <Field label="Motivo si cambiaste algún valor"><input className="nm2-input" value={base.motivo} onChange={(e) => setBase({ ...base, motivo: e.target.value })} /></Field>
          </div>
          <div className="nm-row"><button className="nm2-btn" onClick={() => setPaso(0)} disabled={!!id}>Atrás</button><button className="nm2-btn is-primary" disabled={busy} onClick={guardarBase}>{busy ? "Calculando..." : "Calcular"}</button></div>
        </div>
      )}

      {paso === 2 && !eg && !error && <Loading />}
      {paso === 2 && eg && (
        <div className="nm-stack">
          {sinCalculo ? <div className="nm-card"><Empty title="Todavía no hay cálculo">Cargá la remuneración base en el paso 2.</Empty></div> : (
            <div className="nm-table-wrap"><table className="nm-table">
              <thead><tr><th>Concepto</th><th>Grupo</th><th>Aportes</th><th className="num">Importe</th></tr></thead>
              <tbody>{res.conceptos.map((c: any) => (
                <tr key={c.codigo}><td><strong>{c.nombre}</strong><small>{c.explicacion?.texto}</small></td><td>{GRUPO[c.grupo] || c.grupo}</td><td>{c.con_aportes ? <Pill tone="blue">Con aportes</Pill> : <Pill tone="gray">Sin aportes</Pill>}</td><td className="num">{ars(c.importe)}</td></tr>))}</tbody>
              <tfoot><tr><td colSpan={3}>Total de conceptos finales (sin los haberes del mes)</td><td className="num">{ars(res.total)}</td></tr></tfoot>
            </table></div>
          )}
          {(res?.alertas || []).map((a: any, i: number) => <p key={i} className={`nm-note ${a.nivel === "info" ? "nm-note-info" : "nm-note-warn"}`}>{a.mensaje}</p>)}
          {!emitida && cierra && (
            <div className="nm-card">
              <div className="nm-card-head"><div><h2>Criterios</h2><p>Cambian el cálculo al instante. Validalos con tu contador.</p></div></div>
              <Switch on={!!crit.sac_sobre_preaviso_integracion} onChange={(v) => criterio("sac_sobre_preaviso_integracion", v)} label="SAC sobre preaviso e integración" hint="Práctica mayoritaria: se suma 1/12." />
              <Switch on={!!crit.final_aportes_preaviso} onChange={(v) => criterio("final_aportes_preaviso", v)} label="El preaviso lleva aportes" hint="Se trata como remuneración a los aportes." />
              <Switch on={!!crit.vacaciones_dias_sin_redondeo} onChange={(v) => criterio("vacaciones_dias_sin_redondeo", v)} label="Días de vacaciones proporcionales sin redondear" hint="Si no, se redondean a días enteros." />
              <Switch on={crit.sac_divisor === "180"} onChange={(v) => criterio("sac_divisor", v ? "180" : "calendario")} label="SAC con divisor 180" hint="Por defecto se usan los días reales del semestre (181 o 184)." />
            </div>
          )}
          <div className="nm-row"><button className="nm2-btn" onClick={() => setPaso(1)} disabled={emitida}>Atrás</button><button className="nm2-btn is-primary" onClick={() => setPaso(3)} disabled={sinCalculo}>Continuar</button></div>
        </div>
      )}

      {paso === 3 && eg && res && (
        <div className="nm-stack">
          <div className="nm-card">
            <dl className="nm2-kv">
              <dt>Empleado</dt><dd>{eg.nombre}</dd><dt>Egreso</dt><dd>{shortDate(eg.fecha_egreso)}</dd><dt>Causa</dt><dd>{eg.causa_label}</dd>
              <dt>Remuneración base</dt><dd>{ars(res.entradas?.remuneracion_base)}</dd>
              {res.entradas?.tope_cct && <><dt>Tope del convenio</dt><dd>{ars(res.entradas.tope_cct)}</dd></>}
            </dl>
            <div className="nm2-total"><span>Total de conceptos finales</span><strong>{ars(res.total)}</strong></div>
            {eg.fal_aplica && <p className="nm-note nm-note-info" style={{ marginTop: 10 }}>Informativo: parte del preaviso, la integración y la indemnización podría quedar a cargo del Fondo de Asistencia Laboral. No se descuenta.</p>}
          </div>
          <div className="nm-row">
            <button className="nm2-btn" onClick={() => setPaso(2)}>Atrás</button>
            {!emitida && cierra && <button className="nm2-btn is-primary" disabled={busy} onClick={emitir}>{busy ? "Emitiendo..." : "Emitir recibo final"}</button>}
            {emitida && <Pill tone="green">Emitida</Pill>}
            <button className="nm2-btn" onClick={verDocs}>Ver certificado de trabajo</button>
          </div>
          {emitida && !eg.certificado_art80_fecha && cierra && (
            <p className="nm-note nm-note-warn">El certificado de trabajo (art. 80) se entrega dentro de los 30 días corridos: hasta el {shortDate(eg.limite_art80)}. <button className="nm-link" onClick={entregado}>Marcar como entregado</button></p>
          )}
          {eg.certificado_art80_fecha && <p className="nm-note nm-note-info">Certificado entregado el {shortDate(eg.certificado_art80_fecha)}.</p>}
          {docs && (
            <div className="nm-grid-2">
              <div className="nm-card"><div className="nm-card-head"><div><h2>{docs.certificado_trabajo.titulo}</h2></div><button className="nm2-btn is-small" onClick={() => window.print()}>Imprimir</button></div>
                <div className="nm2-doc">{docs.certificado_trabajo.texto}</div><p className="nm-hint">{docs.leyenda}</p></div>
              <div className="nm-card"><div className="nm-card-head"><div><h2>{docs.constancia_aportes.titulo}</h2></div></div>
                {docs.constancia_aportes.filas.length === 0 ? <Empty title="Sin liquidaciones">No hay períodos liquidados para este empleado.</Empty> : (
                  <div className="nm-table-wrap"><table className="nm-table"><thead><tr><th>Período</th><th className="num">Aportes</th><th className="num">Contrib.</th></tr></thead>
                    <tbody>{docs.constancia_aportes.filas.map((f: any, i: number) => <tr key={i}><td>{f.periodo}</td><td className="num">{ars(f.aportes_trabajador)}</td><td className="num">{ars(f.contribuciones_empleador)}</td></tr>)}</tbody></table></div>)}
                <p className="nm-hint">{docs.constancia_aportes.nota}</p></div>
            </div>
          )}
        </div>
      )}
      {node}
    </div>
  );
}
