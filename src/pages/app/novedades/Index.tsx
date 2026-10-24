import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import "../../../g1.css";
import { PageHeader, Tabs } from "../../../components/ui";
import Grilla from "../../../components/novedades/Grilla";
import Licencias from "../../../components/novedades/Licencias";
import Banco from "../../../components/novedades/Banco";

type Tab = "horas" | "licencias" | "banco";

/** Módulo `novedades` (spec I.4). Backend: backend/routes/novedades.py */
export default function NovedadesPage() {
  const [params] = useSearchParams();
  const hoy = new Date();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "licencias" ? "licencias" : params.get("tab") === "banco" ? "banco" : "horas");
  const [per, setPer] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const onMes = (anio: number, mes: number) => setPer({ anio, mes });
  return (
    <section className="products-page">
      <PageHeader eyebrow="NOVEDADES" title="Novedades" subtitle="Horas extra, ausencias, licencias y banco de horas del mes, antes de liquidar." />
      <Tabs value={tab} options={[["horas", "Horas y ausencias"], ["licencias", "Licencias"], ["banco", "Banco de horas"]]} onChange={setTab} />
      {tab === "horas" && <Grilla anio={per.anio} mes={per.mes} onMes={onMes} edita />}
      {tab === "licencias" && <Licencias anio={per.anio} mes={per.mes} onMes={onMes} edita />}
      {tab === "banco" && <Banco edita />}
    </section>
  );
}
