import { useCallback, useEffect, useRef, useState } from "react";
import "../../../g2.css";
import { appApi, appBlob, shortDate, dateTime } from "../../../config";
import { Empty, Loading, Modal, PageHeader, Pill, useFlash, useRefreshKey } from "../../../components/ui";
import { ars, can, EstadoPill } from "../../../components/g2/common";

const CONF: Record<string, string> = { pendiente: "gray", conforme: "green", con_reserva: "orange", firmado_papel: "green" };

/** Módulo `recibos` (spec I.6). Backend: backend/routes/recibos.py */
export default function RecibosPage() {
  const [data, setData] = useState<{ recibos: any[]; periodos: any[] } | null>(null);
  const [periodo, setPeriodo] = useState<number>(0);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [vista, setVista] = useState<{ url: string; titulo: string } | null>(null);
  const [anular, setAnular] = useState<{ slip: any; motivo: string } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const { show, fail, node } = useFlash();
  const refresh = useRefreshKey();
  const verSueldos = can("ver_sueldos");
  const emite = can("cerrar_liquidacion");

  const cargar = useCallback(async () => {
    if (!verSueldos) { setData({ recibos: [], periodos: [] }); return; }
    try {
      setData(await appApi(`/recibos?period_id=${periodo || 0}&q=${encodeURIComponent(q)}`));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron cargar los recibos."); }
  }, [periodo, q, verSueldos]);
  useEffect(() => { const t = window.setTimeout(() => void cargar(), 200); return () => window.clearTimeout(t); }, [cargar, refresh]);
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista.url); }, [vista]);

  const accion = async (key: string, path: string, body: unknown, ok: string) => {
    setBusy(key);
    try { const r = await appApi(path, { method: "POST", body }); show(ok); await cargar(); return r; } catch (e) { fail(e); } finally { setBusy(""); }
  };
  const emitir = async (p: any) => {
    const r = await accion("e" + p.id, `/periodos/${p.id}/emitir`, undefined, "Recibos emitidos.");
    if (r?.con_errores?.length) {
      const det = r.con_errores.map((x: any) => `${x.nombre}: ${(x.errores || []).join(" ")}`).join(" · ");
      show(`Quedaron ${r.con_errores.length} recibo(s) sin emitir. ${det}`, true);
    }
  };
  const ver = async (s: any) => {
    try {
      const blob = await appBlob(`/recibos/${s.id}/print`);
      setVista({ url: URL.createObjectURL(new Blob([blob], { type: "text/html" })), titulo: `${s.numero} · ${s.nombre}` });
    } catch (e) { fail(e); }
  };
  const imprimir = () => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); };

  const recibos = data?.recibos || [];
  return (
    <section className="products-page">
      <PageHeader eyebrow="RECIBOS" title="Recibos de sueldo" subtitle="Formato del Decreto 407/2026, con la torta del costo laboral y el QR de verificación." />
      {!verSueldos && <div className="nm-card"><Empty title="No tenés permiso para ver recibos">Pedile a quien administra la empresa que te lo habilite.</Empty></div>}
      {error && <p className="nm-note nm-note-error">{error}</p>}
      {data === null && !error && <Loading />}
      {data && verSueldos && (
        <>
          {emite && data.periodos.some((p) => p.sin_emitir > 0) && (
            <div className="nm-card" style={{ marginBottom: 16 }}>
              <div className="nm-card-head"><div><h2>Períodos cerrados con recibos para emitir</h2><p>Emitir genera el recibo inmodificable con su número y su QR.</p></div></div>
              <div className="nm-stack">{data.periodos.filter((p) => p.sin_emitir > 0).map((p) => (
                <div className="nm-spread" key={p.id}><span><strong>{p.etiqueta}</strong> · {p.sin_emitir} sin emitir</span>
                  <button className="nm2-btn is-primary" disabled={!!busy} onClick={() => emitir(p)}>{busy === "e" + p.id ? "Emitiendo..." : "Emitir recibos"}</button></div>))}</div>
            </div>
          )}
          <div className="nm-toolbar">
            <div className="nm-filters">
              <select className="nm-select" aria-label="Período" value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))}>
                <option value={0}>Todos los períodos</option>{data.periodos.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}</select>
              <input className="nm-search" aria-label="Buscar" placeholder="Buscar por nombre, legajo o número" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {recibos.length === 0 ? <div className="nm-card"><Empty title="No hay recibos emitidos">Cerrá un período en Liquidaciones y emití sus recibos desde acá.</Empty></div> : (
            <div className="nm-table-wrap"><table className="nm-table">
              <thead><tr><th>Número</th><th>Empleado</th><th>Período</th><th className="num">Neto</th><th>Estado</th><th>Conformidad</th><th /></tr></thead>
              <tbody>{recibos.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.numero}</strong><small>{dateTime(s.emitido_en)}</small></td>
                  <td>{s.nombre}<small>Legajo {s.legajo || "—"}</small></td>
                  <td>{s.periodo}<small>{s.tipo}</small></td>
                  <td className="num">{ars(s.neto)}</td>
                  <td><EstadoPill estado={s.estado} />{s.anulado_motivo && <small>{s.anulado_motivo}</small>}</td>
                  <td><Pill tone={CONF[s.entrega.conformidad] || "gray"}>{s.entrega.conformidad_label}</Pill>{s.entrega.enviado_en && <small>Enviado {shortDate(s.entrega.enviado_en)}</small>}</td>
                  <td><div className="nm-row">
                    <button className="nm2-btn is-small" onClick={() => ver(s)}>Ver e imprimir</button>
                    {s.estado === "emitido" && <button className="nm2-btn is-small" disabled={!!busy} onClick={() => accion("s" + s.id, `/recibos/${s.id}/enviar`, { canal: "portal" }, "Recibo enviado al portal del empleado.")}>Enviar</button>}
                    {s.estado === "emitido" && s.entrega.conformidad === "pendiente" && <button className="nm2-btn is-small" disabled={!!busy} onClick={() => accion("p" + s.id, `/recibos/${s.id}/conformidad-papel`, {}, "Firma en papel registrada.")}>Firmó en papel</button>}
                    {s.estado === "emitido" && emite && <button className="nm2-btn is-small is-danger" onClick={() => setAnular({ slip: s, motivo: "" })}>Anular</button>}
                  </div></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </>
      )}
      {vista && (
        <Modal title={vista.titulo} eyebrow="Recibo" size="xl" onClose={() => setVista(null)}
          footer={<><button className="nm2-btn" onClick={() => setVista(null)}>Cerrar</button><button className="nm2-btn is-primary" onClick={imprimir}>Imprimir</button></>}>
          <iframe ref={frame} className="nm2-frame" title="Recibo de sueldo" src={vista.url} />
        </Modal>
      )}
      {anular && (
        <Modal title={`Anular ${anular.slip.numero}`} onClose={() => setAnular(null)}
          footer={<><button className="nm2-btn" onClick={() => setAnular(null)}>Cancelar</button>
            <button className="nm2-btn is-danger" disabled={anular.motivo.trim().length < 3 || !!busy} onClick={async () => { await accion("a", `/recibos/${anular.slip.id}/anular`, { motivo: anular.motivo, reemitir: true }, "Recibo anulado y reemitido como ajuste."); setAnular(null); }}>Anular</button></>}>
          <p className="nm-note nm-note-warn">El recibo anulado queda guardado con su leyenda. Si el período sigue cerrado se emite uno nuevo que lo reemplaza.</p>
          <label className="nm2-label" style={{ marginTop: 10 }}>Motivo<input className="nm2-input" value={anular.motivo} onChange={(e) => setAnular({ ...anular, motivo: e.target.value })} autoFocus /></label>
        </Modal>
      )}
      {node}
    </section>
  );
}
