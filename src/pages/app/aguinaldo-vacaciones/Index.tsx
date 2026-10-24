import { useState } from "react";
import { PageHeader, Tabs } from "../../../components/ui";
import Sac from "../../../components/aguinaldo-vacaciones/Sac";
import Vacaciones from "../../../components/aguinaldo-vacaciones/Vacaciones";
import "../../../g2.css";

/** Módulo `aguinaldo_vacaciones` (spec I.7). Backend: backend/routes/aguinaldo_vacaciones.py */
export default function AguinaldoVacacionesPage() {
  const [tab, setTab] = useState<"sac" | "vac">("sac");
  return (
    <section className="products-page">
      <PageHeader eyebrow="AGUINALDO Y VACACIONES" title="Aguinaldo y vacaciones" subtitle="SAC de junio y diciembre con proporcionales, saldos y cronograma de vacaciones." />
      <Tabs value={tab} options={[["sac", "Aguinaldo (SAC)"], ["vac", "Vacaciones"]]} onChange={setTab} />
      <div style={{ marginTop: 14 }}>{tab === "sac" ? <Sac /> : <Vacaciones />}</div>
    </section>
  );
}
