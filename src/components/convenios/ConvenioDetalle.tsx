import { Fragment, useCallback, useEffect, useState } from "react";
import { appApi, money } from "../../config";
import { Empty, Field, Loading, Modal, Pill, useFlash } from "../ui";
import { can } from "../g2/common";
import { fechaCorta, num, numText } from "../g1/common";

const BASES: Record<string, string> = { basico: "el básico", "basico+antig": "básico + antigüedad", bruto: "el bruto acumulado" };
const RUBROS: Record<string, string> = { sindical: "Sindical", seg_social: "Seguridad social", obra_social: "Obra social", inssjp: "INSSJP", art: "ART", camaras: "Cámaras", otros: "Otros" };

function textoAdicional(a: any): string {
  if (a.tipo === "fijo") return `${money(a.valor)} fijos`;
  if (a.tipo === "div") return `(${BASES[a.base] || a.base}) ÷ ${String(a.valor).replace(".", ",")}`;
  return `${String(a.valor).replace(".", ",")} % ${a.clave === "antiguedad" ? "por año, " : ""}sobre ${BASES[a.base] || a.base}`;
}

export default function ConvenioDetalle({ id, onBack, onChanged, onOpen }: { id: number; onBack: () => void; onChanged: () => void; onOpen: (id: number) => void }) {
  const [c, setC] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"" | "datos" | "categoria" | "escala" | "lote" | "adicionales" | "aportes">("");
  const [catSel, setCatSel] = useState<any | null>(null);
  const [hist, setHist] = useState<number | null>(null);
  const { show, fail, node } = useFlash();
  const edita = can("editar_parametros");

  const cargar = useCallback(async () => {
    try { setC(await appApi(`/convenios/${id}`)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el convenio"); }
  }, [id]);
  useEffect(() => { void cargar(); }, [cargar]);

  if (error) return <div><button className="nm1-back" onClick={onBack}>‹ Volver a los convenios</button><p className="nm-note nm-note-error">{error}</p></div>;
  if (!c) return <Loading />;

  const hecho = async (msg: string) => { setModal(""); setCatSel(null); await cargar(); onChanged(); show(msg); };
  const aceptar = async (usar: boolean) => {
    try { await appApi(`/convenios/${c.id}/aceptar${usar ? "?usar=true" : ""}`, { method: "POST" }); await hecho(usar ? "Paquete aceptado y elegido como convenio por defecto" : "Paquete aceptado"); } catch (e) { fail(e); }
  };
  const duplicar = async () => {
    try { const n = await appApi(`/convenios/${c.id}/duplicar`, { method: "POST" }); onChanged(); onOpen(n.id); } catch (e) { fail(e); }
  };

  return (
    <div>
      <button className="nm1-back" onClick={onBack}>‹ Volver a los convenios</button>
      <div className="nm1-head">
        <div>
          <h2>{c.numero} · {c.nombre} {c.propio ? <Pill tone="violet">Propio</Pill> : <Pill tone={c.aceptado ? "green" : "orange"}>{c.aceptado ? "Aceptado" : "Sin aceptar"}</Pill>}</h2>
          <p>{c.actividad || "Sin actividad indicada"} · divisor de hora {c.divisor_hora} · jornada {String(c.jornada_semanal).replace(".", ",")} h semanales</p>
          {!c.propio && <p>Paquete de Mezztt{c.vigencia_desde ? ` vigente desde ${fechaCorta(c.vigencia_desde)}` : ""} · Fuente: {c.fuente_titulo || "sin fuente cargada"}{c.fuente_url && <> · <a className="nm-link" href={c.fuente_url} target="_blank" rel="noopener noreferrer">ver fuente</a></>}</p>}
        </div>
        {edita && (
          <div className="nm1-actions">
            {!c.propio && !c.aceptado && <button className="nm2-btn is-primary" onClick={() => void aceptar(false)}>Aceptar paquete</button>}
            {!c.propio && c.aceptado && !c.es_defecto && <button className="nm2-btn" onClick={() => void aceptar(true)}>Usar por defecto</button>}
            {!c.propio && <button className="nm2-btn" onClick={() => void duplicar()}>Duplicar y editar</button>}
            {c.propio && <button className="nm2-btn" onClick={() => setModal("datos")}>Editar datos</button>}
            {c.propio && <button className="nm2-btn" onClick={() => setModal("categoria")}>Nueva categoría</button>}
            {c.propio && c.categorias.length > 0 && <button className="nm2-btn is-primary" onClick={() => setModal("lote")}>Aumento paritario</button>}
          </div>
        )}
      </div>
      {!c.propio && !c.aceptado && <p className="nm-note nm-note-warn" style={{ marginBottom: 14 }}>Mezztt publica este paquete con su fuente y fecha, pero no lo aplica solo: revisalo y tocá «Aceptar paquete» para que la empresa lo use.</p>}
      {c.es_defecto && <p className="nm-note nm-note-info" style={{ marginBottom: 14 }}>Es el convenio por defecto de esta empresa.</p>}
      {c.sin_escala_count > 0 && <p className="nm-note nm-note-error" style={{ marginBottom: 14 }}>{c.sin_escala_count} categoría(s) no tienen una escala vigente hoy: los empleados de esas categorías no se pueden liquidar.</p>}

      <div className="nm-card" style={{ marginBottom: 16 }}>
        <div className="nm-card-head"><div><h2>Categorías y escalas</h2><p>El básico sale de la escala vigente de cada categoría. Cada nueva vigencia cierra la anterior.</p></div></div>
        {c.categorias.length === 0 ? <Empty title="Todavía no hay categorías">{c.propio ? "Agregalas con «Nueva categoría»." : "Mezztt todavía no cargó las escalas de este convenio."}</Empty> : (
          <div className="nm-table-wrap"><table className="nm-table">
            <thead><tr><th>Categoría</th><th className="num">Básico vigente</th><th>Desde</th><th>Sumas no remunerativas</th><th /></tr></thead>
            <tbody>{c.categorias.map((k: any) => (
              <Fragment key={k.id}>
                <tr>
                  <td><strong>{k.nombre}</strong><small>{{ completa: "Jornada completa", parcial: "Jornada parcial", jornal: "Jornal" }[k.jornada_tipo as string]}</small></td>
                  {k.escala_vigente ? (
                    <>
                      <td className="num"><strong>{money(k.escala_vigente.basico)}</strong></td>
                      <td>{fechaCorta(k.escala_vigente.vigencia_desde)}{k.escala_vigente.fuente && <small>{k.escala_vigente.fuente}</small>}</td>
                      <td>{Object.keys(k.escala_vigente.sumas_nr).length ? Object.entries(k.escala_vigente.sumas_nr).map(([n, v]) => <span key={n} style={{ display: "block" }}>{n}: {money(v as number)}</span>) : "—"}</td>
                    </>
                  ) : <td colSpan={3}><Pill tone="red">Sin escala vigente</Pill></td>}
                  <td className="num"><button className="nm-link" onClick={() => setHist(hist === k.id ? null : k.id)}>{hist === k.id ? "Ocultar" : `Historial (${k.escalas_count})`}</button>
                    {c.propio && edita && <> · <button className="nm-link" onClick={() => { setCatSel(k); setModal("escala"); }}>Nueva escala</button></>}</td>
                </tr>
                {hist === k.id && (
                  <tr className="nm2-explain"><td colSpan={5}>
                    {(k.escalas || []).map((e: any) => <div key={e.id}><strong>{money(e.basico)}</strong> · desde {fechaCorta(e.vigencia_desde)}{e.vigencia_hasta ? ` hasta ${fechaCorta(e.vigencia_hasta)}` : " (abierta)"}{e.fuente ? ` · ${e.fuente}` : ""}</div>)}
                  </td></tr>
                )}
              </Fragment>))}</tbody>
          </table></div>
        )}
      </div>

      <div className="nm1-cols">
        <div className="nm-card">
          <div className="nm-card-head"><div><h2>Adicionales</h2><p>Antigüedad, presentismo y demás, calculados según el convenio.</p></div>{c.propio && edita && <button className="nm2-btn is-small" onClick={() => setModal("adicionales")}>Editar</button>}</div>
          {c.adicionales.length === 0 ? <Empty title="Sin adicionales" /> : (
            <ul className="nm-list">{c.adicionales.map((a: any) => <li key={a.id}><div className="nm-list-main"><strong>{a.nombre}</strong><small>{textoAdicional(a)}</small></div><Pill tone={a.remunerativo ? "brand" : "gray"}>{a.remunerativo ? "Remunerativo" : "No remunerativo"}</Pill></li>)}</ul>
          )}
        </div>
        <div className="nm-card">
          <div className="nm-card-head"><div><h2>Aportes del convenio</h2><p>Cuota sindical, FAECYS, aportes fijos de obra social.</p></div>{c.propio && edita && <button className="nm2-btn is-small" onClick={() => setModal("aportes")}>Editar</button>}</div>
          {c.aportes.length === 0 ? <Empty title="Sin aportes convencionales" /> : (
            <ul className="nm-list">{c.aportes.map((a: any) => (
              <li key={a.id}><div className="nm-list-main"><strong>{a.nombre}</strong>
                <small>{[a.pct_trabajador > 0 && `${String(a.pct_trabajador).replace(".", ",")} % a cargo del trabajador`, a.pct_empleador > 0 && `${String(a.pct_empleador).replace(".", ",")} % a cargo de la empresa`, a.monto_fijo_empleador > 0 && `${money(a.monto_fijo_empleador)} fijos por trabajador (empresa)`].filter(Boolean).join(" · ")} · sobre {a.base === "bruto" ? "el bruto" : "lo remunerativo"}{a.afiliado_solo ? " · solo afiliados" : ""}</small></div>
                <Pill tone="gray">{RUBROS[a.rubro_costo_laboral] || a.rubro_costo_laboral}</Pill></li>))}</ul>
          )}
          <p className="nm-muted" style={{ marginTop: 10 }}>El art. 9 de la Ley 14.250 (texto Ley 27.802 y Decretos 407 y 612/2026) pone topes a los aportes convencionales (2% de las remuneraciones para los aportes a favor de asociaciones de trabajadores): Nominal avisa si se superan, pero confirmá con tu contador qué aportes entran en el tope.</p>
        </div>
      </div>

      {modal === "datos" && <DatosModal c={c} onClose={() => setModal("")} onDone={() => void hecho("Datos guardados")} fail={fail} />}
      {modal === "categoria" && <CategoriaModal c={c} onClose={() => setModal("")} onDone={() => void hecho("Categoría agregada")} fail={fail} />}
      {modal === "escala" && catSel && <EscalaModal c={c} cat={catSel} onClose={() => { setModal(""); setCatSel(null); }} onDone={() => void hecho("Escala cargada")} fail={fail} />}
      {modal === "lote" && <LoteModal c={c} onClose={() => setModal("")} onDone={(n) => void hecho(`Aumento cargado en ${n} categoría(s)`)} fail={fail} />}
      {modal === "adicionales" && <AdicionalesModal c={c} onClose={() => setModal("")} onDone={() => void hecho("Adicionales guardados")} fail={fail} />}
      {modal === "aportes" && <AportesModal c={c} onClose={() => setModal("")} onDone={() => void hecho("Aportes guardados")} fail={fail} />}
      {node}
    </div>
  );
}

// ------------------------------------------------------------

type P = { c: any; onClose: () => void; fail: (e: unknown) => void };

function Pie({ onClose, onOk, busy, ok = "Guardar" }: { onClose: () => void; onOk: () => void; busy?: boolean; ok?: string }) {
  return <><button className="nm2-btn" onClick={onClose}>Cancelar</button><button className="nm2-btn is-primary" disabled={busy} onClick={onOk}>{ok}</button></>;
}

function DatosModal({ c, onClose, onDone, fail }: P & { onDone: () => void }) {
  const [f, setF] = useState({ nombre: c.nombre, actividad: c.actividad || "", divisor_hora: String(c.divisor_hora), jornada_semanal: numText(c.jornada_semanal), prom: numText(c.reglas?.promedio_remuneracion) });
  const guardar = async () => {
    const reglas = { ...(c.reglas || {}) };
    const p = num(f.prom);
    if (p) reglas.promedio_remuneracion = p; else delete reglas.promedio_remuneracion;
    try {
      await appApi(`/convenios/${c.id}`, { method: "PUT", body: { nombre: f.nombre, actividad: f.actividad || null, divisor_hora: Number(f.divisor_hora), jornada_semanal: num(f.jornada_semanal), reglas } });
      onDone();
    } catch (e) { fail(e); }
  };
  return (
    <Modal title="Datos del convenio" onClose={onClose} footer={<Pie onClose={onClose} onOk={() => void guardar()} />}>
      <div className="nm1-form">
        <Field label="Nombre" wide><input className="nm2-input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
        <Field label="Actividad"><input className="nm2-input" value={f.actividad} onChange={(e) => setF({ ...f, actividad: e.target.value })} /></Field>
        <Field label="Divisor del valor hora" hint="200 para jornada de 48 horas"><input className="nm2-input num" inputMode="numeric" value={f.divisor_hora} onChange={(e) => setF({ ...f, divisor_hora: e.target.value })} /></Field>
        <Field label="Horas semanales"><input className="nm2-input num" inputMode="decimal" value={f.jornada_semanal} onChange={(e) => setF({ ...f, jornada_semanal: e.target.value })} /></Field>
        <Field label="Promedio de remuneraciones del convenio ($)" hint="Para el tope de la indemnización (art. 245: 3 veces este valor). Opcional" wide><input className="nm2-input num" inputMode="decimal" value={f.prom} onChange={(e) => setF({ ...f, prom: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function CategoriaModal({ c, onClose, onDone, fail }: P & { onDone: () => void }) {
  const [f, setF] = useState({ nombre: "", jornada_tipo: "completa", basico: "", desde: new Date().toISOString().slice(0, 10), nr_nombre: "", nr_monto: "" });
  const guardar = async () => {
    const b = num(f.basico);
    const body: any = { nombre: f.nombre, jornada_tipo: f.jornada_tipo };
    if (b) { body.basico = b; body.vigencia_desde = f.desde; const m = num(f.nr_monto); if (f.nr_nombre.trim() && m) body.sumas_nr = { [f.nr_nombre.trim()]: m }; }
    try { await appApi(`/convenios/${c.id}/categorias`, { method: "POST", body }); onDone(); } catch (e) { fail(e); }
  };
  return (
    <Modal title="Nueva categoría" onClose={onClose} footer={<Pie onClose={onClose} onOk={() => void guardar()} />}>
      <div className="nm1-form">
        <Field label="Nombre *" wide><input className="nm2-input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Administrativo A" autoFocus /></Field>
        <Field label="Jornada"><select className="nm2-select" value={f.jornada_tipo} onChange={(e) => setF({ ...f, jornada_tipo: e.target.value })}><option value="completa">Completa</option><option value="parcial">Parcial</option><option value="jornal">Jornal</option></select></Field>
        <Field label="Básico ($)" hint="Podés dejarlo vacío y cargar la escala después"><input className="nm2-input num" inputMode="decimal" value={f.basico} onChange={(e) => setF({ ...f, basico: e.target.value })} /></Field>
        <Field label="Rige desde"><input className="nm2-input" type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></Field>
        <Field label="Suma no remunerativa (nombre)" hint="Opcional"><input className="nm2-input" value={f.nr_nombre} onChange={(e) => setF({ ...f, nr_nombre: e.target.value })} placeholder="Suma fija acuerdo" /></Field>
        <Field label="Suma no remunerativa ($)"><input className="nm2-input num" inputMode="decimal" value={f.nr_monto} onChange={(e) => setF({ ...f, nr_monto: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function EscalaModal({ c, cat, onClose, onDone, fail }: P & { cat: any; onDone: () => void }) {
  const v = cat.escala_vigente;
  const [f, setF] = useState({ desde: new Date().toISOString().slice(0, 10), basico: numText(v?.basico), fuente: "", nrs: Object.entries(v?.sumas_nr || {}).map(([n, m]) => ({ n, m: numText(m as number) })) });
  const guardar = async () => {
    const b = num(f.basico);
    if (!b) { fail(new Error("Poné el básico")); return; }
    const sumas: Record<string, number> = {};
    for (const r of f.nrs) { const m = num(r.m); if (r.n.trim() && m !== null) sumas[r.n.trim()] = m; }
    try { await appApi(`/convenios/${c.id}/escalas`, { method: "POST", body: { categoria_id: cat.id, vigencia_desde: f.desde, basico: b, sumas_nr: sumas, fuente: f.fuente || null } }); onDone(); } catch (e) { fail(e); }
  };
  return (
    <Modal title={`Nueva escala · ${cat.nombre}`} onClose={onClose} footer={<Pie onClose={onClose} onOk={() => void guardar()} />}>
      <div className="nm1-form">
        <Field label="Rige desde"><input className="nm2-input" type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></Field>
        <Field label="Básico ($)"><input className="nm2-input num" inputMode="decimal" value={f.basico} onChange={(e) => setF({ ...f, basico: e.target.value })} /></Field>
        <Field label="Fuente (acuerdo paritario, resolución)" wide><input className="nm2-input" value={f.fuente} onChange={(e) => setF({ ...f, fuente: e.target.value })} placeholder="Acuerdo del 22/07/2026" /></Field>
        <h3>Sumas no remunerativas</h3>
        {f.nrs.map((r, i) => (
          <div key={i} className="is-wide nm-row">
            <input className="nm2-input" style={{ flex: 1 }} aria-label="Nombre de la suma" value={r.n} onChange={(e) => setF({ ...f, nrs: f.nrs.map((x, j) => j === i ? { ...x, n: e.target.value } : x) })} placeholder="Nombre" />
            <input className="nm2-input num" aria-label="Importe" inputMode="decimal" value={r.m} onChange={(e) => setF({ ...f, nrs: f.nrs.map((x, j) => j === i ? { ...x, m: e.target.value } : x) })} placeholder="$" />
            <button className="nm-link nm-link-danger" onClick={() => setF({ ...f, nrs: f.nrs.filter((_, j) => j !== i) })}>Quitar</button>
          </div>
        ))}
        <div className="is-wide"><button className="nm2-btn is-small" onClick={() => setF({ ...f, nrs: [...f.nrs, { n: "", m: "" }] })}>Agregar suma no remunerativa</button></div>
      </div>
    </Modal>
  );
}

function LoteModal({ c, onClose, onDone, fail }: P & { onDone: (n: number) => void }) {
  const [f, setF] = useState({ desde: new Date().toISOString().slice(0, 10), pct: "", fuente: "" });
  const guardar = async () => {
    const p = num(f.pct);
    if (p === null) { fail(new Error("Poné el porcentaje de aumento")); return; }
    try { const r = await appApi(`/convenios/${c.id}/escalas-lote`, { method: "POST", body: { vigencia_desde: f.desde, porcentaje: p, fuente: f.fuente || null } }); onDone(r.lote.cargadas); } catch (e) { fail(e); }
  };
  return (
    <Modal title="Aumento paritario" onClose={onClose} footer={<Pie onClose={onClose} onOk={() => void guardar()} ok="Cargar aumento" />}>
      <p className="nm1-sub">Crea una escala nueva para todas las categorías: el básico vigente más el porcentaje. Las sumas no remunerativas se conservan.</p>
      <div className="nm1-form">
        <Field label="Rige desde"><input className="nm2-input" type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></Field>
        <Field label="Aumento (%)"><input className="nm2-input num" inputMode="decimal" value={f.pct} onChange={(e) => setF({ ...f, pct: e.target.value })} placeholder="1,9" /></Field>
        <Field label="Fuente" wide><input className="nm2-input" value={f.fuente} onChange={(e) => setF({ ...f, fuente: e.target.value })} placeholder="Acuerdo paritario del…" /></Field>
      </div>
    </Modal>
  );
}

function AdicionalesModal({ c, onClose, onDone, fail }: P & { onDone: () => void }) {
  const [rows, setRows] = useState<any[]>(c.adicionales.map((a: any) => ({ clave: a.clave, nombre: a.nombre, tipo: a.tipo, base: a.base, valor: numText(a.valor), remunerativo: a.remunerativo })));
  const set = (i: number, k: string, v: any) => setRows(rows.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const guardar = async () => {
    try {
      await appApi(`/convenios/${c.id}`, { method: "PUT", body: { adicionales: rows.map((r) => ({ ...r, valor: num(String(r.valor)) ?? 0 })) } });
      onDone();
    } catch (e) { fail(e); }
  };
  return (
    <Modal title="Adicionales del convenio" size="xl" onClose={onClose} footer={<Pie onClose={onClose} onOk={() => void guardar()} />}>
      <p className="nm1-sub">La clave «antiguedad» se multiplica por los años de servicio. «% sobre» aplica un porcentaje; «dividir por» sirve para el presentismo (básico + antigüedad ÷ 12).</p>
      <div className="nm-stack">
        {rows.map((r, i) => (
          <div key={i} className="nm1-form" style={{ borderBottom: "1px solid var(--nm-line)", paddingBottom: 12 }}>
            <Field label="Nombre"><input className="nm2-input" value={r.nombre} onChange={(e) => set(i, "nombre", e.target.value)} /></Field>
            <Field label="Clave" hint="Sin espacios, ej. antiguedad"><input className="nm2-input" value={r.clave} onChange={(e) => set(i, "clave", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} /></Field>
            <Field label="Cómo se calcula"><select className="nm2-select" value={r.tipo} onChange={(e) => set(i, "tipo", e.target.value)}><option value="%">% sobre una base</option><option value="div">Dividir una base por</option><option value="fijo">Importe fijo ($)</option></select></Field>
            <Field label={r.tipo === "fijo" ? "Importe ($)" : r.tipo === "div" ? "Divisor" : "Porcentaje (%)"}><input className="nm2-input num" inputMode="decimal" value={r.valor} onChange={(e) => set(i, "valor", e.target.value)} /></Field>
            {r.tipo !== "fijo" && <Field label="Base"><select className="nm2-select" value={r.base} onChange={(e) => set(i, "base", e.target.value)}><option value="basico">El básico</option><option value="basico+antig">Básico + antigüedad</option><option value="bruto">Bruto acumulado</option></select></Field>}
            <div className="nm-row"><label className="nm1-check"><input type="checkbox" checked={r.remunerativo} onChange={(e) => set(i, "remunerativo", e.target.checked)} /> Remunerativo</label>
              <button className="nm-link nm-link-danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Quitar</button></div>
          </div>
        ))}
        <div><button className="nm2-btn is-small" onClick={() => setRows([...rows, { clave: "", nombre: "", tipo: "%", base: "basico", valor: "", remunerativo: true }])}>Agregar adicional</button></div>
      </div>
    </Modal>
  );
}

function AportesModal({ c, onClose, onDone, fail }: P & { onDone: () => void }) {
  const [rows, setRows] = useState<any[]>(c.aportes.map((a: any) => ({ nombre: a.nombre, pct_trabajador: numText(a.pct_trabajador), pct_empleador: numText(a.pct_empleador), monto_fijo_empleador: numText(a.monto_fijo_empleador), base: a.base, afiliado_solo: a.afiliado_solo, rubro_costo_laboral: a.rubro_costo_laboral })));
  const set = (i: number, k: string, v: any) => setRows(rows.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const guardar = async () => {
    try {
      await appApi(`/convenios/${c.id}`, { method: "PUT", body: { aportes: rows.map((r) => ({ ...r, pct_trabajador: num(String(r.pct_trabajador)) ?? 0, pct_empleador: num(String(r.pct_empleador)) ?? 0, monto_fijo_empleador: num(String(r.monto_fijo_empleador)) ?? 0 })) } });
      onDone();
    } catch (e) { fail(e); }
  };
  return (
    <Modal title="Aportes del convenio" size="xl" onClose={onClose} footer={<Pie onClose={onClose} onOk={() => void guardar()} />}>
      <div className="nm-stack">
        {rows.map((r, i) => (
          <div key={i} className="nm1-form" style={{ borderBottom: "1px solid var(--nm-line)", paddingBottom: 12 }}>
            <Field label="Nombre"><input className="nm2-input" value={r.nombre} onChange={(e) => set(i, "nombre", e.target.value)} placeholder="Cuota sindical" /></Field>
            <Field label="Trabajador (%)"><input className="nm2-input num" inputMode="decimal" value={r.pct_trabajador} onChange={(e) => set(i, "pct_trabajador", e.target.value)} /></Field>
            <Field label="Empresa (%)"><input className="nm2-input num" inputMode="decimal" value={r.pct_empleador} onChange={(e) => set(i, "pct_empleador", e.target.value)} /></Field>
            <Field label="Importe fijo de la empresa ($)"><input className="nm2-input num" inputMode="decimal" value={r.monto_fijo_empleador} onChange={(e) => set(i, "monto_fijo_empleador", e.target.value)} /></Field>
            <Field label="Se calcula sobre"><select className="nm2-select" value={r.base} onChange={(e) => set(i, "base", e.target.value)}><option value="bruto">El bruto (rem. + no rem.)</option><option value="remunerativo">Solo lo remunerativo</option></select></Field>
            <Field label="Rubro en el costo laboral"><select className="nm2-select" value={r.rubro_costo_laboral} onChange={(e) => set(i, "rubro_costo_laboral", e.target.value)}>{Object.entries(RUBROS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <div className="nm-row"><label className="nm1-check"><input type="checkbox" checked={r.afiliado_solo} onChange={(e) => set(i, "afiliado_solo", e.target.checked)} /> Solo afiliados</label>
              <button className="nm-link nm-link-danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Quitar</button></div>
          </div>
        ))}
        <div><button className="nm2-btn is-small" onClick={() => setRows([...rows, { nombre: "", pct_trabajador: "", pct_empleador: "", monto_fijo_empleador: "", base: "bruto", afiliado_solo: false, rubro_costo_laboral: "sindical" }])}>Agregar aporte</button></div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------

/** Alta de un convenio propio, con atajos para antigüedad, presentismo, cuota sindical y una lista de categorías. */
export function NuevoConvenio({ onClose, onCreated, fail }: { onClose: () => void; onCreated: (id: number) => void; fail: (e: unknown) => void }) {
  const [f, setF] = useState({ numero: "", nombre: "", actividad: "", divisor: "200", jornada: "48", desde: new Date().toISOString().slice(0, 10), antig: true, antigPct: "1", presentismo: true, sindical: "", cats: "" });
  const [busy, setBusy] = useState(false);
  const crear = async () => {
    const categorias: any[] = [];
    for (const [i, linea] of f.cats.split("\n").map((l) => l.trim()).filter(Boolean).entries()) {
      const partes = linea.split(/[;\t]/).map((x) => x.trim());
      const b = partes[1] ? num(partes[1]) : null;
      if (!partes[0]) continue;
      if (partes[1] && b === null) { fail(new Error(`Línea ${i + 1} de categorías: «${partes[1]}» no es un importe`)); return; }
      categorias.push(b ? { nombre: partes[0], basico: b, vigencia_desde: f.desde } : { nombre: partes[0] });
    }
    const adicionales: any[] = [];
    if (f.antig) adicionales.push({ clave: "antiguedad", nombre: "Antigüedad", tipo: "%", base: "basico", valor: num(f.antigPct) ?? 1, remunerativo: true });
    if (f.presentismo) adicionales.push({ clave: "presentismo", nombre: "Presentismo", tipo: "div", base: "basico+antig", valor: 12, remunerativo: true });
    const aportes: any[] = [];
    const s = num(f.sindical);
    if (s) aportes.push({ nombre: "Cuota sindical", pct_trabajador: s, base: "bruto", rubro_costo_laboral: "sindical" });
    setBusy(true);
    try {
      const r = await appApi("/convenios", { method: "POST", body: { numero: f.numero, nombre: f.nombre, actividad: f.actividad || null, divisor_hora: Number(f.divisor), jornada_semanal: num(f.jornada), categorias, adicionales, aportes } });
      onCreated(r.id);
    } catch (e) { fail(e); }
    setBusy(false);
  };
  return (
    <Modal title="Convenio propio" eyebrow="NUEVO CONVENIO" size="xl" onClose={onClose} footer={<Pie onClose={onClose} onOk={() => void crear()} busy={busy} ok="Crear convenio" />}>
      <p className="nm1-sub">Para un convenio que no está en el catálogo de Mezztt, o para una versión propia. Después podés agregar categorías, escalas y adicionales.</p>
      <div className="nm1-form">
        <Field label="Número *" hint="Ej. 130/75"><input className="nm2-input" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} autoFocus /></Field>
        <Field label="Nombre *" wide><input className="nm2-input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Empleados de comercio" /></Field>
        <Field label="Actividad"><input className="nm2-input" value={f.actividad} onChange={(e) => setF({ ...f, actividad: e.target.value })} /></Field>
        <Field label="Divisor del valor hora"><input className="nm2-input num" inputMode="numeric" value={f.divisor} onChange={(e) => setF({ ...f, divisor: e.target.value })} /></Field>
        <Field label="Horas semanales"><input className="nm2-input num" inputMode="decimal" value={f.jornada} onChange={(e) => setF({ ...f, jornada: e.target.value })} /></Field>
        <h3>Adicionales y aportes más comunes</h3>
        <label className="nm1-check"><input type="checkbox" checked={f.antig} onChange={(e) => setF({ ...f, antig: e.target.checked })} /> Antigüedad: % por año de servicio sobre el básico</label>
        {f.antig && <Field label="% por año"><input className="nm2-input num" inputMode="decimal" value={f.antigPct} onChange={(e) => setF({ ...f, antigPct: e.target.value })} /></Field>}
        <label className="nm1-check"><input type="checkbox" checked={f.presentismo} onChange={(e) => setF({ ...f, presentismo: e.target.checked })} /> Presentismo: (básico + antigüedad) ÷ 12</label>
        <Field label="Cuota sindical del trabajador (%)" hint="Opcional"><input className="nm2-input num" inputMode="decimal" value={f.sindical} onChange={(e) => setF({ ...f, sindical: e.target.value })} /></Field>
        <h3>Categorías</h3>
        <Field label="Rige desde"><input className="nm2-input" type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></Field>
        <Field label="Una por línea: nombre; básico" wide hint="Podés pegar desde una planilla (separadas por ; o tabulación). El básico es opcional.">
          <textarea className="nm2-text" style={{ minHeight: 110 }} value={f.cats} onChange={(e) => setF({ ...f, cats: e.target.value })} placeholder={"Maestranza A; 1183900\nAdministrativo B; 1250000"} />
        </Field>
      </div>
    </Modal>
  );
}
