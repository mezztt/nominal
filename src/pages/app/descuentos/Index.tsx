import { useCallback, useEffect, useState } from "react";
import { appApi, money, shortDate } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Tabs, numOrNull, strOrNull, useFlash } from "../../../components/ui";
import { Amount, EmpleadoSelect, Notes, useEmpleados } from "../../../components/g3/shared";
import MesAnio from "../../../components/MesAnio";
import "../../../g3.css";

interface Plan {
  id: number; empleado: { id: number; legajo: string; nombre: string }; tipo: string; tipo_label: string; monto_total: number; cuotas: number; cuota_monto: number;
  saldo: number; desde: string | null; estado: string; autorizacion: string | null; proxima_cuota: number; cuotas_restantes: number; pct_remuneracion: number | null;
  ultima_cuota: boolean; supera_20?: boolean; historial?: { id: number; importe: number; estado: string; periodo: string | null; origen: string }[];
}
interface Embargo {
  id: number; empleado: { id: number; legajo: string; nombre: string }; oficio_nro: string | null; juzgado: string | null; tipo: string; tipo_label: string; monto: number | null;
  porcentaje: number | null; desde: string | null; hasta: string | null; activo: boolean; retenido: number; falta: number | null; vence_pronto: boolean;
}
interface Sim { remuneracion: number; tope_20: number; comprometido: number; disponible: number; embargo_comun: number | null; smvm: number | null; aviso_embargo: string | null; cuota_propuesta?: number; entra?: boolean; cuotas_minimas?: number | null; recorte?: number }

type Tab = "planes" | "embargos" | "simulador";
const TIPOS: [string, string][] = [["adelanto", "Adelanto de sueldo"], ["prestamo", "Préstamo"], ["cuota_sindical_extra", "Cuota sindical extra"], ["otro", "Otro descuento"]];

export default function DescuentosPage() {
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<Tab>("planes");
  const empleados = useEmpleados("/descuentos/empleados");
  return (
    <section className="products-page">
      <PageHeader eyebrow="ADELANTOS, PRÉSTAMOS Y EMBARGOS" title="Descuentos y embargos"
        subtitle="Las retenciones voluntarias no pueden pasar del 20% de la remuneración (2% la cuota sindical). El embargo común sigue la escala del Decreto 484/87." />
      <div className="g3-tabs-wrap"><Tabs<Tab> value={tab} onChange={setTab} options={[["planes", "Planes de descuento"], ["embargos", "Embargos"], ["simulador", "Simulador"]]} /></div>
      {tab === "planes" && <Planes empleados={empleados} fail={fail} show={show} />}
      {tab === "embargos" && <Embargos empleados={empleados} fail={fail} show={show} />}
      {tab === "simulador" && <Simulador empleados={empleados} fail={fail} />}
      <p className="nm-muted" style={{ marginTop: 16 }}>Nominal no calcula cuotas alimentarias: las fija el juez. Si el oficio de un embargo común trae un monto total, cargalo y se deja de retener al cubrirlo. Validá los embargos con tu abogado.</p>
      {flash}
    </section>
  );
}

// ------------------------------------------------------------
function Planes({ empleados, fail, show }: { empleados: { id: number; legajo: string; nombre: string }[]; fail: (e: unknown) => void; show: (t: string) => void }) {
  const [estado, setEstado] = useState("activo");
  const [rows, setRows] = useState<Plan[] | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [det, setDet] = useState<Plan | null>(null);
  const load = useCallback(() => { appApi<Plan[]>(`/descuentos?estado=${estado}`).then(setRows).catch(fail); }, [estado, fail]);
  useEffect(() => { setRows(null); load(); }, [load]);
  async function abrir(p: Plan) { try { setDet(await appApi<Plan>(`/descuentos/${p.id}`)); } catch (e) { fail(e); } }
  const superan = (rows || []).filter((r) => r.supera_20).length;
  return (
    <>
      <div className="nm-toolbar">
        <div className="nm-filters">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado"><option value="activo">Activos</option><option value="finalizado">Finalizados</option><option value="cancelado">Cancelados</option><option value="todos">Todos</option></select>
        </div>
        <button className="primary-button" onClick={() => setNuevo(true)}>+ Nuevo plan</button>
      </div>
      {superan > 0 && <Notes items={[`${superan} plan(es) hacen que un empleado supere el 20% de su remuneración: al liquidar se recorta la última cuota y queda saldo.`]} />}
      {!rows ? <Loading /> : rows.length === 0 ? <Empty title="No hay planes">Cargá un adelanto o un préstamo con «Nuevo plan». Se descuentan solos en cada liquidación.</Empty> : (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>Empleado</th><th>Tipo</th><th className="num">Total</th><th className="num">Cuota</th><th className="num">Saldo</th><th>Próxima</th><th>Estado</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="is-click" onClick={() => abrir(p)}>
                  <td><strong>{p.empleado.nombre}</strong><small>Legajo {p.empleado.legajo}</small></td>
                  <td>{p.tipo_label}{!p.autorizacion && <small>Sin autorización cargada</small>}</td>
                  <td className="num">{money(p.monto_total)}</td><td className="num">{money(p.cuota_monto)}</td><td className="num"><strong>{money(p.saldo)}</strong></td>
                  <td>{p.estado === "activo" ? <>{money(p.proxima_cuota)}{p.pct_remuneracion !== null && <small>{p.pct_remuneracion}% del sueldo</small>}{p.ultima_cuota && <small>Última cuota</small>}</> : "—"}</td>
                  <td>{p.estado === "activo" ? <Pill tone={p.supera_20 ? "red" : "green"}>{p.supera_20 ? "Pasa el 20%" : "Activo"}</Pill> : <Pill tone="gray">{p.estado}</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nuevo && <PlanForm empleados={empleados} onClose={() => setNuevo(false)} onSaved={(aviso) => { setNuevo(false); load(); show(aviso || "Plan guardado"); }} />}
      {det && <PlanDetalle plan={det} onClose={() => setDet(null)} onChanged={(msg) => { setDet(null); load(); show(msg); }} />}
    </>
  );
}

function PlanForm({ empleados, onClose, onSaved }: { empleados: { id: number; legajo: string; nombre: string }[]; onClose: () => void; onSaved: (aviso?: string) => void }) {
  const [emp, setEmp] = useState<number | null>(null);
  const [tipo, setTipo] = useState("adelanto");
  const [monto, setMonto] = useState("");
  const [cuotas, setCuotas] = useState("1");
  const [cuota, setCuota] = useState("");
  const [desde, setDesde] = useState("");
  const [aut, setAut] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    setError(""); setSaving(true);
    try {
      const r = await appApi<{ aviso?: string }>("/descuentos", { method: "POST", body: { empleado_id: emp, tipo, monto_total: numOrNull(monto), cuotas: Number(cuotas) || 1, cuota_monto: numOrNull(cuota), desde: desde ? `${desde}-01` : null, autorizacion: strOrNull(aut) } });
      onSaved(r.aviso);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="NUEVO PLAN" title="Adelanto, préstamo u otro descuento" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form">
        <EmpleadoSelect rows={empleados} value={emp} onChange={setEmp} />
        <Field label="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Monto total ($)"><input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
        <div className="g3-form-grid">
          <Field label="Cantidad de cuotas"><input inputMode="numeric" value={cuotas} onChange={(e) => setCuotas(e.target.value)} /></Field>
          <Field label="Valor de la cuota ($)" hint="Vacío: monto ÷ cuotas"><input inputMode="decimal" value={cuota} onChange={(e) => setCuota(e.target.value)} /></Field>
        </div>
        <Field label="Primera cuota (mes)"><MesAnio value={desde} onChange={setDesde} /></Field>
        <Field label="Autorización del trabajador" hint={tipo === "adelanto" ? "Recomendado: fecha y forma en que consta." : "Obligatoria: sin su consentimiento no se puede descontar."}>
          <input value={aut} onChange={(e) => setAut(e.target.value)} placeholder="Ej.: nota firmada el 02/10/2026" />
        </Field>
        {error && <div className="nm-note nm-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

function PlanDetalle({ plan, onClose, onChanged }: { plan: Plan; onClose: () => void; onChanged: (msg: string) => void }) {
  const [importe, setImporte] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  async function accion(a: "pago" | "pago_total" | "cancelar") {
    setError("");
    try {
      await appApi(`/descuentos/${plan.id}/cuotas`, { method: "POST", body: { accion: a, importe: numOrNull(importe), motivo: strOrNull(motivo) } });
      onChanged(a === "cancelar" ? "Plan cancelado" : "Pago registrado");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo registrar"); }
  }
  return (
    <Modal eyebrow={plan.tipo_label.toUpperCase()} title={plan.empleado.nombre} onClose={onClose} size="wide">
      <div className="nm-kpis">
        <div className="nm-kpi"><span>Total</span><strong>{money(plan.monto_total)}</strong><small>{plan.cuotas} cuota(s)</small></div>
        <div className="nm-kpi"><span>Saldo</span><strong>{money(plan.saldo)}</strong><small>{plan.cuotas_restantes} cuota(s) restantes</small></div>
        <div className="nm-kpi"><span>Próxima cuota</span><strong>{money(plan.proxima_cuota)}</strong><small>{plan.desde ? `desde ${shortDate(plan.desde)}` : ""}</small></div>
      </div>
      {plan.autorizacion && <p className="nm-muted">Autorización: {plan.autorizacion}</p>}
      <h3 style={{ margin: "8px 0" }}>Historial</h3>
      {(plan.historial || []).length === 0 ? <p className="nm-muted">Todavía no se descontó ninguna cuota.</p> : (
        <div className="nm-table-wrap"><table className="nm-table"><thead><tr><th>Período</th><th>Origen</th><th className="num">Importe</th><th>Estado</th></tr></thead>
          <tbody>{plan.historial!.map((h) => <tr key={h.id}><td>{h.periodo || "—"}</td><td>{h.origen}</td><td className="num"><Amount value={h.importe} /></td><td>{h.estado === "recortada" ? <Pill tone="orange">Recortada por el tope</Pill> : <Pill tone="green">Descontada</Pill>}</td></tr>)}</tbody></table></div>
      )}
      {plan.estado === "activo" && (
        <div style={{ marginTop: 16 }}>
          <div className="g3-inline">
            <Field label="Pago directo del empleado ($)"><input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} /></Field>
            <button className="secondary-button" onClick={() => accion("pago")}>Registrar pago</button>
            <button className="secondary-button" onClick={() => accion("pago_total")}>Saldar todo ({money(plan.saldo)})</button>
          </div>
          <div className="g3-inline" style={{ marginTop: 12 }}>
            <Field label="Motivo para cancelar el plan"><input value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Field>
            <button className="nm-danger-button" onClick={() => accion("cancelar")}>Cancelar plan</button>
          </div>
        </div>
      )}
      {error && <div className="nm-note nm-note-error" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

// ------------------------------------------------------------
function Embargos({ empleados, fail, show }: { empleados: { id: number; legajo: string; nombre: string }[]; fail: (e: unknown) => void; show: (t: string) => void }) {
  const [activos, setActivos] = useState(true);
  const [rows, setRows] = useState<Embargo[] | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const load = useCallback(() => { appApi<Embargo[]>(`/embargos?activos=${activos}`).then(setRows).catch(fail); }, [activos, fail]);
  useEffect(() => { setRows(null); load(); }, [load]);
  async function baja(e: Embargo) {
    try { await appApi(`/embargos/${e.id}`, { method: "PUT", body: { activo: !e.activo } }); load(); show(e.activo ? "Embargo dado de baja" : "Embargo reactivado"); } catch (x) { fail(x); }
  }
  return (
    <>
      <div className="nm-toolbar">
        <div className="nm-filters"><select value={activos ? "1" : "0"} onChange={(e) => setActivos(e.target.value === "1")} aria-label="Mostrar"><option value="1">Vigentes</option><option value="0">Todos</option></select></div>
        <button className="primary-button" onClick={() => setNuevo(true)}>+ Registrar embargo</button>
      </div>
      {!rows ? <Loading /> : rows.length === 0 ? <Empty title="No hay embargos">Cuando llegue un oficio, registralo acá: la retención se calcula sola en cada liquidación.</Empty> : (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>Empleado</th><th>Oficio y juzgado</th><th>Tipo</th><th>Vigencia</th><th className="num">Retenido</th><th></th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.empleado.nombre}</strong><small>Legajo {e.empleado.legajo}</small></td>
                  <td>{e.oficio_nro || "—"}<small>{e.juzgado}</small></td>
                  <td>{e.tipo_label}<small>{e.monto ? (e.tipo === "alimentos" ? `${money(e.monto)} por mes` : `Total del oficio ${money(e.monto)}`) : e.porcentaje ? `${e.porcentaje}% (lo fija el juez)` : "Según escala"}</small></td>
                  <td>{shortDate(e.desde)} a {e.hasta ? shortDate(e.hasta) : "sin fecha"}{e.vence_pronto && <small><Pill tone="orange">Vence pronto</Pill></small>}{!e.activo && <small><Pill tone="gray">Dado de baja</Pill></small>}</td>
                  <td className="num">{money(e.retenido)}{e.falta !== null && <small>Faltan {money(e.falta)}</small>}</td>
                  <td><button className="secondary-button" onClick={() => baja(e)}>{e.activo ? "Dar de baja" : "Reactivar"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nuevo && <EmbargoForm empleados={empleados} onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); load(); show("Embargo registrado"); }} />}
    </>
  );
}

function EmbargoForm({ empleados, onClose, onSaved }: { empleados: { id: number; legajo: string; nombre: string }[]; onClose: () => void; onSaved: () => void }) {
  const [emp, setEmp] = useState<number | null>(null);
  const [tipo, setTipo] = useState("comun");
  const [oficio, setOficio] = useState("");
  const [juzgado, setJuzgado] = useState("");
  const [monto, setMonto] = useState("");
  const [pct, setPct] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [error, setError] = useState("");
  async function save() {
    setError("");
    try {
      await appApi("/embargos", { method: "POST", body: { empleado_id: emp, tipo, oficio_nro: strOrNull(oficio), juzgado: strOrNull(juzgado), monto: numOrNull(monto), porcentaje: numOrNull(pct), desde: desde || null, hasta: hasta || null } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  return (
    <Modal eyebrow="EMBARGO" title="Registrar un embargo" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <EmpleadoSelect rows={empleados} value={emp} onChange={setEmp} />
        <Field label="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="comun">Común (escala del Decreto 484/87)</option><option value="alimentos">Alimentos (lo fija el juez)</option></select></Field>
        <div className="g3-form-grid">
          <Field label="N° de oficio"><input value={oficio} onChange={(e) => setOficio(e.target.value)} /></Field>
          <Field label="Juzgado"><input value={juzgado} onChange={(e) => setJuzgado(e.target.value)} /></Field>
        </div>
        {tipo === "comun" ? (
          <Field label="Monto total del oficio ($, opcional)" hint="Si lo cargás, se deja de retener cuando se cubre."><input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
        ) : (
          <div className="g3-form-grid">
            <Field label="Monto fijo por mes ($)"><input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
            <Field label="o porcentaje (%)" hint="Sobre la remuneración después de aportes y Ganancias"><input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
          </div>
        )}
        <div className="g3-form-grid">
          <Field label="Desde"><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Field>
          <Field label="Hasta (si el oficio lo dice)"><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Field>
        </div>
        {error && <div className="nm-note nm-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------
function Simulador({ empleados, fail }: { empleados: { id: number; legajo: string; nombre: string }[]; fail: (e: unknown) => void }) {
  const [emp, setEmp] = useState<number | null>(null);
  const [rem, setRem] = useState("");
  const [total, setTotal] = useState("");
  const [cuotas, setCuotas] = useState("3");
  const [sac, setSac] = useState("");
  const [res, setRes] = useState<Sim | null>(null);
  async function run() {
    const q = new URLSearchParams();
    if (emp) q.set("empleado_id", String(emp));
    if (rem) q.set("remuneracion", String(numOrNull(rem) ?? ""));
    if (total) { q.set("monto_total", String(numOrNull(total) ?? "")); q.set("cuotas", cuotas || "1"); }
    if (sac) q.set("sac", String(numOrNull(sac) ?? ""));
    try { setRes(await appApi<Sim>(`/descuentos/simular?${q.toString()}`)); } catch (e) { setRes(null); fail(e); }
  }
  return (
    <>
      <div className="nm-card" style={{ marginBottom: 16 }}>
        <div className="g3-inline">
          <EmpleadoSelect rows={empleados} value={emp} onChange={setEmp} label="Empleado (opcional)" />
          <Field label="Remuneración bruta ($)" hint="Vacío: la última liquidada"><input inputMode="decimal" value={rem} onChange={(e) => setRem(e.target.value)} /></Field>
          <Field label="Monto a descontar ($)"><input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} /></Field>
          <Field label="En cuántas cuotas"><input inputMode="numeric" className="g3-small-input" value={cuotas} onChange={(e) => setCuotas(e.target.value)} /></Field>
          <Field label="Parte que es aguinaldo ($)"><input inputMode="decimal" value={sac} onChange={(e) => setSac(e.target.value)} /></Field>
          <button className="primary-button" onClick={run}>Calcular</button>
        </div>
      </div>
      {res && (
        <>
          <div className="nm-kpis">
            <div className="nm-kpi"><span>Tope del 20%</span><strong>{money(res.tope_20)}</strong><small>de {money(res.remuneracion)}</small></div>
            <div className="nm-kpi"><span>Ya comprometido</span><strong>{money(res.comprometido)}</strong><small>cuotas activas</small></div>
            <div className="nm-kpi"><span>Disponible</span><strong>{money(res.disponible)}</strong></div>
            <div className="nm-kpi"><span>Embargo común estimado</span><strong>{res.embargo_comun === null ? "—" : money(res.embargo_comun)}</strong><small>{res.smvm ? `SMVM ${money(res.smvm)}` : ""}</small></div>
          </div>
          {res.aviso_embargo && <Notes items={[res.aviso_embargo]} />}
          {res.cuota_propuesta !== undefined && (
            <div className={`nm-note ${res.entra ? "nm-note-info" : "nm-note-warn"}`}>
              {res.entra ? `La cuota de ${money(res.cuota_propuesta)} entra en el tope.` : `La cuota de ${money(res.cuota_propuesta)} no entra: se pasa por ${money(res.recorte || 0)}. ${res.cuotas_minimas ? `Hacé al menos ${res.cuotas_minimas} cuotas.` : "No queda margen disponible."}`}
            </div>
          )}
        </>
      )}
    </>
  );
}
