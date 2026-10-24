import { useCallback, useEffect, useState } from "react";
import "../../../g2.css";
import { appApi, shortDate } from "../../../config";
import { Empty, Loading, PageHeader, Pill, useRefreshKey } from "../../../components/ui";
import { can, Disclaimer } from "../../../components/g2/common";
import Asistente from "../../../components/liquidacion-final/Asistente";

/** Módulo `liquidacion_final` (spec I.8). Backend: backend/routes/liquidacion_final.py */
export default function LiquidacionFinalPage() {
  const [data, setData] = useState<{ egresos: any[]; causas: Record<string, string>; leyenda: string } | null>(null);
  const [abierto, setAbierto] = useState<number | null | "nuevo">(null);
  const [error, setError] = useState("");
  const refresh = useRefreshKey();

  const cargar = useCallback(async () => {
    try { setData(await appApi("/egresos")); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron cargar los egresos."); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar, refresh]);

  return (
    <section className="products-page">
      <PageHeader eyebrow="LIQUIDACIÓN FINAL" title="Liquidación final" subtitle="Egresos: preaviso, integración, indemnización, SAC y vacaciones proporcionales, y certificados.">
        {abierto === null && can("cerrar_liquidacion") && <button className="primary-button" onClick={() => setAbierto("nuevo")}>Nuevo egreso</button>}
      </PageHeader>
      {error && <p className="nm-note nm-note-error">{error}</p>}
      {abierto !== null ? (
        data && <Asistente key={String(abierto)} id={abierto === "nuevo" ? null : abierto} causas={data.causas} onClose={() => { setAbierto(null); void cargar(); }} />
      ) : data === null && !error ? <Loading /> : data && (
        <>
          <Disclaimer>{data.leyenda}</Disclaimer>
          {data.egresos.length === 0 ? <div className="nm-card"><Empty title="No registraste egresos">Empezá con «Nuevo egreso»: el asistente te guía en 4 pasos.</Empty></div> : (
            <div className="nm-table-wrap"><table className="nm-table">
              <thead><tr><th>Empleado</th><th>Egreso</th><th>Causa</th><th>Estado</th><th>Certificado art. 80</th></tr></thead>
              <tbody>{data.egresos.map((e) => (
                <tr key={e.id} className="is-click" onClick={() => setAbierto(e.id)}>
                  <td>{e.nombre}<small>Legajo {e.legajo || "—"}</small></td><td>{shortDate(e.fecha_egreso)}</td><td>{e.causa_label}</td>
                  <td><Pill tone={e.estado === "emitida" ? "green" : e.estado === "calculada" ? "blue" : "gray"}>{e.estado === "emitida" ? "Emitida" : e.estado === "calculada" ? "Calculada" : "Borrador"}</Pill></td>
                  <td>{e.certificado_art80_fecha ? `Entregado ${shortDate(e.certificado_art80_fecha)}` : e.estado === "emitida" ? <Pill tone="orange">Entregar antes del {shortDate(e.limite_art80)}</Pill> : "—"}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </>
      )}
    </section>
  );
}
