import { useCallback, useEffect, useState } from "react";
import "../../../g1.css";
import { appApi, shortDate } from "../../../config";
import { Empty, Loading, PageHeader, Pill, Tabs, useFlash, useRefreshKey } from "../../../components/ui";
import { can } from "../../../components/g2/common";
import ConvenioDetalle, { NuevoConvenio } from "../../../components/convenios/ConvenioDetalle";
import Conceptos from "../../../components/convenios/Conceptos";

/** Módulo `convenios` (spec I.3). Backend: backend/routes/convenios.py */
export default function ConveniosPage() {
  const [tab, setTab] = useState<"convenios" | "conceptos">("convenios");
  const [lista, setLista] = useState<any[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState("");
  const { fail, node } = useFlash();
  const refresh = useRefreshKey();
  const edita = can("editar_parametros");

  const cargar = useCallback(async () => {
    try { setLista(await appApi("/convenios")); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron cargar los convenios."); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar, refresh]);

  return (
    <section className="products-page">
      <PageHeader eyebrow="CONVENIOS Y CONCEPTOS" title="Convenios y conceptos" subtitle="Categorías, escalas y adicionales de cada convenio, y el catálogo de conceptos con sus fórmulas.">
        {!sel && tab === "convenios" && edita && <button className="primary-button" onClick={() => setNuevo(true)}>Convenio propio</button>}
      </PageHeader>
      {error && <p className="nm-note nm-note-error" style={{ marginBottom: 14 }}>{error}</p>}
      {!sel && <Tabs value={tab} options={[["convenios", "Convenios"], ["conceptos", "Conceptos y fórmulas"]]} onChange={setTab} />}

      {sel ? <ConvenioDetalle id={sel} onBack={() => { setSel(null); void cargar(); }} onChanged={() => void cargar()} onOpen={(id) => setSel(id)} />
        : tab === "conceptos" ? <Conceptos />
        : lista === null && !error ? <Loading /> : lista && (
          lista.length === 0 ? (
            <div className="nm-card"><Empty title="Todavía no hay convenios disponibles">Mezztt publica los paquetes (Comercio 130/75 y otros) con su fuente y fecha. Mientras tanto podés armar un convenio propio.</Empty></div>
          ) : (
            <div className="nm1-cols">{lista.map((c) => (
              <button key={c.id} type="button" className="nm-card nm1-package" style={{ textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => setSel(c.id)}>
                <div className="nm-spread"><strong style={{ fontSize: 17 }}>{c.numero}</strong>
                  {c.propio ? <Pill tone="violet">Propio</Pill> : <Pill tone={c.aceptado ? "green" : "orange"}>{c.aceptado ? "Aceptado" : "Sin aceptar"}</Pill>}</div>
                <span>{c.nombre}</span>
                <small>{c.categorias_count} categoría(s) · {c.empleados} empleado(s) en esta empresa{c.es_defecto ? " · por defecto" : ""}</small>
                {!c.propio && <small>Paquete de Mezztt{c.vigencia_desde ? ` vigente desde ${shortDate(c.vigencia_desde)}` : ""} · {c.fuente_titulo || "sin fuente"}</small>}
                {c.categorias_count === 0 && <Pill tone="red">Convenio vacío: cargá las escalas vigentes</Pill>}
                {c.sin_escala_count > 0 && <Pill tone="red">{c.sin_escala_count} sin escala vigente</Pill>}
              </button>))}</div>
          )
        )}
      {nuevo && <NuevoConvenio onClose={() => setNuevo(false)} fail={fail} onCreated={(id) => { setNuevo(false); void cargar(); setSel(id); }} />}
      {node}
    </section>
  );
}
