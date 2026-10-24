const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Selector de mes y año (valor "AAAA-MM"). Los nombres van fijos en español: no dependen del idioma del navegador. */
export default function MesAnio({ value, onChange, allowEmpty = false }: { value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const m = /^(\d{4})-(\d{2})$/.exec(value || "");
  const anioActual = new Date().getFullYear();
  const anio = m ? Number(m[1]) : anioActual;
  const mes = m ? Number(m[2]) : 0;
  const anios: number[] = [];
  for (let a = Math.min(anio, anioActual - 5); a <= Math.max(anio, anioActual + 2); a++) anios.push(a);
  const emitir = (a: number, mm: number) => onChange(mm ? `${a}-${String(mm).padStart(2, "0")}` : "");
  return (
    <span style={{ display: "inline-flex", gap: 8 }}>
      <select aria-label="Mes" value={mes} onChange={(e) => emitir(anio, Number(e.target.value))}>
        {(allowEmpty || !mes) && <option value={0}>{allowEmpty ? "Todos los meses" : "Elegí el mes"}</option>}
        {MESES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <select aria-label="Año" value={anio} onChange={(e) => emitir(Number(e.target.value), mes)} disabled={!mes}>
        {anios.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </span>
  );
}
