import { useCallback, useEffect, useState } from "react";
import "../../../g2.css";
import { appApi, shortDate } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, useFlash, useRefreshKey } from "../../../components/ui";
import { ars, can, EstadoPill, MESES } from "../../../components/g2/common";
import PeriodoDetalle from "../../../components/liquidaciones/PeriodoDetalle";

/** Módulo `liquidaciones` (spec I.5). Backend: backend/routes/liquidaciones.py */
export default function LiquidacionesPage() {
  const [lista, setLista] = useState<any[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState<{ anio: number; mes: number; tipo: string } | null>(null);
  const [faltan, setFaltan] = useState<string[]>([]);
  const [error, setError] = useState("");
  const { fail, node } = useFlash();
  const refresh = useRefreshKey();
  const verSueldos = can("ver_sueldos");

  const cargar = useCallback(async () => {
    try {
      setLista(await appApi("/periodos"));
      const hoy = new Date();
      const par = await appApi(`/liquidaciones/parametros?anio=${hoy.getFullYear()}&mes=${hoy.getMonth() + 1}`);
      setFaltan(par.faltan || []);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron cargar los períodos."); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar, refresh]);

  const crear = async () => {
    if (!nuevo) return;
    try {
      const p = await appApi("/periodos", { method: "POST", body: nuevo });
      setNuevo(null); await cargar(); setSel(p.id);
    } catch (e) { fail(e); }
  };
  const hoy = new Date();

  return (
    <section className="products-page">
      <PageHeader eyebrow="LIQUIDACIONES" title="Liquidaciones" subtitle="Abrí el período, calculá, revisá y cerrá. El cierre guarda los parámetros usados.">
        {can("cerrar_liquidacion") && <button className="primary-button" onClick={() => setNuevo({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, tipo: "mensual" })}>Nuevo período</button>}
      </PageHeader>
      {faltan.length > 0 && <p className="nm-note nm-note-warn" style={{ marginBottom: 14 }}>Faltan parámetros legales vigentes para este mes ({faltan.join(", ")}). Hasta que se publiquen no se puede calcular.</p>}
      {error && <p className="nm-note nm-note-error">{error}</p>}
      {sel ? <PeriodoDetalle id={sel} onBack={() => { setSel(null); void cargar(); }} onChanged={() => void cargar()} /> : lista === null && !error ? <Loading /> : lista && (
        lista.length === 0 ? (
          <div className="nm-card"><Empty title="Todavía no abriste ningún período">Creá el primero con «Nuevo período». Antes, revisá que los legajos y el convenio estén completos.</Empty></div>
        ) : (
          <div className="nm-table-wrap"><table className="nm-table">
            <thead><tr><th>Período</th><th>Estado</th><th className="num">Empleados</th>{verSueldos && <><th className="num">Neto</th><th className="num">Costo laboral</th></>}<th>Pago hasta</th></tr></thead>
            <tbody>{lista.map((p) => (
              <tr key={p.id} className="is-click" onClick={() => setSel(p.id)}>
                <td><strong>{p.etiqueta}</strong>{p.alertas > 0 && <small>{p.alertas} aviso(s)</small>}</td>
                <td><EstadoPill estado={p.estado} /></td><td className="num">{p.empleados}</td>
                {verSueldos && <><td className="num">{p.neto != null ? ars(p.neto) : "—"}</td><td className="num">{p.costo_laboral != null ? ars(p.costo_laboral) : "—"}</td></>}
                <td>{shortDate(p.fecha_pago_limite)}</td>
              </tr>))}</tbody>
          </table></div>
        )
      )}
      {nuevo && (
        <Modal title="Nuevo período" onClose={() => setNuevo(null)} footer={<><button className="nm2-btn" onClick={() => setNuevo(null)}>Cancelar</button><button className="nm2-btn is-primary" onClick={crear}>Crear</button></>}>
          <div className="nm2-form">
            <Field label="Tipo"><select className="nm2-select" value={nuevo.tipo} onChange={(e) => { const t = e.target.value; setNuevo({ ...nuevo, tipo: t, mes: t === "sac1" ? 6 : t === "sac2" ? 12 : nuevo.mes }); }}>
              <option value="mensual">Sueldo mensual</option><option value="sac1">SAC 1.º semestre</option><option value="sac2">SAC 2.º semestre</option><option value="ajuste">Ajuste</option></select></Field>
            <Field label="Mes"><select className="nm2-select" value={nuevo.mes} onChange={(e) => setNuevo({ ...nuevo, mes: Number(e.target.value) })}>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
            <Field label="Año"><input className="nm2-input" type="number" value={nuevo.anio} onChange={(e) => setNuevo({ ...nuevo, anio: Number(e.target.value) })} /></Field>
          </div>
        </Modal>
      )}
      {node}
    </section>
  );
}
