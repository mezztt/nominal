import { useCallback, useEffect, useMemo, useState } from "react";
import { appApi, money } from "../../config";
import { Empty, Field, Loading, Modal, Pill, useFlash } from "../ui";
import { can } from "../g2/common";

const TIPOS: Record<string, string> = { haber: "Haber", descuento: "Descuento", contribucion: "Contribución", informativo: "Informativo" };
const NATURALEZAS: Record<string, string> = { rem: "Remunerativo", no_rem: "No remunerativo", beneficio_103bis: "Beneficio social (art. 103 bis)", art105: "Art. 105 (viáticos y similares)",
  desc_ley: "Descuento de ley", desc_conv: "Descuento de convenio", desc_voluntario: "Descuento voluntario", embargo: "Embargo" };
const POR_TIPO: Record<string, string[]> = { haber: ["rem", "no_rem", "beneficio_103bis", "art105"], descuento: ["desc_ley", "desc_conv", "desc_voluntario", "embargo"] };
const AFECTA: [string, string][] = [["jub", "Jubilación"], ["inssjp", "INSSJP (PAMI)"], ["os", "Obra social"], ["sipa_cont", "Contribuciones SIPA"], ["art", "ART"], ["sac", "SAC"],
  ["vacaciones", "Vacaciones"], ["indemnizacion", "Indemnización"], ["ganancias", "Ganancias"], ["embargo", "Embargo"], ["presentismo", "Presentismo"], ["hora_extra", "Valor de la hora extra"]];
const RUBROS: Record<string, string> = { sindical: "Sindical", seg_social: "Seguridad social", obra_social: "Obra social", inssjp: "INSSJP", art: "ART", camaras: "Cámaras", otros: "Otros" };
const PLANTILLAS: [string, string, any][] = [
  ["Porcentaje de otro concepto", "Ej. 10 % del sueldo básico (concepto 1000)", { op: "mul", args: [{ concepto: "1000" }, { const: 0.1 }] }],
  ["Importe fijo", "Un monto fijo por mes", { const: 50000 }],
  ["Valor hora × horas", "Horas extra al 50 % del mes", { op: "mul", args: [{ op: "round", a: { op: "mul", args: [{ op: "div", a: { ref: "base.basico" }, b: { ref: "cct.divisor_hora" } }, { const: 1.5 }] }, digits: 2 }, { ref: "nov.horas_50" }] }],
  ["Si… entonces…", "Un monto solo si hay horas cargadas", { op: "if", cond: { op: "gt", a: { ref: "nov.horas_50" }, b: { const: 0 } }, then: { const: 20000 }, else: { const: 0 } }],
];

function refsDe(node: any, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) node.forEach((n) => refsDe(n, out));
  else if (node && typeof node === "object") {
    if (typeof node.ref === "string") out.add(node.ref);
    Object.values(node).forEach((v) => refsDe(v, out));
  }
  return out;
}

export default function Conceptos() {
  const [lista, setLista] = useState<any[] | null>(null);
  const [vars, setVars] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [sel, setSel] = useState<any | "nuevo" | null>(null);
  const [error, setError] = useState("");
  const { show, fail, node } = useFlash();
  const edita = can("editar_parametros");

  const cargar = useCallback(async () => {
    try { setLista(await appApi("/conceptos?todos=true")); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el catálogo"); }
  }, []);
  useEffect(() => { void cargar(); appApi("/conceptos/variables").then(setVars).catch(() => setVars([])); }, [cargar]);

  const filtrados = useMemo(() => (lista || []).filter((c) => (!tipo || c.tipo === tipo) && (!q.trim() || (c.codigo + " " + c.nombre).toLowerCase().includes(q.trim().toLowerCase()))), [lista, q, tipo]);
  if (error) return <p className="nm-note nm-note-error">{error}</p>;
  if (!lista) return <Loading />;

  return (
    <div>
      <div className="nm-toolbar">
        <input className="nm-search" placeholder="Buscar por código o nombre" aria-label="Buscar concepto" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="nm-filters">
          <select className="nm-select" aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos los tipos</option>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          {edita && <button className="nm2-btn is-primary" onClick={() => setSel("nuevo")}>Nuevo concepto</button>}
        </div>
      </div>
      <p className="nm1-sub">Cada concepto tiene una fórmula declarativa (sin programar) y marca qué bases afecta. Los de Nominal no se editan: al guardar se crea una versión propia para esta empresa, que gana por código.</p>
      {filtrados.length === 0 ? <div className="nm-card"><Empty title="No hay conceptos con ese filtro" /></div> : (
        <div className="nm-table-wrap"><table className="nm-table">
          <thead><tr><th>Código</th><th>Concepto</th><th>Tipo</th><th>Naturaleza</th><th>Fórmula</th><th>Origen</th></tr></thead>
          <tbody>{filtrados.map((c) => (
            <tr key={c.id} className="is-click" tabIndex={0} onClick={() => setSel(c)} onKeyDown={(e) => { if (e.key === "Enter") setSel(c); }}>
              <td><strong>{c.codigo}</strong></td><td>{c.nombre}{!c.activo && <small>Desactivado</small>}</td><td>{TIPOS[c.tipo]}</td><td>{NATURALEZAS[c.naturaleza]}</td>
              <td>{c.formula ? <Pill tone="green">Con fórmula</Pill> : <Pill tone="gray">La calcula el motor</Pill>}</td>
              <td><Pill tone={c.origen === "nominal" ? "brand" : "violet"}>{c.origen === "nominal" ? "Nominal" : c.personalizado ? "Propio (reemplaza)" : "Propio"}</Pill></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {sel && <ConceptoModal c={sel === "nuevo" ? null : sel} vars={vars} edita={edita} onClose={() => setSel(null)} fail={fail} onSaved={(m) => { setSel(null); void cargar(); show(m); }} />}
      {node}
    </div>
  );
}

function ConceptoModal({ c, vars, edita, onClose, onSaved, fail }: { c: any | null; vars: any[]; edita: boolean; onClose: () => void; onSaved: (m: string) => void; fail: (e: unknown) => void }) {
  const nuevo = !c;
  const [f, setF] = useState({
    codigo: c?.codigo || "", nombre: c?.nombre || "", tipo: c?.tipo || "haber", naturaleza: c?.naturaleza || "rem", unidad: c?.unidad || "", arca: c?.concepto_arca || "", rubro: c?.rubro_costo_laboral || "",
    orden: String(c?.orden ?? 60), activo: c?.activo ?? true, afecta: new Set<string>(c?.afecta || []), formula: c?.formula ? JSON.stringify(c.formula, null, 2) : "",
  });
  const [valores, setValores] = useState<Record<string, string>>({});
  const [res, setRes] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [jsonErr, setJsonErr] = useState("");

  const parsed = useMemo(() => {
    if (!f.formula.trim()) return { ok: true, valor: null as any };
    try { return { ok: true, valor: JSON.parse(f.formula) }; } catch { return { ok: false, valor: null as any }; }
  }, [f.formula]);
  const usadas = useMemo(() => (parsed.ok && parsed.valor ? Array.from(refsDe(parsed.valor)) : []), [parsed]);
  const ejemplos = useMemo(() => Object.fromEntries(vars.map((v) => [v.nombre, v.ejemplo])), [vars]);
  const naturalezas = POR_TIPO[f.tipo] || Object.keys(NATURALEZAS);
  const editable = edita;

  const probar = async () => {
    if (!parsed.ok) { setJsonErr("La fórmula no es un JSON válido: revisá las llaves y las comillas."); return; }
    if (!parsed.valor) { setJsonErr("Escribí una fórmula o elegí una plantilla."); return; }
    setJsonErr(""); setBusy(true);
    const ctxVars: Record<string, string> = {};
    for (const k of usadas) { const v = valores[k] ?? ejemplos[k]; if (v !== undefined && v !== null && v !== "") ctxVars[k] = String(v).replace(",", "."); }
    try { setRes(await appApi("/conceptos/probar", { method: "POST", body: { formula: parsed.valor, contexto: { vars: ctxVars } } })); } catch (e) { setRes({ ok: false, errores: [e instanceof Error ? e.message : "No se pudo probar"] }); }
    setBusy(false);
  };
  const guardar = async () => {
    if (!parsed.ok) { setJsonErr("La fórmula no es un JSON válido."); return; }
    const body: any = { nombre: f.nombre, tipo: f.tipo, naturaleza: f.naturaleza, unidad: f.unidad || null, concepto_arca: f.arca || null, rubro_costo_laboral: f.rubro || null, orden: Number(f.orden) || 0, afecta: Array.from(f.afecta), formula: parsed.valor };
    setBusy(true);
    try {
      if (nuevo) await appApi("/conceptos", { method: "POST", body: { ...body, codigo: f.codigo } });
      else await appApi(`/conceptos/${c.id}`, { method: "PUT", body: { ...body, activo: f.activo } });
      onSaved(c && !c.editable ? "Guardado como versión propia de esta empresa" : "Concepto guardado");
    } catch (e) { fail(e); }
    setBusy(false);
  };
  const toggle = (k: string) => { const n = new Set(f.afecta); if (n.has(k)) n.delete(k); else n.add(k); setF({ ...f, afecta: n }); };

  return (
    <Modal title={nuevo ? "Nuevo concepto" : `${c.codigo} · ${c.nombre}`} eyebrow="CONCEPTO" size="xl" onClose={onClose}
      footer={<><button className="nm2-btn" onClick={onClose}>Cerrar</button>{editable && <button className="nm2-btn is-primary" disabled={busy} onClick={() => void guardar()}>Guardar</button>}</>}>
      {c && !c.editable && edita && <p className="nm-note nm-note-info" style={{ marginBottom: 12 }}>Es un concepto base de Nominal. Si lo cambiás, se guarda una versión propia para esta empresa y el original no se toca.</p>}
      <div className="nm1-form">
        <Field label="Código *" hint={nuevo ? "Ej. 1300. No se puede cambiar después" : undefined}><input className="nm2-input" value={f.codigo} disabled={!nuevo || !edita} onChange={(e) => setF({ ...f, codigo: e.target.value })} /></Field>
        <Field label="Nombre *"><input className="nm2-input" value={f.nombre} disabled={!edita} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
        <Field label="Tipo"><select className="nm2-select" value={f.tipo} disabled={!edita} onChange={(e) => { const t = e.target.value; setF({ ...f, tipo: t, naturaleza: (POR_TIPO[t] || [f.naturaleza])[0] }); }}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Naturaleza"><select className="nm2-select" value={f.naturaleza} disabled={!edita} onChange={(e) => setF({ ...f, naturaleza: e.target.value })}>{naturalezas.map((k) => <option key={k} value={k}>{NATURALEZAS[k]}</option>)}</select></Field>
        <Field label="Unidad"><select className="nm2-select" value={f.unidad} disabled={!edita} onChange={(e) => setF({ ...f, unidad: e.target.value })}><option value="">—</option><option value="$">Pesos</option><option value="%">Porcentaje</option><option value="dias">Días</option><option value="horas">Horas</option><option value="unidad">Unidades</option></select></Field>
        <Field label="Código ARCA (LSD)"><input className="nm2-input" value={f.arca} disabled={!edita} onChange={(e) => setF({ ...f, arca: e.target.value })} /></Field>
        <Field label="Rubro del costo laboral"><select className="nm2-select" value={f.rubro} disabled={!edita} onChange={(e) => setF({ ...f, rubro: e.target.value })}><option value="">—</option>{Object.entries(RUBROS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Orden de cálculo"><input className="nm2-input num" inputMode="numeric" value={f.orden} disabled={!edita} onChange={(e) => setF({ ...f, orden: e.target.value })} /></Field>
        {!nuevo && edita && <label className="nm1-check"><input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Concepto activo</label>}
        <h3>Qué bases afecta</h3>
        <div className="is-wide nm1-chips" style={{ gap: 14 }}>{AFECTA.map(([k, l]) => <label key={k} className="nm1-check"><input type="checkbox" disabled={!edita} checked={f.afecta.has(k)} onChange={() => toggle(k)} /> {l}</label>)}</div>

        <h3>Fórmula</h3>
        {edita && (
          <div className="is-wide nm1-chips">{PLANTILLAS.map(([n, d, fx]) => <button key={n} type="button" className="nm2-btn is-small" title={d} onClick={() => { setF({ ...f, formula: JSON.stringify(fx, null, 2) }); setRes(null); }}>{n}</button>)}</div>
        )}
        <Field label="Fórmula en JSON" wide hint="Sin programar: referencias a variables {&quot;ref&quot;:&quot;base.basico&quot;}, parámetros legales {&quot;param&quot;:&quot;aporte_jubilacion&quot;}, otros conceptos {&quot;concepto&quot;:&quot;1000&quot;} y operaciones (add, mul, sub, div, min, max, if…). Vacía = la calcula el motor.">
          <textarea className="nm1-code" value={f.formula} readOnly={!edita} spellCheck={false} onChange={(e) => { setF({ ...f, formula: e.target.value }); setRes(null); setJsonErr(""); }} aria-label="Fórmula" />
        </Field>
        {jsonErr && <p className="nm-note nm-note-error is-wide">{jsonErr}</p>}

        <h3>Probador</h3>
        {usadas.length > 0 && usadas.map((k) => (
          <Field key={k} label={k} hint={vars.find((v) => v.nombre === k)?.descripcion}>
            <input className="nm2-input num" inputMode="decimal" value={valores[k] ?? (ejemplos[k] ?? "")} onChange={(e) => setValores({ ...valores, [k]: e.target.value })} />
          </Field>
        ))}
        <div className="is-wide"><button className="nm2-btn" disabled={busy} onClick={() => void probar()}>Probar con estos datos</button> <span className="nm-muted">Datos de ejemplo del caso L.1 (Comercio, 10 años de antigüedad): editalos para probar otros casos.</span></div>
        {res && (
          <div className="is-wide nm1-result" role="status">
            {res.ok ? (
              <>
                <p className="nm-note nm-note-info">Resultado: <strong>{money(res.importe)}</strong></p>
                <div className="nm1-formula"><strong>Cómo se calculó:</strong><br /><code>{res.explicacion?.formula}</code> = <code>{res.explicacion?.resultado}</code>
                  {res.explicacion?.valores && Object.keys(res.explicacion.valores).length > 0 && <ul className="nm1-steps" style={{ marginTop: 8 }}>{Object.entries(res.explicacion.valores).map(([k, v]) => <li key={k}><span>{k}</span><span>{String(v)}</span></li>)}</ul>}</div>
              </>
            ) : <p className="nm-note nm-note-error">{(res.errores || []).join(" ")}</p>}
          </div>
        )}
        <Variables vars={vars} />
      </div>
    </Modal>
  );
}

function Variables({ vars }: { vars: any[] }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="is-wide">
      <button className="nm-link" onClick={() => setAbierto(!abierto)}>{abierto ? "Ocultar" : "Ver"} las variables que podés usar ({vars.length})</button>
      {abierto && <div className="nm1-varlist" style={{ marginTop: 8 }}>{vars.map((v) => <div key={v.nombre} className="nm-card" style={{ padding: "6px 10px", borderRadius: 8 }}><code style={{ color: "var(--nm-brand-text)", fontWeight: 700 }}>{v.nombre}</code> <span className="nm-muted">{v.descripcion}</span></div>)}</div>}
    </div>
  );
}
