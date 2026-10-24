import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, appBlob, money } from "../../config";
import { Empty, Field, Loading, Modal, Pill, Tabs, useFlash } from "../ui";
import { can } from "../g2/common";
import { fechaCorta, fileToBase64, MAX_ARCHIVO, num } from "../g1/common";
import EmpleadoForm from "./EmpleadoForm";

type Tab = "datos" | "contrato" | "familia" | "documentos" | "historial" | "recibos";

const ESTADOS: Record<string, [string, string]> = { activo: ["Activo", "green"], licencia: ["En licencia", "blue"], suspendido: ["Suspendido", "orange"], baja: ["Baja", "gray"] };
const TIPOS_DOC: Record<string, string> = { dni: "DNI", apto_medico: "Apto médico", contrato: "Contrato", titulo: "Título", certificado_medico: "Certificado médico", otro: "Otro" };
const MEDICOS = ["apto_medico", "certificado_medico"];
const EVENTOS: Record<string, string> = { alta: "Alta", aumento: "Aumento", cambio_categoria: "Cambio de categoría", suspension: "Suspensión", reingreso: "Reingreso", baja: "Baja" };
const CAUSAS: [string, string][] = [["renuncia", "Renuncia"], ["mutuo_acuerdo", "Mutuo acuerdo"], ["despido_sin_causa", "Despido sin causa"], ["despido_con_causa", "Despido con causa"],
  ["fin_plazo", "Fin de plazo"], ["jubilacion", "Jubilación"], ["muerte", "Fallecimiento"], ["periodo_prueba", "Período de prueba"]];
const PARENTESCOS: Record<string, string> = { conyuge: "Cónyuge", hijo: "Hijo/a", otro: "Otro" };

export function EstadoEmp({ estado }: { estado: string }) {
  const [l, t] = ESTADOS[estado] || [estado, "gray"];
  return <Pill tone={t}>{l}</Pill>;
}

function Kv({ k, children }: { k: string; children: ReactNode }) {
  return <><dt>{k}</dt><dd>{children}</dd></>;
}

function detalleEvento(e: any): string {
  const d = e.dato || {};
  if (e.tipo === "aumento") return d.sueldo_anterior != null ? `${money(d.sueldo_anterior)} → ${money(d.sueldo_basico_pactado)}` : `Sueldo ${money(d.sueldo_basico_pactado)}`;
  if (e.tipo === "cambio_categoria") return d.categoria ? `Nueva categoría: ${d.categoria}` : "";
  if (e.tipo === "suspension") return [d.motivo, d.hasta && `hasta ${fechaCorta(d.hasta)}`].filter(Boolean).join(" · ");
  if (e.tipo === "baja") return CAUSAS.find((c) => c[0] === d.causa)?.[1] || d.causa || "";
  if (e.tipo === "reingreso") return d.reconoce_antiguedad ? "Se reconoce la antigüedad anterior" : "Antigüedad nueva";
  return "";
}

export default function Ficha({ id, onBack, onChanged }: { id: number; onBack: () => void; onChanged: () => void }) {
  const [emp, setEmp] = useState<any | null>(null);
  const [tab, setTab] = useState<Tab>("datos");
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"" | "editar" | "categoria" | "aumento" | "suspension" | "baja" | "reingreso">("");
  const { show, fail, node } = useFlash();
  const edita = can("editar_legajos");

  const cargar = useCallback(async () => {
    try { setEmp(await appApi(`/empleados/${id}`)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el legajo"); }
  }, [id]);
  useEffect(() => { void cargar(); }, [cargar]);

  if (error) return <div><button className="nm1-back" onClick={onBack}>‹ Volver a la lista</button><p className="nm-note nm-note-error">{error}</p></div>;
  if (!emp) return <Loading />;

  const refrescar = async (msg?: string) => { await cargar(); onChanged(); if (msg) show(msg); };
  const enConvenio = !!emp.categoria_id && emp.cct_numero !== "FUERA";
  const tabs: [Tab, string][] = [["datos", "Datos"], ["contrato", "Contrato"], ["familia", "Familia"], ["documentos", "Documentos"], ["historial", "Historial"]];
  if (can("ver_sueldos")) tabs.push(["recibos", "Recibos"]);

  return (
    <div>
      <button className="nm1-back" onClick={onBack}>‹ Volver a la lista</button>
      <div className="nm1-head">
        <div>
          <h2>{emp.nombre} <EstadoEmp estado={emp.estado} /></h2>
          <p>Legajo {emp.legajo}{emp.cuil_formato ? ` · CUIL ${emp.cuil_formato}` : ""}{emp.tarea ? ` · ${emp.tarea}` : ""}</p>
        </div>
        {edita && (
          <div className="nm1-actions">
            <button className="nm2-btn" onClick={() => setModal("editar")}>Editar datos</button>
            {emp.estado !== "baja" && <button className="nm2-btn" onClick={() => setModal("categoria")}>Cambiar categoría</button>}
            {emp.estado !== "baja" && <button className="nm2-btn" onClick={() => setModal("aumento")}>Aumento</button>}
            {emp.estado === "activo" && <button className="nm2-btn" onClick={() => setModal("suspension")}>Suspender</button>}
            {emp.estado === "baja" || emp.estado === "suspendido" ? <button className="nm2-btn" onClick={() => setModal("reingreso")}>Reingreso</button> : null}
            {emp.estado !== "baja" && <button className="nm2-btn is-danger" onClick={() => setModal("baja")}>Dar de baja</button>}
          </div>
        )}
      </div>
      {emp.faltantes.length > 0 && emp.estado !== "baja" && (
        <p className="nm-note nm-note-warn" style={{ marginBottom: 14 }}>Para emitir un recibo válido falta: {emp.faltantes.map((f: any) => f.mensaje.replace(/^Falta (el |la )?/, "").replace(/^El /, "")).join("; ")}.</p>
      )}
      <Tabs value={tab} options={tabs} onChange={setTab} />
      {tab === "datos" && <Datos emp={emp} />}
      {tab === "contrato" && <Contrato emp={emp} />}
      {tab === "familia" && <Familia emp={emp} edita={edita} fail={fail} show={show} onChanged={() => void refrescar()} />}
      {tab === "documentos" && <Documentos emp={emp} edita={edita} fail={fail} show={show} />}
      {tab === "historial" && <Historial id={emp.id} version={emp.estado + emp.categoria_id + emp.sueldo_basico_pactado} />}
      {tab === "recibos" && <Recibos id={emp.id} />}

      {modal === "editar" && <EmpleadoForm emp={emp} onClose={() => setModal("")} onSaved={(_e, avisos) => { setModal(""); void refrescar(avisos.length ? `Guardado. Ojo: ${avisos.join(" ")}` : "Cambios guardados"); }} />}
      {(modal === "categoria" || modal === "aumento" || modal === "suspension" || modal === "baja" || modal === "reingreso") && (
        <EventoModal tipo={modal} emp={emp} enConvenio={enConvenio} onClose={() => setModal("")} fail={fail}
          onDone={(msg) => { setModal(""); void refrescar(msg); }} />
      )}
      {node}
    </div>
  );
}

// ------------------------------------------------------------

function Datos({ emp }: { emp: any }) {
  const [cbu, setCbu] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const verCbu = async () => {
    try { const r = await appApi(`/empleados/${emp.id}/cbu`); setCbu(r.cbu || ""); setErr(""); window.setTimeout(() => setCbu(null), 30000); }
    catch (e) { setErr(e instanceof Error ? e.message : "No se pudo leer el CBU"); }
  };
  const a = emp.antiguedad;
  return (
    <div className="nm1-cols">
      <div className="nm-card">
        <div className="nm-card-head"><h2>Datos personales</h2></div>
        <dl className="nm1-kv">
          <Kv k="DNI">{emp.dni || "—"}</Kv>
          <Kv k="Nacimiento">{emp.fecha_nac ? `${fechaCorta(emp.fecha_nac)} (${emp.edad} años)` : "—"}{emp.es_menor && <> <Pill tone="orange">Menor de 18</Pill></>}</Kv>
          <Kv k="Domicilio">{emp.domicilio || "—"}</Kv>
          <Kv k="Email">{emp.email || "—"}</Kv>
          <Kv k="Teléfono">{emp.tel || "—"}</Kv>
          <Kv k="Ingreso">{fechaCorta(emp.fecha_ingreso)}</Kv>
          {emp.fecha_ingreso_reconocida && <Kv k="Antigüedad desde">{fechaCorta(emp.fecha_ingreso_reconocida)}</Kv>}
          <Kv k="Antigüedad">{a.anios} año(s) y {a.meses} mes(es)</Kv>
          {emp.fecha_egreso && <Kv k="Egreso">{fechaCorta(emp.fecha_egreso)}</Kv>}
        </dl>
      </div>
      <div className="nm-card">
        <div className="nm-card-head"><h2>Cobro y datos sensibles</h2></div>
        <dl className="nm1-kv">
          <Kv k="Banco">{emp.banco || "—"}</Kv>
          <Kv k="CBU">
            {!emp.tiene_cbu ? "No cargado" : cbu !== null ? <span className="nm1-mono">{cbu}</span> : (
              <span className="nm1-sensitive">
                <span className="nm1-mono" aria-label="CBU oculto">{emp.cbu_mask || "••••••••••••••••••••••"}</span>
                {emp.puede_ver_cbu && <button className="nm2-btn is-small" onClick={() => void verCbu()}>Ver completo</button>}
              </span>
            )}
          </Kv>
          {emp.sindicato_afiliado !== null && <Kv k="Afiliado al sindicato">{emp.sindicato_afiliado ? "Sí" : "No"}</Kv>}
          {emp.observaciones !== undefined && emp.observaciones !== null && <Kv k="Observaciones">{emp.observaciones || "—"}</Kv>}
        </dl>
        {err && <p className="nm-note nm-note-error" style={{ marginTop: 10 }}>{err}</p>}
        <p className="nm-muted" style={{ marginTop: 12 }}>El CBU se guarda cifrado. Cada vez que alguien lo lee o ve datos de salud queda registrado quién y cuándo (Ley 25.326).</p>
      </div>
    </div>
  );
}

function Contrato({ emp }: { emp: any }) {
  const b = emp.basico_vigente;
  return (
    <div className="nm1-cols">
      <div className="nm-card">
        <div className="nm-card-head"><h2>Convenio y categoría</h2></div>
        <dl className="nm1-kv">
          <Kv k="Convenio">{emp.cct_numero ? `${emp.cct_numero} · ${emp.cct_nombre}` : "Fuera de convenio"}</Kv>
          <Kv k="Categoría">{emp.categoria_nombre || "—"}</Kv>
          <Kv k="Tarea">{emp.tarea || "—"}</Kv>
          <Kv k="Modalidad">{{ completa: "Jornada completa", parcial: "Jornada parcial", jornal: "Jornal" }[emp.modalidad as string] || emp.modalidad}{emp.jornada_horas ? ` · ${emp.jornada_horas} h semanales` : ""}</Kv>
          <Kv k="Obra social">{emp.obra_social || "—"}{emp.obra_social_codigo ? ` (${emp.obra_social_codigo})` : ""}</Kv>
          <Kv k="Régimen">{[emp.rifl && "RIFL", emp.art_exento && "Sin ART"].filter(Boolean).join(" · ") || "General"}</Kv>
        </dl>
      </div>
      {emp.puede_ver_sueldos && (
        <div className="nm-card">
          <div className="nm-card-head"><h2>Sueldo</h2></div>
          {b ? (
            <dl className="nm1-kv">
              <Kv k="Básico vigente"><strong>{money(b.basico)}</strong></Kv>
              <Kv k="Origen">{b.origen === "escala" ? `Escala del convenio desde ${fechaCorta(b.vigencia_desde)}` : "Sueldo pactado en el legajo"}</Kv>
              {b.fuente && <Kv k="Fuente">{b.fuente}</Kv>}
              {Object.entries(b.sumas_nr || {}).map(([k, v]) => <Kv key={k} k={k}>{money(v as number)} (no remunerativo)</Kv>)}
            </dl>
          ) : <p className="nm-note nm-note-warn">No hay un básico vigente: falta la escala de la categoría o el sueldo pactado.</p>}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------

function Familia({ emp, edita, fail, show, onChanged }: { emp: any; edita: boolean; fail: (e: unknown) => void; show: (t: string) => void; onChanged: () => void }) {
  const [lista, setLista] = useState<any[] | null>(null);
  const [form, setForm] = useState<any | null>(null);
  const cargar = useCallback(async () => { try { setLista(await appApi(`/empleados/${emp.id}/familia`)); } catch (e) { fail(e); setLista([]); } }, [emp.id, fail]);
  useEffect(() => { void cargar(); }, [cargar]);
  const guardar = async () => {
    const body = { parentesco: form.parentesco, nombre: form.nombre, dni: form.dni || null, fecha_nac: form.fecha_nac || null, a_cargo_ganancias: !!form.a_cargo_ganancias, aaff: !!form.aaff, ...(can("ver_salud") ? { discapacidad: !!form.discapacidad } : {}) };
    try {
      if (form.id) await appApi(`/empleados/${emp.id}/familia/${form.id}`, { method: "PUT", body }); else await appApi(`/empleados/${emp.id}/familia`, { method: "POST", body });
      setForm(null); await cargar(); onChanged(); show("Familiar guardado");
    } catch (e) { fail(e); }
  };
  const borrar = async (f: any) => {
    if (!window.confirm(`¿Sacar a ${f.nombre} del legajo?`)) return;
    try { await appApi(`/empleados/${emp.id}/familia/${f.id}`, { method: "DELETE" }); await cargar(); onChanged(); show("Familiar eliminado"); } catch (e) { fail(e); }
  };
  if (lista === null) return <Loading />;
  return (
    <div className="nm-card">
      <div className="nm-card-head"><div><h2>Grupo familiar</h2><p>Lo usamos para Ganancias (cargas) y para informar asignaciones familiares.</p></div>
        {edita && <button className="nm2-btn is-primary" onClick={() => setForm({ parentesco: "hijo", nombre: "", a_cargo_ganancias: true })}>Agregar familiar</button>}</div>
      {lista.length === 0 ? <Empty title="Sin familiares cargados">Cargá cónyuge e hijos a cargo para que Ganancias deduzca las cargas de familia.</Empty> : (
        <div className="nm-table-wrap"><table className="nm-table">
          <thead><tr><th>Nombre</th><th>Vínculo</th><th>Nacimiento</th><th>DNI</th><th>A cargo (Ganancias)</th><th>Asig. familiar</th>{emp.puede_ver_salud && <th>Discapacidad</th>}{edita && <th />}</tr></thead>
          <tbody>{lista.map((f) => (
            <tr key={f.id}>
              <td><strong>{f.nombre}</strong></td><td>{PARENTESCOS[f.parentesco]}</td><td>{fechaCorta(f.fecha_nac)}</td><td>{f.dni || "—"}</td>
              <td>{f.a_cargo_ganancias ? "Sí" : "No"}</td><td>{f.aaff ? "Sí" : "No"}</td>{emp.puede_ver_salud && <td>{f.discapacidad ? "Sí" : "No"}</td>}
              {edita && <td className="nm1-num"><button className="nm-link" onClick={() => setForm({ ...f })}>Editar</button> · <button className="nm-link nm-link-danger" onClick={() => void borrar(f)}>Sacar</button></td>}
            </tr>))}</tbody>
        </table></div>
      )}
      {form && (
        <Modal title={form.id ? "Editar familiar" : "Agregar familiar"} onClose={() => setForm(null)} footer={<><button className="nm2-btn" onClick={() => setForm(null)}>Cancelar</button><button className="nm2-btn is-primary" onClick={() => void guardar()}>Guardar</button></>}>
          <div className="nm1-form">
            <Field label="Vínculo"><select className="nm2-select" value={form.parentesco} onChange={(e) => setForm({ ...form, parentesco: e.target.value })}>{Object.entries(PARENTESCOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Nombre completo *"><input className="nm2-input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
            <Field label="DNI"><input className="nm2-input" inputMode="numeric" value={form.dni || ""} onChange={(e) => setForm({ ...form, dni: e.target.value })} /></Field>
            <Field label="Fecha de nacimiento"><input className="nm2-input" type="date" value={form.fecha_nac || ""} onChange={(e) => setForm({ ...form, fecha_nac: e.target.value })} /></Field>
            <div className="is-wide nm1-chips" style={{ gap: 18 }}>
              <label className="nm1-check"><input type="checkbox" checked={!!form.a_cargo_ganancias} onChange={(e) => setForm({ ...form, a_cargo_ganancias: e.target.checked })} /> A cargo (deducción de Ganancias)</label>
              <label className="nm1-check"><input type="checkbox" checked={!!form.aaff} onChange={(e) => setForm({ ...form, aaff: e.target.checked })} /> Cobra asignación familiar</label>
              {can("ver_salud") && <label className="nm1-check"><input type="checkbox" checked={!!form.discapacidad} onChange={(e) => setForm({ ...form, discapacidad: e.target.checked })} /> Con discapacidad</label>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------

function Documentos({ emp, edita, fail, show }: { emp: any; edita: boolean; fail: (e: unknown) => void; show: (t: string) => void }) {
  const [lista, setLista] = useState<any[] | null>(null);
  const [form, setForm] = useState<any | null>(null);
  const cargar = useCallback(async () => { try { setLista(await appApi(`/empleados/${emp.id}/documentos`)); } catch (e) { fail(e); setLista([]); } }, [emp.id, fail]);
  useEffect(() => { void cargar(); }, [cargar]);
  const elegir = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_ARCHIVO) { fail(new Error("El archivo pesa más de 1,5 MB")); return; }
    try { setForm({ ...form, archivo_nombre: f.name, archivo_data: await fileToBase64(f) }); } catch (e) { fail(e); }
  };
  const guardar = async () => {
    if (!form.archivo_data && !form.archivo_url) { fail(new Error("Adjuntá un archivo o pegá un enlace")); return; }
    try {
      await appApi(`/empleados/${emp.id}/documentos`, { method: "POST", body: { tipo: form.tipo, archivo_nombre: form.archivo_nombre || null, archivo_url: form.archivo_url || null, archivo_data: form.archivo_data || null, vence: form.vence || null } });
      setForm(null); await cargar(); show("Documento guardado");
    } catch (e) { fail(e); }
  };
  const abrir = async (d: any) => {
    try { const blob = await appBlob(`/empleados/${emp.id}/documentos/${d.id}/archivo`); window.open(URL.createObjectURL(blob), "_blank", "noopener"); } catch (e) { fail(e); }
  };
  const borrar = async (d: any) => {
    if (!window.confirm("¿Borrar este documento?")) return;
    try { await appApi(`/empleados/${emp.id}/documentos/${d.id}`, { method: "DELETE" }); await cargar(); show("Documento borrado"); } catch (e) { fail(e); }
  };
  const tono: Record<string, [string, string]> = { vencido: ["Vencido", "red"], por_vencer: ["Vence pronto", "orange"], vigente: ["Vigente", "green"] };
  if (lista === null) return <Loading />;
  return (
    <div className="nm-card">
      <div className="nm-card-head"><div><h2>Documentos</h2><p>DNI, contrato, aptos médicos y lo que haga falta. Los médicos los ve solo quien tiene permiso para datos de salud.</p></div>
        {edita && <button className="nm2-btn is-primary" onClick={() => setForm({ tipo: "dni" })}>Agregar documento</button>}</div>
      {lista.length === 0 ? <Empty title="Sin documentos">Subí el DNI, el contrato o el apto médico, con su fecha de vencimiento si tiene.</Empty> : (
        <ul className="nm-list">{lista.map((d) => (
          <li key={d.id}>
            <div className="nm-list-main"><strong>{TIPOS_DOC[d.tipo] || d.tipo}{d.archivo_nombre ? ` · ${d.archivo_nombre}` : ""}</strong>
              <small>{d.vence ? `Vence el ${fechaCorta(d.vence)}` : "Sin vencimiento"}</small></div>
            {d.estado && <Pill tone={tono[d.estado][1]}>{tono[d.estado][0]}</Pill>}
            {d.tiene_archivo && <button className="nm-link" onClick={() => void abrir(d)}>Ver</button>}
            {d.archivo_url && <a className="nm-link" href={d.archivo_url} target="_blank" rel="noopener noreferrer">Abrir enlace</a>}
            {edita && <button className="nm-link nm-link-danger" onClick={() => void borrar(d)}>Borrar</button>}
          </li>))}</ul>
      )}
      {form && (
        <Modal title="Agregar documento" onClose={() => setForm(null)} footer={<><button className="nm2-btn" onClick={() => setForm(null)}>Cancelar</button><button className="nm2-btn is-primary" onClick={() => void guardar()}>Guardar</button></>}>
          <div className="nm1-form">
            <Field label="Tipo"><select className="nm2-select" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {Object.entries(TIPOS_DOC).filter(([k]) => can("ver_salud") || !MEDICOS.includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Vence (opcional)"><input className="nm2-input" type="date" value={form.vence || ""} onChange={(e) => setForm({ ...form, vence: e.target.value })} /></Field>
            <Field label="Archivo (PDF o imagen, hasta 1,5 MB)" wide><input className="nm1-file" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => void elegir(e.target.files?.[0])} />{form.archivo_nombre && <small className="nm-hint">Elegido: {form.archivo_nombre}</small>}</Field>
            <Field label="O un enlace" wide><input className="nm2-input" value={form.archivo_url || ""} onChange={(e) => setForm({ ...form, archivo_url: e.target.value })} placeholder="https://" /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------

function Historial({ id, version }: { id: number; version: string }) {
  const [lista, setLista] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { appApi(`/empleados/${id}/eventos`).then(setLista).catch((e) => { setError(e instanceof Error ? e.message : "No se pudo cargar"); setLista([]); }); }, [id, version]);
  if (lista === null) return <Loading />;
  return (
    <div className="nm-card">
      <div className="nm-card-head"><h2>Historial del contrato</h2></div>
      {error && <p className="nm-note nm-note-error">{error}</p>}
      {lista.length === 0 ? <Empty title="Todavía no hay movimientos" /> : (
        <ul className="nm1-timeline">{lista.map((e) => <li key={e.id}><strong>{EVENTOS[e.tipo] || e.tipo}</strong> · {fechaCorta(e.fecha)}{detalleEvento(e) && <small>{detalleEvento(e)}</small>}</li>)}</ul>
      )}
    </div>
  );
}

function Recibos({ id }: { id: number }) {
  const [r, setR] = useState<any | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { appApi(`/empleados/${id}/recibos`).then(setR).catch((e) => { setError(e instanceof Error ? e.message : "No se pudo cargar"); setR({ disponible: true, items: [] }); }); }, [id]);
  if (!r) return <Loading />;
  return (
    <div className="nm-card">
      <div className="nm-card-head"><h2>Recibos emitidos</h2></div>
      {error && <p className="nm-note nm-note-error">{error}</p>}
      {!r.disponible ? <Empty title="Los recibos no están incluidos en tu plan">Cuando sumes el módulo Recibos, los vas a ver acá.</Empty>
        : r.items.length === 0 ? <Empty title="Todavía no se emitió ningún recibo" />
        : <div className="nm-table-wrap"><table className="nm-table"><thead><tr><th>N.º</th><th>Período</th><th>Estado</th><th className="num">Neto</th><th>Emitido</th></tr></thead>
          <tbody>{r.items.map((p: any) => <tr key={p.id}><td>{p.numero}</td><td>{String(p.mes).padStart(2, "0")}/{p.anio} · {p.tipo}</td><td>{p.estado === "anulado" ? <Pill tone="red">Anulado</Pill> : <Pill tone="green">Emitido</Pill>}</td><td className="num">{money(p.neto)}</td><td>{fechaCorta(p.emitido_en)}</td></tr>)}</tbody></table></div>}
    </div>
  );
}

// ------------------------------------------------------------

function EventoModal({ tipo, emp, enConvenio, onClose, onDone, fail }: { tipo: string; emp: any; enConvenio: boolean; onClose: () => void; onDone: (msg: string) => void; fail: (e: unknown) => void }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const nav = useNavigate();
  const [f, setF] = useState<Record<string, any>>({ fecha: hoy, causa: "renuncia", reconoce: false, motivo: "", hasta: "", sueldo: "", cct_id: emp.cct_id || "", categoria_id: "" });
  const [ops, setOps] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (tipo === "categoria") appApi("/empleados/convenios").then(setOps).catch(() => setOps({ convenios: [] })); }, [tipo]);
  const titulo: Record<string, string> = { categoria: "Cambiar categoría", aumento: "Aumento de sueldo", suspension: "Suspender", baja: "Dar de baja", reingreso: "Reingreso" };
  const cct = ops?.convenios.find((c: any) => c.id === Number(f.cct_id));

  const enviar = async () => {
    let body: any;
    if (tipo === "categoria") {
      if (!f.categoria_id) { fail(new Error("Elegí la nueva categoría")); return; }
      body = { tipo: "cambio_categoria", fecha: f.fecha, dato: { cct_id: Number(f.cct_id) || null, categoria_id: Number(f.categoria_id) } };
    } else if (tipo === "aumento") {
      const s = num(String(f.sueldo));
      if (!s) { fail(new Error("Poné el nuevo sueldo básico")); return; }
      body = { tipo: "aumento", fecha: f.fecha, dato: { sueldo_basico_pactado: s } };
    } else if (tipo === "suspension") body = { tipo: "suspension", fecha: f.fecha, dato: { motivo: f.motivo, hasta: f.hasta || null } };
    else if (tipo === "baja") body = { tipo: "baja", fecha: f.fecha, dato: { causa: f.causa } };
    else body = { tipo: "reingreso", fecha: f.fecha, dato: { reconoce_antiguedad: !!f.reconoce } };
    setBusy(true);
    try {
      const r = await appApi(`/empleados/${emp.id}/eventos`, { method: "POST", body });
      if (tipo === "baja" && r.ir_a) {
        onDone("Baja registrada");
        if (window.confirm("La baja quedó registrada. ¿Querés preparar la liquidación final ahora?")) nav(r.ir_a);
      } else onDone(tipo === "baja" ? "Baja registrada" : "Movimiento registrado");
    } catch (e) { fail(e); }
    setBusy(false);
  };

  return (
    <Modal title={`${titulo[tipo]} · ${emp.nombre}`} onClose={onClose} footer={<><button className="nm2-btn" onClick={onClose}>Cancelar</button><button className={`nm2-btn ${tipo === "baja" ? "is-danger" : "is-primary"}`} disabled={busy} onClick={() => void enviar()}>Confirmar</button></>}>
      <div className="nm1-form">
        <Field label={tipo === "baja" ? "Fecha de egreso" : "Fecha desde la que rige"}><input className="nm2-input" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
        {tipo === "categoria" && (
          <>
            <Field label="Convenio"><select className="nm2-select" value={f.cct_id} onChange={(e) => setF({ ...f, cct_id: e.target.value, categoria_id: "" })}>
              {ops?.convenios.filter((c: any) => !c.fuera_de_convenio).map((c: any) => <option key={c.id} value={c.id}>{c.numero} · {c.nombre}</option>)}</select></Field>
            <Field label="Nueva categoría"><select className="nm2-select" value={f.categoria_id} onChange={(e) => setF({ ...f, categoria_id: e.target.value })}>
              <option value="">Elegí una</option>{cct?.categorias.map((k: any) => <option key={k.id} value={k.id}>{k.nombre}</option>)}</select></Field>
          </>
        )}
        {tipo === "aumento" && (enConvenio
          ? <div className="is-wide"><p className="nm-note nm-note-warn">En convenio el sueldo sale de la escala de la categoría. Cargá la escala nueva en Convenios; acá solo se cambia el sueldo de quien está fuera de convenio.</p></div>
          : <Field label="Nuevo sueldo básico ($)"><input className="nm2-input num" inputMode="decimal" value={f.sueldo} onChange={(e) => setF({ ...f, sueldo: e.target.value })} /></Field>)}
        {tipo === "suspension" && (
          <>
            <Field label="Motivo" wide><input className="nm2-input" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} /></Field>
            <Field label="Hasta (opcional)"><input className="nm2-input" type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></Field>
          </>
        )}
        {tipo === "baja" && (
          <Field label="Causa" wide hint="Después podés preparar la liquidación final con indemnización, SAC y vacaciones.">
            <select className="nm2-select" value={f.causa} onChange={(e) => setF({ ...f, causa: e.target.value })}>{CAUSAS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        )}
        {tipo === "reingreso" && <label className="nm1-check is-wide"><input type="checkbox" checked={f.reconoce} onChange={(e) => setF({ ...f, reconoce: e.target.checked })} /> Reconocer la antigüedad anterior</label>}
      </div>
    </Modal>
  );
}
