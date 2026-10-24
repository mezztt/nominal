import type { ReactNode } from "react";
import { getSessionUser, hasPerm } from "../../config";
import { Pill } from "../ui";
import "../../g2.css";

export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Importe en pesos con siempre 2 decimales (es-AR) */
export function ars(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  const v = Number.isFinite(n) ? n : 0;
  return (v < 0 ? "-$ " : "$ ") + Math.abs(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function can(perm: string): boolean { return hasPerm(getSessionUser(), perm); }

export function EstadoPill({ estado }: { estado: string }) {
  const tone: Record<string, string> = { borrador: "gray", calculada: "blue", revisada: "violet", cerrada: "green", emitido: "green", anulado: "red", emitida: "green" };
  const label: Record<string, string> = { borrador: "Borrador", calculada: "Calculada", revisada: "Revisada", cerrada: "Cerrada", emitido: "Emitido", anulado: "Anulado", emitida: "Emitida" };
  return <Pill tone={tone[estado] || "gray"}>{label[estado] || estado}</Pill>;
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className="nm2-disclaimer" role="note">{children}</p>;
}

const COLORS = ["#7258bd", "#f4b740", "#2a8f5f", "#d64545", "#2a6fb0", "#c06fb0", "#8a7a3c", "#4aa3a3", "#a56a2a", "#6d6d85"];

/** Torta del costo laboral. segs: [clave, etiqueta, importe, grupo] */
export function Torta({ segs }: { segs: [string, string, number | string, string][] }) {
  const items = segs.map((s) => ({ key: s[0], label: s[1], v: Number(s[2]) })).filter((s) => s.v > 0);
  const total = items.reduce((a, b) => a + b.v, 0);
  if (!total) return null;
  let acc = 0;
  const R = 80, C = 90;
  const paths = items.map((it, i) => {
    const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += it.v;
    const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = items.length === 1
      ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z`
      : `M ${C} ${C} L ${C + R * Math.cos(a0)} ${C + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${C + R * Math.cos(a1)} ${C + R * Math.sin(a1)} Z`;
    return <path key={it.key} d={d} fill={COLORS[i % COLORS.length]} stroke="var(--nm-surface)" strokeWidth="1.5" />;
  });
  return (
    <div className="nm2-pie">
      <svg viewBox="0 0 180 180" role="img" aria-label="Distribución del costo laboral">{paths}</svg>
      <ul className="nm2-legend">
        {items.map((it, i) => (
          <li key={it.key}><i style={{ background: COLORS[i % COLORS.length] }} /><span>{it.label}</span><strong>{((it.v / total) * 100).toFixed(2).replace(".", ",")}%</strong></li>
        ))}
      </ul>
    </div>
  );
}
