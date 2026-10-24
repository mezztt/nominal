import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi, dateTime } from "../../config";
import PublicShell from "../../components/public/Shell";
import "../../g3.css";

interface Verificacion { numero: string; estado: string; periodo: string | null; tipo: string; empleadora: string | null; emitido_en: string | null; integridad_ok: boolean; aviso: string }

/** Verificación pública de un recibo (web_verificacion): se llega escaneando el QR. No muestra datos personales. */
export default function Verificar() {
  const { token } = useParams();
  const [data, setData] = useState<Verificacion | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    publicApi<Verificacion>(`/public/verificar/${encodeURIComponent(token || "")}`).then(setData).catch((e) => setError(e.message));
  }, [token]);
  const anulado = data?.estado === "anulado";
  const bueno = !!data && data.integridad_ok && !anulado;
  return (
    <PublicShell title="Verificación de recibos" heading="Verificar recibo" intro="Confirmá que este recibo existe y no fue modificado." error={error}>
      {data && (
        <div className="pb-card g3-verify">
          <span className={`g3-badge ${bueno ? "ok" : anulado ? "bad" : "warn"}`}>{anulado ? "Recibo anulado" : data.integridad_ok ? "Recibo auténtico" : "Integridad no comprobada"}</span>
          <span className="g3-big">Recibo {data.numero}</span>
          <dl>
            <dt>Empleadora</dt><dd>{data.empleadora || "—"}</dd>
            <dt>Período</dt><dd>{data.periodo ? `${data.periodo}${data.tipo ? " · " + data.tipo : ""}` : "—"}</dd>
            <dt>Emitido</dt><dd>{data.emitido_en ? dateTime(data.emitido_en) : "—"}</dd>
            <dt>Integridad</dt><dd>{data.integridad_ok ? "El contenido no fue modificado" : "No coincide con lo emitido"}</dd>
          </dl>
          <p className="pb-consent">{data.aviso}</p>
          <p className="pb-consent">Documento no válido como factura.</p>
        </div>
      )}
      {!data && !error && <div className="pb-card"><p>Verificando...</p></div>}
    </PublicShell>
  );
}
