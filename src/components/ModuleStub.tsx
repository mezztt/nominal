import { useEffect, useState } from "react";
import { appApi } from "../config";
import { Empty, PageHeader } from "./ui";

/** Pantalla provisoria de un módulo que todavía se está construyendo (estado vacío digno).
 *  Cada agente de la fase 2 la reemplaza por la pantalla real; `statusPath` es el endpoint de estado del esqueleto. */
export default function ModuleStub({ eyebrow, title, description, statusPath }: { eyebrow: string; title: string; description: string; statusPath: string }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    appApi<{ mensaje?: string }>(statusPath).then((r) => setMessage(r.mensaje || "")).catch(() => setMessage(""));
  }, [statusPath]);
  return (
    <section className="products-page">
      <PageHeader eyebrow={eyebrow} title={title} subtitle={`Acá vas a gestionar ${description}.`} />
      <div className="nm-card">
        <Empty title="Este módulo ya está activo en tu plan">
          <span>{message || "Estamos terminando de construirlo. Cuando esté listo, lo vas a encontrar acá, sin que tengas que hacer nada."}</span>
        </Empty>
      </div>
    </section>
  );
}
