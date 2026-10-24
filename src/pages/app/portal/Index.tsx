import { useCallback, useEffect, useState } from "react";
import { appApi, dateTime } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, strOrNull, useFlash } from "../../../components/ui";
import "../../../g3.css";

interface Fila { id: number; legajo: string; nombre: string; email_legajo: string | null; tiene_acceso: boolean; email: string | null; activo: boolean | null; ultimo_acceso: string | null }
interface Clave { email: string; clave_provisoria: string; aviso: string }

export default function PortalAccesosPage() {
  const { show, fail, node: flash } = useFlash();
  const [data, setData] = useState<{ slug: string; empleados: Fila[] } | null>(null);
  const [alta, setAlta] = useState<Fila | null>(null);
  const [clave, setClave] = useState<Clave | null>(null);
  const load = useCallback(() => { appApi<{ slug: string; empleados: Fila[] }>("/portal-accesos").then(setData).catch(fail); }, [fail]);
  useEffect(() => { load(); }, [load]);
  async function reset(f: Fila) { try { setClave(await appApi<Clave>(`/portal-accesos/${f.id}/reset`, { method: "POST", body: {} })); } catch (e) { fail(e); } }
  async function activar(f: Fila, activo: boolean) { try { await appApi(`/portal-accesos/${f.id}`, { method: "PUT", body: { activo } }); show(activo ? "Acceso activado" : "Acceso desactivado"); load(); } catch (e) { fail(e); } }
  const link = data ? `${window.location.origin}/portal?e=${encodeURIComponent(data.slug)}` : "";
  return (
    <section className="products-page">
      <PageHeader eyebrow="PORTAL DEL EMPLEADO" title="Accesos al portal" subtitle="Cada empleado entra con su email y ve solo sus recibos, da su conformidad, pide vacaciones y carga su F.572." />
      {!data ? <Loading /> : (
        <>
          <div className="nm-note nm-note-info" style={{ margin: "0 0 14px" }}>Link del portal para tus empleados: <strong style={{ wordBreak: "break-all" }}>{link}</strong><br />Código de empresa: <strong>{data.slug}</strong></div>
          {data.empleados.length === 0 ? <Empty title="No hay empleados">Cargá empleados en Legajos para darles acceso.</Empty> : (
            <div className="nm-table-wrap">
              <table className="nm-table">
                <thead><tr><th>Empleado</th><th>Acceso</th><th>Último ingreso</th><th /></tr></thead>
                <tbody>
                  {data.empleados.map((f) => (
                    <tr key={f.id}>
                      <td><strong>{f.nombre}</strong><small>Legajo {f.legajo}</small></td>
                      <td>{f.tiene_acceso ? <>{f.activo ? <Pill tone="green">Activo</Pill> : <Pill tone="gray">Desactivado</Pill>}<small>{f.email}</small></> : <Pill tone="gray">Sin acceso</Pill>}</td>
                      <td>{f.ultimo_acceso ? dateTime(f.ultimo_acceso) : "—"}</td>
                      <td>
                        <div className="nm-filters">
                          {!f.tiene_acceso && <button className="primary-button" onClick={() => setAlta(f)}>Dar acceso</button>}
                          {f.tiene_acceso && <button className="secondary-button" onClick={() => reset(f)}>Nueva clave</button>}
                          {f.tiene_acceso && <button className="secondary-button" onClick={() => activar(f, !f.activo)}>{f.activo ? "Desactivar" : "Activar"}</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {alta && <AltaForm fila={alta} onClose={() => setAlta(null)} onSaved={(c) => { setAlta(null); setClave(c); load(); }} />}
      {clave && (
        <Modal eyebrow="CLAVE PROVISORIA" title={clave.email} onClose={() => setClave(null)} footer={<button className="primary-button" onClick={() => setClave(null)}>Listo, la anoté</button>}>
          <p className="nm-muted">{clave.aviso}</p>
          <div className="g3-secret">{clave.clave_provisoria}</div>
        </Modal>
      )}
      {flash}
    </section>
  );
}

function AltaForm({ fila, onClose, onSaved }: { fila: Fila; onClose: () => void; onSaved: (c: Clave) => void }) {
  const [email, setEmail] = useState(fila.email_legajo || "");
  const [error, setError] = useState("");
  async function save() {
    setError("");
    try { onSaved(await appApi<Clave>("/portal-accesos", { method: "POST", body: { employee_id: fila.id, email, password: strOrNull("") } })); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo dar el acceso"); }
  }
  return (
    <Modal eyebrow="NUEVO ACCESO" title={fila.nombre} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Crear acceso</button></>}>
      <div className="product-form">
        <Field label="Email del empleado" hint="Con este email va a ingresar. Se genera una clave provisoria que le tenés que pasar."><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {error && <div className="nm-note nm-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
