import { useCallback, useEffect, useState } from "react";
import { appApi } from "../../config";
import { Empty, Field, Loading, Modal, useFlash } from "../ui";
import { fechaCorta, num } from "../g1/common";

const TIPOS: Record<string, string> = { deposito: "Horas al banco", uso: "Descanso con horas del banco", liquidacion: "Liquidación (se pagan)" };
const h = (v: number) => v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Banco({ edita }: { edita: boolean }) {
  const [lista, setLista] = useState<any[] | null>(null);
  const [sel, setSel] = useState<any | null>(null);
  const [error, setError] = useState("");
  const cargar = useCallback(async () => {
    try { setLista(await appApi("/banco-horas")); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el banco de horas"); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  if (error) return <p className="nm-note nm-note-error">{error}</p>;
  if (!lista) return <Loading />;
  const total = lista.reduce((a, b) => a + b.saldo_horas, 0);
  return (
    <div>
      <p className="nm1-sub">El banco de horas (art. 197 bis) es voluntario y tiene que estar acordado por escrito. Las horas que se compensan con descanso no llevan recargo. Si queda saldo al egreso, se liquida.</p>
      {lista.length === 0 ? <div className="nm-card"><Empty title="No hay empleados">Cargá legajos para empezar.</Empty></div> : (
        <div className="nm-table-wrap"><table className="nm-table">
          <thead><tr><th>Empleado</th><th className="num">Saldo (horas)</th><th /></tr></thead>
          <tbody>{lista.map((e) => (
            <tr key={e.employee_id}><td><strong>{e.nombre}</strong><small>Legajo {e.legajo}</small></td><td className="num">{h(e.saldo_horas)}</td>
              <td className="num"><button className="nm-link" onClick={() => setSel(e)}>{edita ? "Ver y mover" : "Ver"}</button></td></tr>))}</tbody>
          <tfoot><tr><td>Total</td><td className="num">{h(total)}</td><td /></tr></tfoot>
        </table></div>
      )}
      {sel && <Detalle emp={sel} edita={edita} onClose={() => { setSel(null); void cargar(); }} />}
    </div>
  );
}

function Detalle({ emp, edita, onClose }: { emp: any; edita: boolean; onClose: () => void }) {
  const [d, setD] = useState<any | null>(null);
  const [f, setF] = useState({ tipo: "deposito", horas: "", nota: "", acuerdo: false, fecha: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const { show, fail, node } = useFlash();
  useEffect(() => { appApi(`/banco-horas/${emp.employee_id}`).then(setD).catch(fail); }, [emp.employee_id, fail]);
  const mover = async () => {
    const horas = num(f.horas);
    if (!horas || horas <= 0) { fail(new Error("Poné las horas")); return; }
    setBusy(true);
    try {
      const r = await appApi(`/banco-horas/${emp.employee_id}/movimientos`, { method: "POST", body: { tipo: f.tipo, horas, nota: f.nota || null, fecha: f.fecha, acuerdo_escrito: f.acuerdo } });
      setD({ ...d, saldo_horas: r.saldo_horas, movimientos: r.movimientos }); setF({ ...f, horas: "", nota: "" }); show("Movimiento registrado");
    } catch (e) { fail(e); }
    setBusy(false);
  };
  return (
    <Modal title={`Banco de horas · ${emp.nombre}`} size="wide" onClose={onClose} footer={<button className="nm2-btn" onClick={onClose}>Cerrar</button>}>
      {!d ? <Loading /> : (
        <div className="nm-stack">
          <div className="nm2-total"><span>Saldo actual</span><strong>{h(d.saldo_horas)} h</strong></div>
          {edita && (
            <div className="nm1-form">
              <Field label="Movimiento"><select className="nm2-select" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Horas"><input className="nm2-input num" inputMode="decimal" value={f.horas} onChange={(e) => setF({ ...f, horas: e.target.value })} /></Field>
              <Field label="Fecha"><input className="nm2-input" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
              <Field label="Nota"><input className="nm2-input" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} /></Field>
              {f.tipo === "deposito" && <label className="nm1-check is-wide"><input type="checkbox" checked={f.acuerdo} onChange={(e) => setF({ ...f, acuerdo: e.target.checked })} /> Existe el acuerdo escrito y voluntario del trabajador (art. 197 bis)</label>}
              <div className="is-wide"><button className="nm2-btn is-primary" disabled={busy} onClick={() => void mover()}>Registrar movimiento</button></div>
            </div>
          )}
          {d.movimientos.length === 0 ? <Empty title="Sin movimientos todavía" /> : (
            <div className="nm-table-wrap"><table className="nm-table"><thead><tr><th>Fecha</th><th>Movimiento</th><th className="num">Horas</th><th className="num">Saldo</th><th>Nota</th></tr></thead>
              <tbody>{d.movimientos.map((m: any, i: number) => <tr key={i}><td>{fechaCorta(m.fecha)}</td><td>{TIPOS[m.tipo] || m.tipo}</td><td className="num">{m.tipo === "deposito" ? "+" : "−"}{h(Number(m.horas))}</td><td className="num">{h(Number(m.saldo))}</td><td>{m.nota || "—"}</td></tr>)}</tbody></table></div>
          )}
        </div>
      )}
      {node}
    </Modal>
  );
}
