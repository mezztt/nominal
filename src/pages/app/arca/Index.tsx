import { useCallback, useEffect, useState } from "react";
import { appApi, downloadFile, getEmployerId, money, shortDate } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Tabs, strOrNull, useFlash } from "../../../components/ui";
import { Amount, MonthInput, Notes } from "../../../components/g3/shared";
import MesAnio from "../../../components/MesAnio";
import "../../../g3.css";

interface Fila { clave: string; etiqueta: string; nominal: number | null; f931: number | null; diferencia: number | null; estado: string }
interface Conc {
  periodo: string; estado: string; presentado_en: string | null; cantidad: number; filas: Fila[]; claves: string[]; etiquetas: Record<string, string>;
  empleados: { legajo: string; nombre: string; cuil: string | null; valores: Record<string, number | null> }[]; avisos: string[]; aviso: string; no_fiscal: string;
}
interface MapRow { concept_id: number; codigo: string; nombre: string; tipo: string; naturaleza: string; codigo_arca: string | null; origen: string | null; sin_mapear: boolean }
interface Venc { id: number | null; tipo: string; periodo: string | null; vence: string; estado: string; nota: string | null; dias: number; etiqueta: string; vencido: boolean }
interface Fal {
  vigente: boolean; avisos: string[]; nota: string; fal_id: string | null; alicuota_empresa: number | null; es_mipyme: boolean;
  empleados: { legajo: string; nombre: string; base: number; alicuota: number; fal: number; detraido: number; excedente: number }[];
  totales: { fal: number; detraido: number; excedente: number }; rifl: { id: number; legajo: string; nombre: string; ingreso: string | null }[];
}

type Tab = "conciliacion" | "empleados" | "mapeo" | "vencimientos" | "fal";

function hoyPeriodo() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export default function ArcaExportacionPage() {
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<Tab>("conciliacion");
  const [periodo, setPeriodo] = useState(hoyPeriodo());
  return (
    <section className="products-page">
      <PageHeader eyebrow="CARGAS SOCIALES" title="Exportación a ARCA" subtitle="Planilla de conciliación contra el F.931. Nominal no presenta el F.931, no genera el TXT del LSD ni paga el VEP: eso lo hace el empleador en ARCA." />
      <div className="g3-tabs-wrap"><Tabs<Tab> value={tab} onChange={setTab} options={[["conciliacion", "Conciliación"], ["empleados", "Por empleado"], ["mapeo", "Conceptos"], ["vencimientos", "Vencimientos"], ["fal", "FAL y RIFL"]]} /></div>
      {(tab === "conciliacion" || tab === "empleados" || tab === "fal") && <div style={{ maxWidth: 220 }}><MonthInput value={periodo} onChange={setPeriodo} /></div>}
      {(tab === "conciliacion" || tab === "empleados") && <Conciliacion periodo={periodo} vista={tab} fail={fail} show={show} />}
      {tab === "mapeo" && <Mapeo fail={fail} show={show} />}
      {tab === "vencimientos" && <Vencimientos fail={fail} show={show} />}
      {tab === "fal" && <FalTab periodo={periodo} fail={fail} />}
      <p className="nm-muted" style={{ marginTop: 16 }}>Documento no válido como factura. Los totales del F.931 los cargás vos copiándolos de ARCA; Nominal compara y marca las diferencias.</p>
      {flash}
    </section>
  );
}

type Cb = { fail: (e: unknown) => void; show: (t: string) => void };

function Conciliacion({ periodo, vista, fail, show }: { periodo: string; vista: Tab } & Cb) {
  const [data, setData] = useState<Conc | null>(null);
  const [carga, setCarga] = useState(false);
  const load = useCallback(() => { setData(null); appApi<Conc>(`/arca/conciliacion/${periodo}`).then(setData).catch(fail); }, [periodo, fail]);
  useEffect(() => { load(); }, [load]);
  async function bajar(hoja: string) {
    try { await downloadFile(`/arca/exportar/${periodo}?hoja=${hoja}&employer_id=${getEmployerId()}`, `nominal-arca-${hoja}-${periodo}.csv`); } catch (e) { fail(e); }
  }
  async function presentado() {
    try { await appApi(`/arca/conciliacion/${periodo}/presentado`, { method: "POST", body: {} }); show("Quedó registrado como presentado"); load(); } catch (e) { fail(e); }
  }
  if (!data) return <Loading />;
  const difs = data.filas.filter((f) => f.estado === "diferencia").length;
  return (
    <>
      <div className="nm-note nm-note-info" style={{ margin: "0 0 14px" }}>Nominal no presenta el F.931 ni genera el TXT del LSD (queda para una versión futura). Usá esta planilla para cargar y controlar lo que declarás en ARCA.</div>
      <Notes items={data.avisos} />
      <div className="nm-toolbar">
        <div className="nm-filters">
          <Pill tone={data.estado === "presentado" ? "green" : data.estado === "con_diferencias" ? "red" : data.estado === "conciliado" ? "green" : "gray"}>
            {data.estado === "presentado" ? `Presentado${data.presentado_en ? " el " + shortDate(data.presentado_en) : ""}` : data.estado === "con_diferencias" ? `${difs} diferencia(s)` : data.estado === "conciliado" ? "Conciliado" : "Sin comparar"}
          </Pill>
          <span className="nm-muted">{data.cantidad} liquidación(es)</span>
        </div>
        <div className="nm-filters">
          <button className="secondary-button" onClick={() => bajar("resumen")}>Bajar resumen (Excel)</button>
          <button className="secondary-button" onClick={() => bajar("empleados")}>Bajar por empleado</button>
          <button className="secondary-button" onClick={() => bajar("conceptos")}>Bajar conceptos</button>
          <button className="secondary-button" onClick={() => setCarga(true)}>Cargar totales del F.931</button>
          {data.estado !== "presentado" && <button className="primary-button" onClick={presentado}>Marcar presentado</button>}
        </div>
      </div>
      {vista === "conciliacion" ? (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>Concepto</th><th className="num">Nominal</th><th className="num">F.931 cargado</th><th className="num">Diferencia</th><th>Estado</th></tr></thead>
            <tbody>
              {data.filas.map((f) => (
                <tr key={f.clave}>
                  <td>{f.etiqueta}</td><td className="num"><Amount value={f.nominal} /></td><td className="num"><Amount value={f.f931} /></td>
                  <td className="num">{f.diferencia === null ? <span className="nm-muted">—</span> : <span className={f.estado === "diferencia" ? "g3-neg" : undefined}><Amount value={f.diferencia} /></span>}</td>
                  <td>{f.estado === "diferencia" ? <Pill tone="red">Diferencia</Pill> : f.estado === "ok" ? <Pill tone="green">Coincide</Pill> : <Pill tone="gray">Sin dato</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data.empleados.length === 0 ? <Empty title="Sin liquidaciones">No hay liquidaciones de este mes.</Empty> : (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>Empleado</th>{data.claves.map((k) => <th key={k} className="num">{data.etiquetas[k] || k}</th>)}</tr></thead>
            <tbody>
              {data.empleados.map((e) => (
                <tr key={e.legajo}><td><strong>{e.nombre}</strong><small>Legajo {e.legajo}{e.cuil ? ` · ${e.cuil}` : ""}</small></td>{data.claves.map((k) => <td key={k} className="num">{money(e.valores[k] ?? 0)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {carga && <CargaF931 periodo={periodo} data={data} onClose={() => setCarga(false)} onSaved={(n) => { setCarga(false); show(n ? `Cargado: ${n} diferencia(s)` : "Cargado: coincide con Nominal"); load(); }} />}
    </>
  );
}

function CargaF931({ periodo, data, onClose, onSaved }: { periodo: string; data: Conc; onClose: () => void; onSaved: (difs: number) => void }) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(data.filas.map((f) => [f.clave, f.f931 === null ? "" : String(f.f931)])));
  const [error, setError] = useState("");
  async function save() {
    setError("");
    const valores: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(vals)) {
      const t = v.trim().replace(/\./g, "").replace(",", ".");
      if (!t) { valores[k] = null; continue; }
      const n = Number(t);
      if (Number.isNaN(n)) { setError(`«${data.etiquetas[k] || k}» no es un número`); return; }
      valores[k] = n;
    }
    try { const r = await appApi<{ diferencias: number }>(`/arca/conciliacion/${periodo}/f931`, { method: "POST", body: { valores } }); onSaved(r.diferencias); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  return (
    <Modal eyebrow="F.931" title={`Totales del F.931 · ${periodo}`} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Guardar y comparar</button></>}>
      <p className="nm-muted">Copiá de ARCA los totales del F.931 que presentaste. Dejá vacío lo que no quieras comparar.</p>
      <div className="product-form">
        {data.filas.map((f) => (
          <Field key={f.clave} label={f.etiqueta} hint={f.nominal !== null ? `Nominal: ${money(f.nominal)}` : undefined}>
            <input inputMode="decimal" value={vals[f.clave] ?? ""} onChange={(e) => setVals({ ...vals, [f.clave]: e.target.value })} />
          </Field>
        ))}
        {error && <div className="nm-note nm-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

function Mapeo({ fail, show }: Cb) {
  const [rows, setRows] = useState<MapRow[] | null>(null);
  const [edit, setEdit] = useState<Record<number, string>>({});
  const load = useCallback(() => { appApi<{ conceptos: MapRow[] }>("/arca/mapeo").then((r) => setRows(r.conceptos)).catch(fail); }, [fail]);
  useEffect(() => { load(); }, [load]);
  async function guardar(r: MapRow) {
    const v = strOrNull(edit[r.concept_id]);
    if (!v) return;
    try { await appApi("/arca/mapeo", { method: "PUT", body: { concept_id: r.concept_id, codigo_arca: v } }); show("Código guardado"); setEdit((e) => { const n = { ...e }; delete n[r.concept_id]; return n; }); load(); } catch (e) { fail(e); }
  }
  if (!rows) return <Loading />;
  const sin = rows.filter((r) => r.sin_mapear).length;
  return (
    <>
      {sin > 0 && <Notes items={[`${sin} concepto(s) sin código ARCA: en la planilla salen como «SIN MAPEAR».`]} />}
      <div className="nm-table-wrap">
        <table className="nm-table">
          <thead><tr><th>Concepto</th><th>Naturaleza</th><th>Código ARCA</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.concept_id}>
                <td><strong>{r.nombre}</strong><small>{r.codigo}</small></td><td>{r.naturaleza}</td>
                <td>
                  <input aria-label={`Código ARCA de ${r.nombre}`} style={{ maxWidth: 120 }} value={edit[r.concept_id] ?? r.codigo_arca ?? ""} onChange={(e) => setEdit({ ...edit, [r.concept_id]: e.target.value })} />
                  {r.sin_mapear ? <small>Sin mapear</small> : <small>{r.origen === "propio" ? "Cargado por la empresa" : "Base de Nominal"}</small>}
                </td>
                <td>{edit[r.concept_id] !== undefined && edit[r.concept_id] !== (r.codigo_arca ?? "") && <button className="secondary-button" onClick={() => guardar(r)}>Guardar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Vencimientos({ fail, show }: Cb) {
  const [data, setData] = useState<{ items: Venc[]; falta_tabla_f931: boolean } | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const load = useCallback(() => { appApi<{ items: Venc[]; falta_tabla_f931: boolean }>("/arca/vencimientos").then(setData).catch(fail); }, [fail]);
  useEffect(() => { load(); }, [load]);
  async function marcar(v: Venc, estado: string) {
    try { await appApi("/arca/vencimientos", { method: "POST", body: { tipo: v.tipo, periodo: v.periodo, vence: v.vence, estado } }); show("Vencimiento actualizado"); load(); } catch (e) { fail(e); }
  }
  if (!data) return <Loading />;
  return (
    <>
      {data.falta_tabla_f931 && <Notes items={["Falta la tabla de vencimientos del F.931 por terminación de CUIT (parámetro «vencimiento_f931»): no se calculan esas fechas. Podés cargarlas a mano."]} />}
      <div className="nm-toolbar"><span /><button className="primary-button" onClick={() => setNuevo(true)}>+ Vencimiento propio</button></div>
      {data.items.length === 0 ? <Empty title="Sin vencimientos">No hay fechas para mostrar.</Empty> : (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>Vence</th><th>Qué</th><th>Período</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {data.items.map((v, i) => (
                <tr key={i}>
                  <td><strong>{shortDate(v.vence)}</strong><small>{v.estado !== "pendiente" ? "" : v.dias < 0 ? `Venció hace ${-v.dias} día(s)` : v.dias === 0 ? "Hoy" : `En ${v.dias} día(s)`}</small></td>
                  <td>{v.etiqueta}{v.nota && <small>{v.nota}</small>}</td><td>{v.periodo || "—"}</td>
                  <td>{v.estado === "cumplido" ? <Pill tone="green">Cumplido</Pill> : v.estado === "omitido" ? <Pill tone="gray">Omitido</Pill> : v.vencido ? <Pill tone="red">Vencido</Pill> : <Pill tone="amber">Pendiente</Pill>}</td>
                  <td>{v.estado === "pendiente" && <button className="secondary-button" onClick={() => marcar(v, "cumplido")}>Marcar cumplido</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nuevo && <VencForm onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); show("Vencimiento guardado"); load(); }} />}
    </>
  );
}

function VencForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState("ART");
  const [vence, setVence] = useState("");
  const [per, setPer] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  async function save() {
    setError("");
    try { await appApi("/arca/vencimientos", { method: "POST", body: { tipo, vence: vence || null, periodo: per || null, nota: strOrNull(nota), estado: "pendiente" } }); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  return (
    <Modal eyebrow="CALENDARIO" title="Vencimiento propio" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <Field label="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value)}>{[["F931", "F.931"], ["FAL", "FAL"], ["SUSS", "SUSS"], ["ART", "ART"], ["sindicato", "Aportes sindicales"], ["ganancias_f649", "Ganancias F.649"], ["MIPYME", "Certificado MiPyME"], ["PAGO", "Pago de sueldos"], ["SAC", "Aguinaldo"]].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Fecha de vencimiento"><input type="date" value={vence} onChange={(e) => setVence(e.target.value)} /></Field>
        <Field label="Período (opcional)"><MesAnio value={per} onChange={setPer} allowEmpty /></Field>
        <Field label="Nota"><input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} /></Field>
        {error && <div className="nm-note nm-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

function FalTab({ periodo, fail }: { periodo: string; fail: (e: unknown) => void }) {
  const [d, setD] = useState<Fal | null>(null);
  useEffect(() => { setD(null); appApi<Fal>(`/arca/fal/${periodo}`).then(setD).catch(fail); }, [periodo, fail]);
  if (!d) return <Loading />;
  return (
    <>
      <Notes items={d.avisos} />
      <div className="nm-kpis">
        <div className="nm-kpi"><span>FAL del mes</span><strong>{money(d.totales.fal)}</strong></div>
        <div className="nm-kpi"><span>Se detrae de contribuciones</span><strong>{money(d.totales.detraido)}</strong></div>
        <div className="nm-kpi"><span>Excedente (no se traslada)</span><strong>{money(d.totales.excedente)}</strong></div>
      </div>
      {d.empleados.length > 0 && (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>Empleado</th><th className="num">Base</th><th className="num">Alícuota</th><th className="num">FAL</th><th className="num">Detraído</th><th className="num">Excedente</th></tr></thead>
            <tbody>{d.empleados.map((e) => <tr key={e.legajo}><td><strong>{e.nombre}</strong><small>Legajo {e.legajo}</small></td><td className="num">{money(e.base)}</td><td className="num">{e.alicuota}%</td><td className="num">{money(e.fal)}</td><td className="num">{money(e.detraido)}</td><td className="num">{money(e.excedente)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <h3 style={{ margin: "18px 0 8px" }}>Empleados con RIFL</h3>
      {d.rifl.length === 0 ? <p className="nm-muted">No hay empleados marcados con el régimen de incentivo (RIFL).</p> : (
        <ul className="g3-steps">{d.rifl.map((e) => <li key={e.id}><span>{e.nombre} · legajo {e.legajo}</span><span>{e.ingreso ? "Ingreso " + shortDate(e.ingreso) : ""}</span></li>)}</ul>
      )}
      <p className="nm-muted">{d.nota}</p>
    </>
  );
}
