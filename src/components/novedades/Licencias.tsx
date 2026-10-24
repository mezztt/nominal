import { useCallback, useEffect, useMemo, useState } from "react";
import { appApi } from "../../config";
import { Empty, Field, Loading, Modal, Pill, Seg, useFlash } from "../ui";
import { can } from "../g2/common";
import { fechaCorta, fileToBase64, MAX_ARCHIVO, MesNav } from "../g1/common";

const ESTADO: Record<string, [string, string]> = { pendiente: ["Sin aprobar", "gray"], aprobada: ["Aprobada", "green"], rechazada: ["Rechazada", "red"] };
const SEM = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export default function Licencias({ anio, mes, onMes, edita }: { anio: number; mes: number; onMes: (a: number, m: number) => void; edita: boolean }) {
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [estado, setEstado] = useState("");
  const [lista, setLista] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [nueva, setNueva] = useState(false);
  const [cert, setCert] = useState<any | null>(null);
  const [diag, setDiag] = useState<{ nombre: string; texto: string | null } | null>(null);
  const { show, fail, node } = useFlash();
  const verSalud = can("ver_salud");

  const cargar = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (vista === "calendario") { qs.set("anio", String(anio)); qs.set("mes", String(mes)); }
      if (estado) qs.set("estado", estado);
      setLista(await appApi(`/licencias?${qs}`)); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron cargar las licencias"); }
  }, [vista, anio, mes, estado]);
  useEffect(() => { void cargar(); }, [cargar]);

  const cambiar = async (l: any, nuevoEstado: string) => {
    try {
      const r = await appApi(`/licencias/${l.id}`, { method: "PUT", body: { estado: nuevoEstado } });
      show(r.avisos?.length ? `${ESTADO[nuevoEstado][0]}. Ojo: ${r.avisos.join(" ")}` : nuevoEstado === "aprobada" ? "Licencia aprobada: ya cuenta en la liquidación" : "Licencia actualizada");
      void cargar();
    } catch (e) { fail(e); }
  };
  const borrar = async (l: any) => {
    if (!window.confirm(`¿Borrar la licencia de ${l.empleado}?`)) return;
    try { await appApi(`/licencias/${l.id}`, { method: "DELETE" }); show("Licencia borrada"); void cargar(); } catch (e) { fail(e); }
  };
  const verDiag = async (l: any) => {
    try { const r = await appApi(`/licencias/${l.id}/diagnostico`); setDiag({ nombre: l.empleado, texto: r.diagnostico }); } catch (e) { fail(e); }
  };

  return (
    <div>
      <div className="nm1-toolbar">
        <Seg value={vista} options={[["lista", "Lista"], ["calendario", "Calendario"]]} onChange={setVista} />
        {vista === "calendario" && <MesNav anio={anio} mes={mes} onChange={onMes} />}
        <select className="nm-select" aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todas</option><option value="pendiente">Sin aprobar</option><option value="aprobada">Aprobadas</option><option value="rechazada">Rechazadas</option>
        </select>
        {edita && <button className="primary-button" style={{ marginLeft: "auto" }} onClick={() => setNueva(true)}>Registrar licencia</button>}
      </div>
      {error && <p className="nm-note nm-note-error">{error}</p>}
      {!lista && !error ? <Loading /> : lista && (vista === "calendario" ? <Calendario anio={anio} mes={mes} lista={lista} /> : (
        lista.length === 0 ? <div className="nm-card"><Empty title="No hay licencias para mostrar">Registrá una enfermedad, un examen o cualquier licencia, con su certificado.</Empty></div> : (
          <div className="nm-table-wrap"><table className="nm-table">
            <thead><tr><th>Empleado</th><th>Licencia</th><th>Fechas</th><th className="num">Días</th><th>Estado</th><th>Certificado</th>{edita && <th />}</tr></thead>
            <tbody>{lista.map((l) => (
              <tr key={l.id}>
                <td><strong>{l.empleado}</strong><small>Legajo {l.legajo}</small></td>
                <td>{l.tipo}<small>{l.goce ? "Con goce de haberes" : "Sin goce de haberes"}</small></td>
                <td>{fechaCorta(l.desde)} al {fechaCorta(l.hasta)}</td><td className="num">{l.dias}</td>
                <td><Pill tone={ESTADO[l.estado][1]}>{ESTADO[l.estado][0]}</Pill></td>
                <td>{l.es_salud && !verSalud ? <span className="nm-muted">Reservado</span> : l.tiene_certificado ? <Pill tone="green">Cargado</Pill> : l.clave === "enfermedad" ? <Pill tone="orange">Falta</Pill> : "—"}
                  {verSalud && l.tiene_diagnostico && <> <button className="nm-link" onClick={() => void verDiag(l)}>Ver diagnóstico</button></>}</td>
                {edita && <td className="num">
                  {l.estado === "pendiente" && <><button className="nm-link" onClick={() => void cambiar(l, "aprobada")}>Aprobar</button> · <button className="nm-link nm-link-danger" onClick={() => void cambiar(l, "rechazada")}>Rechazar</button> · </>}
                  {l.estado === "aprobada" && <><button className="nm-link" onClick={() => void cambiar(l, "pendiente")}>Desaprobar</button> · </>}
                  {(!l.es_salud || verSalud) && <button className="nm-link" onClick={() => setCert(l)}>Certificado</button>} · <button className="nm-link nm-link-danger" onClick={() => void borrar(l)}>Borrar</button></td>}
              </tr>))}</tbody>
          </table></div>
        )
      ))}
      <p className="nm-muted" style={{ marginTop: 10 }}>El certificado de enfermedad tiene que traer diagnóstico, tratamiento y reposo, con firma digital. El diagnóstico se guarda cifrado y cada lectura queda registrada.</p>
      {nueva && <NuevaLicencia onClose={() => setNueva(false)} fail={fail} onSaved={(m) => { setNueva(false); show(m); void cargar(); }} />}
      {cert && <CertificadoModal l={cert} onClose={() => setCert(null)} fail={fail} onSaved={() => { setCert(null); show("Certificado guardado"); void cargar(); }} />}
      {diag && (
        <Modal title={`Diagnóstico · ${diag.nombre}`} onClose={() => setDiag(null)} footer={<button className="nm2-btn" onClick={() => setDiag(null)}>Cerrar</button>}>
          <p className="nm-note nm-note-info" style={{ marginBottom: 10 }}>Dato de salud (Ley 25.326). Esta lectura quedó registrada con tu usuario.</p>
          <div className="nm2-doc">{diag.texto || "No se pudo descifrar el diagnóstico."}</div>
        </Modal>
      )}
      {node}
    </div>
  );
}

// ------------------------------------------------------------

function Calendario({ anio, mes, lista }: { anio: number; mes: number; lista: any[] }) {
  const dias = new Date(anio, mes, 0).getDate();
  const offset = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;
  const hoy = new Date();
  const celdas = useMemo(() => {
    const out: { dia: number; items: any[] }[] = [];
    for (let d = 1; d <= dias; d++) {
      const f = `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      out.push({ dia: d, items: lista.filter((l) => l.estado !== "rechazada" && l.desde <= f && l.hasta >= f) });
    }
    return out;
  }, [anio, mes, dias, lista]);
  const apellido = (n: string) => n.split(",")[0];
  return (
    <div className="nm-card">
      <div className="nm1-cal" role="grid" aria-label="Calendario de licencias">
        {SEM.map((s) => <div key={s} className="nm1-cal-h">{s}</div>)}
        {Array.from({ length: offset }).map((_, i) => <div key={`o${i}`} />)}
        {celdas.map((c) => {
          const wd = (offset + c.dia - 1) % 7;
          const esHoy = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes && hoy.getDate() === c.dia;
          return (
            <div key={c.dia} className={`nm1-cal-d ${wd >= 5 ? "is-off" : ""} ${esHoy ? "is-today" : ""}`}>
              <span className="nm1-cal-n">{c.dia}</span>
              {c.items.slice(0, 3).map((l) => <span key={l.id} className={`nm1-cal-l ${l.estado === "pendiente" ? "is-pend" : l.goce ? "" : "is-sin"}`} title={`${l.empleado} · ${l.tipo}`}>{apellido(l.empleado)}</span>)}
              {c.items.length > 3 && <span className="nm-muted" style={{ fontSize: 10.5 }}>+{c.items.length - 3} más</span>}
            </div>);
        })}
      </div>
      <div className="nm1-legend"><span><i style={{ background: "var(--nm-green-soft)", border: "1px solid var(--nm-green-text)" }} />Con goce</span><span><i style={{ background: "var(--nm-orange-soft)", border: "1px solid var(--nm-orange-text)" }} />Sin goce</span><span><i style={{ background: "var(--nm-gray-soft)", border: "1px solid var(--nm-gray-text)" }} />Sin aprobar</span></div>
    </div>
  );
}

// ------------------------------------------------------------

function NuevaLicencia({ onClose, onSaved, fail }: { onClose: () => void; onSaved: (m: string) => void; fail: (e: unknown) => void }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [emps, setEmps] = useState<any[]>([]);
  const [tipos, setTipos] = useState<any[]>([]);
  const [f, setF] = useState({ employee_id: "", clave: "", desde: hoy, hasta: hoy, aprobada: false, archivo: null as null | { nombre: string; data: string }, diag: "" });
  const [uso, setUso] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const verSalud = can("ver_salud");

  useEffect(() => {
    appApi("/novedades/empleados").then(setEmps).catch(() => setEmps([]));
    appApi("/licencias/tipos").then((t) => { setTipos(t); if (t.length) setF((p) => ({ ...p, clave: t[0].clave })); }).catch(() => setTipos([]));
  }, []);
  const tipo = tipos.find((t) => t.clave === f.clave);
  useEffect(() => {
    if (f.employee_id && f.clave === "enfermedad") appApi(`/licencias/enfermedad/${f.employee_id}`).then(setUso).catch(() => setUso(null)); else setUso(null);
  }, [f.employee_id, f.clave]);

  const elegirArchivo = async (file: File | undefined) => {
    if (!file) { setF({ ...f, archivo: null }); return; }
    if (file.size > MAX_ARCHIVO) { fail(new Error("El archivo pesa más de 1,5 MB")); return; }
    try { setF({ ...f, archivo: { nombre: file.name, data: await fileToBase64(file) } }); } catch (e) { fail(e); }
  };
  const guardar = async () => {
    if (!f.employee_id) { fail(new Error("Elegí el empleado")); return; }
    if (f.hasta < f.desde) { fail(new Error("«Hasta» no puede ser anterior a «desde»")); return; }
    setBusy(true);
    try {
      const body: any = { employee_id: Number(f.employee_id), clave: f.clave, desde: f.desde, hasta: f.hasta, estado: f.aprobada ? "aprobada" : "pendiente" };
      const l = await appApi("/licencias", { method: "POST", body });
      let avisos: string[] = l.avisos || [];
      if (f.archivo || f.diag.trim()) {
        const c = await appApi(`/licencias/${l.id}/certificado`, { method: "PUT", body: { nombre: f.archivo?.nombre, archivo_data: f.archivo?.data, diagnostico: f.diag.trim() || undefined } });
        if (c) avisos = avisos.filter((a) => !a.startsWith("Falta el certificado"));
      }
      onSaved(avisos.length ? `Licencia registrada. Ojo: ${avisos.join(" ")}` : "Licencia registrada");
    } catch (e) { fail(e); }
    setBusy(false);
  };
  const pct = uso && uso.tope_dias ? Math.min(100, Math.round((uso.dias / uso.tope_dias) * 100)) : 0;

  return (
    <Modal title="Registrar licencia" eyebrow="NOVEDADES" size="wide" onClose={onClose} footer={<><button className="nm2-btn" onClick={onClose}>Cancelar</button><button className="nm2-btn is-primary" disabled={busy} onClick={() => void guardar()}>Registrar</button></>}>
      <div className="nm1-form">
        <Field label="Empleado *" wide><select className="nm2-select" value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })}><option value="">Elegí un empleado</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.nombre} (legajo {e.legajo})</option>)}</select></Field>
        <Field label="Tipo de licencia" wide hint={tipo ? `${tipo.goce ? "Con goce de haberes" : "Sin goce de haberes"}${tipo.dias_default ? ` · habitualmente ${tipo.dias_default} días` : ""}${tipo.norma ? ` · ${tipo.norma}` : ""}` : undefined}>
          <select className="nm2-select" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })}>{tipos.map((t) => <option key={t.id} value={t.clave}>{t.nombre}</option>)}</select></Field>
        <Field label="Desde"><input className="nm2-input" type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value, hasta: e.target.value > f.hasta ? e.target.value : f.hasta })} /></Field>
        <Field label="Hasta"><input className="nm2-input" type="date" value={f.hasta} min={f.desde} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></Field>
        <label className="nm1-check is-wide"><input type="checkbox" checked={f.aprobada} onChange={(e) => setF({ ...f, aprobada: e.target.checked })} /> Aprobarla ahora (recién aprobada cuenta en la liquidación)</label>
        {uso && (
          <div className="is-wide">
            <div className={`nm1-bar ${pct >= 100 ? "is-alert" : pct >= 80 ? "is-warn" : ""}`} role="img" aria-label={`Enfermedad usada: ${uso.dias} de ${uso.tope_dias} días`}><i style={{ width: `${pct}%` }} /></div>
            <p className="nm-muted" style={{ marginTop: 4 }}>Enfermedad en el año de servicio: {uso.dias} de {uso.tope_dias} días de licencia paga ({uso.tope_meses} meses según antigüedad y cargas de familia).</p>
          </div>
        )}
        {(!tipo?.es_salud || verSalud) && (
          <>
            <h3>Certificado (opcional ahora)</h3>
            <Field label="Archivo (PDF o imagen, hasta 1,5 MB)" wide><input className="nm1-file" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => void elegirArchivo(e.target.files?.[0])} /></Field>
            {verSalud && tipo?.es_salud && <Field label="Diagnóstico (se guarda cifrado)" wide hint="Dato de salud: solo lo ve quien tiene permiso y cada lectura queda registrada."><textarea className="nm2-text" value={f.diag} onChange={(e) => setF({ ...f, diag: e.target.value })} /></Field>}
          </>
        )}
      </div>
    </Modal>
  );
}

function CertificadoModal({ l, onClose, onSaved, fail }: { l: any; onClose: () => void; onSaved: () => void; fail: (e: unknown) => void }) {
  const [archivo, setArchivo] = useState<null | { nombre: string; data: string }>(null);
  const [url, setUrl] = useState("");
  const [diag, setDiag] = useState("");
  const [busy, setBusy] = useState(false);
  const verSalud = can("ver_salud");
  const elegir = async (file: File | undefined) => {
    if (!file) { setArchivo(null); return; }
    if (file.size > MAX_ARCHIVO) { fail(new Error("El archivo pesa más de 1,5 MB")); return; }
    try { setArchivo({ nombre: file.name, data: await fileToBase64(file) }); } catch (e) { fail(e); }
  };
  const guardar = async () => {
    setBusy(true);
    try {
      await appApi(`/licencias/${l.id}/certificado`, { method: "PUT", body: { nombre: archivo?.nombre, archivo_data: archivo?.data, url: url.trim() || undefined, diagnostico: diag.trim() || undefined } });
      onSaved();
    } catch (e) { fail(e); }
    setBusy(false);
  };
  return (
    <Modal title={`Certificado · ${l.empleado}`} onClose={onClose} footer={<><button className="nm2-btn" onClick={onClose}>Cancelar</button><button className="nm2-btn is-primary" disabled={busy} onClick={() => void guardar()}>Guardar</button></>}>
      <p className="nm1-sub">{l.tipo} del {fechaCorta(l.desde)} al {fechaCorta(l.hasta)}. {l.tiene_certificado ? "Ya hay un certificado: si subís otro lo reemplaza." : "Todavía no hay certificado."}</p>
      <div className="nm1-form">
        <Field label="Archivo (PDF o imagen, hasta 1,5 MB)" wide><input className="nm1-file" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => void elegir(e.target.files?.[0])} /></Field>
        <Field label="O un enlace al certificado" wide><input className="nm2-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
        {verSalud && l.es_salud && <Field label="Diagnóstico (se guarda cifrado)" wide><textarea className="nm2-text" value={diag} onChange={(e) => setDiag(e.target.value)} /></Field>}
      </div>
    </Modal>
  );
}
