import { useCallback, useEffect, useState } from "react";
import { appApi } from "../../config";
import { Empty, Loading, Modal, Pill, useFlash } from "../ui";
import { ImportCsv, MesNav, num } from "../g1/common";

const EJEMPLO = `legajo;fecha;horas_50;horas_100;ausencia;tardanzas
0001;05/10/2026;2;0;;
0001;10/10/2026;0;4;;
0002;12/10/2026;;;si;`;
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const n2 = (v: number) => (v ? String(v).replace(".", ",") : "—");

export default function Grilla({ anio, mes, onMes, edita }: { anio: number; mes: number; onMes: (a: number, m: number) => void; edita: boolean }) {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [emp, setEmp] = useState<any | null>(null);
  const [importar, setImportar] = useState(false);
  const { show, node } = useFlash();

  const cargar = useCallback(async () => {
    try { setData(null); setData(await appApi(`/novedades?anio=${anio}&mes=${mes}`)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el mes"); }
  }, [anio, mes]);
  useEffect(() => { void cargar(); }, [cargar]);

  return (
    <div>
      <div className="nm1-toolbar">
        <MesNav anio={anio} mes={mes} onChange={onMes} />
        {edita && !data?.cerrado && <button className="nm2-btn" onClick={() => setImportar(true)}>Importar CSV</button>}
        {data?.cerrado && <Pill tone="green">Liquidación cerrada</Pill>}
      </div>
      {error && <p className="nm-note nm-note-error">{error}</p>}
      {data?.cerrado && <p className="nm-note nm-note-info" style={{ marginBottom: 14 }}>La liquidación de este mes está cerrada: ya no se cargan horas ni ausencias. Si hace falta, reabrí el período en Liquidaciones o cargá la novedad en el mes siguiente como ajuste.</p>}
      {!data && !error ? <Loading /> : data && (
        <>
          {data.alertas.length > 0 && <div className="nm-note nm-note-warn" style={{ marginBottom: 14 }}><strong>Para revisar</strong><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{data.alertas.slice(0, 8).map((a: string, i: number) => <li key={i}>{a}</li>)}</ul></div>}
          {data.empleados.length === 0 ? <div className="nm-card"><Empty title="No hay empleados para liquidar en este mes">Cargá los legajos en el módulo Legajos.</Empty></div> : (
            <div className="nm-table-wrap"><table className="nm-table">
              <thead><tr><th>Empleado</th><th className="num">HE 50 %</th><th className="num">HE 100 %</th><th className="num">Nocturnas</th><th className="num">Ausencias</th><th className="num">Tardanzas (min)</th><th>Licencias y vacaciones</th><th className="num">Banco</th>{edita && !data.cerrado && <th />}</tr></thead>
              <tbody>{data.empleados.map((e: any) => (
                <tr key={e.employee_id}>
                  <td><strong>{e.nombre}</strong><small>Legajo {e.legajo}</small></td>
                  <td className="num">{n2(e.horas_50)}</td><td className="num">{n2(e.horas_100)}</td><td className="num">{n2(e.horas_nocturnas)}</td>
                  <td className="num">{e.ausencias_injustificadas ? <Pill tone="red">{e.ausencias_injustificadas}</Pill> : "—"}</td><td className="num">{n2(e.tardanzas_min)}</td>
                  <td>{e.licencias.length === 0 && !e.dias_vacaciones ? "—" : <span className="nm1-chips">
                    {e.licencias.map((l: any) => <Pill key={l.id} tone={l.estado === "aprobada" ? (l.goce ? "green" : "orange") : "gray"}>{l.nombre} · {l.dias_mes} d{l.estado !== "aprobada" ? " (sin aprobar)" : ""}</Pill>)}
                    {e.dias_vacaciones > 0 && <Pill tone="blue">Vacaciones · {e.dias_vacaciones} d</Pill>}</span>}</td>
                  <td className="num">{n2(e.banco_horas_saldo)}</td>
                  {edita && !data.cerrado && <td className="num"><button className="nm-link" onClick={() => setEmp(e)}>Cargar días</button></td>}
                </tr>))}</tbody>
              <tfoot><tr><td>Total</td><td className="num">{n2(data.totales.horas_50)}</td><td className="num">{n2(data.totales.horas_100)}</td><td className="num">{n2(data.totales.horas_nocturnas)}</td><td className="num">{n2(data.totales.ausencias)}</td><td className="num">{n2(data.totales.tardanzas_min)}</td><td colSpan={edita && !data.cerrado ? 3 : 2} /></tr></tfoot>
            </table></div>
          )}
          <p className="nm-muted" style={{ marginTop: 10 }}>Una licencia sin aprobar no descuenta nada en la liquidación. Una ausencia injustificada hace perder el presentismo del mes. Los topes de horas extra (30 por mes, 200 por año) avisan pero no bloquean.</p>
        </>
      )}
      {emp && <DiasModal emp={emp} anio={anio} mes={mes} onClose={() => setEmp(null)} onSaved={(m) => { setEmp(null); show(m); void cargar(); }} />}
      {importar && (
        <ImportCsv title="Importar horas y ausencias" endpoint="/novedades/importar" ejemplo={EJEMPLO} onClose={() => setImportar(false)} onDone={(m) => { show(m); void cargar(); }}
          ayuda={<>Una fila por empleado y día. Columnas: <strong>legajo</strong> (o cuil), <strong>fecha</strong>, horas_50, horas_100, horas_nocturnas, ausencia (si/no), tardanzas (minutos). Si un día ya tenía carga, se reemplaza. Hasta 2.000 filas por vez.</>} />
      )}
      {node}
    </div>
  );
}

// ------------------------------------------------------------

interface Fila { fecha: string; h50: string; h100: string; hn: string; aus: boolean; tar: string }

function DiasModal({ emp, anio, mes, onClose, onSaved }: { emp: any; anio: number; mes: number; onClose: () => void; onSaved: (m: string) => void }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const clave = (f: Fila) => [f.h50, f.h100, f.hn, f.aus, f.tar].join("|");

  useEffect(() => {
    appApi(`/novedades?anio=${anio}&mes=${mes}&employee_id=${emp.employee_id}`).then((d) => {
      const por: Record<string, any> = {};
      for (const t of d.entradas || []) por[t.fecha] = t;
      const dias = new Date(anio, mes, 0).getDate();
      const rows: Fila[] = [];
      const o: Record<string, string> = {};
      for (let i = 1; i <= dias; i++) {
        const fecha = `${anio}-${String(mes).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
        const t = por[fecha];
        const r: Fila = { fecha, h50: t?.horas_50 ? String(t.horas_50).replace(".", ",") : "", h100: t?.horas_100 ? String(t.horas_100).replace(".", ",") : "", hn: t?.horas_nocturnas ? String(t.horas_nocturnas).replace(".", ",") : "", aus: !!t?.ausencia_injustificada, tar: t?.tardanzas ? String(t.tardanzas) : "" };
        rows.push(r);
        o[fecha] = clave(r);
      }
      setFilas(rows); setOrig(o);
    }).catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar"));
  }, [anio, mes, emp.employee_id]);

  const set = (i: number, k: keyof Fila, v: any) => setFilas((fs) => (fs || []).map((f, j) => j === i ? { ...f, [k]: v } : f));
  const cambiadas = (filas || []).filter((f) => clave(f) !== orig[f.fecha]);

  const guardar = async () => {
    setError("");
    const entradas = [];
    for (const f of cambiadas) {
      const h50 = num(f.h50) ?? 0, h100 = num(f.h100) ?? 0, hn = num(f.hn) ?? 0;
      if ([h50, h100, hn].some((x) => x < 0 || x > 24)) { setError(`El ${f.fecha.slice(8)}/${String(mes).padStart(2, "0")}: las horas van de 0 a 24.`); return; }
      entradas.push({ employee_id: emp.employee_id, fecha: f.fecha, horas_50: h50, horas_100: h100, horas_nocturnas: hn, ausencia_injustificada: f.aus, tardanzas: Math.round(num(f.tar) ?? 0) });
    }
    if (!entradas.length) { onClose(); return; }
    setBusy(true);
    try {
      const r = await appApi("/novedades", { method: "POST", body: { entradas } });
      onSaved(r.alertas?.length ? `Guardado. Ojo: ${r.alertas.join(" ")}` : "Novedades guardadas");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
    setBusy(false);
  };

  return (
    <Modal title={`Días de ${emp.nombre}`} eyebrow="NOVEDADES DEL MES" size="xl" onClose={onClose}
      footer={<><button className="nm2-btn" onClick={onClose}>Cancelar</button><button className="nm2-btn is-primary" disabled={busy || cambiadas.length === 0} onClick={() => void guardar()}>Guardar {cambiadas.length ? `(${cambiadas.length} día${cambiadas.length > 1 ? "s" : ""})` : ""}</button></>}>
      <p className="nm1-sub">Completá solo los días con algo para cargar. Si dejás un día en blanco, se borra lo que tenía.</p>
      {!filas && !error ? <Loading /> : filas && (
        <div className="nm1-tablewrap" style={{ maxHeight: "52vh", overflow: "auto" }}>
          <table className="nm-table">
            <thead><tr><th>Día</th><th className="num">HE 50 %</th><th className="num">HE 100 %</th><th className="num">Nocturnas</th><th>Ausente sin justificar</th><th className="num">Tardanza (min)</th></tr></thead>
            <tbody>{filas.map((f, i) => {
              const d = new Date(f.fecha + "T12:00:00");
              const finde = d.getDay() === 0 || d.getDay() === 6;
              return (
                <tr key={f.fecha} style={finde ? { background: "var(--nm-surface-2)" } : undefined}>
                  <td><strong>{f.fecha.slice(8)}</strong> <span className="nm-muted">{DIAS[d.getDay()]}</span></td>
                  {(["h50", "h100", "hn"] as const).map((k) => <td key={k} className="num"><input className="nm1-cell-input" inputMode="decimal" aria-label={`${k} día ${f.fecha.slice(8)}`} value={f[k]} onChange={(e) => set(i, k, e.target.value)} /></td>)}
                  <td><input type="checkbox" aria-label={`Ausente el día ${f.fecha.slice(8)}`} checked={f.aus} onChange={(e) => set(i, "aus", e.target.checked)} /></td>
                  <td className="num"><input className="nm1-cell-input" inputMode="numeric" aria-label={`Tardanza día ${f.fecha.slice(8)}`} value={f.tar} onChange={(e) => set(i, "tar", e.target.value)} /></td>
                </tr>);
            })}</tbody>
          </table>
        </div>
      )}
      {error && <p className="nm-note nm-note-error" style={{ marginTop: 12 }}>{error}</p>}
    </Modal>
  );
}
