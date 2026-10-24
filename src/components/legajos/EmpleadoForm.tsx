import { useEffect, useState } from "react";
import { appApi } from "../../config";
import { Field, Modal } from "../ui";
import { num, numText } from "../g1/common";
import { can } from "../g2/common";

interface Opciones { convenios: { id: number; numero: string; nombre: string; fuera_de_convenio: boolean; categorias: { id: number; nombre: string }[] }[]; defecto: number | null }

const TXT = ["nombre", "legajo", "cuil", "dni", "fecha_nac", "domicilio", "email", "tel", "fecha_ingreso", "fecha_ingreso_reconocida", "tarea", "obra_social", "obra_social_codigo", "banco"];

/** Alta y edición de un legajo. En la edición el contrato (convenio, categoría, sueldo) se cambia desde «Cambiar categoría» y «Aumento», para que quede en el historial. */
export default function EmpleadoForm({ emp, onClose, onSaved }: { emp: any | null; onClose: () => void; onSaved: (e: any, avisos: string[]) => void }) {
  const editando = !!emp;
  const [f, setF] = useState<Record<string, any>>(() => {
    const base: Record<string, any> = {};
    for (const k of TXT) base[k] = emp?.[k] ?? "";
    base.modalidad = emp?.modalidad || "completa";
    base.jornada_horas = numText(emp?.jornada_horas);
    base.sindicato_afiliado = !!emp?.sindicato_afiliado;
    base.rifl = !!emp?.rifl;
    base.art_exento = !!emp?.art_exento;
    base.observaciones = emp?.observaciones ?? "";
    base.cct_id = emp?.cct_id ?? "";
    base.categoria_id = emp?.categoria_id ?? "";
    base.sueldo_basico_pactado = numText(emp?.sueldo_basico_pactado);
    base.cbu = "";
    base.borrar_cbu = false;
    return base;
  });
  const [ops, setOps] = useState<Opciones | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    appApi<Opciones>("/empleados/convenios").then((o) => {
      setOps(o);
      if (!editando && o.defecto && !f.cct_id) setF((p) => ({ ...p, cct_id: o.defecto }));
    }).catch(() => setOps({ convenios: [], defecto: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cct = ops?.convenios.find((c) => c.id === Number(f.cct_id));
  const fuera = !f.cct_id || !!cct?.fuera_de_convenio;

  const guardar = async () => {
    setError("");
    if (!String(f.nombre).trim()) { setError("Falta el nombre (Apellido, Nombre)."); return; }
    const body: Record<string, any> = {};
    for (const k of TXT) {
      const v = String(f[k] ?? "").trim();
      if (editando) body[k] = v || null;
      else if (v) body[k] = v;
    }
    body.modalidad = f.modalidad;
    const jh = num(String(f.jornada_horas));
    if (jh !== null) body.jornada_horas = jh; else if (editando) body.jornada_horas = null;
    body.sindicato_afiliado = !!f.sindicato_afiliado;
    body.rifl = !!f.rifl;
    body.art_exento = !!f.art_exento;
    if (can("ver_salud")) { const o = String(f.observaciones).trim(); if (editando || o) body.observaciones = o || null; }
    if (f.cbu.trim()) body.cbu = f.cbu.trim(); else if (editando && f.borrar_cbu) body.cbu = "";
    if (!editando) {
      if (f.cct_id) body.cct_id = Number(f.cct_id);
      if (f.categoria_id) body.categoria_id = Number(f.categoria_id);
      const sp = num(String(f.sueldo_basico_pactado));
      if (sp !== null && fuera) body.sueldo_basico_pactado = sp;
    }
    setBusy(true);
    try {
      const r = editando ? await appApi(`/empleados/${emp.id}`, { method: "PUT", body }) : await appApi("/empleados", { method: "POST", body });
      onSaved(r, r.avisos || []);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
    setBusy(false);
  };

  return (
    <Modal title={editando ? `Editar a ${emp.nombre}` : "Nuevo empleado"} eyebrow="LEGAJO" size="xl" onClose={onClose}
      footer={<><button className="nm2-btn" onClick={onClose}>Cancelar</button><button className="nm2-btn is-primary" disabled={busy} onClick={() => void guardar()}>{editando ? "Guardar cambios" : "Crear legajo"}</button></>}>
      <div className="nm1-form">
        <h3>Datos personales</h3>
        <Field label="Apellido y nombre *" wide><input className="nm2-input" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Pérez, Ana" autoFocus /></Field>
        <Field label="CUIL" hint="11 números; validamos el dígito verificador"><input className="nm2-input" inputMode="numeric" value={f.cuil} onChange={(e) => set("cuil", e.target.value)} placeholder="27-12345678-0" /></Field>
        <Field label="DNI"><input className="nm2-input" inputMode="numeric" value={f.dni} onChange={(e) => set("dni", e.target.value)} /></Field>
        <Field label="Fecha de nacimiento"><input className="nm2-input" type="date" value={f.fecha_nac} onChange={(e) => set("fecha_nac", e.target.value)} /></Field>
        <Field label="Domicilio"><input className="nm2-input" value={f.domicilio} onChange={(e) => set("domicilio", e.target.value)} /></Field>
        <Field label="Email"><input className="nm2-input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Teléfono"><input className="nm2-input" value={f.tel} onChange={(e) => set("tel", e.target.value)} /></Field>

        <h3>Contrato</h3>
        <Field label="N.º de legajo" hint={editando ? undefined : "Si lo dejás vacío ponemos el siguiente"}><input className="nm2-input" value={f.legajo} onChange={(e) => set("legajo", e.target.value)} /></Field>
        <Field label="Fecha de ingreso"><input className="nm2-input" type="date" value={f.fecha_ingreso} onChange={(e) => set("fecha_ingreso", e.target.value)} /></Field>
        <Field label="Antigüedad reconocida desde" hint="Solo si es anterior al ingreso (por ejemplo, otra empresa del grupo)"><input className="nm2-input" type="date" value={f.fecha_ingreso_reconocida} onChange={(e) => set("fecha_ingreso_reconocida", e.target.value)} /></Field>
        {editando ? (
          <div className="is-wide"><p className="nm-note nm-note-info">Convenio, categoría y sueldo: <strong>{emp.cct_numero ? `${emp.cct_numero} · ${emp.categoria_nombre || "sin categoría"}` : "fuera de convenio"}</strong>. Para cambiarlos usá «Cambiar categoría» o «Aumento» en la ficha, así queda en el historial.</p></div>
        ) : (
          <>
            <Field label="Convenio">
              <select className="nm2-select" value={f.cct_id} onChange={(e) => setF((p) => ({ ...p, cct_id: e.target.value, categoria_id: "" }))}>
                <option value="">Fuera de convenio</option>
                {ops?.convenios.filter((c) => !c.fuera_de_convenio).map((c) => <option key={c.id} value={c.id}>{c.numero} · {c.nombre}</option>)}
              </select>
            </Field>
            {!fuera && (
              <Field label="Categoría" hint={cct && cct.categorias.length === 0 ? "Este convenio todavía no tiene categorías" : undefined}>
                <select className="nm2-select" value={f.categoria_id} onChange={(e) => set("categoria_id", e.target.value)}>
                  <option value="">Elegí una categoría</option>
                  {cct?.categorias.map((k) => <option key={k.id} value={k.id}>{k.nombre}</option>)}
                </select>
              </Field>
            )}
            {fuera && <Field label="Sueldo básico pactado ($)" hint="Fuera de convenio el básico es el que se pacta"><input className="nm2-input num" inputMode="decimal" value={f.sueldo_basico_pactado} onChange={(e) => set("sueldo_basico_pactado", e.target.value)} /></Field>}
          </>
        )}
        <Field label="Tarea / puesto"><input className="nm2-input" value={f.tarea} onChange={(e) => set("tarea", e.target.value)} /></Field>
        <Field label="Modalidad">
          <select className="nm2-select" value={f.modalidad} onChange={(e) => set("modalidad", e.target.value)}>
            <option value="completa">Jornada completa</option><option value="parcial">Jornada parcial</option><option value="jornal">Jornal</option>
          </select>
        </Field>
        <Field label="Horas semanales" hint="Vacío = la del convenio"><input className="nm2-input num" inputMode="decimal" value={f.jornada_horas} onChange={(e) => set("jornada_horas", e.target.value)} /></Field>
        <Field label="Obra social"><input className="nm2-input" value={f.obra_social} onChange={(e) => set("obra_social", e.target.value)} /></Field>
        <Field label="Código de obra social (RNOS)"><input className="nm2-input" value={f.obra_social_codigo} onChange={(e) => set("obra_social_codigo", e.target.value)} /></Field>
        <div className="is-wide nm1-chips" style={{ gap: 18 }}>
          <label className="nm1-check"><input type="checkbox" checked={f.sindicato_afiliado} onChange={(e) => set("sindicato_afiliado", e.target.checked)} /> Afiliado al sindicato</label>
          <label className="nm1-check"><input type="checkbox" checked={f.rifl} onChange={(e) => set("rifl", e.target.checked)} /> Alta bajo RIFL</label>
          <label className="nm1-check"><input type="checkbox" checked={f.art_exento} onChange={(e) => set("art_exento", e.target.checked)} /> Sin ART</label>
        </div>

        <h3>Cobro del sueldo</h3>
        <Field label="Banco"><input className="nm2-input" value={f.banco} onChange={(e) => set("banco", e.target.value)} /></Field>
        <Field label={editando && emp.tiene_cbu ? "CBU nuevo" : "CBU"} hint={editando && emp.tiene_cbu ? "Ya hay uno guardado (cifrado). Completalo solo para reemplazarlo" : "22 números. Se guarda cifrado"}>
          <input className="nm2-input nm1-mono" inputMode="numeric" autoComplete="off" value={f.cbu} onChange={(e) => set("cbu", e.target.value)} />
        </Field>
        {editando && emp.tiene_cbu && <label className="nm1-check"><input type="checkbox" checked={f.borrar_cbu} onChange={(e) => set("borrar_cbu", e.target.checked)} /> Borrar el CBU guardado</label>}

        {can("ver_salud") && (
          <>
            <h3>Observaciones</h3>
            <Field label="Notas internas (pueden incluir datos de salud)" wide hint="Solo las ven quienes tienen permiso para datos de salud"><textarea className="nm2-text" value={f.observaciones} onChange={(e) => set("observaciones", e.target.value)} /></Field>
          </>
        )}
      </div>
      {error && <p className="nm-note nm-note-error" style={{ marginTop: 12 }}>{error}</p>}
    </Modal>
  );
}
