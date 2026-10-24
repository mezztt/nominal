import { Fragment, useState } from "react";
import { appApi } from "../../config";
import { Modal, Pill, useFlash } from "../ui";
import { ars, can, Torta } from "../g2/common";

export interface Linea { id: number; codigo: string; nombre: string; tipo: string; naturaleza: string; base: number | null; unidad: string | null; cantidad: number | null; importe: number; origen: string; explicacion: any }
interface Manual { nombre: string; tipo: "haber" | "descuento"; naturaleza: string; importe: string }

export default function RunModal({ run, cerrada, onClose, onChanged }: { run: any; cerrada: boolean; onClose: () => void; onChanged: () => void }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const [manuales, setManuales] = useState<Manual[] | null>(null);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const { show, fail, node } = useFlash();
  const lineas: Linea[] = run.lineas || [];
  const haberes = lineas.filter((l) => l.tipo === "haber");
  const descuentos = lineas.filter((l) => l.tipo === "descuento");

  const editar = () => setManuales(lineas.filter((l) => l.origen === "manual").map((l) => ({ nombre: l.nombre, tipo: l.tipo as "haber" | "descuento", naturaleza: l.naturaleza, importe: String(l.importe) })));
  const guardar = async () => {
    setSaving(true);
    try {
      await appApi(`/corridas/${run.id}/lineas`, { method: "PUT", body: { motivo, lineas: (manuales || []).map((m) => ({ nombre: m.nombre, tipo: m.tipo, naturaleza: m.naturaleza, importe: Number(m.importe.replace(",", ".")) || 0 })) } });
      show("Ajuste guardado y liquidación recalculada.");
      setManuales(null); setMotivo("");
      onChanged();
    } catch (e) { fail(e); } finally { setSaving(false); }
  };
  const setM = (i: number, patch: Partial<Manual>) => setManuales((ms) => (ms || []).map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const fila = (l: Linea) => (
    <Fragment key={l.id}>
      <tr className="is-click" onClick={() => setAbierta(abierta === l.id ? null : l.id)}>
        <td>{l.nombre}{l.origen === "manual" && <> <Pill tone="orange">Manual</Pill></>}<small>{l.codigo}</small></td>
        <td className="num">{l.cantidad != null ? `${l.cantidad}${l.unidad ? " " + l.unidad : ""}` : ""}</td>
        <td className="num">{l.base != null ? ars(l.base) : ""}</td>
        <td className="num">{l.tipo === "haber" ? ars(l.importe) : ""}</td>
        <td className="num">{l.tipo === "descuento" ? ars(l.importe) : ""}</td>
        <td><button type="button" className="nm-link" aria-expanded={abierta === l.id}>¿Cómo se calculó?</button></td>
      </tr>
      {abierta === l.id && (
        <tr className="nm2-explain"><td colSpan={6}>
          <strong>{l.explicacion?.texto || "Sin detalle."}</strong>
          {l.explicacion?.detalle && <pre style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{typeof l.explicacion.detalle === "string" ? l.explicacion.detalle : JSON.stringify(l.explicacion.detalle, null, 1)}</pre>}
        </td></tr>
      )}
    </Fragment>
  );

  const bases = run.bases ? Object.entries(run.bases as Record<string, any>) : [];
  return (
    <Modal title={`${run.nombre}`} eyebrow={`Legajo ${run.legajo || "—"}`} onClose={onClose} size="xl"
      footer={<button className="nm2-btn" onClick={onClose}>Cerrar</button>}>
      {(run.alertas || []).map((a: any, i: number) => (
        <p key={i} className={`nm-note ${a.nivel === "error" || a.nivel === "bloqueo" ? "nm-note-error" : "nm-note-warn"}`} style={{ marginBottom: 8 }}>{a.mensaje}</p>
      ))}
      <div className="nm-table-wrap">
        <table className="nm-table">
          <thead><tr><th>Concepto</th><th className="num">Cantidad</th><th className="num">Base</th><th className="num">Haberes</th><th className="num">Descuentos</th><th /></tr></thead>
          <tbody>{haberes.map(fila)}{descuentos.map(fila)}</tbody>
          <tfoot>
            <tr><td colSpan={3}>Bruto {ars(run.bruto)} · Neto</td><td className="num" colSpan={2}>{ars(run.neto)}</td><td /></tr>
          </tfoot>
        </table>
      </div>
      {run.neto_en_letras && <p className="nm-hint">Son pesos: {run.neto_en_letras}</p>}

      {can("cerrar_liquidacion") && !cerrada && (
        <div className="nm-card" style={{ marginTop: 14 }}>
          <div className="nm-card-head"><div><h2>Ajuste manual</h2><p>Agregá o corregí conceptos de esta liquidación. Queda registrado con el motivo.</p></div>
            {!manuales && <button className="nm2-btn" onClick={editar}>Editar ajustes</button>}</div>
          {manuales && (
            <div className="nm-stack">
              {manuales.map((m, i) => (
                <div className="nm-row" key={i}>
                  <input className="nm2-input" aria-label="Concepto" placeholder="Concepto" value={m.nombre} onChange={(e) => setM(i, { nombre: e.target.value })} />
                  <select className="nm2-select" aria-label="Tipo" value={`${m.tipo}:${m.naturaleza}`} onChange={(e) => { const [t, n] = e.target.value.split(":"); setM(i, { tipo: t as "haber" | "descuento", naturaleza: n }); }}>
                    <option value="haber:rem">Haber remunerativo</option><option value="haber:no_rem">Haber no remunerativo</option>
                    <option value="descuento:desc_voluntario">Descuento</option><option value="descuento:embargo">Embargo</option>
                  </select>
                  <input className="nm2-input num" aria-label="Importe" inputMode="decimal" placeholder="0,00" value={m.importe} onChange={(e) => setM(i, { importe: e.target.value })} />
                  <button className="nm2-btn is-small is-danger" onClick={() => setManuales(manuales.filter((_, j) => j !== i))}>Quitar</button>
                </div>
              ))}
              <div><button className="nm2-btn is-small" onClick={() => setManuales([...manuales, { nombre: "", tipo: "haber", naturaleza: "rem", importe: "" }])}>Agregar concepto</button></div>
              <label className="nm2-label">Motivo del ajuste<input className="nm2-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por ejemplo: premio acordado por escrito" /></label>
              <div className="nm-row">
                <button className="nm2-btn is-primary" disabled={saving || motivo.trim().length < 3} onClick={guardar}>{saving ? "Guardando..." : "Guardar y recalcular"}</button>
                <button className="nm2-btn" onClick={() => setManuales(null)}>Cancelar</button>
              </div>
            </div>
          )}
          {(run.ajustes || []).length > 0 && <p className="nm-hint">Ajustes anteriores: {(run.ajustes as any[]).map((a) => a.motivo).join(" · ")}</p>}
        </div>
      )}

      <div className="nm-grid-2" style={{ marginTop: 14 }}>
        <div className="nm-card">
          <div className="nm-card-head"><div><h2>Contribuciones del empleador</h2><p>Costo laboral total {ars(run.costo_laboral_total)}</p></div></div>
          <div className="nm-table-wrap"><table className="nm-table">
            <thead><tr><th>Concepto</th><th className="num">Base</th><th className="num">Monto</th></tr></thead>
            <tbody>{(run.contribuciones || []).map((c: any) => <tr key={c.id}><td>{c.concepto}{c.prorrateo_info && <small>{c.prorrateo_info}</small>}</td><td className="num">{c.base != null ? ars(c.base) : ""}</td><td className="num">{ars(c.monto)}</td></tr>)}</tbody>
          </table></div>
        </div>
        <div className="nm-card">
          <div className="nm-card-head"><div><h2>¿A dónde va cada peso?</h2></div></div>
          <Torta segs={run.grafico || []} />
        </div>
      </div>

      {bases.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary className="nm-link">Bases imponibles y topes aplicados</summary>
          <div className="nm-table-wrap" style={{ marginTop: 8 }}><table className="nm-table">
            <thead><tr><th>Subsistema</th><th className="num">Base sin tope</th><th className="num">Base con tope</th><th /></tr></thead>
            <tbody>{bases.filter(([, b]) => b && typeof b === "object" && "base" in b).map(([k, b]: [string, any]) => (
              <tr key={k}><td>{k}</td><td className="num">{ars(b.sin_tope)}</td><td className="num">{ars(b.base)}</td><td>{b.topeado ? <Pill tone="orange">Con tope</Pill> : ""}</td></tr>
            ))}</tbody>
          </table></div>
        </details>
      )}
      {node}
    </Modal>
  );
}
