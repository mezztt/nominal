import { Fragment, useCallback, useEffect, useState } from "react";
import { appApi, currentPeriod, money } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Tabs, numOrNull, strOrNull, useFlash } from "../../../components/ui";
import { Amount, EmpleadoSelect, MonthInput, Notes, Steps, useEmpleados } from "../../../components/g3/shared";
import "../../../g3.css";

interface Fila { id: number; legajo: string; nombre: string; estimado: boolean; bruto_acum?: number; neta_acum?: number; impuesto_acum?: number; retencion_mes?: number; supera_umbral: boolean; error?: string; alertas?: string[] }
interface Retenciones { periodo: string; empleados: Fila[]; supera_umbral: number; total_retenido: number; faltantes: string[] }
interface Mes { mes: number; mes_nombre: string; bruto_acum: number; aportes_acum: number; deducciones_acum: number; neta_acum: number; impuesto_acum: number; retenido_acum: number; retencion_mes: number; origen: string; detalle: { etiqueta: string; importe: number; total?: boolean }[]; alertas: string[] }
interface Ficha { empleado: { id: number; nombre: string }; anio: number; meses: Mes[]; total_retenido: number }
interface Deduccion { id?: number; tipo: string; importe_anual: number | string; mes_desde: number | string; comprobante: string | null }
interface F572 { anio: number; estado: string | null; deducciones: Deduccion[]; cargas: { conyuge: boolean; hijos: number; hijos_incap: number; otras: number }; tipos: Record<string, string> }
interface Calc { bruto_acum: number; neta_acum: number; impuesto_acum: number; retencion_mes: number; devolucion: boolean; alertas: string[]; detalle: { etiqueta: string; importe: number; total?: boolean }[]; estimado: boolean }
interface Sim { actual: Calc; con_aumento: Calc; mayor_retencion: number; aviso: string }
interface Ajuste { anio: number; empleados: { id: number; nombre: string; mes_nombre?: string; impuesto_recalculado?: number; retenido?: number; diferencia?: number; accion?: string; error?: string }[]; aviso: string }

type Tab = "retenciones" | "ficha" | "f572" | "simulador";

export default function GananciasPage() {
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<Tab>("retenciones");
  const [periodo, setPeriodo] = useState(currentPeriod());
  const [empId, setEmpId] = useState<number | null>(null);
  const empleados = useEmpleados("/ganancias/empleados");
  const anio = Number(periodo.slice(0, 4));

  function abrirFicha(id: number) { setEmpId(id); setTab("ficha"); }

  return (
    <section className="products-page">
      <PageHeader eyebrow="GANANCIAS 4ª CATEGORÍA" title="Ganancias" subtitle="Retención mensual acumulada con la escala del art. 94 de ARCA, las cargas de familia y el F.572 de cada empleado.">
        <MonthPicker value={periodo} onChange={setPeriodo} />
      </PageHeader>
      <div className="g3-tabs-wrap">
        <Tabs<Tab> value={tab} onChange={setTab} options={[["retenciones", "Retenciones del mes"], ["ficha", "Ficha y acumulados"], ["f572", "F.572"], ["simulador", "Simular aumento"]]} />
      </div>
      {tab === "retenciones" && <Retenciones periodo={periodo} onFicha={abrirFicha} fail={fail} />}
      {tab === "ficha" && <FichaTab anio={anio} empleados={empleados} empId={empId} setEmpId={setEmpId} fail={fail} show={show} />}
      {tab === "f572" && <F572Tab anio={anio} empleados={empleados} empId={empId} setEmpId={setEmpId} fail={fail} show={show} />}
      {tab === "simulador" && <Simulador periodo={periodo} empleados={empleados} empId={empId} setEmpId={setEmpId} fail={fail} />}
      <p className="nm-muted" style={{ marginTop: 16 }}>El cálculo usa los parámetros cargados para el período; el responsable de la liquidación es el empleador y su profesional. Nominal no presenta el F.649 ni gestiona el SiRADIG.</p>
      {flash}
    </section>
  );
}

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <MonthInput value={value} onChange={onChange} label="Mes" />;
}

// ------------------------------------------------------------
function Retenciones({ periodo, onFicha, fail }: { periodo: string; onFicha: (id: number) => void; fail: (e: unknown) => void }) {
  const [data, setData] = useState<Retenciones | null>(null);
  useEffect(() => {
    setData(null);
    appApi<Retenciones>(`/ganancias/retenciones/${periodo}`).then(setData).catch(fail);
  }, [periodo, fail]);
  if (!data) return <Loading />;
  return (
    <>
      <Notes items={data.faltantes.length ? [`Faltan parámetros de Ganancias para este mes: ${data.faltantes.join("; ")}. Pedile a Mezztt que los publique: sin ellos no se puede calcular la retención.`] : []} tone="error" />
      <div className="nm-kpis">
        <div className="nm-kpi"><span>Empleados</span><strong>{data.empleados.length}</strong><small>activos en la empresa</small></div>
        <div className={`nm-kpi ${data.supera_umbral ? "is-warn" : ""}`}><span>Superan el umbral</span><strong>{data.supera_umbral}</strong><small>ganancia neta sujeta mayor a cero</small></div>
        <div className="nm-kpi"><span>Retenido ya liquidado</span><strong>{money(data.total_retenido)}</strong><small>solo meses calculados</small></div>
      </div>
      {data.empleados.length === 0 ? <Empty title="Todavía no hay empleados">Cargalos en Legajos para ver su retención.</Empty> : (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>Empleado</th><th className="num">Bruto acumulado</th><th className="num">Neta sujeta</th><th className="num">Impuesto acumulado</th><th className="num">Retención del mes</th><th>Estado</th></tr></thead>
            <tbody>
              {data.empleados.map((e) => (
                <tr key={e.id} className="is-click" onClick={() => onFicha(e.id)}>
                  <td><strong>{e.nombre}</strong><small>Legajo {e.legajo}</small></td>
                  {e.error ? <td colSpan={4}><span className="nm-muted">{e.error}</span></td> : <>
                    <td className="num"><Amount value={e.bruto_acum} /></td><td className="num"><Amount value={e.neta_acum} /></td>
                    <td className="num"><Amount value={e.impuesto_acum} /></td><td className="num"><Amount value={e.retencion_mes} /></td></>}
                  <td>{e.supera_umbral ? <Pill tone="orange">Supera el umbral</Pill> : <Pill tone="gray">No retiene</Pill>}{e.estimado && <small>Estimado con el último sueldo</small>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------
function FichaTab({ anio, empleados, empId, setEmpId, fail, show }: { anio: number; empleados: { id: number; legajo: string; nombre: string }[]; empId: number | null; setEmpId: (n: number | null) => void; fail: (e: unknown) => void; show: (t: string) => void }) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [modal, setModal] = useState(false);
  const [ajuste, setAjuste] = useState<Ajuste | null>(null);
  const load = useCallback(() => {
    if (!empId) { setFicha(null); return; }
    appApi<Ficha>(`/ganancias/acumulado/${empId}?anio=${anio}`).then(setFicha).catch(fail);
  }, [empId, anio, fail]);
  useEffect(() => { setAjuste(null); load(); }, [load]);

  async function calcularAjuste() {
    try { setAjuste(await appApi<Ajuste>("/ganancias/ajuste-anual", { method: "POST", body: { anio, empleado_id: empId } })); } catch (e) { fail(e); }
  }
  return (
    <>
      <div className="nm-card" style={{ marginBottom: 16 }}>
        <div className="g3-inline">
          <EmpleadoSelect rows={empleados} value={empId} onChange={setEmpId} />
          {empId && <button className="secondary-button" onClick={() => setModal(true)}>Cargar acumulado previo</button>}
          {empId && <button className="secondary-button" onClick={calcularAjuste}>Ajuste anual {anio}</button>}
        </div>
      </div>
      {ajuste && (
        <div className="nm-card" style={{ marginBottom: 16 }}>
          <div className="nm-card-head"><div><h2>Ajuste anual {ajuste.anio}</h2><p>{ajuste.aviso}</p></div></div>
          {ajuste.empleados.length === 0 ? <Empty title="Sin acumulados">No hay meses calculados en {ajuste.anio}.</Empty> : ajuste.empleados.map((x) => (
            <div key={x.id} className="nm-spread" style={{ padding: "6px 0" }}>
              <span>{x.nombre}{x.mes_nombre ? ` (hasta ${x.mes_nombre})` : ""}</span>
              {x.error ? <span className="nm-muted">{x.error}</span> : <span>Impuesto <Amount value={x.impuesto_recalculado} /> · retenido <Amount value={x.retenido} /> · <strong>{x.accion}</strong> <Amount value={x.diferencia} /></span>}
            </div>
          ))}
        </div>
      )}
      {!empId ? <Empty title="Elegí un empleado">Vas a ver mes a mes cuánto acumuló y cuánto se le retuvo.</Empty> : !ficha ? <Loading /> : ficha.meses.length === 0 ? (
        <Empty title={`Sin retenciones calculadas en ${anio}`}>Se arman solas al calcular la liquidación. Si el empleado ya cobró sueldos este año fuera de Nominal, cargá su acumulado previo.</Empty>
      ) : (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>Mes</th><th className="num">Bruto acum.</th><th className="num">Aportes acum.</th><th className="num">Deducciones acum.</th><th className="num">Neta sujeta</th><th className="num">Impuesto acum.</th><th className="num">Retención del mes</th><th>Origen</th></tr></thead>
            <tbody>
              {ficha.meses.map((m) => (
                <Fragment key={m.mes}>
                  <tr className="is-click" onClick={() => setAbierto(abierto === m.mes ? null : m.mes)}>
                    <td><strong>{m.mes_nombre}</strong></td>
                    <td className="num"><Amount value={m.bruto_acum} /></td><td className="num"><Amount value={m.aportes_acum} /></td><td className="num"><Amount value={m.deducciones_acum} /></td>
                    <td className="num"><Amount value={m.neta_acum} /></td><td className="num"><Amount value={m.impuesto_acum} /></td><td className="num"><Amount value={m.retencion_mes} /></td>
                    <td>{m.origen === "manual" ? <Pill tone="blue">Cargado a mano</Pill> : <Pill tone="violet">Liquidación</Pill>}</td>
                  </tr>
                  {abierto === m.mes && (
                    <tr><td colSpan={8}>
                      <strong>¿Cómo se calculó?</strong>
                      {m.detalle.length ? <Steps rows={m.detalle} /> : <p className="nm-muted">Acumulado cargado a mano: no tiene detalle de cálculo.</p>}
                      <Notes items={m.alertas} />
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && empId && <AcumuladoModal empId={empId} anio={anio} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); show("Acumulado guardado"); }} />}
    </>
  );
}

function AcumuladoModal({ empId, anio, onClose, onSaved }: { empId: number; anio: number; onClose: () => void; onSaved: () => void }) {
  const [mes, setMes] = useState(String(Math.max(new Date().getMonth(), 1)));
  const [bruto, setBruto] = useState("");
  const [aportes, setAportes] = useState("");
  const [retenido, setRetenido] = useState("");
  const [error, setError] = useState("");
  async function save() {
    setError("");
    try {
      await appApi(`/ganancias/acumulado/${empId}`, { method: "POST", body: { anio, mes: Number(mes), bruto_acum: numOrNull(bruto) ?? 0, aportes_acum: numOrNull(aportes) ?? 0, retenido_acum: numOrNull(retenido) ?? 0 } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  return (
    <Modal eyebrow="ACUMULADO PREVIO" title="Meses liquidados fuera de Nominal" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <p className="nm-muted">Cargá lo acumulado de enero hasta el mes que ya liquidaste. Es la base de la retención del mes siguiente.</p>
        <Field label="Acumulado hasta el mes (año anterior al actual no hace falta)">
          <select value={mes} onChange={(e) => setMes(e.target.value)}>{["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"].map((n, i) => <option key={n} value={i + 1}>{n} {anio}</option>)}</select>
        </Field>
        <Field label="Ganancia bruta acumulada ($)"><input inputMode="decimal" value={bruto} onChange={(e) => setBruto(e.target.value)} /></Field>
        <Field label="Aportes acumulados: jubilación, INSSJP, obra social, sindicato ($)"><input inputMode="decimal" value={aportes} onChange={(e) => setAportes(e.target.value)} /></Field>
        <Field label="Ganancias retenido hasta ese mes ($)"><input inputMode="decimal" value={retenido} onChange={(e) => setRetenido(e.target.value)} /></Field>
        {error && <div className="nm-note nm-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------
function F572Tab({ anio, empleados, empId, setEmpId, fail, show }: { anio: number; empleados: { id: number; legajo: string; nombre: string }[]; empId: number | null; setEmpId: (n: number | null) => void; fail: (e: unknown) => void; show: (t: string) => void }) {
  const [f, setF] = useState<F572 | null>(null);
  const [rows, setRows] = useState<Deduccion[]>([]);
  const [estado, setEstado] = useState("borrador");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!empId) { setF(null); return; }
    appApi<F572>(`/ganancias/f572/${empId}?anio=${anio}`).then((r) => { setF(r); setRows(r.deducciones); setEstado(r.estado || "borrador"); }).catch(fail);
  }, [empId, anio, fail]);

  function upd(i: number, patch: Partial<Deduccion>) { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r))); }
  async function save() {
    if (!empId) return;
    setSaving(true);
    try {
      const body = { anio, estado, deducciones: rows.map((r) => ({ tipo: r.tipo, importe_anual: numOrNull(r.importe_anual) ?? 0, mes_desde: Number(r.mes_desde) || 1, comprobante: strOrNull(r.comprobante) })) };
      const r = await appApi<F572>(`/ganancias/f572/${empId}`, { method: "POST", body });
      setF(r); setRows(r.deducciones); setEstado(r.estado || "borrador");
      show("F.572 guardado");
    } catch (e) { fail(e); } finally { setSaving(false); }
  }
  const cargas = f?.cargas;
  return (
    <>
      <div className="nm-card" style={{ marginBottom: 16 }}>
        <div className="g3-inline"><EmpleadoSelect rows={empleados} value={empId} onChange={setEmpId} /></div>
      </div>
      {!empId ? <Empty title="Elegí un empleado">Acá cargás las deducciones que el empleado informa en el F.572 (o que te pasa en papel).</Empty> : !f ? <Loading /> : (
        <div className="nm-card">
          <div className="nm-card-head"><div><h2>F.572 {anio}</h2><p>Las deducciones en borrador no se aplican. Con «enviado» o «aprobado» entran en la retención.</p></div>
            <Pill tone={estado === "aprobado" ? "green" : estado === "enviado" ? "blue" : "gray"}>{estado}</Pill></div>
          <p className="nm-muted">Cargas de familia (se editan en Legajos): {cargas && (cargas.conyuge || cargas.hijos || cargas.hijos_incap) ? [cargas.conyuge ? "cónyuge" : "", cargas.hijos ? `${cargas.hijos} hijo(s)` : "", cargas.hijos_incap ? `${cargas.hijos_incap} hijo(s) incapacitado(s)` : ""].filter(Boolean).join(", ") : "ninguna marcada a cargo en Ganancias"}.</p>
          {rows.length === 0 && <Empty title="Sin deducciones">Agregá seguros, alquiler, gastos médicos u otras deducciones del año.</Empty>}
          <div style={{ display: "grid", gap: 10, margin: "12px 0" }}>
            {rows.map((r, i) => (
              <div key={i} className="g3-form-grid nm-card" style={{ padding: 12, boxShadow: "none" }}>
                <Field label="Tipo"><select value={r.tipo} onChange={(e) => upd(i, { tipo: e.target.value })}>{Object.entries(f.tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Importe anual ($)"><input inputMode="decimal" value={r.importe_anual} onChange={(e) => upd(i, { importe_anual: e.target.value })} /></Field>
                <Field label="Desde el mes (1 a 12)"><input inputMode="numeric" value={r.mes_desde} onChange={(e) => upd(i, { mes_desde: e.target.value })} /></Field>
                <Field label="Comprobante"><input value={r.comprobante || ""} onChange={(e) => upd(i, { comprobante: e.target.value })} /></Field>
                <div><button className="secondary-button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Quitar</button></div>
              </div>
            ))}
          </div>
          <div className="g3-inline">
            <button className="secondary-button" onClick={() => setRows((rs) => [...rs, { tipo: "alquiler", importe_anual: "", mes_desde: 1, comprobante: "" }])}>+ Agregar deducción</button>
            <Field label="Estado"><select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="borrador">Borrador</option><option value="enviado">Enviado por el empleado</option><option value="aprobado">Aprobado por el contador</option></select></Field>
            <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar F.572"}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------
function Simulador({ periodo, empleados, empId, setEmpId, fail }: { periodo: string; empleados: { id: number; legajo: string; nombre: string }[]; empId: number | null; setEmpId: (n: number | null) => void; fail: (e: unknown) => void }) {
  const [pct, setPct] = useState("10");
  const [gravado, setGravado] = useState("");
  const [res, setRes] = useState<Sim | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!empId) return;
    setBusy(true);
    try {
      setRes(await appApi<Sim>("/ganancias/simular", { method: "POST", body: { empleado_id: empId, anio: Number(periodo.slice(0, 4)), mes: Number(periodo.slice(5, 7)), aumento_pct: numOrNull(pct) ?? 0, gravado_mes: numOrNull(gravado) } }));
    } catch (e) { setRes(null); fail(e); } finally { setBusy(false); }
  }
  return (
    <>
      <div className="nm-card" style={{ marginBottom: 16 }}>
        <div className="g3-inline">
          <EmpleadoSelect rows={empleados} value={empId} onChange={setEmpId} />
          <Field label="Aumento (%)"><input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
          <Field label="Sueldo gravado del mes ($, opcional)" hint="Vacío: el último liquidado"><input inputMode="decimal" value={gravado} onChange={(e) => setGravado(e.target.value)} /></Field>
          <button className="primary-button" disabled={!empId || busy} onClick={run}>{busy ? "Calculando..." : "Simular"}</button>
        </div>
      </div>
      {res && (
        <>
          <div className="nm-kpis">
            <div className="nm-kpi"><span>Retención hoy</span><strong>{money(res.actual.retencion_mes)}</strong></div>
            <div className="nm-kpi"><span>Con el aumento</span><strong>{money(res.con_aumento.retencion_mes)}</strong></div>
            <div className="nm-kpi is-warn"><span>Diferencia</span><strong>{money(res.mayor_retencion)}</strong><small>por mes</small></div>
          </div>
          <div className="g3-cols">
            <div className="nm-card"><h2>Hoy</h2><Steps rows={res.actual.detalle} /></div>
            <div className="nm-card"><h2>Con el aumento</h2><Steps rows={res.con_aumento.detalle} /></div>
          </div>
          <p className="nm-muted" style={{ marginTop: 12 }}>{res.aviso}</p>
        </>
      )}
    </>
  );
}
