import { useCallback, useEffect, useState } from "react";
import { adminApi, shortDate } from "../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Tabs, strOrNull, useFlash } from "../../components/ui";

type Tab = "parametros" | "convenios" | "revisiones";
interface Param {
  id: number; clave: string; valor: unknown; periodicidad: string; ambito: string; vigencia_desde: string; vigencia_hasta: string | null;
  fuente_titulo: string; fuente_url: string | null; nota: string | null; verificado: boolean; estado: string; status: string; es_vigente?: boolean;
}
interface CctPkg { id: number; numero: string; nombre: string; actividad: string | null; estado: string; vigencia_desde: string | null; fuente_titulo: string | null; categorias_count: number; nota: string | null }
interface Review { id: number; fecha: string; fuente_revisada: string; estado: string; resultado: string | null }

const TONE: Record<string, [string, string]> = {
  vigente: ["green", "Vigente"], por_vencer: ["orange", "Por vencer"], vencido: ["red", "Vencido"], borrador: ["gray", "Borrador"], historico: ["gray", "Histórico"],
};
const text = (v: unknown) => { const t = typeof v === "string" ? v : JSON.stringify(v); return t.length > 70 ? t.slice(0, 67) + "..." : t; };

/** Panel de Mezztt: publica los parámetros legales y los paquetes de convenios con vigencia, fuente y fecha. */
export default function AdminParametros() {
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<Tab>("parametros");
  return (
    <section className="products-page">
      <PageHeader eyebrow="MEZZTT · NOMINAL" title="Parámetros legales" subtitle="Lo que publicás acá lo ven todos los clientes, con su fuente y fecha. Nominal no actualiza nada solo." />
      <Tabs<Tab> value={tab} onChange={setTab} options={[["parametros", "Parámetros"], ["convenios", "Convenios"], ["revisiones", "Revisión semanal"]]} />
      {tab === "parametros" && <ParamsTab show={show} fail={fail} />}
      {tab === "convenios" && <CctTab show={show} fail={fail} />}
      {tab === "revisiones" && <ReviewsTab show={show} fail={fail} />}
      {flash}
    </section>
  );
}

type Msg = { show: (t: string, e?: boolean) => void; fail: (e: unknown) => void };

function ParamsTab({ show, fail }: Msg) {
  const [rows, setRows] = useState<Param[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => { adminApi<Param[]>("/admin/legal-params").then(setRows).catch(fail); }, [fail]);
  useEffect(load, [load]);
  async function act(path: string, method: string, ok: string) {
    try { await adminApi(path, { method }); show(ok); load(); } catch (e) { fail(e); }
  }
  if (!rows) return <Loading />;
  return (
    <div className="nm-card">
      <div className="nm-card-head"><div><h2>Parámetros</h2><p>Un borrador no lo ve nadie hasta que lo publicás. Al publicar se avisa a los clientes.</p></div>
        <button className="primary-button" onClick={() => setCreating(true)}>+ Nuevo parámetro</button></div>
      {rows.length === 0 ? <Empty title="Sin parámetros">Cargá el primero con «Nuevo parámetro».</Empty> : (
        <div className="nm-table-wrap"><table className="nm-table">
          <thead><tr><th>Clave</th><th>Valor</th><th>Vigencia</th><th>Fuente</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => {
              const [tone, label] = TONE[p.status] || ["gray", p.status];
              return (
                <tr key={p.id}>
                  <td><strong>{p.clave}</strong><small>{p.periodicidad}{p.ambito === "cct" ? " · convenio" : ""}</small></td>
                  <td>{text(p.valor)}</td>
                  <td>{shortDate(p.vigencia_desde)}{p.vigencia_hasta ? ` a ${shortDate(p.vigencia_hasta)}` : ""}</td>
                  <td>{p.fuente_titulo}{(!p.verificado || p.nota) && <small>{!p.verificado ? "Sin verificar. " : ""}{p.nota}</small>}</td>
                  <td><Pill tone={tone}>{label}</Pill></td>
                  <td className="nm-row">
                    {p.estado === "borrador" && <button className="primary-button" onClick={() => act(`/admin/legal-params/${p.id}/publish`, "POST", "Publicado")}>Publicar</button>}
                    {p.estado === "publicado" && <button className="secondary-button" onClick={() => act(`/admin/legal-params/${p.id}/duplicate`, "POST", "Borrador creado")}>Nueva versión</button>}
                    {p.estado === "borrador" && <button className="nm-link nm-link-danger" onClick={() => { if (confirm("¿Borrar este borrador?")) act(`/admin/legal-params/${p.id}`, "DELETE", "Borrado"); }}>Borrar</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
      {creating && <NewParam onClose={() => setCreating(false)} onSaved={() => { setCreating(false); show("Borrador guardado"); load(); }} />}
    </div>
  );
}

function NewParam({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ clave: "", valor: "", periodicidad: "mensual", vigencia_desde: "", vigencia_hasta: "", fuente_titulo: "", fuente_url: "", nota: "", verificado: true });
  const [error, setError] = useState("");
  const set = (k: string, v: string | boolean) => setF({ ...f, [k]: v });
  async function save() {
    let valor: unknown = f.valor;
    try { valor = JSON.parse(f.valor); } catch { /* queda como texto */ }
    try {
      await adminApi("/admin/legal-params", { method: "POST", body: {
        clave: f.clave.trim(), valor, periodicidad: f.periodicidad, ambito: "global", vigencia_desde: f.vigencia_desde,
        vigencia_hasta: strOrNull(f.vigencia_hasta), fuente_titulo: f.fuente_titulo, fuente_url: strOrNull(f.fuente_url), nota: strOrNull(f.nota), verificado: f.verificado } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  return (
    <Modal eyebrow="PARÁMETRO" title="Nuevo parámetro" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={!f.clave || !f.valor || !f.vigencia_desde || !f.fuente_titulo}>Guardar borrador</button></>}>
      <div className="product-form">
        <Field label="Clave" hint="Minúsculas y guion bajo, por ejemplo base_imponible_max."><input value={f.clave} onChange={(e) => set("clave", e.target.value)} autoFocus /></Field>
        <Field label="Valor" hint="Un número, un texto o JSON (listas y objetos)."><textarea rows={3} value={f.valor} onChange={(e) => set("valor", e.target.value)} /></Field>
        <Field label="Periodicidad"><select value={f.periodicidad} onChange={(e) => set("periodicidad", e.target.value)}>
          {["mensual", "semestral", "anual", "ley", "cct"].map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Vigente desde"><input type="date" value={f.vigencia_desde} onChange={(e) => set("vigencia_desde", e.target.value)} /></Field>
        <Field label="Vigente hasta (opcional)"><input type="date" value={f.vigencia_hasta} onChange={(e) => set("vigencia_hasta", e.target.value)} /></Field>
        <Field label="Fuente (norma o página)"><input value={f.fuente_titulo} onChange={(e) => set("fuente_titulo", e.target.value)} /></Field>
        <Field label="Enlace a la fuente"><input value={f.fuente_url} onChange={(e) => set("fuente_url", e.target.value)} placeholder="https://" /></Field>
        <Field label="Nota"><input value={f.nota} onChange={(e) => set("nota", e.target.value)} /></Field>
        <div className="nm-inline-checks"><label><input type="checkbox" checked={f.verificado} onChange={(e) => set("verificado", e.target.checked)} /> Verificado contra la norma</label></div>
        {error && <div className="nm-note nm-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

function CctTab({ show, fail }: Msg) {
  const [rows, setRows] = useState<CctPkg[] | null>(null);
  const load = useCallback(() => { adminApi<CctPkg[]>("/admin/cct-packages").then(setRows).catch(fail); }, [fail]);
  useEffect(load, [load]);
  async function publish(id: number) {
    try { await adminApi(`/admin/cct-packages/${id}/publish`, { method: "POST" }); show("Convenio publicado"); load(); } catch (e) { fail(e); }
  }
  if (!rows) return <Loading />;
  return (
    <div className="nm-card">
      <div className="nm-card-head"><div><h2>Paquetes de convenios</h2><p>Un convenio sin escalas no se puede publicar. Las escalas se cargan por categoría con su vigencia y fuente.</p></div></div>
      {rows.length === 0 ? <Empty title="Sin convenios" /> : (
        <div className="nm-table-wrap"><table className="nm-table">
          <thead><tr><th>Convenio</th><th>Categorías</th><th>Fuente</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.numero}</strong><small>{c.nombre}</small></td>
                <td>{c.categorias_count}</td>
                <td>{c.fuente_titulo || "-"}{c.vigencia_desde && <small>desde {shortDate(c.vigencia_desde)}</small>}</td>
                <td><Pill tone={c.estado === "publicado" ? "green" : "gray"}>{c.estado === "publicado" ? "Publicado" : "Borrador"}</Pill></td>
                <td>{c.estado !== "publicado" && <button className="primary-button" onClick={() => publish(c.id)}>Publicar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

function ReviewsTab({ show, fail }: Msg) {
  const [rows, setRows] = useState<Review[] | null>(null);
  const load = useCallback(() => { adminApi<Review[]>("/admin/revisiones").then(setRows).catch(fail); }, [fail]);
  useEffect(load, [load]);
  async function generate() {
    try { setRows(await adminApi<Review[]>("/admin/revisiones/generar", { method: "POST" })); show("Checklist de la semana listo"); } catch (e) { fail(e); }
  }
  async function mark(r: Review, estado: string) {
    try { await adminApi(`/admin/revisiones/${r.id}`, { method: "PUT", body: { estado, resultado: r.resultado } }); load(); } catch (e) { fail(e); }
  }
  if (!rows) return <Loading />;
  return (
    <div className="nm-card">
      <div className="nm-card-head"><div><h2>Revisión semanal de fuentes</h2><p>Cada lunes: Boletín Oficial, ARCA, ANSES, Consejo del Salario y CPCE Mendoza.</p></div>
        <button className="primary-button" onClick={generate}>Generar esta semana</button></div>
      {rows.length === 0 ? <Empty title="Sin revisiones">Generá el checklist de esta semana.</Empty> : (
        <div className="nm-table-wrap"><table className="nm-table"><tbody>
          {rows.map((r) => (
            <tr key={r.id}><td>{shortDate(r.fecha)}</td><td><strong>{r.fuente_revisada}</strong></td>
              <td><Pill tone={r.estado === "PENDIENTE" ? "orange" : r.estado === "HAY_CAMBIOS" ? "red" : "green"}>{r.estado === "PENDIENTE" ? "Pendiente" : r.estado === "HAY_CAMBIOS" ? "Hay cambios" : "Sin cambios"}</Pill></td>
              <td className="nm-row"><button className="secondary-button" onClick={() => mark(r, "SIN_CAMBIOS")}>Sin cambios</button><button className="secondary-button" onClick={() => mark(r, "HAY_CAMBIOS")}>Hay cambios</button></td></tr>
          ))}
        </tbody></table></div>
      )}
    </div>
  );
}
