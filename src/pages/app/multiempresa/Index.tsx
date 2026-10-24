import { useCallback, useEffect, useState } from "react";
import { appApi, setEmployerId, shortDate } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Tabs, strOrNull, useFlash } from "../../../components/ui";
import "../../../g3.css";

interface Alerta { clave: string; texto: string; tono: string }
interface Fila {
  id: number; razon_social: string; cuit: string | null; es_principal: boolean; empleados: number; alertas: Alerta[]; total_alertas: number;
  periodo_abierto: { etiqueta: string; tipo: string; estado: string; estado_label: string } | null;
  proximo_vencimiento: { etiqueta: string; vence: string; dias: number } | null;
}
interface Tablero { empresas: Fila[]; total_alertas: number; con_periodo_abierto: number }
interface Empresa { id: number; razon_social: string; cuit: string | null; es_principal: boolean; es_mipyme: boolean; mipyme_vigencia: string | null; domicilio: string | null; actividad: string | null; empleados: number; alertas: number }
interface Venc { employer_id: number; empresa: string; tipo: string; etiqueta: string; periodo: string | null; vence: string; dias: number; vencido: boolean }
interface Usuario { id: number; name: string; email: string; role: string; active: boolean; employer_ids: number[] }

type Tab = "tablero" | "empresas" | "usuarios" | "vencimientos";
type Cb = { fail: (e: unknown) => void; show: (t: string) => void };

function entrar(id: number) { setEmployerId(id); window.location.assign("/app"); }

export default function MultiempresaPage() {
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<Tab>("tablero");
  return (
    <section className="products-page">
      <PageHeader eyebrow="ESTUDIO CONTABLE" title="Empresas del estudio" subtitle="Todas las empresas que liquidás en un solo tablero. Cada empresa tiene su propia liquidación, sus empleados y sus parámetros." />
      <div className="g3-tabs-wrap"><Tabs<Tab> value={tab} onChange={setTab} options={[["tablero", "Tablero"], ["empresas", "Empresas"], ["vencimientos", "Vencimientos"], ["usuarios", "Usuarios"]]} /></div>
      {tab === "tablero" && <TableroTab fail={fail} />}
      {tab === "empresas" && <EmpresasTab fail={fail} show={show} />}
      {tab === "vencimientos" && <VencTab fail={fail} />}
      {tab === "usuarios" && <UsuariosTab fail={fail} show={show} />}
      {flash}
    </section>
  );
}

function TableroTab({ fail }: { fail: (e: unknown) => void }) {
  const [d, setD] = useState<Tablero | null>(null);
  useEffect(() => { appApi<Tablero>("/estudio/tablero").then(setD).catch(fail); }, [fail]);
  if (!d) return <Loading />;
  if (!d.empresas.length) return <Empty title="Todavía no hay empresas">Cargá la primera en la solapa «Empresas».</Empty>;
  return (
    <>
      <div className="nm-kpis">
        <div className="nm-kpi"><span>Empresas</span><strong>{d.empresas.length}</strong></div>
        <div className="nm-kpi"><span>Con período abierto</span><strong>{d.con_periodo_abierto}</strong></div>
        <div className="nm-kpi"><span>Alertas</span><strong>{d.total_alertas}</strong></div>
      </div>
      <div className="g3-cards">
        {d.empresas.map((f) => (
          <article key={f.id} className="g3-card">
            <header>
              <div><strong>{f.razon_social}</strong><small>{f.cuit || "Sin CUIT"} · {f.empleados} empleado(s)</small></div>
              <button className="primary-button" onClick={() => entrar(f.id)}>Entrar</button>
            </header>
            <p>{f.periodo_abierto ? <><Pill tone="blue">{f.periodo_abierto.estado_label}</Pill> {f.periodo_abierto.etiqueta}</> : <span className="nm-muted">Sin período abierto</span>}</p>
            {f.proximo_vencimiento && <p className="nm-muted">Próximo: {f.proximo_vencimiento.etiqueta}, {shortDate(f.proximo_vencimiento.vence)} ({f.proximo_vencimiento.dias < 0 ? "vencido" : `en ${f.proximo_vencimiento.dias} día(s)`})</p>}
            {f.alertas.length === 0 ? <Pill tone="green">Sin alertas</Pill> : (
              <ul className="g3-alerts">{f.alertas.map((a) => <li key={a.clave} className={a.tono === "alert" ? "is-alert" : ""}>{a.texto}</li>)}</ul>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function EmpresasTab({ fail, show }: Cb) {
  const [rows, setRows] = useState<Empresa[] | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const load = useCallback(() => { appApi<Empresa[]>("/estudio/empresas").then(setRows).catch(fail); }, [fail]);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  return (
    <>
      <div className="nm-toolbar"><span /><button className="primary-button" onClick={() => setNuevo(true)}>+ Nueva empresa</button></div>
      {rows.length === 0 ? <Empty title="Sin empresas">Cargá la primera con «Nueva empresa».</Empty> : (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>Empresa</th><th>CUIT</th><th className="num">Empleados</th><th>MiPyME</th><th /></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.razon_social}</strong>{e.actividad && <small>{e.actividad}</small>}</td><td>{e.cuit || "—"}</td><td className="num">{e.empleados}</td>
                  <td>{e.es_mipyme ? <Pill tone="green">{e.mipyme_vigencia ? "Hasta " + shortDate(e.mipyme_vigencia) : "Sí"}</Pill> : "No"}</td>
                  <td><button className="secondary-button" onClick={() => entrar(e.id)}>Entrar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nuevo && <EmpresaForm onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); show("Empresa creada"); load(); }} />}
    </>
  );
}

function EmpresaForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ razon_social: "", cuit: "", domicilio: "", localidad: "", actividad: "", es_mipyme: false, mipyme_vigencia: "" });
  const [error, setError] = useState("");
  const set = (k: string, v: string | boolean) => setF({ ...f, [k]: v });
  async function save() {
    setError("");
    try {
      await appApi("/estudio/empresas", { method: "POST", body: { ...f, domicilio: strOrNull(f.domicilio), localidad: strOrNull(f.localidad), actividad: strOrNull(f.actividad), mipyme_vigencia: f.mipyme_vigencia || null } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  return (
    <Modal eyebrow="NUEVA EMPRESA" title="Empresa cliente" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Crear</button></>}>
      <div className="product-form">
        <Field label="Razón social"><input value={f.razon_social} onChange={(e) => set("razon_social", e.target.value)} /></Field>
        <Field label="CUIT" hint="Con o sin guiones"><input inputMode="numeric" value={f.cuit} onChange={(e) => set("cuit", e.target.value)} /></Field>
        <Field label="Domicilio"><input value={f.domicilio} onChange={(e) => set("domicilio", e.target.value)} /></Field>
        <Field label="Localidad"><input value={f.localidad} onChange={(e) => set("localidad", e.target.value)} /></Field>
        <Field label="Actividad"><input value={f.actividad} onChange={(e) => set("actividad", e.target.value)} /></Field>
        <label className="g3-check"><input type="checkbox" checked={f.es_mipyme} onChange={(e) => set("es_mipyme", e.target.checked)} /> Tiene certificado MiPyME vigente</label>
        {f.es_mipyme && <Field label="Vence el certificado"><input type="date" value={f.mipyme_vigencia} onChange={(e) => set("mipyme_vigencia", e.target.value)} /></Field>}
        {error && <div className="nm-note nm-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

function VencTab({ fail }: { fail: (e: unknown) => void }) {
  const [dias, setDias] = useState(45);
  const [items, setItems] = useState<Venc[] | null>(null);
  useEffect(() => { setItems(null); appApi<{ items: Venc[] }>(`/estudio/vencimientos?dias=${dias}`).then((r) => setItems(r.items)).catch(fail); }, [dias, fail]);
  return (
    <>
      <div className="nm-toolbar"><div className="nm-filters"><select value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Ventana"><option value={30}>Próximos 30 días</option><option value={45}>Próximos 45 días</option><option value={90}>Próximos 90 días</option></select></div></div>
      {!items ? <Loading /> : items.length === 0 ? <Empty title="Nada por vencer">No hay vencimientos pendientes en esa ventana.</Empty> : (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>Vence</th><th>Empresa</th><th>Qué</th><th /></tr></thead>
            <tbody>
              {items.map((v, i) => (
                <tr key={i}>
                  <td><strong>{shortDate(v.vence)}</strong><small>{v.dias < 0 ? `Venció hace ${-v.dias} día(s)` : v.dias === 0 ? "Hoy" : `En ${v.dias} día(s)`}</small></td>
                  <td>{v.empresa}</td><td>{v.etiqueta}{v.periodo ? ` · ${v.periodo}` : ""}</td>
                  <td>{v.vencido ? <Pill tone="red">Vencido</Pill> : <Pill tone="amber">Pendiente</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const ROLES_INV: [string, string][] = [["ESTUDIO_USER", "Usuario del estudio"], ["CONSULTA", "Dueño de la empresa cliente (solo mira)"], ["RRHH", "RRHH de la empresa"], ["CONTADOR", "Contador"]];

function UsuariosTab({ fail, show }: Cb) {
  const [rows, setRows] = useState<Usuario[] | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [nuevo, setNuevo] = useState(false);
  const load = useCallback(() => {
    appApi<Usuario[]>("/estudio/usuarios").then(setRows).catch(fail);
    appApi<Empresa[]>("/estudio/empresas").then(setEmpresas).catch(fail);
  }, [fail]);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  const nombre = (id: number) => empresas.find((e) => e.id === id)?.razon_social || `#${id}`;
  return (
    <>
      <div className="nm-toolbar"><span /><button className="primary-button" onClick={() => setNuevo(true)}>+ Invitar usuario</button></div>
      <div className="nm-table-wrap">
        <table className="nm-table">
          <thead><tr><th>Usuario</th><th>Rol</th><th>Empresas</th><th>Estado</th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong><small>{u.email}</small></td><td>{ROLES_INV.find(([k]) => k === u.role)?.[1] || u.role}</td>
                <td>{u.employer_ids.length ? u.employer_ids.map(nombre).join(", ") : "Todas"}</td><td>{u.active ? <Pill tone="green">Activo</Pill> : <Pill tone="gray">Inactivo</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nuevo && <UsuarioForm empresas={empresas} onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); show("Usuario creado"); load(); }} />}
    </>
  );
}

function UsuarioForm({ empresas, onClose, onSaved }: { empresas: Empresa[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", email: "", password: "", role: "CONSULTA" });
  const [ids, setIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  async function save() {
    setError("");
    try { await appApi("/estudio/usuarios", { method: "POST", body: { ...f, employer_ids: ids } }); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear"); }
  }
  return (
    <Modal eyebrow="INVITAR" title="Nuevo usuario" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Crear</button></>}>
      <div className="product-form">
        <Field label="Nombre"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Contraseña inicial" hint="Mínimo 6 caracteres. Pasásela por un canal seguro."><input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Rol"><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES_INV.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Puede ver estas empresas">
          <div style={{ display: "grid", gap: 6 }}>
            {empresas.map((e) => <label key={e.id} className="g3-check"><input type="checkbox" checked={ids.includes(e.id)} onChange={(ev) => setIds(ev.target.checked ? [...ids, e.id] : ids.filter((x) => x !== e.id))} /> {e.razon_social}</label>)}
          </div>
        </Field>
        {error && <div className="nm-note nm-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
